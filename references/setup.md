# Native setup (installation and repair only)

From the absolute AW directory, run `node scripts/install-agents.mjs --apply`.
Without `--apply`, it checks installed profiles and reports drift. It validates
all destinations before writes and refuses unrelated files. Review and back up
changed copies before replacing them; it never silently overwrites user edits.

OpenCode uses same-name symlinks in `~/.config/opencode/agents/`. Remove only
owned, backed-up legacy links; renamed source files do not rename installed
links. Native Codex agents in `~/.codex/agents/` must be regular 0600 files.
Codex's sensitive role reader uses O_NOFOLLOW: a symlink may be discovered but
spawn fails with "agent type is currently not available".

For Codex Router, curate `venice/mimo-2.6-flash` for non-teacher roles and
`venice/opus-5.5` for the teacher, then publish with `node src/catalog.mjs` in
the installed router. Never edit generated `router-model-*.toml` files.
Preserve the main model and native Ultra configuration.
Disable automatic alternate-model helpers such as the Luna vision bridge only
with user approval; do not invent image capability for a text-only worker.

Restart/reload harnesses after installation; never terminate user sessions.
Run one native child probe per changed profile and verify execution metadata.
Missing capability is BLOCKED_ENVIRONMENT, not an excuse for a fallback.

Sources checked: OpenAI Codex subagents and skills documentation, OpenCode
agents/permissions documentation, installed CLI help, and Codex source
`core/src/agent/role.rs` + `exec-server/src/regular_file.rs` (O_NOFOLLOW).
`opencode --pure` disables external plugins, not global instructions/MCPs;
an isolated smoke does not validate normal usage telemetry.
