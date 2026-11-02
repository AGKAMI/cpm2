# Agent Handoff Protocol — CPM Fleet Ledger

This file is the **single source of truth** for every agent working in this repo. Every agent must read it before making edits, and must append to the **Agent Activity Log** after completing work.

---

## 1. Project Context

| Item | Value |
|------|-------|
| Project | CPM Fleet Ledger |
| Location | `C:\Users\ojuni\Documents\GAMES\cpm2` |
| Tech stack | Next.js 16.4.2, React 19.3.0, TypeScript 5, Turso (libSQL), Tailwind CSS 4 |
| Package manager | npm |
| Ports | Dev: 3002 · Prod: 3457 · Never: 3000 (WhatsApp bridge) |
| Database | `data/cpm2.db` (local SQLite) + `data/cpm2-fleet-server.pid` (PID file) |
| Secrets | `.env.local` (APP_PASSWORD, GEMINI_API_KEY, TELEGRAM_BOT_TOKEN, TURSO_*) — **gitignored, never print/commit** |
| Gate command | `npx tsc --noEmit && npm run lint && npm test && npm run build` |
| Test count | 181 tests / 36 suites (must all pass) |

### Key directories
| Dir | Purpose |
|-----|---------|
| `src/app/` | Next.js App Router pages & API routes |
| `src/components/` | React components (UI, trade desk, garage, settings) |
| `src/lib/` | Core logic (auth, crypto, db, trade, service, validation) |
| `tests/` | Node:test suites (181 tests) |
| `scripts/` | One-off DB loaders, migrations, debug scripts |
| `data/` | SQLite DB + encryption key (gitignored) |

### Navigation (4 tabs only)
`CPM1` · `CPM2` · `Trade` · `Settings` — nothing else.

---

## 2. Current State (as of latest commit)

