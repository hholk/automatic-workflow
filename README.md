# automatic-workflow

`aw` is an orchestration skill. Main spends few tokens and keeps control:
Main completes the Todo list first, which serves as the prompt hook and
handoff (not a plugin hook), then Luna subagents execute. Main decides,
routes, and verifies; after two failed bug-fix iterations, Main takes over.
Playbooks tell the leaf how to proceed and get sharper over time.

## What it provides

- Main has every tool, uses codebase-memory for a cheap map, then dispatches
- tight briefs so leaves cannot wander
- Todo list is authoritative: Main completes it before dispatch; Planner and leaves do not update it
- playbooks: fast, explore, implement, diagnose, fix, review
- decision templates (silence = recommended)
- two failed bug-fix iterations → Main takes over
- `workflow_delta` promotion only after a prevented fail
- T3 Code visibility: in-session `task`, status blocks, no silent `opencode run`

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
