import { ApiError } from "./api.ts";
import { carByCode } from "./car-catalog.ts";
import type { GameType } from "./constants.ts";
import { getTursoDb } from "./db-turso.ts";
import type { TradePrice, TradePriceKind, TradeRates } from "./types.ts";

/**
 * Database access for the trade desk: the editable CPM2 price book and the
 * real-money conversion rates. Prices are DATA, not code — the owner updates
 * them in the app as the game's shop changes.
 */

type TradePriceRow = { game: string; code: number; kind: string; price: number; updated_at: string };
type TradeRateRow = { key: string; value: number };

export async function getTradeRates(): Promise<TradeRates> {
  const db = await getTursoDb();
  const rows = (await db.execute(`SELECT key, value FROM trade_rates`)).rows as unknown as TradeRateRow[];
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    randPerCoin: map.get("rand_per_coin") ?? 0,
    randPerCash: map.get("rand_per_cash") ?? 0,
  };
}

export async function setTradeRates(rates: TradeRates): Promise<TradeRates> {
  const db = await getTursoDb();
  await db.execute({
    sql: `INSERT INTO trade_rates (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: ["rand_per_coin", rates.randPerCoin],
  });
  await db.execute({
    sql: `INSERT INTO trade_rates (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: ["rand_per_cash", rates.randPerCash],
  });
  return getTradeRates();
}

export async function listTradePrices(game: GameType): Promise<TradePrice[]> {
  const db = await getTursoDb();
  const rows = (await db.execute({
    sql: `SELECT game, code, kind, price, updated_at FROM trade_prices WHERE game = ? ORDER BY code`,
    args: [game],
  })).rows as unknown as TradePriceRow[];

  const prices: TradePrice[] = [];
  for (const row of rows) {
    const car = carByCode(Number(row.code), game);
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

export async function setTradePrice(
  game: GameType,
  code: number,
  kind: TradePriceKind,
  price: number,
): Promise<TradePrice> {
  const car = carByCode(code, game);
  if (!car) {
    throw new ApiError(400, "TRADE_UNKNOWN_CAR", `Code ${code} is not a car in ${game.toUpperCase()}.`);
  }
  const updatedAt = new Date().toISOString();
  const db = await getTursoDb();
  await db.execute({
    sql: `INSERT INTO trade_prices (game, code, kind, price, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(game, code) DO UPDATE SET
            kind = excluded.kind,
            price = excluded.price,
            updated_at = excluded.updated_at`,
    args: [game, code, kind, price, updatedAt],
  });
  return { game, code, carName: car.name, kind, price, updatedAt };
}

export async function deleteTradePrice(game: GameType, code: number): Promise<boolean> {
  const db = await getTursoDb();
  const result = await db.execute({
    sql: `DELETE FROM trade_prices WHERE game = ? AND code = ?`,
    args: [game, code],
  });
  return (result.affectedRowCount ?? 0) > 0;
}