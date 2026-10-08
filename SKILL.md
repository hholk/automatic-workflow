---
name: aw
description: Use when supervising a multi-step task whose exploration, implementation, debugging, review, architecture, or measured agent optimization benefits from native subagents.
---

# AW v4

Main alone orchestrates. Claude Haiku 5.5 through Venice is the non-teacher default in every
supported host. Claude Opus 5.5 through Venice is the advisory teacher.
No alternate-model fallback; unavailable profiles stop with BLOCKED_ENVIRONMENT.

Optimize total cost to accepted completion at main-agent quality. Honor explicit
requests for independent judgment.

## Route

First matching row wins. Details and load paths: [routing](references/routing.md).

| Signal | Route |
|---|---|
| Required authority or material user choice missing | human |
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
3. Run `node scripts/resolve-profile.mjs`; load only the returned component paths
   once. Use its native binding and budget.
4. Dispatch one bounded worker. Only the main agent may start or resume agents.
5. Read `DONE` or `TEACHER_REQUEST` via [worker contract](contracts/worker.md).
   Main owns unfinished work; missing evidence is UNKNOWN, never PASS.
6. Eligible teacher requests use [teacher loop](references/teacher.md).
7. Main integrates and verifies every SUCCESS criterion against the final artifact,
   including visual fidelity or source support when relevant. Run the narrowest
   acceptance probe; reuse fresh evidence elsewhere. Review independently when
   risk, uncertainty or the user requires it. Record prompt-free v4 telemetry.

Resume with deltas, never histories. Preflight once per unchanged session/profile.
Research and lessons are opt-in. No secrets, recursive workers or implicit release.
Workers may commit, push or deploy only when explicitly delegated and governed
by the project's deployment guide.
