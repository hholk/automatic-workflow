# automatic-workflow

`aw` is an autonomous supervisor skill. OpenCode is the source of truth. Main
snapshots the graph, defines acceptance evidence, then hands off. Long or
parallel read-only work uses native asynchronous `aw_spawn` child sessions;
`aw_status`/`aw_read` pull results and
`aw_control` steers or aborts a child. Main verifies afterward. Write-capable
work stays a bounded synchronous native task.
Toast is notification only and does not inject results.

## What it provides

- Main has every tool, uses codebase-memory for a cheap map, then dispatches
- tight briefs so leaves cannot wander
- Todo list is authoritative: Main completes it before dispatch; Planner and leaves do not update it
- playbooks: fast, explore, implement, diagnose, fix, review
- decision templates (silence = recommended)
- semantic checkpoints detect stalls; intervention is an evidence-based ladder
- repair, stall, and intervention memory structures preserve useful lessons
- T3 Code visibility: tool cards + toast + explicit status/read, with no automatic live panel
- session IDs are native child job IDs; child state is authoritative, with no ledger/polling/daemon/PID/custom runner
- every new turn handles human instruction first, then relevant unread background jobs only
- every meaningful feedback/result/checkpoint appends compact metadata to `LESSONS.md`, including routine successes; close presents exactly three next steps, with a human-gated Matt Pocock release option

## Executable supervisor layer

`supervisor/supervisor.mjs` is a dependency-free ESM module of pure functions.
Call `parseCheckpoint`/`parseHelpRequest`, `compareCheckpoints` and
`chooseIntervention` for semantic supervision; `normalizeEvidence` and
`buildBrief` for compact contracts; and `telemetry`/`aggregateMetrics` for
explicit in-memory reporting. The host remains responsible for persistence,
native session control, and verification. These functions have no execution loop or
automatically control sessions.

Action-risk is distinct from reasoning-risk: sensors report bounded evidence; the
host owns blast-radius gates and reasoning interventions.

## Native supervisor sensors

`plugin/aw-supervisor.js` connects that pure decision layer to OpenCode's
documented plugin hooks. It records bounded evidence from tool execution,
file/session movement, LSP diagnostics, permission requests, and session
lifecycle events. Before compaction it injects a compact supervisor snapshot
into the continuation context. It does not run a second agent loop: no
automatic Sol call, abort, polling, daemon, PID manager, or durable session
ledger is introduced. The host/orchestrator uses the observation and decides
the next native action.

The canonical active profiles are Markdown files in `agents/opencode/` with
OpenCode YAML frontmatter. Install them explicitly and non-destructively into
`~/.config/opencode/agents/` or `.opencode/agents/`; existing files are never
silently overwritten. The YAML files in the same directory are metadata
templates only.

## Install locally

Clone this repository into the skill directory used by your harness, or link the checkout:

```sh
git clone https://github.com/hholk/automatic-workflow.git ~/.config/opencode/skills/aw
ln -sfn ~/.config/opencode/skills/aw ~/.agents/skills/aw
ln -sfn ~/.config/opencode/skills/aw ~/.claude/skills/aw
```

For OpenCode, allow the `aw` skill on the build agent. Choose the orchestrator
model in the `aw-orchestrator` profile; worker/reviewer are Venice.ai GPT-5.6
Luna and expert is Sol. Restart the session after installation or updates.

Matt Pocock's shared skills are installed at
`~/.local/share/agent-skills/mattpocock-skills` and exposed through the
OpenCode skill directory. AW checks that checkout against upstream at most
once every seven days during intake. Run
`node scripts/check-matt-skills.mjs` from this skill root to perform the
bounded check manually; updates require a clean checkout and are recorded in
`LESSONS.md`. There is no background updater.

The canonical active OpenCode role profiles live in `agents/opencode/`; do not
create a redundant `profiles/` directory. Playbooks are in `playbooks/`.

## License

MIT. See [LICENSE](LICENSE).
