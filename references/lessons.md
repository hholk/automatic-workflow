# Lessons and manual learning

`LESSONS.md` contains numeric AW improvement experiments. Repository-specific
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

1. Read all numeric `LESSONS.md` entries and aggregate v4 evidence. Never change
   AW files during normal runs.
2. Propose exactly one bounded change with a falsifiable hypothesis, expected
   metric movement, and verify command. Wait for user approval.
3. Run contract tests and the static benchmark before editing. Add a failing
   regression test, make the smallest change, then rerun both.
4. Compare baseline and candidate with at least five matched, token-bearing task
   pairs per harness/model/task cell. Use verified success, median and p90
   tokens, friction, worker execution share, diagnosed waste, and teacher
   reliability. `insufficient-data` is never an improvement claim.
5. Record numeric before/after/delta values and `keep | revise | revert` in
   `LESSONS.md`.

## Entry format

```markdown
## YYYY-MM-DD — hypothesis
- Change: one bounded skill change
- Benchmark: command and use cases
- Before / After / Delta: numeric values
- Result: keep | revise | revert
- Lesson: reusable conclusion about AW
- Status: pending | validated
```

## Decay

- Delete entries without numeric values.
- Compress validated entries already folded into the skill to one line.
- Keep raw evidence locally. Retain aggregate evidence referenced by pending
  experiments; remove raw records only after a safe, explicit retention review.
