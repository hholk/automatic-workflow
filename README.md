# automatic-workflow

`aw` is an orchestration skill. The main chat spends few tokens and keeps
control; Luna subagents do the work. Playbooks tell the leaf how to proceed
and get sharper over time.

## What it provides

- orchestrator has every tool, uses codebase-memory for a cheap map, then dispatches
- tight briefs so leaves cannot wander
- T3 Code task planner: orchestrator writes it, leaves update it (not on `fast`)
- playbooks: fast, explore, implement, diagnose, fix, review
- decision templates (silence = recommended)
- two identical fix fails → playbook sharpen → last Luna try → orchestrator
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
