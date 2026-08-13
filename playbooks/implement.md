# implement

**Agent:** `flash-worker` (Luna)
**Load:** `tdd`, `codebase-design` (if the skill tool is available)
**MCP:** Context7 for library APIs; codebase-memory for callers/callees before editing
**Planner:** none. The orchestrator updates the T3 Code list.
**Do not load:** `diagnosing-bugs`, `grill-with-docs`, `implement`, `aw`

## When

A bounded behavior change with a known verify command. Not a hard undiagnosed bug.

## User transparency contract

Implementation is a native synchronous task with one bounded checkpoint, one
small write seam, and one targeted verify. Provide honest start/result cards;
do not promise an in-call timed update. Main verifies afterward.

## First action

Load `tdd`. If the skill tool is missing: write one failing behavior test through
the public interface, watch it fail, then write the minimal code to pass it.
One vertical slice at a time — never all tests then all code.

Use `codebase-design` vocabulary (module, interface, seam, depth). Do not add a
seam unless two adapters already exist.

## Stop

Every AC has green evidence, or a missing path/AC forces `NEEDS_CONTEXT`.

## Verify

Run the brief's verify command. Lint/format only the files you touched.

## Report

Use the `flash-worker` `<report>` schema. Always include
`workflow_delta: none|<one concrete edit to this playbook>`.
DONE with unchanged files is invalid.
