import { ZodError } from "zod";
import { ApiError } from "./api.ts";
import {
  GAME_LABELS,
  LIMITS,
  TROPHY_CLASSES,
  TROPHY_CLASS_LABELS,
  slotsLockedValue,
  type GameType,
  type TrophyClass,
} from "./constants.ts";
import { allowsDuplicateModels, garageCapacity } from "./garage.ts";
import { carByCode } from "./car-catalog.ts";
import { csvToRecords, escapeCsvValue, normalizeImportRow } from "./csv.ts";
import { decryptSecret, encryptSecret } from "./crypto.ts";
import { scryptHash, scryptCompare } from "./auth.ts";
import { getTursoDb, type AccountRow, type EventRow, type UserRow } from "./db-turso.ts";
import { computeFleetStats } from "./stats.ts";
import type {
  AccountSummary,
  FleetEvent,
  FleetStats,
  ImportReport,
  ImportRowResult,
  TrophyRecord,
  TrophySummary,
  CarRecord,
  GarageSummary,
  CarOwners,
} from "./types.ts";
import {
  accountCreateSchema,
  accountPatchSchema,
  slotPurchaseSchema,
  trophyUpdateSchema,
  carAssignSchema,
  type AccountCreateInput,
  type AccountPatchInput,
} from "./validation.ts";

export type { AccountSummary, FleetEvent, FleetStats } from "./types.ts";
export type { ImportReport, ImportRowResult } from "./types.ts";
export type { TrophyRecord, TrophySummary } from "./types.ts";
export type { CarRecord, GarageSummary } from "./types.ts";

const TRACKED_FIELDS = [
  "email",
  "game",
  "cash",
  "coins",
  "cars",
  "baseSlots",
  "slots",
  "newGarage",
  "coinsSpentOnCars",
  "notes",
] as const;

