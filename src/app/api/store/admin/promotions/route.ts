/**
 * VANTA GARAGE — admin promotions API.
 * GET    /api/store/admin/promotions      — list all promotions (admin only)
 * POST   /api/store/admin/promotions      — create a promotion (admin only)
 * PUT    /api/store/admin/promotions?id=X — update a promotion (admin only)
 * DELETE /api/store/admin/promotions?id=X — delete a promotion (admin only)
 * Admin-gated via requireStoreAdmin (Telegram owner id or admin row).
 */

import { fail, ok, readJson } from "@/lib/route";
import { parseProvidedFields } from "@/lib/parse-patch.ts";
import { requireStoreAdmin } from "@/lib/store/auth";
import {
  getProduct,
  getPromotion,
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
} from "@/lib/store/products";
import type { PromotionInput } from "@/lib/store-types";
import { z } from "zod";

const promotionSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  discountPercent: z.coerce.number().int().nonnegative().default(0),
  discountCode: z.string().optional(),
  ctaText: z.string().default("Shop now"),
  ctaLink: z.string().default("/store/categories"),
  backgroundColor: z.string().default("var(--color-paper-raised)"),
  accentColor: z.string().default("#d4af4f"),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortOrder: z.coerce.number().int().default(0),
  // Which catalogue the promotion belongs to; null = both games.
  game: z.enum(["cpm1", "cpm2"]).nullable().optional().transform((v) => v ?? null),
  // Attach an existing product: the promotion overrides its displayed price
  // and card styling, and the product carries the Promoted pill.
  productId: z.coerce.number().int().positive().nullable().optional().transform((v) => v ?? null),
  // Hue of the Promoted pill (the metallic material + shine are fixed).
  pillColor: z.string().min(1).default("#d4af4f"),
});

/**
 * A product promotion must point at a real product in its own game. The UI
 * filters the picker, but API writes also come from bots/scripts — without
 * this check a CPM2 product could be promoted into the CPM1 catalogue.
 */
async function invalidAttachment(
  game: "cpm1" | "cpm2" | null | undefined,
  productId: number | null | undefined,
) {
  if (productId === null || productId === undefined) return null;
  const product = await getProduct(productId);
  if (!product) {
    return fail({
      status: 400,
      body: {
        error: { code: "unknown_product", message: `No product #${productId}.` },
      },
    });
  }
  if (game && product.game !== game) {
    return fail({
      status: 400,
      body: {
        error: {
          code: "product_game_mismatch",
          message: `Product #${productId} belongs to ${product.game}, not ${game}.`,
        },
      },
    });
  }
  return null;
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireStoreAdmin(request);
    const promotions = await listPromotions({ onlyActive: false });
    return ok({ promotions });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireStoreAdmin(request);
    const body = promotionSchema.parse(await readJson(request));
    const badAttachment = await invalidAttachment(body.game, body.productId);
    if (badAttachment) return badAttachment;
    const input: PromotionInput = {
      title: body.title,
      subtitle: body.subtitle,
      description: body.description,
      discountPercent: body.discountPercent,
      discountCode: body.discountCode,
      ctaText: body.ctaText,
      ctaLink: body.ctaLink,
      backgroundColor: body.backgroundColor,
      accentColor: body.accentColor,
      imageUrl: body.imageUrl,
      isActive: body.isActive,
      startDate: body.startDate ?? null,
      endDate: body.endDate ?? null,
      sortOrder: body.sortOrder,
      game: body.game,
      productId: body.productId,
      pillColor: body.pillColor,
    };
    const promotion = await createPromotion(input);
    return ok({ promotion }, 201);
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
      return fail({ status: 400, body: { error: { code: "missing_id", message: "Promotion id required." } } });
    }
    const body = parseProvidedFields(promotionSchema, await readJson(request));
    if (body.game !== undefined || body.productId !== undefined) {
      const existing = await getPromotion(Number(id));
      const badAttachment = await invalidAttachment(
        body.game !== undefined ? body.game : (existing?.game ?? undefined),
        body.productId !== undefined ? body.productId : (existing?.productId ?? undefined),
      );
      if (badAttachment) return badAttachment;
    }
    const updated = await updatePromotion(Number(id), body);
    if (!updated) {
      return fail({ status: 404, body: { error: { code: "not_found", message: "Promotion not found." } } });
    }
    return ok({ promotion: updated });
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
      return fail({ status: 400, body: { error: { code: "missing_id", message: "Promotion id required." } } });
    }
    const deleted = await deletePromotion(Number(id));
    if (!deleted) {
      return fail({ status: 404, body: { error: { code: "not_found", message: "Promotion not found." } } });
    }
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
