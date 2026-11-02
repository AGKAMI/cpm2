# Agent Handoff Protocol

This file is the **single source of truth** for every agent working in this project.
Read it before making any edits. Append to the **Agent Activity Log** after completing work.

## Project Context

| Item | Value |
|------|-------|
| Project | <PROJECT_NAME> |
| Location | <REPO_PATH> |
| Tech stack | <TECH_STACK> |
| Gate command | <GATE_COMMAND> |
| Tests | <TEST_COUNT> (must all pass) |

## Current State

| Area | Status |
|------|--------|
| <AREA_1> | <STATUS_1> |
| <AREA_2> | <STATUS_2> |

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