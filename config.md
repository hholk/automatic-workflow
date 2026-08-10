# Flash Orchestrator — Runtime Contract

Single source of truth for the Ultrawork runtime. Change here when switching models.
Restart the session after any skill/config edit.

## Models

### Orchestrator = main chat LLM (not pinned)

The orchestrator **is the session model** — whatever LLM is active in the OpenCode
chat (`build` primary agent). Do **not** pin `build.model`.

The user (or you, when they ask) may **switch models mid-session** for planning,
hard judgment, cheaper passes, etc. Full harness stays available: planning,
skills allowlist, MCPs (memory/context7), ledger, probes, integration, human gates.

| Role | Model | Notes |
|------|--------|------|
| **Orchestrator** (main chat) | **session model** (user-selected / switchable) | planning, decompose, brief, judge, integrate, recovery |
| `flash-explore` | `venice/openai-gpt-56-luna` | Venice GPT-5.6 Luna — **hard** |
| `flash-worker` | `venice/openai-gpt-56-luna` | Venice GPT-5.6 Luna — **hard** |
| `flash-review` | `venice/deepseek-v4-flash-0731` | DeepSeek V4 Flash 0731 — **hard, review only** |

### Leaf hard rules (only these are pinned)

- **Only** `flash-review` may use `venice/deepseek-v4-flash-0731`.
- Explore and worker **always** use `venice/openai-gpt-56-luna` (GPT-5.6 Luna).
- **Never** put workers/explorers on DeepSeek, Sol, Terra, or Luna-Pro.
- No Pro/silent fallback for leaves. Optional Fix3 stays on the **same** Luna ID.
- Switching the **chat** model never changes leaf Task models — Task always
  dispatches the pinned leaf agents above.

## Attempt Sequence

`Initial → Fix1 → Fix2 → Fix3`

- Default packages: **Initial + Fix1 + Fix2**, then orchestrator integrates.
- HIGH-risk packages may use **Fix3** before orchestrator takeover.
- Optional **one model-upgrade** after failed Fix2 (HIGH only): re-dispatch
  once on the same Luna model with a mechanical Fix3 brief — not a Pro switch.
- After failed Fix3 (or failed Fix2 on LOW/MED), the orchestrator implements.
- There is no Fix4 loop and no infinite resume of the same brief.

## Risk Tiers (package sizing + gauntlet)

Classify each package as `low` | `medium` | `high` before dispatch.

| Risk | When | Max files | Max AC | Artifact lines | Tool calls | Review mode |
|------|------|-----------|--------|----------------|------------|-------------|
| **low** | docs, rename, single-file lint/test fix, pure mechanical edit | 2 | 6 | 500 | 20 | `none` if probe+verify green; else `single` |
| **medium** | feature slice in one module, plan write, multi-step TDD | 4 | 10 | 800 | 25 | `single` combined SPEC+QUALITY |
| **high** | auth, shared contracts, migrations, public API, data integrity | 2 | 6 | 400 | 15 | `dual` (parallel SPEC + QUALITY) |

Adjacent rule: every package may also touch **one adjacent test file** without
counting as an extra primary writable file (TDD).

### Soft vs hard split gates

- **Soft targets** (prefer split): LOW/MED values in the table above.
- **Hard block** (must split before Task): exceeding the tier's max files, AC,
  lines, or tool-call budget, or a multi-module blast radius with shared paths.

### Adaptive gauntlet (review_mode)

```text
IF risk=low AND artifact_probe OK AND verify_exit=0:
    review_mode = none          # orchestrator sign-off only
ELIF risk=low OR risk=medium:
    review_mode = single        # one combined critic Task
ELSE:  # high
    review_mode = dual          # two parallel flash-review Tasks
```

Re-run the gauntlet after every successful write attempt that will be accepted.
On FAIL from single/dual, feed concrete fixes into the next Fix pass.

## Global Constants

```text
BRIEF_MAX_CHARS=6000
REPORT_MAX_CHARS=2500
EVIDENCE_MAX_CHARS=4000
SUMMARY_MAX_CHARS=240
PACKAGE_MAX_FILES=4
PACKAGE_MAX_AC=10
SPLIT_TARGET_FILES=2
SPLIT_TARGET_AC=6
ARTIFACT_MAX_LINES=800
TOOL_CALL_TARGET=20
WORKER_STEPS=80
EXPLORE_STEPS=50
REVIEW_STEPS=40
STALE_PACKAGE_HOURS=6
MAX_CONCURRENT_PACKAGES=3
MAX_CONCURRENT_PACKAGES_BREADTH=5
```

`PACKAGE_MAX_*` / `ARTIFACT_MAX_LINES` / `TOOL_CALL_TARGET` are the **global
ceilings** (medium tier). HIGH uses the tighter tier table. Never exceed the
global ceilings without an explicit ledger exception event.

### Concurrency (parallel fan-out)

| Constant | Value | Meaning |
|----------|-------|---------|
| `MAX_CONCURRENT_PACKAGES` | **3** | Default max simultaneous leaves (OpenAI multi-agent recommended default for concurrent subagents) |
| `MAX_CONCURRENT_PACKAGES_BREADTH` | **5** | Soft ceiling only for effort-scale **L** breadth waves (Anthropic 3–5 parallel subagents); never above without ledger exception |

Effort scale S/M/L and the full parallel policy: [references/parallelism.md](references/parallelism.md).

## Meta-Harness learning (ledger)

Credit assignment is at the **harness/package** level, not the worker prose:

1. Log compact summaries (≤240 chars) **and** structured traces (≤4000 chars
   evidence) via `log-trace` / `record-attempt --trace-evidence`.
2. Auto-classify failures into `error_class` (empty_report, step_limit, …).
3. Upsert `patterns` so `similar` / `lessons` inject prior failures into briefs.
4. `diagnose` maps free text → error_class + fix hint before the next Fix brief.
5. `reap-stale` closes packages/runs stuck in `running` past STALE_PACKAGE_HOURS.

Do **not** over-compress diagnostic signal into a score alone. Prefer raw probe
commands, exit codes, and short stderr tails over LLM summaries of failures.

## Access tiers (skills / MCP)

Authoritative detail: [references/access-tiers.md](references/access-tiers.md).

| Role | Skills | MCP |
|------|--------|-----|
| Orchestrator (`build`) | allowlist: flash-orchestrator, grilling, writing-plans, systematic-debugging, codebase-design | codebase-memory-mcp + context7; deny penpot/open-design/node_repl/openaiDeveloperDocs |
| `flash-explore` | none | optional codebase-memory graph; deny design/noise MCP + context7 |
| `flash-worker` / `flash-review` | none | none; deny web fetch/search |

Matt principles (tracer bullets, RED→GREEN, evidence-before-done, narrow human gates) are **inline** in briefs — not full skill loads.

## Note

Existing sessions require a restart after skill/config edits.
