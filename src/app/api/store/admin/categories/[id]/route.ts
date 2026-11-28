/**
 * VANTA GARAGE — admin category detail API.
 * PUT    /api/store/admin/categories/[id] — update a category
 * DELETE /api/store/admin/categories/[id] — soft-delete a category
 * Admin-gated via requireStoreAdmin (Telegram owner id only).
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { deleteCategory, updateCategory } from "@/lib/store/products";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
  imageUrl: z.string().optional(),
  // Game scoping must be editable, not just set at creation: a category
  // created in the wrong catalogue needs to move without deleting/recreating.
  game: z.enum(["cpm1", "cpm2"]).optional(),
});

export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireStoreAdmin(request);
    const id = Number((await params).id);
    const body = categorySchema.parse(await readJson(request));
    const category = await updateCategory(id, body);
    return ok({ category });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireStoreAdmin(request);
    const id = Number((await params).id);
    await deleteCategory(id);
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