function toSummary(row: AccountRow): AccountSummary {
  return {
    id: row.id,
    userId: row.user_id ?? null,
    email: row.email,
    game: row.game,
    cash: Number(row.cash),
    coins: Number(row.coins),
    cars: Number(row.cars),
    baseSlots: Number(row.base_slots),
    slots: Number(row.slots),
    newGarage: Number(row.new_garage) === 1,
    capacity: garageCapacity(row.game, {
      baseSlots: Number(row.base_slots),
      slots: Number(row.slots),
      newGarage: Number(row.new_garage) === 1,
    }),
    slotsValue: slotsLockedValue(Number(row.slots)),
    coinsSpentOnCars: Number(row.coins_spent_on_cars),
    notes: row.notes,
    archived: Number(row.archived) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function garageShape(
  game: GameType,
  baseSlots: number,
  slots: number,
  newGarage: boolean,
): { baseSlots: number; slots: number; newGarage: boolean } {
  if (game === "cpm1") {
    return { baseSlots: 0, slots: 0, newGarage: false };
  }
  return { baseSlots, slots, newGarage };
}

function now(): string {
  return new Date().toISOString();
}

const EVENT_RETENTION = 10_000;

export async function logEvent(
  accountId: number | null,
  email: string,
  type: FleetEvent["type"],
  summary: string,
  changes: Record<string, { from: unknown; to: unknown }> = {},
): Promise<void> {
  const db = await getTursoDb();
  await db.execute({
    sql: `INSERT INTO account_events (account_id, account_email, type, summary, changes, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    args: [accountId, email, type, summary, JSON.stringify(changes), now()],
  });

  await db.execute({
    sql: `DELETE FROM account_events WHERE id <= (
       SELECT id FROM account_events ORDER BY id DESC LIMIT 1 OFFSET ?
     )`,
    args: [EVENT_RETENTION - 1],
  });
}

async function requireAccount(id: number, options: { includeArchived?: boolean } = {}): Promise<AccountRow> {
  const db = await getTursoDb();
  const row = await db.execute({
    sql: `SELECT * FROM accounts WHERE id = ?`,
    args: [id],
  });
  const account = row.rows[0] as unknown as AccountRow | undefined;
  if (!account) throw new ApiError(404, "NOT_FOUND", "That account no longer exists.");
  if (!options.includeArchived && Number(account.archived) === 1) {
    throw new ApiError(404, "NOT_FOUND", "That account is archived. Restore it before making changes.");
  }
  return account;
}

async function assertEmailFree(email: string, game: GameType, exceptId?: number): Promise<void> {
  const db = await getTursoDb();
  const row = await db.execute({
    sql: `SELECT id, archived FROM accounts WHERE email = ? COLLATE NOCASE AND game = ? AND id IS NOT ?`,
    args: [email, game, exceptId ?? -1],
  });
  const existing = row.rows[0] as unknown as { id: number; archived: number } | undefined;
  if (existing) {
    const isArchived = Number(existing.archived) === 1;
    throw new ApiError(
      409,
      "EMAIL_TAKEN",
      isArchived
        ? `${email} is tracked but archived — restore it instead of adding it again.`
        : `${email} is already tracked.`,
    );
  }
}

export type ArchiveFilter = "exclude" | "only" | "include";

export async function listAccounts(
  options: { archived?: ArchiveFilter; userId?: number } = {},
): Promise<AccountSummary[]> {
  const mode = options.archived ?? "exclude";
  const userId = options.userId;
  const db = await getTursoDb();
  let sql = "";
  if (mode === "include") {
    sql = userId !== undefined
      ? `SELECT * FROM accounts WHERE user_id = ? ORDER BY datetime(created_at) DESC, id DESC`
      : `SELECT * FROM accounts ORDER BY datetime(created_at) DESC, id DESC`;
  } else if (mode === "only") {
    sql = userId !== undefined
      ? `SELECT * FROM accounts WHERE archived = 1 AND user_id = ? ORDER BY datetime(created_at) DESC, id DESC`
      : `SELECT * FROM accounts WHERE archived = 1 ORDER BY datetime(created_at) DESC, id DESC`;
  } else {
    sql = userId !== undefined
      ? `SELECT * FROM accounts WHERE archived = 0 AND user_id = ? ORDER BY datetime(created_at) DESC, id DESC`
      : `SELECT * FROM accounts WHERE archived = 0 ORDER BY datetime(created_at) DESC, id DESC`;
  }
  const args = userId !== undefined ? [userId] : [];
  const rows = (await db.execute({ sql, args })).rows as unknown as AccountRow[];
  return rows.map(toSummary);
}

export async function getAccount(id: number, userId?: number): Promise<AccountSummary> {
  const account = await requireAccount(id);
  if (userId !== undefined && account.user_id !== null && Number(account.user_id) !== userId) {
    throw new ApiError(404, "NOT_FOUND", "That account no longer exists.");
  }
  return toSummary(account);
}

export async function createAccount(payload: unknown, userId?: number): Promise<AccountSummary> {
  const input: AccountCreateInput = accountCreateSchema.parse(payload);

  // If an account already exists for this email+game (archived or not),
  // restore/overwrite it instead of failing. Passwords, balances and game
  // are overwritten from the import payload.
  const existing = await findAccountByEmailGame(input.email, input.game);
  if (existing) {
    return restoreAndOverwrite(existing.id, input, userId);
  }

  await assertEmailFree(input.email, input.game);

  const db = await getTursoDb();
  const stamp = now();
  const shape = garageShape(input.game, input.baseSlots, input.slots, input.newGarage);

  const result = await db.execute({
    sql: `INSERT INTO accounts
       (user_id, email, password_enc, game, cash, coins, cars, base_slots, slots, new_garage, notes,
        coins_spent_on_cars, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    args: [
      userId ?? null,
      input.email,
      encryptSecret(input.password),
      input.game,
      input.cash,
      input.coins,
      input.cars,
      shape.baseSlots,
      shape.slots,
      shape.newGarage ? 1 : 0,
      input.notes,
      input.coinsSpentOnCars,
      stamp,
      stamp,
    ],
  });
  const id = Number(result.lastInsertRowid);
  await logEvent(id, input.email, "created", `Account added to the fleet (${GAME_LABELS[input.game]})`, {
    cash: { from: 0, to: input.cash },
    coins: { from: 0, to: input.coins },
    cars: { from: 0, to: input.cars },
    baseSlots: { from: 0, to: shape.baseSlots },
    slots: { from: 0, to: shape.slots },
  });

  return getAccount(id, userId);
}

async function findAccountByEmailGame(email: string, game: GameType): Promise<AccountRow | null> {
  const db = await getTursoDb();
  const row = await db.execute({
    sql: `SELECT * FROM accounts WHERE email = ? COLLATE NOCASE AND game = ? LIMIT 1`,
    args: [email, game],
  });
  return (row.rows[0] as unknown as AccountRow | undefined) ?? null;
}

async function restoreAndOverwrite(
  id: number,
  input: AccountCreateInput,
  userId?: number,
): Promise<AccountSummary> {
  const db = await getTursoDb();
  const stamp = now();
  const shape = garageShape(input.game, input.baseSlots, input.slots, input.newGarage);
  await db.execute({
    sql: `UPDATE accounts
       SET user_id = ?,
           password_enc = ?,
           game = ?,
           cash = ?,
           coins = ?,
           cars = ?,
           base_slots = ?,
           slots = ?,
           new_garage = ?,
           notes = ?,
           coins_spent_on_cars = ?,
           archived = 0,
           updated_at = ?
     WHERE id = ?`,
    args: [
      userId ?? null,
      encryptSecret(input.password),
      input.game,
      input.cash,
      input.coins,
      input.cars,
      shape.baseSlots,
      shape.slots,
      shape.newGarage ? 1 : 0,
      input.notes,
      input.coinsSpentOnCars,
      stamp,
      id,
    ],
  });
  await logEvent(id, input.email, "updated", `Archived account restored from import (${GAME_LABELS[input.game]})`, {
    archived: { from: true, to: false },
  });
  return getAccount(id, userId);
}

export async function updateAccount(id: number, payload: unknown, userId?: number): Promise<AccountSummary> {
  const patch: AccountPatchInput = accountPatchSchema.parse(payload);
  const existing = await requireAccount(id);
  if (userId !== undefined && Number(existing.user_id) !== userId) {
    throw new ApiError(404, "NOT_FOUND", "That account no longer exists.");
  }

  if (patch.slots !== undefined && patch.slots > existing.slots) {
    if (existing.game === "cpm1") {
      throw new ApiError(
        422,
        "CPM1_HAS_NO_SLOTS",
        "CPM1 has no car slots — every model in the game can be owned, one of each.",
      );
    }
    throw new ApiError(
      422,
      "SLOTS_PURCHASE_ONLY",
      `Extra slots can only be bought: POST /api/accounts/${id}/slots charges ${LIMITS.SLOT_COST_COINS} coins per slot (this account holds ${existing.coins} coins).`,
    );
  }

  if (patch.game !== undefined && patch.game !== existing.game) {
    const db = await getTursoDb();
    const owned = await db.execute({
      sql: `SELECT COUNT(*) AS n FROM account_cars WHERE account_id = ?`,
      args: [id],
    });
    const count = Number((owned.rows[0] as { n: unknown }).n);
    if (count > 0) {
      throw new ApiError(
        422,
        "GAME_LOCKED",
        `This account has ${count} car(s) logged under ${GAME_LABELS[existing.game]}. Remove them before switching it to ${GAME_LABELS[patch.game]}, or the codes would resolve to different cars.`,
      );
    }
  }

  const next = {
    email: patch.email ?? existing.email,
    game: patch.game ?? existing.game,
    cash: patch.cash ?? existing.cash,
    coins: patch.coins ?? existing.coins,
    cars: patch.cars ?? existing.cars,
    baseSlots: patch.baseSlots ?? existing.base_slots,
    slots: patch.slots ?? existing.slots,
    newGarage: patch.newGarage ?? Number(existing.new_garage) === 1,
    coinsSpentOnCars: patch.coinsSpentOnCars ?? existing.coins_spent_on_cars,
    notes: patch.notes ?? existing.notes,
  };

  const shape = garageShape(next.game, next.baseSlots, next.slots, next.newGarage);
  next.baseSlots = shape.baseSlots;
  next.slots = shape.slots;
  next.newGarage = shape.newGarage;

  const capacity = garageCapacity(next.game, shape);
  if (next.cars > capacity) {
    throw new ApiError(
      422,
      "CAR_CAPACITY_EXCEEDED",
      next.game === "cpm1"
        ? `${next.cars} cars need more room — CPM1 holds one of every model in the game (${capacity} models).`
        : `${next.cars} cars need more room — this garage holds ${capacity} (${next.baseSlots} base + ${next.slots} coin slot(s)${next.newGarage ? ` + ${LIMITS.NEW_GARAGE_SLOTS} new-garage slots` : ""}).`,
    );
  }

  if (next.email.toLowerCase() !== existing.email.toLowerCase()) {
    await assertEmailFree(next.email, next.game, id);
  }

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of TRACKED_FIELDS) {
    const before =
      field === "coinsSpentOnCars"
        ? existing.coins_spent_on_cars
        : field === "baseSlots"
          ? existing.base_slots
          : field === "newGarage"
            ? Boolean(existing.new_garage)
            : (existing as Record<string, unknown>)[field];
    const after = next[field];
    if (before !== after) changes[field] = { from: before, to: after };
  }

  const removedSlots = existing.slots - next.slots;
  const baseChanged = existing.base_slots !== next.baseSlots;
  const garageChanged = Number(existing.new_garage) !== Number(next.newGarage ? 1 : 0);
  const eventType: FleetEvent["type"] = garageChanged
    ? "garage_upgraded"
    : removedSlots > 0
      ? "slots_removed"
      : "updated";
  const summary = garageChanged
    ? next.newGarage
      ? `New garage added (+${LIMITS.NEW_GARAGE_SLOTS} slots, ${LIMITS.NEW_GARAGE_PRICE})`
      : `New garage removed (-${LIMITS.NEW_GARAGE_SLOTS} slots)`
    : removedSlots > 0
      ? `Removed ${removedSlots} car slot(s) — the game does not refund slot coins`
      : baseChanged
        ? `Base garage size set to ${next.baseSlots}`
        : "Account details updated";

  const db = await getTursoDb();
  await db.execute({
    sql: `UPDATE accounts
         SET email = ?, password_enc = ?, game = ?, cash = ?, coins = ?, cars = ?, base_slots = ?, slots = ?, new_garage = ?, notes = ?, coins_spent_on_cars = ?, updated_at = ?
       WHERE id = ?`,
    args: [
      next.email,
      patch.password !== undefined ? encryptSecret(patch.password) : existing.password_enc,
      next.game,
      next.cash,
      next.coins,
      next.cars,
      next.baseSlots,
      next.slots,
      next.newGarage ? 1 : 0,
      next.notes,
      next.coinsSpentOnCars,
      now(),
      id,
    ],
  });
  await logEvent(id, next.email, eventType, summary, changes);

  return getAccount(id);
}

export async function archiveAccount(id: number, userId?: number): Promise<{ id: number; email: string }> {
  const existing = await requireAccount(id, { includeArchived: true });
  if (userId !== undefined && Number(existing.user_id) !== userId) {
    throw new ApiError(404, "NOT_FOUND", "That account no longer exists.");
  }
  if (existing.archived) return { id, email: existing.email };

  const db = await getTursoDb();
  await db.execute({
    sql: `UPDATE accounts SET archived = 1, updated_at = ? WHERE id = ?`,
    args: [now(), id],
  });
  await logEvent(id, existing.email, "archived", "Account archived — balances kept, nothing destroyed", {
    cash: { from: existing.cash, to: existing.cash },
    coins: { from: existing.coins, to: existing.coins },
    cars: { from: existing.cars, to: existing.cars },
  });

  return { id, email: existing.email };
}

export async function restoreAccount(id: number, userId?: number): Promise<AccountSummary> {
  const existing = await requireAccount(id, { includeArchived: true });
  if (userId !== undefined && Number(existing.user_id) !== userId) {
    throw new ApiError(404, "NOT_FOUND", "That account no longer exists.");
  }
  if (!existing.archived) return toSummary(existing);

  const db = await getTursoDb();
  await db.execute({
    sql: `UPDATE accounts SET archived = 0, updated_at = ? WHERE id = ?`,
    args: [now(), id],
  });
  await logEvent(id, existing.email, "updated", "Account restored from the archive", {
    archived: { from: true, to: false },
  });

  return getAccount(id);
}

export async function purchaseSlots(id: number, payload: unknown, userId?: number): Promise<AccountSummary> {
  const { count } = slotPurchaseSchema.parse(payload ?? { count: 1 });
  const existing = await requireAccount(id);
  if (userId !== undefined && Number(existing.user_id) !== userId) {
    throw new ApiError(404, "NOT_FOUND", "That account no longer exists.");
  }

  if (existing.game === "cpm1") {
    throw new ApiError(
      422,
      "CPM1_HAS_NO_SLOTS",
      "CPM1 has no car slots — every model in the game can be owned, one of each.",
    );
  }

  if (existing.slots + count > LIMITS.MAX_COIN_SLOTS) {
    throw new ApiError(
      422,
      "SLOT_LIMIT_REACHED",
      `A CPM2 garage has ${LIMITS.MAX_COIN_SLOTS} coin slot — the 21st, for ${LIMITS.SLOT_COST_COINS} coins (this one already has ${existing.slots}). The other ${LIMITS.NEW_GARAGE_SLOTS} slots come with the ${LIMITS.NEW_GARAGE_PRICE} garage.`,
    );
  }

  const cost = count * LIMITS.SLOT_COST_COINS;
  if (existing.coins < cost) {
    throw new ApiError(
      422,
      "INSUFFICIENT_COINS",
      `Need ${cost.toLocaleString("en-US")} coins for ${count} slot(s) — this account only has ${existing.coins.toLocaleString("en-US")}.`,
    );
  }

  const db = await getTursoDb();
  await db.execute({
    sql: `UPDATE accounts SET coins = coins - ?, slots = slots + ?, updated_at = ? WHERE id = ?`,
    args: [cost, count, now(), id],
  });
  await logEvent(id, existing.email, "slots_purchased", `Bought ${count} car slot(s) for ${cost} coins`, {
    coins: { from: existing.coins, to: existing.coins - cost },
    slots: { from: existing.slots, to: existing.slots + count },
  });

  return getAccount(id);
}

export async function revealPassword(id: number, userId?: number): Promise<{ id: number; email: string; password: string }> {
  const existing = await requireAccount(id);
  if (userId !== undefined && Number(existing.user_id) !== userId) {
    throw new ApiError(404, "NOT_FOUND", "That account no longer exists.");
  }
  try {
    const password = decryptSecret(existing.password_enc);
    await logEvent(id, existing.email, "password_revealed", "Password revealed for viewing");
    return { id, email: existing.email, password };
  } catch (err) {
    throw new ApiError(
      500,
      "DECRYPT_FAILED",
      err instanceof Error ? err.message : "Password could not be decrypted.",
    );
  }
}

type TrophyRow = {
  account_id: number;
  class: string;
  gold: number;
  silver: number;
  bronze: number;
  updated_at: string;
};

function toTrophyRecord(row: TrophyRow): TrophyRecord {
  const gold = Number(row.gold);
  const silver = Number(row.silver);
  const bronze = Number(row.bronze);
  return {
    class: row.class,
    gold,
    silver,
    bronze,
    total: gold + silver + bronze,
    updatedAt: row.updated_at,
  };
}

export async function listTrophies(accountId: number, userId?: number): Promise<TrophyRecord[]> {
  await requireAccount(accountId, { includeArchived: true });
  if (userId !== undefined) {
    const account = await requireAccount(accountId, { includeArchived: true });
    if (Number(account.user_id) !== userId) {
      throw new ApiError(404, "NOT_FOUND", "That account no longer exists.");
    }
  }
  const db = await getTursoDb();
  const rows = (await db.execute({
    sql: `SELECT * FROM account_trophies WHERE account_id = ?`,
    args: [accountId],
  })).rows as unknown as TrophyRow[];

  const byClass = new Map(rows.map((row) => [row.class, toTrophyRecord(row)]));
  return TROPHY_CLASSES.map(
    (klass) =>
      byClass.get(klass) ?? {
        class: klass,
        gold: 0,
        silver: 0,
        bronze: 0,
        total: 0,
        updatedAt: "",
      },
  );
}

export async function trophySummary(accountId: number, userId?: number): Promise<TrophySummary> {
  const account = await requireAccount(accountId, { includeArchived: true });
  if (userId !== undefined && Number(account.user_id) !== userId) {
    throw new ApiError(404, "NOT_FOUND", "That account no longer exists.");
  }
  const byClass = await listTrophies(accountId);
  const gold = byClass.reduce((sum, item) => sum + item.gold, 0);
  const silver = byClass.reduce((sum, item) => sum + item.silver, 0);
  const bronze = byClass.reduce((sum, item) => sum + item.bronze, 0);
  return {
    accountId: account.id,
    email: account.email,
    gold,
    silver,
    bronze,
    total: gold + silver + bronze,
    byClass,
  };
}

export async function fleetTrophySummary(userId?: number): Promise<TrophySummary[]> {
  const accounts = await listAccounts({ archived: "include", userId });
  return Promise.all(
    accounts.map(async (account) => {
      const byClass = await listTrophies(account.id);
      const gold = byClass.reduce((sum, item) => sum + Number(item.gold), 0);
      const silver = byClass.reduce((sum, item) => sum + Number(item.silver), 0);
      const bronze = byClass.reduce((sum, item) => sum + Number(item.bronze), 0);
      return {
        accountId: account.id,
        email: account.email,
        gold,
        silver,
        bronze,
        total: gold + silver + bronze,
        byClass,
      };
    }),
  );
}

export async function setTrophies(accountId: number, payload: unknown): Promise<TrophyRecord> {
  const account = await requireAccount(accountId);
  if (userId !== undefined && Number(account.user_id) !== userId) {
    throw new ApiError(404, "NOT_FOUND", "That account no longer exists.");
  }
  const parsed = trophyUpdateSchema.parse(payload);
  const klass = parsed.class as TrophyClass;

  const db = await getTursoDb();
  const existing = (await db.execute({
    sql: `SELECT * FROM account_trophies WHERE account_id = ? AND class = ?`,
    args: [accountId, klass],
  })).rows[0] as unknown as TrophyRow | undefined;

  const stamp = now();
  await db.execute({
    sql: `INSERT INTO account_trophies (account_id, class, gold, silver, bronze, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (account_id, class)
     DO UPDATE SET gold = excluded.gold, silver = excluded.silver, bronze = excluded.bronze, updated_at = excluded.updated_at`,
    args: [accountId, klass, parsed.gold, parsed.silver, parsed.bronze, stamp],
  });

  const changes: FleetEvent["changes"] = {};
  const before = existing ?? { gold: 0, silver: 0, bronze: 0 };
  if (before.gold !== parsed.gold) changes.gold = { from: before.gold, to: parsed.gold };
  if (before.silver !== parsed.silver) changes.silver = { from: before.silver, to: parsed.silver };
  if (before.bronze !== parsed.bronze) changes.bronze = { from: before.bronze, to: parsed.bronze };

  if (Object.keys(changes).length > 0) {
    const label = TROPHY_CLASS_LABELS[klass];
    await logEvent(
      accountId,
      account.email,
      "trophies_updated",
      `Trophies updated for class ${label}`,
      changes,
    );
  }

  return {
    class: klass,
    gold: parsed.gold,
    silver: parsed.silver,
    bronze: parsed.bronze,
    total: Number(parsed.gold) + Number(parsed.silver) + Number(parsed.bronze),
    updatedAt: stamp,
  };
}

type CarRow = {
  id: number;
  account_id: number;
  car_code: number;
  game: GameType;
  notes: string;
  created_at: string;
};

function carNameFor(code: number, game: GameType): string {
  return carByCode(code, game)?.name ?? `UNKNOWN CODE ${code}`;
}

export async function listGarage(accountId: number, userId?: number): Promise<GarageSummary> {
  const account = await requireAccount(accountId, { includeArchived: true });
  if (userId !== undefined && Number(account.user_id) !== userId) {
    throw new ApiError(404, "NOT_FOUND", "That account no longer exists.");
  }
  const db = await getTursoDb();
  const rows = (await db.execute({
    sql: `SELECT * FROM account_cars WHERE account_id = ? ORDER BY id DESC`,
    args: [accountId],
  })).rows as unknown as CarRow[];

  const cars: CarRecord[] = rows.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    carCode: row.car_code,
    carName: carNameFor(row.car_code, row.game),
    game: row.game,
    notes: row.notes,
    addedAt: row.created_at,
  }));

  return {
    accountId: account.id,
    email: account.email,
    game: account.game,
    cars,
    count: cars.length,
    capacity: garageCapacity(account.game, {
      baseSlots: account.base_slots,
      slots: account.slots,
      newGarage: Number(account.new_garage) === 1,
    }),
  };
}

