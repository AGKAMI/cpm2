# CPM2 Tracker — Code Review (Kermes, 2026-10-20)

Verified by live probe: 29/29 unit tests passed, app booted on port 3456, real HTTP requests fired against a throwaway account (deleted after testing — `data/` returned to empty). Every flaw below was reproduced against the running app, not guessed from reading.

---

## MUST FIX before any real account goes in

### 1. PATCH `/api/accounts/[id]` bypasses the slot economy
**Proof:** `PATCH /api/accounts/1 {"slots":15,"cars":35}` on an account with 0 coins → `200 OK`, granted 15 slots + 35-car capacity for free. The 100-coins/slot rule only exists in `POST /api/accounts/[id]/slots`.
**Fix:** slots may only increase via the purchase endpoint (charge coins atomically). If PATCH must accept `slots`, it must charge `count * 100` coins in the same transaction. Decide explicitly whether slot *decreases* are legal (the game doesn't refund) — if yes, they should log a `slots_removed` event; if no, reject them.
**Test to add:** PATCH that raises slots with insufficient coins must fail with `INSUFFICIENT_COINS`; PATCH that lowers slots must be rejected or logged.

### 2. `data/` is not gitignored — password vault + AES key ship on next push
**Proof:** `git check-ignore data/cpm2.db` → not ignored. `data/` currently holds `cpm2.db` (encrypted passwords), `.secret-key` (the key that decrypts them), plus WAL/SHM files.
**Fix:** add `data/` to `.gitignore` now. Audit `git status` for any already-staged copies before committing. Same protection should apply to any export files written to disk.
**Note:** KAMI pushes projects to GitHub routinely — treat this as a leak-in-waiting, not a hypothetical.

### 3. Unauthenticated plaintext-password export on a LAN-exposed server
**Proof:** dev server listens on `0.0.0.0:3456`; `GET /api/export?format=csv` returns every email + decrypted password with no auth, no confirmation, no audit event.
**Fix:**
- Bind dev server to `127.0.0.1` (set in `next.config.ts` or the dev script — do not rely on users passing flags).
- Gate export behind an explicit confirmation (modal stating what will be exposed + how many accounts).
- Write an `export_performed` event to `account_events` every time export runs.
- Same treatment for `revealPassword` — password reveals should appear in the activity feed.

---

## GAME-RULE VERIFICATION (confirm against the actual game)

- Current model: `BASE_CAR_SLOTS = 20`, `MAX_PURCHASED_SLOTS = 15` → capacity 35. Verify 20 + 15 = 35 is the real CPM2 ceiling before trusting the capacity gauge. If the game says otherwise, it's a one-constant fix in `constants.ts`.
- Coins are also spent buying cars in-game. Consider a `coins_spent_on_cars` (or free-text notes convention) so the "coins locked in slots" stat stays an honest ledger.
- Delete is a hard delete (`DELETE /api/accounts/[id]`). Consider soft-delete/archive: nuking a 20-car account on a misclick should be recoverable.

---

## EDGE CASES TO ADD

**Data:**
- Bulk import (CSV/JSON) — export exists, import doesn't. Needed for migration/restore.
- Backup story: document a copy/export habit for `data/cpm2.db`, or add a one-click backup endpoint. This machine has history of eating files.
- `account_events` grows unbounded — list caps at 100, table never prunes. Add a retention rule (e.g. keep 10k rows) or rotation.
- Trailing/leading whitespace on email is trimmed by zod — good. Confirm display normalizes case consistently (stored lowercase vs as-typed).

**API:**
- Rate limiting is absent — fine for localhost, but if binding ever changes, add a cheap limiter.
- `GET /api/accounts/[id]` on a deleted id — confirm it 404s cleanly (tests cover requireAccount, verify the route too).
- Concurrent PATCH on the same account — better-sqlite3 serializes writes, but confirm no read-modify-write race between `requireAccount` and the UPDATE for two rapid requests.

**UI (review when visuals land):**
- Search/filter/sort on AccountTable — mandatory once fleet passes ~50 accounts.
- ConfirmModal must guard slot purchases (coin-spending actions deserve friction), not just deletes.
- Password reveal: auto-remask after ~10s, copy-to-clipboard button, reveal actions logged.
- Icons: SVG only (svgrepo), never emoji as controls — standing rule, verify components.
- Responsive: KAMI logs accounts mid-game from the emulator — table must be usable on a phone-sized window.
- CapacityGauge: show both cars-used and total capacity (e.g. 18/35), and flag at-cap accounts.

---

## WHAT'S ALREADY GOOD (keep)

- Defense in depth: DB CHECK constraints + zod validation agree on every limit.
- Case-insensitive unique email (COLLATE NOCASE index + app-level assert).
- Clean typed error envelope (`VALIDATION_FAILED`, `EMAIL_TAKEN`, `INSUFFICIENT_COINS`, `SLOT_LIMIT_REACHED`, `INVALID_JSON` → 400/409/422, never 500 for user errors).
- AES-256-GCM at rest, key file mode 0600, and a test that fails loudly if the key changes.
- Slot purchase runs headroom + coin checks inside one transaction.
- Event log with from/to snapshots on every mutation.
- WAL mode + busy_timeout, empty-fleet stats safe (no divide-by-zero).
- 29/29 tests green at review time.

---

## ORDER OF OPERATIONS

1. `.gitignore` `data/` (30 seconds, do it first)
2. Patch slots-economy hole + add the two tests
3. Bind 127.0.0.1 + confirm-gate export/reveal + audit events
4. Soft-delete decision + import endpoint
5. UI pass (search, confirm-guards, remask, SVG icons, responsive)
6. Re-run full test suite + fresh live probe before KAMI enters real accounts
