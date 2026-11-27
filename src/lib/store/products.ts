/**
 * VANTA GARAGE — catalogue service.
 * Products (vehicles for sale), categories, inventory, pricing.
 */

import { getStoreDb } from "../store-db.ts";
import type { Product, Category, ProductMedia, Inventory, ProductInput, Exclusivity, AvailabilityState, Promotion, PromotionInput } from "../store-types.ts";

export type ProductKind = "car" | "account" | "service";
export type ProductGame = "cpm1" | "cpm2";

/** Column values are trusted only as far as they parse; anything unexpected
 *  falls back to the default instead of propagating garbage into the UI. */
function safeKind(v: unknown): ProductKind {
  // 'service' must pass through, not collapse to 'car'. The fallback used to
  // be non-account => car, which silently moved every service product onto the
  // cars shelf and emptied /store/{game}/services even with a correct DB row.
  if (v === "account") return "account";
  if (v === "service") return "service";
  return "car";
}
function safeGame(v: unknown): ProductGame {
  return v === "cpm1" ? "cpm1" : "cpm2";
}

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: Number(row.id),
    categoryId: row.category_id === null ? null : Number(row.category_id),
    kind: safeKind(row.kind),
    game: safeGame(row.game),
    cpm2CarCode: row.cpm2_car_code === null ? null : Number(row.cpm2_car_code),
    // vanta_products has no image column — covers resolve through the media
    // tables (listCoverImageMap), so a product row's own image is always null.
    imageUrl: row.image_url == null ? null : String(row.image_url),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    basePriceCents: Number(row.base_price_cents ?? 0),
    discountPercent: Number(row.discount_percent ?? 0),
    currency: String(row.currency ?? ""),
    stockQuantity: Number(row.stock_quantity ?? 0),
    stockInitial: Number(row.initial_stock ?? 0),
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

/**
 * Category art can be stored inline as a base64 data URL, which is 120-200 KB
 * per row and used to blow the categories JSON up to ~830 KB (and every page
 * that inlines categories with it). Hand the browser a stable URL instead and
 * let /api/store/categories/[id]/image stream the bytes with cache headers.
 */
function categoryImage(row: Record<string, unknown>): string {
  const raw = String(row.image_url ?? "");
  if (raw.startsWith("data:")) return `/api/store/categories/${Number(row.id)}/image`;
  return raw;
}

