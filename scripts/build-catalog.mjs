// Generator: rebuilds src/lib/car-catalog.ts with the game dimension.
// IDEMPOTENT — safe to re-run any number of times.
//
// WHY THIS EXISTS: car codes are NOT unique across CPM1 and CPM2. The same
// integer is a completely different car in each game (CPM1 #13 = 2007 Peugeot
// 308, CPM2 #13 = HONDA CIVIC). A single code-keyed catalog silently
// corrupted existing fleet data, so every entry now carries `game`.
//
// ⚠️  THE 208 CPM2 ENTRIES ARE READ FROM GIT, NOT FROM THE OUTPUT FILE.
// `git show HEAD:src/lib/car-catalog.ts` pins the untouched original. Parsing
// the output instead reads back our own game-tagged arrays, matches nothing,
// and silently emits ZERO CPM2 cars on the second run. Never read the file
// this script writes.
//
// Inputs:  scripts/cpm1_cars_raw.txt      (KAMI's CPM1 sheet, verbatim)
//          git HEAD src/lib/car-catalog.ts (the 208 CPM2 entries, pinned)
// Output:  src/lib/car-catalog.ts
//
// Names are uppercased verbatim from the source. This script does NOT repair
// typos or renumber codes — anomalies are logged to the catalog header so
// they are visible in code review instead of silently "fixed".
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, "..");
const CPM1_RAW = path.join(here, "cpm1_cars_raw.txt");
const CATALOG = path.join(REPO, "src", "lib", "car-catalog.ts");
const EXPECTED_CPM2 = 208;

/* ---------- 1. parse the existing CPM2 catalog out of car-catalog.ts ---------- */
function parseExistingCpm2(source) {
  const out = [];
  // The committed catalog is game-tagged, so read tagged CPM2 entries first.
  // A pristine un-tagged file was 100% CPM2, so fall back to the loose match
  // there. Without the tagged pass this function reads ZERO entries forever
  // (the git-HEAD pin reads back our own tagged output) and the build FATALs.
  const tagged = /\{\s*code:\s*(\d+),\s*name:\s*"([^"]*)"\s*,\s*game:\s*"cpm2"\s*\}/g;
  let m;
  while ((m = tagged.exec(source)) !== null) out.push({ code: Number(m[1]), name: m[2] });
  if (out.length === 0) {
    const loose = /\{\s*code:\s*(\d+),\s*name:\s*"([^"]*)"\s*\}/g;
    while ((m = loose.exec(source)) !== null) out.push({ code: Number(m[1]), name: m[2] });
  }
  return out;
}

/* ---------- 2. parse KAMI's CPM1 sheet ---------- */
// Line shape:  <code> <name...> <price> <hp> <torque> <gears> <mass> <cd> <turbo>
// Price is 1-2 tokens: "15,000" | "1000 Coins" | "21.000" | "2500"
// Parsed from the RIGHT so the trailing 7 stat fields anchor the split.
function parseCpm1(raw) {
  const rows = [];
  const anomalies = [];

  const lines = raw.split("\n");
  for (const lineNo of lines.keys()) {
    const rawLine = lines[lineNo];
    const line = rawLine.trim();
    if (!line) continue;

    const tokens = line.split(/\s+/);
    if (tokens.length < 10) {
      anomalies.push(`line ${lineNo + 1}: too few fields to parse -> ${line}`);
      continue;
    }

    const code = Number(tokens[0]);
    if (!Number.isInteger(code)) {
      anomalies.push(`line ${lineNo + 1}: code is not an integer -> ${line}`);
      continue;
    }

    // last 6 tokens = hp, torque, gears, mass, cd, turbo
    const tail = tokens.slice(-6);
    const nums = tail.map((t) => Number(t.replace(/,/g, "")));
    if (!nums.every((n) => Number.isFinite(n))) {
      anomalies.push(`line ${lineNo + 1}: stat tail is not numeric -> ${line}`);
      continue;
    }
    const [hp, torque, gears, mass, cd, turbo] = nums;

    // The 6 stat fields (hp, torque, gears, mass, cd, turbo) anchor the END of
    // the line, so name + price are resolved by walking BACKWARD from there.
    // Price is "<number>" OR "<number> Coins" — the Coins variant spans TWO
    // tokens, so when the token before the stat tail is the word "Coins" the
    // real price number sits one further left. Getting this wrong makes
    // priceNum read "Coins", which is not numeric.
    let priceIdx = tokens.length - 7;
    const isCoins = tokens[priceIdx] === "Coins";
    if (isCoins) priceIdx -= 1;
    const priceNum = tokens[priceIdx];
    if (priceNum === undefined || !Number.isFinite(Number(priceNum.replace(/,/g, "")))) {
      anomalies.push(`line ${lineNo + 1}: price not numeric -> ${line}`);
      continue;
    }
    const price = isCoins ? `${priceNum} Coins` : priceNum;
    // Name runs from just after the code up to (not including) the price
    // number. "Coins" sits ABOVE the price on the same side, so it is already
    // outside this slice.
    const name = tokens.slice(1, priceIdx).join(" ");

    if (!name) {
      anomalies.push(`line ${lineNo + 1}: empty name -> ${line}`);
      continue;
    }

    rows.push({
      code,
      name: name.toUpperCase().replace(/\s+/g, " ").trim(),
      price,
      hp,
      torque,
      gears,
      mass,
      cd,
      turbo,
    });
  }
  return { rows, anomalies };
}

