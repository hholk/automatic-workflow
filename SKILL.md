---
name: aw
description: "Ultrawork router: the chat orchestrates, GPT-5.6 Luna workers burn tokens in gauntlet loops. Use when orchestrating subagents, delegating bulk work, running parallel fan-out, corrected worker loops, or explore-implement-verify pipelines. Triggers: orchestrate, ultrawork, flash workers, subagents, maximize delegation."
---

# AW — Planner-Routed Ultrawork via Gauntlet Loops

You (main chat, any session model) are the orchestrator = **intelligence**:
intake, plan, brief, judge, integrate. Leaf agents = **token burn**: they do
the bulk work in their own context windows.

| Leaf | Model (pinned in its agent file) | Role |
|------|----------------------------------|------|
| `flash-plan` | GPT-5.6 Luna | read-only route / package planner |
| `flash-explore` | GPT-5.6 Luna | read-only map / verified facts |
| `flash-worker` | GPT-5.6 Luna | implement + self-gauntlet |
| `flash-review` | DeepSeek V4 Flash | fresh-context challenger |
| `flash-guru-debug` | GPT-5.6 Sol | root-cause / failure-resolution expert |
| `flash-guru-architecture` | Qwen 3.8 Max | architecture / seam / trade-off expert |
| `flash-guru-decision` | GPT-5.6 Sol | bounded arbiter for conflicting expert reports |

Model pinning, step caps, and permissions are enforced **natively** by
`~/.config/opencode/agents/flash-*.md` — never restate them in briefs.
The canonical `<report>` schemas live in those agent files too; append a
`REPORT CONTRACT` to a Task prompt only when you must deviate.

## Core: the gauntlet loop, two layers

**Planner-first invariant.** Every non-trivial task and every subsequent phase
must pass through `flash-plan` before execution. The planner is read-only and
proposes; the main orchestrator approves, narrows, rejects, or re-plans. No
explorer, worker, reviewer, fix, or integration dispatch starts without an
approved plan for that phase. Trivial `direct` work may skip leaf dispatch, but
the orchestrator still records the route and verification command.

## Workflow router

Select the smallest workflow that can satisfy the objective:

| Workflow | Use when | Default execution |
|---|---|---|
| `direct` | exact local change, low risk, known verification | main orchestrator only |
| `explore-first` | repository path, symbols, or impact are unknown | planner → explore → re-plan → worker |
| `sequential-chain` | fixed steps have dependencies | planner → package 1 → re-plan → package 2 |
| `parallel-sectioning` | packages are independent and write paths are disjoint | planner → parallel workers → integration |
| `orchestrator-workers` | subtasks are input-dependent and emerge during analysis | planner → orchestrator-owned packages |
| `evaluator-optimizer` | quality, security, or correctness needs independent critique | worker → planner review plan → review → fix |
| `long-running-incremental` | work spans sessions or context windows | initializer plan → one package/session → state handoff |

Never parallelize overlapping write paths or dependent packages. Use
`sectioning` for independent work and `voting` only for independent reviews of
the same artifact. More agents are not automatically better.

## Guru escalation router

Guru agents are expensive read-only **coach tools**, not default workers and
not implementation handoffs. The cheap worker always gets the first solution
attempt. A Guru may be called only after that first worker attempt has failed
an actual probe, verification command, or acceptance criterion:

```text
Context7 / codebase-memory
  → targeted inspection / reproduction
  → cheap worker: FIRST ATTEMPT
  → real failure evidence
  → Guru: diagnose / decide / coach
  → planner re-entry
  → cheap worker: GUIDED RETRY
  → verification
```

The first failed attempt is the minimum gate without exceptions for ordinary
implementation work. An MCP evidence gap or architectural uncertainty alone
does not justify a Guru before the cheap worker tries a bounded solution. A
second Guru call requires new failure evidence and a changed question.

### Guru webflows

**Debug / root-cause:** use `flash-guru-debug` only after the first worker
attempt fails. Supply a compressed packet containing `FIRST_ATTEMPT`, `FAILURE`,
`REPRO`, `CHANGED_PATHS`, `MCP_EXHAUSTED`, named `SCOPE`, and one `QUESTION`.
The Guru returns facts, discarded hypotheses, one minimal fix direction, and a
`NEXT_WORKER_BRIEF`. It never edits and never claims completion.

**Architecture / design:** use `flash-guru-architecture` only after the first
worker attempt demonstrates that the planned seam or ownership model blocks
the implementation.
Supply constraints, relevant symbols, existing patterns, the attempted change,
and at most three options. The Guru returns one recommendation, ownership,
invariants, implementation boundary, verification probe, and a
`NEXT_WORKER_BRIEF`. Its result goes back to `flash-plan` before writing.

**Decision / arbitration:** use `flash-guru-decision` only after a failed first
attempt and materially conflicting debug/architecture reports. It chooses one
reversible action only when evidence supports it and emits a worker brief;
otherwise it returns `INCONCLUSIVE` with the missing discriminator. It never
manufactures consensus or replaces a human gate for irreversible actions.

