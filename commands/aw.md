---
description: Luna-worker ultrawork. Invoke as $aw or /aw.
agent: build
argument-hint: task
---

Load the skill `aw` and follow it exactly.

Use native sessions to make autonomous progress with evidence, not to add orchestration overhead.
Main works through the complete Todo list first; that list is the prompt
hook and handoff, not a plugin hook. Only then do subagents execute. Main
decides, routes, and verifies. When a repo is in scope: codebase-memory snapshot
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

Expand `~`. After skill load, follow `SKILL.md`. At AW intake, run the bounded
weekly Matt skills check when its seven-day guard allows it; the script records
the result in `LESSONS.md` and never runs as a background process. Optional
companion files under
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
Record every meaningful feedback/result/checkpoint, including routine success,
with compact metadata only; never store secrets, private full prompts,
complete tool history, or entire diffs. At close, show exactly three numbered
next steps: bounded continuation; independent Luna review/verification; and a
guarded Matt Pocock release that reviews current diff/base, updates target
project documentation, runs tests, resolves findings, then obtains explicit
human approval before commit, push, and deploy. Never auto-deploy or bypass
the human gate.
Use `aw_checkpoint` only at meaningful milestones. It is optional and event-driven; it does not impose check-in timing. The host remains the decision-maker, and the workflow preserves exactly three next-step options.
