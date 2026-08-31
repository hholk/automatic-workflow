# Routing

Use this only when the six-line route in `SKILL.md` is ambiguous. First match wins.

| Case | Signal | Route | Load |
|---|---|---|---|
| `irreversible` | destructive/external action, secret, permission, or product choice | `human` | none |
| `architecture` | cross-module boundary, data model, long-lived API, or competing designs with material tradeoffs | `teacher` | `teacher.md` |
| `hard_fix` | two different evidence-producing attempts failed, hypotheses conflict, or blast radius is high | `teacher` | `teacher.md` |
| `completed_change` | implementation exists and needs independent validation | `review` | `workflows/review.md` |
| `diagnosed_bug` | failing behavior and root cause are both known | `fix` | `workflows/fix.md` |
| `known_change` | desired behavior and verification are known | `implement` | `workflows/implement.md` |
| `unknown_bug` | symptom exists but causal boundary is unknown | `diagnose` | `workflows/diagnose.md` |
| `read_only_map` | callers, ownership, architecture, or options must be mapped | `explore` | `workflows/explore.md` |
| `tiny_local` | one safe local action costs less than writing and reconciling a brief | `direct` | none |

Do not call the teacher for slow progress, one failed attempt, missing dependency,
network/rate-limit errors, or ordinary implementation. Ask the human instead of
the teacher when authority or intent is missing.

Re-route only on new evidence. Never repeat an unchanged attempt. A hard fix
requires two distinct attempts that each tested a different hypothesis.
