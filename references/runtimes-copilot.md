# GitHub Copilot runtime

The DeepSeek 1017 worker binding is **UNSUPPORTED**: no native Copilot model
binding has been confirmed for this profile. The Venice slug in the registry
is requested intent only; it does not connect Copilot to Venice. The resolver
stops with `BLOCKED_ENVIRONMENT` for every worker route, including
`computer-use`. It never selects another provider or model.

The generated `aw-worker.agent.md` is marked unsupported and disables model
invocation and user invocation. Do not install or execute it until native
Copilot availability and the exact model identifier are established. The
remaining integration notes describe the existing Copilot adapter only.

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

Supported configured bindings report model capability as `unverified`; this
unsupported Copilot binding returns no selection. A complete selection receipt
also needs explicit sanitized
`--task-id`, `--snapshot-id` and `--check-version` for the frozen fixture.
Missing comparison identity stays unknown; never substitute the hook run ID.
Documented hook payloads do not expose token usage; keep tokens null unless a
native/provider usage source supplies exact values. Character counts are not
tokens.

After host verification, locate the trace with
`node scripts/usage.mjs latest --host github-copilot` and attest its run ID.

Copilot Cloud storage is ephemeral. Persist only prompt-free aggregate events
through an approved destination; never add an outbound endpoint or firewall
allow rule without the user's authorization.
Workers use configured MCP servers; unavailable tools remain UNKNOWN.

The current hook CLI does not transport its active AW run ID back into ordinary
resolver calls. Automatic selection receipt collection is unsupported here.
Use `--run-id` only when the exact active ID is independently available from the
host; otherwise policy identity stays UNKNOWN and the run cannot enter learning.

On unavailable primary models, stop with `BLOCKED_ENVIRONMENT`. Do not assume
Venice DeepSeek 1017 is available merely because another harness supports it.

The host reviews the result, runs final verification, and creates the quality
attestation. Workers never commit, push, deploy, release, or perform destructive
actions without explicit authorization.
