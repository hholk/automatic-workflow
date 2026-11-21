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

Read relevant observations and inspect `usage.mjs operating` for
`route_rollups`, `skill_hints` and `active_trial`. Use `usage.mjs doctor` to
check evidence coverage and trial status. Use `waste` and `teacher` as needed.
Reconcile `operating_learning.active_trial` in `playbooks/current.json` before
creating another.
Preserve the old selection, evidence IDs, hypothesis and rollback condition.
Fix missing evidence for future runs before making performance claims.

Recurring budget, routing or rework drift stays in operating learning.
Escalate repeated repo mistakes to `correct` with
`principle-encode-lessons-in-structure`, repo navigation or standards friction
to `h-retro`, and fundamental skill or judgment gaps to `reflect` on explicit
user request. Follow the [Hstack invocation rules](hstack.md#resolve-conflicts-before-acting).

## Empirical principles

- Config proves intent. Runtime identity requires observed host metadata.
- Missing evidence stays UNKNOWN.
- Diagnostic tolerance keeps observations usable. Strict comparison gates
  require every applicable fact before admitting a run.
- Repeated signals require evidence of unchanged state to prove redundancy.

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

The resolver loads reviewed project lessons from `.aw/lessons.json` with
`--workspace <dir>`, or from an explicitly supplied `--project-lessons <file>`.
Pass `--project-id <id>`, `--project-version <revision>` and
`--prerequisites <facts.json>` in either case. `selectReviewedLessons` enforces
independent review, exact project, revision and policy applicability, prerequisite
facts and expiry. Keep ordinary observations in the log until independently
reviewed. Encode supported invariants in executable structure where authorized.
