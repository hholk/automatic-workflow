# fast

**Agent:** `flash-explore` (native background read-only) or `flash-worker` (one small foreground write)
**Load:** none
**MCP:** Context7 or one `search_graph` only if faster than grep
**Planner:** Main refreshes the full Todo before `aw_spawn` or task dispatch.
**Do not load:** `tdd`, `diagnosing-bugs`, `codebase-design`, `grill-with-docs`, `implement`, `aw`

## When

The orchestrator already has a graph picture and the brief is a local
lookup or a tiny change: where is X, how do we connect, one file, one
command. Read-only lookup uses asynchronous `aw_spawn`; writes are bounded native synchronous tasks. Not a multi-file feature, not an undiagnosed bug, not a review.

Parallel progress is optional only for independent lookup or verification;
choose the smallest useful fan-out and reconcile before final verification.

## First action

Do exactly the OBJECTIVE. First sufficient hit, then stop. No plan, no
second playbook, no extra files.

## Stop

The brief's STOP is met: path, command, credential *source* (never invent
secrets), or the one small edit is in.

## Verify

The VERIFY line from the brief. Red or empty → report `BLOCKED` with what
you searched. Do not self-escalate to `explore` / `implement`.

## Report

Short. `workflow_delta` only if this playbook was the wrong shape.
