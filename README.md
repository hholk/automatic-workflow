# work

`work` is a planner-routed orchestration skill for bounded multi-agent software work.
It separates planning, exploration, implementation, review, recovery, and integration into evidence-gated phases.

## What it provides

- planner-first routing for non-trivial work
- bounded headless worker dispatch with explicit stop conditions
- inner and outer verification gauntlets
- independent review and evidence-based Guru escalation
- failure classification, retry brakes, and long-running checkpoints

## Install locally

Clone this repository into the skill directory used by your harness, or link the checkout:

```sh
git clone https://github.com/hholk/work-skill.git ~/.config/opencode/skills/work
ln -sfn ~/.config/opencode/skills/work ~/.agents/skills/work
ln -sfn ~/.config/opencode/skills/work ~/.claude/skills/work
```

For OpenCode, allow the `work` skill in the build agent and restart the session after installation or updates so the skill cache reloads.

The companion `flash-*` agent profiles are configured separately by the host harness. This repository contains the orchestration contract and its supporting design plans.

## License

MIT. See [LICENSE](LICENSE).
