import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/**
 * Admin-scoping + catalogue tests.
 *
 * These exercise the exact validators and pure helpers used by the LIVE admin
 * page (/store/admin) and the storefront category shelves. They are pure:
 * no DB, no React renderer, no Telegram session needed.
 */

const {
  validateCategoryForm,
  validateProductForm,
  validatePromotionForm,
} = await import("../src/lib/store/validation.ts");
const {
  filterAndSortCatalogue,
  productsForCategory,
  promotedProducts,
} = await import("../src/lib/store/catalogue.ts");

const validCategory = {
  name: "Sedan",
  slug: "sedan",
  description: "",
  sortOrder: "0",
};

const validProduct = {
  game: "cpm2",
  cpm2CarCode: "12",
  name: "Scirocco",
  description: "",
  basePriceCents: "60.00",
  currency: "ZAR",
  stockQuantity: "2",
  discountPercent: "0",
};

const validPromotion = {
  title: "Founders Weekend",
  subtitle: "",
  description: "",
  game: "cpm2",
  productId: "7",
  discountPercent: "25",
  discountCode: "",
  ctaText: "Shop now",
  ctaLink: "/store/cpm2/cars",
  backgroundColor: "#1c1c1f",
  accentColor: "#d4af4f",
  pillColor: "#d4af4f",
  isActive: true,
  sortOrder: "0",
};

describe("admin form validation · game identity", () => {
  it("category form requires a valid game and defaults to CPM2", () => {
    assert.equal(validateCategoryForm(validCategory).ok, true);
    const parsed = validateCategoryForm(validCategory);
    assert.ok(parsed.ok);
    assert.equal(parsed.data.game, "cpm2");

    const cpm1 = validateCategoryForm({ ...validCategory, game: "cpm1" });
    assert.ok(cpm1.ok);
    assert.equal(cpm1.data.game, "cpm1");

    const bad = validateCategoryForm({ ...validCategory, game: "gta6" });
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.ok(bad.errors.game);
  });

  it("product form carries the game into the catalogue", () => {
    const parsed = validateProductForm({ ...validProduct, game: "cpm1" });
    assert.ok(parsed.ok);
    assert.equal(parsed.data.game, "cpm1");
    const bad = validateProductForm({ ...validProduct, game: "both" });
    assert.equal(bad.ok, false);
  });

  it("product form edits products with no car code and real-world prices", () => {
    // Accounts/mods/CPM1 products have no CPM2 car code ("No car code" in
    // the catalogue) — requiring one made them impossible to edit at all.
    const noCode = validateProductForm({ ...validProduct, cpm2CarCode: "" });
    assert.ok(noCode.ok);
    const cpm1 = validateProductForm({ ...validProduct, game: "cpm1", cpm2CarCode: "" });
    assert.ok(cpm1.ok);
    // Cars/accounts sell above R200; the form cap must mirror the API cap.
    const priced = validateProductForm({ ...validProduct, basePriceCents: "450.00" });
    assert.ok(priced.ok);
    const tooBig = validateProductForm({ ...validProduct, basePriceCents: "100001" });
    assert.equal(tooBig.ok, false);
    const badCode = validateProductForm({ ...validProduct, cpm2CarCode: "abc" });
    assert.equal(badCode.ok, false);
  });

  it("promotion form requires game + attached product + pill hue", () => {
    const parsed = validatePromotionForm(validPromotion);
    assert.ok(parsed.ok);
    assert.equal(parsed.data.game, "cpm2");
    assert.equal(parsed.data.productId, "7");
    assert.equal(parsed.data.pillColor, "#d4af4f");

    const noProduct = validatePromotionForm({ ...validPromotion, productId: "" });
    assert.equal(noProduct.ok, false);
    if (!noProduct.ok) assert.ok(noProduct.errors.productId);

    const badPill = validatePromotionForm({ ...validPromotion, pillColor: "shiny" });
    assert.equal(badPill.ok, false);
    if (!badPill.ok) assert.ok(badPill.errors.pillColor);

    const defaults = validatePromotionForm({ ...validPromotion, game: undefined, pillColor: undefined });
    assert.ok(defaults.ok);
    if (defaults.ok) {
      assert.equal(defaults.data.game, "cpm2");
      assert.equal(defaults.data.pillColor, "#d4af4f");
    }
  });
});

