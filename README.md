# CPM2 // FLEET CONSOLE

The account tracker for **Car Parking Multiplayer 1 and 2** — log every account you make, see who
owns what, and never lose track of balances, coins, cars or car slots — plus the **VANTA GARAGE**
storefront that sells from the same database.

- **Stack** — Next.js 16 (App Router) · React 19 · Tailwind v4 · TypeScript
- **Data** — a remote **Turso (libSQL)** database (`TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`,
  `src/lib/db-turso.ts`) shared by the fleet console and the VANTA GARAGE store (isolated
  `vanta_` tables). Passwords and delivered account credentials are encrypted at rest with
  AES-256-GCM (`src/lib/crypto.ts`, `src/lib/store/accounts.ts`)
- **Where it runs** — self-hosted from this box (the dev server binds to `127.0.0.1`) and
  deployed to Vercel as `cpm2-bay.vercel.app` (`vercel.json`), which serves the storefront and
  the Telegram bot webhook. Because the database is remote Turso, this is **not** a
  local-only app: every read and write travels to the database over TLS

## Run it

```bash
npm install
npm run dev      # http://127.0.0.1:3000
```

```bash
npm run build && npm start   # production server (also bound to 127.0.0.1)
npm run typecheck            # tsc --noEmit
npm test                     # domain rules (node:test)
npm run lint
```

All four gates also run in CI on every push and PR (`.github/workflows/ci.yml`), and the app is
deployed to Vercel (`vercel.json`) — the production storefront and webhook run there, not on this
box.

## Telegram Mini App (open the tracker from its own bot)

The tracker is also a Telegram Mini App for its own bot — same app, same
database, launched from the bot's ☰ menu button. The bot token lives in
`.env.local` as `TELEGRAM_BOT_TOKEN` and is never committed or printed.

The bot needs an HTTPS URL. Tailscale (already on this box) serves one for the
PC over the tailnet, which is what the phone's Telegram reaches:

```bash
# 0. the fleet server is already running on 127.0.0.1:3457 (START CPM2 CONSOLE.bat)
# 1. serve it as HTTPS on the tailnet (a real cert, once — survives reboots)
tailscale serve --bg 443 http://127.0.0.1:3457

# 2. point the bot's menu button at that URL
node scripts/telegram-bot.mjs sync https://kami.tailc10831.ts.net

# 3. in Telegram: open the bot → tap ☰ → the console runs
node scripts/telegram-bot.mjs status   # shows what is wired up
```

- **In-app adaptation** — the console detects Telegram, calls `ready()` +
  `expand()` (no loading card, full height) and tracks the app's own paper
  colour in the webview header; in a normal browser it stays a plain site.
- **The console is locked** — every page and API call passes a gate
  (`src/proxy.ts`). Two keys open it: the console password (`APP_PASSWORD`)
  for the desktop browser, or the mini app's signed initData — but ONLY from
  the Telegram account that claimed the console. The first login from
  Telegram asks for the password once and binds that Telegram user id as the
  owner (stored in `data/telegram-owner.json`); from then on anyone else who
  finds the bot sees a locked screen, even with a valid Telegram signature.
  Sessions are HMAC-signed cookies valid for 30 days (`/api/auth/logout`
  clears one). Password attempts are rate-limited.
- **A real bot backend** — `POST /api/telegram/webhook` (`src/app/api/telegram/webhook/route.ts`)
  receives Bot API updates: the link-verification callback gate, pre-checkout queries and payment
  confirmations for store orders. It registers its own webhook on first call, so unlike the old
  tracker there **is** a server component — it lives on the Vercel deployment, and
  `scripts/telegram-bot.mjs` only wires the ☰ menu button and reports status locally.

## VANTA GARAGE storefront (`/store`)

The storefront sells CPM1/CPM2 cars and ready-to-play accounts out of the same Turso database,
in isolated `vanta_` tables (`src/lib/store-schema.ts`, `src/lib/store-db.ts`).

- **Catalogue + checkout** (`/store/cpm1`, `/store/cpm2`, `/store/cart`, `/store/checkout`) —
  products, categories, promotions and media are served from the database; checkout locks stock
  for 60 minutes (`RESERVATION_MINUTES` in `src/lib/store/checkout.ts`) and the server assigns a
  sortable `VNT_…` order id
