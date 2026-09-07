# Teacher gauntlet

Use for a material technical decision after the worker returns a valid
`TEACHER_REQUEST`. `gpt-5.6-sol` from the Codex subscription is the default.
GPT-6 Astra is allowed only when the user explicitly requests it. The teacher
is a no-tools adviser: it does not read the repo, execute, edit, spawn, or
release.

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

The worker may repair one rejected request. Human authority returns to the
human route; it is never guessed by the teacher.

## Loop

1. Start one isolated teacher thread with the objective, decision, constraints,
   observed evidence, attempted hypotheses, remaining unknown, and turn count.
2. Accept exactly one `ASK` or `FINAL` from [the frozen contract](../contracts/teacher.md).
3. On `ASK`, the main selects the evidence worker. `inspect`, `reproduce`, and
   `verify` reuse the existing worker. `compare` or conflicting evidence uses a
   fresh read-only worker.
4. Validate and compress its `EVIDENCE`; then resume the same teacher thread.
5. On `FINAL`, turn the recommendation into one bounded worker action and run
   the outer verification gauntlet.

One ASK repair is allowed when target, expected evidence, or stop condition is
missing. A second invalid ASK forces `FINAL`. One evidence repair is allowed to
the same worker; then record `UNKNOWN`, try a fresh read-only worker only when
independence can help, or force `FINAL` from explicit assumptions.

The normal case is one ASK. The hard limit is three ASK messages. Maximum five Sol responses
are allowed. Repeated requests, zero information gain, missing authority,
or `FINAL` stop the loop. Terminal outcomes are `VERIFIED`,
`PARTIAL_WITH_UNKNOWN`, `HUMAN_REQUIRED`, `BLOCKED_ENVIRONMENT`,
`TEACHER_EXHAUSTED`, and `FAILED_VERIFICATION`.

## Native hosts

Codex starts one child with the selected teacher model, high reasoning, and no
forked context, then uses follow-up messages on the same child. OpenCode starts
an isolated `codex exec` thread in an empty temporary directory, captures its
native thread ID, and continues with `codex exec resume`. The OpenCode runtime
contains the exact command and model-evidence checks. Copilot uses a supported
custom-agent model only when it can prove the resolved model; otherwise the
model-specific result is excluded.
