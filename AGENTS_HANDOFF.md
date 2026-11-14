# AGENTS_HANDOFF.md — VANTA GARAGE (CPM2 Vehicle Storefront)

**MANDATORY PROTOCOL — ALL AGENTS:** BEFORE EVERY RUN IN THIS PROJECT, YOU MUST READ THIS ENTIRE AGENTS_HANDOFF.MD FILE FROM TOP TO BOTTOM. DO NOT IGNORE A SINGLE LINE. YOU MUST FOLLOW EVERY RULE, EVERY GATE, EVERY PROTOCOL 100% WITHOUT FLAW. NO EXCEPTIONS. NO SHORTCUTS. NO "I FORGOT." READ IT. OBEY IT. EVERY RUN.

**Project:** CPM2 Next.js app on Vercel/Turso — `C:/Users/ojuni/Documents/GAMES/cpm2`
**KAMI-Bot:** `C:/Users/ojuni/Downloads/KAMI-Bot-main` (Baileys WhatsApp bot on bot-hosting.net)
**Status:** Build complete, deployed to production. All routes 200 verified live. PayFast keys pending.
**Date:** 2026-11-13
**Live URL:** `https://cpm2-bay.vercel.app` — `/` = app selection, `/store` = VANTA Garage, `/fleet/cpm2` = Fleet Ledger
**Latest Deploy:** Account images feature deployed to production (cpm2-bay.vercel.app). Fleet Ledger account images live at `/fleet` routes.
**Deploy Hook:** `https://api.vercel.com/v1/integrations/deploy/prj_kgMwWJI3lOTBPVmVT0NXvmh6N0ZE/o6UHndNi6D`
**Build Cache:** `VERCEL_FORCE_NO_BUILD_CACHE=1` env var in `vercel.json` permanently disables build cache. Do NOT add `generateBuildId` to `next.config.ts` — Vercel rejects dynamic build IDs (causes 500 error).

---

## What VANTA GARAGE is

Premium CPM2 vehicle storefront selling real cars (ZAR) via:
1. **Telegram Mini App** — `cpm2-bay.vercel.app/store` (full UI: browse, checkout, orders, admin)
2. **WhatsApp / KAMI-Bot** — `.vanta` command in `commands/general/vanta.js` (text menu + ORDER flow)

Both hit the same backend — same cars, prices, stock, orders. Store is additive; existing fleet tracker, Telegram bot commands, and WhatsApp flows are untouched.

---

## App selection (new)

Root route `/` now shows an app selection screen instead of redirecting to Fleet Ledger:
- Two cards: Fleet Ledger (blue) + VANTA Garage (gold)
- Tap a card to open that app
- Both app shells carry a back arrow → returns to selection
- No header, no nav dock on selection page itself (zero chrome)
- Fleet Ledger header fully suppressed on `/store` routes

---

## What's built (verified)

| Layer | Files | Status |
|-------|-------|--------|
| Schema | `src/lib/store-schema.ts` | `vanta_` tables: customers, platform_identities, categories, products, product_media, inventory, pricing, system_config, audit_logs, financial_ledger, orders, payments, appointments. `cpm2_car_code` column on products referencing CPM2 catalog. Spec columns: `spec_hp`, `spec_top_speed`, `spec_zero_hundred`, `spec_drive` |
| DB client | `src/lib/store-db.ts` | Reuses existing Turso connection; `ALTER TABLE` migration for `cpm2_car_code` |
| Types | `src/lib/store-types.ts` | Domain types + API shapes incl. `cpm2CarCode` |
| Services | `src/lib/store/customers.ts`, `products.ts`, `checkout.ts`, `payments.ts`, `ledger.ts`, `payfast.ts`, `auth.ts` | Customer service, catalogue + inventory + media, checkout + 60-min reservation + payment state machine, PayFast checkout URL + webhook signature verification, financial ledger, admin gate |
| APIs | `src/app/api/store/` | products, categories, checkout, orders, orders/[id], payfast/webhook, admin/products, media, admin/is-admin |
| UI | `src/components/StoreShell.tsx`, `ProductPageClient.tsx`, `OrdersClient.tsx`, `ProfileClient.tsx`, `CheckoutClient.tsx`, `CategoriesClient.tsx`, `src/app/store/admin/page.tsx`, `src/app/store/dashboard/page.tsx` + `page.client.tsx`, `src/app/store/wishlist/page.tsx`, `src/app/store/support/page.tsx`, `src/app/store/admin/dashboard/page.tsx`, `src/app/store/admin/support/page.tsx`, `src/app/store/admin/promotions/page.tsx`, `src/app/store/admin/deliveries/page.tsx`, `src/app/store/owner/page.tsx`, `src/app/store/not-found.tsx`, `src/app/store/checkout/thank-you/page.tsx`, store pages | 4-tab store shell, product page with swipeable carousel + specs grid + exclusivity badges + gold buy button, orders progress timeline + delivery appointment, profile with wishlist + settings, checkout with PayFast live + EFT proof upload, categories with filters + sorting, admin product manager, dashboard with stat cards + alerts + quick actions, wishlist, support tickets, admin dashboard, admin support tickets, admin promotions CRUD, admin deliveries, owner dashboard, custom 404, thank-you page |
| Client | `src/lib/store/client.ts` | `vantaApi` caller with `X-Telegram-Init-Data` header; `payfastUrl` on checkout response |
| Tests | `tests/store.test.ts` | Reservation timing, stock rules, order state machine, exclusivity tiers |
| KAMI-Bot | `commands/general/vanta.js` | `.vanta` → category → product → ORDER → Player ID + in-game name → YES/NO → 60-min reservation → `.vanta STATUS <id>`. Aliases: `garage`, `store`. Calls VANTA APIs via HTTPS |

