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

const NUMERIC_FIELDS = ["cash", "coins", "cars", "slots"] as const;

/**
 * Normalises an imported row before validation: trims strings, coerces
 * numeric strings ("25,000" / " 1200 ") into numbers and leaves anything
 * unparsable untouched so the zod schema can report it.
 */
export function normalizeImportRow(row: unknown): Record<string, unknown> {
  if (!row || typeof row !== "object") return {};
  const source = row as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...source };

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

  return normalized;
}
