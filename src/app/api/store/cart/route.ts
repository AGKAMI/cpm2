/**
 * VANTA GARAGE — customer cart API.
 * GET    /api/store/cart                — cart contents + totals
 * POST   /api/store/cart                — add { productId, quantity? }
 * PATCH  /api/store/cart                — set quantity { productId, quantity } (0 removes)
 * DELETE /api/store/cart?productId=     — remove one item
 * Customer-gated via requireStoreCustomer.
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreCustomer } from "@/lib/store/auth";
import {
  getCart,
  addToCart,
  updateCartQuantity,
  removeFromCart,
} from "@/lib/store/cart";
import { z } from "zod";

export const dynamic = "force-dynamic";

const addSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).max(5).default(1),
});

const patchSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(0).max(5),
});

export async function GET(request: Request) {
  try {
    const customer = await requireStoreCustomer(request);
    return ok(await getCart(customer.customer.id));
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    const customer = await requireStoreCustomer(request);
    const body = addSchema.parse(await readJson(request));
    const cart = await addToCart(customer.customer.id, body.productId, body.quantity);
    return ok({ cart, added: true });
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const customer = await requireStoreCustomer(request);
    const body = patchSchema.parse(await readJson(request));
    const cart = await updateCartQuantity(customer.customer.id, body.productId, body.quantity);
    return ok({ cart, updated: true });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const customer = await requireStoreCustomer(request);
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");
    if (!productId) {
      return fail({ status: 400, body: { error: { code: "missing_product_id", message: "productId required." } } });
    }
    const cart = await removeFromCart(customer.customer.id, Number(productId));
    return ok({ cart, removed: true });
  } catch (err) {
    return fail(err);
  }
}