/* ---------- 3. structural checks on the CPM1 sheet ---------- */
function structuralReport(rows) {
  const findings = [];
  const codes = rows.map((r) => r.code);
  const counts = new Map();
  for (const c of codes) counts.set(c, (counts.get(c) ?? 0) + 1);
  for (const [c, n] of counts) {
    if (n > 1) findings.push(`duplicate code ${c} appears ${n}x`);
  }

  // Gaps are only meaningful across the run's true span. The sheet holds
  // codes 1-110, a gap, then 115-210, with one stray typo (1114) far above
  // the sequence. Measuring from the smallest to the largest code spans
  // that stray and reports hundreds of phantom gaps, making a near-complete
  // list look broken.
  //
  // A stray is any code more than one step clear of the dense band. The band
  // is [min, 2nd-largest], so 209/210 stay inside it and only 1114 is a stray.
  const sorted = [...new Set(codes)].sort((a, b) => a - b);
  const nearMax = sorted[sorted.length - 2];
  const outliers = sorted.filter((c) => c > nearMax + 1);
  const inBand = sorted.filter((c) => !outliers.includes(c));
  const runMin = inBand[0];
  const runMax = inBand[inBand.length - 1];
  const present = new Set(inBand);
  const gaps = [];
  for (let c = runMin; c <= runMax; c += 1) if (!present.has(c)) gaps.push(c);

  return {
    min: runMin,
    max: runMax,
    outliers,
    total: rows.length,
    gaps,
    findings,
  };
}

/* ---------- main ---------- */
const cpm1Raw = fs.readFileSync(CPM1_RAW, "utf8");
// Pinned to the committed original — see the warning in the file header.
const cpm2 = parseExistingCpm2(
  execFileSync("git", ["show", "HEAD:src/lib/car-catalog.ts"], { cwd: REPO, encoding: "utf8" }),
);
if (cpm2.length !== EXPECTED_CPM2) {
  console.error(
    `FATAL: expected ${EXPECTED_CPM2} CPM2 entries from git HEAD, parsed ${cpm2.length}.`,
  );
  console.error("       The committed catalog may have changed — verify it before regenerating.");
  process.exit(1);
}
const { rows: cpm1, anomalies: parseAnomalies } = parseCpm1(cpm1Raw);
const report = structuralReport(cpm1);

const colliding = cpm1.filter((r) => cpm2.some((c) => c.code === r.code));

const CPM2_LIST = cpm2.map((c) => `  { code: ${c.code}, name: ${JSON.stringify(c.name)}, game: "cpm2" },`);
const CPM1_LIST = cpm1.map((c) => `  { code: ${c.code}, name: ${JSON.stringify(c.name)}, game: "cpm1" },`);

const collisionSample = colliding
  .slice(0, 6)
  .map((r) => {
    const other = cpm2.find((c) => c.code === r.code);
    return `//   #${String(r.code).padStart(4)}  CPM1 ${r.name.padEnd(34)} vs CPM2 ${other.name}`;
  })
  .join("\n");

const gapNote = report.gaps.length
  ? `// Codes absent from KAMI's CPM1 sheet inside the ${report.min}-${report.max} run: ${report.gaps.join(", ")}.`
  : `// CPM1 codes form a complete run from ${report.min} to ${report.max}.`;

const outlierNote = report.outliers.length
  ? `// Code(s) outside that run, preserved verbatim (not renumbered — renumbering would shift every later code): ${report.outliers.join(", ")}.`
  : "";

const file = `// Car catalog for BOTH games. Generated by scripts/build-catalog.mjs — do not hand-edit
// the arrays; re-run the generator instead. Append new cars at the end of a game block.
//
// ⚠️  CAR CODES ARE NOT UNIQUE ACROSS GAMES.
// The same integer is a different car in each game, so EVERY lookup carries a
// game discriminator. ${colliding.length} of the ${cpm1.length} CPM1 codes also
// exist in CPM2 and resolve to a different car:
${collisionSample}
// ... and ${colliding.length - 6} more. Look up with carByCode(code, game) — never
// by code alone — or the wrong car is returned with no error.
//
// Source data (KAMI, 2026-10-24): CPM2 list of ${cpm2.length} codes, CPM1 list of ${cpm1.length} codes.
${gapNote}
${outlierNote}
// Sheet anomalies preserved VERBATIM (never silently "fixed" — repair needs
// KAMI's ruling, and guessing would shift every later code):
${parseAnomalies.length ? parseAnomalies.map((a) => `//   - ${a}`).join("\n") : "//   (none — every sheet row parsed cleanly)"}
//   - CPM1 #29 name carries "35T" where a model year belongs (source text kept as-is).
import { GAME_LABELS, type GameType } from "./constants.ts";

