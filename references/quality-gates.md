# Quality Gates

Every deliverable must clear the applicable gates below. A gate that is skipped when required voids the package; never ship on intent, only on evidence.

Canonical schemas live in the brief templates; prompting and recovery define mechanics; this file states the gates. Tiered budgets and review modes live in [config.md](../config.md).

## Artifact Gate

DONE prose is never trusted as proof. Before any work is accepted:

- Confirm produced file(s) exist at the declared path.
- Confirm the artifact holds the intended change (grep/diff/structure).
- Reject "done" by assertion alone; attach a concrete probe result.

Log probe results with `log-trace --kind probe` (command + exit + ≤4000 chars evidence).

## Report Gate

Task returns raw final text inside outer `<task_result>`; no native schema validation:

- Extract exactly one inner `<report>`; require canonical fields.
- INVALID = empty/malformed envelope or missing fields.
- FALSE = valid report contradicted by artifact/probe/test.
- Evidence wins both ways.

An INVALID report + changed artifact may still pass evidence gates; record `report invalid` / `error_class=report_invalid` in the ledger. INVALID + missing/unchanged → recovery routes.

## Test Gates

1. **Target test:** exercise the changed code; prove the intended branch.
2. **Integration pass:** for risk ≥ medium, run the relevant wider module suite after narrow green.
3. Tie each green to the guarded behavior; unrelated greens do not count.

Log with `log-trace --kind verify` and `log-event --kind verify`.

## Adaptive Gauntlet (review_mode)

Not every write needs dual critics. Choose at preflight; upgrade if evidence is weak.

| review_mode | When | What runs |
|-------------|------|-----------|
| `none` | risk=low AND probe OK AND verify_exit=0 | Orchestrator sign-off only |
| `single` | risk=low (if not green) or risk=medium | One `flash-review` combining SPEC+QUALITY checks |
| `dual` | risk=high (default for auth/contracts/migrations/public API) | Two parallel fresh reviews: SPEC axis + QUALITY axis |

Rules:

- Builder never approves its own output when review_mode ≠ none.
- Critics see artifact + reference/AC only — not builder prose/history.
- After Fix attempts, re-run the same review_mode (or escalate low→single if a quality defect appeared).
- Log verdicts with `log-event --kind review` and optional `log-trace --kind report`.

### Spec checks (axis SPEC)

Scope matched, each AC PASS/FAIL with evidence, no undeclared extras.

### Quality checks (axis QUALITY)

Correctness edges, robustness, readability, project conventions — defects SPEC would miss.

## Fix Routing

When reviews or evidence fail:

1. `diagnose --package-row` → `error_class`, `fix_hint`, `next_kind`.
2. Open Fix1/Fix2/(Fix3) with concrete named failures — not a vague re-review.
3. Re-run Artifact + Test + Gauntlet after each fix.

After terminal fix failure the orchestrator implements.

## Final Evidence

A deliverable is complete only with:

- Verification command run + integer exit status
- Artifacts produced (checkable paths)
- Residual risks
- Ledger attempt recorded (outcome, optional error_class, review_mode, risk)

Hard limits (global ceilings — see config for tiers):

- Briefs ≤6000 chars; reports ≤2500; trace evidence ≤4000; summaries ≤240
- Files ≤4; AC ≤10; artifact lines ≤800; tool calls target ≤20

No raw log dumps as user-facing evidence — summarize, cite command+exit, point at artifacts. Prefer structured traces in the ledger over compressed "it failed" scores (Meta-Harness).
