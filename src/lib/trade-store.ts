import { ApiError } from "./api.ts";
import { carByCode } from "./car-catalog.ts";
import type { GameType } from "./constants.ts";
import { getDb } from "./db.ts";
import type { TradePrice, TradePriceKind, TradeRates } from "./types.ts";

/**
 * Database access for the trade desk: the editable CPM2 price book and the
 * real-money conversion rates. Prices are DATA, not code — the owner updates
 * them in the app as the game's shop changes.
 */

type TradePriceRow = { game: string; code: number; kind: string; price: number; updated_at: string };
type TradeRateRow = { key: string; value: number };

export function getTradeRates(): TradeRates {
  const rows = getDb().prepare(`SELECT key, value FROM trade_rates`).all() as TradeRateRow[];
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    randPerCoin: map.get("rand_per_coin") ?? 0,
    randPerCash: map.get("rand_per_cash") ?? 0,
  };
}

export function setTradeRates(rates: TradeRates): TradeRates {
  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO trade_rates (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  db.transaction(() => {
    upsert.run("rand_per_coin", rates.randPerCoin);
    upsert.run("rand_per_cash", rates.randPerCash);
  })();
  return getTradeRates();
}

export function listTradePrices(game: GameType): TradePrice[] {
  const rows = getDb()
    .prepare(`SELECT game, code, kind, price, updated_at FROM trade_prices WHERE game = ? ORDER BY code`)
    .all(game) as TradePriceRow[];
  const prices: TradePrice[] = [];
  for (const row of rows) {
    const car = carByCode(row.code, game);
    // The catalog is static, but never trust a stored code blindly — a stale
    // row must not surface as a car that does not exist.
    if (!car) continue;
    prices.push({
      game,
      code: row.code,
      carName: car.name,
      kind: row.kind as TradePriceKind,
      price: row.price,
      updatedAt: row.updated_at,
    });
  }
  return prices;
}

export function setTradePrice(
  game: GameType,
  code: number,
  kind: TradePriceKind,
  price: number,
): TradePrice {
  const car = carByCode(code, game);
  if (!car) {
    throw new ApiError(400, "TRADE_UNKNOWN_CAR", `Code ${code} is not a car in ${game.toUpperCase()}.`);
  }
  const updatedAt = new Date().toISOString();
  getDb()
    .prepare(`
      INSERT INTO trade_prices (game, code, kind, price, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(game, code) DO UPDATE SET
        kind = excluded.kind,
        price = excluded.price,
        updated_at = excluded.updated_at
    `)
    .run(game, code, kind, price, updatedAt);
  return { game, code, carName: car.name, kind, price, updatedAt };
}

export function deleteTradePrice(game: GameType, code: number): boolean {
  const result = getDb().prepare(`DELETE FROM trade_prices WHERE game = ? AND code = ?`).run(game, code);
  return result.changes > 0;
}
