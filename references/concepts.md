# Three orchestration concepts

Research basis: GPT-5.6 Luna worker guidance with DeepSeek V4 Flash 0731 challenge passes, OpenCode subagent model (Task + custom agents), superpowers `subagent-driven-development` + `dispatching-parallel-agents`, local OpenCode history (`/parallel`, build prompt context discipline).

## Concept A — Parallel Fan-Out

**Idea:** Decompose into independent work packages; run many Flash workers at once; orchestrator only integrates.

```
User goal
  → Orchestrator: split by path/domain
  → [flash-worker | flash-explore] × N  (parallel)
  → Orchestrator: conflict check + one integration verify
```

| | |
|--|--|
| **Maximize** | Throughput, context isolation |
| **Quality lever** | Tight scopes + non-overlapping paths |
| **When** | 2+ independent bugs, multi-area research, parallel test fixes |
| **Risk** | Merge conflicts; inconsistent patterns across workers |
| **Mitigation** | Path locks in brief; shared style notes in every brief; single integration pass |

**Default concurrency:** 2–4 workers. More only if paths are fully disjoint.

---

## Concept B — Corrected Worker Loop (DEFAULT)

**Idea:** One strong brief → Flash does almost all work → orchestrator reviews against AC → max 2 surgical fix loops.

```
User goal
  → Orchestrator: plan + AC + context pack (no bulk coding)
  → flash-worker: implement + verify
  → Orchestrator OR flash-review: score vs AC
  → if fail: surgical fix brief → flash-worker (≤2)
  → Orchestrator: final user report
```

| | |
|--|--|
| **Maximize** | Work on Flash while keeping quality bar on main model |
| **Quality lever** | Binary AC + surgical corrections (not full rewrites) |
| **When** | Features, bugfixes, most day-to-day coding |
| **Risk** | Bad first brief → wasted loops |
| **Mitigation** | Spend orchestrator tokens on brief quality; explore first if foggy |

This is the **default mode** of `flash-orchestrator`.

---

## Concept C — Explore → Implement → Verify Pipeline

**Idea:** Stage the work so Flash never implements blind. Read-only explore first, then implement, then verify (optionally separate reviewer).

```
User goal
  → flash-explore (parallel OK): map files, APIs, risks
  → Orchestrator: synthesize plan + AC from explore reports
  → flash-worker: implement
  → flash-review or orchestrator: verify AC + spot-check diff
  → fix loop (same as B, ≤2)
```

| | |
|--|--|
| **Maximize** | Quality on unfamiliar code; still bulk on Flash |
| **Quality lever** | Separation of discover / change / judge |
| **When** | Unknown subsystem, multi-module feature, risky areas (auth, deploy) |
| **Risk** | Extra latency (3 stages) |
| **Mitigation** | Parallel explores; skip explore if orchestrator already has map |

---

## Mode selection

| Situation | Mode |
|-----------|------|
| Clear bug/feature, known files | **B** |
| 2+ independent domains | **A** (each package still uses B internally) |
| Unfamiliar area / high blast radius | **C** then B |
| Tiny typo / one-liner | No subagent — orchestrator does it |

## Hybrid (common in practice)

1. **C** for discovery (1–3 flash-explore)
2. **A** for independent implementation packages
3. Each package runs **B** correction loops
4. Orchestrator one integration verify
