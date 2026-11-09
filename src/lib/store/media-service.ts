/**
 * VANTA GARAGE — Media service.
 * Provider-agnostic media storage abstraction.
 * Defaults to local file storage; configurable via media provider.
 */

import { getStoreDb } from "../store-db.ts";

export type MediaFile = {
  id: number;
  productId: number;
  provider: string;
  providerId: string;
  publicUrl: string;
  originalRef: string;
  fileType: string;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  sortOrder: number;
  version: number;
  isPublished: boolean;
  uploadedAt: string;
};

function rowToMedia(row: Record<string, unknown>): MediaFile {
  return {
    id: Number(row.id),
    productId: Number(row.product_id),
    provider: String(row.provider),
    providerId: String(row.provider_id),
    publicUrl: String(row.public_url),
    originalRef: String(row.original_ref),
    fileType: String(row.file_type),
    width: row.width ? Number(row.width) : null,
    height: row.height ? Number(row.height) : null,
    fileSize: row.file_size ? Number(row.file_size) : null,
    sortOrder: Number(row.sort_order ?? 0),
    version: Number(row.version ?? 1),
    isPublished: Number(row.is_published ?? 1) === 1,
    uploadedAt: String(row.uploaded_at ?? ""),
  };
}

export interface MediaProvider {
  upload(productId: number, file: File): Promise<MediaFile>;
  getUrl(productId: number): Promise<string[]>;
  delete(productId: number, providerId: string): Promise<void>;
  list(productId: number): Promise<MediaFile[]>;
}

export class LocalMediaProvider implements MediaProvider {
  async upload(productId: number, file: File): Promise<MediaFile> {
    throw new Error("Local media upload not implemented — configure a media provider.");
  }
  async getUrl(productId: number): Promise<string[]> {
    throw new Error("Local media URL retrieval not implemented.");
  }
  async delete(productId: number, providerId: string): Promise<void> {
    throw new Error("Local media delete not implemented.");
  }
  async list(productId: number): Promise<MediaFile[]> {
    throw new Error("Local media list not implemented.");
  }
}

export async function listMedia(productId: number): Promise<MediaFile[]> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_product_media WHERE product_id = ? AND is_published = 1 ORDER BY sort_order ASC, uploaded_at ASC`,
    args: [productId],
  });
  return result.rows.map(rowToMedia);
}

export async function getMedia(productId: number, mediaId: number): Promise<MediaFile | null> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_product_media WHERE id = ? AND product_id = ?`,
    args: [mediaId, productId],
  });
  if (result.rows.length === 0) return null;
  return rowToMedia(result.rows[0]);
}

export async function createMedia(
  productId: number,
  provider: string,
  providerId: string,
  publicUrl: string,
  originalRef: string,
  fileType: string,
  width: number | null,
  height: number | null,
  fileSize: number | null,
): Promise<MediaFile> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `INSERT INTO vanta_product_media (product_id, provider, provider_id, public_url, original_ref, file_type, width, height, file_size, sort_order, version, is_published, uploaded_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    args: [productId, provider, providerId, publicUrl, originalRef, fileType, width, height, fileSize, 0, 1, now],
  });
  const id = result.lastInsertRowid;
  if (id === null) throw new Error("Media insert returned no id");
  return rowToMedia({ id, product_id: productId, provider, provider_id: providerId, public_url: publicUrl, original_ref: originalRef, file_type: fileType, width, height, file_size: fileSize, sort_order: 0, version: 1, is_published: true, uploaded_at: now });
}

export async function deleteMedia(productId: number, providerId: string): Promise<void> {
  const db = await getStoreDb();
  await db.execute({
    sql: `DELETE FROM vanta_product_media WHERE product_id = ? AND provider_id = ?`,
    args: [productId, providerId],
  });
}