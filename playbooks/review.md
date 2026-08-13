# review

**Agent:** `flash-review` (read-only challenger)
**Load:** none
**MCP:** Context7 to check library claims; codebase-memory to check callers
**Planner:** none. The orchestrator updates the T3 Code list.
**Do not load:** `tdd`, `diagnosing-bugs`, `grill-with-docs`, `implement`, `aw`

## When

The orchestrator needs an independent check: medium+ risk, high blast radius,
or any red signal after a worker.

## First action

Re-run the declared probes yourself. Ignore the builder's prose.

## Stop

Every check has PASS/FAIL evidence. APPROVE only if every AC is green and no
correctness defect remains. Style-only nits are not required fixes.

## Verify

Named artifact paths exist; required fixes name file + what to change.

## Report

Use the `flash-review` `<report>` schema. Include
`workflow_delta: none|<one concrete edit to this playbook>`.
