# GitHub Copilot runtime

Use Copilot CLI or cloud custom agents, not an unobservable general-purpose
subagent. `agents/copilot/aw-worker.agent.md` is the least-privilege profile;
install it at the supported user or repository location only with approval.
It omits the `agent` tool and therefore cannot invoke further agents.
The profile requests `venice/claude-haiku-5-5` as the worker model.

Use `integrations/copilot/hooks.json.example` for local CLI lifecycle evidence,
after replacing `<AW_SKILL_DIR>` and receiving approval. Prefix the initiating
prompt with `$aw` or `/aw`; the adapter ignores other sessions. The built-in
`general-purpose` agent omits subagent lifecycle events; use the AW custom agent.
Never copy the transcript: the adapter extracts only v4 aggregates and discards
prompt, tool input, response, errors, and transcript paths.

The configured model is intent, not execution proof. Record the executed model
from trustworthy Copilot metadata when exposed. If unavailable, record the
resolved model as unresolved and its source as unknown; exclude that run from
model-specific comparisons.
Documented hook payloads do not expose token usage; keep tokens null unless a
native/provider usage source supplies exact values. Character counts are not
tokens.

After host verification, locate the trace with
`node scripts/usage.mjs latest --host github-copilot` and attest its run ID.

Copilot Cloud storage is ephemeral. Persist only prompt-free aggregate events
through an approved destination; never add an outbound endpoint or firewall
allow rule without the user's authorization.
Workers use configured MCP servers; unavailable tools remain UNKNOWN.

On unavailable primary models, stop with `BLOCKED_ENVIRONMENT`. Do not assume
Venice Haiku is available merely because another harness supports it.

The host reviews the result, runs final verification, and creates the quality
attestation. Workers never commit, push, deploy, release, or perform destructive
actions without explicit authorization.
