# Completion review

Main resolves with `--role worker --route review` and dispatches a fresh
read-only `aw-reviewer` after integration, with only the original request, later
accepted decisions, applicable constraints, workspace, observed snapshot and a
narrow behavior VERIFY command. Read applicable AGENTS.md.
Keep prior mission criteria, plans, worker reports, validation reports and closure
claims out of this context. Main attaches the contract digest after review; the
reviewer derives its own requirement map from the authoritative sources.

Inspect the actual artifact and exercise the requested behavior. Check user-visible
flows, persistence, setup and relevant edge cases. Every finding must trace to the
user request or accepted constraints. Code inference alone leaves runnable behavior
unknown when execution is needed. Respect access limits and hidden holdouts.
For changed interfaces, apply [UI/UX acceptance](../references/ui-ux.md) to the
affected task and rendered states; Main owns visual judgment when the reviewer
has only textual observations.

Return the worker contract with a completion record in EVIDENCE:

```js
{
  version: 1, task_id, objective_revision, snapshot_id,
  reviewer_id, fresh_context: true, inputs: "request-and-artifact",
  source_ids, status: "passed", gaps: [], report_ref, coverage_ref,
  verify: {command, exit_code: 0, result: "passed", result_ref},
}
```

Use `"gaps"` for a concrete mismatch and `"unknown"` for missing checks. Each gap
contains ID, source ID, expected behavior, observed behavior and evidence reference.
The coverage report includes the independently derived requirement map and checks.
Main checks the report, records actual native identity and current contract digest,
then runs the `completion` gate. Open gaps and unknowns block acceptance. The
reviewer changes neither product code nor tests to make the result pass.
