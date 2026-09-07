# Telemetry and quality v4

AW writes append-only local JSONL to `~/.local/state/aw/runs.jsonl` and host
attestations to `attestations.jsonl`. These files are not committed.

## Run record

Every run stores:

- identity: hashed `run_id`, ISO week, harness/version, route, task class,
  complexity, recipe, playbook version, terminal outcome;
- prompt structure: immutable `prompt_profile_id`, component IDs, relative
  loaded files, measured component tokens, and duplicate-context size;
- actors: main/worker/teacher participation, requested and resolved native
  model IDs, fallback reason, and provider/native tokens;
- compact `timeline`, `gauntlet`, and `teacher` arrays;
- quality, work, friction, duration, derived teacher metrics, and waste events.

Unavailable native values are `null`; never substitute character estimates in
token comparisons. Do not store raw prompts, transcripts, diffs, tool arguments,
full outputs, secrets, emails, absolute home paths, or unhashed session IDs.

An anomalous run may keep at most ten excerpts total, two per waste event and
500 characters each after redaction. Events identify only kind, actor, phase,
signature, measured/estimated waste, and bounded excerpts. Supported kinds are
`repeated_read`, `duplicate_context`, `unchanged_hypothesis`, `duplicate_probe`,
`duplicate_verification`, `teacher_called_too_early`,
`teacher_called_too_late`, `teacher_ask_too_broad`, `teacher_repeat_request`,
`zero_information_gain`, `unusable_evidence`, `main_repair`, `scope_rework`,
`model_mismatch`, and `fallback`.

## Quality gate

A run claim is diagnostic only. Verified success requires a separate main-host
attestation with a stable verification ID, exit code 0, semantic success, full
scope coverage, independent review pass, zero forbidden changes, complete model
provenance, and required actor participation. Missing evidence is UNKNOWN.

```sh
node scripts/usage.mjs attest --run-id "$AW_RUN_ID" \
  --verify-id <id> --verify-exit-code 0 --semantic-success true \
  --scope-covered <n> --scope-total <N> --review-pass true \
  --forbidden-changes 0 --accepted-worker-actions <n> --parent-rework <n>
```

## Diagnosis and comparison

```sh
node scripts/usage.mjs waste [--kind <kind>] [--actor <actor>] \
  [--route <route>] [--profile <prompt-profile>]
node scripts/usage.mjs teacher [--route <route>] [--profile <prompt-profile>]
node scripts/usage.mjs analyze --baseline <version> --candidate <version> --min-pairs 5
```

Cells separate harness, requested/resolved actor models, fallback, route, task
class, complexity, and prompt profile. Paired analysis matches the same task
snapshot across baseline and candidate while allowing one declared profile
mutation. Quality is a hard gate. Tokens, friction, worker shares, measured
waste, answerability, actionable finals, post-teacher green, repeated requests,
zero-information turns, human redirects, and main repairs must not regress; at
least one efficiency measure must improve strictly.
