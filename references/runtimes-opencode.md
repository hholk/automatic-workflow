# OpenCode runtime

Dedicated AW profiles are the default. Native `task` has no model override.

| Route | subagent_type | Model |
|---|---|---|
| GUI/computer-use | `aw-worker` | pinned `venice/deepseek-v4-1-flash-1017` |
| fix, implement | `aw-worker` | `venice/deepseek-v4-1-flash-1017` |
| explore, diagnose, review, compare | `aw-reviewer` | `venice/deepseek-v4-1-flash-1017` |
| teacher | `aw-teacher` | `venice/claude-opus-5-5` |

Workers deny recursive task calls and explicitly allow both MCP namespaces.
Teacher denies all tools. Generated workers use the playbook default `steps: 125`, including explicit
legacy profile names. Their generated model binding is now the same native
DeepSeek 1017 worker; retained names do not select old models or trigger an
alternate-model fallback.
The selected cell may require an earlier handback; the cap is not completion.
The `computer-use` route is pinned by `prompts/profiles.json`; an explicit
different model is rejected by the resolver.
Resume through `task_id` with new evidence only. Main validates n/N checks.

From the absolute skill directory:
`node scripts/resolve-profile.mjs --host opencode --role worker --route fix --task-class diagnosed-bug --complexity small`.
Use the actual brief's task class and complexity. The existing plugin's shell.env
supplies AW_RUN_CONTEXT and AW_RUN_ID; the CLI validates that exact context before
recording the selected policy. See [run context](run-context.md).
Missing task metadata leaves the receipt UNRECORDED and telemetry ineligible.
Pass `--actors <file>` for observed metadata and scoped lesson inputs when enabled.
For paired fixtures, pass the frozen `--task-id`, `--snapshot-id` and
`--check-version` to the resolver. The automatic adapter takes them from the
run-bound receipt. Missing values stay unknown and exclude comparison.
T3 calls additionally select `--host t3 --provider-host opencode`; the receipt
preserves T3 separately from the native execution host. Model availability
remains `unverified` in resolver output until a real native preflight proves it.
GUI/computer-use: `node scripts/resolve-profile.mjs --host opencode --role worker --route computer-use`.
Teacher: `--role teacher --route teacher`. Load returned components once.

Preflight once per unchanged session/profile: a cheap native child must prove
`providerID`/`modelID` = `venice`/`deepseek-v4-1-flash-1017` or
`venice`/`claude-opus-5-5`. Config and self-identification are not proof.
On mismatch, missing metadata or missing agent, stop. Never use stale cached
profiles or substitute general/explore. For installation/reload failures only,
read [setup](setup.md). Record prompt-free telemetry; no benchmark per task.

Host capabilities and T3 provider delegation are declared in [policy v5](policy-v5.md).
