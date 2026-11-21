# Completion review

Main resolves with `--role worker --route review` and dispatches a fresh
read-only `aw-reviewer` after integration, with only the original request, later
accepted decisions, applicable constraints, workspace, observed snapshot and a
narrow behavior VERIFY command. Read applicable AGENTS.md.
Keep prior mission criteria, plans, worker reports, validation reports and closure
claims out of this context. Main attaches the contract digest after review; the
reviewer derives its own requirement map from the authoritative sources.

Inspect the actual artifact under two lenses from `h-code-review`:

- **Standards** checks documented repository rules and accepted constraints.
- **Spec** checks the user's requested behavior and later accepted decisions,
  including relevant flows, persistence, setup and edge cases.

Trace each finding to its source. Apply the counterprobe from `blast-radius`
when a changed seam can affect a caller or side effect. Identify the assumption
that keeps that path safe and run the smallest authorized check that could
falsify it. Record the command and observed result. Keep missing executable
evidence unknown and respect access limits and hidden holdouts. One read-only
reviewer performs both passes and runs any counterprobe within its scope.
Recursive delegation is prohibited.
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