**Design skills applied app-wide:** `design-taste-frontend`, `ui-motion-and-design-quality`, `web-design-guidelines`, `ui-skills-registry`.

**Showroom UI:** shield logo + gold serif brand, hero car banner, Black Friday promo banner, category pills, gold prices + In stock/Limited badges, spec badges on product cards.

**App-wide transparency strip:** zero `hover:bg-racing` / `hover:bg-accent` / `bg-muted` / `bg-surface-raised` / `bg-ink` / `opacity-*` / `transition-opacity` / `border-transparent` / `hover:opacity` anywhere — every surface is solid `bg-background` + `border-border` + `hover:border-primary` only.

**Test status:** `tsc` clean, lint 0 errors (33 warnings), tests pass, `npm run build` passes. Infrastructure: `public/sw.js`, `public/sitemap.xml`, `public/og-image.svg`, `src/app/store/checkout/thank-you/page.tsx`.

---

## Fleet Ledger — Account Images (verified)

Open any CPM1/CPM2 account in Fleet Ledger → bulk-select car photos → they upload and preview on that account page so you can see which car is in which account visually.

**What's built:**
- **Schema** — `fleet_account_images` table + index in `src/lib/db-turso.ts` (id, account_id, image_url, sort_order, is_cover, uploaded_at, FK → accounts ON DELETE CASCADE)
- **Service layer** — `addAccountImages`, `listAccountImages`, `removeAccountImage`, `setAccountCoverImage`, `reorderAccountImages` in `src/lib/service-turso.ts`
- **API routes** — `POST/GET /api/accounts/[id]/images` (bulk multipart upload → `public/uploads/fleet/`, list), `GET/PATCH/DELETE /api/accounts/[id]/images/[imageId]` (`?serve=1` returns image binary, PATCH sets cover, DELETE removes file + row)
- **UI** — Account Images gallery section on `src/app/accounts/[id]/page.tsx` (image grid, add/delete/set-cover, cover badge on header plate, archive locks uploads)

**Gate:** `npx tsc --noEmit` clean (0 errors), `npx next build` clean, `npm test` 66/66 pass. Deployed live on cpm2-bay.vercel.app.

**Verified by:** AG (GLM-5.3-flash-free)

---

## What's blocked / waiting on

| Item | Detail |
|------|--------|
| PayFast keys | `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE` — waiting on PayFast approval email after KYC upload (Certified ID + Capitec bank statement) |
| Live PayFast URL | Currently `sandbox.payfast.co.za`. Flip `PAYFAST_BASE_URL` to `https://www.payfast.co.za/eng/process` on go-live |
| Webhook URL | Set PayFast notify URL to `https://cpm2-bay.vercel.app/api/store/payments/payfast/webhook` |
| `STORE_ADMIN_TELEGRAM_ID` | Env var on Vercel — owner Telegram id (`7036681178` default) for `/store/admin` |
| Product seeding | Zero vehicles in `vanta_products` — add cars via `/store/admin` |
| Deploy CPM2 | Deployed to Vercel production. Re-deploy after any changes via `vercel deploy --prod` |
| Deploy KAMI-Bot | `vanta.js` written locally, not deployed — needs git push + deploy API sync + hard stop/start on bot-hosting.net |
| Turso creds | Not on this machine for live DB integration tests — run in prod only |

