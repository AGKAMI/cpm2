/**
 * VANTA GARAGE — admin wallet adjustment.
 * POST /api/store/admin/wallet/adjust
 * { customerId, direction: "credit" | "debit", amountCents, note? }
 * The real "load balance" action: credits or debits store credit with a
 * ledger entry typed admin_credit / admin_debit.
 */

import { fail, ok, readJson } from "@/lib/route";
import { requireStoreAdmin } from "@/lib/store/auth";
import { creditWallet, debitWallet, getOrCreateWallet } from "@/lib/store/wallet";
import { getStoreDb } from "@/lib/store-db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const adjustSchema = z.object({
  customerId: z.union([z.string(), z.coerce.number().int().positive()]),
  direction: z.enum(["credit", "debit"]),
  amountCents: z.coerce.number().int().positive().max(10000000),
  note: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireStoreAdmin(request);
    const body = adjustSchema.parse(await readJson(request));
    const note = body.note?.trim() || (body.direction === "credit" ? "Admin credit" : "Admin debit");
    const reference = `admin-${admin.telegramUserId}-${Date.now()}`;

    const customer = await (await getStoreDb()).execute({
      sql: `SELECT id, in_game_name, email, player_id FROM vanta_customers WHERE id = ?`,
      args: [String(body.customerId)],
    });
    if (customer.rows.length === 0) {
      return fail({
        status: 404,
        body: { error: { code: "customer_not_found", message: "No customer with that id." } },
      });
    }

    if (body.direction === "credit") {
      const res = await creditWallet({
        customerId: body.customerId,
        amountCents: body.amountCents,
        type: "admin_credit",
        reference,
        note,
      });
      if (!res.ok) {
        return fail({
          status: 500,
          body: { error: { code: "credit_failed", message: "Could not credit the wallet." } },
        });
      }
    } else {
      const res = await debitWallet({
        customerId: body.customerId,
        amountCents: body.amountCents,
        type: "admin_debit",
        reference,
        note,
      });
      if (!res.ok) {
        return fail({
          status: 400,
          body: {
            error: {
              code: res.reason === "insufficient_funds" ? "insufficient_funds" : "debit_failed",
              message:
                res.reason === "insufficient_funds"
                  ? "The wallet balance is too low for this debit."
                  : "Could not debit the wallet.",
            },
          },
        });
      }
    }

    const wallet = await getOrCreateWallet(body.customerId);
    return ok({
      wallet: {
        customerId: String(body.customerId),
        balanceCents: wallet.balanceCents,
      },
    });
  } catch (err) {
    return fail(err);
  }
}
