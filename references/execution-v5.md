# Execution v5

`scripts/execution-state.mjs` exports pure decision functions. They do not call
models, execute commands, persist state, create worktrees, dispatch workers or
change host permissions. Main invokes the relevant gate before an action.
[Mission lifecycle](mission-lifecycle.md) defines review records, replanning and
the main-owned durable ledger. Host permissions still apply after a gate allows an action.

## Objective and acceptance

Before dispatch, call `validateTaskBrief(brief)`. Version 2 replaces the old brief:

```js
const brief = {
  version: 2,
  assurance: "direct",
  task_id: "task-a",
  objective_revision: "objective-2",
  snapshot_id: "tree-3",
  objective: "Fix title saving",
  success: [{
    id: 1,
    claim: "Saving preserves the entered title",
    verify: {
      check_id: "save-behavior",
      check_version: "1",
      command: "npm test",
      expected: "The saved title equals the entered title",
    },
  }],
}
```

The objective is at most 500 characters. SUCCESS has 1 to 32 criteria numbered
from 1, each at most 300 characters, with a named versioned check, exact command
and observable expected result. Main must judge whether each statement is
falsifiable and covers the user's goal. Structural validation cannot prove that
an assertion or a command tests the intended behavior. Change the objective
revision when the goal or criteria change. Update the snapshot after a material
source, environment or UI state change.

Each evidence record has `version: 1`, `task_id`, `objective_revision`,
`snapshot_id`, `criterion_id`, `check_id`, `check_version`, `evidence_ref`,
`status: "passed"` and `verify: {command, exit_code: 0, result: "passed",
result_ref}`. References must point to actual inspectable output or artifacts.

Call `assessAcceptance({brief, evidence, main_confirmation, contract_review,
completion_review, builder_ids})` after integration. Reviewed briefs require both
fresh reviews; direct briefs require no review records. See the mission lifecycle
for sources, requirement coverage and reviewer inputs. Evidence and main
confirmation retain their version 1 schema.
Every criterion needs a passing evidence record matching the current task,
objective revision, snapshot, check ID, check version and command. The gate
rejects stale, foreign, unknown and failed records, including extra records in an
otherwise complete batch. Exclude invalid historical records from the submitted
batch, but retain them in the history.

Main confirmation has `version: 1`, the same three scope fields, `actor: "main"`,
`integrated: true`, `status: "passed"`, `evidence_ref`, `criterion_ids` covering
all criteria exactly once, `evidence_refs` naming every submitted evidence record
exactly once, and its own passing `verify` object. Main must inspect the semantic
result and verify the full integrated outcome. A worker DONE or a zero exit code
alone is insufficient. Acceptance returns `accepted`, a stable `reason`, and full
`coverage` on success.

The existing `scripts/gate.mjs` entrypoint now enforces this same final gate.
A plain-text DONE report is preliminary even when VERIFY and coverage pass.
For final acceptance, pass JSON `{message, acceptance}` on stdin, where
`acceptance` is the scoped input above. Empty coverage such as 0/0 cannot pass.
Do not treat an old worker-only VERIFIED label as current task acceptance.

`assessEvidenceReuse({evidence, context})` uses the same conservative checks.
Context requires the scope fields plus `criterion_id`, `check_id`,
`check_version`, and `command`. A missing or changed value invalidates reuse.
Re-run only affected checks when their scope can be established. Unknown scope
requires a fresh check.

## Strategy and model routing

Call `routeMilestone` only at `start`, `evidence_change`, `integration` or
`recovery`. Inputs are `event`, `required_capabilities`, `selected_profile_id`,
`profiles`, `costs`, and optional `baseline_cost`. Without `selected_profile_id`,
the router chooses the first tested capable profile in the supplied preference
order. Put proven existing paths first. An explicit selection must qualify and
never silently falls back. Each profile
contains `id`, `strategy`, `model`, `capabilities`, `tested: true`, and nonempty
`evidence_refs`. The function returns that strategy and model only if the
selected profile qualifies. It never invents a profile, a fallback or model name.
Do not re-route on every tool call. Use the returned strategy through the next
milestone unless a new material constraint requires stopping.

The cost ledger contains every main, worker, teacher, handoff and test cost as
`{role, amount, currency}`. Record zero explicitly for unused roles. Multiple
entries per role include repeated turns and handoffs. All five roles must have
known nonnegative amounts in the same currency before `total_cost` is known.
Unknown amounts or mixed units yield `total_cost: null` and `savings: null`.
`baseline_cost: {amount, currency}` must use the same unit for a savings claim.
Negative savings report an increase. A cheaper worker alone does not establish a
cheaper run.

## No progress and cycles

