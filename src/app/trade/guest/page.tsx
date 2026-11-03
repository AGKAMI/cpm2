"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toaster";
import { api } from "@/lib/client";
import { carByCode } from "@/lib/car-catalog";
import { formatNumber } from "@/lib/constants";
import { carValueRands, cashValueRands, tradeVerdict } from "@/lib/trade";
import { TradeCarPickerModal } from "@/components/TradeCarPickerModal";
import type { TradePrice, TradePriceKind, TradeRates } from "@/lib/types";

/**
 * Guest trade calculator — no login, no fleet access.
 * Read-only prices/rates from the owner's price book, verdict only.
 * You can't save prices or edit the book from here.
 */
type SideKey = "you" | "them";

type SideCar = { code: number; qty: number };

type Side = {
  cars: SideCar[];
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

export default function GuestTradeDesk() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<TradeRates>({ randPerCoin: 0, randPerCash: 0 });
  const [prices, setPrices] = useState<Map<number, TradePrice>>(new Map());
  const [sides, setSides] = useState<Record<SideKey, Side>>({
    you: { cars: [], cash: 0 },
    them: { cars: [], cash: 0 },
  });
  const [pickerSide, setPickerSide] = useState<SideKey | null>(null);
  const [showCash, setShowCash] = useState<Record<SideKey, boolean>>({ you: false, them: false });

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
        setPrices(new Map(priceResult.prices.map((entry) => [Number(entry.code), entry])));
      } catch {
        if (!cancelled) {
          toast.error("Could not load the price book", "Try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  function addCar(side: SideKey, code: number) {
    setSides((current) => {
      const cars = [...current[side].cars];
      const existing = cars.find((entry) => entry.code === code);
      if (existing) {
        existing.qty += 1;
      } else {
        cars.push({ code, qty: 1 });
      }
      return { ...current, [side]: { ...current[side], cars } };
    });
  }

  function removeCar(side: SideKey, code: number) {
    setSides((current) => {
      const cars = [...current[side].cars];
      const index = cars.findIndex((entry) => entry.code === code);
      if (index >= 0) {
        if (cars[index].qty > 1) {
          cars[index] = { ...cars[index], qty: cars[index].qty - 1 };
        } else {
          cars.splice(index, 1);
        }
      }
      return { ...current, [side]: { ...current[side], cars } };
    });
  }

  function clearSide(side: SideKey) {
    setSides((current) => ({ ...current, [side]: { cars: [], cash: 0 } }));
  }

  const valued = useMemo(() => {
    function evaluate(side: Side) {
      let total = cashValueRands(side.cash, rates);
      let unpriced = 0;
      for (const { code, qty } of side.cars) {
        const entry = prices.get(code);
        if (!entry) {
          unpriced += 1;
          continue;
        }
        total += carValueRands(entry.kind, entry.price, rates) * qty;
      }
      return { total, unpriced };
    }
    return { you: evaluate(sides.you), them: evaluate(sides.them) };
  }, [sides, prices, rates]);

  const verdict = tradeVerdict(valued.you.total, valued.them.total);
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
              className="cursor-pointer text-[10px] text-ink-faint underline-offset-2 transition hover:text-racing hover:underline disabled:cursor-default disabled:opacity-0"
            >
              clear
            </button>
          </span>
        </div>

        {side.cars.length === 0 ? (
          <p className="py-2 text-[12px] text-ink-faint">No cars on this side yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {side.cars.map(({ code, qty }) => {
              const car = carByCode(code, "cpm2");
              const entry = prices.get(code);
              const unpriced = !entry;
              return (
                <li key={code} className="rounded-[12px] border border-mix(in srgb, var(--color-ink) 10%, transparent) px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="num w-9 shrink-0 text-[11px] text-ink-faint">#{code}</span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                      {car?.name ?? `Code ${code}`}
                    </span>
                    {entry ? (
                      <>
                        <span className="shrink-0 rounded-full border border-mix(in srgb, var(--color-ink) 12%, transparent) px-2 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                          {KIND_LABELS[entry.kind]}
                        </span>
                        <span className="num shrink-0 text-[11px] text-ink-faint">
                          {entry.kind === "paid"
                            ? formatRands(entry.price)
                            : `${formatNumber(entry.price)} ${entry.kind === "coin" ? "coins" : "cash"}`}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] text-ink-faint">no price on record</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeCar(key, code)}
                      aria-label={`Remove ${car?.name ?? `code ${code}`} from this side`}
                      className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full text-ink-faint transition hover:bg-racing/10 hover:text-racing"
                    >
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>

                  <div className="mt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => removeCar(key, code)}
                      aria-label={`Remove one ${car?.name ?? `code ${code}`}`}
                      className="shrink-0 cursor-pointer place-items-center rounded-full border border-mix(in srgb, var(--color-ink) 10%, transparent) px-2 py-0.5 text-[10px] text-ink transition hover:bg-ink/5"
                    >
                      −
                    </button>
                    <span className="shrink-0 num text-[12px] text-ink">{qty}</span>
                    <button
                      type="button"
                      onClick={() => addCar(key, code)}
                      aria-label={`Add one ${car?.name ?? `code ${code}`}`}
                      className="shrink-0 cursor-pointer place-items-center rounded-full border border-mix(in srgb, var(--color-ink) 10%, transparent) px-2 py-0.5 text-[10px] text-ink transition hover:bg-ink/5"
                    >
                      +
                    </button>
                    <span className="text-[10px] text-ink-faint">qty</span>
                  </div>

                  {unpriced && (
                    <p className="mt-1 text-[10px] text-racing">No price — not counted yet.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {side.cash > 0 ? (
          <div className="flex items-center gap-2 border-t border-mix(in srgb, var(--color-ink) 8%, transparent) pt-3">
            <label htmlFor={`${key}-cash`} className="shrink-0 text-[11px] text-ink-soft">
              {key === "you" ? "Cash you add" : "Cash they add"}
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
        ) : (
          <button
            type="button"
            onClick={() => setShowCash((c) => ({ ...c, [key]: true }))}
            className="text-[10px] text-ink-faint underline-offset-2 hover:text-racing hover:underline"
          >
            + Add cash
          </button>
        )}

        {value.unpriced > 0 && (
          <p className="text-[10.5px] text-racing">
            {value.unpriced} unpriced car{value.unpriced === 1 ? "" : "s"} — not counted yet.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-[700px] mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3 border-b border-mix(in srgb, var(--color-ink) 12%, transparent) pb-4 mb-6">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-racing" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M5 12h14M12 5v14" />
          </svg>
          <span className="label-caps text-[14px] font-bold tracking-wider">CPM2 · Trade Calculator</span>
        </div>
      </div>

      {loading ? (
        <p className="text-center py-8 text-[12px] text-ink-faint">Loading the price book…</p>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {renderSide("you")}
            {renderSide("them")}
          </div>

          {/* Verdict — hidden until there's something on at least one side */}
          {sides.you.cars.length + sides.them.cars.length === 0 && sides.you.cash === 0 && sides.them.cash === 0 ? (
            <p className="text-center text-[12px] text-ink-faint py-4">
              Put cars on both sides — the desk prices the deal in Rands and tells you straight if it robs you.
            </p>
          ) : (
            <>
              <section
                className={`rounded-[18px] border px-5 py-5 text-center ${
                  incomplete
                    ? "border-mix(in srgb, var(--color-ink) 15%, transparent) bg-mix(in srgb, var(--color-ink) 3%, transparent)"
                    : verdict.status === "gain"
                      ? "border-racing/40 bg-racing/8"
                      : verdict.status === "loss"
                        ? "border-racing/40 bg-racing/8"
                        : "border-mix(in srgb, var(--color-ink) 15%, transparent) bg-mix(in srgb, var(--color-ink) 3%, transparent)"}
              `}
              >
                <p className="num text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                  {incomplete ? "Rough call" : "The verdict"}
                </p>
                <p
                  className="display-title mt-1 text-[28px] leading-none sm:text-[34px] font-bold"
                  style={{
                    color: `hsl(${verdict.delta >= 0 ? Math.min(120, 60 + Math.min(leanPct, 60)) : Math.max(0, 60 - Math.min(leanPct, 60))}, 75%, 45%)`,
                  }}
                >
                  {verdict.status === "gain" ? "Worth it" : verdict.status === "loss" ? "Not worth it" : "Fair trade"}
                </p>
                {incomplete ? (
                  <p className="mt-2 text-[12px] text-ink-soft">
                    {unpricedCount === 1
                      ? "1 car has no price on record — not counted yet."
                      : `${unpricedCount} cars have no price on record — not counted yet.`}
                  </p>
                ) : (
                  <p className="mt-2 text-[12px] text-ink-soft">
                    {verdict.status === "gain"
                      ? `Roughly ${leanPct}% in your favour — take the deal.`
                      : verdict.status === "loss"
                        ? `Roughly ${leanPct}% against you — you'd be robbing yourself.`
                        : "Too close to call — nobody is getting robbed."}
                  </p>
                )}
              </section>
            </>
          )}
        </>
      )}
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

