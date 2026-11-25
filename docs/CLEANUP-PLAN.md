# CPM2 — Repo Cleanup Plan

Audit date: 2026-11-25. **Nothing in this list has been deleted, moved or edited.** This document
exists so the owner can approve removals safely. Every recommendation below was checked against
the code: none of these files are imported or referenced by `src/`, `tests/` or `scripts/`, and
deleting them is not expected to change `npm run typecheck`, `npm test` or `npm run lint`.

Approve section by section; each file can be restored from git history (or `git stash`) if a
recommendation turns out wrong.

## 1. Root-level debug `.cjs` scripts — 22 files, recommendation: DELETE

One-off probes from the old-UI sessions (titanium/oklch colour hunting, footer/theme patches,
test-account CRUD). Zero references from anywhere in the app, and `eslint.config.mjs` already
excludes `*.cjs` from lint. The maintained scripts live in `scripts/`.

```
check-accounts.cjs        one-off probe of old test accounts — delete
check-accounts2.cjs       same, take 2 — delete
check-accounts3.cjs       same, take 3 — delete
check-css.cjs             old-UI colour check — delete
check-line.cjs            one-line grep helper — delete
check-oklch-final.cjs     oklch colour check on removed styles — delete
debug-color.cjs           colour debugging on old palette — delete
debug-css.cjs             old-UI style probe — delete
debug-css2.cjs            same, take 2 — delete
debug-footer.cjs          old footer probe — delete
debug-test2.cjs           ad-hoc DOM dump — delete
debug-test-read.cjs       ad-hoc read probe — delete
debug-titanium.cjs        titanium colour check on removed UI — delete
delete-test-accounts.cjs  destructive test-data cleanup, already run — delete
find-color.cjs            colour search on old UI — delete
find-exact.cjs            colour search on old UI — delete
find-exact2.cjs           same, take 2 — delete
find-exact-titanium.cjs   titanium search on removed UI — delete
fix-accounts.cjs          patched old test data — delete
fix-colors.cjs            hard-coded colour rewrite on old UI — delete
fix-footer.cjs            old footer one-liner — delete
fix-theme.cjs             old theme one-liner — delete
```

## 2. Superseded handoffs — recommendation: DELETE the root copy, ARCHIVE the two HANDOFF files

```
AGENTS_HANDOFF.md         168K root copy, stale; docs/AGENTS_HANDOFF.md is now the current
                          handoff (its header says it supersedes this file) — delete once the
                          owner confirms docs/ has everything still needed
HANDOFF-FOR-ZION.md       3.8K scoped handoff for a specific agent session — archive (move to
                          docs/archive/) or delete; superseded by docs/AGENTS_HANDOFF.md
HANDOFF-CAR-CATALOG.md    7.1K historical scope note for the catalogue work — archive; useful
                          provenance, not a live contract
```

## 3. Design / review artifacts — recommendation: ARCHIVE

```
index.html                114K standalone design concept, not referenced by the Next.js app
                          (the app's entry is src/app/layout.tsx) — archive; delete if the
                          concept is already shipped
REVIEW.md                 6.2K point-in-time review — archive, or fold the still-valid points
                          into docs/AGENTS_HANDOFF.md first
```

## 4. Log files — recommendation: DELETE

```
server-output.log         158B stale dev-server banner (port 3001) — delete
dev.log                   804B dev log — delete (secondary)
dev-run.log               19K dev run log — delete (secondary)
dev-run-2.log             536B dev run log — delete (secondary)
```

## 5. Root `production` file — recommendation: ROTATE THE TOKEN, then DELETE

```
production                 1.3K written by the Vercel CLI; contains a live
                          VERCEL_OIDC_TOKEN="eyJhbG..." value. It is gitignored
                          (.gitignore:54) and was never committed, so it is a local
                          exposure only — but if the file was ever shared or the box is
                          not fully trusted, revoke that token in the Vercel dashboard,
                          then delete the file (Vercel CLI regenerates it on login).
```

## 6. Other strays noticed during the audit — recommendation: DELETE unless noted

```
nul                       0B Windows redirect artifact (`> nul`), gitignored — delete
cpm2.db                   0B empty root SQLite leftover; the app now uses remote Turso —
                          delete (data/cpm2.db is the same story but is in data/, not root)
demo.tsx                  208B scratch component, not routed from anywhere, IS covered by
                          tsconfig include — delete
verify-notif-cols.mjs     1.4K one-off column probe — delete
e2e-cart.py               1.8K ad-hoc Playwright-free probe — delete
e2e-cart2.py              1.5K same, take 2 — delete
e2e-cart-prod.py          3.7K same, production target — delete
probe-cookies.py          1.1K ad-hoc probe — delete
probe-notif.py            1.2K ad-hoc probe — delete
probe-notif2.py           1.5K same, take 2 — delete
fix_storehome.py          3.8K one-off patch script (already applied) — delete
data/fleet-server.pid     stale PID file for the old local fleet server — delete
```

## 7. Explicitly NOT in this plan — recommendation: KEEP

```
.env.example               referenced by the README env table
.env.local / .env.vercel-production   secrets, gitignored — never delete blindly
scripts/                   maintained operational + seed scripts (telegram-bot.mjs,
                           migrate-to-turso.mjs, seed-*.mjs, …) — keep
docs/                      documentation — keep
.github/workflows/ci.yml   new CI gate — keep
```