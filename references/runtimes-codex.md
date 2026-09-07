# Codex runtime

- Use explicit native model selection for every child and bind that resolved
  model to the selected prompt profile. Spawn work with native collaboration
  tools, `agent_type: glm_flash_worker`, `model: venice/glm-5.3-flash`, and
  `fork_turns: none`.
- Prove the resolved model from native execution metadata. When GLM is
  unavailable, record the failed primary attempt and retry once with native
  `gpt-5.6-luna` only as an explicit fallback. Record the exact reason; never
  mix the GLM and Luna runs in one evidence cell.
- Give each child exact file ownership or read-only responsibility; state that
  other workers may exist and unrelated edits must be preserved.
- Pull the final result, then interrupt the finished child so it leaves working state.
- Use one Sol child only through `references/teacher.md`, resume the same
  teacher thread, and select Astra only after an explicit user request.
- Emit or attest the prompt-free v4 event from `references/telemetry.md`.
- Workers use the configured native MCPs.

## Lifecycle evidence

Codex command hooks can observe `UserPromptSubmit`, tool use,
`SubagentStart`/`SubagentStop`, `Stop`, and `SessionEnd`. Install the fragment at
`integrations/codex/hooks.json.example` into a trusted Codex hook layer only
with user approval, replace `<AW_SKILL_DIR>` with the absolute skill path, then
review it with `/hooks`. The adapter activates only for prompts containing
`$aw` or `/aw`; it derives aggregates and never stores the prompt, tool input,
assistant output, or transcript path.

Native hook input proves the active model slug but does not expose usage
tokens. Record those tokens as null unless a separate native/provider usage
source supplies exact values; never infer them from characters or transcript
size. After host verification, locate the trace with
`node scripts/usage.mjs latest --host codex` and attest its run ID.

## Dispatch rule

Prefer one worker. Add workers only for independent tasks whose reconciliation
costs less than serial work. Never overlap write ownership. The host reviews the
diff and runs final verification; workers never commit, push, deploy, release,
or act destructively without the user's explicit authorization.
