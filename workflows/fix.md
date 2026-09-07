# Fix

Use only after the root cause is evidenced.

Dispatch the resolved native worker for the smallest writable slice. When
observable behavior changes at a known public seam, use:

```text
SEAM -> RED -> MINIMAL CHANGE -> GREEN
```

Run the failing probe before the causal change, then rerun the same probe.
Uncertain seams, mocking strategy, or integration-test design require the full
`mattpocock-skills:tdd` skill. Documentation and configuration use a targeted
probe without an artificial RED. Preserve unrelated edits. After two distinct
failed causal fixes, return `TEACHER_REQUEST`; never start the teacher.
