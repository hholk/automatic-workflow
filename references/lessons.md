# Lessons and manual learning

`LESSONS.md` contains AW improvement experiments and actionable usage lessons.
Numeric before/after evidence is required for performance claims. Repository-specific
root causes belong in the target repository's `LESSONS-REPO.md`; this skill's
copy is only a fallback. Never mix them or store secrets, prompts, transcripts,
or full diffs.

## Automatic evidence

AW v4 records prompt-free events in `~/.local/state/aw/runs.jsonl` using the
schema in `telemetry.md`. OpenCode records native parent/child tokens and model
metadata automatically. Codex and Copilot use the same event contract. Missing
tokens remain null and never enter median-token comparisons.

## `$aw learn`

Use this manual mode for a user-requested AW change that is outside the bounded
playbook fields handled by `$aw research`.

1. Read relevant reviewed lessons and inspect `usage.mjs summary`, `waste` and
   `teacher`. Reconcile relevant pending experiments against current policy:
   keep applicable experiments pending with their exact missing evidence; archive
   superseded experiments while preserving their supported lessons and results.
   Repair a broken evidence path before selecting an efficiency experiment.
   Normal task runs collect evidence; only explicit learning changes AW files.
2. Select exactly one bounded change per cycle: a correctness repair with a
   reproducible failure, or an efficiency experiment with a falsifiable hypothesis
   and expected metric movement. Name one verify command and fix the earliest
   evidenced cause, preferably in executable structure. Proceed within the user's
   authorized scope; otherwise present the concrete proposal for approval.
   A request covering several changes permits consecutive verified cycles.
3. Run contract tests and the static benchmark before editing. Add a regression
   for changed executable behavior or a documented contract conflict. Make the
   smallest change, then rerun both. A repair records the observed failing and
   passing behavior; passing tests establish correctness, not lower cost.
   Assign a new playbook version and a new recipe ID when dispatch instructions
   change; preserve prior recipes as evidence.
4. For efficiency claims, compare baseline and candidate with at least five
   matched, token-bearing task pairs per harness/model/task cell. Use
   verified success, total cost, median and p90 tokens, friction, main repair,
   and teacher reliability. Worker shares are diagnostics. When native costs
   are unavailable, label tokens as a proxy; never infer dollar savings.
   `insufficient-data` keeps the efficiency claim pending. Report excluded data
   and missing prerequisites explicitly; never fabricate runs or attestations.
5. Record the cause, structural prevention, verification and `keep | revise | revert`
   in `LESSONS.md`; efficiency claims also require numeric before/after/delta.
   Track correctness, efficiency and independent review separately. A verified
   repair does not validate an efficiency claim or authorize a policy mutation.
   Promotion additionally requires disjoint holdout evidence and
   separate independent review of the exact candidate and baseline. Follow
   [Learning and review](learning-v5.md); a successful experiment is not approval.
   The current CLI cannot authenticate independent review or holdout provenance
   and therefore cannot promote. Keep the change pending or obtain a separately
   authorized manual patch review. Self-issued review metadata never authorizes
   automatic adoption.

## Applicable lessons

Historical Markdown entries are evidence, not instructions loaded into a task.
Only explicitly authored and independently reviewed structured lessons may be
selected through `research.mjs select --lessons <file> --project <id>
--project-version <revision> --prerequisites <facts.json>`. Selection requires
an exact project ID, listed project revision, listed policy version, every stated
prerequisite and an unexpired review. Missing facts fail applicability. Cross-project,
changed-version and expired lessons are excluded until revalidation and review.
The selected lessons are advisory and cannot change permissions, safety rules,
the teacher threshold, or evaluator requirements.

Never create lessons by ingesting sessions, prompts, transcripts, environment
values or secret-bearing files. Author only a short sanitized conclusion with
explicit applicability. The structured loader rejects unknown fields and common
secret markers; it cannot establish that arbitrary text contains no secrets.
The author and reviewer must check the source before supplying it. See
[Learning and review](learning-v5.md) for the structured format.

## Entry format

```markdown
## YYYY-MM-DD — hypothesis
- Change: one bounded skill change
- Benchmark: command and use cases
- Before / After / Delta: numeric values
- Result: keep | revise | revert
- Lesson: reusable conclusion about AW
- Status: pending | validated | archived
- Applicability: exact project, project revision, policy version and prerequisites
- Review: independent reviewer and date, or pending
- Expiry / Revalidation: date and the version changes that require new review
```

## Decay

- Keep actionable qualitative entries as Failure / Cause / Prevention / Evidence.
  Label hypotheses and missing evidence explicitly; numeric data is optional.
- Remove only empty or superseded entries; preserve unique supported lessons.
- Archive superseded experiments with the replacement or conflict and the
  remaining evidence gap. Archiving is closure, never validation or promotion.
- Compress validated entries already folded into the skill to one line.
- Keep raw evidence locally. Retain aggregate evidence referenced by pending
  experiments; remove raw records only after a safe, explicit retention review.
- Expired or version-mismatched structured lessons do not apply. Reproduce their
  stated prerequisites and relevant verification before a reviewer approves a new
  expiry or additional exact version. Never extend validity automatically.

## Main-only comparison

For a routing change, compare main-only execution with AW on at least five
matched representative task snapshots using identical acceptance criteria,
permissions and main model. Judge the final integrated artifacts to the same
standard. Include briefing, all actors, verification, retries and main repair
in the total; record provider cost when available and elapsed time separately.
A partial result never counts as cheaper success.

The automatic analyzer compares within identical actor/route cells; it cannot
compare main-only against delegation. Keep this routing experiment separate and
report its paired results explicitly in LESSONS.md. Do not relabel models or
routes to force automatic promotion. Missing live pairs remain pending.
