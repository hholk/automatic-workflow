# explore

**Agent:** `flash-explore` (Luna, native background read-only)
**Load:** `codebase-memory` (if the skill tool is available)
**MCP:** codebase-memory graph first, then Context7 for libraries, then grep/read
**Planner:** Main refreshes the full Todo before `aw_spawn`.
**Do not load:** `tdd`, `diagnosing-bugs`, `grill-with-docs`, `implement`, `aw`

## When

Paths, symbols, callers, or library behavior are unknown. This is asynchronous `aw_spawn` background work; pull results with `aw_status`/`aw_read`.

Parallel progress is optional leverage for independent exploration/research;
use the smallest useful fan-out, avoid duplicate work, and reconcile results.

## First action

`list_projects` / `search_graph` / `trace_path`, or Context7 for the named library.
Do not start with a broad file dump.

## Stop

The named question has verified paths and symbols, or is unanswerable from the repo.

## Verify

Every reported path and symbol exists (one grep or read each). Propose a write
boundary and the next playbook (`implement`, `diagnose`, or `direct`).

## Report

Use the `flash-explore` `<report>` schema. Always include
`workflow_delta: none|<one concrete edit to this playbook>`.
