# automatic-workflow

`aw` is an orchestration skill. Main snapshots the graph, refreshes the full
Todo list, then hands off. Long or parallel read-only work uses native
asynchronous `aw_spawn` child sessions; `aw_status`/`aw_read` pull results and
`aw_control` steers or aborts a child. Main verifies afterward. Write-capable
work stays a bounded synchronous native task.

## What it provides

- Main has every tool, uses codebase-memory for a cheap map, then dispatches
- tight briefs so leaves cannot wander
- Todo list is authoritative: Main completes it before dispatch; Planner and leaves do not update it
- playbooks: fast, explore, implement, diagnose, fix, review
- decision templates (silence = recommended)
- two failed bug-fix iterations → Main takes over
- forecast mismatches are captured before close and lessons follow pending → promoted → validated
- T3 Code visibility: tool cards + toast + explicit status/read, with no automatic live panel
- session IDs are native child job IDs; child state is authoritative, with no ledger/polling/daemon/PID/custom runner
- every new turn handles human instruction first, then relevant unread background jobs only

## Install locally

Clone this repository into the skill directory used by your harness, or link the checkout:

```sh
git clone https://github.com/hholk/automatic-workflow.git ~/.config/opencode/skills/aw
ln -sfn ~/.config/opencode/skills/aw ~/.agents/skills/aw
ln -sfn ~/.config/opencode/skills/aw ~/.claude/skills/aw
```

For OpenCode, allow the `aw` skill on the build agent, pin `flash-worker` /
`flash-explore` to Luna, and restart the session after installation or updates.

The companion `flash-*` agent profiles live in the host harness
(`~/.config/opencode/agents/`). Playbooks are in `playbooks/`.

## License

MIT. See [LICENSE](LICENSE).
