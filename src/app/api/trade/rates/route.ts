import { getTradeRates, setTradeRates } from "@/lib/trade-store";
import { fail, ok, readJson } from "@/lib/route";
import { tradeRatesSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** The real-money conversion rates behind every trade valuation. */
export async function GET() {
  try {
    return ok({ rates: getTradeRates() });
  } catch (err) {
    return fail(err);
  }
}

export async function PUT(request: Request) {
  try {
    const input = tradeRatesSchema.parse(await readJson(request));
    return ok({ rates: setTradeRates(input) });
  } catch (err) {
    return fail(err);
  }
}
