---
name: aw
description: AW v7 delegates non-trivial discovery, diagnosis, implementation and review to scoped subagents, with focused teacher help, verified acceptance and Hstack operating learning.
---

# AW v7 · Hstack-coupled operating learning

State this heading and the selected route once on activation. Main owns routing,
integration and acceptance. Resolve models and complete native bindings from
`prompts/profiles.json`; code workers default to Terra with low reasoning. Keep the current main
model and explicit user model choices. Host instructions govern dispatch.

Optimize accepted outcomes and total cost. Measure cheap-model token share without quotas. Confirm
availability and quality from actual runs.

## Hstack defaults

Load curated `../../poteto-mode/poteto-core.md` once per session when present
in the Hstack bundle. Otherwise load `../../poteto-mode/SKILL.md`. These paths
are relative to the Hstack reference. Apply
[Hstack compatibility rules](references/hstack.md) to Poteto and
`recommended_hstack_skills` from the resolver. Include reviewed project lessons
from `.aw/lessons.json` when the resolver selects them.

## Route and scope

Use [routing](references/routing.md). Delegate by default for multi-file discovery,
diagnosis, non-trivial implementation, independent verification or review, and
two or more useful parallel slices. Reserve `direct` for a tiny single-location
edit or immediate read/check that fully satisfies the request in one verified
step and plainly costs less than a handoff.

Give each worker one complete, observable outcome: OBJECTIVE, numbered SUCCESS,
CONTEXT, PATHS, NON_GOALS and VERIFY. Include the relevant requirement sources,
decisive evidence, dependencies and stop conditions. When a supporting skill can
prevent a concrete mistake, [put its useful step in CONTEXT](references/hstack.md#worker-handoff).
Freeze a v2 brief through
[execution gates](references/execution-v5.md). Derive acceptance from the user's
requirements and independent evidence.

Use `assurance: direct` by default on any route. Use `reviewed` for material risk,
unresolved acceptance uncertainty or requested independent review.
Long or resumed work checkpoints through
[mission lifecycle](references/mission-lifecycle.md), including direct work.
For UI changes, load [UI/UX acceptance](references/ui-ux.md) before implementation
and include its screenshot checkpoints in SUCCESS and any worker brief.

## Execute

1. Read the current host runtime: [Codex](references/runtimes-codex.md),
   [OpenCode](references/runtimes-opencode.md), or [Copilot](references/runtimes-copilot.md).
   Run `node scripts/resolve-profile.mjs` with host, role, route, task class and
   complexity. Supply the exact run context when available. Load only returned
   components and decision-relevant references. Use the complete returned binding.
2. Main alone dispatches scoped `aw-worker` or `aw-reviewer` subagents under the
   resolved binding. Default to up to two ready independent workers concurrently.
   Honor explicit concurrency requests up to the host cap. Settle prerequisites
   and interfaces first. Give each writer unique file ownership and use host-managed
   isolated worktrees for parallel writes. Reserve IDs, reconcile ambiguous starts,
   and close or cancel finished or replaced agents through the host.
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
7. Close runs with `usage.mjs attest`. Use the `mission-state-cli.mjs` accept
   attestation payload when available. Record main repair, failed attempts and teacher work through
   [run context](references/run-context.md) and [telemetry](references/telemetry.md).
   Missing usage or acceptance evidence stays unknown.

## Improve from operation

At completion with new evidence, use [operating learning](references/operating-learning.md)
and inspect `skill_hints` and `active_trial` with `usage.mjs operating` and
`usage.mjs doctor`. Main can make one bounded reversible local adaptation
from real outcomes. Retain trial and rollback evidence. Preserve user requirements,
acceptance, permissions, provider authorization and frozen safety boundaries.
Use [`$aw research`](references/autoresearch.md) for opt-in controlled comparison.
Workers cannot recursively delegate or change AW. Release actions require an
explicit assignment and the project's deployment instructions.

## Completion animatic

After verification, run curated Hstack `animatic` for `assurance: "reviewed"`,
user-visible UI changes, pull-request deliverables, or explicit user requests.
Use the completed work as evidence and follow the PR guidance when applicable.
Report missing media tools as an animatic blocker. Post only when authorized.
For short direct non-UI work, hand back concise `ketchup`-style outcome and
verification evidence.