| Area | Status |
|------|--------|
| Auth | Session cookie (30 days) + Telegram owner binding + reveal-consent gate (5 min) |
| Password storage | AES-256-GCM encrypted at rest (`data/.secret-key`) |
| Fleet DB | Migrated to Turso cloud (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`) |
| Trade desk | Full valuation model (paid/coin/cash), qty steppers, ±3% fairness band |
| Guest trade desk | `/trade/guest` — read-only, no login, verdict only |
| Price book | 210 CPM2 cars priced (11 paid / 166 coin / 33 cash) |
| Fuzzy matcher | Token-overlap required (≥1 shared token), threshold 0.6, exact=1.0 |

---

## 3. Strict Edit Protocol (MANDATORY)

Every agent must follow this workflow **in order**:

### Step 1: Read before editing
- Read the full file you plan to edit.
- Check `AGENTS.md` at repo root for repo-wide rules.
- Check this file (`docs/AGENTS_HANDOFF.md`) for project-specific context.

### Step 2: Delegate judge agents BEFORE editing
- Spawn **at least 2 subagents** (type: `reviewer` or `tester`) with the full context of your planned change.
- Ask them to identify: edge cases, security issues, UI bugs, dead code, duplication.
- Incorporate their feedback into your plan.

### Step 3: Make the edit
- Use `edit` for targeted changes, `write` only for new files.
- Keep files under 500 lines.
- Follow existing naming conventions and patterns.

### Step 4: Self-validate
- Run `npx tsc --noEmit`
- Run `npm run lint`
- Run `npm test`
- Run `npm run build`
- Restart prod and smoke-test `curl http://127.0.0.1:3457/login` → expect `200`

### Step 5: Document in Agent Activity Log
- Append your entry to Section 4 of this file immediately after the gate passes.

### Step 6: Commit
- Commit with a descriptive message.
- Do **not** commit secrets, `.env*`, `production`, or debug scripts.

---

## 4. Agent Activity Log

Format per entry:
```
### <date> — <agent-type> (<model-id>)
**What:** <summary of change>
**Where:** <file paths>
**Why:** <reason>
**Errors introduced:** <count> | **Errors fixed from other agents:** <count>
**Gate:** tsc · lint · test · build — all pass / fail
**Judge verdict:** <pass/fail> — <judge-agent-summary>
```

> No entries yet — first agent to work here creates the first entry.

---

## 5. Model Performance Ranking (Error Cost Tracking)

This table tracks which agent models introduce the most errors (that other agents must fix) and which fix the most. Updated by agents when they fix another agent's error.

| Rank | Model ID | Errors Introduced | Errors Fixed | Net Cost (Introduced − Fixed) | Last Error Type |
|------|----------|-------------------|--------------|-------------------------------|-----------------|
| — | — | — | — | — | — |

> **How to update:** When Agent B fixes an error made by Agent A, Agent B increments "Errors Introduced" for Agent A's model and "Errors Fixed" for their own model, then re-sorts by Net Cost descending.

---

## 6. Delegated Judge System

Before any edit is considered complete:

1. **Delegate 2+ judge agents** (type: `reviewer` or `tester`) with:
   - Full file context (read the file first, paste relevant sections)
   - The exact planned change (diff or description)
   - The acceptance criteria (gate green, no UI regressions, no security holes)
2. **Judges report back:** pass / fail / conditional with required changes.
3. **Final verdict:** Only proceed if all judges pass. If any judge fails, revise and re-judge.
4. **Record verdict** in the Activity Log (Section 4).

**Judge prompt template:**
```
You are reviewing a planned code change for the CPM Fleet Ledger project.

File: <path>
Planned change: <description>
Acceptance criteria:
- npx tsc --noEmit must pass
- npm run lint must pass (0 errors)
- npm test must pass (181/181)
- npm run build must pass
- No secrets committed
- No UI regressions
- No security holes (auth bypass, SQL injection, exposed endpoints)

Report: PASS / FAIL / CONDITIONAL. If FAIL or CONDITIONAL, list required fixes.
```

---

## 7. Commit & Gate Requirements

Before committing, **all** must be true:
- [ ] `npx tsc --noEmit` — exit 0
- [ ] `npm run lint` — exit 0
- [ ] `npm test` — all tests pass
- [ ] `npm run build` — exit 0
- [ ] Prod restarted on port 3457, `curl /login` → `200`
- [ ] No `.env*`, `production`, or token files committed
- [ ] Activity log updated
- [ ] Judge verdict recorded

**PowerShell note:** PowerShell does NOT support `&&`. Use `;` or `if ($LASTEXITCODE -eq 0)` chains.

---

## 8. Onboarding for New Agents

1. Read `AGENTS.md` at repo root (behavioral rules, file organization, project architecture).
2. Read this file (`docs/AGENTS_HANDOFF.md`) in full.
3. Read `src/lib/car-catalog.ts` — understand the code-keyed catalog (codes collide across games; always pass `game` discriminator).
4. Read `src/lib/trade.ts` — understand the valuation model (paid = Rands, coin = coins × rate, cash = cash × rate) and `tradeVerdict` sign convention (delta = get − give).
5. Read `src/lib/auth.ts` and `src/lib/crypto.ts` — understand session signing vs password encryption keys.
6. Check `.env.local` exists (never print or commit it).
7. Run the gate once to confirm your environment is green before making changes.

---

## 9. Red Lines (Never Do These)

- ❌ Commit `.env.local`, `production`, or any token/secret file
- ❌ Commit `scripts/apply-prices.cjs` (duplicate one-off) — it's gitignored
- ❌ Commit test data or debug scripts to root
- ❌ Use `&&` in PowerShell (use `;` or `if` chains)
- ❌ Skip the gate before committing
- ❌ Skip delegated judge agents before finalizing an edit
- ❌ Add navigation tabs beyond CPM1/CPM2/Trade/Settings
- ❌ Add emoji icons — SVG icons only
- ❌ Hardcode API keys or credentials in source files

---
