# Native runtimes

Load only the section for the active host. Both runtimes use one bounded worker
per writable slice and native session IDs as the source of truth.

## Codex

- Spawn implementation, exploration, diagnosis, and review with the native
  collaboration tools and `agent_type: glm_flash_worker`, `fork_turns: none`.
- The configured worker model is Venice `venice/glm-5.3-flash` (GLM 5.3 Flash).
- Give ownership of exact files or read-only responsibility. Say that other
  workers may exist and they must preserve unrelated edits.
- Pull the final result, then interrupt the finished child so it leaves working state.
- Use a Sol child only through `references/teacher.md`.

## OpenCode

- Use the native `task` tool with `subagent_type: aw-glm-worker` or
  `aw-glm-review`. Both profiles use Venice `venice/z-ai-glm-5-3-flash`.
- Install profiles explicitly from `agents/opencode/*.md` into
  `~/.config/opencode/agents/`; do not overwrite an existing profile silently.
- The worker may edit its assigned slice. The reviewer is read-only and may run
  only safe verification. Neither may spawn another task.
- Use Codex CLI from the OpenCode host for the Sol teacher; never substitute a
  Venice-hosted Sol model.

## Dispatch rule

Prefer one worker. Add workers only when tasks are independent and reconciliation
cost is lower than serial work. Never overlap write ownership. The host reviews
the diff and runs final verification; workers never commit, push, deploy, release,
or perform destructive actions without the user's explicit authorization.
