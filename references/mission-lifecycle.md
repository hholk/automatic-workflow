# Mission lifecycle

Use this lifecycle for substantial, high-risk, multi-session or explicitly reviewed
work. Small tasks and bounded read-only probes use a v2 `assurance: "direct"` brief;
they retain ordinary evidence and main verification without review fanout or storage.
Reviewed work uses `assurance: "reviewed"`, independent contract and completion
reviews, and a main-owned checkpoint. A long direct task can also checkpoint.

## Intent and preflight

Extend the v2 brief from [execution](execution-v5.md) with authoritative `sources`
and a requirement map:

```js
{
  version: 2, task_id, objective_revision, snapshot_id,
  assurance: "reviewed", objective, success,
  sources: [
    {id: "request", kind: "request", text: originalRequest, source_ref: "user:1"},
    {id: "decision-1", kind: "decision", text: laterDecision, source_ref: "user:2"},
    {id: "rules", kind: "rule", text: relevantConstraints, source_ref: "AGENTS.md"},
  ],
  requirements: [
    {id: "persist", claim: "The saved title survives reload",
     source_ids: ["request", "decision-1"], criterion_ids: [1]},
  ],
}
```

The first source is the original request. Preserve later user decisions in order;
accepted decisions resolve earlier ambiguity without erasing original intent. Include
applicable constraints, not entire transcripts. Exclude credentials and secrets.
Every request/decision source must be represented in the requirement map, and every
criterion must map to a requirement. Structural coverage cannot prove semantic
completeness; main and the independent reviewer inspect the actual source text.

1. Freeze intent and checks. Resolve the existing `review` profile and dispatch a
   fresh read-only [contract reviewer](../workflows/contract-review.md) using
   dispatch purpose `contract_review`. This purpose can run before preflight passes.
2. Main checks requirement coverage and each fake-pass counterexample search.
   Compute `contractDigest(brief)` and bind the record to the actual host reviewer
   ID. Run `node scripts/execution-state-cli.mjs contract` with
   `{brief, review, builder_ids}` on stdin. Open gaps or unknowns require repair.
3. Only a passing review permits `purpose: "work"` dispatch. Preserve existing
   worker caps, isolation, profile availability and authority gates.

The contract digest covers intent, sources, requirement map and versioned checks,
excluding the implementation snapshot. Implementation changes alone do not force
another contract review. Changed intent or checks require a new objective revision
and preflight; their old evidence is invalid.

## Replan at the first wrong artifact

After a discovered gap, call the `replan` gate with `{brief, diagnosis}`:

```js
{
  issue_id: "GAP-001", earliest_invalid_artifact: "validation",
  reason: "The check tests the rendered value but never reloads persisted state",
  evidence_ref: "review:reload-gap", affected_criteria: [1],
  next_action: "Add a reload check and revalidate persistence",
}
```

`scope`/`criteria` require `REVISE_BRIEF`; `topology` requires `REPLAN_TASKS`;
`environment` requires `RESTORE_ENVIRONMENT`; `implementation` requires
`FIX_IMPLEMENTATION`; `validation`/`evidence` require `REPAIR_VERIFICATION`.
Main supplies the concrete replacement plan from the diagnosis. The gate routes
that plan; it cannot discover the cause or author a correct plan by itself.

Record the diagnosis before further work. A revision preserves the original sources,
uses a new objective revision and clears criteria evidence and both reviews.
Restoring a missed requirement needs no new permission; changing requested scope
or authority uses the existing human decision rules. Unfinished work remains
unfinished. Replanning preserves recovery and authority history. Two-probe and
one-recovery limits still apply; a revision is not progress or a fresh budget.

## Durable checkpoint and resume

`node scripts/mission-state-cli.mjs write` takes bounded JSON on stdin:

```js
{
  workspace: "/absolute/project", task_id: "task-a", snapshot_id: "observed-tree",
  event_id: "init-1", expected_sequence: -1,
  brief, next_action: "Review the contract",
}
```

