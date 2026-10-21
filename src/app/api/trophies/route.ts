import { fleetTrophySummary } from "@/lib/service";
import { fail, ok } from "@/lib/route";

export const dynamic = "force-dynamic";

/** Trophy totals for the whole fleet — the cabinet on the overview page. */
export async function GET() {
  try {
    const accounts = fleetTrophySummary();
    const totals = accounts.reduce(
      (sum, account) => ({
        gold: sum.gold + account.gold,
        silver: sum.silver + account.silver,
        bronze: sum.bronze + account.bronze,
      }),
      { gold: 0, silver: 0, bronze: 0 },
    );
    return ok({
      accounts,
      totals: { ...totals, total: totals.gold + totals.silver + totals.bronze },
    });
  } catch (err) {
    return fail(err);
  }
}
