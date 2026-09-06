# Worker contract v1

Return exactly one message type.

## Completion

```text
TYPE: DONE
CHANGED: <paths or none>
EVIDENCE: <path, command, exit code, and semantic result references>
VERIFY: <command | exit code | semantic result>
RISKS: <concrete risks or none>
```

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
agent. The main agent decides whether to activate the teacher.