Call `assessRecovery(request)` with `task_id`, `objective_revision`, `blocker_id`,
`state_id`, `unresolved: true`, `last_progress_sequence`, `recovery_count` and
`attempts`. Keep at most 32 attempts in the active ledger; archive older history.
Sequences are nonnegative integers and attempt IDs are unique. Each attempt uses
the same four scope IDs plus:

```js
{
  attempt_id: "probe-1", sequence: 1, status: "completed",
  outcome: "no_progress", failure_kind: "technical", main_verified: true,
  hypothesis: "The callback runs before the value changes",
  action_ref: "probe:callback-order", result_ref: "log:callback-order",
  before_state: "same-state", after_state: "same-state",
}
```

Count only completed, main-verified technical probes with distinct hypotheses,
actions and result references. Repeating a probe or encountering a provider,
network or permission error does not create a new technical attempt. The gate
returns STOP for repeated probes or an environment block, and WAIT for a pending
attempt. Main handles that blocker before continuing. Two distinct
no-progress probes in the current state or a return to an earlier verified state
requires a bounded recovery. Provide `main_confirmation` with the same four
scope IDs, `evidence_ref`, and ordered `attempt_ids` for the distinct probes.
The gate permits `RECOVER_ONCE`, then requires `STOP` if `recovery_count >= 1`.
It does not spend that recovery budget itself. Persist its use before acting.

After verified progress, advance `last_progress_sequence` to the progress event,
update `state_id` as needed, and reset `recovery_count` for that progress window.
Retain the main-verified progress event at the marker in the active ledger. Its
after state must match the current state. A stale or unsupported marker is
rejected. An unsupported assertion of progress cannot reset
the ledger. The teacher inspection gate uses the same attempt identity and
confirmation fields but separately enforces its stricter eligibility rules.
A recovery result does not by itself authorize a teacher inspection.

## Human decisions

Call `resolveAuthority` for `kind: "missing_authority"` or `"goal_conflict"`.
Provide `task_id`, `objective_revision`, a stable `decision_id`, an exact opaque
`scope` describing the action, target and limits, and `answers`. The first result
is `ASK_ONCE`. Persist a pending record before asking the human. Records contain
those same fields, `status: "pending" | "approved" | "denied"`, and
`evidence_ref` for the actual human request or answer. A pending exact scope
returns `WAIT` with the existing ID; an approved exact scope returns
`REUSE_ANSWER`; a denial returns `STOP`. Conflicting records require resolution.
A new decision ID does not bypass an existing answer for the same scope. A scope
or objective change requires reassessment. This ledger records user authority;
it cannot override a host denial or manufacture execution privileges.

## Bounded dispatch and integration

Call `assessDispatch` before dispatch with the v2 `brief`, `contract_review`,
`builder_ids`, `purpose: "work" | "contract_review" | "completion_review"`,
`parent_role: "main"`, proposed `workers`, full `active_workers`, all previously
`dispatched_ids`, and `integration: {owner: "main", verify_command}`. Proposed
plus active workers may total at most two. Each worker has `id`, the task and
objective revision, `independent: true`, `can_delegate: false`, and `write_paths`.
Use canonical repository-relative paths. An empty list means read-only work.
Reviewed work needs a passing contract review before work or completion-review
dispatch. Review purposes have empty write paths; completion review also requires
no active workers. Builder IDs include observed native identities, excluding review
actors. Parent and child directories and case variants overlap for ownership purposes.
Drive paths, globs and control characters are rejected. Main must resolve
symlinks and filesystem aliases before assigning ownership.

For parallel writes, main must prepare and verify a distinct worktree for each
writer before dispatch. Records require `worktree_id`, `isolated: true`,
`writable: true`, and `worktree_ready: true`. These flags report observed host
state; they do not create isolation or grant write access. Reject duplicate
dispatch, shared writers and recursive delegation. Maintain the active and
historical ledgers when a worker completes. Main integrates returned changes,
runs the integration verification, and uses `assessAcceptance` before declaring
the user outcome complete. An allowed dispatch still returns
`acceptance_required: true`.

## Command line gates

Main can call the gates without importing JavaScript:

```sh
node scripts/execution-state-cli.mjs brief < task-brief.json
node scripts/execution-state-cli.mjs acceptance < acceptance-input.json
```

The sole argument is one of `brief`, `acceptance`, `reuse`, `route`, `recovery`,
`authority`, `dispatch`, `contract`, `completion`, or `replan`. Standard input is the corresponding function argument
object described above. The CLI reads at most one MiB, emits one JSON decision,
and exits 0 only for an allowed or accepted result. Denials, malformed input,
unknown actions and extra arguments exit 1. It accepts no input file paths or
execution options. Main must act on a denial before dispatch or acceptance.
