/**
 * VANTA GARAGE — admin account-units API.
 *
 * GET    /api/store/admin/accounts?productId=123   counts + unit list (masked)
 * POST   /api/store/admin/accounts                 bulk .txt import (as PENDING)
 * PATCH  /api/store/admin/accounts                 { action: 'assign', unitIds, productId }
 *                                                       { action: 'syncStock', productId }
 *
 * Credentials are NEVER returned by this route. `email` and `password` are
 * encrypted envelopes; the UI shows a masked form so an admin can identify a
 * unit without the plaintext being readable from the page or a cached response.
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import {
  assignUnitsToProduct,
  countUnitsByStatus,
  importAccountUnits,
  listUnitsForAdmin,
  syncProductStock,
} from "@/lib/store/accounts";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireStoreAdmin(request);
    const productIdRaw = new URL(request.url).searchParams.get("productId");
    const productId = productIdRaw ? Number(productIdRaw) : null;
    const counts = await countUnitsByStatus(productId);

    // Masking lives in the service so no route accidentally ships the envelope.
    const rows = await listUnitsForAdmin(productId, 200);

    return ok({
      counts,
      units: rows,
    });
  } catch (err) {
    return fail(err);
  }
}

const importSchema = z.object({
  productId: z.number().int().nullable().optional(),
  game: z.enum(["cpm1", "cpm2"]).default("cpm2"),
  block: z.string().min(1),
});

const assignSchema = z.object({
  action: z.enum(["assign", "syncStock"]),
  productId: z.number().int(),
  unitIds: z.array(z.number().int()).min(1).optional(),
});

export async function POST(request: Request) {
  try {
    await requireStoreAdmin(request);
    const body = importSchema.parse(await readJson(request));
    const result = await importAccountUnits({ ...body, productId: body.productId ?? null });
        await syncProductStock(body.productId ?? 0);
        // `duplicates` is carried through: dropping it here made a re-import report
        // 0/0 and look like nothing happened, when the truth is "already had these".
        return ok(
          {
            imported: result.inserted,
            duplicates: result.duplicates,
            skipped: result.skipped,
            rejected: result.rejected,
          },
          201,
        );
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireStoreAdmin(request);
    const body = assignSchema.parse(await readJson(request));

    if (body.action === "syncStock") {
      await syncProductStock(body.productId);
      const counts = await countUnitsByStatus(body.productId);
      return ok({ counts });
    }

    if (!body.unitIds?.length) {
      return fail({ status: 400, body: { error: "unitIds is required for action 'assign'" } });
    }
    const assigned = await assignUnitsToProduct(body.unitIds, body.productId);
    const counts = await countUnitsByStatus(body.productId);
    return ok({ assigned, counts });
  } catch (err) {
    return fail(err);
  }
}