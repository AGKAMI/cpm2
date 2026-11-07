/**
 * VANTA GARAGE — categories API.
 * GET /api/store/categories
 */

import { fail, ok } from "@/lib/route";
import { listCategories } from "@/lib/store/products";
import { requireStoreCustomer } from "@/lib/store/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireStoreCustomer(request);
    const categories = await listCategories();
    return ok({ categories });
  } catch (err) {
    return fail(err);
  }
}