- **Payments** — PayFast (`src/lib/store/payfast.ts`, sandbox by default; flip with
  `PAYFAST_BASE_URL`) with an MD5 signature webhook, and Telegram Stars (`src/lib/store/stars.ts`,
  `STARS_ZAR_PER_STAR`, default R0.24 per Star)
- **Delivery** — sold account units are encrypted with `ACCOUNT_ENCRYPTION_KEY` and claimed
  atomically at checkout, so two buyers can never hold the same credential
- **Admin** (`/store/admin`, `/store/owner`) — gated by `STORE_ADMIN_TELEGRAM_ID`
- **Notifications** — customers are notified through the Telegram bot and a WhatsApp bot webhook
  (`VANTA_WHATSAPP_WEBHOOK_URL` / `VANTA_WHATSAPP_WEBHOOK_SECRET`)

## Game rules the tracker enforces

The two games do NOT share one garage rule — the tracker enforces each one separately.

| Rule | Limit |
| --- | --- |
| Cash per account | 50,000,000 |
| Coins per account | 30,000 |
| CPM1 car slots | none — the garage holds every model in the game |
| CPM1 per model | one only (a second copy is refused) |
| CPM2 base car slots | 20 (free, editable per account) |
| CPM2 21st slot | 100 coins (one per account) |
| CPM2 new garage | R299.99 — adds 15 slots (36 in total) |

**CPM1 has no slots at all.** Every car in the game can be owned, but a model can only be owned
once — parking a second copy is refused with `400 car_duplicate`. CPM1 accounts never store slot
values, and buying a slot for one answers `422 CPM1_HAS_NO_SLOTS`.

**CPM2 is slot-based.** The stock garage holds 20 free slots, the 21st slot is the only one the
game sells for coins (100 coins, charged from the account balance), and the purchasable second
garage (R299.99) adds 15 slots on top. The second garage is bought with real money, so the tracker
records it as a flag on the account — tick **New garage** in the account form.

### Slot rules (read this before editing balances)

- **The 21st slot can only be bought.** `POST /api/accounts/{id}/slots` charges 100 coins inside one
  transaction. `PATCH` can never hand out a slot — it answers `422 SLOTS_PURCHASE_ONLY`.
- **Slots can be removed** (the game does not refund, so neither do we): the removal is written to
  the activity log as a `slots_removed` event and the balance stays untouched.
- **Creating or importing an account may state how many slots it already owns.** That is a snapshot
  of the in-game state, not a transaction, so no coins are charged.
- Shrinking the slot count below the number of cars is refused (`422 CAR_CAPACITY_EXCEEDED`).

## What's in the box

- **Fleet** (`/fleet`) — the register: search, filters, sortable columns, multi-select for bulk
  archiving, and an active/archived switch. The search, filter and sort live in the URL, so
  `?q=kami&filter=full` is a bookmark you can share or reload. `/` redirects to the CPM2
  register — the app opens straight into the fleet
- **Account page** (`/accounts/{id}`) — one account in full: balances with live steppers, the
  garage gauge, the credential cell, the coin ledger, the **drag racing trophy cabinet**, and that
  account's own history
- **Trophy cabinet** — per account, per drag racing class (`U` unlimited, `S9`–`S13`), the count
  of gold / silver / bronze trophies. Steppers write straight to the ledger, every change is
  audited, and the fleet table shows a `4G 2S 1B` tally per account
- **Trade desk** (`/trade`) — the CPM2 deal calculator: cars + cash sweeteners on both sides,
  valued through the editable price book, with a plain worth-it / fair / not-worth-it verdict.
  Screenshot identification via Gemini (`GEMINI_API_KEY`)
- **Settings** (`/settings`) — game limits, where the data lives, backup instructions, the
  paper/night theme switch and the keyboard map
- **Fleet table** — inline ± steppers for cash/coins/cars, masked passwords with reveal + copy
  (auto-remasks after 10s), per-account capacity gauge (cyan = base slots, amber = bought slots,
  red `FULL` flag at capacity)
- **Backups** — `CSV` and `JSON` export behind an explicit confirmation modal (the file contains
  every decrypted password) plus `POST /api/accounts/import` for restoring one
- **Validation** — duplicate emails, blank passwords, oversized numbers, over-capacity garages and
  unaffordable slots are all rejected with a human-readable reason

