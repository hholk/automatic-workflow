# Auto-research v4

Use only for `$aw research [weekly|status]`. An external scheduler may invoke a
weekly run; AW is never a daemon. `research.mjs due` and `close` make the run
idempotent per ISO week.

## Frozen and mutable

Frozen: run/contract schemas, evaluator, safety, permissions, teacher default
and limits, verification, task snapshots, and promotion logic.

A candidate changes exactly one of `recipe_id`, `prompt_profile_id`,
`context_budget`, `worker_step_budget`, or
`teacher_after_failed_hypotheses`. Prompt changes receive a new immutable
profile ID that resolves through `prompts/profiles.json`. Research may measure
the configured Opus teacher; it cannot change Opus as the
operational default.

## Weekly flywheel

1. Run `node scripts/research.mjs due`; stop when `due` is false.
2. Use `usage.mjs summary`, `waste`, and `teacher` to select one evidenced
   inefficiency in one harness/model/role/workflow/task-class cell.
3. Keep an under-sampled candidate, otherwise ask the teacher for one
   falsifiable mutation. Never mutate a live task to create data.
4. Run baseline and candidate on the same sanitized task IDs, snapshots,
   permissions, verification, and budgets. Feed the `prompt_profile_id` from
   `research.mjs select` to `resolve-profile.mjs --prompt-profile-id`; require
   at least five pairs. A non-baseline profile must define an overlay for the
   resolved native model profile in `prompts/profiles.json`.
5. Analyze locally:

   ```sh
   node scripts/usage.mjs analyze --baseline <version> \
     --candidate <version> --min-pairs 5
   ```

6. `insufficient-data` stays pending or closes `no-change`; `no-change` closes
   unchanged; `revise-or-revert` discards the candidate; only
   `eligible-to-promote` may run contract tests and promotion.
7. Promote with `research.mjs promote`, append numeric before/after/delta
   evidence to `LESSONS.md`, then call `research.mjs close`.

Promotion recomputes paired evidence locally. A weekly run never guarantees a
new version. Historical alternate-model runs remain separate cells and are not
current dispatch options. Direct harness preflights are measurement probes; never pool
their tokens with native task-subagent runs.
