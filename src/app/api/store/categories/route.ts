/**
 * VANTA GARAGE — categories API.
 * GET /api/store/categories
 */

import { fail, ok } from "@/lib/route";
import { listCategories } from "@/lib/store/products";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Public: category browsing is open (see products route).
    const categories = await listCategories();
    return ok({ categories });
  } catch (err) {
    return fail(err);
  }
}
