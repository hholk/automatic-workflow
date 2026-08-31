# Lessons

The two files have different audiences and must never be mixed.

## `LESSONS.md`

Only AW skill improvement experiments. Every change to AW requires one measured
entry after its benchmark runs:

```markdown
## YYYY-MM-DD — hypothesis
- Change: one bounded skill change
- Benchmark: command and use cases
- Before: numeric value(s)
- After: numeric value(s)
- Delta: numeric difference or percentage
- Result: keep | revise | revert
- Lesson: reusable conclusion about AW
- Status: pending | validated
```

Do not record target-repository bugs, implementation details, or routine worker
results here. Never claim improvement without a before/after value.

## `LESSONS-REPO.md`

Only lessons learned while AW works on target repositories. Record repository,
symptom/evidence, root cause, intervention, verification, and prevention. Keep
entries compact; omit secrets, full prompts, full histories, and whole diffs.

When the target repository is writable, prefer its own `LESSONS-REPO.md` so the
learning travels with that codebase. Otherwise append to the copy in this skill.