function rowToCategory(row: Record<string, unknown>): Category {
  return {
    id: Number(row.id),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    description: String(row.description ?? ""),
    imageUrl: categoryImage(row),
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Number(row.is_active ?? 1) === 1,
    game: safeGame(row.game),
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

export async function createCategory(input: {
  name: string;
  slug: string;
  description?: string;
  sortOrder?: number;
  imageUrl?: string;
  game?: ProductGame;
}): Promise<Category> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  const game = input.game ?? "cpm2";
  const result = await db.execute({
    sql: `INSERT INTO vanta_categories (name, slug, description, sort_order, image_url, is_active, game, created_at)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    args: [input.name.trim(), input.slug.trim(), input.description ?? "", input.sortOrder ?? 0, input.imageUrl ?? "", game, now],
  });
  const id = result.lastInsertRowid;
  if (id === null) throw new Error("Category insert returned no id");
  return rowToCategory({ id, name: input.name.trim(), slug: input.slug.trim(), description: input.description ?? "", image_url: input.imageUrl ?? "", sort_order: input.sortOrder ?? 0, is_active: true, game, created_at: now });
}

export async function updateCategory(id: number, input: { name?: string; slug?: string; description?: string; sortOrder?: number; imageUrl?: string; game?: ProductGame }): Promise<Category> {
  const db = await getStoreDb();
  const sets: string[] = [];
  const args: unknown[] = [];
  if (input.name !== undefined) { sets.push("name = ?"); args.push(input.name.trim()); }
  if (input.slug !== undefined) { sets.push("slug = ?"); args.push(input.slug.trim()); }
  if (input.description !== undefined) { sets.push("description = ?"); args.push(input.description); }
  if (input.sortOrder !== undefined) { sets.push("sort_order = ?"); args.push(input.sortOrder); }
  // The storefront exposes stored base64 art as /api/store/categories/<id>/image.
  // An admin form that round-trips that URL must not overwrite the original
  // artwork with the proxy path (which would 404 and lose the image).
  if (input.imageUrl !== undefined && !input.imageUrl.startsWith("/api/store/categories/")) {
    sets.push("image_url = ?");
    args.push(input.imageUrl);
  }
  if (input.game !== undefined) {
    sets.push("game = ?");
    args.push(input.game);
  }
  if (sets.length > 0) {
    args.push(id);
    await db.execute({
      sql: `UPDATE vanta_categories SET ${sets.join(", ")} WHERE id = ?`,
      args,
    });
  }
  // Return the updated row.
  const result = await db.execute({
    sql: `SELECT * FROM vanta_categories WHERE id = ?`,
    args: [id],
  });
  if (result.rows.length === 0) throw new Error("Category not found");
  return rowToCategory(result.rows[0]);
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getStoreDb();
  await db.execute({
    sql: `UPDATE vanta_categories SET is_active = 0 WHERE id = ?`,
    args: [id],
  });
}

/**
 * Active categories, optionally scoped to one game. Callers browsing CPM2
 * should pass 'cpm2' so CPM1's tree (Flags/Security/Police/...) never shows
 * up as six empty shelves.
 */
export async function listCategories(game?: ProductGame): Promise<Category[]> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_categories
          WHERE is_active = 1 AND (? IS NULL OR game = ?)
          ORDER BY sort_order ASC, name ASC`,
    args: [game ?? null, game ?? null],
  });
  return result.rows.map(rowToCategory);
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `INSERT INTO vanta_products (category_id, kind, game, cpm2_car_code, name, description, base_price_cents, discount_percent, currency, stock_quantity, initial_stock, availability_state, exclusivity, is_featured, is_new, is_sale, is_published, air_suspension, unlocked_bodykits, created_at, updated_at, spec_hp, spec_top_speed, spec_zero_hundred, spec_drive)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.categoryId ?? null,
      input.kind ?? "car",
      input.game ?? "cpm2",
      input.cpm2CarCode ?? null,
      input.name.trim(),
      input.description ?? "",
      input.basePriceCents ?? 0,
      input.discountPercent ?? 0,
      input.currency ?? "ZAR",
      input.stockQuantity ?? 0,
      // Baseline = the stock first put on the card (ratio color tiers)
      input.stockInitial ?? input.stockQuantity ?? 0,
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
  return rowToProduct({ id, category_id: input.categoryId ?? null, cpm2_car_code: input.cpm2CarCode ?? null, kind: input.kind ?? "car", game: input.game ?? "cpm2", name: input.name.trim(), description: input.description ?? "", base_price_cents: input.basePriceCents ?? 0, image_url: null, discount_percent: input.discountPercent ?? 0, currency: input.currency ?? "ZAR", stock_quantity: input.stockQuantity ?? 0, initial_stock: input.stockInitial ?? input.stockQuantity ?? 0, availability_state: input.availabilityState ?? "available", exclusivity: input.exclusivity ?? "standard", is_featured: input.isFeatured ? 1 : 0, is_new: input.isNew ? 1 : 0, is_sale: input.isSale ? 1 : 0, is_published: input.isPublished ? 1 : 0, air_suspension: input.airSuspension ? 1 : 0, unlocked_bodykits: input.unlockedBodykits ? 1 : 0, version: 1, spec_hp: input.specHp ?? null, spec_top_speed: input.specTopSpeed ?? null, spec_zero_hundred: input.specZeroHundred ?? null, spec_drive: input.specDrive ?? null, created_at: now, updated_at: now });
}

export async function getProduct(id: number): Promise<Product | null> {
  // Expire "New" tags on products older than 3 days.
  await expireOldNewTags();
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_products WHERE id = ?`,
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return rowToProduct(result.rows[0]);
}

/**
 * Enrich products with their cover + gallery in ONE round-trip, exactly like
 * the /api/store/products route does. SSR pages that call listProducts()
 * directly previously got NO coverUrl at all — every card fell back to the
 * "photo pending" glyph even when the product had uploaded art.
 */
/** Absolute-ise a stored media reference for the public payload. Same rules
 *  the /api/store/products route has always applied: absolute http(s) URLs
 *  pass through, data URLs are NOT proxied (they would 404 on the CDN), and
 *  a bare path is prefixed with the site origin — with no origin configured a
 *  relative path is handed back as-is for the browser to resolve. */
export function absoluteImageUrl(raw: string, origin: string): string | null {
  if (!raw) return null;
  if (raw.startsWith("https://") || raw.startsWith("http://")) return raw;
  if (raw.startsWith("data:")) return null;
  if (!raw.startsWith("/")) return null;
  return origin ? `${origin}${raw}` : raw;
}

export async function enrichProductsWithCovers<
  T extends {
    id: number;
    imageUrl?: string | null;
    basePriceCents?: number;
    discountPercent?: number;
    game?: string;
  },
>(
  products: T[],
  origin?: string,
): Promise<
  (T & {
    coverUrl?: string | null;
    galleryUrls?: string[];
    promo?: {
      id: number;
      discountPercent: number;
      backgroundColor: string;
      accentColor: string;
      pillColor: string;
      title: string;
    } | null;
    promoPriceCents?: number | null;
  })[]
> {
  if (products.length === 0) return [];
  const base = origin ?? process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  // Covers, galleries AND the live product promotions in the same round-trip
  // budget — SSR pages (the listing cards) need the promo price + pill exactly
  // like the API payload gives the browser.
  const [covers, galleries, cpm1Promos, cpm2Promos] = await Promise.all([
    listCoverImageMap(products.map((p) => p.id)),
    listGalleryMap(products.map((p) => p.id)),
    productPromotionMap("cpm1"),
    productPromotionMap("cpm2"),
  ]);
  const promoFor = (p: { id: number; game?: string }) => {
    const map = (p.game ?? "cpm2") === "cpm1" ? cpm1Promos : cpm2Promos;
    const promo = map.get(p.id);
    if (!promo) return null;
    return {
      id: promo.id,
      discountPercent: promo.discountPercent,
      backgroundColor: promo.backgroundColor,
      accentColor: promo.accentColor,
      pillColor: promo.pillColor,
      title: promo.title,
    };
  };
  return products.map((p) => {
    const coverRaw = covers.get(p.id) ?? p.imageUrl ?? "";
    const coverUrl = coverRaw ? absoluteImageUrl(coverRaw, base) : null;
    const gallery = (galleries.get(p.id) ?? [])
      .map((u) => absoluteImageUrl(u, base))
      .filter((u): u is string => u !== null);
    const promo = promoFor(p);
    const basePrice = p.basePriceCents ?? 0;
    const discount = p.discountPercent ?? 0;
    const finalPrice =
      discount > 0 ? Math.round((basePrice * (100 - discount)) / 100) : basePrice;
    const promoPrice =
      promo && promo.discountPercent > 0
        ? Math.round((finalPrice * (100 - promo.discountPercent)) / 100)
        : null;
    return {
      ...p,
      coverUrl,
      galleryUrls: gallery.length > 0 ? gallery : coverUrl ? [coverUrl] : [],
      promo,
      promoPriceCents: promoPrice,
    };
  });
}

export async function listProducts({ onlyPublished = true, featuredOnly = false, game }: { onlyPublished?: boolean; featuredOnly?: boolean; game?: ProductGame } = {}): Promise<Product[]> {
  // Expire "New" tags on products older than 3 days (auto-tag: new products
  // get the tag at creation, it is removed automatically after 3 days).
  await expireOldNewTags();
  const db = await getStoreDb();
  let sql = `SELECT * FROM vanta_products WHERE 1=1`;
  const args: unknown[] = [];
  if (game) {
    // Scope the storefront to one catalogue — CPM1's shelves (flags/mods/...)
    // must never appear in the CPM2 garage browse, and vice versa.
    sql += ` AND game = ?`;
    args.push(game);
  }
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

/**
 * Store statistics for the product page footer — real counts, no vanity:
 * verified orders sold, active listings, total units on shelves.
 */
export async function getStoreStats(): Promise<{
  soldCount: number;
  activeListings: number;
  totalStock: number;
}> {
  const db = await getStoreDb();
  const [sold, listed, stock] = await Promise.all([
    db.execute({
      sql: `SELECT COUNT(*) AS n FROM vanta_orders WHERE payment_state = 'verified'`,
      args: [],
    }),
    db.execute({
      sql: `SELECT COUNT(*) AS n FROM vanta_products WHERE is_published = 1`,
      args: [],
    }),
    db.execute({
      sql: `SELECT COALESCE(SUM(stock_quantity), 0) AS n FROM vanta_products WHERE is_published = 1`,
      args: [],
    }),
  ]);
  return {
    soldCount: Number(sold.rows[0]?.n ?? 0),
    activeListings: Number(listed.rows[0]?.n ?? 0),
    totalStock: Number(stock.rows[0]?.n ?? 0),
  };
}

/** Remove the "New" tag from products created more than 3 days ago. */
async function expireOldNewTags(): Promise<void> {
  const db = await getStoreDb();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  await db.execute({
    sql: `UPDATE vanta_products SET is_new = 0 WHERE is_new = 1 AND created_at < ?`,
    args: [threeDaysAgo],
  });
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

/**
 * Catalogue stock is a projection of the inventory ledger. Admins set the
 * catalogue number, but writing only vanta_products left the purchasable pool
 * unchanged (and a later settlement silently overwrote the card stock again).
 * Apply the edit to inventory too, never below reserved units.
 */
async function syncInventoryStock(productId: number, stockQuantity: number): Promise<void> {
  const db = await getStoreDb();
  const existing = await getInventory(productId);
  if (!existing) {
    await createInventory(productId, stockQuantity);
    return;
  }
  await db.execute({
    sql: `UPDATE vanta_inventory
          SET stock_quantity = MAX(?, reserved_quantity), version = version + 1, updated_at = ?
          WHERE product_id = ?`,
    args: [stockQuantity, new Date().toISOString(), productId],
  });
}

export async function updateProductStock(productId: number, stockQuantity: number): Promise<void> {
  const db = await getStoreDb();
  await db.execute({
    sql: `UPDATE vanta_products SET stock_quantity = ?, updated_at = ? WHERE id = ?`,
    args: [stockQuantity, new Date().toISOString(), productId],
  });
  await syncInventoryStock(productId, stockQuantity);
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
    // Without these, a product's game/kind was frozen at creation: an item seeded
    // as the wrong game could never be corrected without a direct DB write.
    if (input.kind !== undefined) set("kind", input.kind);
    if (input.game !== undefined) set("game", input.game);
    if (input.cpm2CarCode !== undefined) set("cpm2_car_code", input.cpm2CarCode);
  if (input.name !== undefined) set("name", input.name.trim());
  if (input.description !== undefined) set("description", input.description);
  if (input.basePriceCents !== undefined) set("base_price_cents", input.basePriceCents);
  if (input.currency !== undefined) set("currency", input.currency);
  if (input.stockQuantity !== undefined) {
    set("stock_quantity", input.stockQuantity);
    // Restock raises the ratio baseline; sales/decrements never lower it.
    // MAX() in SQL means: baseline only grows when stock exceeds it.
    fields.push(`initial_stock = MAX(initial_stock, ?)`);
    args.push(input.stockQuantity);
  }
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
  if (input.stockQuantity !== undefined) {
    await syncInventoryStock(productId, input.stockQuantity);
  }
  return getProduct(productId);
}

/** How many orders reference this product. Orders snapshot the product name
 *  at purchase time, but their product_id column is NOT NULL with no cascade —
 *  it is the one hard link that makes permanent deletion unsafe. */
export async function countProductOrders(productId: number): Promise<number> {
  const db = await getStoreDb();
  const { rows } = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM vanta_orders WHERE product_id = ?`,
    args: [productId],
  });
  return Number(rows[0]?.n ?? 0);
}

export type PermanentDeleteResult =
  | { deleted: true }
  | { deleted: false; reason: "has_orders"; orderCount: number }
  | { deleted: false; reason: "not_found" };

/**
 * Permanently remove a product. Refused when any order references it —
 * order history (payments, EFT review, delivery) must outlive the catalogue,
 * so ordered products can only ever be hidden. Child rows are cleared
 * explicitly (not just via FK cascades, which depend on the connection's
 * foreign_keys pragma): media, inventory, pricing, wishlist and cart rows
 * go with the product; promotions and account units keep their rows with
 * the product link nulled, matching their ON DELETE SET NULL schema.
 */
export async function deleteProductPermanently(productId: number): Promise<PermanentDeleteResult> {
  const product = await getProduct(productId);
  if (!product) return { deleted: false, reason: "not_found" };

  const orderCount = await countProductOrders(productId);
  if (orderCount > 0) return { deleted: false, reason: "has_orders", orderCount };

  const db = await getStoreDb();
  const clear: Array<{ sql: string; args: unknown[] }> = [
    { sql: `DELETE FROM vanta_product_media WHERE product_id = ?`, args: [productId] },
    { sql: `DELETE FROM vanta_inventory WHERE product_id = ?`, args: [productId] },
    { sql: `DELETE FROM vanta_pricing WHERE product_id = ?`, args: [productId] },
    { sql: `DELETE FROM vanta_wishlist WHERE product_id = ?`, args: [productId] },
    { sql: `DELETE FROM vanta_cart_items WHERE product_id = ?`, args: [productId] },
    { sql: `UPDATE vanta_promotions SET product_id = NULL WHERE product_id = ?`, args: [productId] },
    { sql: `UPDATE vanta_account_units SET product_id = NULL WHERE product_id = ?`, args: [productId] },
    { sql: `UPDATE vanta_notifications SET related_product_id = NULL WHERE related_product_id = ?`, args: [productId] },
    { sql: `DELETE FROM vanta_products WHERE id = ?`, args: [productId] },
  ];
  for (const stmt of clear) {
    await db.execute(stmt);
  }
  return { deleted: true };
}

export async function createInventory(productId: number, stockQuantity: number): Promise<Inventory> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  // Another checkout may have seeded this product between our read and this
  // insert. The unique index on product_id makes that a no-op instead of a
  // second row that splits the stock pool.
  await db.execute({
    sql: `INSERT INTO vanta_inventory (product_id, stock_quantity, reserved_quantity, version, updated_at)
          SELECT ?, ?, 0, 1, ?
          WHERE NOT EXISTS (SELECT 1 FROM vanta_inventory WHERE product_id = ?)`,
    args: [productId, stockQuantity, now, productId],
  });
  const inventory = await getInventory(productId);
  if (!inventory) throw new Error("Inventory insert returned no row");
  return inventory;
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

export async function releaseStock(productId: number, quantity: number): Promise<boolean> {
  /**
   * Return a reservation to the pool. The `reserved_quantity >= ?` guard is
   * load-bearing: without it, MAX(0, ...) silently clamps a release that was
   * never owed and the caller believes stock came back when it did not.
   * `reserved_quantity` is one shared aggregate for the whole product, so a
   * release this guard refuses is a release that would have taken another
   * order's units. Returns false when there was nothing that large reserved.
   */
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `UPDATE vanta_inventory
          SET reserved_quantity = reserved_quantity - ?, version = version + 1, updated_at = ?
          WHERE product_id = ? AND reserved_quantity >= ?`,
    args: [quantity, new Date().toISOString(), productId, quantity],
  });
  return (result.affectedRowCount ?? 0) > 0;
}

export async function confirmStockDeduction(productId: number, quantity: number): Promise<boolean> {
  /**
   * Called after payment confirmed: move reserved stock out of available pool permanently.
   *
   * Both sides of the subtraction are guarded so a double-deduction cannot
   * oversell: reserved_quantity must actually hold that much, and stock_quantity
   * must too. Returns false when the guard refused (nothing was deducted).
   */
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `UPDATE vanta_inventory
          SET stock_quantity = stock_quantity - ?, reserved_quantity = reserved_quantity - ?, version = version + 1, updated_at = ?
          WHERE product_id = ? AND reserved_quantity >= ? AND stock_quantity >= ?`,
    args: [quantity, quantity, new Date().toISOString(), productId, quantity, quantity],
  });
  return (result.affectedRowCount ?? 0) > 0;
}

export async function listMedia(productId: number): Promise<ProductMedia[]> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_product_media WHERE product_id = ? AND is_published = 1 ORDER BY sort_order ASC, uploaded_at ASC`,
    args: [productId],
  });
  return result.rows.map(rowToMedia);
}

/** Cover URLs for many products in ONE round-trip (first media per product).
 *  Replaces per-product listMedia() calls in SSR paths — each Turso query is
 *  a ~300ms+ cloud round-trip, so N parallel calls still cost connection churn. */
export async function listCoverImageMap(productIds: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (productIds.length === 0) return map;
  const db = await getStoreDb();
  const placeholders = productIds.map(() => "?").join(",");
  const result = await db.execute({
    sql: `SELECT product_id, public_url FROM vanta_product_media
          WHERE product_id IN (${placeholders}) AND is_published = 1
          ORDER BY sort_order ASC, uploaded_at ASC`,
    args: productIds,
  });
  for (const row of result.rows) {
    const pid = Number(row.product_id);
    if (!map.has(pid)) map.set(pid, String(row.public_url ?? ""));
  }
  return map;
}

/** Full ordered galleries for many products in ONE round-trip — the bot-facing
 *  catalogue payload needs every image per car, not just the cover. */
export async function listGalleryMap(productIds: number[]): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  if (productIds.length === 0) return map;
  const db = await getStoreDb();
  const placeholders = productIds.map(() => "?").join(",");
  const result = await db.execute({
    sql: `SELECT product_id, public_url FROM vanta_product_media
          WHERE product_id IN (${placeholders}) AND is_published = 1
          ORDER BY product_id ASC, sort_order ASC, uploaded_at ASC`,
    args: productIds,
  });
  for (const row of result.rows) {
    const pid = Number(row.product_id);
    const url = String(row.public_url ?? "");
    if (!url) continue;
    const list = map.get(pid);
    if (list) list.push(url);
    else map.set(pid, [url]);
  }
  return map;
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
    game: row.game === null || row.game === undefined || row.game === "" ? null : (String(row.game) as "cpm1" | "cpm2"),
    productId: row.product_id === null || row.product_id === undefined ? null : Number(row.product_id),
    pillColor: String(row.pill_color ?? "#d4af4f"),
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
    sql: `INSERT INTO vanta_promotions (title, subtitle, description, discount_percent, discount_code, cta_text, cta_link, background_color, accent_color, image_url, is_active, start_date, end_date, sort_order, game, product_id, pill_color, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      input.game ?? null,
      input.productId ?? null,
      input.pillColor ?? "#d4af4f",
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
  if (input.game !== undefined) set("game", input.game);
  if (input.productId !== undefined) set("product_id", input.productId);
  if (input.pillColor !== undefined) set("pill_color", input.pillColor);
  if (fields.length === 0) return getPromotion(promotionId);
  set("updated_at", new Date().toISOString());
  args.push(promotionId);
  await db.execute({
    sql: `UPDATE vanta_promotions SET ${fields.join(", ")} WHERE id = ?`,
    args,
  });
  return getPromotion(promotionId);
}

/**
 * The ACTIVE product-attached promotions for a game — the data the storefront
 * cards read to apply a promotion's price override, card colours and pill.
 * A promotion is live when is_active AND (no start OR started) AND (no end OR
 * not ended). Banner-style promotions (no product attached) are excluded.
 */
export async function listActiveProductPromotions(
  game: "cpm1" | "cpm2",
): Promise<Promotion[]> {
  const db = await getStoreDb();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `SELECT * FROM vanta_promotions
           WHERE is_active = 1
             AND product_id IS NOT NULL
             AND (game IS NULL OR game = ?)
             AND (start_date IS NULL OR start_date <= ?)
             AND (end_date IS NULL OR end_date >= ?)
           ORDER BY sort_order DESC, id DESC`,
    args: [game, now, now],
  });
  return result.rows.map(rowToPromotion);
}

/** Map productId -> its live promotion (first wins per product). */
export async function productPromotionMap(
  game: "cpm1" | "cpm2",
): Promise<Map<number, Promotion>> {
  const promos = await listActiveProductPromotions(game);
  const map = new Map<number, Promotion>();
  for (const promo of promos) {
    if (promo.productId !== null && !map.has(promo.productId)) {
      map.set(promo.productId, promo);
    }
  }
  return map;
}

export async function deletePromotion(promotionId: number): Promise<boolean> {
  const db = await getStoreDb();
  const result = await db.execute({
    sql: `DELETE FROM vanta_promotions WHERE id = ?`,
    args: [promotionId],
  });
  return (result.affectedRowCount ?? 0) > 0;
}
