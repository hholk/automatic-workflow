# Learning and review

Learning uses the existing prompt-free event store, quality attestations and
paired analyzer. It does not read model sessions or extract lessons from raw
conversation history. No evaluator, safety field, permission, teacher limit or
two-attempt inspection threshold is a research variable.

## Evidence and promotion

Keep task snapshots, verification and permissions identical within a pair.
Choose holdout tasks before using discovery results to design a candidate. The
manifest names exact run IDs from `AW_STATE_DIR/runs.jsonl`:

```json
{
  "schema_version": 1,
  "id": "experiment-17",
  "discovery": {
    "baseline_run_ids": ["discovery-base-1", "discovery-base-2", "discovery-base-3", "discovery-base-4", "discovery-base-5"],
    "candidate_run_ids": ["discovery-next-1", "discovery-next-2", "discovery-next-3", "discovery-next-4", "discovery-next-5"]
  },
  "holdout": {
    "baseline_run_ids": ["holdout-base-1", "holdout-base-2", "holdout-base-3", "holdout-base-4", "holdout-base-5"],
    "candidate_run_ids": ["holdout-next-1", "holdout-next-2", "holdout-next-3", "holdout-next-4", "holdout-next-5"]
  }
}
```

Each split needs at least five matched token-bearing, verified pairs per cell.
Run IDs cannot repeat, and holdout task IDs cannot occur in discovery. Unpaired
records fail rather than disappearing from the analysis. Both splits must pass
the existing no-regression and measured-improvement gates.
For a cell mutation, every referenced run must select that cell through the
shared policy resolver using its observed host, models, route and task. An
existing cell must also be the selected baseline cell. Evidence from another
model, task or host cannot approve a cell change. A default mutation establishes
results only for the measured contexts; it does not establish improvement for
unmeasured model or task contexts.

```sh
node scripts/research.mjs evaluate --playbook <baseline.json> \
  --candidate <candidate.json> --manifest <split.json> --proposer <author-id>
```

This command checks the one-field mutation and emits a packet without changing
the playbook. The packet contains the results and SHA-256 identities for the
exact baseline, candidate, manifest and evidence in both splits. The reviewer
must inspect the packet and the proposed change. The host or human reviewer
may record review metadata in a separate artifact. This is a consistency record,
not authorization to promote:

```json
{
  "schema_version": 1,
  "decision": "approve",
  "review_id": "<review_id from the inspected packet>",
  "identities": {
    "baseline": "<packet baseline hash>",
    "candidate": "<packet candidate hash>",
    "discovery": "<packet discovery hash>",
    "holdout": "<packet holdout hash>",
    "manifest": "<packet manifest hash>"
  },
  "approved_by": "<independent-reviewer-id>",
  "approved_at": "2026-10-19T12:00:00Z"
}
```

The candidate author must not manufacture review or holdout provenance. The
CLI checks a separate artifact, distinct reviewer identity and exact packet
hashes, then requires a trusted host verifier. Local JSON cannot authenticate a
reviewer, prove independently reserved holdout tasks, or grant that capability.

```sh
node scripts/research.mjs promote --playbook <baseline.json> \
  --candidate <candidate.json> --manifest <split.json> \
  --proposer <author-id> --review <approval.json>
```

The current CLI has no registered host approval bridge. This command repeats
the evidence, mutation, cell and metadata checks, then exits with
`REVIEW_REQUIRED` without writing the playbook. No flag, environment variable,
review name or JSON approval field can enable automatic promotion.

`authorizeLearningPromotion(packet, review, host)` is an authorization-only API.
After the metadata checks it requires an in-process host capability named
`aw-reviewed-promotion-v1` with a synchronous `verifyPromotion` function. The
function receives immutable copies of the exact packet and review and must
return the boolean `true`. Missing capabilities, asynchronous results, rejection
or exceptions fail closed. The host must authenticate independent review and
holdout provenance through its trusted review process, rather than trusting
claims in either artifact. The function does not write a policy. A future
registered host integration must own that write and prevent task inputs from
supplying or replacing its verifier. Such a production integration remains
unimplemented. Offline tests use a labelled trusted-host mock only.

Until that integration exists, keep candidates pending or submit a concrete
manual patch for separately authorized independent review. Give the reviewer
the exact candidate and baseline hashes, disjoint task reservation record,
paired results and unchanged safety fields. The reviewer checks the sources,
acceptance criteria and reserved holdout provenance independently. Apply only
the explicitly reviewed patch through the normal repository review process,
then record the decision and evidence. Do not interpret the candidate author's
review flags or a successful evaluation as approval. Changes to either playbook,
evidence or manifest require a new review. Development and tests use temporary
synthetic fixtures and do not promote an installed active skill.

## Reviewed lessons

Supply an authored array. Each instruction must be a sanitized conclusion,
never a transcript, prompt, environment dump, credential or full diff.

```json
[
  {
    "id": "node-targeted-check-v1",
    "project_id": "example-project",
    "project_versions": ["exact-project-revision"],
    "policy_versions": ["acceptance-routing-v5"],
    "prerequisites": { "test_runner": "node:test", "offline_fixtures": true },
    "instruction": "Run the affected offline test file before the complete suite.",
    "author": "author-id",
    "review": {
      "decision": "approve",
      "reviewed_by": "independent-reviewer-id",
      "reviewed_at": "2026-10-19T12:00:00Z"
    },
    "expires_at": "2026-11-19T12:00:00Z"
  }
]
```

`research.mjs select` first resolves the shared effective policy and then selects
applicable lessons when `--lessons` is supplied. Pass the exact project and
revision and a JSON file of independently established prerequisite facts. It
does not scan a repository or session to invent those facts. An absent fact or
version mismatch excludes the lesson. Expiry also excludes it. Revalidation
requires checking the prerequisite facts and verification again, then recording
a new independent review with explicit versions and expiry. Selection cannot
extend validity or alter a playbook.
