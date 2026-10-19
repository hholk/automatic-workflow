# Migrating AW v4 to v5

This revision integrates small gates into the existing AW worker/teacher flow.
It preserves worker-v1 and teacher-v1 required message fields, run-v4 telemetry,
schema version 4 playbooks, configured worker/teacher models, and default
teacher tool restrictions. The playbook release is `acceptance-routing-v5`.
There is no background process, production installation or automatic rollout.
See the [smallest installation and native probe plan](smoke-v5.md) before a
separately authorized rollout.

## What changes

| Module | Integration | Offline proof |
|---|---|---|
| Policy and capabilities | Shared effective policy in resolver and research; provenance-specific cells need actual actor evidence | `effective-policy.test.mjs`, `resolve-profile.test.mjs` |
| Host installation | Explicit host selection, ownership checks and unchanged files on repeated apply | `install-agents.test.mjs` with temporary homes |
| Generated profiles | Worker limits derive from policy; current generated cap is 125, handback after two failed hypotheses | `render-agents.test.mjs`, `check-models.mjs` |
| Task and acceptance | Version 1 scoped criteria and evidence; final main integration verification | `execution-state.test.mjs` |
| Strategy and cost | Rule routing only at milestones, first proven capable path or explicit valid selection, full actor cost ledger | `execution-state.test.mjs` |
| Recovery | Distinct observed attempts, verified progress reset, cycle detection and one bounded recovery; repeats/environment blocks stop | `execution-state.test.mjs` |
| Teacher | Preventive tool-free advice; separately assessed two-attempt snapshot request; real host grant required | `teacher-inspection.test.mjs`, `teacher-read-policy.test.mjs` |
| Lessons and learning | Reviewed exact project/version applicability; independent promotion review and disjoint holdout | `learning-policy.test.mjs`, `autoresearch.test.mjs` |
| Human decisions and reuse | Exact-scope authority ledger and conservative evidence invalidation | `execution-state.test.mjs` |
| Parallel work | At most two independent workers, unique owners, prepared isolated writable worktrees and main integration | `execution-state.test.mjs` |

Budget values in the generated profiles are repository changes, not changes to
running tasks or installed defaults. The existing one-authorized-continuation
limit in `bounded-v3` remains eight steps. It is a recovery slice, not a native
default worker cap. Frozen teacher limits remain five ASKs and seven turns per
ASK. Model aliases in runtime/setup documentation now match the registry's
native `venice/claude-opus-5-5` binding; this does not change the model selection.

## Adopt per host

1. Review the commit and the [host matrix](policy-v5.md). Keep the deployment
   separate from development tests. Check the selected host's actual model and
   native-agent metadata before dispatch.
2. Run `node scripts/render-agents.mjs`, then `npm test` and
   `node scripts/benchmark.mjs` without `--live` or `--write`.
3. Check only the requested host using
   `node scripts/install-agents.mjs --host <codex|opencode|github-copilot>`.
   An actual installation needs authorization; use `--apply` only for that
   selected host. There is no T3 install path. T3 explicitly delegates to its
   selected Codex or OpenCode provider.
4. Start a fresh host session when installing new profiles. Existing tasks keep
   their original configuration. Do not rename or overwrite unrelated agents.
5. Use the bounded-stdin execution CLI described in
   [execution v5](execution-v5.md). Main persists task, dispatch, progress,
   recovery and authority ledgers before acting. These pure gates do not spawn
   workers, create worktrees, test code or verify human identity themselves.
   The legacy `gate.mjs` requires the same scoped main acceptance input for
   VERIFIED; a plain DONE string is only preliminary worker evidence.
6. Keep learning opt-in. Old promotion invocations without a split manifest and
   independent approval now fail. Re-evaluate and review the exact candidate;
   do not fabricate approval or reuse a prior evidence packet. Matching local
   review JSON validates metadata but does not authorize promotion. The current
   CLI has no playbook write path; authenticated host review is still required.

Historical run-v4 files and `benchmarks/latest.json` remain historical. No old
run receives invented provenance, costs, versioned check results or review.
Missing evidence stays unknown. Re-run the affected checks to obtain current
evidence, rather than upgrading old records by assertion.

The CLI entrypoints resolve installed skill symlinks before comparing paths.
Run-v4 gains nullable snapshot/check identity and frontend/provider fields.
Schema-2 selection receipts carry them from the resolver to both existing
adapters. Old receipts fail closed, and old runs without stable fixture identity
remain readable but cannot form learning pairs. T3 cells now use `t3>codex` or
`t3>opencode`, rather than conflating providers. No cells or model defaults are
rewritten by this migration. Configured model availability stays `unverified`.

## Remaining host work

No live model call or host permission grant was used to validate this revision.
The offline suite checks policy and contract behavior with synthetic fixtures.
Native dispatch, executed-model provenance, integration checks, worktree safety,
reviewer identity and human authority still need the actual host's enforcement.
The parallel module validates and bounds a plan; main performs the existing
native dispatches and integration. It is not an executable worker scheduler or
a worktree creator. No live parallel execution has been demonstrated here.

Normal resolver calls must supply task class and complexity. OpenCode's existing
shell.env hook supplies the exact run context. Codex's turn-aware UserPromptSubmit
hook returns a context locator for main to pass to the resolver. These paths are
offline-tested and require the host to deliver their documented metadata.
Copilot and Codex hosts without turn metadata need independently known exact
--run-id input. See [run context](run-context.md) for the transport and limits.
Without a current exact receipt, policy identity is unknown and cannot enter
learning comparisons. Never infer the active conversation from a global latest
run, or manufacture a receipt to make historical data eligible.

Direct teacher snapshot diagnosis is deliberately unsupported on every current
adapter. The immutable snapshot and lifecycle policy are implemented, but a
production host bridge is not. Until a real host provides task-bound safe text
production, one-time explicit approvals, constrained read/search and revocation,
the teacher remains tool-free and main supplies worker EVIDENCE. Generic read
tools, shell access or extra MCP permissions are not substitutes.

Copilot has a worker profile but no supported teacher binding. A Copilot teacher
request stops with BLOCKED_ENVIRONMENT. T3 support describes provider delegation,
not independent skill discovery or a proven live provider deployment.

Learning checks exact artifacts and evidence, but local JSON cannot authenticate
a reviewer or prove advance holdout reservation. The host review process must
supply independent approval and the experiment record. Learned rules cannot
alter thresholds, safety fields, permissions or the promotion gates.
