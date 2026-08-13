# explore

**Agent:** `flash-explore` (Luna, read-only)
**Load:** `codebase-memory` (if the skill tool is available)
**MCP:** codebase-memory graph first, then Context7 for libraries, then grep/read
**Planner:** mark the brief's TODO `in_progress` at start, `completed` or leave it failed on `BLOCKED`. Do not add a second list.
**Do not load:** `tdd`, `diagnosing-bugs`, `grill-with-docs`, `implement`, `aw`

## When

Paths, symbols, callers, or library behavior are unknown.

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
