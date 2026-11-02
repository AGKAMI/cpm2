# Agent Handoff Protocol Skill

## What this skill does

Installs a strict, auditable handoff system into any coding project so that:
- Every agent edit is **pre-validated by delegated judge agents**
- Every edit is **logged** with who/what/where/why
- Model error costs are **tracked and ranked**
- No code is committed without a green gate

## How to use

1. Read the skill metadata (`skill.yml`) to understand the protocol.
2. Copy `AGENTS_HANDOFF.md` into the target repo at `docs/AGENTS_HANDOFF.md`.
3. Before every edit, follow the 7-step protocol in the skill file.
4. After every edit, update the Agent Activity Log and Model Ranking.
5. Commit only when the gate is green and judge verdicts are recorded.

## When to invoke

- Starting work on a new coding project
- Onboarding a new agent to an existing project
- When multiple agents are editing the same codebase
- When you need to track which AI model is introducing the most bugs

## Output

A clean, audited codebase where every change is attributable, justified, and pre-validated.
