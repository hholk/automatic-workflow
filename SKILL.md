---
name: aw
description: AW v5 with scoped UI/UX design and live acceptance checks. Use when supervising a multi-step task whose exploration, implementation, debugging, review, architecture, or measured agent optimization benefits from native subagents.
---

# AW v5 · UI/UX

On activation, state this heading and the selected route once in the first progress
update, so the user can identify the loaded skill version.

Main alone orchestrates. The profile registry defines the non-teacher binding for each
supported host. Native Venice workers use DeepSeek 1017. Claude Opus 5.5 through Venice is the advisory teacher.
Unavailable profiles stop with BLOCKED_ENVIRONMENT. On native Codex workers only, an observed DeepSeek spend-limit, provider-disabled, or route-unavailable result may select native `gpt-6-luna`; the caller must preserve requested/resolved model and the exact failure reason. Never use this for auth, permission, approval, safety, unknown failures, explicit model requests, delegates, or computer-use.

Optimize total cost to accepted completion at main-agent quality. Honor explicit
requests for independent judgment.

## Route

First matching row wins. Details and load paths: [routing](references/routing.md).

| Signal | Route |
|---|---|
| Required authority or material user choice missing | human |
| The objective is operating a live GUI, app or device | computer-use |
| Main can finish and verify safely for less than a handoff | direct |
| Decisive technical gap after a useful probe, or architecture/hard-fix unresolved | teacher |
| Completed change needs independent evidence | review |
| Root cause evidenced | fix |
| Target state and verification known | implement |
| Is/should gap, cause unknown | diagnose |
| Read-only structure, ownership or callers question | explore |

Direct executes and verifies, skipping workflow dispatch steps; human asks for the
missing decision. For interface or module-design decisions, consult `codebase-design`
as reference before considering teacher escalation. Other routes continue below.
For UI changes, apply the scoped [UI/UX reference](references/ui-ux.md); retain the
implementation, fix or review route and use computer-use for its bounded live checks.

Substantial, high-risk, multi-session, or explicitly independently reviewed work uses
`assurance: reviewed` and the [mission lifecycle](references/mission-lifecycle.md),
including when main implements directly. Small tasks and bounded read-only probes
use `assurance: direct`; they need no mission checkpoint or review fanout.

Modes outside the task route: `$aw research` and `$aw learn` (see
[autoresearch](references/autoresearch.md) and [lessons](references/lessons.md)).
Run them only when explicitly requested.

## Execute

Use Codebase Memory for structure or Context7 for library behavior when either is likely
cheaper than manual discovery; reuse sufficient supplied evidence.
Main resolves named skills from the active catalog and passes relevant reference
paths in CONTEXT. Consult only the named phases; AW retains dispatch and budgets.
User-only or inactive skills require explicit invocation.

1. Freeze `OBJECTIVE | SUCCESS | CONTEXT | PATHS | NON_GOALS | VERIFY` before dispatch.
   `SUCCESS` lists numbered, falsifiable criteria; `VERIFY` names one command.
   Reuse the project's verification skill or existing test/run commands. If none
   answers the criterion, first establish a narrow executable probe; an exit code
   alone must not substitute for the promised behavior.
   Use a v2 brief with an explicit assurance mode. For reviewed work, preserve the
   original request, later decisions and applicable constraints, map them to criteria,
   and pass a fresh [contract review](workflows/contract-review.md) before work dispatch.
2. Read one runtime: [Codex](references/runtimes-codex.md),
   [OpenCode](references/runtimes-opencode.md), or [Copilot](references/runtimes-copilot.md).
3. At a routing milestone, apply the strategy/model route gate before resolving
   a changed profile. Keep the configured default unless the native Codex host has confirmed one of the
   bounded DeepSeek failure classes described above. Unknown cost or errors never
   establish a fallback. Pass the selected model
   to the resolver and stop if the host/profile cannot support it.
   Run `node scripts/resolve-profile.mjs` with the host, role, route,
   `--task-class` and `--complexity` from the frozen brief; load only the returned component paths
   once, plus the applicable skill references. Use its native binding and budget.
   Load [policy inputs](references/policy-v5.md) for model-specific cells, reviewed
   lessons or comparison evidence; supply the required observed metadata and
   scoped identities there.
   Resolver model availability stays `unverified` until the execution host
   supplies native proof. A configured binding alone cannot prove availability.
4. Apply [execution gates](references/execution-v5.md) with
   `node scripts/execution-state-cli.mjs <action>` and bounded JSON on stdin.
   Validate the versioned brief before dispatch. Use proven capable profiles
   and total run costs at milestones. Main confirms
   evidence; missing provenance or cost stays unknown.
   Reviewed and long-running work checkpoints its mission before dispatch and after
   results. On resume, read the checkpoint and reconcile reserved/active task IDs
   with the host before starting more work; follow the mission lifecycle.
5. Dispatch one bounded worker. Only the main agent may start or resume agents.
   At most two independent workers may run; use the dispatch gate, unique write
   ownership, prepared isolated worktrees for parallel writes, and an integration
   VERIFY. Record dispatch IDs before acting to prevent duplicate starts.
6. Read `DONE` or `TEACHER_REQUEST` via [worker contract](contracts/worker.md).
   Main owns unfinished work; missing evidence is UNKNOWN, never PASS.
   Apply the execution gates for recovery after failed probes and replanning after
   discovered gaps. Repair the earliest invalid artifact and revalidate affected
   evidence, preserving user scope and spent recovery budget. Reuse evidence only
   when task, objective revision, snapshot and versioned check still match.
7. Eligible teacher requests use [teacher loop](references/teacher.md). Advisory
   consultation can prevent failures. Direct [snapshot diagnosis](references/teacher-inspection.md)
   requires two proven no-progress attempts and a real scoped host grant.
   Unsupported hosts keep worker EVIDENCE and the tool-free teacher profile.
8. Main verifies every SUCCESS criterion against the integrated artifact, including
   relevant visual fidelity or source support. Run the narrowest acceptance probe
   and versioned gate. Reviewed work also passes a fresh
   [completion review](workflows/completion-review.md) against the original request
   and later decisions, without builder reports or mission criteria. Open gaps and
   unknown checks block completion; accept checkpoints only after main verification.
   Record prompt-free v4 telemetry with the host's exact
   [run context](references/run-context.md) or independently known `--run-id`.
   Missing receipts mean unknown policy identity and exclusion from learning.
   The wire schema stays unchanged.

Resume with deltas, never histories. Preflight once per unchanged session/profile.
Research and lessons are opt-in. No secrets, recursive workers or implicit release.
Load [policy and host capabilities](references/policy-v5.md) for installation,
host delegation or cell-specific routing. Load [learning rules](references/learning-v5.md)
only for lessons or optimization; promotion requires independent review and
disjoint holdout evidence. Safety, access rights and the two-attempt threshold
are immutable to learning. Missing authority or goal conflicts use the authority
gate once per exact decision scope; reuse an existing valid human answer.
Workers may commit, push or deploy only when explicitly delegated and governed
by the project's deployment guide.
