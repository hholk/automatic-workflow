---
name: aw
description: AW v6 for Terra-low execution, focused teacher help, outcome-based acceptance and reversible learning from real usage. Use for multi-step implementation, diagnosis or review that benefits from scoped orchestration.
---

# AW v6 · Operating learning

State this heading and the selected route once on activation. Main owns routing,
integration and acceptance. Resolve models and complete native bindings from
`prompts/profiles.json`; code workers default to Terra with low reasoning. Keep the current main
model and explicit user model choices. Host instructions govern dispatch.

Optimize accepted outcomes and total cost. Cheap-model token share is measured,
never a quota or a reason to withhold useful Astra/Opus help. Availability and
quality remain unverified until observed; configuration proves neither.

## Hstack defaults

Use `poteto-mode` as the default style and judgment reference, subject to the
[Hstack compatibility rules](references/hstack.md). Resolve its installed source
from the active catalog and read it once per session. Automatically select useful
Hstack skills for the actual task through the same rules. Load only relevant
references; AW retains orchestration, model selection and operating learning.

## Route and scope

Use [routing](references/routing.md) at meaningful decision points. Finish direct
work when delegation costs more than it contributes. Delegate for a separable
result, independent evidence, a required capability, or useful parallelism.

Give each worker one complete, observable outcome: OBJECTIVE, numbered SUCCESS,
CONTEXT, PATHS, NON_GOALS and VERIFY. Include the relevant requirement sources,
decisive evidence, dependencies and stop conditions. Freeze a v2 brief through
[execution gates](references/execution-v5.md). Derive acceptance from the user's
requirements and independent evidence, rather than only the builder's tests.

Use `assurance: direct` by default. Use `reviewed` for material risk, unresolved
acceptance uncertainty or explicitly requested independent review. Task size
alone does not require review fanout. Long or resumed work checkpoints through
[mission lifecycle](references/mission-lifecycle.md), including direct work.
For UI changes, load [UI/UX acceptance](references/ui-ux.md) before implementation
and include its screenshot checkpoints in SUCCESS and any worker brief.

## Execute

1. Read the current host runtime: [Codex](references/runtimes-codex.md),
   [OpenCode](references/runtimes-opencode.md), or [Copilot](references/runtimes-copilot.md).
   Run `node scripts/resolve-profile.mjs` with host, role, route, task class and
   complexity. Supply the exact run context when available. Load only returned
   components and decision-relevant references. Use the complete returned binding.
2. Main alone dispatches. At most two independent workers run concurrently.
   A prerequisite is ready only when its output or interface is settled; different
   files alone do not imply independence. Use unique write ownership and host-managed
   isolated worktrees for parallel writes. Reserve IDs before dispatch, reconcile
   ambiguous starts, and close/cancel finished or replaced agents through the host.
3. Supply focused context, not inherited histories. Use the resolved context
   budget as a briefing target; retain necessary evidence or split the task.
   Resume with deltas and remaining cumulative budget. Model switches, teacher
   questions and restarts do not reset spent budget. Tool-step limits are ceilings,
   not targets; stop repeated work that produces no new evidence.
4. Workers return [DONE or TEACHER_REQUEST](contracts/worker.md). Main owns all
   unfinished work. After two distinct no-progress hypotheses, test their common
   premise and use the existing bounded recovery gate. Provider outages are
   environment failures, not technical attempts.
5. Consult the [teacher](references/teacher.md) for a consequential unresolved
   decision, conflicting evidence or a missing discriminating probe. Early help
   is appropriate when a wrong boundary decision would cause substantial rework.
   Ask for the smallest useful decision and its falsification check. Give original
   evidence as well as the worker's interpretation. If advice is insufficient,
   main takes over the hard slice or explicitly selects a capable host-supported
   implementer; the advisory teacher's tool permissions remain unchanged.
6. Integrate and check every SUCCESS criterion. Reuse valid evidence only for
   unchanged task, revision, snapshot and check. Independent review, when required,
   assesses the integrated result and original requirements. Unknown remains
   unknown. If the user forbids tests or checks, honor that instruction, report
   skipped verification and leave acceptance unverified; do not manufacture PASS.
7. Record prompt-free usage and actual acceptance through the existing
   [run context](references/run-context.md) and [telemetry](references/telemetry.md).
   Include main repair, failed attempts and teacher work when observed. Missing
   token, cost, model or quality data stays unknown.

## Improve from operation

Operating learning is enabled by `playbooks/current.json`. After a completed task
with new useful evidence, main follows [operating learning](references/operating-learning.md).
It may make one small, reversible local adaptation within the configured envelope
without asking again. Keep real outcomes, trial state and rollback evidence;
ordinary use supplies the next observations. No synthetic tasks or benchmark
runs are required for a provisional operational trial.

Research-backed performance claims remain a separate opt-in path:
[`$aw research`](references/autoresearch.md). `$aw learn` follows the operating
loop unless the user explicitly asks for a controlled experiment. Runtime
adaptation never changes user requirements, acceptance standards, permissions,
provider authorization, mandatory independence or frozen safety boundaries.
Workers cannot recursively delegate or change AW. Release actions require an
explicit assignment and the project's deployment instructions.

## Completion animatic

After completing and verifying the requested work, run `animatic` to make a
short narrated explainer of the outcome and its evidence. Use the completed
work as the source; for a pull request follow the skill's PR guidance. Hand the
video to the user with the final result. If the skill or its required tools are
unavailable, report the blocker and leave the animatic unverified. Post the
video externally only when the user asks.