export type CarEntry = { code: number; name: string; game: GameType };

export const CAR_CATALOG: CarEntry[] = [
${CPM1_LIST.join("\n")}
${CPM2_LIST.join("\n")}
];

const BY_GAME_CODE: Record<GameType, Map<number, CarEntry>> = {
  cpm1: new Map(),
  cpm2: new Map(),
};

for (const entry of CAR_CATALOG) {
  BY_GAME_CODE[entry.game].set(entry.code, entry);
}

/** Human label for a game discriminator ("CPM1" / "CPM2"). */
export function gameLabel(game: GameType): string {
  return GAME_LABELS[game];
}

/** Exact lookup inside ONE game. Undefined when that game has no such code. */
export function carByCode(code: number, game: GameType): CarEntry | undefined {
  return BY_GAME_CODE[game].get(code);
}

/**
 * Every car sharing a code across both games. Use when the game is not yet
 * known — a code with two entries is ambiguous and must be disambiguated by
 * the caller, never silently resolved to one of them.
 */
export function carsByCode(code: number): CarEntry[] {
  return CAR_CATALOG.filter((c) => c.code === code);
}

/** The whole catalog for one game, in code order. */
export function carsForGame(game: GameType): CarEntry[] {
  return CAR_CATALOG.filter((c) => c.game === game);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1);
      current.push(Math.min(previous[j]! + 1, current[j - 1]! + 1, substitution));
    }
    previous = current;
  }
  return previous[b.length]!;
}

/**
 * Flexible catalog search. A car matches when ANY of these holds, best rank
 * first:
 * - numeric query → code prefix within the searched set (unchanged behaviour)
 * - the whole query appears in the name ("land cruiser" → TOYOTA LAND CRUISER)
 * - EVERY query token starts some word of the name — people search by
 *   abbreviation: "def" → LAND ROVER DEFENDER, "must i" → FORD MUSTANG I
 * - or every token is a near-miss of some word (Levenshtein ratio ≥ 0.7), so
 *   one fat-fingered letter still finds the car ("defemder" → DEFENDER)
 * Results are ordered by match rank, then by code.
 */
export function searchCars(query: string, limit = 30, game?: GameType): CarEntry[] {
  const q = query.trim().toLowerCase();
  const pool = game ? carsForGame(game) : CAR_CATALOG;
  if (!q) return pool.slice(0, limit);
  if (/^\\d+$/.test(q)) {
    return pool.filter((c) => String(c.code).startsWith(q)).slice(0, limit);
  }

  const tokens = q.split(/\\s+/).filter(Boolean);
  const scored: Array<{ entry: CarEntry; score: number }> = [];
  for (const entry of pool) {
    const name = entry.name.toLowerCase();
    if (name.includes(q)) {
      scored.push({ entry, score: 1 });
      continue;
    }
    const words = name.split(/[^a-z0-9]+/).filter(Boolean);
    if (tokens.every((token) => words.some((word) => word.startsWith(token)))) {
      scored.push({ entry, score: 0.8 });
      continue;
    }
    const fuzzy = tokens.every((token) =>
      words.some(
        (word) => 1 - levenshtein(token, word) / Math.max(token.length, word.length) >= 0.7,
      ),
    );
    if (fuzzy) scored.push({ entry, score: 0.6 });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.entry.code - b.entry.code)
    .slice(0, limit)
    .map((match) => match.entry);
}
`;

/* ---------- output guard: a silently dropped row is a data bug ---------- */
// Every non-blank input line that is not an anomaly MUST become a row.
// A parser bug that quietly loses cars would ship a short catalog that still
// looks valid, so this is a hard failure, not a warning.
const nonBlank = cpm1Raw.split("\n").filter((l) => l.trim()).length;
const dropped = nonBlank - cpm1.length;
if (dropped !== parseAnomalies.length) {
  console.error(`FATAL: ${nonBlank} non-blank CPM1 lines in, ${cpm1.length} rows out,`);
  console.error(`       but only ${parseAnomalies.length} were recorded as anomalies.`);
  console.error(`       ${dropped - parseAnomalies.length} row(s) were dropped SILENTLY — refusing to write.`);
  process.exit(1);
}

fs.writeFileSync(CATALOG, file, "utf8");
console.log(`written: ${CATALOG}`);
console.log(`CPM1 entries: ${cpm1.length} | CPM2 entries: ${cpm2.length} | total ${cpm1.length + cpm2.length}`);
console.log(`colliding codes: ${colliding.length}`);
console.log(`CPM1 gaps in ${report.min}-${report.max}: ${report.gaps.length} total`);
console.log(`input lines: ${nonBlank} | rows: ${cpm1.length} | anomalies: ${parseAnomalies.length} (all accounted for)`);
if (parseAnomalies.length) {
  console.log("parse anomalies:");
  for (const a of parseAnomalies) console.log("  " + a);
}
