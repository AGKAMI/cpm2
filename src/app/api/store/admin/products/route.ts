/**
 * VANTA GARAGE — admin product routes.
 * POST /api/store/admin/products — create a product
 * PUT /api/store/admin/products/[id] — update a product
 * DELETE /api/store/admin/products/[id] — delete a product
 * Admin-gated via requireStoreAdmin (Telegram owner id only).
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
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
  isPublished: z.boolean().default(false),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireStoreAdmin(request);
    const body = productSchema.parse(await readJson(request));
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
      isPublished: body.isPublished,
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
    const body = productSchema.parse(await readJson(request));
    const product = await getProduct(Number(id));
    if (!product) {
      return fail({ status: 404, body: { error: { code: "not_found", message: "Product not found." } } });
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
      isPublished: body.isPublished,
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
