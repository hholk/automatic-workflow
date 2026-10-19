---
name: aw
description: Use when supervising a multi-step task whose exploration, implementation, debugging, review, architecture, or measured agent optimization benefits from native subagents.
---

# AW v5

Main alone orchestrates. The profile registry defines the non-teacher binding for each
supported host. Native Venice workers use DeepSeek 1017. Claude Opus 5.5 through Venice is the advisory teacher.
No alternate-model fallback; unavailable profiles stop with BLOCKED_ENVIRONMENT.

Optimize total cost to accepted completion at main-agent quality. Honor explicit
requests for independent judgment.

## Route

First matching row wins. Details and load paths: [routing](references/routing.md).

| Signal | Route |
|---|---|
| Required authority or material user choice missing | human |
| Live GUI/computer-use interaction is required | computer-use |
| Main can finish and verify safely for less than a handoff | direct |
| Decisive technical gap after a useful probe, or architecture/hard-fix unresolved | teacher |
| Completed change needs independent evidence | review |
| Root cause evidenced | fix |
| Target state and verification known | implement |
| Is/should gap, cause unknown | diagnose |
| Read-only structure, ownership or callers question | explore |

Direct executes and verifies; human asks for the missing decision. Other routes continue below.

Modes outside the task route: `$aw research` and `$aw learn` (see
[autoresearch](references/autoresearch.md) and [lessons](references/lessons.md)).
Run them only when explicitly requested.

## Execute

Use Codebase Memory for structure or Context7 for library behavior when either is likely
cheaper than manual discovery; reuse sufficient supplied evidence.

1. Freeze `OBJECTIVE | SUCCESS | CONTEXT | PATHS | NON_GOALS | VERIFY` before dispatch.
   `SUCCESS` lists numbered, falsifiable criteria; `VERIFY` names one command.
   A brief without both is not dispatched.
2. Read one runtime: [Codex](references/runtimes-codex.md),
   [OpenCode](references/runtimes-opencode.md), or [Copilot](references/runtimes-copilot.md).
3. At a routing milestone, apply the strategy/model route gate before resolving
   a changed profile. Keep the configured default when no proven alternative is
   available; unknown cost never establishes a saving. Pass the selected model
   to the resolver and stop if the host/profile cannot support it.
   Run `node scripts/resolve-profile.mjs` with the host, role, route,
   `--task-class` and `--complexity` from the frozen brief; load only the returned component paths
   once. Use its native binding and budget. For a model-specific policy cell,
   pass bounded native/provider metadata with `--actors <file>`; a configured
   model name is insufficient. When lessons are enabled, pass the reviewed store
   and explicit project/version/prerequisites per [policy inputs](references/policy-v5.md).
   Include returned lesson IDs and instructions in the next worker's CONTEXT;
   they remain subordinate to the task and safety rules.
   For comparison evidence, also pass the sanitized `--task-id`, `--snapshot-id`
   and `--check-version` from the verified fixture; never substitute a run ID.
   Resolver model availability stays `unverified` until the execution host
   supplies native proof. A configured binding alone cannot prove availability.
4. Apply [execution gates](references/execution-v5.md) with
   `node scripts/execution-state-cli.mjs <action>` and bounded JSON on stdin.
   Validate the versioned brief before dispatch. Use proven capable profiles
   and total run costs at milestones. Main confirms
   evidence; missing provenance or cost stays unknown.
5. Dispatch one bounded worker. Only the main agent may start or resume agents.
   At most two independent workers may run; use the dispatch gate, unique write
   ownership, prepared isolated worktrees for parallel writes, and an integration
   VERIFY. Record dispatch IDs before acting to prevent duplicate starts.
6. Read `DONE` or `TEACHER_REQUEST` via [worker contract](contracts/worker.md).
   Main owns unfinished work; missing evidence is UNKNOWN, never PASS.
   Apply the recovery gate after observed progress or a failed probe. One bounded
   recovery is allowed; unresolved cycles then stop. Reuse evidence only when
   task, objective revision, snapshot and versioned check still match.
7. Eligible teacher requests use [teacher loop](references/teacher.md). Advisory
   consultation can prevent failures. Direct [snapshot diagnosis](references/teacher-inspection.md)
   requires two proven no-progress attempts and a real scoped host grant.
   Unsupported hosts keep worker EVIDENCE and the tool-free teacher profile.
8. Main integrates and verifies every SUCCESS criterion against the final artifact,
   including visual fidelity or source support when relevant. Run the narrowest
   acceptance probe and versioned acceptance gate; reuse fresh evidence elsewhere.
   Review independently when risk, uncertainty or the user requires it. Record
   prompt-free v4 telemetry. Use the exact [run context](references/run-context.md)
   supplied by OpenCode's shell environment or Codex's turn hook. Copilot and
   hosts without that metadata need an independently known `--run-id`; no receipt means
   unknown policy identity and exclusion from learning, never default labels.
   The v5 rollout preserves its wire schema.

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
