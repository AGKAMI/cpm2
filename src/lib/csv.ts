/**
 * Minimal CSV helpers (RFC-4180 style quoting) used by the export and the
 * bulk-import path. Kept dependency-free on purpose.
 */

/** Splits raw CSV text into rows of cells, honouring quoted fields. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const source = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((cell) => cell.trim().length > 0));
}

/** Parses CSV text into records keyed by the header row (case-insensitive). */
export function csvToRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = (row[index] ?? "").trim();
    });
    return record;
  });
}

/** Quotes a single CSV cell. */
export function escapeCsvValue(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

const NUMERIC_FIELDS = [
  "cash",
  "coins",
  "cars",
  "baseSlots",
  "base_slots",
  "slots",
  "coinsSpentOnCars",
  "coins_spent_on_cars",
] as const;

/**
 * Normalises an imported row before validation: trims strings, coerces
 * numeric strings ("25,000" / " 1200 ") into numbers and leaves anything
 * unparsable untouched so the zod schema can report it.
 */
export function normalizeImportRow(row: unknown): Record<string, unknown> {
  if (!row || typeof row !== "object") return {};
  const source = row as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...source };

  // CSV exports use snake_case headers (coins_spent_on_cars); the zod schema
  // expects camelCase — alias it so both shapes import cleanly.
  if ("coins_spent_on_cars" in normalized && !("coinsSpentOnCars" in normalized)) {
    normalized.coinsSpentOnCars = normalized.coins_spent_on_cars;
    delete normalized.coins_spent_on_cars;
  }
  if ("base_slots" in normalized && !("baseSlots" in normalized)) {
    normalized.baseSlots = normalized.base_slots;
    delete normalized.base_slots;
  }

  for (const field of NUMERIC_FIELDS) {
    const value = normalized[field];
    if (typeof value === "string") {
      const cleaned = value.replace(/[\s,_]/g, "");
      if (cleaned === "") {
        normalized[field] = 0;
        continue;
      }
      const parsed = Number(cleaned);
      normalized[field] = Number.isFinite(parsed) ? parsed : value;
    }
  }

  if (typeof normalized.email === "string") normalized.email = normalized.email.trim();
  if (typeof normalized.password !== "string") delete normalized.password;
  if (typeof normalized.notes !== "string") delete normalized.notes;

  // `game` must be absent, not blank, when unspecified — the zod default only
  // applies to an ABSENT key, so an empty CSV cell ("") would fail the enum
  // instead of falling back to cpm2. Trim + lowercase so "CPM1" also lands.
  if ("game" in normalized) {
    if (typeof normalized.game === "string") {
      const game = normalized.game.trim().toLowerCase();
      if (game === "") delete normalized.game;
      else normalized.game = game;
    } else {
      delete normalized.game;
    }
  }

  return normalized;
}