### Accessibility

- Skip-to-content link, landmark regions, one `h1` per page, hierarchical headings
- Visible `:focus-visible` rings everywhere (no `outline: none` without a replacement)
- Dialogs trap the keyboard, open with the caret in the first field, and close on `Esc`
- Form errors are inline, and a failed submit moves the caret to the first bad field
- Every icon-only control carries an `aria-label`; decorative SVGs are `aria-hidden`
- Toasts announce politely (`aria-live`); the meter animation respects `prefers-reduced-motion`
- Touch targets sized for one thumb, `touch-action: manipulation`, safe-area padding on the header

### Keyboard

| Keys | Action |
| --- | --- |
| `N` | new account |
| `/` | jump to the fleet search |
| `G` then `1` / `2` / `T` / `S` | go to CPM1 / CPM2 / trade desk / settings |
| `?` | show the shortcut list |
| `Esc` | close a dialog |

### Themes

`Paper` (default) is the daylight service-manual look; `Night` is the same ledger lit from the
dash. The choice is stored on the machine — switch it from the header or from Settings.

## Trade desk (CPM2)

The Trade page prices a car deal in Rands so a trade can be judged before it
happens. Every car is valued by how it is bought:

- **Paid car** (real money) → its Rand price
- **Coin car** → coin price × the coins→Rands rate
- **Cash car** → cash price × the cash→Rands rate (cash is grindable but
  also buyable with real money, so a cash price has a real cost)

In-game **cash** can sweeten either side (players price trades in cash, and
cash is buyable with Rands). Coins are deliberately **not** a trade currency —
they are personal money. The desk compares both sides and verdicts plainly:
*worth it / fair (within 3%) / not worth it*, with a rough percentage lean —
no Rand totals on screen; the Rand math stays under the hood.

The price book and the rates live in the database (`trade_prices`,
`trade_rates`) — nothing is hardcoded, and rates are seeded from the store-pack
anchors. An unpriced car never blocks the deal: the desk calls it a **rough
verdict** with an unpriced-count caveat, and an optional one-tap "record price"
adds the car to the book permanently.

**Screenshot identification** uses Gemini (`gemini-2.5-flash`, server-side
only). Put a free key from aistudio.google.com in `.env.local` as
`GEMINI_API_KEY` — never committed. Without it the identify button explains
itself and everything else works. Gemini's read is fuzzy-matched against the
CPM2 catalog and the user confirms the pick, so a misread never lands silently.

## API

| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/accounts` | Active fleet + stats (`?archived=true` for archived) |
| `POST` | `/api/accounts` | Create (same zod validation as import) |
| `PATCH` | `/api/accounts/{id}` | Update — **cannot raise `slots`** |
| `DELETE` | `/api/accounts/{id}` | Soft delete (archive) |
| `POST` | `/api/accounts/{id}/restore` | Undo an archive |
| `POST` | `/api/accounts/{id}/slots` | Unlock the 21st slot (100 coins, atomic) |
| `GET` | `/api/accounts/{id}/password` | Decrypt one password (audited) |
| `GET` | `/api/accounts/{id}/trophies` | Trophies for every drag racing class |
| `PUT` | `/api/accounts/{id}/trophies` | Set the gold/silver/bronze counts for one class |
| `GET` | `/api/trophies` | Trophy totals for the whole fleet |
| `POST` | `/api/accounts/import` | Bulk import — `?format=json` or `?format=csv` |
| `GET` | `/api/events` | Activity log |
| `GET` | `/api/export` | Needs `?confirm=true` — audited |
| `GET` / `PUT` | `/api/trade/rates` | The coins→Rands and cash→Rands rates |
| `GET` / `PUT` / `DELETE` | `/api/trade/prices` | The price book (`?game=`, upsert body `{game, code, kind, price}`) |
| `POST` | `/api/trade/identify` | Gemini screenshot → car name + catalog matches; 503 until `GEMINI_API_KEY` is set |

## Files worth knowing

```
src/lib/db-turso.ts      Turso (libSQL) connection — undici keep-alive pool, shared by fleet + store
src/lib/store-db.ts      store DB client; applies the vanta_ schema + migrations idempotently
src/lib/store-schema.ts  every vanta_ table DDL — the CHECK constraints tests/store.test.ts asserts
src/lib/store/checkout.ts orders, 60-minute stock reservation, payment state machine, expiry sweep
src/lib/store/orders.ts  order pipeline transitions (guarded server-side)
src/lib/store/products.ts products, inventory, atomic reserveStock() oversell guard
src/lib/store/payfast.ts PayFast checkout + MD5 signature
src/lib/store/stars.ts   Telegram Stars → ZAR conversion
src/lib/store/accounts.ts encrypted account-unit delivery (ACCOUNT_ENCRYPTION_KEY)
src/lib/store/notifications.ts Telegram + WhatsApp order notifications
src/lib/constants.ts     all limits + per-game garage rules (single source of truth)
src/lib/garage.ts        game-aware capacity (CPM1 models vs CPM2 slots)
src/lib/validation.ts    zod schemas, shared by the API and the browser form
src/lib/crypto.ts        AES-256-GCM password encryption + key file
src/lib/auth.ts          session cookies, rate limiting, console owner
src/lib/telegram.ts      bot token + Mini App initData verification
src/lib/http.ts          request parsing (testable without a running server)
src/proxy.ts             the console gate in front of every page and API call
src/app/api/             accounts CRUD, slots, password reveal, events, import, export, store checkout
src/app/api/telegram/    bot webhook (link gate, pre-checkout, payment confirmations)
src/app/store/           the VANTA GARAGE storefront (catalogue, cart, checkout, admin)
```

## Passwords & the key file

On first run the app writes `data/.secret-key` (32 random bytes). Passwords are encrypted with it
using AES-256-GCM. **Back that file up** — lose it and the stored passwords cannot be recovered.
The key never leaves the machine (the database does, but only ever holds ciphertext); `data/` is
gitignored so the key and any local state can never reach a remote.

Set `CPM2_ENCRYPTION_KEY` (base64, 32 raw bytes) to use your own key instead of the key file.
Store-delivered account credentials use their own key, `ACCOUNT_ENCRYPTION_KEY`, and the app
refuses to store account units without it.

## Environment variables

All secrets live in `.env.local` (gitignored) — never commit them. `.env.example` lists the same
names without values. Vercel holds its own copies for the deployed storefront + webhook.

| Variable | Default | Purpose |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | — | Turso (libSQL) connection URL — all fleet + store data lives here |
| `TURSO_AUTH_TOKEN` | — | Turso auth token |
| `CPM2_KEY_PATH` | `data/.secret-key` | Where the AES-256-GCM key file is written |
| `CPM2_ENCRYPTION_KEY` | — | Use your own base64 (32 raw bytes) key instead of the key file |
| `ACCOUNT_ENCRYPTION_KEY` | — | Key for delivered store account units — the app refuses to store credentials without it |
| `CPM2_BCRYPT_ROUNDS` | `12` | Password-hashing cost |
| `TELEGRAM_BOT_TOKEN` | — | Bot token — Mini App initData, the webhook and order notifications (`src/lib/telegram.ts`) |
| `APP_PASSWORD` | — | The console password — gates the browser and reveal consent (`/api/auth/login`) |
| `STORE_OWNER_EMAIL` | — | Owner email (`CONSOLE_OWNER_EMAIL` is accepted as an alias) |
| `STORE_ADMIN_TELEGRAM_ID` | — | Telegram id allowed into `/store/owner` and `/store/admin` |
| `PAYFAST_MERCHANT_ID` | — | PayFast merchant id |
| `PAYFAST_MERCHANT_KEY` | — | PayFast merchant key |
| `PAYFAST_PASSPHRASE` | — | PayFast signature passphrase |
| `PAYFAST_BASE_URL` | PayFast sandbox | Checkout endpoint — point at live when going live |
| `STARS_ZAR_PER_STAR` | `0.24` | ZAR charged per Telegram Star |
| `NEXT_PUBLIC_SITE_URL` | — | Public site URL, used to build absolute media + checkout links |
| `GEMINI_API_KEY` | — | Gemini screenshot identification on the trade desk |
| `VANTA_WHATSAPP_WEBHOOK_URL` | — | WhatsApp bot notification webhook |
| `VANTA_WHATSAPP_WEBHOOK_SECRET` | — | Shared secret for that webhook |
