# Agent Handoff Protocol Skill

## What this skill does

Installs a **strict, auditable handoff system** into any coding project so that:

- Every agent edit is **pre-validated by delegated judge agents** (2+ sub-agents review before finalizing)
- Every edit is **logged** with who/what/where/why and errors introduced/fixed
- Model error costs are **tracked and ranked** — see which AI models introduce vs. fix the most bugs
- No code is committed without a green gate (tsc, lint, tests, build)
- Agents provide **summarized explanations** validated by delegated judge agents

## How to use

1. **Install** — Copy `skill.yml`, `README.md`, and `templates/` into your project's
   skills directory (e.g., `.opencode/skills/agent-handoff-protocol/` or
   `docs/skills/agent-handoff-protocol/`).
2. **Initialize** — Copy `AGENTS_HANDOFF.md` into your project at `docs/AGENTS_HANDOFF.md`
   and fill in the project-specific placeholders (`<PROJECT_NAME>`, `<TECH_STACK>`,
   `<GATE_COMMAND>`, `<TEST_COUNT>`).
3. **Invoke** — Before any edit, tell your agent to follow the Agent Handoff Protocol.
   The agent will:
   - Read context first
   - Delegate 2+ judge agents to review the planned change
   - Incorporate judge feedback
   - Make the edit
   - Run the gate
   - Log the edit in the activity log
   - Commit only when everything is green

## When to invoke

- Starting work on a new coding project
- Onboarding a new agent to an existing project
- When multiple agents are editing the same codebase
- When you need to track which AI model is introducing the most bugs
- When you want strict, audited code changes with judge validation

## Output

A clean, audited codebase where every change is:

- **Attributable** — who (agent type + model ID) made each change
- **Justified** — why the change was made
- **Pre-validated** — judge agents approved it before implementation
- **Gate-green** — tsc, lint, tests, build all pass
- **Ranked** — model error costs are tracked and visible
