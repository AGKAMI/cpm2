# Agent Log Entry Template

Copy this block for each work session. Append to `docs/AGENTS_HANDOFF.md` Section 4.

```
### <YYYY-MM-DD> — <agent-type> (<model-id>)
**What:** <one-line summary of the change>
**Where:** <file1>, <file2>, ...
**Why:** <business or technical reason for the change>
**Errors introduced:** <N> | **Errors fixed from other agents:** <N>
**Gate:** tsc ✓ · lint ✓ · test ✓ · build ✓
**Judge verdict:** <PASS/FAIL> — <summary of judge agent findings>
**Summarized explanation:** <2-3 sentence plain-language summary of what changed and why>
```

### Example

```
### 2026-11-02 — coder (nemotron-3.5-super-vl-120b-a12b)
**What:** Added rate limiting to public trade routes (prices, rates, identify)
**Where:** src/app/api/trade/prices/route.ts, src/app/api/trade/rates/route.ts, src/app/api/trade/identify/route.ts
**Why:** Prevent abuse of public endpoints; identify route calls paid Gemini API
**Errors introduced:** 0 | **Errors fixed from other agents:** 0
**Gate:** tsc ✓ · lint ✓ · test ✓ · build ✓
**Judge verdict:** PASS — two reviewer agents confirmed no auth bypass, no UI regressions
**Summarized explanation:** Added per-IP rate limiting (10 req/min) to three public trade API routes so the identify endpoint (which calls a paid Gemini API) and the public prices/rates endpoints cannot be abused.
```
