# CPM2 // FLEET CONSOLE

A local account tracker for **Car Parking Multiplayer 2**. Log every account you make, see who owns
what, and never lose track of balances, coins, cars or purchased car slots.

- **Stack** — Next.js 16 (App Router) · React 19 · Tailwind v4 · SQLite (better-sqlite3)
- **Data** — real SQLite file at `data/cpm2.db`, passwords encrypted at rest with AES-256-GCM
- **Local only** — the dev server binds to `127.0.0.1`; nothing leaves your machine unless you
  export it yourself

## Run it

```bash
npm install
npm run dev      # http://127.0.0.1:3000
```

```bash
npm run build && npm start   # production (also bound to 127.0.0.1)
npm test                      # domain rules (node:test)
npm run lint
```

## Game rules the tracker enforces

| Rule | Limit |
| --- | --- |
| Cash per account | 50,000,000 |
| Coins per account | 30,000 |
| Base car slots | 20 (free) |
| Extra car slots | up to 15 per account |
| Price of an extra slot | 100 coins (auto-deducted) |

Extra slots are bought from the account row (`+ BUY SLOT`) or the edit form — the coins come out of
that account's balance, the garage grows to `20 + slots`, and the purchase is written to the log.
The same limits are enforced three times over: zod validation in the API, SQLite `CHECK` constraints,
and live counters in the UI.

### Slot rules (read this before editing balances)

- **Slots can only be bought.** `POST /api/accounts/{id}/slots` charges 100 coins per slot inside
  one transaction. `PATCH` can never hand out a slot — it answers `422 SLOTS_PURCHASE_ONLY`.
- **Slots can be removed** (the game does not refund, so neither do we): the removal is written to
  the activity log as a `slots_removed` event and the balance stays untouched.
- **Creating or importing an account may state how many slots it already owns.** That is a snapshot
  of the in-game state, not a transaction, so no coins are charged.
- Shrinking the slot count below the number of cars is refused (`422 CAR_CAPACITY_EXCEEDED`).

## What's in the box

- **Overview** (`/`) — the spec strip, cash-by-account and garage-utilisation charts, the coin
  ledger (free / locked in slots / spent on cars), an "needs attention" list (accounts at a cap,
  full garages, archived rows) and the latest entries
- **Fleet** (`/fleet`) — the register: search, filters, sortable columns, multi-select for bulk
  archiving, and an active/archived switch. The search, filter and sort live in the URL, so
  `?q=kami&filter=full` is a bookmark you can share or reload
- **Account page** (`/accounts/{id}`) — one account in full: balances with live steppers, the
  garage gauge, the credential cell, the coin ledger, the **drag racing trophy cabinet**, and that
  account's own history
- **Trophy cabinet** — per account, per drag racing class (`U` unlimited, `S9`–`S13`), the count
  of gold / silver / bronze trophies. Steppers write straight to the ledger, every change is
  audited, and the fleet table shows a `4G 2S 1B` tally per account
- **Activity** (`/activity`) — the permanent log, filterable by entry type and searchable
- **Settings** (`/settings`) — game limits, where the data lives, backup instructions, the
  paper/night theme switch and the keyboard map
- **Fleet table** — inline ± steppers for cash/coins/cars, masked passwords with reveal + copy
  (auto-remasks after 10s), per-account capacity gauge (cyan = base slots, amber = purchased
  slots, red `FULL` flag at capacity)
- **Backups** — `CSV` and `JSON` export behind an explicit confirmation modal (the file contains
  every decrypted password) plus `POST /api/accounts/import` for restoring one
- **Validation** — duplicate emails, blank passwords, oversized numbers, over-capacity garages and
  unaffordable slots are all rejected with a human-readable reason

### Keyboard

| Keys | Action |
| --- | --- |
| `N` | new account |
| `/` | jump to the fleet search |
| `E` | export the fleet |
| `G` then `F` / `A` / `S` | go to fleet / activity / settings |
| `?` | show the shortcut list |
| `Esc` | close a dialog |

### Themes

`Paper` (default) is the daylight service-manual look; `Night` is the same ledger lit from the
dash. The choice is stored on the machine — switch it from the header or from Settings.

## API

| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/accounts` | Active fleet + stats (`?archived=true` for archived) |
| `POST` | `/api/accounts` | Create (same zod validation as import) |
| `PATCH` | `/api/accounts/{id}` | Update — **cannot raise `slots`** |
| `DELETE` | `/api/accounts/{id}` | Soft delete (archive) |
| `POST` | `/api/accounts/{id}/restore` | Undo an archive |
| `POST` | `/api/accounts/{id}/slots` | Buy slots (100 coins each, atomic) |
| `GET` | `/api/accounts/{id}/password` | Decrypt one password (audited) |
| `GET` | `/api/accounts/{id}/trophies` | Trophies for every drag racing class |
| `PUT` | `/api/accounts/{id}/trophies` | Set the gold/silver/bronze counts for one class |
| `GET` | `/api/trophies` | Trophy totals for the whole fleet |
| `POST` | `/api/accounts/import` | Bulk import — `?format=json` or `?format=csv` |
| `GET` | `/api/events` | Activity log |
| `GET` | `/api/export` | Needs `?confirm=true` — audited |

## Files worth knowing

```
src/lib/constants.ts   all limits + helpers (single source of truth)
src/lib/validation.ts  zod schemas, shared by the API and the browser form
src/lib/service.ts     business rules, transactions, audit log
src/lib/crypto.ts      AES-256-GCM password encryption
src/lib/db.ts          SQLite connection + schema
src/lib/http.ts        request parsing (testable without a running server)
src/app/api/           accounts CRUD, slots, password reveal, events, import, export
```

## Passwords & the key file

On first run the app writes `data/.secret-key` (32 random bytes). Passwords are encrypted with it
using AES-256-GCM. **Back that file up** — lose it and the stored passwords cannot be recovered.
`data/` is gitignored: the database, the WAL files and the key must never reach a remote.

Set `CPM2_ENCRYPTION_KEY` (base64, 32 bytes) to use your own key instead of the key file.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `CPM2_DB_PATH` | `data/cpm2.db` | Where the SQLite file lives |
| `CPM2_KEY_PATH` | `data/.secret-key` | Where the encryption key lives |
| `CPM2_ENCRYPTION_KEY` | — | Use your own base64 key instead of the key file |
