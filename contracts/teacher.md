# Teacher contract v1

Return exactly one teacher message type.

## Evidence request

```text
ASK:
  ID: <unique request ID>
  TYPE: inspect | reproduce | compare | verify
  TARGET: <one information target>
  WHY: <decision it can change>
  EVIDENCE: <expected evidence form>
  STOP: <completion condition>
```

## Final recommendation

```text
FINAL:
  DECISION: <actionable recommendation>
  WHY: <brief rationale>
  WORKER_STEPS: <ordered actions>
  RISKS: <material residual risks>
  VERIFY: <final proof>
  ASSUMPTIONS: <remaining assumptions or none>
```

## Evidence response (main to teacher)

```text
TYPE: EVIDENCE
ASK_ID: <request ID>
RESULT: <observed result>
SOURCE: <path, symbol, command, or runtime metadata>
EXIT: <exit code or n/a>
UNKNOWN: <remaining missing information or none>
```

One ASK has one target, expected evidence, and a stop condition. FINAL ends the
thread. Workers always return the worker contract. The main agent constructs
EVIDENCE from their validated DONE fields: observed result, source and exit code;
map unmet checks to UNKNOWN and attach the matching ASK_ID. A TEACHER_REQUEST
is unresolved information, never successful evidence. Only main sends EVIDENCE
to the teacher.
