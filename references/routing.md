# Routing

Authoritative routing table, reached from SKILL.md.
First match wins.

| Case | Signal | Route | Load |
|---|---|---|---|
| `irreversible` | required authorization or material user choice is missing | `human` | none |
| `computer_use` | objective is operating a live GUI, app, or device | `computer-use` | `workflows/computer-use.md` |
| `tiny_local` | main can complete and verify safely for less than a handoff | `direct` | none |
| `evidence_gap` | material decision still unresolved by main; `MISSING_DECISIVE`, `CONFLICTING`, or `EXHAUSTED` after a useful probe | `teacher` | `teacher.md` |
| `architecture` | durable boundary decision still unresolved after a useful probe | `teacher` | `teacher.md` |
| `hard_fix` | two distinct causal fixes failed and main cannot resolve the decision | `teacher` | `teacher.md` |
| `completed_change` | independent validation required by risk, uncertainty or user | `review` | `workflows/review.md` |
| `diagnosed_bug` | root cause is evidenced | `fix` | `workflows/fix.md` |
| `known_change` | target state and verification are known | `implement` | `workflows/implement.md` |
| `unknown_bug` | is/should gap exists but cause is unknown | `diagnose` | `workflows/diagnose.md` |
| `read_only_map` | structure, ownership, callers, or options question | `explore` | `workflows/explore.md` |

For direct versus delegated work, compare the remaining effort, including
briefing, native child context, verification and likely main repair. Reuse
comparable usage evidence; unknown cost is not a claimed saving. A requested
independent review still needs an independent reviewer. Main resolves ordinary
technical decisions; architecture alone is not a teacher trigger.
UI implementation keeps its implement/fix/review route; computer-use covers only
the live interaction phase. Apply [UI/UX acceptance](ui-ux.md) to the affected flow.

Teacher eligibility requires supported facts, one decisive technical gap, and
the cheapest useful probe already attempted. Two failed probes must test distinct
hypotheses. Budget exhaustion, an outage or slow progress alone is a handback,
not a teacher request. Main either completes the work or assigns a bounded new
probe; repeat only with a new hypothesis or changed evidence.

`HUMAN_DECISION_REQUIRED` concerns missing authority or a material user choice.
Reuse existing authorization. Ask one question for an independent missing choice;
a dependent decision tree may use Grilling only when requested by the user.

## Delegation and early advice

State the expected benefit of a handoff: separable implementation, independent
evidence, capability or a shorter critical path. Give a worker a complete result
and its settled prerequisites. Parallelize only ready, independent outcomes;
separate files do not establish independent interfaces or shared state. A second
reviewer needs a different check, hypothesis or evidence source, not a request to
confirm the first answer. Self-reported confidence is not acceptance evidence.

Early advisory help is appropriate for conflicting requirements/evidence, an
unverifiable important criterion or a consequential boundary decision after the
cheapest useful inspection. Two no-progress hypotheses require testing their
shared premise before another fix. Do not exhaust cheap retries before main can
take over a clearly unsuitable slice. Preserve explicit model constraints.