### Guru token discipline

- One Guru call per blocker phase by default; a second requires new evidence.
- `FIRST_ATTEMPT_STATUS` must be `FAILED` and include a non-zero exit code,
  failed AC, or reproducible incorrect behavior before Guru dispatch.
- One question, root cause, or decision per call.
- Pass summaries, paths, symbols, commands, exit codes, and decisive stderr;
  never full files, full logs, or the entire conversation.
- Ask for evidence → hypotheses/options → one recommendation, not a broad
  review or future-improvement catalogue.
- Keep Guru input ≤6000 characters where possible and require a short report.
- A Guru report is advice, never proof. Verify its discriminator and require a
  fresh planner route before implementation. The only valid downstream action
  is a cheap-worker retry using the Guru's bounded brief.

## Planner contract

Dispatch `flash-plan` with a brief containing `OBJECTIVE`, `NON-GOALS`,
`CURRENT STATE`, `RISK`, and any known `ACCEPTANCE CRITERIA`. Require its
report to define:

```text
ROUTE: workflow / reason / ownership / parallelism / max_workers / review_required
PACKAGES: id / objective / dependencies / read_paths / write_paths / non_goals
ACCEPTANCE: binary criteria per package
VERIFICATION: exact commands and integration checks
CONTROL: stop conditions / abort conditions / assumptions / risks
```

The orchestrator must reject plans with missing paths, overlapping same-wave
writes, vague verification, more than four packages, or unsupported assumptions.
After a red result, scope leak, or changed dependency, dispatch a new planner
with the failure evidence; do not blindly repeat the old route.

**Inner gauntlet — inside every leaf.** Each leaf runs the same loop:
act → run the check (real command / probe / AC) → read the actual output →
fix → repeat until green or budget exhausted. Before DONE a worker lints and
formats the files it touched — leaf files only, never crate/module roots whose
fmt check would sweep foreign files — and reads `grep -c` exit 1 at count 0 as
success. Leaves report **evidence** (commands + integer exit codes), never
prose claims. DONE without green evidence is invalid.

**Outer gauntlet — here.** A report is an evidence channel, never proof.
After every worker:
1. Probe the declared artifacts (file/symbol exists; diff holds the change,
   stays inside allowed paths, and tests add no duplicated state).
2. Run the narrowest AC command yourself.
3. Risk ≥ medium, high blast radius, or any red signal → dispatch
   `flash-review`: a fresh context refutes the work — the builder never
   grades itself.
After every planner: probe that cited commands and symbols actually exist
(one `rg` each) — invented references are red.
Only a green outer gauntlet closes a package.

## Loop

1. **Plan intake** — dispatch `flash-plan` first. If the goal is unclear, big,
   or irreversible, run `grilling` before planning. Freeze the contract:
   goal, DoD, scope/non-scope, binary AC, and verify command. Never reopen it
   mid-run except at human gates.
2. **Plan decomposition** — use the approved planner packages as vertical
   tracer bullets: ≤4 writable files, ≤10 AC, path-disjoint; shared paths →
   sequential. Plan/design packages name exactly one artifact and one
   subsystem. A package that returned an empty report or hit a step limit is
   halved on re-plan, never retried at the same size. Unknown terrain may
   produce an `explore-first` route, but the explorer itself also receives a
   planner-approved boundary. Track packages with `todowrite`.
3. **Dispatch** — default is **bounded headless dispatch** (robust, visible,
   always returns): write the brief to `/tmp/brief-<pkg>.md`, then run
   `timeout <sec> opencode run --agent <leaf> "$(cat /tmp/brief-<pkg>.md)"`.
   First dispatch `flash-plan` for the phase; then dispatch only the approved
   leaf. Timeouts: plan 180s, explore 180s, worker 420s, review 240s; large
   packages 600s.
   Parallel waves = multiple such bash calls in one block (≤3 concurrent;
   ≤5 for large breadth runs; effort S → single leaf). Every dispatch is
   fresh (never resume for Initial/Fix/Review). The in-session Task tool is
   **opt-in only** (when the user wants to watch child sessions) — it can
   hang invisibly and then needs a manual cancel.
   Briefs carry: OBJECTIVE / NON-GOALS / PLANNER ROUTE / PACKAGE ID /
   METRIC-REFERENCE / BOUNDARY (allowed paths) / GAUNTLET (verify command + AC
   list) / FIRST ACTION / STOP CONDITION / CONTEXT CAPSULE (probe-verified
   symbols only, invariants, project rules) / ≤3 lesson bullets if any.
4. **Judge** — outer gauntlet per package (above). Before a reviewer dispatch,
   plan the review scope and probes with `flash-plan`.
