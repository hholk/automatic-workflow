# Learning from operation

This is the default `$aw learn` path and the end-of-task learning loop when
`playbooks/current.json.operating_learning.enabled` is true. Main performs it
inside an active session; no daemon, scheduler or hidden model calls are installed.
The user authorized reversible self-optimization from real usage. User constraints
and host instructions take precedence over this authorization.

## Observe before changing

Record the final run attestation with `usage.mjs attest`. The accepted mission
write returns an `attestation_payload`. Add the observed `run_id` and any
available quality facts, then submit the JSON with
`node scripts/usage.mjs attest --file <path>`. Use `--outcome` for an observed
final outcome and repeat `--skill-hint` for hint observations. Include known
failures, main repair and teacher costs in the run record.
Run `node scripts/usage.mjs operating` for two views of sanitized evidence:

- `route_rollups` group by `playbook_version`, `host`, `route` and `worker_model`.
  Compare the same task classes within those cohorts and retain accepted, failed
  and unknown outcomes. Cheap-model share describes the complete-usage cohort.
- `skill_hints` summarizes recorded hint use, first-pass outcomes and rework.
  Hints capture associations from real work. Causal claims need a controlled
  comparison that accounts for task selection.

Use `usage.mjs doctor` for excluded records, attestation and token coverage, and
active trial status. Use `waste` or `teacher` for their specific signals. Repair
missing receipts or attestations for new runs. Keep unavailable provider costs,
wall time, human interventions and outcomes unknown. Inspect sanitized records
only. An operational observation may fall outside the paired research cohort.
Track unnecessary handoffs and under-delegation. Repeated medium or large slices
handled by main are an actionable signal when they drive context cost or rework.

See [Hstack escalation](hstack.md#escalate-repeated-problems) for recurring
issues that call for `correct`, `h-retro` or explicitly requested `reflect`.
Apply reviewed advisory lessons through [structured lesson loading](lessons.md#controlled-research-and-structured-lessons).

## Select one adaptation

After at least the configured minimum distinct observed runs support a repeated
problem, choose one falsifiable change in that context. A decisive observed
regression permits immediate rollback. A teacher rescue should identify whether
the missing ingredient was evidence, a tool, a boundary, knowledge or capability.
Prefer a reusable check or structural fix in a separately authorized coding task;
otherwise retain one short, sanitized advisory lesson with its exact applicability.

Within this authorization main may adjust:

- One existing policy cell's context or worker-step budget, or create a cell for
  the observed context. Stay inside `operating_learning` ranges and change at most
  the configured fraction relative to the last accepted baseline. Installed host
  caps still apply. Budget increases require observed exhaustion or missing context.
- One bounded briefing, decomposition or evidence-gathering instruction in a new
  immutable recipe or prompt overlay, selected only for the observed cell. Preserve
  the baseline component and use the registry's existing overlay mechanism.
- Advisory timing and direct/delegated strategy within existing execution gates:
  prefer an earlier focused teacher question when repeated downstream repair shows
  a missed decision, omit redundant handoffs for tiny local work, or delegate a
  recurring slice that repeatedly drives main context cost or rework.

Main may not automatically change model/provider authorization, permissions,
acceptance rules, mandatory reviews, tool access, recovery/inspection thresholds,
telemetry semantics, learning bounds or executable safety gates. A difficult slice
can move to the existing capable main without weakening the advisory teacher role.
A measured token share never drives a mutation by itself.

## Apply and follow through

1. Keep at most one open operating trial in `playbooks/current.json` under
   `operating_learning.active_trial`. Use `null` when no trial is active.
   Read the current selection and its history in `LESSONS.md` before changing it.
   Preserve unrelated edits.
2. Before editing, append a sanitized trial entry: context, supporting run IDs,
   hypothesis, exact old/new cell or immutable component IDs, baseline policy
   version, expected observable change and rollback condition. Label `trial`.
3. Apply one local change and assign a new policy version. Record the trial's
   `id`, `status`, `started_at`, candidate `playbook_version`, `trial_run_limit`
   and `target_cell` or `target_route` in `active_trial`. Note the trial in the task
   handback. Do not commit, push, install profiles or release without the applicable
   authorization. A trial changes future selections; active tasks retain their
   original binding and spent budget. Main-only local edits are not background work.
4. Observe subsequent real tasks. Never create tasks merely to fill a sample or
   hide failed attempts. At each next end-of-task loop inspect the trial before
   selecting new work. After `trial_run_limit` relevant runs, choose keep, revise
   or rollback. Unknown evidence cannot justify keeping an alleged improvement.
5. Restore the exact changed fields/component selection on a regression, incompatible
   host behavior, or inconclusive trial at the limit. Preserve intervening unrelated
   changes; if the same field was independently edited, reconcile before overwriting.
   Rollback retains the observation history and gets its own policy version.
6. Close a resolved trial by clearing `active_trial` and preserving its disposition
   in `LESSONS.md`. A kept trial is `provisional`, with observational evidence and
   unresolved limits.
   It does not establish causal savings, broad quality parity or research promotion.
   A later change starts from that recorded baseline, with a new bounded trial.

Do not run tests or benchmarks as part of this operating-learning loop. Live task
acceptance uses whatever checks that task authorizes. Skipped checks stay unknown.
The stricter research evaluator and trusted-review promotion path are unchanged;
load learning-v5.md only for an explicitly requested controlled experiment.
