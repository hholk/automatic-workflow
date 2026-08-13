---
description: Luna-worker ultrawork. Invoke as $aw or /aw.
agent: build
argument-hint: task
---

Load the skill `aw` and follow it exactly.

You have every tool. Spend few tokens, keep control, dispatch work.
Main works through the complete Todo list first; that list is the prompt
hook and handoff, not a plugin hook. Only then do subagents execute. Main
decides, routes, and verifies; after two failed bug-fix iterations, Main
takes over. When a repo is in scope: codebase-memory snapshot
(`list_projects`, `get_architecture`, ≤2 targeted graph queries), then choose
a playbook and give the leaf a tight brief. Keep the Todo list authoritative;
do not have Planner or leaves update the main list. Grill (≤8 questions) only
if the goal is still unclear, big, or irreversible. Do not start with `task`
or `opencode run`. Do not do the leaf's search or edits in this chat.

Skill root: the directory that contains this file's parent `commands/` folder.
Playbooks: `<skill-root>/playbooks/`.
Typical locations (all should be the same checkout via symlink):

- `~/.config/opencode/skills/aw`
- `~/.agents/skills/aw`
- `~/.claude/skills/aw`
- `~/.codex/skills/aw`
- `~/.grok/skills/aw`

Expand `~`. After skill load, follow `SKILL.md`. Optional companion files under
the skill root are used only when they exist.

User request:
$ARGUMENTS
