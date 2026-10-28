import { carsForGame, levenshtein } from "./car-catalog.ts";
import type { GameType } from "./constants.ts";
import type { CarMatch, TradePriceKind, TradeRates } from "./types.ts";

/**
 * Pure trade-desk math and the fuzzy car-name matcher behind the Gemini
 * screenshot identification. No database, no I/O — everything here is
 * deterministic so the calculator behaves identically on the server and in
 * the browser.
 */

/**
 * The value model the owner settled on:
 * - a PAID car is bought with real money → its Rand price IS its value
 * - a COIN car's value flows through the coins→Rands rate (coins are personal
 *   money, never a trade currency — they cannot sweeten a deal)
 * - a CASH car's value flows through the cash→Rands rate — in-game cash is
 *   grindable but also buyable with real money, so a cash price has a real
 *   cost. In-game CASH can likewise sweeten a deal — see cashValueRands.
 */
export function carValueRands(kind: TradePriceKind, price: number, rates: TradeRates): number {
  const safePrice = Math.max(0, price);
  if (kind === "paid") return safePrice;
  if (kind === "coin") return safePrice * Math.max(0, rates.randPerCoin);
  return safePrice * Math.max(0, rates.randPerCash);
}

/** Rand value of in-game cash offered as a trade sweetener. */
export function cashValueRands(cash: number, rates: TradeRates): number {
  return Math.max(0, cash) * Math.max(0, rates.randPerCash);
}

export type TradeVerdict = {
  status: "gain" | "fair" | "loss";
  /** you minus them, in Rands — positive means you come out ahead. */
  delta: number;
};

/**
 * Compares both sides of a deal. A trade inside ±3% of the larger side is
 * "fair" — nobody wins a haggle to the last cent, and demanding exact
 * equality would flag every realistic deal.
 */
export function tradeVerdict(youRands: number, themRands: number, tolerance = 0.03): TradeVerdict {
  const delta = youRands - themRands;
  const bigger = Math.max(Math.abs(youRands), Math.abs(themRands));
  if (bigger === 0 || Math.abs(delta) <= bigger * tolerance) {
    return { status: "fair", delta };
  }
  return { status: delta > 0 ? "gain" : "loss", delta };
}

/** Uppercase, punctuation stripped, single-spaced — the comparison space. */
function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(name: string): Set<string> {
  return new Set(normalizeName(name).split(" ").filter(Boolean));
}

/** 1 − edit-distance/length: 1 for identical strings, →0 for unrelated ones. */
function levenshteinRatio(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

/**
 * Ranks the catalog of ONE game against a free-text car name (usually what
 * Gemini read off a screenshot). Score = best of:
 * - token Jaccard × 0.9  (word overlap, e.g. "BMW M3 GTR" vs "BMW M3 GTR 2005")
 * - 0.85 containment     (one name's words fully inside the other's)
 * - Levenshtein ratio    (catches one-off typos and misreads)
 * Matches below 0.4 are dropped — the user confirms the pick anyway, so the
 * list should stay short and plausible rather than exhaustive.
 */
export function matchCarName(query: string, game: GameType, limit = 5): CarMatch[] {
  const q = normalizeName(query);
  if (!q) return [];
  const qTokens = tokenSet(query);

  const scored = carsForGame(game).map((car) => {
    const normalized = normalizeName(car.name);
    const tokens = tokenSet(car.name);

    let intersection = 0;
    for (const token of qTokens) if (tokens.has(token)) intersection += 1;
    const union = new Set([...qTokens, ...tokens]).size;
    const jaccard = union ? intersection / union : 0;

    const shorter = qTokens.size <= tokens.size ? [...qTokens] : [...tokens];
    const longer = qTokens.size <= tokens.size ? tokens : qTokens;
    const contained = shorter.length > 0 && shorter.every((token) => longer.has(token));

    return {
      code: car.code,
      name: car.name,
      score: Math.max(jaccard * 0.9, contained ? 0.85 : 0, levenshteinRatio(q, normalized)),
    };
  });

  return scored
    .filter((match) => match.score >= 0.4)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}
