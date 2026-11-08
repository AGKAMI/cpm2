/**
 * VANTA GARAGE — admin categories API.
 * POST /api/store/admin/categories — create a category
 * Admin-gated via requireStoreAdmin (Telegram owner id only).
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { createCategory } from "@/lib/store/products";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.coerce.number().int().nonnegative().default(0),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireStoreAdmin(request);
    const body = categorySchema.parse(await readJson(request));
    const category = await createCategory(body);
    return ok({ category }, 201);
  } catch (err) {
    return fail(err);
  }
}