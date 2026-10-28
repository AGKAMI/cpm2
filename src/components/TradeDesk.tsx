"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toaster";
import { api, ApiRequestError } from "@/lib/client";
import { carByCode } from "@/lib/car-catalog";
import { formatNumber } from "@/lib/constants";
import { carValueRands, cashValueRands, tradeVerdict } from "@/lib/trade";
import type { TradePrice, TradePriceKind, TradeRates } from "@/lib/types";
import { TradeCarPickerModal } from "@/components/TradeCarPickerModal";

/**
 * The CPM2 trade desk. Both sides of a deal are totaled in Rands using the
 * owner's own price book and conversion rates, so he can see at a glance
 * whether a trade robs him. Cars are valued by how they are bought (paid /
 * coin / cash-shop), in-game cash can sweeten either side, and coins are
 * deliberately NOT a trade currency — they are personal money.
 */

type SideKey = "you" | "them";

type Side = {
  cars: number[];
  cash: number;
};

const KIND_LABELS: Record<TradePriceKind, string> = {
  paid: "Paid",
  coin: "Coin",
  cash: "Cash",
};

function formatRands(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `R${rounded.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function priceLabel(entry: TradePrice): string {
  if (entry.kind === "paid") return formatRands(entry.price);
  if (entry.kind === "coin") return `${formatNumber(entry.price)} coins`;
  return `${formatNumber(entry.price)} cash`;
}

export function TradeDesk() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<TradeRates>({ randPerCoin: 0, randPerCash: 0 });
  const [prices, setPrices] = useState<Map<number, TradePrice>>(new Map());
  const [sides, setSides] = useState<Record<SideKey, Side>>({
    you: { cars: [], cash: 0 },
    them: { cars: [], cash: 0 },
  });
  const [pickerSide, setPickerSide] = useState<SideKey | null>(null);
  const [pricingCode, setPricingCode] = useState<number | null>(null);
  const [priceKind, setPriceKind] = useState<TradePriceKind>("paid");
  const [priceAmount, setPriceAmount] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [rateResult, priceResult] = await Promise.all([
          api.tradeRates(),
          api.tradePrices("cpm2"),
        ]);
        if (cancelled) return;
        setRates(rateResult.rates);
        setPrices(new Map(priceResult.prices.map((entry) => [entry.code, entry])));
      } catch (err) {
        if (!cancelled) {
          toast.error("Could not load the trade desk", err instanceof ApiRequestError ? err.message : "Try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addCar(side: SideKey, code: number) {
    setSides((current) => ({
      ...current,
      [side]: { ...current[side], cars: [...current[side].cars, code] },
    }));
    // No forced price entry — an unpriced car just shows as "no price on
    // record" and the verdict carries a rough-call caveat. Recording a price
    // is optional, one tap on the car row, and saved to the book forever.
  }

  function removeCar(side: SideKey, code: number) {
    setSides((current) => {
      const cars = [...current[side].cars];
      const index = cars.indexOf(code);
      if (index >= 0) cars.splice(index, 1);
      return { ...current, [side]: { ...current[side], cars } };
    });
    setPricingCode((pending) => (pending === code ? null : pending));
  }

  function clearSide(side: SideKey) {
    setSides((current) => ({ ...current, [side]: { cars: [], cash: 0 } }));
    setPricingCode(null);
  }

  async function savePrice(code: number) {
    const car = carByCode(code, "cpm2");
    if (!car) return;
    const amount = Number(priceAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Price looks wrong", "Enter a number of zero or more.");
      return;
    }
    setSavingPrice(true);
    try {
      const { price } = await api.setTradePrice({ game: "cpm2", code, kind: priceKind, price: amount });
      setPrices((current) => new Map(current).set(code, price));
      setPricingCode(null);
      toast.success("Price saved", `#${code} ${car.name} is now priced as a ${KIND_LABELS[priceKind].toLowerCase()} car.`);
    } catch (err) {
      toast.error("Could not save the price", err instanceof ApiRequestError ? err.message : "Try again.");
    } finally {
      setSavingPrice(false);
    }
  }

  const valued = useMemo(() => {
    function evaluate(side: Side) {
      let total = cashValueRands(side.cash, rates);
      let unpriced = 0;
      for (const code of side.cars) {
        const entry = prices.get(code);
        if (!entry) {
          unpriced += 1;
          continue;
        }
        total += carValueRands(entry.kind, entry.price, rates);
      }
      return { total, unpriced };
    }
    return { you: evaluate(sides.you), them: evaluate(sides.them) };
  }, [sides, prices, rates]);

  const verdict = tradeVerdict(valued.you.total, valued.them.total);
  // Percentage lean instead of Rand figures — the owner wants the call, not
  // the accounting. The Rands stay under the hood.
  const leanBase = Math.max(valued.you.total, valued.them.total);
  const leanPct = leanBase > 0 ? Math.round((Math.abs(verdict.delta) / leanBase) * 100) : 0;
  const incomplete = valued.you.unpriced + valued.them.unpriced > 0;
  const unpricedCount = valued.you.unpriced + valued.them.unpriced;

  function renderSide(key: SideKey) {
    const side = sides[key];
    const value = valued[key];
    const title = key === "you" ? "You give" : "You get";
    return (
      <div className="panel-tight flex flex-col gap-3 rounded-[18px] px-4 py-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="label-caps">{title}</span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPickerSide(key)}
              className="cursor-pointer rounded-full border border-racing/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-racing transition hover:bg-racing/10"
            >
              + Car
            </button>
            <button
              type="button"
              onClick={() => clearSide(key)}
              disabled={side.cars.length === 0 && side.cash === 0}
              className="cursor-pointer text-[10px] text-ink-faint underline-offset-2 transition hover:text-oxblood hover:underline disabled:cursor-default disabled:opacity-0"
            >
              clear
            </button>
          </span>
        </div>

        {side.cars.length === 0 ? (
          <p className="py-2 text-[12px] text-ink-faint">No cars on this side yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {side.cars.map((code, index) => {
              const car = carByCode(code, "cpm2");
              const entry = prices.get(code);
              const unpriced = !entry;
              const pricing = pricingCode === code;
              return (
                <li key={`${code}-${index}`} className="rounded-[12px] border border-ink/10 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="num w-9 shrink-0 text-[11px] text-ink-faint">#{code}</span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                      {car?.name ?? `Code ${code}`}
                    </span>
                    {entry ? (
                      <>
                        <span className="shrink-0 rounded-full border border-ink/12 px-2 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                          {KIND_LABELS[entry.kind]}
                        </span>
                        <span className="num shrink-0 text-[11px] text-ink-faint">{priceLabel(entry)}</span>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setPricingCode(code);
                          setPriceKind("paid");
                          setPriceAmount("");
                        }}
                        className="shrink-0 cursor-pointer rounded-full border border-racing/40 px-2.5 py-0.5 text-[10px] font-semibold text-racing transition hover:bg-racing/10"
                      >
                        Set price
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeCar(key, code)}
                      aria-label={`Remove ${car?.name ?? `code ${code}`} from this side`}
                      className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full text-ink-faint transition hover:bg-oxblood/10 hover:text-oxblood"
                    >
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>

                  {pricing && unpriced ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-ink/8 pt-2">
                      <div className="flex gap-1" role="radiogroup" aria-label="How this car is bought">
                        {(["paid", "coin", "cash"] as const).map((kind) => (
                          <button
                            key={kind}
                            type="button"
                            role="radio"
                            aria-checked={priceKind === kind}
                            onClick={() => setPriceKind(kind)}
                            className={`cursor-pointer rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] transition ${
                              priceKind === kind
                                ? "border-racing/45 bg-racing/10 text-racing"
                                : "border-ink/12 text-ink-faint hover:text-ink"
                            }`}
                          >
                            {KIND_LABELS[kind]}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={priceAmount}
                        onChange={(event) => setPriceAmount(event.target.value)}
                        placeholder={
                          priceKind === "paid" ? "Price in Rands" : priceKind === "coin" ? "Price in coins" : "Price in cash"
                        }
                        aria-label="Car price"
                        className="field-rule num w-36 px-3 py-1.5 text-[12px]"
                      />
                      <Button variant="primary" size="sm" onClick={() => void savePrice(code)} disabled={savingPrice}>
                        Save
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-center gap-2 border-t border-ink/8 pt-3">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0 text-ink-faint"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <path d="M12 3v18M12 3l-3.5 3.5M12 3l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0" />
            <rect x="3.5" y="7.5" width="17" height="9" rx="2" />
            <path d="M7 12h.01M17 12h.01" strokeLinecap="round" />
          </svg>
          <label htmlFor={`${key}-cash`} className="shrink-0 text-[11px] text-ink-soft">
            Cash sweetener
          </label>
          <input
            id={`${key}-cash`}
            type="number"
            min={0}
            step="any"
            value={side.cash === 0 ? "" : side.cash}
            onChange={(event) => {
              const amount = Math.max(0, Math.floor(Number(event.target.value) || 0));
              setSides((current) => ({ ...current, [key]: { ...current[key], cash: amount } }));
            }}
            placeholder="0"
            className="field-rule num min-w-0 flex-1 px-3 py-1.5 text-[12px]"
          />
        </div>

        {value.unpriced > 0 ? (
          <p className="text-[10.5px] text-oxblood">
            {value.unpriced} unpriced car{value.unpriced === 1 ? "" : "s"} — not counted yet.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 lg:grid-cols-2">
        {renderSide("you")}
        {renderSide("them")}
      </div>

      {/* Verdict */}
      <section
        className={`rounded-[18px] border px-5 py-5 text-center ${
          incomplete
            ? "border-ink/15 bg-ink/[0.03]"
            : verdict.status === "gain"
              ? "border-racing/40 bg-racing/8"
              : verdict.status === "loss"
                ? "border-oxblood/40 bg-oxblood/8"
                : "border-ink/15 bg-ink/[0.03]"
        }`}
      >
        {loading ? (
          <p className="num text-[12px] text-ink-faint">Loading the price book…</p>
        ) : sides.you.cars.length + sides.them.cars.length === 0 && sides.you.cash === 0 && sides.them.cash === 0 ? (
          <p className="text-[13px] text-ink-faint">
            Put cars on both sides — the desk prices the deal in Rands and tells you straight if it robs you.
          </p>
        ) : incomplete ? (
          <>
            <p className="num text-[11px] uppercase tracking-[0.18em] text-ink-faint">
              Rough call · {unpricedCount} unpriced
            </p>
            <p
              className={`display-title mt-1 text-[28px] leading-none sm:text-[34px] ${
                verdict.status === "loss" ? "text-oxblood/70" : verdict.status === "gain" ? "text-racing/70" : "text-ink/60"
              }`}
            >
              {verdict.status === "gain" ? "Worth it" : verdict.status === "loss" ? "Not worth it" : "Fair trade"}
            </p>
            <p className="mt-2 text-[12px] text-ink-soft">
              {unpricedCount === 1
                ? "1 car has no price on record — record it once (tap it) and this becomes a final verdict."
                : `${unpricedCount} cars have no price on record — record them once (tap each) and this becomes final.`}
            </p>
          </>
        ) : (
          <>
            <p className="num text-[11px] uppercase tracking-[0.18em] text-ink-faint">The verdict</p>
            <p
              className={`display-title mt-1 text-[28px] leading-none sm:text-[34px] ${
                verdict.status === "loss" ? "text-oxblood" : verdict.status === "gain" ? "text-racing" : "text-ink"
              }`}
            >
              {verdict.status === "gain" ? "Worth it" : verdict.status === "loss" ? "Not worth it" : "Fair trade"}
            </p>
            <p className="mt-2 text-[12px] text-ink-soft">
              {verdict.status === "gain"
                ? `Roughly ${leanPct}% in your favour — take the deal.`
                : verdict.status === "loss"
                  ? `Roughly ${leanPct}% against you — you'd be robbing yourself.`
                  : "Too close to call — nobody is getting robbed."}
            </p>
          </>
        )}
      </section>

      <TradeCarPickerModal
        open={pickerSide !== null}
        onClose={() => setPickerSide(null)}
        onPick={(code) => {
          if (pickerSide) addCar(pickerSide, code);
        }}
        prices={prices}
      />
    </div>
  );
}
