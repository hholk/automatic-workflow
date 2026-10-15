# OpenCode runtime

Dedicated AW profiles are the default. Native `task` has no model override.

| Route | subagent_type | Model |
|---|---|---|
| GUI/computer-use | `aw-worker` | pinned `venice/openai-gpt-6-luna` |
| fix, implement | `aw-worker` | `venice/openai-gpt-6-luna` |
| explore, diagnose, review, compare | `aw-reviewer` | `venice/openai-gpt-6-luna` |
| explicit GLM request, fix/implement | `aw-glm53-worker` | `venice/z-ai-glm-5-3-flash` |
| explicit GLM request, explore/diagnose/review | `aw-glm53-review` | same GLM |
| teacher | `aw-teacher` | `venice/claude-opus-5-5` |

Workers deny recursive task calls and explicitly allow both MCP namespaces.
Teacher denies all tools. Workers have `steps: 8`; the cap is not completion.
The `computer-use` route is pinned by `prompts/profiles.json`; an explicit
different model is rejected by the resolver.
Resume through `task_id` with new evidence only. Main validates n/N checks.

From the absolute skill directory:
`node scripts/resolve-profile.mjs --host opencode --role worker --route fix`.
GUI/computer-use: `node scripts/resolve-profile.mjs --host opencode --role worker --route computer-use`.
Teacher: `--role teacher --route teacher`. Load returned components once.

Preflight once per unchanged session/profile: a cheap native child must prove
`providerID`/`modelID` = `venice`/`openai-gpt-6-luna` or
`venice`/`claude-opus-5-5` (GLM: `venice`/`z-ai-glm-5-3-flash`). Config and self-identification are not proof.
On mismatch, missing metadata or missing agent, stop. Never use stale cached
profiles or substitute general/explore. For installation/reload failures only,
read [setup](setup.md). Record prompt-free telemetry; no benchmark per task.
