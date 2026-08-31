---
name: aw
description: Use when supervising a multi-step codebase task whose exploration, implementation, debugging, review, or architecture work benefits from native subagents.
---

# AW v2

AW is a thin supervisor for native OpenCode and Codex subagents. GLM 5.3 Flash
does the work; GPT-5.6 Sol is an advisory teacher only for architecture and
hard fixes. The host owns scope, permissions, integration, and final evidence.

## Fast route

Choose the first match:

1. Irreversible action, secret, or missing product decision → human.
2. Architecture decision or hard fix after two discriminating failed attempts → teacher.
3. Completed change needing independent evidence → review.
4. Known cause → fix; known behavior change → implement.
5. Unknown cause → diagnose; read-only mapping → explore.
6. A tiny local task cheaper than a handoff → do it directly.

If routing is ambiguous, read [references/routing.md](references/routing.md).
Load exactly one matching file from `workflows/`. Do not preload all workflows.

## Execute

1. State objective, success evidence, relevant paths, non-goals, and verify command.
2. Read [references/runtimes.md](references/runtimes.md), then dispatch one native
   GLM worker. Parallelize only independent read-only work or disjoint writes.
3. Accept claims only with file/command evidence. Reconcile shared changes, then
   run the smallest relevant verification in the host.
4. If the route becomes `teacher`, read [references/teacher.md](references/teacher.md).
   Sol must not inspect, edit, execute, orchestrate, or release; GLM supplies all evidence.
5. Record repo-specific learning in `LESSONS-REPO.md`. Change AW itself only
   through a measured experiment recorded in `LESSONS.md`; read
   [references/lessons.md](references/lessons.md) before writing either file.

## Compact contracts

Worker brief: `OBJECTIVE | SUCCESS | CONTEXT | PATHS | NON_GOALS | VERIFY`.

Worker result: `STATUS | CHANGED | EVIDENCE | RISKS | NEXT`.

Keep context bounded: paths and short evidence, never full histories, full diffs,
secrets, or speculative background. No custom runner, daemon, ledger, polling
loop, or recursive worker spawning. Native session state is authoritative.
