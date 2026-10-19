# Contract review

Main resolves with `--role worker --route review` and dispatches a fresh
read-only `aw-reviewer` with the v2 brief, authoritative sources and applicable
instructions. It receives no builder conclusions.

Independently compare the request and later decisions with the requirement map.
Check every requirement has criteria and every criterion has a meaningful oracle.
For each check, try to construct a fake implementation that passes it while breaking
the promised behavior. Record the counterexample search and any required stronger check.
Preserve the full user scope; a difficult requirement remains required.

Return the worker contract with a review record in EVIDENCE:

```js
{
  version: 1, task_id, objective_revision, contract_digest,
  reviewer_id, fresh_context: true, inputs: "request-and-criteria",
  source_ids, requirement_ids, status: "passed", gaps: [], report_ref,
  checks: [{criterion_id: 1, status: "adequate", counterexample_ref}],
}
```

Use `status: "gaps"` for concrete missing coverage or inadequate checks and
`"unknown"` for unresolved evidence. Each gap names an ID, source ID, expected
behavior, observed deficiency and evidence reference. Report the exact declared
VERIFY command and its observed result; a command pass does not prove semantic adequacy.
Main binds the record to the observed native reviewer identity and checks the report
before running the `contract` gate. Only a complete passing review authorizes work.
