# fix

**Agent:** `flash-worker` (Luna)
**Load:** `tdd` when a correct seam exists; otherwise stay on the diagnose loop
**MCP:** Context7 / codebase-memory only for the failing symbol or library
**Planner:** none. The orchestrator updates the T3 Code list.
**Do not load:** `grill-with-docs`, `implement`, `aw`

## When

A previous dispatch returned red evidence (failed AC, non-zero verify, or a
reproduced bug) and the failure class is known.

## First action

Read the actual stderr / failed AC. Change one thing. Re-run the same verify
command. If a seam exists, lock the repro as a failing test first.

When evidence repeats, change the hypothesis or request the smallest missing
fact; preserve the failure signature and maximize information gained by the
next bounded action. Escalate on a stall, risk boundary, or missing decision,
not a fixed attempt count.

## Stop

Verify is green, or the current evidence requires an explicit host decision.

## Verify

The exact command that went red. Not a different, wider suite.

## Report

Use the `flash-worker` `<report>` schema. Include
`failure_signature: <ac-id or exit + short stderr>` and
`workflow_delta: none|<one concrete edit to this playbook>`.
Optional `aw_checkpoint` calls are event-driven milestones for progress/evidence, never a required step or time schedule. Host decisions remain authoritative.
