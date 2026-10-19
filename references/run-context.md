# Exact run context

Use this reference when recording normal resolver selections in an active AW run.
Run correlation does not prove model availability, user authority or independent
review. `model_capability.status` remains `unverified` after context validation.

## Host transport

OpenCode's existing plugin supplies `AW_RUN_CONTEXT`, `AW_RUN_ID` and state/policy
location through `shell.env` for the exact active root and its child sessions.
Ordinary resolver calls consume that context automatically. Unbound terminals
and ended sessions receive empty run/context values, so they cannot inherit a
different run. Idle and a new activation close the old locator.

Codex's hook CLI uses the native `session_id` plus `turn_id` for a separate turn
ledger. On an AW `UserPromptSubmit`, its structured `additionalContext` contains
`--run-context TOKEN`. Main appends that exact option to the ordinary resolver
command. This is automatic model-visible return; it does not mutate a persistent
shell environment or rewrite a tool call. Missing turn metadata produces no
automatic locator. Copilot keeps independently known exact `--run-id` input.

The resolver validates the locator's provider, playbook and lifetime before
recording a selection. Conflicting IDs, missing files or invalid contexts fail
rather than falling back to another run. A latest-run lookup or thread/session
ID alone cannot identify the active turn. Context metadata is never reconstructed
from a transcript or prompt.

## Lifecycle and stored data

`scripts/run-context.mjs` writes bounded local metadata files, mode 0600,
addressed by random correlation tokens. Each contains one run ID, provider,
playbook version, hashed native event scope, creation time and four-hour expiry.
Its reader rejects oversized, linked, renamed, foreign, future or expired
records and unknown fields. No trust flag can turn it into an approval.

Codex Stop closes the locator. Interrupt cleanup runs if the host subscribes to
and delivers that event. Closed turn markers prevent replay; a turnless
SessionEnd cannot identify a turn to close. If terminal events are missing,
expiry bounds reuse. Duplicate submissions with the same active turn reuse its
locator. Separate turns and OpenCode roots keep separate records.

The local state store and hook process are deployment inputs, not an authenticated
permission boundary. Local metadata cannot authenticate a reviewer or prove the
executed provider model. Main still verifies fixture, task and model evidence.

## Verified scope and remaining host work

Node subprocess tests cover the hook output, resolver consumption, concurrent
turns/roots, child mapping, expiry, completion, replay and invalid contexts.
Host events and provider responses in these tests are synthetic. Repository
publication does not install hooks, activate profiles or prove a live provider.
Native discovery alone proves only that the host found the skill.

Direct teacher snapshot access still needs a task-scoped safe text producer,
durable one-time approvals, expiry/revocation and snapshot-only tool registration
in a real host. Promotion still needs an authenticated independent-review and
holdout verifier plus an atomic policy writer. These are missing integration
components, not permissions supplied by a run token. They remain inactive;
ordinary tool-free teacher evidence and separately authorized patch review are
the existing paths. See [teacher inspection](teacher-inspection.md) and
[learning review](learning-v5.md).

Host contracts: [Codex hooks](https://learn.chatgpt.com/docs/hooks) and
[OpenCode plugins](https://opencode.ai/docs/plugins/). Use a host version that
actually supplies the documented metadata; the resolver does not infer support
from the presence of a configured profile.
