/**
 * VANTA GARAGE — catalogue service.
 * Products (vehicles for sale), categories, inventory, pricing.
 */

import { getStoreDb } from "../store-db.ts";
import type { Product, Category, ProductMedia, Inventory, ProductInput, Exclusivity, AvailabilityState, Promotion, PromotionInput } from "../store-types.ts";

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: Number(row.id),
    categoryId: row.category_id === null ? null : Number(row.category_id),
    cpm2CarCode: row.cpm2_car_code === null ? null : Number(row.cpm2_car_code),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    basePriceCents: Number(row.base_price_cents ?? 0),
    currency: String(row.currency ?? "ZAR"),
    stockQuantity: Number(row.stock_quantity ?? 0),
    availabilityState: (row.availability_state ?? "available") as AvailabilityState,
    exclusivity: (row.exclusivity ?? "standard") as Exclusivity,
    isFeatured: Number(row.is_featured ?? 0) === 1,
    isNew: Number(row.is_new ?? 0) === 1,
    isSale: Number(row.is_sale ?? 0) === 1,
    isPublished: Number(row.is_published ?? 0) === 1,
    version: Number(row.version ?? 1),
    airSuspension: Number(row.air_suspension ?? 0) === 1,
    unlockedBodykits: Number(row.unlocked_bodykits ?? 0) === 1,
    specHp: row.spec_hp === null || row.spec_hp === undefined ? null : Number(row.spec_hp),
    specTopSpeed: row.spec_top_speed === null || row.spec_top_speed === undefined ? null : Number(row.spec_top_speed),
    specZeroHundred: row.spec_zero_hundred === null || row.spec_zero_hundred === undefined ? null : String(row.spec_zero_hundred),
    specDrive: row.spec_drive === null || row.spec_drive === undefined ? null : String(row.spec_drive),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function rowToCategory(row: Record<string, unknown>): Category {
  return {
    id: Number(row.id),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    description: String(row.description ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Number(row.is_active ?? 1) === 1,
    createdAt: String(row.created_at ?? ""),
  };
}

function rowToMedia(row: Record<string, unknown>): ProductMedia {
  return {
    id: Number(row.id),
    productId: Number(row.product_id),
    provider: String(row.provider ?? "local"),
    providerId: String(row.provider_id ?? ""),
    publicUrl: String(row.public_url ?? ""),
    originalRef: String(row.original_ref ?? ""),
    fileType: String(row.file_type ?? "image"),
    width: row.width === null ? null : Number(row.width),
    height: row.height === null ? null : Number(row.height),
    fileSize: row.file_size === null ? null : Number(row.file_size),
    sortOrder: Number(row.sort_order ?? 0),
    version: Number(row.version ?? 1),
    isPublished: Number(row.is_published ?? 1) === 1,
    uploadedAt: String(row.uploaded_at ?? ""),
  };
}

export async function createCategory(input: { name: string; slug: string; description?: string; sortOrder?: number }): Promise<Category> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `INSERT INTO vanta_categories (name, slug, description, sort_order, is_active, created_at)
          VALUES (?, ?, ?, ?, 1, ?)`,
    args: [input.name.trim(), input.slug.trim(), input.description ?? "", input.sortOrder ?? 0, now],
  });
  const id = result.lastInsertRowid;
  if (id === null) throw new Error("Category insert returned no id");
  return rowToCategory({ id, name: input.name.trim(), slug: input.slug.trim(), description: input.description ?? "", sort_order: input.sortOrder ?? 0, is_active: true, created_at: now });
}

