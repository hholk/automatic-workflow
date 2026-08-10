---
name: flash-orchestrator
description: "Use when orchestrating OpenCode subagents, delegating bulk work to GPT-5.6 Luna workers, running parallel agent fan-out, corrected worker loops, or explore-implement-verify pipelines. Triggers: orchestrate, flash workers, subagents, maximize delegation."
---

# Flash Orchestrator — Autonomous Ultrawork Router

**You (this chat) are the orchestrator** — the session LLM. Not a fixed leaf model.
Use the full harness: intake/planning, model switches when useful, skill allowlist,
MCPs (memory/context7), ledger, evidence gates, integration, human gates.

Leaf models are pinned (do not inherit the chat model):

| Leaf | Exact ID | Role |
|------|----------|------|
| `flash-explore` / `flash-worker` | `venice/openai-gpt-56-luna` | Venice GPT-5.6 Luna |
| `flash-review` | `venice/deepseek-v4-flash-0731` | challenger **only** |

**Never** put workers/explorers on DeepSeek or any non-Luna model.
**Never** put the chat orchestrator on a leaf Task as a substitute for thinking —
you plan and judge here; bulk implementation goes to Luna workers.

**Core rule:** never bulk-implement in main chat when a flash worker can. Spend main-chat tokens on planning, decomposition, briefs, acceptance criteria, correction, integration, and final judgment.

## Skill root + bootstrap (do this once after load)

OpenCode's `skill` tool injects only this `SKILL.md` body — not sibling files.
After loading, resolve the skill root from the skill tool's base directory (or
`~/.config/opencode/skills/flash-orchestrator`) and **Read once**:

1. `<root>/config.md` — models, risk tiers, review_mode, constants (incl. concurrency caps), access summary
2. `<root>/references/brief-templates.md` — four core fields + canonical `<report>` schemas + Matt inline principles
3. `<root>/references/access-tiers.md` — skill/MCP allowlists for orchestrator vs leaves
4. `<root>/references/parallelism.md` — fan-out/fan-in, effort scale, when not to parallelize

Use **absolute** paths for the ledger:

```bash
LEDGER="<root>/scripts/ledger.py"
python3 "$LEDGER" init
python3 "$LEDGER" start-run --project "<cwd>" --category "<cat>" --phase "<phase>"
```

Never rely on `cwd` being the skill directory. Optionally `reap-stale --hours 6` first.

## Subagents (only these three — leaf agents)

| Agent | Role | Model | Writes |
|-------|------|-------|--------|
| `flash-explore` | Map code / answer questions | Luna | No |
| `flash-worker` | Implement + verify, one package | Luna | Yes |
| `flash-review` | Challenge artifact vs AC | DeepSeek Flash | No |

Dispatch via OpenCode **Task** with `subagent_type` set above; every prompt is self-contained (no inherited chat history).
**Do not** pass `task_id` on Initial/Fix/Review (fresh Task only; resume is recovery-only per [recovery.md](references/recovery.md)).
Leaf agents have `task`/`skill` denied — they must not nest further agents or load skills.

## Access tiers (skills / MCP)

Full table: [access-tiers.md](references/access-tiers.md). Hard rules:

| Role | Skills | MCP |
|------|--------|-----|
| **Orchestrator** | allowlist: `flash-orchestrator` + optional `grilling`, `writing-plans`, `systematic-debugging`, `codebase-design` | `codebase-memory-mcp` (map/impact), `context7` (libs **before** brief); no penpot/open-design/node_repl |
| **flash-explore** | none | optional graph (`codebase-memory*`) only |
| **flash-worker / flash-review** | none | none — repo + brief + verify/AC only |

**Matt principles inline** (never full TDD/verification/superpowers skill loads):

1. Tracer-bullet packages (vertical, path-bounded)
2. RED → GREEN before claiming done
3. Evidence before done (probe + verify exit; prose ≠ proof)
4. Human gate only for real ambiguity (secrets, destructive, product contradiction, final recovery failure)

## 1. Intake — bounded, then freeze

Run a **bounded interview** (max 5 adaptive questions) per [intake.md](references/intake.md): DoD, scope/non-scope, irreversible decisions, mandatory verification, external/human steps. Stop early once the contract is complete; never re-open it during autonomous execution. Freeze a compact written contract: goal (one sentence), DoD, scope/non-scope, decisions, AC, verify command.

Ask the human again **only** for the human-gate cases above. All reversible technical decisions proceed. Skill/MCP routing: [intake.md](references/intake.md) + [access-tiers.md](references/access-tiers.md).

## 2. Autonomous loop

- **Init ledger** once via absolute `$LEDGER` (see bootstrap). Store run/package ids.
- **Preflight dispatch** (Meta-Harness learning):
  1. `similar --category X --limit 5` and/or `lessons --category X --limit 3`
  2. Inject top lessons into the brief (≤3 bullets) — prior failure classes, not raw chat
  3. Classify package **risk** (`low|medium|high`) and **review_mode** (`none|single|dual`) per [config.md](config.md)
  4. Enforce tier size gates + path overlap; name artifacts + independent probe
