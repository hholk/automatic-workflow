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

## Execution evidence extension v1

The DONE and TEACHER_REQUEST shapes above remain required. Add these lines when
main supplies a v2 task brief. Evidence records remain v1. Do not replace the mandatory VERIFY line.

```text
TASK_ID: <task_id>
OBJECTIVE_REVISION: <objective_revision>
SNAPSHOT_ID: <verified source or UI state snapshot_id>
EVIDENCE_VERSION: 1
EVIDENCE_REFS: <versioned records, one or more per numbered SUCCESS criterion>
```

Main supplies a concise objective, numbered observable SUCCESS criteria, the
versioned check and expected result for each criterion, and the exact VERIFY
command. A worker reports the actual command, exit code and semantic result.
Unknown results and incomplete checks remain unfinished. Evidence records carry
`criterion_id`, `check_id`, `check_version`, `evidence_ref`, `status`, and
`verify: {command, exit_code, result, result_ref}`, in addition to the scope above.
Use `status: passed` and `verify.result: passed` only for an observed pass.

A report does not grant acceptance. Main checks every criterion, integrates the
result, runs verification on the integrated snapshot and records its own proof.
Changed tasks, objectives, snapshots, commands or check versions invalidate reuse.
See [execution v5](../references/execution-v5.md) for the exact machine shapes.

Workers receive unique write ownership. Parallel writers require prepared,
isolated writable worktrees. Workers never dispatch other workers. At most two
workers may be active, including work already dispatched. Report any ownership,
isolation, integration or host permission block to main before writing.

For no-progress evidence, preserve the task, objective revision, blocker and
state IDs. Report each distinct hypothesis, action and result reference, the
before and after states, completion and failure kind. Provider, network and
permission failures do not count as fresh technical probes. Main verifies the
state and maintains the attempt ledger. Human authority or a conflicting goal
requires one scoped human decision; a teacher cannot grant permission.
