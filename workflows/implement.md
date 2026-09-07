# Implement

Use when desired behavior, scope, and verification are known.

Dispatch the resolved native worker with exact file ownership. Implement the
smallest complete vertical slice using existing dependencies and patterns.
When observable behavior changes at a known public seam, use:

```text
SEAM -> RED -> MINIMAL CHANGE -> GREEN
```

Uncertain seams, mocking strategy, or integration-test design require the full
`mattpocock-skills:tdd` skill. Documentation and configuration use a targeted
probe without an artificial RED. The worker runs the declared verification and
returns `DONE` or `TEACHER_REQUEST`; the main reruns the narrowest acceptance
probe before accepting the result.
