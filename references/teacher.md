# Teacher gauntlet

Use for a material technical decision after the worker returns a valid
`TEACHER_REQUEST`. Claude Opus 5.5 is the default: `venice/claude-opus-5-5` through
Codex Router on Codex; `venice/claude-opus-5-5` on OpenCode. The teacher
is a no-tools adviser by default. It may be consulted preventively before worker
failures when main identifies a material technical decision. Direct diagnosis
has a separate two-attempt and host-approval gate in
[snapshot diagnosis](teacher-inspection.md). Never widen the default profile.

## Eligibility

The main agent applies `scripts/teacher-state.mjs`. Reject with the first stable
reason that applies:

```text
HUMAN_DECISION_REQUIRED
MISSING_EVIDENCE_REFERENCES
NOT_DECISION_RELEVANT
CHEAPER_CHECK_AVAILABLE
TEACHER_BUDGET_EXHAUSTED
```

Main first resolves decisions it can answer from the supplied evidence.
A teacher call needs a remaining decision worth the additional handoff.
The worker may repair one rejected request. Human authority returns to the
human route; it is never guessed by the teacher.

## Loop

1. Start one isolated teacher thread with the objective, decision, constraints,
   observed evidence, attempted hypotheses, remaining unknown, and turn count.
2. Accept exactly one `ASK`, `FINAL` or `HUMAN_QUESTION` from
   [the frozen contract](../contracts/teacher.md).
3. On `ASK`, the main selects the evidence worker. `inspect`, `reproduce`, and
   `verify` reuse the existing worker. `compare` or conflicting evidence uses a
   fresh read-only worker. Use the remaining slice budget; a new discriminating
   ASK may justify the one explicit main-authorized continuation in the recipe.
   If that budget is unavailable, report UNKNOWN and request FINAL.
4. Validate the worker's DONE, construct the main-to-teacher `EVIDENCE` envelope
   from the teacher contract, and resume the same teacher thread.
5. On `FINAL`, turn the recommendation into one bounded worker action and run
   the outer verification gauntlet. Close any snapshot session before dispatch.
   `acceptTeacherReply` accepts the session as its optional fourth argument and
   revokes on FINAL, HUMAN_QUESTION, exhaustion and forced-final outcomes.

One ASK repair is allowed when target, expected evidence, or stop condition is
missing. A second invalid ASK forces `FINAL`. One evidence repair is allowed to
the same worker; then record `UNKNOWN`, try a fresh read-only worker only when
independence can help, or force `FINAL` from explicit assumptions.

The normal case is one ASK. The hard limit is five ASK messages, with at most
seven turns per ASK as resolved from the frozen playbook. Repeated requests,
zero information gain, missing authority,
or `FINAL` stop the loop. Terminal outcomes are `VERIFIED`,
`PARTIAL_WITH_UNKNOWN`, `HUMAN_REQUIRED`, `BLOCKED_ENVIRONMENT`,
`TEACHER_EXHAUSTED`, and `FAILED_VERIFICATION`.

## Native hosts

Use the selected runtime's native `aw-teacher`, not a nested CLI or
another harness. Start without forked history; send only the contract and
bounded decision evidence once, then delta-only follow-ups on the same thread.
Be concise and precise; ask focused questions. OpenCode denies tools; Codex uses
read-only, disabled shell/plugins/subagents and a no-tools instruction. Tool use
outside an approved snapshot session invalidates the advisory result. Existing
hosts have no approved snapshot bridge and keep worker EVIDENCE. An unsupported
teacher model/profile stops rather than substituting a model. The separate
inspection-policy helper is not host permission or an installed adapter.
