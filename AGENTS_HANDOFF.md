# AGENTS_HANDOFF.md — VANTA GARAGE (CPM2 Vehicle Storefront)

**Project:** CPM2 Next.js app on Vercel/Turso — `C:/Users/ojuni/Documents/GAMES/cpm2`
**KAMI-Bot:** `C:/Users/ojuni/Downloads/KAMI-Bot-main` (Baileys WhatsApp bot on bot-hosting.net)
**Status:** Build complete, not yet deployed to production. PayFast keys pending.
**Date:** 2026-11-07

---

## What VANTA GARAGE is

Premium CPM2 vehicle storefront selling real cars (ZAR) via:
1. **Telegram Mini App** — `cpm2-bay.vercel.app/store` (full UI: browse, checkout, orders, admin)
2. **WhatsApp / KAMI-Bot** — `.vanta` command in `commands/general/vanta.js` (text menu + ORDER flow)

Both hit the same backend — same cars, prices, stock, orders. Store is additive; existing fleet tracker, Telegram bot commands, and WhatsApp flows are untouched.

---

## What's built (verified)

| Layer | Files | Status |
|-------|-------|--------|
| Schema | `src/lib/store-schema.ts` | `vanta_` tables: customers, platform_identities, categories, products, product_media, inventory, pricing, system_config, audit_logs, financial_ledger, orders, payments, appointments. `cpm2_car_code` column on products referencing CPM2 catalog |
| DB client | `src/lib/store-db.ts` | Reuses existing Turso connection; `ALTER TABLE` migration for `cpm2_car_code` |
| Types | `src/lib/store-types.ts` | Domain types + API shapes incl. `cpm2CarCode` |
| Services | `src/lib/store/customers.ts`, `products.ts`, `checkout.ts`, `payments.ts`, `ledger.ts`, `payfast.ts`, `auth.ts` | Customer service, catalogue + inventory + media, checkout + 60-min reservation + payment state machine, PayFast checkout URL + webhook signature verification, financial ledger, admin gate |
| APIs | `src/app/api/store/` | products, categories, checkout, orders, orders/[id], payfast/webhook, admin/products, media, admin/is-admin |
| UI | `src/components/StoreShell.tsx`, `ProductPageClient.tsx`, `src/app/store/admin/page.tsx`, store pages | 4-tab store shell, product page with image gallery + checkout modal (PayFast/EFT), admin product manager (add/edit from CPM2 catalog, set price/stock/category/exclusivity/published, image URL field) |
| Client | `src/lib/store/client.ts` | `vantaApi` caller with `X-Telegram-Init-Data` header; `payfastUrl` on checkout response |
| Tests | `tests/store.test.ts` | Reservation timing, stock rules, order state machine, exclusivity tiers |
| KAMI-Bot | `commands/general/vanta.js` | `.vanta` → category → product → ORDER → Player ID + in-game name → YES/NO → 60-min reservation → `.vanta STATUS <id>`. Aliases: `garage`, `store`. Calls VANTA APIs via HTTPS |

**Test status:** `tsc` clean, lint 0 errors (30 warnings), 52/52 tests pass, `vanta.js` syntax OK.

---

## What's blocked / waiting on

| Item | Detail |
|------|--------|
| PayFast keys | `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE` — waiting on PayFast approval email after KYC upload (Certified ID + Capitec bank statement) |
| Live PayFast URL | Currently `sandbox.payfast.co.za`. Flip `PAYFAST_BASE_URL` to `https://www.payfast.co.za/eng/process` on go-live |
| Webhook URL | Set PayFast notify URL to `https://cpm2-bay.vercel.app/api/store/payments/payfast/webhook` |
| `STORE_ADMIN_TELEGRAM_ID` | Env var on Vercel — owner Telegram id (`7036681178` default) for `/store/admin` |
| Product seeding | Zero vehicles in `vanta_products` — add cars via `/store/admin` |
| Deploy CPM2 | `git push` → Vercel deploys |
| Deploy KAMI-Bot | `vanta.js` written locally, not deployed — needs git push + deploy API sync + hard stop/start on bot-hosting.net |
| Turso creds | Not on this machine for live DB integration tests — run in prod only |

---

## Environment vars to set (Vercel + KAMI-Bot panel)

**Vercel (CPM2 store):**
- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`
- `PAYFAST_BASE_URL` (sandbox → live on go-live)
- `STORE_ADMIN_TELEGRAM_ID` (default `7036681178`)
- `NEXT_PUBLIC_SITE_URL` (`https://cpm2-bay.vercel.app`)
- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (existing)

**KAMI-Bot panel (bot-hosting.net):**
- `VANTA_API_URL` (default `https://cpm2-bay.vercel.app/api/store`)

---

## PayFast flow (end-to-end)

1. User taps "Buy now" → `POST /api/store/checkout` creates order, locks stock 60 min, returns `payfastUrl`
2. Mini App opens `payfastUrl` via `WebApp.openLink` (Telegram in-app browser)
3. User pays by card / Instant EFT / bank transfer
4. PayFast ITN → `POST /api/store/payments/payfast/webhook`
5. Webhook verifies MD5 signature (`createHash("md5")` of sorted params + passphrase) → `payment_confirmed` → stock deducted → ledger entry
6. EFT fallback: order created, user sends manual proof, you mark paid manually

---

## Admin flow

`/store/admin` — owner-only, gated by `STORE_ADMIN_TELEGRAM_ID` + Telegram initData:
- Add product: CPM2 car code, name, description, price (cents/ZAR), stock, availability, exclusivity (standard / limited_edition / one_of_one), featured, published, image URL
- Edit product: same fields via `PUT /api/store/admin/products?id=X`
- Toggle published/unpublished
- Image URLs stored in `vanta_product_media`, served via `GET /api/store/media?productId=X`

---

## Rules to follow

- **EDIT ONLY WHAT THE COMPLAINT NAMES** — scope-gate before any edit (see #1c in SOUL.md). Never touch adjacent code.
- **Mode prefix required** on every message: `**AG**` / `**P&P**` / `**SS**` / `**PM**` / `**PMSB**` / `**Fox**` on its own line, blank line, then reply.
- **SLANG register default** — English sentence structure, slang words inside. Never full Afrikaans sentences/clauses (LAW 1 BAN 1).
- **Never claim completion without tool output.** Attempted ≠ completed ≠ verified.
- **PayFast secrets never typed** — only entered via secure env/config mechanism.
- **Date-stamp discipline** — run `date` before writing any date into an artifact.
- **No heredoc/cat for MEMORY.md** — memory tool only.

---

## WhatsApp (KAMI-Bot) note

Local port-3000 bridge is **not** KAMI-Bot's. KAMI-Bot runs on bot-hosting.net with its own session (27683993925). `vanta.js` calls VANTA APIs via HTTPS — no bridge involvement.

---

## Next agent to-do (in order)

1. Get PayFast keys from user → set Vercel env vars
2. Flip `PAYFAST_BASE_URL` to live + set webhook URL on PayFast dashboard
3. Set `STORE_ADMIN_TELEGRAM_ID` on Vercel
4. Seed products via `/store/admin`
5. `git push` → Vercel deploy CPM2
6. Deploy `vanta.js` to KAMI-Bot (git push + deploy API sync + hard stop/start)
7. Verify end-to-end: buy a car via Mini App → PayFast → webhook → order confirmed