This creates the mission once. Later writes use the returned `sequence`, a unique
event ID, the current observed snapshot, and an `event` instead of `brief`:

```js
{
  workspace, task_id, snapshot_id, event_id: "dispatch-1", expected_sequence: 1,
  event: {type: "dispatch", purpose: "work", workers, integration,
    next_action: "Start the reserved worker with the native host"},
}
```

`workers` and `integration` have the execution gate shapes. The ledger reserves IDs
before native dispatch. After host acceptance, record `attach` with `worker_id` and
the exact `host_task_id`. After observed termination, record `collect` with
`worker_id`, `outcome: "completed" | "cancelled" | "not_started"` and `evidence_ref`.
A reservation without a host ID is an ambiguous start: inspect the host before
retrying. Previously dispatched IDs remain consumed even after collection.

Other events, each with a concrete `next_action`:

- `contract_review` / `completion_review`: `review` record after collecting its worker.
- `evidence`: the current scoped `evidence` array, checked against the current brief.
- `replan`: `diagnosis`; records the issue and invalidates affected evidence and closure.
- `revise`: replacement `brief` and `evidence_ref`; active workers must be reconciled first.
- `snapshot`: new observed `snapshot_id` and `evidence_ref` after integration;
  clears artifact evidence and completion review, preserving unchanged preflight.
- `resolve`: `issue_id` and observed resolution `evidence_ref`.
- `checkpoint`: optional `recovery_record` / `authority_record` using the existing gate
  request shapes; appends decisions and evidence without replacing their histories.
- `accept`: `main_confirmation`; requires both reviews for reviewed work, complete
  current evidence, no active workers, no pending revision and no unresolved issues.

The structured event history preserves the initial brief and every later revision,
review, evidence batch and host-task transition. Invalidated proof remains available
there for inspection; it is excluded from the current evidence and acceptance gate.

Use `node scripts/mission-state-cli.mjs read` with `{workspace, task_id, snapshot_id}`
at every resumed turn. Reconcile returned active/reserved IDs with native tools
before any dispatch. `can_resume: false` requires snapshot revalidation. The write
path also blocks new work, reviews and acceptance on a mismatched snapshot; task
reconciliation and notes remain possible. Snapshot IDs describe the actual integrated
artifact, including uncommitted changes, rather than only the Git HEAD.

The canonical store is `$AW_STATE_DIR/missions/<workspace-and-task-hash>/state.json`,
defaulting to `~/.local/state/aw`. Keep one main writer; workers return evidence.
Writes use an exclusive lock, expected sequence, mode-0600 temporary file, fsync
and atomic rename. Repeating the latest event with identical input returns its
saved result; changed retries and stale sequences fail. State and input are bounded
to one MiB. A corrupt file is rejected rather than replaced. An uncommitted temporary
file is not a checkpoint. No host task is started by this CLI.

An interrupted writer can leave a lock. Read the checkpoint and reconcile the host
first. `recover-lock` takes `{workspace, task_id, event_id}` and removes only a lock
whose exact recorded writer process has exited; a live, changed or malformed lock
stays blocked. Then retry the original event and inspect its saved result. Never
infer a new dispatch from a missing response.

## Independent closure

After integration and current evidence, dispatch a fresh
[completion reviewer](../workflows/completion-review.md) with `purpose:
"completion_review"`. It receives authoritative sources, applicable instructions
and the product, without prior criteria or reports. Main checks its independently
derived requirement map, real behavior evidence and gaps. The `completion` gate
uses `{brief, review, builder_ids}`; the normal acceptance and DONE gates require
this record as well as preflight and main integration proof.

Use actual native identities for `builder_ids`, including main's implementation
and all implementing worker IDs. A builder cannot review its own work. Fresh-context
and source restrictions must be established by the host dispatch; local JSON and
hashes do not authenticate a reviewer or enforce tool isolation. Main inspects the
reports, binds observed identities and owns final acceptance. Unknown checks remain
unknown. A passing checkpoint means accepted completion only after its `accept`
event reaches `status: "done"`.
