# OpenCode runtime

Dedicated AW profiles are the default. Native `task` has no model override.

| Route | subagent_type | Model |
|---|---|---|
| fix, implement | `aw-mimo-worker` | `venice/claude-haiku-5-5` |
| explore, diagnose, review, compare | `aw-mimo-review` | `venice/claude-haiku-5-5` |
| explicit GLM request, fix/implement | `aw-glm53-worker` | `venice/z-ai-glm-5-3-flash` |
| explicit GLM request, explore/diagnose/review | `aw-glm53-review` | same GLM |
| teacher | `aw-opus-teacher` | `venice/claude-opus-5-5` |

Workers deny recursive task calls and explicitly allow both MCP namespaces.
Teacher denies all tools. Workers have `steps: 8`; the cap is not completion.
Resume through `task_id` with new evidence only. Main validates n/N checks.

From the absolute skill directory:
`node scripts/resolve-profile.mjs --host opencode --role worker --route fix`.
Teacher: `--role teacher --route teacher`. Load returned components once.

Preflight once per unchanged session/profile: a cheap native child must prove
`providerID`/`modelID` = `venice`/`claude-haiku-5-5` or
`venice`/`claude-opus-5-5` (GLM: `venice`/`z-ai-glm-5-3-flash`). Config and self-identification are not proof.
On mismatch, missing metadata or missing agent, stop. Never use stale cached
profiles or substitute general/explore. For installation/reload failures only,
read [setup](setup.md). Record prompt-free telemetry; no benchmark per task.