const catalogueRows = [
  { id: 1, name: "Scirocco", game: "cpm2" as const, categoryId: 10, basePriceCents: 7000, stockQuantity: 3 },
  { id: 2, name: "Myvi", game: "cpm1" as const, categoryId: 20, basePriceCents: 4000, stockQuantity: 9 },
  // Legacy rows with no game column value belong to CPM2 (DB default).
  { id: 3, name: "Legacy coupé", game: undefined, categoryId: 10, basePriceCents: 9000, stockQuantity: 1 },
  { id: 4, name: "Sedan", game: "cpm2" as const, categoryId: 11, basePriceCents: 5000, stockQuantity: 5 },
];

describe("admin catalogue · filter + sort", () => {
  it("never mixes the two games", () => {
    const cpm1 = filterAndSortCatalogue(catalogueRows, {
      game: "cpm1", search: "", categoryId: "", sort: "newest",
    });
    assert.deepEqual(cpm1.map((p) => p.id), [2]);

    const cpm2 = filterAndSortCatalogue(catalogueRows, {
      game: "cpm2", search: "", categoryId: "", sort: "newest",
    });
    assert.deepEqual(cpm2.map((p) => p.id).sort(), [1, 3, 4]);

    const all = filterAndSortCatalogue(catalogueRows, {
      game: "all", search: "", categoryId: "", sort: "newest",
    });
    assert.equal(all.length, catalogueRows.length);
  });

  it("filters by category and search, then sorts by price/stock/name", () => {
    const byCategory = filterAndSortCatalogue(catalogueRows, {
      game: "all", search: "", categoryId: "20", sort: "newest",
    });
    assert.deepEqual(byCategory.map((p) => p.id), [2]);

    const bySearch = filterAndSortCatalogue(catalogueRows, {
      game: "all", search: "#3", categoryId: "", sort: "newest",
    });
    assert.deepEqual(bySearch.map((p) => p.id), [3]);

    const byPrice = filterAndSortCatalogue(catalogueRows, {
      game: "all", search: "", categoryId: "", sort: "price_asc",
    });
    assert.deepEqual(byPrice.map((p) => p.id), [2, 4, 1, 3]);

    const byStock = filterAndSortCatalogue(catalogueRows, {
      game: "all", search: "", categoryId: "", sort: "stock_desc",
    });
    assert.deepEqual(byStock.map((p) => p.id), [2, 4, 1, 3]);

    const byName = filterAndSortCatalogue(catalogueRows, {
      game: "all", search: "", categoryId: "", sort: "name",
    });
    assert.equal(byName.length, 4);
    assert.equal(byName[0].name, "Legacy coupé");
  });
});

describe("storefront categories · game scoping", () => {
  it("a category only selects products from its own game", () => {
    const products = [
      { id: 1, categoryId: 10, game: "cpm2" as const, isPublished: true },
      { id: 2, categoryId: 10, game: "cpm1" as const, isPublished: true },
      { id: 3, categoryId: 10, game: "cpm2" as const, isPublished: false },
    ];
    assert.deepEqual(
      productsForCategory(products, { id: 10, game: "cpm1" }).map((p) => p.id),
      [2],
    );
    assert.deepEqual(
      productsForCategory(products, { id: 10, game: "cpm2" }).map((p) => p.id),
      [1],
    );
  });

  it("promotions drive the home shelf with the overridden price", () => {
    const products = [
      { id: 1, game: "cpm2" as const, basePriceCents: 10000, discountPercent: 10 },
      { id: 2, game: "cpm1" as const, basePriceCents: 20000, discountPercent: 0 },
    ];
    const promo = {
      id: 9,
      game: "cpm2" as const,
      discountPercent: 50,
      backgroundColor: "#111111",
      accentColor: "#d4af4f",
      pillColor: "#b76e79",
      title: "Half price",
    };
    const rows = promotedProducts(products, new Map([[1, promo], [2, promo]]));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].product.id, 1);
    // 10% product discount then 50% promotion = R45.00.
    assert.equal(rows[0].priceCents, 4500);
    assert.equal(rows[0].promo.pillColor, "#b76e79");
  });
});

describe("live database migration", () => {
  it("adds the product-promotion columns to an existing promotions table", async () => {
    const source = await readFile(
      new URL("../src/lib/store-db.ts", import.meta.url),
      "utf8",
    );
    for (const column of ["game", "product_id", "pill_color"]) {
      assert.match(
        source,
        new RegExp(`ALTER TABLE vanta_promotions ADD COLUMN ${column}`),
        `missing migration for vanta_promotions.${column}`,
      );
    }
  });
});
