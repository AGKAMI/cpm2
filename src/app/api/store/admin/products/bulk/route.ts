/**
 * VANTA GARAGE — admin bulk product upload.
 * POST /api/store/admin/products/bulk — bulk create products.
 * Admin-gated via requireStoreAdmin.
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { createProduct } from "@/lib/store/products";
import type { ProductInput } from "@/lib/store-types";
import { z } from "zod";

const bulkProductSchema = z.array(
  z.object({
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
    cpm2CarCode: z.coerce.number().int().nonnegative().optional(),
  })
);

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireStoreAdmin(request);

    const products = bulkProductSchema.parse(await readJson(request));
    const results: Array<{ id?: number; error?: string }> = [];

    for (const input of products) {
      try {
        const productInput: ProductInput = {
          cpm2CarCode: input.cpm2CarCode,
          name: input.name,
          description: input.description ?? "",
          basePriceCents: input.basePriceCents,
          currency: input.currency,
          stockQuantity: input.stockQuantity,
          availabilityState: input.availabilityState,
          exclusivity: input.exclusivity,
          isFeatured: input.isFeatured,
          isNew: input.isNew,
          isSale: input.isSale,
          isPublished: input.isPublished,
        };
        const product = await createProduct(productInput);
        const pid = product.id;
        if (pid !== null) {
          results.push({ id: pid });
        } else {
          results.push({ error: "Product insert returned no id" });
        }
      } catch (err) {
        results.push({ error: err instanceof Error ? err.message : String(err) });
      }
    }

    return ok({ results, count: results.length, created: results.filter((r) => r.id !== undefined).length });
  } catch (err) {
    return fail(err);
  }
}