5. **Fix** — red → classify the attempt with exactly one failure class —
   `scope_overload` (empty report / step limit) · `wrong_assumption` (invented
   or unverified API) · `quality_nit` (verify green, review red) · `test_fail`
   · `transient` (provider/infra) — then dispatch `flash-plan` with the class,
   failed ACs, exit codes, and short stderr; approve one surgical fix brief for
   the cheap worker. This is the mandatory first attempt. The class shapes the
   route: `scope_overload` halves the package, `wrong_assumption` adds probe
   evidence first, `transient` retries unchanged. If the first attempt fails,
   dispatch the appropriate Guru with the failure packet, then `flash-plan`
   again, then the cheap worker with `NEXT_WORKER_BRIEF`. The Guru never
   implements. Two consecutive attempts with the same failure signature end the
   retry path — halve the scope, change the approach, or take the human gate;
   never a third identical attempt. Still red after the guided retry →
   independent review, a new bounded failure cycle, or human gate according to
   risk; never silently promote the Guru into a worker.
6. **Integrate & report** — dispatch `flash-plan` for integration scope, then
   run one integration verify across packages; final
   report in the user's language: Intent / Change / Outcome / Verification
   (verify command, exit status, artifacts, residual risks).

## Visibility & forward progress (always)

- Announce every wave **before** dispatch in one short line (package, agent,
  expected duration) and update `todowrite` per package — the user must see
  a sign of life before and after every long tool call.
- Every dispatch returns (timeout at worst). On timeout, non-zero exit, or an
  empty/missing report (all count as failed attempts): retry once with a
  sharpened brief; on second failure the orchestrator implements the package
  in main chat. The process never stalls waiting on a leaf.
- After each return: one line with the report verdict before continuing.
- Planner reports are proposals, not proof. Probe the declared package graph,
  path boundaries, artifacts, and verification results yourself.
- Every Guru report must be followed by planner re-entry; never hand Guru prose
  directly to a worker as an implementation brief. The planner converts the
  Guru's `NEXT_WORKER_BRIEF` into the approved worker contract.

## Safety rules

- Leaves write only inside allowed paths (+ one adjacent test file); agent
  files deny commit/push/rm/publish and nesting (`task`/`skill` denied).
- `flash-plan` and `flash-explore` are read-only. Workers never widen their
  write paths without a fresh planner report and orchestrator approval.
- All Guru agents are strictly read-only: edit, write-capable Bash, Context7,
  codebase-memory MCP, and nested agents are denied. They inspect through the
  native read/search surface only; the orchestrator supplies exhausted MCP
  evidence.
- Human gate **only** for: secrets, destructive/irreversible actions,
  product contradictions, terminal failure after orchestrator takeover.
- Context discipline here: no bulk reads in main chat — delegate to
  `flash-explore`; summarize, never paste.
- Limits: brief ≤6000 chars, report ≤2500 chars, one outcome per package.

## State, long-running work, and routing evaluation

For work spanning sessions, keep a small machine-readable state handoff with
the approved route, package status, last verification command and exit code,
open risks, and next action. Acceptance criteria and tests are immutable;
workers may update status and evidence only. Start each session with a baseline
smoke test, then implement one package and leave a clean handoff. Checkpoint
every ~90 minutes or 3 packages, whichever comes first: write the handoff and
stop cleanly; never plan more packages than fit the remaining session budget.
On resume, mark stale `running` runs and packages failed before starting new
work.

For recurring workflows, evaluate the route as well as the code: route fit,
unnecessary delegation, write-boundary conflicts, handoff completeness, tool
choice, premature DONE, and recovery after failure. Capture only noteworthy
routing failures in `LESSONS.md`.

Track Guru-specific metrics: escalation precision, token cost per resolved
blocker, evidence-packet compression, repeat escalations, and whether the
post-Guru plan is narrower than the failed plan.

## Meta-loop — this skill optimizes itself over time

**Capture (event-driven, near-zero overhead).** After a run, append to
`<root>/LESSONS.md` **only if something noteworthy happened**: a fix pass
was needed, a report came back invalid, a brief misled the worker, a probe
failed unexpectedly, a safety near-miss, or a trick that worked exceptionally
well. One line: `- YYYY-MM-DD: what → cause → hint (which file to change)`.
Routine runs log nothing.

**Optimize (on demand).** When the user asks to optimize this skill — or
after a pattern of similar lessons — load `writing-great-skills`, read
LESSONS.md and, if needed, the run ledger
(`~/.local/share/opencode/ultrawork/ledger.sqlite`) and recent sessions in
`~/.local/share/opencode/opencode.db`; propose small, concrete edits to
SKILL.md / the agent files (prune no-ops, fold lessons into rules, sharpen
gauntlet checks, tune step caps); apply **only after user approval**; then
delete consumed lessons.

**Rollback.** This skill folder is a git repo: every optimization is a
commit. The next real run is the test; if behavior regresses, revert.

Restart the session after any skill or agent-file edit.
