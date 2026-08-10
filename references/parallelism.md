# Parallelism — official concepts → Ultrawork rules

Grounded in **Anthropic** and **OpenAI** primary material only. Apply these
heuristics in the orchestrator; leaves stay self-contained one-shot packages.

## Sources (primary)

| Source | Concept used here |
|--------|-------------------|
| [Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) | Orchestrator–worker; 3–5 subagents in parallel; subagents 3+ tools in parallel; scale effort to complexity; teach delegation (objective, format, tools, boundaries); avoid duplicate work; coding has fewer true parallel units than research |
| [Anthropic — Prompting best practices (subagent orchestration + parallel tools)](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) | Parallel when independent / isolated context / no shared state; sequential when dependent; maximize independent tool calls in one response; damp over-spawn on simple work |
| [OpenAI — Codex subagents](https://developers.openai.com/codex/agent-configuration/subagents) | Prefer parallel for **read-heavy** work (explore, tests, triage, summarization); careful with **write-heavy** parallel |
| [OpenAI — Multi-agent (Responses)](https://developers.openai.com/api/docs/guides/responses-multi-agent) | Root agent fans out concurrent subagents, then **synthesizes** |
| [OpenAI Agents SDK — parallel agents](https://developers.openai.com/cookbook/examples/agents_sdk/parallel_agents) | Concurrent fan-out then barrier/join; planner decides what is independent |

## Two levels of parallelism (Anthropic)

1. **Orchestrator level** — issue multiple independent `Task` dispatches in **one**
   turn (parallel tool calls). Defaults from [config.md](../config.md):
   `MAX_CONCURRENT_PACKAGES=3`, breadth soft ceiling
   `MAX_CONCURRENT_PACKAGES_BREADTH=5` (Anthropic’s 3–5 parallel subagents).
2. **Worker level** — each leaf brief tells Luna to run **independent** tools
   (reads/greps/tests) with **3+ parallel tool calls** when parameters do not
   depend on prior results (Anthropic level-2 speedup).

Do **not** serialize independent explores or path-disjoint packages “for neatness.”
Path-disjoint ready packages **must** be wave-dispatched, not drained one-by-one.

## When to parallelize (default yes)

| Work | Parallel? | Rule |
|------|-----------|------|
| Multiple **explore** questions / dirs / symbols | **Yes** | Read-only; isolated context (Anthropic + OpenAI read-heavy) |
| Multiple **path-disjoint** write packages ready | **Yes** | No shared writable paths; deps satisfied |
| **dual** gauntlet (SPEC ∥ QUALITY) | **Yes** | Two fresh `flash-review` Tasks in one turn |
| Independent **verify probes** after several writers | **Yes** | Orchestrator probes/tests that do not share mutable state |
| Same package Fix after fail | **No** | Sequential diagnose → next Fix |
| Shared paths / same module write | **No** | Sequential (path lock) |
| Package B needs artifact of A | **No** | Dependency edge |
| Tiny S task (one file, clear AC) | **No** | Single worker; damp over-spawn (Anthropic) |

## Effort scaling (Anthropic “scale effort to query complexity”)

| Shape | Concurrent leaves (max) | Pattern |
|-------|-------------------------|---------|
| **S** — one outcome, ≤2 files | **1** | Single worker (+ explore only if map missing) |
| **M** — 2–4 independent surfaces | **≤3** (`MAX_CONCURRENT_PACKAGES`) | Parallel explores and/or path-disjoint workers |
| **L** — broad map or many modules | **≤5** (`MAX_CONCURRENT_PACKAGES_BREADTH`) | Explore wave first (barrier), then write waves |

Hard ceiling: **5** concurrent leaf Tasks. Queue the rest (path locks + ready queue).
Prefer fewer, well-partitioned packages over 10 micro-spawns. Anthropic notes coding
has fewer true parallel units than research — partition carefully on writes.

## Fan-out → barrier → synthesize (both vendors)

```text
1. Plan partition (no duplicate scopes)
2. Dispatch all ready independent Tasks in ONE orchestrator turn
3. BARRIER: wait for all results in the wave
4. Synthesize: probes, AC, gauntlet, ledger — then next wave or integrate
```

Never start wave *N+1* writes that touch paths still locked by wave *N*.
Never “partial integrate” one parallel sibling before the barrier unless it is
purely additive docs with zero shared paths (still prefer full barrier).

## Delegation quality (Anthropic “teach the orchestrator how to delegate”)

Every parallel sibling brief must include, explicitly:

- **objective** (one outcome)
- **output / report contract**
- **allowed paths / tools boundary**
- **non-overlap clause** (“do not touch X; sibling owns Y”)

Without boundaries, parallel agents **duplicate** searches or edits.

## Worker brief add-on (level-2 parallel tools)

Append to write/explore briefs when the package has multiple independent reads:

```text
PARALLEL TOOLS: If multiple reads/greps/tests need no prior results, call them
in the same step (no serial waterfall). Sequential only when a parameter depends
on a previous tool result. Never invent placeholders.
```

## Anti-patterns (from the sources)

- Spawning many agents for a **straightforward** single-path edit
- Parallel **writes** on overlapping paths
- Vague parallel briefs (“research the module”) without partition
- Serializing independent explores
- Skipping the **barrier** (acting on one sibling before others return)
- Treating multi-agent as free: only when value of speed/breadth justifies cost
  (Anthropic: multi-agent burns many more tokens than chat)

## Relation to existing Ultrawork gates

Path locks, risk tiers, and adaptive gauntlet are unchanged. Parallelism only
applies to **ready**, **budget-legal**, **non-overlapping** packages. After each
wave: artifact + verify + gauntlet per package, then integration.
