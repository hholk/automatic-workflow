---
name: aw
description: Use when supervising a multi-step task whose exploration, implementation, debugging, review, architecture, or measured agent optimization benefits from native subagents.
---

# AW v4

Main alone orchestrates. Claude Haiku 5.5 through Venice is the non-teacher default in every
supported host. Claude Opus 5.5 through Venice is the advisory teacher.
No alternate-model fallback; unavailable profiles stop with BLOCKED_ENVIRONMENT.

## Modes

- `$aw research` / `/aw research` → [autoresearch](references/autoresearch.md).
- `$aw learn` → [lessons](references/lessons.md).
- Otherwise follow the first matching route.

## Fast route

Optimize total cost to accepted completion at main-agent quality, including
briefing, child context, verification and repair. Honor explicitly requested
independent judgment.

1. Required authority or material user choice is missing → human.
2. Main can finish safely for less than a handoff → direct.
3. Material technical decision remains unresolved after useful probes → teacher.
4. Completed change needs independent evidence → review.
5. Known cause → fix; known target state → implement.
6. Unknown is/should gap → diagnose; read-only question → explore.

If ambiguous, read [routing](references/routing.md). Direct executes and verifies;
human asks for the missing decision. Delegated routes continue below.

## Execute

Use Codebase Memory for structure or Context7 for library behavior when either is likely
cheaper than manual discovery; reuse sufficient supplied evidence.

1. Freeze `OBJECTIVE | SUCCESS | CONTEXT | PATHS | NON_GOALS | VERIFY`.
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
