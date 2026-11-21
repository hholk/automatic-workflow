# Routing

Authoritative routing table, reached from SKILL.md.
First match wins.

| Case | Signal | Route | Load |
|---|---|---|---|
| `irreversible` | required authorization or material user choice is missing | `human` | none |
| `computer_use` | objective is operating a live GUI, app, or device | `computer-use` | [`workflows/computer-use.md`](../workflows/computer-use.md) |
| `tiny_local` | tiny single-location edit or immediate read/check that fully satisfies the request in one verified step | `direct` | none |
| `evidence_gap` | material decision still unresolved by main; `MISSING_DECISIVE`, `CONFLICTING`, or `EXHAUSTED` after a useful probe | `teacher` | [`teacher.md`](teacher.md) |
| `architecture` | durable boundary decision still unresolved after a useful probe | `teacher` | [`teacher.md`](teacher.md) |
| `hard_fix` | two distinct causal fixes failed and main cannot resolve the decision | `teacher` | [`teacher.md`](teacher.md) |
| `completed_change` | independent validation required by risk, uncertainty or user | `review` | [`workflows/review.md`](../workflows/review.md) |
| `diagnosed_bug` | root cause is evidenced and a bounded fix or test slice remains | `fix` | [`workflows/fix.md`](../workflows/fix.md) |
| `known_change` | target state and verification are known, including multi-file edits | `implement` | [`workflows/implement.md`](../workflows/implement.md) |
| `unknown_bug` | observable discrepancy has an unknown cause and requires investigation | `diagnose` | [`workflows/diagnose.md`](../workflows/diagnose.md) |
| `read_only_map` | read-only discovery of structure, ownership, callers, or options | `explore` | [`workflows/explore.md`](../workflows/explore.md) |

Default to delegation for `explore`, `diagnose`, `fix`, `implement`, and
`review`. Send read-only discovery, multi-file edits, and isolated test or fix
slices to scoped subagents. Assign independent verification to an independent
reviewer. Main plans the scope, resolves ordinary technical decisions, integrates
results and verifies acceptance. Prefer a direct step only when it meets
`tiny_local` and the handoff would plainly cost more.
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

## Task class and completion

Set `task_class` to one of `bugfix`, `feature`, `refactor`, `diagnosis`, `review`,
`research`, `ui`, `release`, `ops`, `docs`, `architecture`, or `unknown`. Choose
the class from the task's objective and the route from the first matching signal above.

After verification, use [curated Animatic](hstack.md#curated-animatic) for
`assurance: "reviewed"`, user-visible UI changes, PR deliverables, or an explicit
request. Short direct tasks outside those cases get a concise `ketchup`-style
summary with the outcome and verification evidence.

## Delegation and early advice

Give each worker a complete result and its settled prerequisites. Dispatch
useful parallel slices as soon as their interfaces and write ownership are
independent. A second reviewer needs a distinct check, hypothesis or evidence
source. Judge the result against the evidence.

Early advisory help is appropriate for conflicting requirements/evidence, an
unverifiable important criterion or a consequential boundary decision after the
cheapest useful inspection. Two no-progress hypotheses require testing their
shared premise before another fix. Do not exhaust cheap retries before main can
take over a clearly unsuitable slice. Preserve explicit model constraints.