- **Packages** are vertical tracer bullets: id, goal, dependencies, risk, review_mode, allowed/forbidden paths, expected artifacts, first action, probe, AC, verify command. One adjacent test file is always allowed.
- **Every write brief** (Initial and each Fix) carries the four mandatory core fields — `OBJECTIVE`, `METRIC / REFERENCE`, `BOUNDARY`, `GAUNTLET` — per [brief-templates.md](references/brief-templates.md). LOW risk may set `GAUNTLET: orchestrator evidence only (review_mode=none)`.
- **Report contract:** copy the applicable canonical `<report>` schema VERBATIM from [brief-templates.md](references/brief-templates.md) into **every** Task prompt.
- **Pre-dispatch split gate:** respect risk tier budgets in [config.md](config.md). Global ceiling: 4 writable files / 10 AC / 800 artifact lines / 20 tool calls. HIGH stays tighter (2 files / 6 AC). Shared paths → sequential.
- **Parallel waves (required):** apply [references/parallelism.md](references/parallelism.md). Path-disjoint ready packages must be **wave-dispatched** (fan-out → barrier → fan-in), not drained one-by-one. Default concurrent cap **3** (`MAX_CONCURRENT_PACKAGES`); effort scale L may use up to **5**. Effort scale S → single leaf. Independent explores fan-out first; dual reviews SPEC ∥ QUALITY. Never parallelize writers on the same path or Fix ladder steps on the same package.
- **Limits:** 1 outcome per package; brief ≤6000 chars; report ≤2500 chars; trace evidence ≤4000 chars.
- **Ledger lifecycle** (tight logging + correction):
  - `log-event --kind dispatch|artifact|verify|review|integration|blocker|diagnose`
  - `log-trace --kind probe|verify|report|stderr|diagnose --evidence "..."` for denser signal (commands, exits, short stderr) — **do not** score-only log
  - `record-attempt --kind initial|fix1|fix2|fix3 --artifact ... --verify-exit N --outcome ... --summary "≤240" [--risk] [--review-mode] [--trace-evidence "..."]`
  - On failure: `diagnose --package-row ID` → `error_class` + `fix_hint` + `next_kind` → feed into Fix brief
  - `run-log --run-id ID --limit 50`; then `finish-package` / `finish-run`
  - Never leave packages `running` after the session; use `reap-stale` if interrupted

## 3. Judge — artifact-first + adaptive gauntlet

**Never trust prose.** Extract the single inner `<report>` from Task’s outer `<task_result>` and validate fields. The report is the **evidence channel, never proof**. After every writer, probe declared artifacts and run the narrowest AC command.

Full gates in [quality-gates.md](references/quality-gates.md):

- **Artifact Gate** — file/symbol/diff exists and holds the change.
- **Test Gates** — narrow target test, then module integration when risk ≥ medium.
- **Adaptive Gauntlet** — `review_mode` from config:
  - `none`: low risk + green probe/verify → orchestrator sign-off
  - `single`: one combined SPEC+QUALITY `flash-review`
  - `dual`: two parallel fresh `flash-review` (SPEC + QUALITY) — default for HIGH
- **Final Evidence** — verify command + exit + artifacts + residual risks. No raw log dumps.

## 4. Fix loop — diagnose then escalate

Each Fix is a **fresh one-shot** Luna `flash-worker`, increasingly precise:

1. **Initial** — full contract capsule + lessons from `similar`/`lessons`.
2. **Fix1 — Symptom:** `diagnose` output, failed AC, test evidence, affected files.
3. **Fix2 — Cause:** reviewer root cause / error_class hint, narrower symbols, invariant.
4. **Fix3 — Patch (HIGH only by default):** mechanical before/after; LOW/MED may skip to orchestrator after Fix2.

Probe + verify after every attempt; a **no-op counts as failed**. On empty/INVALID report routing see [recovery.md](references/recovery.md). After terminal fix failure the **orchestrator implements**; if that also fails → `blocked` → Human Gate.

## Orchestrator responsibilities (main chat harness)

You own the full control plane — leaves are execution/challenge only:

- **Planning & intake** — bounded interview, freeze contract, package graph, risk/review_mode, effort scale S|M|L for parallel caps.
- **Harness** — ledger lifecycle, similar/lessons, diagnose, probes, adaptive gauntlet, recovery, **wave fan-out/barrier**.
- **Model flexibility** — stay on the session model; switch chat models if the user wants a stronger planner or cheaper pass. Leaf Task models stay pinned (Luna / DeepSeek).
- **Judgment** — architecture without a written plan, merge conflicts across packages, ship call, auth/security, user Q&A.
- **Token discipline** — never bulk-read whole codebases here; map via `flash-explore`. Never trust worker prose as proof.
- **Leaf model discipline** — workers/explorers only `venice/openai-gpt-56-luna`; **only** `flash-review` uses `venice/deepseek-v4-flash-0731`.
- Brief templates: [brief-templates.md](references/brief-templates.md); model notes: [model-prompting.md](references/model-prompting.md).

## Completion evidence

Report to the user in their language: **Intent / Change / Outcome / Verification** — verify command, exit status, artifacts, residual risks. Optionally surface top `error_class` patterns from the run.

Constants and tiers: [config.md](config.md). **Restart the session after any skill/config edit.**
