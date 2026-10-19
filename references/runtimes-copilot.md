# GitHub Copilot runtime

Use Copilot CLI or cloud custom agents, not an unobservable general-purpose
subagent. `agents/copilot/aw-worker.agent.md` is the least-privilege profile;
install it at the supported user or repository location only with approval.
It omits the `agent` tool and therefore cannot invoke further agents.
The profile requests `venice/openai-gpt-6-luna` as the worker model.
GUI/computer-use work uses the dedicated `computer-use` route, pinned by the
profile resolver to `venice/openai-gpt-6-luna`:
`node scripts/resolve-profile.mjs --host github-copilot --role worker --route computer-use`.

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

The resolver reports model capability as `unverified` on Copilot as on every
other host. A complete selection receipt also needs explicit sanitized
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
Venice GPT-6 Luna is available merely because another harness supports it.

The host reviews the result, runs final verification, and creates the quality
attestation. Workers never commit, push, deploy, release, or perform destructive
actions without explicit authorization.
