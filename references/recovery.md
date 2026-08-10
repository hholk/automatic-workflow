# Recovery

## Artifact-first result handling

After every writer, probe expected files/symbols and run the narrowest AC command. Reports do not determine status.

- **Changed:** verify and (if required) review; never resend the original brief.
- **Empty/intro-only with changed artifact:** treat as implementation and judge the artifact.
- **Missing/unchanged:** record `no_op` or `failed` with `error_class`; `diagnose`; next Fix.
- **Flaky:** reproduce; isolate timing/state; then Fix with evidence.
- **External access/credentials:** `blocked` + human gate.

Always write ledger immediately:

```bash
python3 ~/.config/opencode/skills/flash-orchestrator/scripts/ledger.py record-attempt \
  --package-row "$PACKAGE_ROW" --kind initial \
  --artifact missing --verify-exit 1 --outcome failed \
  --summary "Empty report; plan artifact missing" \
  --trace-evidence "probe: test -f plan.md → 1" \
  --risk medium --review-mode single
```

Then:

```bash
python3 .../ledger.py diagnose --package-row "$PACKAGE_ROW"
# → error_class, fix_hint, next_kind
```

## Three disjoint report cases

- **A — INVALID report:** empty OUTER `<task_result>` or malformed INNER `<report>`. Probe first; never trust `status`.
- **B — FALSE report:** valid report contradicted by evidence. Attempt failed even if `status: DONE`.
- **C — Valid report + matching evidence:** continue gates / adaptive gauntlet.

## task_id rule

- ONE report-only resume **only** after INVALID (Case A), **only** to request the corrected report, with `no edits` boundary.
- Resume reuses the same child context (task_id); does **not** count as Fix1/2/3.
- If resumed report is still INVALID, stop resuming.
- Initial/Fix1/Fix2/Fix3 and all critics use NEW tasks with no task_id.

## Artifact semantics

- INVALID + changed artifact: do NOT resume; run probe/tests/gauntlet; may accept on evidence; ledger `report_invalid`.
- INVALID + unchanged/missing: one report-only resume; then Fix/split from evidence.
- FALSE DONE: no resume; next Fix via `diagnose`.

## Diagnose → Fix mapping (Meta-Harness credit assignment)

| error_class | Typical next action |
|-------------|---------------------|
| empty_report | Fresh worker; schema verbatim; write-before-report |
| step_limit | Split or narrow FIRST ACTION; raise effective tool use within tier |
| provider_error | One identical retry; else blocker (not a Fix burn) |
| quality_nit | Fix with QUALITY required_fixes only |
| spec_fail | Fix with failed AC list |
| scope_too_big | Split packages; do not Fix monolith |
| test_fail | Fix1 with command+stderr tail from traces |
| no_op | Next brief must name exact before/after |
| path_blocked | Wait lock / reassign |
| report_invalid | Evidence path or one resume |
| unknown | Probe; prefer split over blind retry |

## Exactly three fixes (HIGH); two for LOW/MED

1. Fix1 — symptom + diagnose
2. Fix2 — cause + narrower symbols
3. Fix3 — mechanical patch (default only for HIGH; after Fix2 LOW/MED → orchestrator)

Each is one fresh `flash-worker` on **Luna**, NEW task, one iteration. After each attempt: probe, verify, adaptive gauntlet. No Fix4. After terminal failure, orchestrator implements; if that fails → human gate.

## Blocked package

Keep dependents pending. Continue path-disjoint ready work. Ask human only for credentials, destructive approval, product decision, contradictory DoD, or post-orchestrator integration failure.

## Stale hygiene

```bash
python3 .../ledger.py reap-stale --hours 6
```

Closes zombie `running` packages/runs so the ledger stays trustworthy for `similar`/`lessons`.
