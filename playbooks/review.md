# review

**Agent:** `flash-review` (native background read-only challenger)
**Profile path:** `agents/opencode/` (canonical; do not create `profiles/`).
**Load:** none
**MCP:** Context7 to check library claims; codebase-memory to check callers
**Planner:** Main refreshes the full Todo before `aw_spawn`.
**Do not load:** `tdd`, `diagnosing-bugs`, `grill-with-docs`, `implement`, `aw`

## When

Parallel progress is optional leverage for independent review or verification;
keep fan-out minimal, avoid overlapping writes, and reconcile before final
verification. Native `aw_spawn` remains stable; experimental `background=true`
support is not required.

The orchestrator needs an independent check: medium+ risk, high blast radius,
or any red signal after a worker. Review uses asynchronous `aw_spawn`; pull results explicitly with `aw_status`/`aw_read`.

After every meaningful feedback, result, or checkpoint, append a compact
structured `LESSONS.md` entry, including routine success, with Date,
Todo/Playbook, feedback/result, symptom/evidence, root cause or contributing
factor, routing/intervention, prevention lesson, and status
`pending|promoted|validated`. Omit secrets, private full prompts, complete tool
history, and entire diffs; proactively propose prevention.

## First action

Re-run the declared probes yourself. Ignore the builder's prose.

## Stop

Every check has PASS/FAIL evidence. APPROVE only if every AC is green and no
correctness defect remains. Style-only nits are not required fixes.

Review must run one-to-one simulation assertions for every declared fixture and
precedence probes for context versus Sol help and protected work versus the
default risk route.

## Verify

Named artifact paths exist; required fixes name file + what to change.

## Report

Use the `flash-review` `<report>` schema. Include
`workflow_delta: none|<one concrete edit to this playbook>`.

Close with exactly three numbered next steps; the third is a guarded Matt
Pocock release that reviews current diff/base, updates target-project docs,
runs tests, resolves findings, then waits for explicit human approval before
commit, push, and deploy.
