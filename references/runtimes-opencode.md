# OpenCode runtime

## Dedicated native profiles

Dedicated AW profiles are the default; mutable global agent defaults are never
evidence for an AW cell.

| Route | Native `task` profile |
|---|---|
| fix, implement | `subagent_type: aw-glm-worker` |
| explore, diagnose, review, compare | `subagent_type: aw-glm-review` |
| explicit fallback after recorded GLM failure | `subagent_type: aw-luna-worker` |

All three profiles deny recursive `task` calls. Native dispatch remains the
only worker mechanism; no wrapper, poller, or external runner is added. The Sol
teacher uses the isolated Codex CLI thread from `references/teacher.md`.
Profiles explicitly allow both MCP namespaces.

## Required model preflight

Configuration output is necessary but not sufficient because a running
OpenCode session may cache an earlier profile.

1. Restart or reload OpenCode after profile changes.
2. Run a read-only child probe through the exact dedicated profile.
3. Read native assistant metadata and require the expected `providerID` and
   `modelID`: GLM is `venice/z-ai-glm-5-3-flash`; Luna is
   `openai-codex/gpt-5.6-luna`.
4. On mismatch or missing metadata, stop. Agent names and self-identification
   text are never proof.

The native `task` tool has no per-call model parameter. Profile frontmatter
binds model and stable prompt prefix. A Luna retry starts a new run/evidence
cell and requires the exact primary failure; never pool or silently substitute.

## Installation and telemetry

Install repository profiles as symlinks in `~/.config/opencode/agents/` only
when the destination is absent or already resolves to the same source. Never
replace an unrelated file. The v4 usage plugin records native model metadata,
tokens, component IDs, actor timeline, and hashed signatures; its trace remains
quality-ineligible until the main host appends an attestation.

Prefer one worker. The main owns integration, final verification, commits, and
external effects.
