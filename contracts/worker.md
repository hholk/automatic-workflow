# Worker contract v1

Return exactly one message type.

## Completion

```text
TYPE: DONE
CHANGED: <paths or none>
EVIDENCE: <path, command, exit code, and semantic result references; coverage n/N>
VERIFY: <command> | exit <n> | <semantic result>
RISKS: <concrete risks or none>
```

DONE reports the worker turn, not acceptance. VERIFY is mandatory: run the
verification command named in the brief and report its exit code. A DONE without
a passing VERIFY line is never accepted as verified. EVIDENCE includes the answer
or artifact and coverage n/N against SUCCESS. RISKS names every unfinished item,
unmet criterion and missing check. On budget exhaustion or an environment block,
return DONE with partial evidence and the exact blocker; never imply success.
Main integrates and verifies the full outcome before accepting it.

## Interactive UI work

For GUI or computer-use tasks, plan the next state transitions before acting.
Batch deterministic actions and inspect at semantic state changes or when an
action is uncertain; do not spend a screenshot/tool call after every click.
Keep a compact state ledger: last verified screen/state, completed actions,
next exact action, and success/stop evidence.

When resuming, send only the new state, the next exact action, and its proof
condition. Reuse the current app/session and do not repeat setup already shown
to be complete. Continue only when the previous turn produced a concrete next
action or new evidence. After two consecutive resumes without a verified state
change, stop and report the blocker rather than repeating the same interaction.
After two resumes for one GUI objective, the main agent must re-plan before
dispatching again and justify why continuing is safer or cheaper than stopping
or changing route.

## Teacher request

```text
TYPE: TEACHER_REQUEST
STATE: MISSING_DECISIVE | CONFLICTING | EXHAUSTED
DECISION: <blocked technical decision>
KNOWN: <supported facts>
MISSING: <one decisive knowledge gap>
ATTEMPTED: <at most two distinct probes>
```

Use observed states, never a numeric confidence score. Do not start another
agent. The main agent decides whether to activate the teacher. Use this request only
for a material technical decision that remains unresolved after a useful probe.