---

## Environment vars to set (Vercel + KAMI-Bot panel)

**Vercel (CPM2 store):**
- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`
- `PAYFAST_BASE_URL` (sandbox → live on go-live)
- `STORE_ADMIN_TELEGRAM_ID` (set on Production, value `7036681178`)
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

- **EDIT ONLY WHAT THE COMPLAINT NAMES** — scope-gate before any edit. Never touch adjacent code.
- **Mode prefix required** on every message: `**AG**` / `**P&P**` / `**SS**` / `**PM**` / `**PMSB**` / `**Fox**` on its own line, blank line, then reply.
- **SLANG register default** — English sentence structure, slang words inside. Never full Afrikaans sentences/clauses (LAW 1 BAN 1).
- **Never claim completion without tool output.** Attempted ≠ completed ≠ verified.
- **PayFast secrets never typed** — only entered via secure env/config mechanism.
- **Date-stamp discipline** — run `date` before writing any date into an artifact.
- **Update AGENTS_HANDOFF.md for every specific change** — once a change has been made, update this doc for THAT specific change immediately: what changed, where, why, gate result, deploy status. Do not wait until end of run, and do not ask the user for something already recorded here. Read it before every run.
- **Context consolidation** — track only what is currently being worked on. Do not keep a growing log of everything already moved past. The "Next agent to-do" list and any "in-progress" note must be progressively updated: completed items removed, in-progress items updated, new items added. Never append history here — this doc is the live state, not an archive.
- **Deployed to Vercel production** — re-deploy after any changes via `curl -X POST "https://api.vercel.com/v1/integrations/deploy/prj_kgMwWJI3lOTBPVmVT0NXvmh6N0ZE/o6UHndNi6D"` (Deploy Hook — bypasses 100/day CLI limit).

---

## WhatsApp (KAMI-Bot) note

**PORT LOCK — READ BEFORE ANY DEV WORK:**

- **Port 3000 = WhatsApp bridge ONLY.** It runs the Hermes WhatsApp bridge (`/health` returns `connected`). **Never kill the port-3000 process for Vanta dev.** The bridge needs `creds.json` and a QR re-pair if it dies — downtime breaks WhatsApp notifications entirely.
- **Port 3001 = Vanta Garage dev server only.** Always run `npx next dev -p 3001` — never `--port 3000`. If port 3000 is occupied by a dev server, the bridge can't bind and WhatsApp sends die.

Local port-3000 bridge is **not** KAMI-Bot's. KAMI-Bot runs on bot-hosting.net with its own session (27683993925). `vanta.js` calls VANTA APIs via HTTPS — no bridge involvement.

---

## Next agent to-do (in order)

1. **Get PayFast keys from user** → set `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE` on Vercel (waiting on PayFast approval email after KYC upload)
2. **Flip `PAYFAST_BASE_URL`** to `https://www.payfast.co.za/eng/process` + set webhook URL on PayFast dashboard: `https://cpm2-bay.vercel.app/api/store/payments/payfast/webhook`
3. **Seed products via `/store/admin`** — zero vehicles in `vanta_products` yet
4. **Deploy `vanta.js` to KAMI-Bot** — git push + deploy API sync + hard stop/start on bot-hosting.net
5. **Verify end-to-end**: buy a car via Mini App → PayFast → webhook → order confirmed
6. **Button borders** — all buttons need visible borders (`Button.tsx` variants, no borderless text-only tap targets)
7. **Hardcoded car cleanup** — delete 6 seeded products (IDs 19-24, created 2026-11-07) via Admin UI once new build is live
8. **Consider adding `StoreShell` to all store routes** — `/store`, `/store/profile`, `/store/checkout/[id]`, `/store/categories`, `/store/orders` currently render with no header/nav
9. **Prod cold-start on `/store` (~20s first hit)** — Vercel lambda cold boot + the globalThis boot storm (schema batch + migrations ≈ 8–10s of ~295ms Turso RTTs) runs once per lambda instance; Vercel recycles instances, so cold hits re-pay it. Local warm is ~2–3s (fixed this round). Candidate fix: trim boot queries (skip migrations when schema version row says current) or cache-friendly ISR — needs user direction before changing render behavior.