export async function listCategories(): Promise<Category[]> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_categories WHERE is_active = 1 ORDER BY sort_order ASC, name ASC`,
    args: [],
  });
  return result.rows.map(rowToCategory);
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `INSERT INTO vanta_products (category_id, cpm2_car_code, name, description, base_price_cents, currency, stock_quantity, availability_state, exclusivity, is_featured, is_new, is_sale, is_published, air_suspension, unlocked_bodykits, version, created_at, updated_at, spec_hp, spec_top_speed, spec_zero_hundred, spec_drive)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.categoryId ?? null,
      input.cpm2CarCode ?? null,
      input.name.trim(),
      input.description ?? "",
      input.basePriceCents ?? 0,
      input.currency ?? "ZAR",
      input.stockQuantity ?? 0,
      input.availabilityState ?? "available",
      input.exclusivity ?? "standard",
      input.isFeatured ? 1 : 0,
      input.isNew ? 1 : 0,
      input.isSale ? 1 : 0,
      input.isPublished ? 1 : 0,
      input.airSuspension ? 1 : 0,
      input.unlockedBodykits ? 1 : 0,
      now,
      now,
      input.specHp ?? null,
      input.specTopSpeed ?? null,
      input.specZeroHundred ?? null,
      input.specDrive ?? null,
    ],
  });
  const id = result.lastInsertRowid;
  if (id === null) throw new Error("Product insert returned no id");
  return rowToProduct({ id, category_id: input.categoryId ?? null, cpm2_car_code: input.cpm2CarCode ?? null, name: input.name.trim(), description: input.description ?? "", base_price_cents: input.basePriceCents ?? 0, currency: input.currency ?? "ZAR", stock_quantity: input.stockQuantity ?? 0, availability_state: input.availabilityState ?? "available", exclusivity: input.exclusivity ?? "standard", is_featured: input.isFeatured ? 1 : 0, is_new: input.isNew ? 1 : 0, is_sale: input.isSale ? 1 : 0, is_published: input.isPublished ? 1 : 0, air_suspension: input.airSuspension ? 1 : 0, unlocked_bodykits: input.unlockedBodykits ? 1 : 0, version: 1, spec_hp: input.specHp ?? null, spec_top_speed: input.specTopSpeed ?? null, spec_zero_hundred: input.specZeroHundred ?? null, spec_drive: input.specDrive ?? null, created_at: now, updated_at: now });
}

export async function getProduct(id: number): Promise<Product | null> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_products WHERE id = ?`,
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return rowToProduct(result.rows[0]);
}

export async function listProducts({ onlyPublished = true, featuredOnly = false }: { onlyPublished?: boolean; featuredOnly?: boolean } = {}): Promise<Product[]> {
  const db = await getStoreDb();
  let sql = `SELECT * FROM vanta_products WHERE 1=1`;
  const args: unknown[] = [];
  if (onlyPublished) {
    sql += ` AND is_published = 1`;
  }
  if (featuredOnly) {
    sql += ` AND is_featured = 1`;
  }
  sql += ` ORDER BY is_featured DESC, created_at DESC`;
  const result = await db.execute({ sql, args });
  return result.rows.map(rowToProduct);
}

export async function searchProducts(query: string): Promise<Product[]> {
  const db = await getStoreDb();
  const q = `%${query.toLowerCase()}%`;
  const result = await db.execute({
    sql: `SELECT * FROM vanta_products WHERE is_published = 1 AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ?) ORDER BY is_featured DESC, name ASC`,
    args: [q, q],
  });
  return result.rows.map(rowToProduct);
}

export async function updateProductStock(productId: number, stockQuantity: number): Promise<void> {
  const db = await getStoreDb();
  await db.execute({
    sql: `UPDATE vanta_products SET stock_quantity = ?, updated_at = ? WHERE id = ?`,
    args: [stockQuantity, new Date().toISOString(), productId],
  });
}

export async function updateProduct(
  productId: number,
  input: Partial<ProductInput> & { isFeatured?: boolean; isPublished?: boolean; isNew?: boolean; isSale?: boolean },
): Promise<Product | null> {
  const db = await getStoreDb();
  const fields: string[] = [];
  const args: unknown[] = [];
  const set = (col: string, val: unknown) => {
    fields.push(`${col} = ?`);
    args.push(val);
  };
  if (input.categoryId !== undefined) set("category_id", input.categoryId);
  if (input.cpm2CarCode !== undefined) set("cpm2_car_code", input.cpm2CarCode);
  if (input.name !== undefined) set("name", input.name.trim());
  if (input.description !== undefined) set("description", input.description);
  if (input.basePriceCents !== undefined) set("base_price_cents", input.basePriceCents);
  if (input.currency !== undefined) set("currency", input.currency);
  if (input.stockQuantity !== undefined) set("stock_quantity", input.stockQuantity);
  if (input.availabilityState !== undefined) set("availability_state", input.availabilityState);
  if (input.exclusivity !== undefined) set("exclusivity", input.exclusivity);
  if (input.specHp !== undefined) set("spec_hp", input.specHp);
  if (input.specTopSpeed !== undefined) set("spec_top_speed", input.specTopSpeed);
  if (input.specZeroHundred !== undefined) set("spec_zero_hundred", input.specZeroHundred);
  if (input.specDrive !== undefined) set("spec_drive", input.specDrive);
  if (input.isFeatured !== undefined) set("is_featured", input.isFeatured ? 1 : 0);
  if (input.isNew !== undefined) set("is_new", input.isNew ? 1 : 0);
  if (input.isSale !== undefined) set("is_sale", input.isSale ? 1 : 0);
  if (input.isPublished !== undefined) set("is_published", input.isPublished ? 1 : 0);
  if (input.airSuspension !== undefined) set("air_suspension", input.airSuspension ? 1 : 0);
  if (input.unlockedBodykits !== undefined) set("unlocked_bodykits", input.unlockedBodykits ? 1 : 0);
  if (fields.length === 0) return getProduct(productId);
  set("updated_at", new Date().toISOString());
  args.push(productId);
  await db.execute({
    sql: `UPDATE vanta_products SET ${fields.join(", ")} WHERE id = ?`,
    args,
  });
  return getProduct(productId);
}

export async function createInventory(productId: number, stockQuantity: number): Promise<Inventory> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `INSERT INTO vanta_inventory (product_id, stock_quantity, reserved_quantity, version, updated_at)
          VALUES (?, ?, 0, 1, ?)`,
    args: [productId, stockQuantity, now],
  });
  const id = result.lastInsertRowid;
  if (id === null) throw new Error("Inventory insert returned no id");
  return rowToInventory({ id, product_id: productId, stock_quantity: stockQuantity, reserved_quantity: 0, version: 1, updated_at: now });
}

export async function getInventory(productId: number): Promise<Inventory | null> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_inventory WHERE product_id = ?`,
    args: [productId],
  });
  if (result.rows.length === 0) return null;
  return rowToInventory(result.rows[0]);
}

