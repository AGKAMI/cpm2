import { ZodError } from "zod";
import { ApiError } from "./api.ts";
import {
  LIMITS,
  TROPHY_CLASSES,
  TROPHY_CLASS_LABELS,
  carCapacity,
  slotsLockedValue,
  type TrophyClass,
} from "./constants.ts";
import { carByCode } from "./car-catalog.ts";
import { csvToRecords, escapeCsvValue, normalizeImportRow } from "./csv.ts";
import { decryptSecret, encryptSecret } from "./crypto.ts";
import { getDb, type AccountRow, type EventRow } from "./db.ts";
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
  "cash",
  "coins",
  "cars",
  "baseSlots",
  "slots",
  "coinsSpentOnCars",
  "notes",
] as const;

function toSummary(row: AccountRow): AccountSummary {
  return {
    id: row.id,
    email: row.email,
    cash: row.cash,
    coins: row.coins,
    cars: row.cars,
    baseSlots: row.base_slots,
    slots: row.slots,
    capacity: carCapacity(row.base_slots, row.slots),
    slotsValue: slotsLockedValue(row.slots),
    coinsSpentOnCars: row.coins_spent_on_cars,
    notes: row.notes,
    archived: Boolean(row.archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function now(): string {
  return new Date().toISOString();
}

/** The activity log is capped so the table can never grow unbounded. */
const EVENT_RETENTION = 10_000;

function logEvent(
  accountId: number | null,
  email: string,
  type: FleetEvent["type"],
  summary: string,
  changes: Record<string, { from: unknown; to: unknown }> = {},
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO account_events (account_id, account_email, type, summary, changes, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(accountId, email, type, summary, JSON.stringify(changes), now());

  // retention: keep only the newest EVENT_RETENTION rows
  db.prepare(
    `DELETE FROM account_events WHERE id <= (
       SELECT id FROM account_events ORDER BY id DESC LIMIT 1 OFFSET ?
     )`,
  ).run(EVENT_RETENTION - 1);
}

function requireAccount(id: number, options: { includeArchived?: boolean } = {}): AccountRow {
  const row = getDb().prepare(`SELECT * FROM accounts WHERE id = ?`).get(id) as AccountRow | undefined;
  if (!row) throw new ApiError(404, "NOT_FOUND", "That account no longer exists.");
  if (!options.includeArchived && row.archived) {
    throw new ApiError(404, "NOT_FOUND", "That account is archived. Restore it before making changes.");
  }
  return row;
}

function assertEmailFree(email: string, exceptId?: number): void {
  const row = getDb()
    .prepare(`SELECT id, archived FROM accounts WHERE email = ? COLLATE NOCASE AND id IS NOT ?`)
    .get(email, exceptId ?? -1) as { id: number; archived: number } | undefined;
  if (row) {
    throw new ApiError(
      409,
      "EMAIL_TAKEN",
      row.archived
        ? `${email} is tracked but archived — restore it instead of adding it again.`
        : `${email} is already tracked.`,
    );
  }
}

export type ArchiveFilter = "exclude" | "only" | "include";

export function listAccounts(options: { archived?: ArchiveFilter } = {}): AccountSummary[] {
  const mode = options.archived ?? "exclude";
  const rows = (
    mode === "include"
      ? getDb().prepare(`SELECT * FROM accounts ORDER BY datetime(created_at) DESC, id DESC`)
      : mode === "only"
        ? getDb().prepare(`SELECT * FROM accounts WHERE archived = 1 ORDER BY datetime(created_at) DESC, id DESC`)
        : getDb().prepare(`SELECT * FROM accounts WHERE archived = 0 ORDER BY datetime(created_at) DESC, id DESC`)
  ).all() as AccountRow[];
  return rows.map(toSummary);
}

export function getAccount(id: number): AccountSummary {
  return toSummary(requireAccount(id));
}

export function createAccount(payload: unknown): AccountSummary {
  const input: AccountCreateInput = accountCreateSchema.parse(payload);
  assertEmailFree(input.email);

  const db = getDb();
  const stamp = now();

  const insert = db.prepare(
    `INSERT INTO accounts
       (email, password_enc, cash, coins, cars, base_slots, slots, notes,
        coins_spent_on_cars, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
  );

  const created = db.transaction(() => {
    const result = insert.run(
      input.email,
      encryptSecret(input.password),
      input.cash,
      input.coins,
      input.cars,
      input.baseSlots,
      input.slots,
      input.notes,
      input.coinsSpentOnCars,
      stamp,
      stamp,
    );
    const id = Number(result.lastInsertRowid);
    logEvent(id, input.email, "created", "Account added to the fleet", {
      cash: { from: 0, to: input.cash },
      coins: { from: 0, to: input.coins },
      cars: { from: 0, to: input.cars },
      baseSlots: { from: 0, to: input.baseSlots },
      slots: { from: 0, to: input.slots },
    });
    return id;
  })();

  return getAccount(created);
}

export function updateAccount(id: number, payload: unknown): AccountSummary {
  const patch: AccountPatchInput = accountPatchSchema.parse(payload);
  const existing = requireAccount(id);

  // The slot economy lives in exactly one place: buying a slot costs coins.
  // A PATCH may therefore never hand out slots for free.
  if (patch.slots !== undefined && patch.slots > existing.slots) {
    throw new ApiError(
      422,
      "SLOTS_PURCHASE_ONLY",
      `Extra slots can only be bought: POST /api/accounts/${id}/slots charges ${LIMITS.SLOT_COST_COINS} coins per slot (this account holds ${existing.coins} coins).`,
    );
  }

  const next = {
    email: patch.email ?? existing.email,
    cash: patch.cash ?? existing.cash,
    coins: patch.coins ?? existing.coins,
    cars: patch.cars ?? existing.cars,
    baseSlots: patch.baseSlots ?? existing.base_slots,
    slots: patch.slots ?? existing.slots,
    coinsSpentOnCars: patch.coinsSpentOnCars ?? existing.coins_spent_on_cars,
    notes: patch.notes ?? existing.notes,
  };

  const capacity = carCapacity(next.baseSlots, next.slots);
  if (next.cars > capacity) {
    throw new ApiError(
      422,
      "CAR_CAPACITY_EXCEEDED",
      `${next.cars} cars need more room — this garage holds ${capacity} (${next.baseSlots} base + ${next.slots} extra slot(s)).`,
    );
  }

  if (next.email.toLowerCase() !== existing.email.toLowerCase()) {
    assertEmailFree(next.email, id);
  }

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of TRACKED_FIELDS) {
    // AccountRow stores the ledger snake_case (coins_spent_on_cars); the patch
    // summary speaks camelCase. Map before diffing so both sides resolve.
    const before =
      field === "coinsSpentOnCars"
        ? existing.coins_spent_on_cars
        : field === "baseSlots"
          ? existing.base_slots
          : existing[field];
    const after = next[field];
    if (before !== after) changes[field] = { from: before, to: after };
  }

  const removedSlots = existing.slots - next.slots;
  const baseChanged = existing.base_slots !== next.baseSlots;
  const eventType: FleetEvent["type"] = removedSlots > 0 ? "slots_removed" : "updated";
  const summary =
    removedSlots > 0
      ? `Removed ${removedSlots} car slot(s) — the game does not refund slot coins`
      : baseChanged
        ? `Base garage size set to ${next.baseSlots}`
        : "Account details updated";

  const db = getDb();
  db.transaction(() => {
    db.prepare(
      `UPDATE accounts
         SET email = ?, password_enc = ?, cash = ?, coins = ?, cars = ?, base_slots = ?, slots = ?, notes = ?, coins_spent_on_cars = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      next.email,
      patch.password !== undefined ? encryptSecret(patch.password) : existing.password_enc,
      next.cash,
      next.coins,
      next.cars,
      next.baseSlots,
      next.slots,
      next.notes,
      next.coinsSpentOnCars,
      now(),
      id,
    );
    logEvent(id, next.email, eventType, summary, changes);
  })();

  return getAccount(id);
}

/**
 * Soft delete — the row stays in the database (archived = 1) so a misclick can
 * be undone with `restoreAccount`. Nothing is destroyed.
 */
export function archiveAccount(id: number): { id: number; email: string } {
  const existing = requireAccount(id, { includeArchived: true });
  if (existing.archived) return { id, email: existing.email };

  const db = getDb();
  db.transaction(() => {
    db.prepare(`UPDATE accounts SET archived = 1, updated_at = ? WHERE id = ?`).run(now(), id);
    logEvent(id, existing.email, "archived", "Account archived — balances kept, nothing destroyed", {
      cash: { from: existing.cash, to: existing.cash },
      coins: { from: existing.coins, to: existing.coins },
      cars: { from: existing.cars, to: existing.cars },
    });
  })();

  return { id, email: existing.email };
}

/** Brings an archived account back into the fleet. */
export function restoreAccount(id: number): AccountSummary {
  const existing = requireAccount(id, { includeArchived: true });
  if (!existing.archived) return toSummary(existing);

  const db = getDb();
  db.transaction(() => {
    db.prepare(`UPDATE accounts SET archived = 0, updated_at = ? WHERE id = ?`).run(now(), id);
    logEvent(id, existing.email, "updated", "Account restored from the archive", {
      archived: { from: true, to: false },
    });
  })();

  return getAccount(id);
}

/** Buys `count` extra car slots, spending coins from the account balance. */
export function purchaseSlots(id: number, payload: unknown): AccountSummary {
  const { count } = slotPurchaseSchema.parse(payload ?? { count: 1 });
  const existing = requireAccount(id);

  if (existing.slots + count > LIMITS.MAX_PURCHASED_SLOTS) {
    throw new ApiError(
      422,
      "SLOT_LIMIT_REACHED",
      `An account can hold ${LIMITS.MAX_PURCHASED_SLOTS} extra slots max (this one already has ${existing.slots}).`,
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

  const db = getDb();
  db.transaction(() => {
    db.prepare(
      `UPDATE accounts SET coins = coins - ?, slots = slots + ?, updated_at = ? WHERE id = ?`,
    ).run(cost, count, now(), id);
    logEvent(id, existing.email, "slots_purchased", `Bought ${count} car slot(s) for ${cost} coins`, {
      coins: { from: existing.coins, to: existing.coins - cost },
      slots: { from: existing.slots, to: existing.slots + count },
    });
  })();

  return getAccount(id);
}

/** Decrypts and returns the stored password for a single account. */
export function revealPassword(id: number): { id: number; email: string; password: string } {
  const existing = requireAccount(id);
  try {
    const password = decryptSecret(existing.password_enc);
    logEvent(id, existing.email, "password_revealed", "Password revealed for viewing");
    return { id, email: existing.email, password };
  } catch (err) {
    throw new ApiError(
      500,
      "DECRYPT_FAILED",
      err instanceof Error ? err.message : "Password could not be decrypted.",
    );
  }
}

/* ------------------------------------------------------------------ */
/* Drag racing trophies                                                */
/* ------------------------------------------------------------------ */

type TrophyRow = {
  account_id: number;
  class: string;
  gold: number;
  silver: number;
  bronze: number;
  updated_at: string;
};

function toTrophyRecord(row: TrophyRow): TrophyRecord {
  return {
    class: row.class,
    gold: row.gold,
    silver: row.silver,
    bronze: row.bronze,
    total: row.gold + row.silver + row.bronze,
    updatedAt: row.updated_at,
  };
}

/** Every class for one account, including the ones with no trophies yet. */
export function listTrophies(accountId: number): TrophyRecord[] {
  requireAccount(accountId, { includeArchived: true });
  const rows = getDb()
    .prepare(`SELECT * FROM account_trophies WHERE account_id = ?`)
    .all(accountId) as TrophyRow[];

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

/** Trophy totals for one account. */
export function trophySummary(accountId: number): TrophySummary {
  const account = requireAccount(accountId, { includeArchived: true });
  const byClass = listTrophies(accountId);
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

/** Trophy totals for the whole fleet, one entry per account. */
export function fleetTrophySummary(): TrophySummary[] {
  const accounts = listAccounts({ archived: "include" });
  return accounts.map((account) => {
    const byClass = listTrophies(account.id);
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
  });
}

/** Sets the trophy counts for one class of one account. */
export function setTrophies(accountId: number, payload: unknown): TrophyRecord {
  const account = requireAccount(accountId);
  const parsed = trophyUpdateSchema.parse(payload);
  const klass = parsed.class as TrophyClass;

  const db = getDb();
  const existing = db
    .prepare(`SELECT * FROM account_trophies WHERE account_id = ? AND class = ?`)
    .get(accountId, klass) as TrophyRow | undefined;

  const stamp = now();
  db.prepare(
    `INSERT INTO account_trophies (account_id, class, gold, silver, bronze, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (account_id, class)
     DO UPDATE SET gold = excluded.gold, silver = excluded.silver, bronze = excluded.bronze, updated_at = excluded.updated_at`,
  ).run(accountId, klass, parsed.gold, parsed.silver, parsed.bronze, stamp);

  const changes: FleetEvent["changes"] = {};
  const before = existing ?? { gold: 0, silver: 0, bronze: 0 };
  if (before.gold !== parsed.gold) changes.gold = { from: before.gold, to: parsed.gold };
  if (before.silver !== parsed.silver) changes.silver = { from: before.silver, to: parsed.silver };
  if (before.bronze !== parsed.bronze) changes.bronze = { from: before.bronze, to: parsed.bronze };

  if (Object.keys(changes).length > 0) {
    const label = TROPHY_CLASS_LABELS[klass];
    logEvent(
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
    total: parsed.gold + parsed.silver + parsed.bronze,
    updatedAt: stamp,
  };
}

/* ------------------------------------------------------------------ */
/* Garage inventory (per-account car lists from the static catalog)    */
/* ------------------------------------------------------------------ */

type CarRow = {
  id: number;
  account_id: number;
  car_code: number;
  notes: string;
  created_at: string;
};

/** Every car in one account's garage, newest first, names joined from the catalog. */
export function listGarage(accountId: number): GarageSummary {
  const account = requireAccount(accountId, { includeArchived: true });
  const rows = getDb()
    .prepare(`SELECT * FROM account_cars WHERE account_id = ? ORDER BY id DESC`)
    .all(accountId) as CarRow[];

  const cars: CarRecord[] = rows.map((row) => {
    const entry = carByCode(row.car_code);
    return {
      id: row.id,
      accountId: row.account_id,
      carCode: row.car_code,
      carName: entry?.name ?? `UNKNOWN CODE ${row.car_code}`,
      notes: row.notes,
      addedAt: row.created_at,
    };
  });

  return {
    accountId: account.id,
    email: account.email,
    cars,
    count: cars.length,
    capacity: carCapacity(account.base_slots, account.slots),
  };
}

/** Garages for the whole fleet (overview page). */
export function fleetGarages(): GarageSummary[] {
  const accounts = listAccounts({ archived: "include" });
  return accounts.map((account) => listGarage(account.id));
}

/**
 * Adds one catalog car to one account's garage.
 * Fails loudly when the code is not in the catalog or the garage is full.
 * The same code can be added more than once (the game allows duplicate models).
 */
export function addGarageCar(accountId: number, payload: unknown): CarRecord {
  const account = requireAccount(accountId);
  const parsed = carAssignSchema.parse(payload);
  const entry = carByCode(parsed.carCode);
  if (!entry) {
    throw new ApiError(400, "car_unknown", `No car with code ${parsed.carCode} in the catalog.`);
  }

  const db = getDb();
  const owned = db
    .prepare(`SELECT COUNT(*) AS n FROM account_cars WHERE account_id = ?`)
    .get(accountId) as { n: number };
  const capacity = carCapacity(account.base_slots, account.slots);
  if (owned.n >= capacity) {
    throw new ApiError(400, "garage_full", `Garage is full (${owned.n}/${capacity}). Buy more slots first.`);
  }

  const stamp = now();
  const result = db
    .prepare(
      `INSERT INTO account_cars (account_id, car_code, notes, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(accountId, parsed.carCode, parsed.notes, stamp);

  logEvent(
    accountId,
    account.email,
    "car_added",
    `Added ${entry.name} (#${entry.code}) to the garage`,
    { car: { from: null, to: `#${entry.code} ${entry.name}` } },
  );

  return {
    id: Number(result.lastInsertRowid),
    accountId,
    carCode: entry.code,
    carName: entry.name,
    notes: parsed.notes,
    addedAt: stamp,
  };
}

/** Removes one car from one account's garage by its inventory row id. */
export function removeGarageCar(accountId: number, carId: number): { removed: number; carName: string } {
  const account = requireAccount(accountId);
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM account_cars WHERE id = ? AND account_id = ?`)
    .get(carId, accountId) as CarRow | undefined;
  if (!row) {
    throw new ApiError(404, "car_not_found", "That car is not in this garage.");
  }

  const entry = carByCode(row.car_code);
  const carName = entry?.name ?? `UNKNOWN CODE ${row.car_code}`;
  db.prepare(`DELETE FROM account_cars WHERE id = ?`).run(carId);

  logEvent(
    accountId,
    account.email,
    "car_removed",
    `Removed ${carName} (#${row.car_code}) from the garage`,
    { car: { from: `#${row.car_code} ${carName}`, to: null } },
  );

  return { removed: carId, carName };
}

export function listEvents(limit = 100): FleetEvent[] {
  const rows = getDb()
    .prepare(`SELECT * FROM account_events ORDER BY id DESC LIMIT ?`)
    .all(Math.min(Math.max(1, Math.trunc(limit) || 100), 500)) as EventRow[];

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

export function fleetStats(accounts = listAccounts()): FleetStats {
  return computeFleetStats(accounts);
}

/**
 * Plain-text export of the whole fleet (passwords included) for backups.
 * Guarded by an explicit confirmation — the export exposes every credential.
 */
export function exportFleet(
  format: "csv" | "json",
  options: { confirmed?: boolean } = {},
): { body: string; contentType: string; count: number } {
  const accounts = listAccounts();

  if (!options.confirmed) {
    throw new ApiError(
      400,
      "EXPORT_CONFIRMATION_REQUIRED",
      `Export exposes ${accounts.length} account(s) including decrypted passwords. Confirm the export to continue.`,
    );
  }

  const rows = accounts.map((account) => {
    const row = requireAccount(account.id, { includeArchived: true });
    return { ...account, password: decryptSecret(row.password_enc) };
  });

  const body =
    format === "json"
      ? JSON.stringify({ exportedAt: now(), count: rows.length, accounts: rows }, null, 2)
      : [
          [
            "id",
            "email",
            "password",
            "cash",
            "coins",
            "cars",
            "base_slots",
            "slots",
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
              account.password,
              account.cash,
              account.coins,
              account.cars,
              account.baseSlots,
              account.slots,
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

  logEvent(
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

/**
 * Bulk import. Every row goes through the exact same zod schema as a manual
 * create, so bad rows are reported instead of poisoning the database.
 */
export function importAccounts(payload: unknown, format: "csv" | "json"): ImportReport {
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
      const account = createAccount(normalized);
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