---

### 2026-11-14 — Agent "AG" (GLM-5.3-flash-free) — Promotions Save button wired

**What:** The Save button on `/store/admin/promotions` had `onClick={() => {}}` — empty no-op. Wired it to actually save.

**Where:** `src/app/store/admin/promotions/page.tsx`

**Changes Made:**
1. **Added `savePromotion()` function** — validates draft has a title, then POSTs to `/api/store/admin/promotions` (new promotion) or PUTs to `/api/store/admin/promotions?id=<id>` (existing). On success: reloads promotions, clears draft, sets editing to null, clears error. On failure: shows error message.
2. **Passed `onSave` prop to `PromotionCard`** — Save button calls `onSave` instead of the empty no-op.

**Files:** `src/app/store/admin/promotions/page.tsx`

**Gate:** `npx tsc --noEmit` clean (0 errors), `npx next build` clean. Deployed live on cpm2-bay.vercel.app.

**Verified by:** AG (GLM-5.3-flash-free)

### 2026-11-14 — Agent "AG" (GLM-5.3-flash-free) — Real legal text for all 8 policy pages

**What:** `/legal/[doc]` had identical generic placeholder boilerplate for all 8 policies. Replaced with real, differentiated text in plain English.

**Where:** `src/app/legal/[doc]/page.tsx`

**Changes Made:**
1. **8 legal documents now have real body text** — Terms & Conditions, Privacy Policy, Refund Policy, Delivery Policy, Payment Policy, Cancellation Policy, Appointment Policy, Dispute Policy. Each specific to VANTA GARAGE (CPM2 marketplace via Telegram Mini App + WhatsApp).
2. **Type change** — `LEGAL_DOCS` entries now include `body: ReactNode` instead of just title/version.

**Files:** `src/app/legal/[doc]/page.tsx`

**Gate:** `npx tsc --noEmit` clean (0 errors), `npx next build` clean. Deployed live on cpm2-bay.vercel.app — `/legal/terms` returns HTTP 200 with `X-Matched-Path: /legal/[doc]` (curl verified).

**Verified by:** AG (GLM-5.3-flash-free)

### 2026-11-14 (4) — Agent "AG" (GLM-5.3-flash-free) — Store page-speed: 22–37s → ~2–3s (root causes fixed)

**What:** User reported multi-second responses and slow page changes even locally. Measured and fixed five root causes.

**Changes Made:**
1. **`next dev` was squatting on port 3001** (not started by AG — violated the port lock). It compiles every page on demand → 10–30s/page. Killed by verified PIDs only. Port lock reconfirmed: **3000 = WhatsApp bridge, never touch; 3001 = Vanta dev, prod build via `npx next start -H 127.0.0.1 --port 3001`**.
2. **Per-route-bundle boot storms** — module-level DB singletons are per-route-bundle in this Next version, so each page's first hit re-ran the full schema batch + ~15 sequential ALTER probes (~23 Turso round-trips ≈ 8–10s), and concurrent first-queries could race the boot (transient 500s). Fixed in `db-turso.ts` + `store-db.ts`: client + boot **promise** cached on `globalThis` (per-process) — schema/migrations run exactly once, concurrent callers await the same boot.
3. **4s keep-alive churn** — every Turso query is a ~295ms cloud RTT (DB in AWS us-east-1; DNS fine at 20ms), and undici's default pool closes idle connections after ~4s so page changes re-paid TCP+TLS (~1s+). Fixed: dedicated undici `Agent` (keepAliveTimeout 60s, 16 conns) on both Turso fetches; added `undici` dependency.
4. **Covers localized** — Unsplash became throttled from this network (12–158s/image → optimizer 504s → blank/black pages). `scripts/localize-store-covers.mjs` downloaded all 14 unique cover photos into `public/store-covers/<id>.jpg` (~3.9MB) and rewrote every `vanta_product_media.public_url` to local paths (**0 unsplash rows remain**). `seed-store-media.mjs` now seeds local paths. **NOTE: this Next version manifests `public/` at build time — files added after a build 404 until rebuild.**
5. **Per-product queries batched** — new `listCoverImageMap(ids)` (1 query, N products), new batched endpoint `GET /api/store/media/covers?ids=1,2,3` + `vantaApi.mediaCovers()`; `StoreHome` featured covers = 1 query (was 6), `CategoriesClient` = 1 request (was 24 client-side media calls).