export async function fleetGarages(userId?: number): Promise<GarageSummary[]> {
  const accounts = await listAccounts({ archived: "include", userId });
  return Promise.all(accounts.map((account) => listGarage(account.id, userId)));
}

export async function carOwners(game: GameType, carCode: number, userId?: number): Promise<CarOwners> {
  const entry = carByCode(carCode, game);
  if (!entry) {
    throw new ApiError(404, "car_unknown", `No ${GAME_LABELS[game]} car has code #${carCode}.`);
  }

  type OwnerRow = { account_id: number; email: string; hits: number };
  const db = await getTursoDb();
  const rows = (await db.execute({
    sql: `SELECT a.id AS account_id, a.email AS email, COUNT(c.id) AS hits
         FROM account_cars c
         JOIN accounts a ON a.id = c.account_id
        WHERE c.game = ? AND c.car_code = ?
        GROUP BY a.id
        ORDER BY hits DESC, a.email ASC`,
    args: [game, carCode],
  })).rows as unknown as OwnerRow[];

  return {
    carCode,
    carName: entry.name,
    game,
    owners: rows.map((row) => ({
      accountId: row.account_id,
      email: row.email,
      game,
      count: row.hits,
    })),
  };
}

export async function addGarageCar(accountId: number, payload: unknown, userId?: number): Promise<CarRecord> {
  const account = await requireAccount(accountId);
  if (userId !== undefined && Number(account.user_id) !== userId) {
    throw new ApiError(404, "NOT_FOUND", "That account no longer exists.");
  }
  const parsed = carAssignSchema.parse(payload);
  const game = parsed.game ?? account.game;

  if (game !== account.game) {
    throw new ApiError(
      400,
      "car_game_mismatch",
      `This is a ${GAME_LABELS[account.game]} account, so only ${GAME_LABELS[account.game]} cars can be added. Got a ${GAME_LABELS[game]} car.`,
    );
  }

  const entry = carByCode(parsed.carCode, game);
  if (!entry) {
    throw new ApiError(
      400,
      "car_unknown",
      `No ${GAME_LABELS[game]} car with code ${parsed.carCode} in the catalog.`,
    );
  }

  const db = await getTursoDb();
  const owned = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM account_cars WHERE account_id = ?`,
    args: [accountId],
  });
  const ownedCount = Number((owned.rows[0] as { n: unknown }).n);

  if (!allowsDuplicateModels(game)) {
    const sameModel = await db.execute({
      sql: `SELECT COUNT(*) AS n FROM account_cars WHERE account_id = ? AND car_code = ?`,
      args: [accountId, parsed.carCode],
    });
    const sameCount = Number((sameModel.rows[0] as { n: unknown }).n);
    if (sameCount > 0) {
      throw new ApiError(
        400,
        "car_duplicate",
        `CPM1 holds one of each model — #${entry.code} ${entry.name} is already in this garage.`,
      );
    }
  }

  const capacity = garageCapacity(account.game, {
    baseSlots: account.base_slots,
    slots: account.slots,
    newGarage: Number(account.new_garage) === 1,
  });
  if (ownedCount >= capacity) {
    throw new ApiError(
      400,
      "garage_full",
      account.game === "cpm1"
        ? `Garage is full (${ownedCount}/${capacity}) — CPM1 holds one of every model in the game.`
        : `Garage is full (${ownedCount}/${capacity}). Unlock a slot or buy the new garage first.`,
    );
  }

  const stamp = now();
  const result = await db.execute({
    sql: `INSERT INTO account_cars (account_id, car_code, game, notes, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    args: [accountId, parsed.carCode, game, parsed.notes, stamp],
  });

  await logEvent(
    accountId,
    account.email,
    "car_added",
    `Added ${entry.name} (#${entry.code}) [${GAME_LABELS[game]}] to the garage`,
    { car: { from: null, to: `#${entry.code} ${entry.name}` } },
  );

  return {
    id: Number(result.lastInsertRowid),
    accountId,
    carCode: entry.code,
    carName: entry.name,
    game,
    notes: parsed.notes,
    addedAt: stamp,
  };
}

export async function removeGarageCar(accountId: number, carId: number, userId?: number): Promise<{ removed: number; carName: string }> {
  const account = await requireAccount(accountId);
  if (userId !== undefined && Number(account.user_id) !== userId) {
    throw new ApiError(404, "NOT_FOUND", "That account no longer exists.");
  }
  const db = await getTursoDb();
  const row = (await db.execute({
    sql: `SELECT * FROM account_cars WHERE id = ? AND account_id = ?`,
    args: [carId, accountId],
  })).rows[0] as unknown as CarRow | undefined;
  if (!row) {
    throw new ApiError(404, "car_not_found", "That car is not in this garage.");
  }

  const carName = carNameFor(row.car_code, row.game);
  await db.execute({
    sql: `DELETE FROM account_cars WHERE id = ?`,
    args: [carId],
  });

  await logEvent(
    accountId,
    account.email,
    "car_removed",
    `Removed ${carName} (#${row.car_code}) [${GAME_LABELS[row.game]}] from the garage`,
    { car: { from: `#${row.car_code} ${carName}`, to: null } },
  );

  return { removed: carId, carName };
}

export async function listEvents(userId?: number, limit = 100): Promise<FleetEvent[]> {
  const db = await getTursoDb();
  const rows = (await db.execute({
    sql: `SELECT * FROM account_events ORDER BY id DESC LIMIT ?`,
    args: [Math.min(Math.max(1, Math.trunc(limit) || 100), 500)],
  })).rows as unknown as EventRow[];

  return rows.map((row) => {
    let changes: FleetEvent["changes"] = {};
    try {
      changes = JSON.parse(row.changes) as FleetEvent["changes"];
    } catch {
      changes = {};
    }
    return {
      id: row.id,
      accountId: row.account_id,
      email: row.account_email,
      type: row.type as FleetEvent["type"],
      summary: row.summary,
      changes,
      createdAt: row.created_at,
    };
  });
}

export async function fleetStats(userId?: number): Promise<FleetStats> {
  const accounts = await listAccounts({ userId });
  return computeFleetStats(accounts);
}

export async function exportFleet(
  format: "csv" | "json",
  options: { confirmed?: boolean; userId?: number } = {},
): Promise<{ body: string; contentType: string; count: number }> {
  const accounts = await listAccounts({ userId: options.userId });

  if (!options.confirmed) {
    throw new ApiError(
      400,
      "EXPORT_CONFIRMATION_REQUIRED",
      `Export exposes ${accounts.length} account(s) including decrypted passwords. Confirm the export to continue.`,
    );
  }

  const rows = await Promise.all(
    accounts.map(async (account) => {
      const row = await requireAccount(account.id, { includeArchived: true });
      return { ...account, password: decryptSecret(row.password_enc) };
    }),
  );

  const body =
    format === "json"
      ? JSON.stringify({ exportedAt: now(), count: rows.length, accounts: rows }, null, 2)
      : [
          [
            "id",
            "email",
            "game",
            "password",
            "cash",
            "coins",
            "cars",
            "base_slots",
            "slots",
            "new_garage",
            "capacity",
            "coins_spent_on_cars",
            "notes",
            "created_at",
            "updated_at",
          ].join(","),
          ...rows.map((account) =>
            [
              account.id,
              account.email,
              account.game,
              account.password,
              account.cash,
              account.coins,
              account.cars,
              account.baseSlots,
              account.slots,
              account.newGarage ? 1 : 0,
              account.capacity,
              account.coinsSpentOnCars,
              account.notes,
              account.createdAt,
              account.updatedAt,
            ]
              .map(escapeCsvValue)
              .join(","),
          ),
        ].join("\n");

  await logEvent(
    null,
    "(fleet)",
    "export_performed",
    `Exported ${rows.length} account(s) as ${format.toUpperCase()} with decrypted passwords`,
    { format: { from: null, to: format }, accounts: { from: null, to: rows.length } },
  );

  return {
    body,
    contentType:
      format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
    count: rows.length,
  };
}

export async function importAccounts(payload: unknown, format: "csv" | "json", userId?: number): Promise<ImportReport> {
  let rawRows: unknown[];

  if (format === "csv") {
    if (typeof payload !== "string") {
      throw new ApiError(400, "IMPORT_PAYLOAD_INVALID", "CSV import expects a raw CSV body.");
    }
    rawRows = csvToRecords(payload);
  } else {
    const source = Array.isArray(payload)
      ? payload
      : payload && typeof payload === "object" && Array.isArray((payload as { accounts?: unknown[] }).accounts)
        ? (payload as { accounts: unknown[] }).accounts
        : null;
    if (!source) {
      throw new ApiError(
        400,
        "IMPORT_PAYLOAD_INVALID",
        "JSON import expects an array of accounts (or { accounts: [...] }).",
      );
    }
    rawRows = source;
  }

  if (rawRows.length > LIMITS.MAX_IMPORT_ROWS) {
    throw new ApiError(
      400,
      "IMPORT_TOO_LARGE",
      `Import is capped at ${LIMITS.MAX_IMPORT_ROWS} rows per request (got ${rawRows.length}).`,
    );
  }

  const results: ImportRowResult[] = [];

  for (const [index, raw] of rawRows.entries()) {
    const rowNumber = index + 1;
    const normalized = normalizeImportRow(raw);
    const email = typeof normalized.email === "string" ? normalized.email : undefined;

    try {
      const account = await createAccount(normalized);
      results.push({ row: rowNumber, email: account.email, status: "created" });
    } catch (err) {
      if (err instanceof ApiError) {
        results.push({
          row: rowNumber,
          email,
          status: err.code === "EMAIL_TAKEN" ? "skipped" : "failed",
          code: err.code,
          message: err.message,
        });
        continue;
      }

      if (err instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const issue of err.issues) {
          const key = issue.path.length ? issue.path.join(".") : "form";
          if (!fields[key]) fields[key] = issue.message;
        }
        results.push({
          row: rowNumber,
          email,
          status: "failed",
          code: "VALIDATION_FAILED",
          message: "Some fields need attention.",
          fields,
        });
        continue;
      }

      throw err;
    }
  }

  return {
    total: results.length,
    created: results.filter((row) => row.status === "created").length,
    skipped: results.filter((row) => row.status === "skipped").length,
    failed: results.filter((row) => row.status === "failed").length,
    results,
  };
}

