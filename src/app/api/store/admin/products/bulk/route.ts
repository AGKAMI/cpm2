/**
 * VANTA GARAGE — admin bulk product upload.
 * POST /api/store/admin/products/bulk — bulk create products.
 * Admin-gated via requireStoreAdmin.
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { createProduct } from "@/lib/store/products";
import { csvToRecords } from "@/lib/csv";
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
    isSale: z.boolean().default(false),
    isPublished: z.boolean().default(false),
    cpm2CarCode: z.coerce.number().int().nonnegative().optional(),
  })
);

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireStoreAdmin(request);

    // Two body shapes: a JSON array (programmatic callers) or the CSV the
    // admin bulk page actually uploads (multipart `file` field). readJson
    // rejected the multipart body, so the page's import always failed.
    let payload: unknown;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return fail({ status: 400, body: { error: { code: "missing_file", message: "Attach a CSV file." } } });
      }
      const records = csvToRecords(await file.text());
      const TRUE = new Set(["true", "1", "yes"]);
      payload = records.map((r) => ({
        name: r.name,
        description: r.description || undefined,
        basePriceCents: Number(r.basepricecents ?? 0),
        currency: r.currency || "ZAR",
        stockQuantity: Number(r.stockquantity ?? 1),
        availabilityState: r.availabilitystate || undefined,
        exclusivity: r.exclusivity || undefined,
        isFeatured: TRUE.has((r.isfeatured ?? "").toLowerCase()),
        isSale: TRUE.has((r.issale ?? "").toLowerCase()),
        isPublished: TRUE.has((r.ispublished ?? "").toLowerCase()),
        cpm2CarCode: r.cpm2carcode ? Number(r.cpm2carcode) : undefined,
      }));
    } else {
      payload = await readJson(request);
    }

    const products = bulkProductSchema.parse(payload);
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

    // `errors` is the shape the admin bulk page renders (strings, one per
    // failed row); `results` stays for programmatic callers.
    return ok({
      results,
      count: results.length,
      created: results.filter((r) => r.id !== undefined).length,
      errors: results
        .map((r, i) => (r.error ? `Row ${i + 1}: ${r.error}` : null))
        .filter((e): e is string => e !== null),
    });
  } catch (err) {
    return fail(err);
  }
}
