# Codex runtime

Use explicit native model selection and the resolved prompt profile.

| Route | agent_type | model | model_provider |
|---|---|---|---|
| fix, implement | `aw-mimo-worker` | `venice/mimo-2.6-flash` | `codex-router` |
| explore, diagnose, review, compare | `aw-mimo-review` | same MiMo | `codex-router` |
| teacher | `aw-opus-teacher` | `venice/opus-5.5` | `codex-router` |

Agent files bind model/provider/high effort, not inherited Ultra, and disable
child skill-catalog instructions. Use native spawn/resume tools; set
`fork_turns: none` and model overrides only if exposed by the live schema.
Send delta-only follow-ups. Close/interrupt finished children with the offered
tool. No recursive agents or alternate-model retries. A child that still
inherits a large context is a measured cost, not a reason to fork more.

From the absolute skill directory:
`node scripts/resolve-profile.mjs --host codex --role worker --route fix`.
Teacher: `--role teacher --route teacher`. Preflight once per unchanged profile
using native metadata and router request evidence, never model self-reports.
Stop on unknown/mismatched routing. For installation or unavailable agents,
read [setup](setup.md); Codex role files must not be symlinks.

Use configured native MCPs or fetch/browser, not hosted web_search on Venice.
Eight tool steps is a workflow budget, not a claimed native hard cap. Main
stops no-gain loops and verifies results. Missing exact usage tokens stay null;
load telemetry details only when attesting, never read transcripts.