// ---------------------------------------------------------------- users

export async function getUserByTelegramId(telegramUserId: number) {
  const db = await getTursoDb();
  const row = await db.execute({
    sql: `SELECT * FROM users WHERE telegram_user_id = ? LIMIT 1`,
    args: [telegramUserId],
  });
  return (row.rows[0] as unknown as UserRow | undefined) ?? null;
}

export async function getUserByEmail(email: string) {
  const db = await getTursoDb();
  const row = await db.execute({
    sql: `SELECT * FROM users WHERE email = ? COLLATE NOCASE LIMIT 1`,
    args: [email],
  });
  return (row.rows[0] as unknown as UserRow | undefined) ?? null;
}

export async function createUser(email: string, password: string) {
  const existing = await getUserByEmail(email);
  if (existing) {
    throw new ApiError(409, "EMAIL_TAKEN", "That email is already registered.");
  }

  const db = await getTursoDb();
  const stamp = new Date().toISOString();
  const password_hash = scryptHash(password);
  const result = await db.execute({
    sql: `INSERT INTO users (email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    args: [email.toLowerCase(), password_hash, stamp, stamp],
  });
  const id = Number(result.lastInsertRowid);
  return { id, email: email.toLowerCase(), password_hash, createdAt: stamp, updatedAt: stamp };
}

export async function verifyUserCredentials(email: string, password: string) {
  const user = await getUserByEmail(email);
  if (!user) return null;
  if (!(await scryptCompare(password, user.password_hash))) return null;
  return user;
}

export async function bindUserTelegram(userId: number, telegramUserId: number) {
  const db = await getTursoDb();
  const row = await db.execute({
    sql: `SELECT id FROM users WHERE id = ?`,
    args: [userId],
  });
  if (!row.rows[0]) {
    throw new ApiError(404, "USER_NOT_FOUND", "That user does not exist.");
  }
  await db.execute({
    sql: `UPDATE users SET telegram_user_id = ?, updated_at = ? WHERE id = ?`,
    args: [telegramUserId, new Date().toISOString(), userId],
  });
}