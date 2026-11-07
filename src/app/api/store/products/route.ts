/**
 * VANTA GARAGE — product catalogue API.
 * GET /api/store/products?q=...&featured=1
 */

import { fail, ok, readJson } from "@/lib/route";
import { ApiError } from "@/lib/api";
import {
  searchProducts,
  listProducts,
  listCategories,
  createProduct,
} from "@/lib/store/products";
import type { ProductInput } from "@/lib/store-types";
import { requireStoreCustomer } from "@/lib/store/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireStoreCustomer(request);
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const featured = url.searchParams.get("featured") === "1";

    const products = featured
      ? await listProducts({ onlyPublished: true, featuredOnly: true })
      : q
      ? await searchProducts(q)
      : await listProducts({ onlyPublished: true });

    return ok({ products, total: products.length });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireStoreCustomer(request);
    const body = (await readJson(request)) as ProductInput;
    const product = await createProduct(body);
    return ok({ product }, 201);
  } catch (err) {
    return fail(err);
  }
}
