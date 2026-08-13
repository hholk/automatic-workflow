---
description: Luna-worker ultrawork. Invoke as $aw or /aw.
agent: build
argument-hint: task
---

Load the skill `aw` and follow it exactly.

You have every tool. Spend few tokens, keep control, and use native sessions.
Main works through the complete Todo list first; that list is the prompt
hook and handoff, not a plugin hook. Only then do subagents execute. Main
decides, routes, and verifies; after two failed bug-fix iterations, Main
takes over. When a repo is in scope: codebase-memory snapshot
(`list_projects`, `get_architecture`, ≤2 targeted graph queries), then choose
a playbook and give the leaf a tight brief. Keep the Todo list authoritative;
do not have Planner or leaves update the main list. Grill (≤8 questions) only
if the goal is still unclear, big, or irreversible. Do not dispatch before the
full Todo handoff. Do not do the leaf's search or edits in this chat.

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

## User-visible job protocol

Before `aw_spawn`, show a pending route card with no fictional ID. After it
returns, show the real native session ID (the job ID). `aw_status` and `aw_read`
are explicit pulls; toast is notification only. `aw_control` targets the child.
On a new turn, human instruction comes first, then relevant unread jobs only.
For writes, show an honest start/result card for the bounded synchronous task;
do not promise an in-call timed update.

Before close, record any forecast mismatch in `LESSONS.md` with the structured
fields and pending → promoted → validated lifecycle.
