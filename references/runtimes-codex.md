# Codex runtime

Code and computer-use routes select native `gpt-6.1-terra` with low reasoning.
Resolve the complete model, provider, role, prompt profile and budget from
`prompts/profiles.json`. The generated `aw-worker` and `aw-reviewer` roles bind
`model_provider: openai` and `model_reasoning_effort: low`; review retains its
read-only sandbox. Keep the main model and reasoning unchanged.

From the absolute skill directory:
`node scripts/resolve-profile.mjs --host codex --role worker --route fix --task-class diagnosed-bug --complexity small`.
Use the actual task class/complexity. Review uses `--role worker --route review`;
GUI/computer-use uses `--route computer-use`. Verify host capabilities on actual use.
Teacher uses `--role teacher --route teacher` and remains advisory/tool-free,
with `venice-responses/claude-opus-5-5` through Codex Router.

Use the complete returned binding, including `reasoning_effort: low`, for
explicit native model selection. For T3, follow its live orchestration
instructions for provider delegation and user-requested settings. Bindings do
not grant dispatch permission or prove runtime availability.

Supply `--actors <file>` only for observed native/provider metadata. The resolver
reports capability as unverified. Inspect model and reasoning metadata on the
first actual worker execution per unchanged session/profile. On an unavailable
or mismatched binding, report `BLOCKED_ENVIRONMENT`; honor explicit model
requirements without alternate-provider retries.

Use `fork_turns: none` when offered and send bounded task context. Enforce the
remaining cumulative budget. Workers cannot delegate or modify AW. Close or
interrupt finished children using the host's lifecycle operation.

Pass the exact `--run-context` from the lifecycle hook, or an independently known
`--run-id`, to correlate receipts and telemetry. Include task class and complexity.
When available, pass real `--task-id`, `--snapshot-id`, `--check-version`; missing
comparison identity stays unknown. See [run context](run-context.md) and
[policy inputs](policy-v5.md).

Use configured native MCPs and supported fetch tools for evidence. Read
[setup](setup.md) for installation/reload failures. Reload the host after global
installation so it discovers the changed fixed roles.
