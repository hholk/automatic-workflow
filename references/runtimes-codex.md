# Codex runtime

Code routes default to native `gpt-6-luna`. Resolve the complete model, provider,
role and budget from `prompts/profiles.json`; Luna uses `native_agent: default`
and `model_provider: codex`. The fixed `aw-worker` and `aw-reviewer` roles remain
DeepSeek profiles for an explicit supported selection. Never put a Luna override on a role that fixes another provider/model.

Keep the main model unchanged. Native Luna is selected through the native host
when supported. For T3, follow its live orchestration instructions: cross-provider
models and user-requested extra settings require its delegate API. A native role
with an external-provider model is also cross-provider. The resolver supplies
bindings, not dispatch permission or proof of runtime availability.

From the absolute skill directory:
`node scripts/resolve-profile.mjs --host codex --role worker --route fix --task-class diagnosed-bug --complexity small`.
Use the actual task class/complexity. Review uses `--role worker --route review`;
Luna's default role needs the supplied read-only contract and host-enforced
read-only tools/isolation when available. It does not inherit the fixed review
role's sandbox. Main must not claim tool isolation that the host cannot enforce.
GUI/computer-use uses `--route computer-use` and resolves to native Luna; verify its host capabilities on actual use.
Teacher uses `--role teacher --route teacher` and remains advisory/tool-free.

Supply `--actors <file>` only for observed native/provider metadata. The resolver
reports capability as unverified. Inspect host model metadata on the first actual
worker execution for an unchanged session/profile; no synthetic preflight task is
required. On an unavailable or mismatched binding, reconcile the environment or
continue a suitable slice on the already available main. Honor explicit model
requirements and T3 restrictions; no speculative alternate-provider retries.

Use `fork_turns: none` when offered and send only bounded task context. Enforce
remaining cumulative budget from main; native `default` does not supply AW's
fixed-role tool restrictions. Workers cannot delegate or modify AW. Close or
interrupt finished children using the host's offered lifecycle operation.

Pass the exact `--run-context` from the lifecycle hook, or an independently known
`--run-id`, to correlate receipts and telemetry. Include task class and complexity.
When available, pass real `--task-id`, `--snapshot-id`, `--check-version`; missing
comparison identity stays unknown. Never reconstruct it from transcripts.
See [run context](run-context.md) and [policy inputs](policy-v5.md).

The generated DeepSeek profiles retain their installed tool-step ceiling.
Task budgets may require earlier handback; budget changes never reset spent work.
Use configured native MCPs and supported fetch tools for evidence. Read
[setup](setup.md) only for actual installation/reload failures; this change does
not require replacing the fixed DeepSeek roles to execute native Luna.
