# Codex runtime

Use explicit native model selection and the resolved prompt profile.

| Route | agent_type | model | model_provider |
|---|---|---|---|
| GUI/computer-use | `aw-worker` | `venice/openai-gpt-6-luna` | `codex-router` |
| fix, implement | `aw-worker` | `venice/openai-gpt-6-luna` | `codex-router` |
| explore, diagnose, review, compare | `aw-reviewer` | `venice/openai-gpt-6-luna` | `codex-router` |
| teacher | `aw-teacher` | `venice/claude-opus-5-5` | `codex-router` |

Agent files bind model/provider/high effort, not inherited Ultra, and disable
child skill-catalog instructions. Use native spawn/resume tools; set
`fork_turns: none` and model overrides only if exposed by the live schema.
Send delta-only follow-ups. Close/interrupt finished children with the offered
tool. No recursive agents or alternate-model retries. A child that still
inherits a large context is a measured cost, not a reason to fork more.

From the absolute skill directory:
`node scripts/resolve-profile.mjs --host codex --role worker --route fix --task-class diagnosed-bug --complexity small`.
Use the actual brief's task class and complexity. Supply `--actors <file>` only
for observed native/provider model metadata, and scoped lesson inputs when enabled.
For paired fixtures, also supply `--task-id`, `--snapshot-id` and `--check-version`
from the frozen host-verified fixture. Resolver `model_capability` stays
`unverified`; it cannot replace the native preflight.
The current hook CLI does not export its active AW run ID to the caller. Selection
receipts require independently known exact host metadata via `--run-id`; without
it, policy identity stays UNKNOWN and is excluded from learning. Do not guess the
current conversation from a global latest-run record.
GUI/computer-use: `node scripts/resolve-profile.mjs --host codex --role worker --route computer-use`.
Teacher: `--role teacher --route teacher`. Preflight once per unchanged profile
using native metadata and router request evidence, never model self-reports.
Stop on unknown/mismatched routing. For installation or unavailable agents,
read [setup](setup.md); Codex role files must not be symlinks.

Use configured native MCPs or fetch/browser, not hosted web_search on Venice.
The selected effective policy supplies the workflow budget. Generated profiles
use the playbook default of 125 tool steps; Codex has no claimed native hard cap. Main
stops no-gain loops and verifies results. Missing exact usage tokens stay null;
load telemetry details only when attesting, never read transcripts.

Host capabilities and T3 provider delegation are declared in [policy v5](policy-v5.md).
