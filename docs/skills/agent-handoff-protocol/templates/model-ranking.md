# Model Error-Cost Ranking Template

Copy this table into `docs/AGENTS_HANDOFF.md` Section 5. Update it whenever an agent fixes another agent's error.

| Rank | Model ID | Errors Introduced | Errors Fixed | Net Cost | Last Error Type | Last Fixed Type |
|------|----------|-------------------|--------------|----------|-----------------|-----------------|
| 1 | — | 0 | 0 | 0 | — | — |
| 2 | — | 0 | 0 | 0 | — | — |
| 3 | — | 0 | 0 | 0 | — | — |

### Update Rules

When Agent B fixes an error introduced by Agent A:

1. Increment **Errors Introduced** for Agent A's model ID
2. Increment **Errors Fixed** for Agent B's model ID
3. Recompute **Net Cost** = Introduced − Fixed
4. Re-sort the table by Net Cost descending (highest cost first)
5. Record the error type and fix type in the last two columns

### Example Update

Agent A (model-a) introduced a UI bug where the guest trade desk had no "+ Car" button. Agent B (model-b) fixed it by adding the `TradeCarPickerModal`.

| Rank | Model ID | Errors Introduced | Errors Fixed | Net Cost |
|------|----------|-------------------|--------------|----------|
| 1 | model-a | 1 | 0 | 1 |
| 2 | model-b | 0 | 1 | -1 |

### Interpretation

- **High Net Cost** = model introduces more errors than it fixes → needs more judge scrutiny or simpler prompts
- **Negative Net Cost** = model fixes more than it introduces → good refactoring/cleanup agent
- **Zero** = balanced or new model with no tracked history
