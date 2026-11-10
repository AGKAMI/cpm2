/**
 * VANTA GARAGE — background job queue.
 * Sec 20.1: background processing, retry mechanisms, graceful degradation.
 *
 * Jobs are stored in vanta_jobs and processed by the internal /api/store/internal/jobs route.
 * Job types:
 *   - expire_reservation: release stock for expired payment reservations
 *   - retry_webhook: retry failed payment webhooks
 *   - send_alert: deliver alert notifications
 *   - detect_suspicious: run suspicious activity detection
 */

import { getStoreDb } from "../store-db.ts";

export type JobType =
  | "expire_reservation"
  | "retry_webhook"
  | "send_alert"
  | "detect_suspicious";

export type Job = {
  id: number;
  type: JobType;
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "completed" | "failed" | "dead_letter";
  attempts: number;
  maxAttempts: number;
  nextRunAt: string;
  createdAt: string;
  updatedAt: string;
  error: string | null;
};

function rowToJob(row: Record<string, unknown>): Job {
  return {
    id: Number(row.id),
    type: (row.type ?? "expire_reservation") as JobType,
    payload: row.payload === null || row.payload === undefined ? {} : JSON.parse(String(row.payload ?? "{}")),
    status: (row.status ?? "pending") as Job["status"],
    attempts: Number(row.attempts ?? 0),
    maxAttempts: Number(row.max_attempts ?? 3),
    nextRunAt: String(row.next_run_at ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    error: row.error === null || row.error === undefined ? null : String(row.error),
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Enqueue a new job. */
export async function enqueueJob(input: {
  type: JobType;
  payload?: Record<string, unknown>;
  delayMs?: number;
  maxAttempts?: number;
}): Promise<number> {
  const db = await getStoreDb();
  const now = nowIso();
  const nextRunAt = new Date(Date.now() + (input.delayMs ?? 0)).toISOString();
  const result = await db.execute({
    sql: `INSERT INTO vanta_jobs (type, payload, status, attempts, max_attempts, next_run_at, created_at, updated_at)
          VALUES (?, ?, 'pending', 0, ?, ?, ?, ?)`,
    args: [
      input.type,
      JSON.stringify(input.payload ?? {}),
      input.maxAttempts ?? 3,
      nextRunAt,
      now,
      now,
    ],
  });
  const id = Number(result.lastInsertRowid);
  if (id === 0 || !id) throw new Error("Job insert returned no id");
  return id;
}

/** Claim the next due pending job for processing. Returns null if none due. */
export async function claimJob(): Promise<Job | null> {
  const db = await getStoreDb();
  const now = nowIso();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_jobs
          WHERE status = 'pending' AND next_run_at <= ?
          ORDER BY next_run_at ASC
          LIMIT 1`,
    args: [now],
  });
  if (result.rows.length === 0) return null;
  const job = rowToJob(result.rows[0]);
  await db.execute({
    sql: `UPDATE vanta_jobs SET status = 'processing', updated_at = ? WHERE id = ?`,
    args: [now, job.id],
  });
  return { ...job, status: "processing" };
}

/** Mark a job as completed. */
export async function completeJob(jobId: number): Promise<void> {
  const db = await getStoreDb();
  const now = nowIso();
  await db.execute({
    sql: `UPDATE vanta_jobs SET status = 'completed', updated_at = ?, error = NULL WHERE id = ?`,
    args: [now, jobId],
  });
}

/** Mark a job as failed. Schedules a retry with exponential backoff, or moves to dead_letter. */
export async function failJob(jobId: number, error: string): Promise<void> {
  const db = await getStoreDb();
  const now = nowIso();
  const jobResult = await db.execute({
    sql: `SELECT attempts, max_attempts FROM vanta_jobs WHERE id = ?`,
    args: [jobId],
  });
  if (jobResult.rows.length === 0) return;
  const row = jobResult.rows[0];
  const attempts = Number(row.attempts) + 1;
  const maxAttempts = Number(row.max_attempts ?? 3);

  let status: "failed" | "dead_letter";
  let nextRunAt: string;
  if (attempts >= maxAttempts) {
    status = "dead_letter";
    nextRunAt = now;
  } else {
    status = "failed";
    // Exponential backoff: 1m, 5m, 30m, 2h
    const backoffMinutes = [1, 5, 30, 120][Math.min(attempts - 1, 3)] ?? 120;
    nextRunAt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
  }

  await db.execute({
    sql: `UPDATE vanta_jobs SET status = ?, attempts = ?, next_run_at = ?, updated_at = ?, error = ? WHERE id = ?`,
    args: [status, attempts, nextRunAt, now, error, jobId],
  });
}

/** List pending jobs due for processing (for admin monitoring). */
export async function listDueJobs(limit = 50): Promise<Job[]> {
  const db = await getStoreDb();
  const now = nowIso();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_jobs
          WHERE status = 'pending' AND next_run_at <= ?
          ORDER BY next_run_at ASC
          LIMIT ?`,
    args: [now, limit],
  });
  return result.rows.map(rowToJob);
}

/** List dead-letter jobs for admin review. */
export async function listDeadLetterJobs(limit = 50): Promise<Job[]> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_jobs
          WHERE status = 'dead_letter'
          ORDER BY updated_at DESC
          LIMIT ?`,
    args: [limit],
  });
  return result.rows.map(rowToJob);
}

/** Requeue a dead-letter job back to pending. */
export async function requeueJob(jobId: number): Promise<void> {
  const db = await getStoreDb();
  const now = nowIso();
  await db.execute({
    sql: `UPDATE vanta_jobs SET status = 'pending', attempts = 0, next_run_at = ?, updated_at = ?, error = NULL WHERE id = ? AND status = 'dead_letter'`,
    args: [now, now, jobId],
  });
}

/** Process all due jobs. Called by the internal jobs route. */
export async function processJobs(): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const job = await claimJob();
    if (!job) break;

    try {
      switch (job.type) {
        case "expire_reservation": {
          const { expireReservation } = await import("./checkout.ts");
          await expireReservation(String(job.payload.orderId));
          break;
        }
        case "retry_webhook": {
          const { retryWebhook } = await import("./payfast.ts");
          await retryWebhook(String(job.payload.paymentId));
          break;
        }
        case "send_alert": {
          const { sendAlert } = await import("./alerts.ts");
          await sendAlert(job.payload);
          break;
        }
        case "detect_suspicious": {
          const { runSuspiciousDetection } = await import("./suspicious.ts");
          await runSuspiciousDetection();
          break;
        }
        default: {
          throw new Error(`Unknown job type: ${job.type}`);
        }
      }
      await completeJob(job.id);
      processed++;
    } catch (err) {
      await failJob(job.id, err instanceof Error ? err.message : String(err));
      failed++;
    }
  }

  return { processed, failed };
}
