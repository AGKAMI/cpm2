/**
 * VANTA GARAGE — admin product routes.
 * POST /api/store/admin/products — create a product
 * PUT /api/store/admin/products/[id] — update a product
 * DELETE /api/store/admin/products/[id] — delete a product
 * Admin-gated via requireStoreAdmin (Telegram owner id only).
 */

import { fail, ok, readJson } from "@/lib/route";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { requireStoreAdmin } from "@/lib/store/auth";
import { getStoreDb } from "@/lib/store-db";
import {
  createProduct,
  createMedia,
  getProduct,
  updateProduct,
} from "@/lib/store/products";
import type { ProductInput } from "@/lib/store-types";
import { z } from "zod";

const productSchema = z.object({
  cpm2CarCode: z.coerce.number().int().nonnegative().optional(),
  imageUrl: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  basePriceCents: z.coerce.number().int().nonnegative(),
  currency: z.string().default("ZAR"),
  stockQuantity: z.coerce.number().int().nonnegative().default(1),
  availabilityState: z
    .enum(["available", "limited", "sold_out", "unavailable"])
    .default("available"),
  exclusivity: z.enum(["standard", "limited_edition", "one_of_one"]).default("standard"),
  isFeatured: z.boolean().default(false),
  isNew: z.boolean().default(false),
  isSale: z.boolean().default(false),
  isPublished: z.boolean().default(false),
  airSuspension: z.boolean().default(false),   // Air suspension installation included
  unlockedBodykits: z.boolean().default(false), // Design unlocks bodykits
});

export const dynamic = "force-dynamic";

/**
 * Car codes must resolve to a real CPM2 catalog car — a bogus code would
 * silently create a product linked to no car. Returns a fail response or null.
 * Only enforced when the field is present (PUT partial updates keep the old code).
 */
async function invalidCarCode(cpm2CarCode: number | undefined) {
  if (cpm2CarCode === undefined) return null;
  const store = await getStoreDb();
  const result = await store.execute({
    sql: `SELECT code FROM vanta_cpm2_cars WHERE code = ?`,
    args: [cpm2CarCode],
  });
  if (result.rows.length === 0) {
    return fail({
      status: 400,
      body: {
        error: {
          code: "unknown_car_code",
          message: `CPM2 catalog has no car #${cpm2CarCode}.`,
        },
      },
    });
  }
  return null;
}

/**
 * Data-URL images (the client's offline fallback when the upload endpoint is
 * unreachable) are megabyte-scale base64 blobs. Persisting them as-is bloats
 * the DB and every home-page response. Decode them to real files in
 * public/uploads and store the file path instead — same treatment the upload
 * endpoint gives raw files. Non-data URLs pass through untouched.
 */
async function persistDataUrlImage(dataUrl: string): Promise<string> {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,(.+)$/.exec(dataUrl);
  if (!match) return dataUrl;
  const [, mime, base64] = match;
  const ext = mime.split("/")[1] === "jpeg" ? "jpg" : mime.split("/")[1];
  const uploadsDir = join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const filename = `${crypto.randomUUID()}.${ext}`;
  await writeFile(join(uploadsDir, filename), Buffer.from(base64, "base64"));
  return `/api/store/admin/uploads/${filename}`;
}

export async function POST(request: Request) {
  try {
    await requireStoreAdmin(request);
    const body = productSchema.parse(await readJson(request));
    const badCode = await invalidCarCode(body.cpm2CarCode);
    if (badCode) return badCode;
    const input: ProductInput = {
          cpm2CarCode: body.cpm2CarCode,
          name: body.name,
          description: body.description,
          basePriceCents: body.basePriceCents,
          currency: body.currency,
          stockQuantity: body.stockQuantity,
          availabilityState: body.availabilityState,
          exclusivity: body.exclusivity,
          isFeatured: body.isFeatured,
          isNew: body.isNew,
          isSale: body.isSale,
          isPublished: body.isPublished,
          airSuspension: body.airSuspension,
          unlockedBodykits: body.unlockedBodykits,
        };
    const product = await createProduct(input);
    if (body.imageUrl) {
      const publicUrl = await persistDataUrlImage(body.imageUrl);
      await createMedia({
        productId: product.id,
        publicUrl,
        sortOrder: 0,
      });
    }
    return ok({ product }, 201);
  } catch (err) {
    return fail(err);
  }
}

export async function PUT(request: Request) {
  try {
    await requireStoreAdmin(request);
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return fail({ status: 400, body: { error: { code: "missing_id", message: "Product id required." } } });
    }
    // Allow partial updates (e.g. publish toggle only sends isPublished)
    const body = productSchema.partial().parse(await readJson(request));
    const badCode = await invalidCarCode(body.cpm2CarCode);
    if (badCode) return badCode;
    const product = await getProduct(Number(id));
    if (!product) {
      return fail({ status: 404, body: { error: { code: "not_found", message: "Product not found." } } });
    }
    // Car codes are set-once: a product that already has one can never have it
    // changed (order history and garage linkage depend on the identity). A
    // product with no code may be linked exactly once, then it locks.
    if (
      body.cpm2CarCode !== undefined &&
      product.cpm2CarCode !== null &&
      body.cpm2CarCode !== product.cpm2CarCode
    ) {
      return fail({
        status: 400,
        body: {
          error: {
            code: "immutable_car_code",
            message: `Product ${product.id} is linked to CPM2 car #${product.cpm2CarCode} - car codes cannot be changed. Recreate the product instead.`,
          },
        },
      });
    }
    const updated = await updateProduct(Number(id), {
          cpm2CarCode: body.cpm2CarCode,
          name: body.name,
          description: body.description,
          basePriceCents: body.basePriceCents,
          currency: body.currency,
          stockQuantity: body.stockQuantity,
          availabilityState: body.availabilityState,
          exclusivity: body.exclusivity,
          isFeatured: body.isFeatured,
          isNew: body.isNew,
          isSale: body.isSale,
          isPublished: body.isPublished,
          airSuspension: body.airSuspension,
          unlockedBodykits: body.unlockedBodykits,
        });
    if (!updated) {
      return fail({ status: 404, body: { error: { code: "not_found", message: "Product not found." } } });
    }
    return ok({ product: updated });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireStoreAdmin(request);
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return fail({ status: 400, body: { error: { code: "missing_id", message: "Product id required." } } });
    }
    // Check product exists
    const product = await getProduct(Number(id));
    if (!product) {
      return fail({ status: 404, body: { error: { code: "not_found", message: "Product not found." } } });
    }
    // Soft delete: unpublish and mark as deleted (protects order history references)
    // In future, we can add a deletedAt column for true soft delete
    const updated = await updateProduct(Number(id), {
      isPublished: false,
      availabilityState: "unavailable",
      stockQuantity: 0,
    });
    if (!updated) {
      return fail({ status: 404, body: { error: { code: "not_found", message: "Product not found." } } });
    }
    return ok({ deleted: true, product: updated });
  } catch (err) {
    return fail(err);
  }
}
