# Smallest installation and native smoke path

This is a reviewable future plan. No production installation, live model request,
hook configuration or new access was performed while implementing or reviewing v5.

## Current local evidence

The read-only `node scripts/install-agents.mjs --host codex` check reported all
three Codex AW profiles missing. `~/.codex/skills/aw` and `~/.agents/skills/aw`
were also absent. `codex --version` reported `codex-cli 0.163.0`, with a sandbox
warning that PATH aliases could not be created. That warning is not evidence
of a model, credential or profile failure. No broader retry was attempted.

The repository's native worker binding remains `codex-router` with
`venice/openai-gpt-6-luna`. Local profiles and the CLI version establish intent
and installed software only, not current provider availability.

## First authorized installation

The smallest existing installer scope is one host, not all hosts. For Codex it
would create these regular mode-0600 files from the reviewed generated sources:

- `~/.codex/agents/aw-worker.toml`
- `~/.codex/agents/aw-reviewer.toml`
- `~/.codex/agents/aw-teacher.toml`

It would add the three ownership hashes to
`~/.local/state/aw/installed-agents.json`. The concrete command, only after
authorization for these targets, is:

```sh
node scripts/install-agents.mjs --host codex --apply
```

Ordinary skill discovery separately needs the reviewed checkout at the
Codex-specific `~/.codex/skills/aw` location. A link to this checkout would avoid
copy drift, but must be explicitly authorized and must not replace an existing
entry. Do not install into the shared `.agents/skills` store to perform a
Codex-only smoke. Do not change the main model, provider credentials, hooks,
MCP configuration or another host's profiles. Restart no running user task;
start a new session after installation.

## One bounded native probe

Live requests are still outside the current authorization. Before approving
one, the host must independently show that the isolated worker receives only
the permitted read-only fixture tools and no private MCP schemas, credentials,
other project access or recursive-agent capability. A prompt prohibition cannot
substitute for host enforcement. If that safe tool scope cannot be established,
stop and retain the offline validation. Do not invent permission flags or use a
nested CLI as a bypass.

The proposed single native `aw-worker` task is to read only this checkout's
`package.json` and report the exact `scripts.test` value. Freeze a versioned
brief with one falsifiable criterion, empty write paths, no teacher, at most
eight tool steps and a 1600-token brief. Use the live host's documented native
agent dispatch, with no forked history and no alternate-model fallback.
Main checks the returned value directly and applies the scoped acceptance gate.
Check the executed provider/model in trusted native metadata. Missing metadata
or a denied read is UNKNOWN or BLOCKED_ENVIRONMENT, not success.

Concrete later approvals are therefore separate: the named installation targets
and skill link; then one live, read-only fixture request after safe host tool
scope is proven. No teacher snapshot or promotion grant is included.

## What that probe does not cover

It covers discovery, the selected native worker binding, a bounded read and main
acceptance. It does not demonstrate live parallel worktrees, teacher transport,
teacher snapshot access, dollar savings, learned-rule promotion or all hosts.
Codex/Copilot automatic selection-receipt transport remains unsupported without
an independently supplied exact active run ID. Do not claim learning eligibility
for the probe merely from a passing final answer.

OpenCode has an offline-tested shell.env-to-resolver-to-telemetry receipt path.
Testing that live would be a separate host-scoped installation and request,
including its plugin, approved only after inspecting its existing destinations.
T3 must explicitly choose Codex or OpenCode as provider; it has no separate
skill-discovery installation in this repository. Copilot has no teacher binding.
