/**
 * VANTA GARAGE — wallet API.
 * GET /api/store/wallet — the caller's balance + recent ledger rows.
 */

import { fail, ok } from "@/lib/route";
import { requireStoreCustomer } from "@/lib/store/auth";
import { getOrCreateWallet, listWalletTxns } from "@/lib/store/wallet";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { customer } = await requireStoreCustomer(request);
    const [wallet, txns] = await Promise.all([
      getOrCreateWallet(customer.id),
      listWalletTxns(customer.id),
    ]);
    return ok({
      wallet: {
        balanceCents: wallet.balanceCents,
        currency: customer.currencyPref ?? "ZAR",
      },
      transactions: txns,
    });
  } catch (err) {
    return fail(err);
  }
}
