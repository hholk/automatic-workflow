# Auto-research v5

Use only for `$aw research [weekly|status]`. An external scheduler may invoke a
weekly run; AW is never a daemon. `research.mjs due` and `close` make the run
idempotent per ISO week.

## Frozen and mutable

Frozen: run/contract schemas, evaluator, safety, permissions, teacher default
and limits, verification, task snapshots, and promotion logic.

A candidate changes exactly one of `recipe_id`, `prompt_profile_id`,
`context_budget`, or `worker_step_budget`. The threshold for teacher inspection
is fixed at two failed attempts and cannot be learned or promoted. Teacher
permissions, safety fields and quality gates cannot be mutated. Prompt changes receive a new immutable
profile ID that resolves through `prompts/profiles.json`. Research may measure
the configured Opus teacher; it cannot change Opus as the
operational default.

## Weekly research

1. Run `node scripts/research.mjs due`; stop when `due` is false.
2. Use `usage.mjs summary`, `waste`, and `teacher` to select one evidenced
   inefficiency in one harness/model/role/workflow/task-class cell.
3. Keep an under-sampled candidate, otherwise ask the teacher for one
   falsifiable mutation. Never mutate a live task to create data.
4. Reserve disjoint discovery and holdout task IDs before the experiment.
   Run baseline and candidate on the same sanitized task IDs, snapshots,
   permissions, verification, and budgets. Feed the `prompt_profile_id` from
   `research.mjs select` to `resolve-profile.mjs --prompt-profile-id`; require
   at least five pairs per cell in each split. `select` uses the shared effective
   policy resolver, including cell-specific recipe and prompt profile choices.
   A non-baseline profile must define an overlay for the
   resolved native model profile in `prompts/profiles.json`.
5. Analyze locally:

   ```sh
   node scripts/usage.mjs analyze --baseline <version> \
     --candidate <version> --min-pairs 5
   ```

6. `insufficient-data` stays pending or closes `no-change`; `no-change` closes
   unchanged; `revise-or-revert` discards the candidate; only
   `eligible-to-promote` may run contract tests and prepare independent review.
7. Create an explicit split manifest and run `research.mjs evaluate` to produce
   the review packet. Obtain a separate independent approval artifact for that
   exact packet. Review metadata is not authorization. Promotion requires a
   trusted host verifier for the exact packet and independently established
   holdout provenance. This cannot be disabled through the playbook. See
   [Learning and review](learning-v5.md) for formats and the pending integration.
8. The current CLI has no registered trusted host bridge. `research.mjs promote`
   returns `REVIEW_REQUIRED` even for internally consistent review JSON and
   never writes a playbook. Keep the candidate pending, or use a separately
   authorized manual patch review with the exact packet and holdout evidence.
   Only after that reviewed patch is applied, record numeric before/after/delta
   evidence in `LESSONS.md` and call `research.mjs close`.

Evaluation and promotion recompute the existing quality and cost analysis
independently on discovery and holdout evidence from the local event store.
Both must be eligible. Approval binds exact baseline, candidate, split manifest,
and run-evidence identities. Self-issued review flags, reviewer names, manifest
labels or supplied verdicts never authorize a playbook write. The current CLI
cannot promote automatically. Offline tests use explicitly labelled trusted-host
mocks only, never real approval or promotion of an installed skill.
A weekly run never guarantees a
new version. Historical alternate-model runs remain separate cells and are not
current dispatch options. Direct harness preflights are measurement probes; never pool
their tokens with native task-subagent runs.
