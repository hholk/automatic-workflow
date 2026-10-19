# Teacher snapshot diagnosis v1

Use only when a tool-free teacher needs to inspect task evidence directly.
Advisory consultation can happen before failures. Diagnosis needs two proven
worker attempts with no progress on the same unresolved problem, followed by
an explicit host grant. Eligibility never grants permissions.

## Attempt evidence

`scripts/teacher-state.mjs` exports `assessTeacherInspection(request)`.
Main owns an ordered ledger with at most 32 entries in the request. Scope is
`task_id`, `objective_revision`, `blocker_id`, `state_id`. The state ID names the
verified unresolved condition, not the wording of an error message.

Supply `unresolved: true`, `last_progress_sequence`, and `attempts`. Each of the
latest two scoped attempts after that progress marker must have:

- A unique `attempt_id`, increasing integer `sequence`, and the same scope.
- `status: completed`, `outcome: no_progress`, `failure_kind: technical`.
- A distinct causal `hypothesis`, immutable `action_ref` and `result_ref`.
- `before_state` and `after_state` equal to the current unresolved state ID.
- `main_verified: true` after main checks the actual result.

Supply `main_confirmation` with the same scope, the two ordered `attempt_ids`
and main's immutable `evidence_ref`. Provider, network and permission failures,
partial attempts, duplicate messages or repeated hypotheses do not qualify.
Observed progress resets the pair. A revised task, objective, blocker or state
requires fresh scoped evidence. Learning cannot change this threshold.

## Immutable snapshot

`prepareTeacherSnapshot(files)` accepts reviewed text, never filesystem paths to
open. Each entry contains `path`, `text`, `kind: regular`, `symlink: false`,
`task_selected: true`, `secret_review: clear`. The host must attest these facts
from its own task-bound safe producer. Do not trust worker-supplied flags.
Exclude an uncertain file. A secret-pattern filter alone is insufficient.

The helper copies text into private buffers and returns only a frozen manifest
with relative paths, byte counts, file SHA-256 hashes and a snapshot ID. Reads
cannot follow symlinks or observe later file changes because there is no live
filesystem reader. The host producer must reject symlinks in every path segment,
foreign project roots, special files and files outside its explicit task list
before supplying text. Hidden paths, .git, .env, credentials, settings/config,
logs, sessions, traces and vendor directories are excluded by the policy.

`teacherReadPolicy` fixes the ceiling at 8 files, 64 KiB of snapshot text,
120 seconds, 8 operations, 8 KiB per response, 32 KiB total returned text and
20 search hits. Search is literal and restricted to one selected file per call.
Grants may reduce these ceilings. Returned-text byte limits exclude JSON framing.

## Host contract and lifecycle

`openTeacherReadSession({request, scope, snapshot, grant, host})` requires the
capability `teacher-text-snapshot-v1` and trusted host functions:

- `consumeGrant(context)` atomically verifies and consumes a one-time approval.
- `isGrantActive(context)` checks expiry, revocation and current task state.
- `revokeGrant(context)` removes access on termination.

Functions must synchronously return true on success; exceptions, missing or
asynchronous results fail closed. These are integration functions in trusted
host code, never a JSON claim, model output, CLI flag or learned setting.
The host must enforce one-time use durably across processes. No production
adapter is shipped in this revision; synthetic tests use a clearly marked mock.

The grant binds `id`, `approval_ref`, exact scope plus `call_id`, `snapshot_id`,
`issued_at`, `expires_at`, exact `paths`, `operations: [read, search]`,
`max_bytes`, `max_operations`, `max_hits`. The host approval is required even
when an eligibility assessment returns true. It authorizes no shell, network,
write, delegation or general filesystem tools.

Main sends only exact-scope read/search calls to the returned session's `handle`.
On FINAL, HUMAN_QUESTION, abort or any exception, main calls `close` in a finally
path before resuming the worker. `acceptTeacherReply` accepts an optional session
and closes it on terminal or forced-final outcomes. The host must independently
expire grants at their deadline even when no call arrives. Expired, revoked or
scope-mismatched access closes locally. A revocation failure is reported and
local access remains closed. Never claim confirmed host revocation after failure.

Only main sends resulting observations as EVIDENCE. The teacher advises, the
worker changes code and runs VERIFY, and main owns final acceptance. New state,
snapshot or call means a new assessment and new approval, never silent renewal.

## Current support

| Execution environment | Default teacher | Direct snapshot diagnosis |
|---|---|---|
| Codex | Existing tool-free advisory profile | Unsupported, worker EVIDENCE |
| OpenCode | Existing deny-all advisory profile | Unsupported, worker EVIDENCE |
| T3 with Codex | Codex provider rules | Unsupported, worker EVIDENCE |
| T3 with OpenCode | OpenCode provider rules | Unsupported, worker EVIDENCE |
| GitHub Copilot | Existing teacher binding unavailable | BLOCKED_ENVIRONMENT |

A resolver result cannot prove live host support. Add a bridge only after a
real host supports constrained snapshot reads, durable approvals and revocation.
Do not enable generic read tools, MCP namespaces or a shell as a substitute.
