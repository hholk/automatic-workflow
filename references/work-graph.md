# Autonomous work-graph

The post-intake execution graph. Orchestrator decomposes, dispatches, judges, integrates; workers only ever run one self-contained package.

## Vertical tracer-bullet packages

Each package is a **vertical tracer bullet**: one observable outcome end to end. A package carries:

- **id** (unique, ordered)
- **goal** (one outcome)
- **risk** (`low` | `medium` | `high`) — sizing + gauntlet
- **review_mode** (`none` | `single` | `dual`) — set at preflight; may upgrade after failed evidence
- **dependencies** (package ids → ready only when all are done)
- **allowed / forbidden paths**
- **expected artifacts**, **first action**, **artifact probe**, **AC**, **verify command**

**Ready queue** = packages whose dependencies are all `done`. **Path locks** = claimed writable paths per running package; a package may not start while its paths are held by another.

## Package sizing (tiered)

See [config.md](../config.md) for the full table. Summary:

| Risk | Max files | Max AC | Lines | Tools | Review |
|------|-----------|--------|-------|-------|--------|
| low | 2 | 6 | 500 | 20 | none if green else single |
| medium | 4 | 10 | 800 | 25 | single |
| high | 2 | 6 | 400 | 15 | dual |

- **One adjacent test file** does not count against the primary file budget.
- Shared-file packages run **sequential**; path-disjoint packages may run **parallel**.
- Prefer **batching** 2–3 related files into one medium package over many micro-packages each with dual review.

## Context Capsule (exact fields, one capsule per worker)

Every worker gets only this short packed brief:

- **Goal** — the outcome (one sentence)
- **Lessons** — ≤3 bullets from `ledger.py lessons` / `similar` (optional but preferred)
- **Allowed paths** — writable scope (+ one adjacent test path if needed)
- **Relevant symbols** — names/types to use
- **Expected artifacts** — files/symbols that must exist afterward
- **First action** — inspect the named pattern or create the named file
- **Probe** — small grep/glob/command the orchestrator reruns independently
- **AC** — binary acceptance criteria
- **Verify command** — exact command + exitcode expectation

No chat history, no raw logs, no large file contents in the capsule.

## Size gates (enforced at dispatch/review)

- **Complete worker brief ≤ 6000 chars.** Longer → block dispatch → force **split** or move detail to a **reference file**.
- **Worker report ≤ 2500 chars.** Logs stay in files/traces; the report names only path, command, exitcode, and a short failure cause.
- **Tier budgets** from config; global ceiling 4 files / 10 AC / 800 lines / 20 tools.
- Reserve the final 3 agent steps for verification and the report.

## Preflight (before every dispatch)

1. **Ledger learn** — `similar` + `lessons` for category; inject top patterns into brief.
2. **Risk + review_mode** — classify; store on `start-package --risk --review-mode`.
3. **Size gate** — brief chars, file count, AC count within tier.
4. **Overlap gate** — writable paths path-disjoint from every running package.
5. **Artifacts + probe** — named; empty/intro-only results judged by probe, never prose.
6. **Dispatch** — one self-contained Task prompt on the **correct model** (Luna worker/explore; DeepSeek review only).

## Parallelism

Authoritative policy: [parallelism.md](parallelism.md) (Anthropic + OpenAI first-party concepts).

### Hard rules

- **Parallel writes only when path-disjoint** from every running package (path locks).
- **Explores always parallelize** (read-only); batch by effort scale.
- **Reviews:** `dual` → SPEC ∥ QUALITY in parallel; `single` → one Task.
- **Fixes** on one `package_row` are always sequential (Initial → Fix1 → Fix2 → Fix3).
- **Default concurrent cap:** `MAX_CONCURRENT_PACKAGES=3`; breadth waves may use up to `MAX_CONCURRENT_PACKAGES_BREADTH=5` only at effort scale L.

### Wave dispatch (fan-out → fan-in)

Do **not** serially drain a path-disjoint ready queue one Task at a time.

```text
1. Classify effort scale S|M|L (parallelism.md)
2. ready = deps done ∧ paths free
3. wave = up to concurrent cap from ready (explores first, then writes)
4. Fan-out: dispatch entire wave in one orchestrator turn
5. Barrier: wait for all wave reports
6. Fan-in: probe + verify + review each; integrate only after barrier
7. Recompute ready; next wave
```

### When sequential wins

Ordered dependency chain, shared writable paths, shared mutable state, or scale S
(single package). See OpenAI multi-agent “prefer one agent” table + Anthropic
shared-context limits in [parallelism.md](parallelism.md).

## Package state machine

`pending → ready → running → review → fix1 → fix2 → [fix3] → integrating → done` (terminal: **blocked**).

- `pending` waiting on dependencies → `ready` when all deps done.
- `running` → evidence probe/verify → optional review per `review_mode`.
- Review/evidence fail → **fix1 → fix2 → (fix3 if high)** via `diagnose`.
- Pass → `integrating` → `done`.
- `blocked` = human gate after orchestrator post-fix integration fail or irreversible blocker.

## Fix loop (diagnose-driven)

1. **Fix 1 — Symptom:** `diagnose --package-row` + failed AC + stderr tail from `log-trace`.
2. **Fix 2 — Cause:** root cause / error_class fix_hint + narrower symbols.
3. **Fix 3 — Patch (high):** mechanical before/after only.

After each pass the orchestrator independently checks artifacts + tests. A **no-op counts as a failed pass**. After terminal fixes the orchestrator implements itself; if integration also fails → `blocked`.

## Orchestrator main-chat discipline

- Main chat reports **only gates, blockers, completion** — never raw logs.
- Every package `done` only after artifact probe + independently run AC command (and required reviews).
- Ledger updated immediately after each attempt; traces for any non-trivial failure evidence.
