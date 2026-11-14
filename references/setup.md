# Native setup (installation and repair only)

From the absolute AW directory, first check only the requested host with
`node scripts/install-agents.mjs --host <codex|opencode|github-copilot>`.
After authorization for those exact target files, add `--apply`. Applying without
an explicit host selection is refused. Without `--apply`, it checks installed profiles and reports drift. It validates
all destinations before writes and refuses unrelated files. Review and back up
changed copies before replacing them; it never silently overwrites user edits.

OpenCode uses same-name symlinks in `~/.config/opencode/agents/`. Remove only
owned, backed-up legacy links; renamed source files do not rename installed
links. Native Codex agents in `~/.codex/agents/` must be regular 0600 files.
Codex's sensitive role reader uses O_NOFOLLOW: a symlink may be discovered but
spawn fails with "agent type is currently not available".

The Copilot CLI discovers user custom agents in `~/.copilot/agents/`. Its
DeepSeek 1017 binding is currently UNSUPPORTED and the generated profile is
disabled. Do not install or execute it until an exact native Copilot binding
is confirmed. A Venice model slug alone does not configure a Copilot provider.

For Codex Router, use the exact host-specific model declared in
`prompts/profiles.json`: the Codex teacher uses
`venice-responses/claude-opus-5-5`, while OpenCode uses the native
`venice/claude-opus-5-5` binding. Model
curation and publication use the installed router's native catalog mechanism;
never edit generated `router-model-*.toml` files. This skill update does not
change the router catalog or restart its service.
Code workers and reviewers use native Terra with low reasoning: Codex binds
`gpt-6.1-terra` through `openai`; OpenCode binds `openai/gpt-6.1-terra#low`.
Confirm the model and low variant in each host's local catalog before installation.
Preserve the main model and native Ultra configuration.

Restart/reload harnesses after installation; never terminate user sessions.
Run one native child probe per changed profile and verify execution metadata.
Missing capability is BLOCKED_ENVIRONMENT, not an excuse for a fallback.

Sources checked: OpenAI Codex subagents and skills documentation, OpenCode
agents/permissions documentation, installed CLI help, and Codex source
`core/src/agent/role.rs` + `exec-server/src/regular_file.rs` (O_NOFOLLOW).
`opencode --pure` disables external plugins, not global instructions/MCPs;
an isolated smoke does not validate normal usage telemetry.
