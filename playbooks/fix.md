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

After the second identical fail, the Main takes over with a surgical fix; there
is no third Leaf attempt.

## Stop

Verify is green, or this is the second identical fail.

## Verify

The exact command that went red. Not a different, wider suite.

## Report

Use the `flash-worker` `<report>` schema. Include
`failure_signature: <ac-id or exit + short stderr>` and
`workflow_delta: none|<one concrete edit to this playbook>`.
