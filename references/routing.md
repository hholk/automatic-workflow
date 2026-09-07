# Routing

Use this only when the six-line route in `SKILL.md` is ambiguous. First match
wins.

| Case | Signal | Route | Load |
|---|---|---|---|
| `irreversible` | destructive action, secret, permission, or product choice | `human` | none |
| `evidence_gap` | `MISSING_DECISIVE`, `CONFLICTING`, or `EXHAUSTED` after a useful probe | `teacher` | `teacher.md` |
| `architecture` | durable boundary, data-model, or long-lived interface decision | `teacher` | `teacher.md` |
| `hard_fix` | two distinct evidence-producing fixes failed or conflict | `teacher` | `teacher.md` |
| `completed_change` | change exists and needs independent validation | `review` | `workflows/review.md` |
| `diagnosed_bug` | root cause is evidenced | `fix` | `workflows/fix.md` |
| `known_change` | target state and verification are known | `implement` | `workflows/implement.md` |
| `unknown_bug` | is/should gap exists but cause is unknown | `diagnose` | `workflows/diagnose.md` |
| `read_only_map` | structure, ownership, callers, or options question | `explore` | `workflows/explore.md` |
| `tiny_local` | one safe action costs less than a handoff | `direct` | none |

Teacher eligibility requires a material technical decision, supported known
facts, one decisive missing fact, and the cheapest useful local probe already
attempted. Two failed probes must test distinct hypotheses. Do not call the
teacher for slow progress, one failure, a dependency outage, or ordinary work.

`HUMAN_DECISION_REQUIRED` is not a teacher route. Ask one normal question for
one independent missing choice. For a dependent decision tree with material
branches, the main agent invokes Grilling (`mattpocock-skills:grilling`); workers and the
teacher never invoke it.

Re-route only on new evidence. Never repeat an unchanged attempt.
