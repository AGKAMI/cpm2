# Agent Handoff Protocol — Project-Specific Handoff File

Copy this file into your project at `docs/AGENTS_HANDOFF.md` and fill in the
placeholders marked with `<ANGLE_BRACKETS>`.

---

# Agent Handoff Protocol — <PROJECT_NAME>

This file is the **single source of truth** for every agent working in this repo.
Every agent must read it before making edits, and must append to the **Agent
Activity Log** after completing work.

---

## 1. Project Context

| Item | Value |
|------|-------|
| Project | <PROJECT_NAME> |
| Location | <REPO_PATH> |
| Tech stack | <TECH_STACK> |
| Package manager | <PACKAGE_MANAGER> |
| Ports | <DEV_PORT> (dev) · <PROD_PORT> (prod) · Never: <FORBIDDEN_PORT> |
| Database | <DB_LOCATION> |
| Secrets | <SECRETS_FILE> — **gitignored, never print/commit** |
| Gate command | <GATE_COMMAND> |
| Test count | <TEST_COUNT> tests / <TEST_SUITES> suites (must all pass) |

### Key directories
| Dir | Purpose |
|-----|---------|
| `<SRC_DIR>/` | Source code |
| `<TESTS_DIR>/` | Test suites |
| `<SCRIPTS_DIR>/` | One-off scripts, migrations, debug scripts |
| `<DATA_DIR>/` | Database, encryption keys (gitignored) |

### Navigation / Key Areas
<KEY_NAV_DESCRIPTION>

---

## 2. Current State (as of latest commit)

| Area | Status |
|------|--------|
| <AREA_1> | <STATUS_1> |
| <AREA_2> | <STATUS_2> |
| <AREA_3> | <STATUS_3> |

---

## 3. Strict Edit Protocol (MANDATORY)

Every agent must follow this workflow **in order**:

### Step 1: Read before editing
- Read `AGENTS.md` (repo root) and `docs/AGENTS_HANDOFF.md`.
- Check this file for project-specific context.
- Read the target file fully before editing.

### Step 2: Delegate judge agents BEFORE editing
- Spawn **at least 2 subagents** (type: `reviewer` or `tester`) with the full
  context of your planned change.
- Ask them to identify: edge cases, security issues, UI bugs, dead code,
  duplication.
- Incorporate their feedback into your plan.

### Step 3: Make the edit
- Use targeted edits. Keep files under 500 lines.
- Follow existing naming conventions and patterns.

### Step 4: Self-validate
- Run your project's gate command (e.g., `npx tsc --noEmit`,
  `npm run lint`, `npm test`, `npm run build`).
- Restart prod and smoke-test.

### Step 5: Document in Agent Activity Log
- Append your entry to Section 4 of this file immediately after the gate passes.

### Step 6: Commit
- Commit with a descriptive message.
- Do **not** commit secrets, `.env*`, or debug scripts.

---

## 4. Agent Activity Log

Format per entry:

```
### <YYYY-MM-DD> — <agent-type> (<model-id>)
**What:** <summary of change>
**Where:** <file paths>
**Why:** <reason>
**Errors introduced:** <count> | **Errors fixed from other agents:** <count>
**Gate:** <gate-command> — all pass / fail
**Judge verdict:** <pass/fail> — <judge-agent-summary>
**Summarized explanation:** <2-3 sentence plain-language summary>
```

> No entries yet — first agent to work here creates the first entry.

---

## 5. Model Performance Ranking (Error Cost Tracking)

This table tracks which agent models introduce the most errors (that other
agents must fix) and which fix the most. Updated by agents when they fix
another agent's error.

| Rank | Model ID | Errors Introduced | Errors Fixed | Net Cost | Last Error Type | Last Fixed Type |
|------|----------|-------------------|--------------|----------|-----------------|-----------------|
| — | — | — | — | — | — | — |

### Update Rules

When Agent B fixes an error made by Agent A:

1. Increment **Errors Introduced** for Agent A's model ID
2. Increment **Errors Fixed** for Agent B's model ID
3. Recompute **Net Cost** = Introduced − Fixed
4. Re-sort the table by Net Cost descending
5. Record the error type and fix type in the last two columns

---

## 6. Delegated Judge System

Before any edit is considered complete:

1. **Delegate 2+ judge agents** (type: `reviewer` or `tester`) with:
   - Full file context (read the file first, paste relevant sections)
   - The exact planned change (diff or description)
   - The acceptance criteria (gate green, no UI regressions, no security holes)
2. **Judges report back:** pass / fail / conditional with required changes.
3. **Final verdict:** Only proceed if all judges pass. If any judge fails,
   revise and re-judge.
4. **Record verdict** in the Activity Log (Section 4).

### Judge prompt template

```
You are reviewing a planned code change for the <PROJECT_NAME> project.

File: <path>
Planned change: <description>
Acceptance criteria:
- <gate-command> must pass
- Lint must pass (0 errors)
- Tests must pass (<TEST_COUNT>/<TEST_COUNT>)
- Build must pass
- No secrets committed
- No UI regressions
- No security holes (auth bypass, SQL injection, exposed endpoints)

Report: PASS / FAIL / CONDITIONAL. If FAIL or CONDITIONAL, list required fixes.
```

---

## 7. Commit & Gate Requirements

Before committing, **all** must be true:
- [ ] Gate command passes (exit 0)
- [ ] Lint passes (0 errors)
- [ ] Tests pass (<TEST_COUNT>/<TEST_COUNT>)
- [ ] Build passes (exit 0)
- [ ] Prod/smoke test passes
- [ ] No `.env*`, `production`, or token files committed
- [ ] Activity log updated
- [ ] Judge verdict recorded

---

## 8. Onboarding for New Agents

1. Read `AGENTS.md` at repo root (behavioral rules, file organization,
   project architecture).
2. Read this file (`docs/AGENTS_HANDOFF.md`) in full.
3. Read the project's core source files — understand the domain model,
   key types, and conventions.
4. Check `.env.local` exists (never print or commit it).
5. Run the gate once to confirm your environment is green before making
   changes.

---

## 9. Red Lines (Never Do These)

- ❌ Commit `.env.local`, `production`, or any token/secret file
- ❌ Commit debug scripts or test data to root
- ❌ Use `&&` in PowerShell (use `;` or `if` chains)
- ❌ Skip the gate before committing
- ❌ Skip delegated judge agents before finalizing an edit
- ❌ Hardcode API keys or credentials in source files

---
