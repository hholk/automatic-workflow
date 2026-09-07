---
name: aw
description: Use when supervising a multi-step task whose exploration, implementation, debugging, review, architecture, or measured agent optimization benefits from native subagents.
---

# AW v4

AW makes the main agent the sole orchestrator. GLM 5.3 Flash is the primary
worker, Luna is an explicit measured fallback, and Sol is the default advisory
teacher. GPT-6 Astra requires an explicit user request.

## Modes

- `$aw research` or `/aw research` → read
  [autoresearch](references/autoresearch.md), then only its requested runtime
  and [telemetry](references/telemetry.md) details.
- `$aw learn` → read [lessons](references/lessons.md).
- Otherwise choose the first route below and load exactly one workflow.

## Fast route

1. Irreversible action, secret, authority, or product decision → human.
2. Material technical evidence gap after useful probes → teacher.
3. Completed change needing independent evidence → review.
4. Known cause → fix; known target state → implement.
5. Unknown is/should gap → diagnose; read-only question → explore.
6. Tiny safe task cheaper than handoff → direct.

If ambiguous, read [routing](references/routing.md). Otherwise load only
`workflows/<route>.md`.

## Execute

Before manual discovery or dispatch, use Codebase Memory for decision-relevant
code structure or Context7 for current library behavior when either is likely
cheaper than manual discovery; reuse sufficient supplied evidence instead of a
redundant call.

1. Freeze `OBJECTIVE | SUCCESS | CONTEXT | PATHS | NON_GOALS | VERIFY`.
2. Read exactly one runtime:
   [Codex](references/runtimes-codex.md),
   [OpenCode](references/runtimes-opencode.md), or
   [Copilot](references/runtimes-copilot.md).
3. Run `node scripts/resolve-profile.mjs` for the intended native agent and
   selected prompt profile; load only the returned component paths in order.
4. Dispatch one bounded worker. Only the main agent may start or resume agents.
5. Accept `DONE` or `TEACHER_REQUEST` from
   [the worker contract](contracts/worker.md). Validate evidence directly;
   missing evidence is UNKNOWN, never PASS.
6. For an eligible teacher request, follow
   [the teacher loop](references/teacher.md) in the same teacher thread. Sol is default;
   Astra requires an explicit user request.
7. Run the outer verification gauntlet and record prompt-free v4 telemetry.

No raw prompts, transcripts, diffs, secrets, recursive workers, silent
fallback, commit, push, deploy, or release. A fallback needs an exact reason
and a new evidence cell. A scheduler may invoke one bounded weekly run; the
other methods stay in the [research backlog](references/autoresearch-backlog.md).
