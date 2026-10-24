# Implement

Use when desired behavior, scope, and verification are known.

Dispatch the resolved native worker with exact file ownership. Implement the
smallest complete vertical slice using existing dependencies and patterns.
When observable behavior changes at a known public seam, use:

```text
SEAM -> RED -> MINIMAL CHANGE -> GREEN
```

Assert observable behavior at the public seam, with expected values independent
of the implementation. Keep one behavior test and one minimal change per cycle.
If a meaningful failing-before check is impractical, report why and run the closest
executable behavior check; an unrun check remains UNKNOWN. Invoke `tdd` only when
its full workflow is requested; reuse agreed seams. Documentation and configuration
use a targeted probe without an artificial RED. The worker runs the declared
verification and returns `DONE` or `TEACHER_REQUEST`; the main reruns the narrowest
acceptance probe before accepting the result.
