/**
 * VANTA GARAGE — admin product routes.
 * POST /api/store/admin/products — create a product
 * PUT /api/store/admin/products/[id] — update a product
 * DELETE /api/store/admin/products/[id] — delete a product
 * Admin-gated via requireStoreAdmin (Telegram owner id only).
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { carByCode } from "@/lib/car-catalog";
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
  imageUrl: z.string().url().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  basePriceCents: z.coerce.number().int().nonnegative(),
  currency: z.string().default("ZAR"),
  stockQuantity: z.coerce.number().int().nonnegative().default(0),
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
function invalidCarCode(cpm2CarCode: number | undefined) {
  if (cpm2CarCode === undefined) return null;
  if (!carByCode(cpm2CarCode, "cpm2")) {
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

export async function POST(request: Request) {
  try {
    await requireStoreAdmin(request);
    const body = productSchema.parse(await readJson(request));
    const badCode = invalidCarCode(body.cpm2CarCode);
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
      await createMedia({
        productId: product.id,
        publicUrl: body.imageUrl,
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
    const badCode = invalidCarCode(body.cpm2CarCode);
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
    // Soft-unpublish instead of hard delete — protects order history references
    // (full delete service to be added in Phase 6)
    return fail({ status: 501, body: { error: { code: "not_implemented", message: "Use unpublish via PUT isPublished=false" } } });
  } catch (err) {
    return fail(err);
  }
}