function rowToInventory(row: Record<string, unknown>): Inventory {
  return {
    id: Number(row.id),
    productId: Number(row.product_id),
    stockQuantity: Number(row.stock_quantity ?? 0),
    reservedQuantity: Number(row.reserved_quantity ?? 0),
    version: Number(row.version ?? 1),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function reserveStock(productId: number, quantity: number): Promise<boolean> {
  /**
   * Atomic stock reservation. Prevents overselling under concurrent checkouts.
   * Returns false if insufficient stock available.
   */
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `UPDATE vanta_inventory
          SET reserved_quantity = reserved_quantity + ?, version = version + 1, updated_at = ?
          WHERE product_id = ? AND (stock_quantity - reserved_quantity) >= ?`,
    args: [quantity, new Date().toISOString(), productId, quantity],
  });
  return result.affectedRowCount > 0;
}

export async function releaseStock(productId: number, quantity: number): Promise<void> {
  const db = await getStoreDb();
  await db.execute({
    sql: `UPDATE vanta_inventory
          SET reserved_quantity = MAX(0, reserved_quantity - ?), version = version + 1, updated_at = ?
          WHERE product_id = ?`,
    args: [quantity, new Date().toISOString(), productId],
  });
}

export async function confirmStockDeduction(productId: number, quantity: number): Promise<void> {
  /**
   * Called after payment confirmed: move reserved stock out of available pool permanently.
   */
  const db = await getStoreDb();
  await db.execute({
    sql: `UPDATE vanta_inventory
          SET stock_quantity = stock_quantity - ?, reserved_quantity = MAX(0, reserved_quantity - ?), version = version + 1, updated_at = ?
          WHERE product_id = ?`,
    args: [quantity, quantity, new Date().toISOString(), productId],
  });
}

export async function listMedia(productId: number): Promise<ProductMedia[]> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_product_media WHERE product_id = ? AND is_published = 1 ORDER BY sort_order ASC, uploaded_at ASC`,
    args: [productId],
  });
  return result.rows.map(rowToMedia);
}

export async function setSystemConfig(key: string, value: string): Promise<void> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO vanta_system_config (key, value, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    args: [key, value, now],
  });
}

export async function getSystemConfig(key: string): Promise<string | null> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT value FROM vanta_system_config WHERE key = ?`,
    args: [key],
  });
  if (result.rows.length === 0) return null;
  return String(result.rows[0].value ?? null);
}

