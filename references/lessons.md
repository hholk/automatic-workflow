# Lessons and learning

`LESSONS.md` stores sanitized AW observations, operating trials and historical
experiments. Target-repository causes belong in that repository's LESSONS-REPO.md.
Historical entries are evidence, never current model or policy instructions.

## Default learn loop

`$aw learn` and enabled end-of-task learning use
[operating learning](operating-learning.md). Main may apply a small reversible
change from real usage without a new approval round, inside that document's
scope and the configured bounds. No tests, synthetic tasks or benchmarks are
required for these provisional trials. Keep unknown acceptance and missing usage
visible. Quality requirements remain unchanged.

Read current relevant observations and run `usage.mjs operating`, `waste` and
`teacher` as needed. Reconcile the one active trial before creating another.
Preserve the old selection, evidence IDs, hypothesis and rollback condition.
Fix missing evidence for future runs before making performance claims.

## Entry format

```markdown
## YYYY-MM-DD — one observed problem or trial
- Context: host, actual models, route, task class and relevant prerequisites
- Evidence: distinct real run IDs and observed outcomes; missing facts explicit
- Hypothesis: one change and the result it should affect
- Baseline / Candidate: policy versions, exact changed field or immutable component
- Rollback: exact restoration and observable trigger
- Status: observation | trial | provisional | reverted | archived
- Outcome: accepted / failed / unknown counts; teacher/main repair and usage coverage
- Limitations: observational, untested or incomplete; no unsupported quality/cost claim
```

Preserve unique supported lessons. Archive obsolete experiments with their reason;
archiving does not validate them. Compress a lesson once its structural prevention
is in place. Never ingest raw prompts, sessions, environment values or full diffs.
Keep bounded sanitized conclusions and references, not secret-bearing evidence.

## Controlled research and structured lessons

When the user explicitly requests comparative performance claims or research
promotion, use [learning and review](learning-v5.md) and
[autoresearch](autoresearch.md). Those paths retain matched pairs, disjoint holdout,
independent review and trusted host authorization. A provisional operating trial
is not a promotion through that API and must not be labelled as one.

The structured lesson loader remains independently reviewed and tightly scoped.
Exact project/revision/policy prerequisites and expiry are enforced there. Ordinary
operating observations are not passed to that loader as if reviewed. A general
invariant belongs in executable structure when authorized; an advisory recipe
trial stays explicitly provisional until its real outcome is known.