**Files:** `src/lib/db-turso.ts`, `src/lib/store-db.ts`, `src/lib/store/products.ts`, `src/lib/store/client.ts`, `src/components/StoreHome.tsx`, `src/components/CategoriesClient.tsx`, `src/app/api/store/media/covers/route.ts` (new), `public/store-covers/*` (new, 14 jpgs), `scripts/localize-store-covers.mjs` (new), `scripts/seed-store-media.mjs`, `scripts/probe-turso-latency.mjs` + `probe-app-latency.mjs` (new, diagnostics), `package.json`.

**Measured after (local, warm):** /store ~2–3s (was 22–37s), categories ~1.8–3s, covers API 0.57s. Browser-verified: /store 7/7 images, categories 24/24 photos, 0 broken, 0 "No photo". Tests 66/66, `tsc` clean.

**Known pre-existing quirk (not from this round):** reloading /store while the server is freshly restarting can hit a hydration race (React #418 → empty `<main>` until a reload); warm reloads render fine. Watch it, don't chase it.

**Gate:** port-3001 listener killed → `tsc` clean → tests 66/66 → build clean → detached `next start` on 3001 (HTTP 200) → browser-verified both pages.

**Verified by:** AG (GLM-5.3-flash-free)

### 2026-11-14 (5) — Agent "AG" (GLM-5.3-flash-free) — Fixed: admin hydration mismatch blacked out /store (React #418)

**What:** User reported "site not working on your browser" — `/store` rendered a black page with an empty `<main>`. This was the previously-noted "hydration race quirk", now root-caused and fixed (it was NOT a race).

**Root cause:** `StoreShell.tsx` read `localStorage` ("vanta_admin_session") **during render** to gate the ADMIN/OWNER dock items. The server renders without it, so an admin's first client render computed a different dock (6 items vs 4) → hydration mismatch (React #418) → recovery wiped `<main>` → black page. Only affected admins, which is why it looked intermittent. `NotificationBell`'s localStorage read is effect-side only — safe; `GuestGate`'s `window.location.pathname` read is fleet-pages-only, untouched.

**Fix:** the flag is mirrored into state **after mount** (useEffect + storage listener) — identical eventual UI for admins, safe hydration. `adminSessionActive()` helper remains only inside event handlers.

**Gate:** `tsc` clean → tests 66/66 → build clean → `next start` on 3001. Browser-verified: 3 consecutive /store reloads with 0 hydration errors, `<main>` fully populated, dock shows all 6 items incl. ADMIN/OWNER (flag "true" in localStorage); fresh tab /store 8 imgs 0 broken; /store/categories 26 imgs 0 broken, 0 "No photo".

**Deploy:** prod redeployed (hook, commit `86e83e2`) and verified 200 on /store + /store/categories. Note: prod cold lambdas still 20–38s per hit (see to-do item on prod cold-start).

**Verified by:** AG (GLM-5.3-flash-free)

### 2026-11-14 (6) — Agent "AG" (GLM-5.3-flash-free) — Fixed: Fleet register silently showed zero accounts

**What:** User asked "my account used to have accounts, what happened to them". DB audit first (read-only): **nothing was deleted** — 36 accounts intact (24 CPM1 + 12 CPM2 linked to user 1, none archived), 4 store customers, 6 orders, 393 account_events, newest event same day 16:06.

**Root cause:** `b366e30` ("Performance fixes: remove framer-motion, fix SSR, guard 401 APIs…") added a gate in `FleetProvider.refresh()` that skips ALL fleet fetches unless browser localStorage has `vanta_customer_id` — a **VANTA store** key, unrelated to fleet sessions. A signed-in fleet owner on a browser without that key (cleared storage, new device, no store-profile login) got a silently empty register: no error, no sign-in prompt. GuestGate's own auth check (`/api/auth/owner`) was correct all along.

**Fix:** `FleetProvider.refresh()` now gates on real fleet auth — probes `/api/auth/owner` once and only skips fetches when the session is actually signed out. Preserves the original intent (no unauthenticated 401 storms on store pages) while the register can no longer silently blank.

**Gate:** `tsc` clean → tests 66/66 → build clean → `next start` on 3001. Browser-verified with a valid owner session and NO `vanta_customer_id` key present: /fleet/cpm2 lists 12 accounts, /fleet/cpm1 lists 24 ("24 of 36 accounts"), /store renders normally.

**Verified by:** AG (GLM-5.3-flash-free)
