# diagnose

**Agent:** `flash-worker` (Luna)
**Load:** `diagnosing-bugs` (if the skill tool is available)
**MCP:** codebase-memory to trace the failing path; Context7 if a library is implicated
**Planner:** mark the brief's TODO `in_progress` at start, `completed` or leave it failed on `BLOCKED`. Do not add a second list.
**Do not load:** `tdd` until a red-capable loop exists; never `grill-with-docs`, `implement`, `aw`

## When

Something is broken, throwing, failing, or slow, and the cause is not known.

## First action

Load `diagnosing-bugs`. Build a tight, red-capable loop for *this* symptom
before hypothesising. If the skill tool is missing: invent one command that
fails on the user's exact symptom, run it, then minimise.

Do not jump to a fix. No red-capable command → do not leave Phase 1.

## Stop

Loop is red-capable and you have 3–5 falsifiable hypotheses, or you cannot
build a loop (say what you tried).

## Verify

Paste the loop command and its output. The next playbook is `fix` (or
`implement` at a real seam) — not more exploration for its own sake.

## Report

Use the `flash-worker` `<report>` schema. Always include
`workflow_delta: none|<one concrete edit to this playbook>`.
