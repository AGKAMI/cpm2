/**
 * VANTA GARAGE — public promotions API.
 * GET /api/store/promotions — list active promotions
 */

import { fail, ok } from "@/lib/route";
import { listPromotions } from "@/lib/store/products";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const promotions = await listPromotions({ onlyActive: true });
    return ok({ promotions });
  } catch (err) {
    return fail(err);
  }
}