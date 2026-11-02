# Agent Handoff Protocol

This file is the **single source of truth** for every agent working in this project.
Read it before making any edits. Append to the **Agent Activity Log** after completing work.

## Project Context

| Item | Value |
|------|-------|
| Project | cpm2 — CPM Fleet Ledger |
| Location | C:\Users\ojuni\Documents\GAMES\cpm2 |
| Tech stack | Next.js 16.4.2, React 19.3, Tailwind 4, TypeScript 5, @libsql/client (Turso), Zod |
| Gate command | `npx tsc --noEmit && npm run lint && npm run test && npm run build` |
| Tests | 10 test files in tests/ (auth, carOwners, cars, domain, import, ledger, review, search, telegram, themes) |

## Current State

| Area | Status |
|------|--------|
| Fleet UI | Trophies render as readable G/S/B tallies (not encoded 0111100G) |
| Account scoping | assertEmailFree scopes email uniqueness by game (CPM1 + CPM2 can share email) |
| Deployment | Live on cpm2-bay.vercel.app, Vercel edge cache purged Nov 2 |
| Login | Console-password gated at /login (password field: login-password) |

## Strict Edit Protocol (MANDATORY)

1. **Read** this file and the target file before editing
2. **Delegate 2+ judge agents** to review the planned change
3. **Make** targeted edits (files under 500 lines)
4. **Run the gate** — all checks must pass
5. **Log** your entry in the Activity Log below
6. **Commit** with a descriptive message

## Agent Activity Log

> No entries yet — first agent creates the first entry.

Format:
```
### <date> — <agent-type> (<model-id>)
**What:** <change>
**Where:** <files>
**Why:** <reason>
**Errors introduced:** <N> | **Errors fixed:** <N>
**Gate:** <command> — pass / fail
**Judge verdict:** <PASS/FAIL> — <summary>
```

## Model Error-Cost Ranking

Tracks which AI models introduce vs. fix the most errors.

| Rank | Model ID | Errors Introduced | Errors Fixed | Net Cost |
|------|----------|-------------------|--------------|----------|
| — | — | — | — | — |

## Delegated Judge System

Before any edit is final, spawn 2+ judge agents (`reviewer` or `tester`) to review:
- Full file context
- The exact planned change
- Acceptance criteria (gate green, no regressions, no security holes)

Only proceed when all judges pass.

## Red Lines

- Never commit `.env*`, tokens, or secrets
- Never skip the gate before committing
- Never skip delegated judge review
- Never use `&&` in PowerShell

## Onboarding

New agents: read this file, run the gate once to confirm your environment is green, then start editing.