export async function createMedia(input: {
  productId: number;
  publicUrl: string;
  provider?: string;
  providerId?: string;
  originalRef?: string;
  fileType?: string;
  width?: number | null;
  height?: number | null;
  fileSize?: number | null;
  sortOrder?: number;
}): Promise<ProductMedia> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `INSERT INTO vanta_product_media (product_id, provider, provider_id, original_ref, public_url, file_type, width, height, file_size, sort_order, is_published, uploaded_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    args: [
      input.productId,
      input.provider ?? "local",
      input.providerId ?? "",
      input.originalRef ?? "",
      input.publicUrl.trim(),
      input.fileType ?? "image",
      input.width ?? null,
      input.height ?? null,
      input.fileSize ?? null,
      input.sortOrder ?? 0,
      now,
    ],
  });
  const id = result.lastInsertRowid;
  if (id === null) throw new Error("Media insert returned no id");
  return rowToMedia({ id, ...input, file_type: input.fileType ?? "image", sort_order: input.sortOrder ?? 0, is_published: true, uploaded_at: now, version: 1 });
}

function rowToPromotion(row: Record<string, unknown>): Promotion {
  return {
    id: Number(row.id),
    title: String(row.title ?? ""),
    subtitle: String(row.subtitle ?? ""),
    description: String(row.description ?? ""),
    discountPercent: Number(row.discount_percent ?? 0),
    discountCode: String(row.discount_code ?? ""),
    ctaText: String(row.cta_text ?? "Shop now"),
    ctaLink: String(row.cta_link ?? "/store/categories"),
    backgroundColor: String(row.background_color ?? "var(--color-paper-raised)"),
    accentColor: String(row.accent_color ?? "#d4af4f"),
    imageUrl: String(row.image_url ?? ""),
    isActive: Number(row.is_active ?? 1) === 1,
    startDate: row.start_date === null || row.start_date === undefined ? null : String(row.start_date),
    endDate: row.end_date === null || row.end_date === undefined ? null : String(row.end_date),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function listPromotions({ onlyActive = true }: { onlyActive?: boolean } = {}): Promise<Promotion[]> {
  const db = await getStoreDb();
  let sql = `SELECT * FROM vanta_promotions WHERE 1=1`;
  const args: unknown[] = [];
  if (onlyActive) {
    sql += ` AND is_active = 1`;
    const now = new Date().toISOString();
    sql += ` AND (start_date IS NULL OR start_date <= ?)`;
    args.push(now);
    sql += ` AND (end_date IS NULL OR end_date >= ?)`;
    args.push(now);
  }
  sql += ` ORDER BY sort_order ASC, created_at DESC`;
  const result = await db.execute({ sql, args });
  return result.rows.map(rowToPromotion);
}

export async function getPromotion(id: number): Promise<Promotion | null> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_promotions WHERE id = ?`,
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return rowToPromotion(result.rows[0]);
}

export async function createPromotion(input: PromotionInput): Promise<Promotion> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `INSERT INTO vanta_promotions (title, subtitle, description, discount_percent, discount_code, cta_text, cta_link, background_color, accent_color, image_url, is_active, start_date, end_date, sort_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.title.trim(),
      input.subtitle ?? "",
      input.description ?? "",
      input.discountPercent ?? 0,
      input.discountCode ?? "",
      input.ctaText ?? "Shop now",
      input.ctaLink ?? "/store/categories",
      input.backgroundColor ?? "var(--color-paper-raised)",
      input.accentColor ?? "#d4af4f",
      input.imageUrl ?? "",
      input.isActive ?? true ? 1 : 0,
      input.startDate ?? null,
      input.endDate ?? null,
      input.sortOrder ?? 0,
      now,
      now,
    ],
  });
  const id = result.lastInsertRowid;
  if (id === null) throw new Error("Promotion insert returned no id");
  return getPromotion(id) as Promise<Promotion>;
}

export async function updatePromotion(
  promotionId: number,
  input: Partial<PromotionInput>
): Promise<Promotion | null> {
  const db = await getStoreDb();
  const fields: string[] = [];
  const args: unknown[] = [];
  const set = (col: string, val: unknown) => {
    fields.push(`${col} = ?`);
    args.push(val);
  };
  if (input.title !== undefined) set("title", input.title.trim());
  if (input.subtitle !== undefined) set("subtitle", input.subtitle);
  if (input.description !== undefined) set("description", input.description);
  if (input.discountPercent !== undefined) set("discount_percent", input.discountPercent);
  if (input.discountCode !== undefined) set("discount_code", input.discountCode);
  if (input.ctaText !== undefined) set("cta_text", input.ctaText);
  if (input.ctaLink !== undefined) set("cta_link", input.ctaLink);
  if (input.backgroundColor !== undefined) set("background_color", input.backgroundColor);
  if (input.accentColor !== undefined) set("accent_color", input.accentColor);
  if (input.imageUrl !== undefined) set("image_url", input.imageUrl);
  if (input.isActive !== undefined) set("is_active", input.isActive ? 1 : 0);
  if (input.startDate !== undefined) set("start_date", input.startDate);
  if (input.endDate !== undefined) set("end_date", input.endDate);
  if (input.sortOrder !== undefined) set("sort_order", input.sortOrder);
  if (fields.length === 0) return getPromotion(promotionId);
  set("updated_at", new Date().toISOString());
  args.push(promotionId);
  await db.execute({
    sql: `UPDATE vanta_promotions SET ${fields.join(", ")} WHERE id = ?`,
    args,
  });
  return getPromotion(promotionId);
}

export async function deletePromotion(promotionId: number): Promise<boolean> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `DELETE FROM vanta_promotions WHERE id = ?`,
    args: [promotionId],
  });
  return (result.affectedRowCount ?? 0) > 0;
}
