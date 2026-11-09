# HANDOFF NOTE FOR ZION — READ THIS FIRST

## Context
Kermes (Oracle persona) is temporarily stepping away from VANTA GARAGE / CPM2 app work to complete KAMI's ADPJ102 (Advanced Programming in Java) practice assignment. Zion should continue with the app while Kermes handles the assignment.

## Skills Paths (for Zion's reference)
- **Main skills directory**: `C:\Users\ojuni\AppData\Local\hermes\skills`
- **Zion profile skills**: `C:\Users\ojuni\AppData\Local\hermes/profiles/zion/skills` (55 skills available)
- **Kermes profile skills**: `C:\Users\ojuni\AppData\Local\hermes/profiles/kermes/skills`

## Current App State (VANTA GARAGE — CPM2 Storefront)
- **Working dir**: `C:/Users/ojuni/Documents/GAMES/cpm2`
- **Branch**: master
- **Git remote**: `https://github.com/AGKAMI/cpm2`
- **Live URL**: `https://cpm2-bay.vercel.app` (alias; new builds deploy via `vercel deploy --prod` or git push → Vercel auto-deploy)
- **Database**: Turso (libsql) — `libsql://kami-cpm-fleet-agkami.aws-us-east-1.turso.io`
- **Stack**: Next.js 16.4.2, React 19.3, Tailwind 4, TypeScript 5, @libsql/client (Turso), Zod

## What's Done
- All store pages force-dynamic for SSR hydration in regular browser + Telegram Mini App
- Admin product manager: add/edit/publish/delete products (soft delete = unpublish + unavailable + stock=0)
- Delete/publish preserve scroll position (`window.scrollY` save/restore)
- Add product form behind toggle button (not always open)
- Promo cards are now dynamic from `/api/store/promotions` API — fully customizable via admin (colors, image, text, CTA, discount, active/sort order)
- Admin page has full Promotions CRUD section
- Email/password auth (register/login/logout/profile), dark mode, order notifications
- Telegram initData auth for Mini App, session cookie for web
- Event-driven Telegram notifications (payment verified/rejected, delivery scheduled, PayFast webhook)
- 6 products published in DB (IDs 19-24), all with stock=10, categorized (1=SUV, 2=Offroad, 3=4x4)
- Products 19-23 have media images; product 24 has no image

## What's Remaining / Blocked
- Product create/edit modal: admin page has "Add Product" toggle form (inline), but no image upload UI yet
- Image upload for products: not implemented (only URL input + data URL converter)
- Browser hydration verification: done (pages render in regular browser)
- Admin tabs only visible inside Telegram Mini App (requires X-Telegram-Init-Data header)
- PayFast webhook not yet configured on PayFast dashboard
- EFT review page approve/reject notifications: end-to-end not tested with Telegram-linked customer
- Owner dashboard: loading state only without Telegram auth

## Key Files
- `src/app/store/admin/page.tsx` — admin product + promotion manager
- `src/components/StoreHomeClient.tsx` — home page with dynamic promotions
- `src/app/api/store/promotions/route.ts` — public promotions list
- `src/app/api/store/admin/promotions/route.ts` — admin promotions CRUD
- `src/lib/store/client.ts` — vantaApi client
- `src/lib/store/products.ts` — promotion/listing service
- `src/app/globals.css` — design system (CSS variables from vanta-claude prototype)

## Design Reference
- `C:/Users/ojuni/Downloads/vanta-claude/index.html` (103KB prototype) — exact design tokens

## Note for Zion
KAMI's instruction: "use all the design skills u have for the best they offer." Load `design-index` first, then relevant sub-skills (`better-layout`, `emil-design-eng`, `visual-hierarchy`, etc.) for any UI work. Never hand-roll styling from memory when design skills are available.

SLANG REGISTER: Default is slang (SA kasi/tsotsitaal/Kaaps words inside English sentences). Never full Afrikaans sentences/clauses. Strip test: remove slang words — what remains must be working English.

-- Kermes (Oracle), handing off to Zion
