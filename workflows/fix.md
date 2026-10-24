# Fix

Use only after the root cause is evidenced.

Dispatch the resolved native worker for the smallest writable slice. When
observable behavior changes at a known public seam, use:

```text
SEAM -> RED -> MINIMAL CHANGE -> GREEN
```

Run the failing probe before the causal change, then rerun it against the original
reported scenario. Assert observable behavior at the public seam, with expected
values independent of the implementation. Keep one regression and one minimal
change per cycle. If a meaningful failing-before check is impractical, report why
and run the closest executable behavior check; an unrun check remains UNKNOWN.
Invoke `tdd` only when its full workflow is requested; reuse agreed seams.
Documentation and configuration use a targeted probe without an artificial RED.
Preserve unrelated edits. After two distinct
failed causal fixes, hand back using the worker contract. Request a teacher
only for an unresolved material technical decision.
