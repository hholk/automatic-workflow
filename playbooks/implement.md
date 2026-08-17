# implement

**Worker role:** `aw-luna-worker` / Venice.ai GPT-5.6 Luna
**Review role:** `aw-luna-review`
**Sol role:** `aw-sol-expert`
**Load:** `tdd`, `codebase-design` (if the skill tool is available)
**MCP:** Context7 for library APIs; codebase-memory for callers/callees before editing
**Permission intent:** worker writes only within the brief's allowed paths; review and Sol are read-only.
**Capability/effort policy:** preserve advertised reasoning, tools, and context capabilities; select the nearest supported effort without assuming a task class.
**Planner:** none. The orchestrator updates the T3 Code list.
**Do not load:** `diagnosing-bugs`, `grill-with-docs`, `implement`, `aw`

## When

A bounded behavior change with a known verify command. Not a hard undiagnosed bug.

## User transparency contract

Implementation is a native synchronous task with one bounded checkpoint, one
small write seam, and one targeted verify. Provide honest start/result cards;
do not promise an in-call timed update. Main verifies afterward.

After every meaningful feedback, result, or checkpoint, append a compact
structured entry to `LESSONS.md`, including routine success. Required fields:
Date, Todo/Playbook, feedback/result, symptom/evidence, root cause or
contributing factor, routing/intervention, prevention lesson, and status
`pending|promoted|validated`; omit secrets, private full prompts, complete tool
history, and entire diffs. Propose prevention after feedback.

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

Close with exactly three numbered next steps. Option 3 is a guarded Matt
Pocock release: review current diff/base, update target-project docs, run
tests, resolve findings, then ask for explicit human approval before commit,
push, and deploy. Never auto-deploy or bypass the human gate.
Optional `aw_checkpoint` calls are event-driven milestones for progress/evidence, never a required step or time schedule. Host decisions remain authoritative.
