/**
 * VANTA GARAGE — uploaded-image storage.
 *
 * Serverless deploys (Vercel) have a READ-ONLY filesystem except /tmp, so a
 * runtime write to public/uploads fails with EROFS and any save that persists
 * an upload dies with a generic 500. Images therefore live in the vanta_uploads
 * table (base64) — durable, instance-independent, served by the
 * /api/store/admin/uploads/[filename] route. The disk write stays as a local
 * best-effort so dev keeps files on disk.
 *
 * Cap: 5MB per image after base64 — larger payloads are rejected by callers.
 */

import { getStoreDb } from "../store-db.ts";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const MAX_BYTES = 5 * 1024 * 1024;

export function uploadsMaxBytes(): number {
  return MAX_BYTES;
}

export function contentTypeForFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
}

/** Persist image bytes. DB write is authoritative; disk write is best-effort. */
export async function saveUpload(filename: string, buffer: Buffer): Promise<void> {
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error(`Image too large: ${Math.round(buffer.byteLength / 1024)}KB (max 5MB).`);
  }
  const db = await getStoreDb();
  await db.execute({
    sql: `INSERT INTO vanta_uploads (filename, data_base64, content_type, bytes, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(filename) DO UPDATE SET
            data_base64 = excluded.data_base64,
            content_type = excluded.content_type,
            bytes = excluded.bytes,
            created_at = excluded.created_at`,
    args: [
      filename,
      buffer.toString("base64"),
      contentTypeForFilename(filename),
      buffer.byteLength,
      new Date().toISOString(),
    ],
  });
  // Best-effort disk cache for local dev — never fails the request.
  try {
    const dir = join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), buffer);
  } catch {
    /* read-only FS (serverless) or unwritable path — DB copy already saved */
  }
}

export async function getUpload(filename: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT data_base64, content_type FROM vanta_uploads WHERE filename = ?`,
    args: [filename],
  });
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    buffer: Buffer.from(String(row.data_base64), "base64"),
    contentType: String(row.content_type || "application/octet-stream"),
  };
}