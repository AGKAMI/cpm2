/**
 * FLEET LEDGER — account image storage.
 *
 * The original route wrote uploads to public/uploads/fleet/, which is a
 * READ-ONLY filesystem on serverless (Vercel) — every upload died with EROFS
 * and the client showed "Upload failed". Images live in the fleet_uploads
 * table (base64) instead: durable across instances, no FS dependency.
 * The disk write stays as a local best-effort cache.
 */

import { getTursoDb } from "./db-turso.ts";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const MAX_BYTES = 5 * 1024 * 1024;

export function fleetUploadsMaxBytes(): number {
  return MAX_BYTES;
}

export function fleetContentTypeForFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
}

/** Persist image bytes. DB write is authoritative; disk write is best-effort. */
export async function saveFleetUpload(filename: string, buffer: Buffer): Promise<void> {
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error(`Image too large: ${Math.round(buffer.byteLength / 1024)}KB (max 5MB).`);
  }
  const db = await getTursoDb();
  await db.execute({
    sql: `INSERT INTO fleet_uploads (filename, data_base64, content_type, size_bytes, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(filename) DO UPDATE SET
            data_base64 = excluded.data_base64,
            content_type = excluded.content_type,
            size_bytes = excluded.size_bytes,
            created_at = excluded.created_at`,
    args: [
      filename,
      buffer.toString("base64"),
      fleetContentTypeForFilename(filename),
      buffer.byteLength,
      new Date().toISOString(),
    ],
  });
  // Best-effort disk cache for local dev — never fails the request.
  try {
    const dir = join(process.cwd(), "public", "uploads", "fleet");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), buffer);
  } catch {
    /* read-only FS (serverless) or unwritable path — DB copy already saved */
  }
}

export async function getFleetUpload(filename: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const db = await getTursoDb();
  const result = await db.execute({
    sql: `SELECT data_base64, content_type FROM fleet_uploads WHERE filename = ?`,
    args: [filename],
  });
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    buffer: Buffer.from(String(row.data_base64), "base64"),
    contentType: String(row.content_type || "application/octet-stream"),
  };
}

export async function deleteFleetUpload(filename: string): Promise<void> {
  const db = await getTursoDb();
  await db.execute({
    sql: `DELETE FROM fleet_uploads WHERE filename = ?`,
    args: [filename],
  });
}