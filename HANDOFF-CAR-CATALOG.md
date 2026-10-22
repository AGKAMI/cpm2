# HANDOFF: Car Catalog Search + Garage Inventory UI (Kermes → opencode agent)

**Repo:** Documents/GAMES/cpm2 · **Started:** 2026-10-22 · **Backend: DONE, COMMITTED, TSC-CLEAN**
**Your job:** the entire UI layer + tests. The API and data layer are finished and verified — do NOT rebuild them.

## What KAMI wants (user story)
1. **Car catalog reference list** — searchable by code OR name. Type `49` → `#49 TOYOTA SUPRA A80 (MK4)`. Type `supra` → all Supras. Type `gt` → GT-Rs, Mustangs, Ford GT, etc.
2. **Per-account garage inventory** — from the search results, assign any catalog car to any account's garage. Each account page shows its car list (code + name), removable. Garage full → clear error, no silent fail.
3. KAMI's complete 208-car code list is ALREADY in the repo (see below). Use it as-is.

## DONE — committed on master (commit "feat: car catalog + per-account garage inventory backend")

### Files that exist — DO NOT re-create, DO NOT restructure
- `src/lib/car-catalog.ts` — `CAR_CATALOG: CarEntry[]` (208 entries `{code, name}`), `carByCode(code)`, `searchCars(query, limit=30)`. Search semantics: pure-numeric query = code prefix match; otherwise case-insensitive name substring. Names are ALL CAPS.
- `src/lib/db.ts` — `account_cars` table: `id INTEGER PK, account_id INTEGER NOT NULL FK→accounts ON DELETE CASCADE, car_code INTEGER NOT NULL CHECK 0..9999, notes TEXT DEFAULT '', created_at TEXT, UNIQUE(account_id, car_code)`. Schema auto-creates on boot (CREATE TABLE IF NOT EXISTS in SCHEMA string) — no migration needed.
- `src/lib/service.ts` — `listGarage(accountId): GarageSummary`, `fleetGarages(): GarageSummary[]`, `addGarageCar(accountId, payload): CarRecord`, `removeGarageCar(accountId, carId): {removed, carName}`. Capacity enforced via `carCapacity(base_slots, slots)`; duplicate car → 400 `car_duplicate`; unknown code → 400 `car_unknown`; full garage → 400 `garage_full`; missing car → 404 `car_not_found`. Events logged: `car_added` / `car_removed` (already added to `FleetEventType` union + ActivityFeed's event-style map with mint/bronze colors).
- `src/lib/validation.ts` — `carAssignSchema = z.object({ carCode: int 0..9999, notes: string ≤200 default '' })`
- `src/lib/types.ts` — `CarRecord {id, accountId, carCode, carName, notes, addedAt}`, `GarageSummary {accountId, email, cars, count, capacity}`
- `src/app/api/cars/route.ts` — `GET /api/cars?q=<query>` → `{query, total: 208, cars: CarEntry[]}` (limit 50 per call; client should filter further locally from the full list if you fetch without `q`)
- `src/app/api/accounts/[id]/garage/route.ts` — `GET` → `{garage: GarageSummary}`, `POST {carCode, notes?}` → `{car, garage}`, `DELETE ?carId=` → `{removed, carName, garage}`

### VERIFY these on disk before starting (trust but verify, they are committed)
```
npx tsc --noEmit   # must be CLEAN (exit 0) — verified before handoff
git log --oneline -2  # head = the car-catalog feat commit
```

## YOUR WORK — in order

### 1. API smoke test first (5 min, catches any handoff drift)
Boot `npm run dev -- --port 3457` (NEVER port 3000 — WhatsApp bridge owns it), then:
```
curl "http://localhost:3457/api/cars?q=49"      # expect TOYOTA SUPRA A80 (MK4)
curl "http://localhost:3457/api/cars?q=supra"   # expect 3 hits (49, 150, 272)
```
Then create a probe account (`*probe@cpm2.gg` email — see PROBE HYGIENE below), POST a car to its garage, DELETE it, confirm events show `car_added`/`car_removed`.

### 2. CarPickerModal component (the core UI)
Modal with a search input. Debounced client-side filtering over `CAR_CATALOG` (import the static array directly — it is only ~9KB, no need to hit `/api/cars` per keystroke). Rows: `#CODE` in mono numerals + NAME. Click row → POST to the account's garage. Show `count/capacity` from the garage in the modal header. Reuse the existing `Modal` (`src/components/ui/Modal.tsx`) + `Button` — match the midnight/mint design system exactly (mint = accent/actions only, values neutral-bright, SVG-only icons from svgrepo — NO emoji, ever).

### 3. Account page garage section
On `src/app/accounts/[id]/page.tsx`: "Garage" panel under the existing spec strip. Car rows: `#49` mono + `TOYOTA SUPRA A80 (MK4)` + optional notes + remove button (ConfirmDialog, consistent with existing delete patterns). `ADD CAR` button opens CarPickerModal. Show `cars.count / garage.capacity` as a mini gauge (reuse CapacityGauge pattern). Empty state: "No cars logged — search the catalog to add your first."

### 4. Fleet overview: catalog tab (reference list)
On the fleet overview add a "Car Codes" entry point (bottom-nav has 4 tabs: Overview/Fleet/Activity/Settings — add the reference as a panel/button on Overview, NOT a 5th tab). Full 208-row list with the same search box, grouped or flat — your call, keep it fast and scannable. Mark cars the fleet already owns with a subtle dot (data from `fleetGarages()` — but note: there is NO fleet-level garage endpoint yet; either add `GET /api/garages` returning `fleetGarages()` + a test, or fetch per-account, your call — adding the endpoint is the better path).

### 5. Tests (repo gate requires green)
Follow `tests/*.test.ts` patterns (tmp-dir DB per run):
- car-catalog: searchCars numeric vs name, carByCode hit/miss
- service: add → dupe rejected → capacity full rejected → remove → events logged with type `car_added`/`car_removed`
- API: garage GET/POST/DELETE + cars?q= search route
Run the full gate: `npx tsc --noEmit && npm run lint && npm test` — ALL green before you claim anything.

## NON-NEGOTIABLE RULES (from AGENTS.md + KAMI's standing corrections)
- Do what is asked; nothing more. This is the ONLY scope: catalog search UI + garage inventory UI + tests for them.
- SVG icons from svgrepo only. NEVER emoji as UI icons.
- Mint accent = actions/active only. Values neutral-bright. Keep AA contrast (the 10-21 audit fixed tokens — don't regress them).
- `npx tsc --noEmit` + `npm run lint` + `npm test` green before ANY "done" claim.
- `npm run build` kills any running dev server (swaps `.next`) — warn KAMI first or restart the prod server after (launcher handles staleness itself).
- PROBE HYGIENE: probe accounts use `*probe@cpm2.gg` emails; after testing, hard-purge via direct sqlite DELETE on `email LIKE '%probe@cpm2.gg'` AND matching `account_events` rows.
- Agent-restructure hazard: if you rename/move components mid-session, re-grep that CarBackdrop is still mounted in AppShell (it was orphaned once before).
- write_file staleness-block: if a file was last read with offset/limit, write_file refuses — use `patch` instead.

## OUT OF SCOPE (do NOT touch)
- Coin charging for cars (the `coins_spent_on_cars` ledger stays manual — KAMI enters game spends himself)
- Slot purchase flow, password vault, import/export, trophies logic — all exist, all working, all off-limits
- The Gemini-rendered design mockups in hermes `garden-gpt-image-2/image/` are concept art only — the live UI follows the existing midnight/mint system, not the mockups
