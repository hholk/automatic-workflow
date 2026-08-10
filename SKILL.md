---
name: flash-orchestrator
description: "Ultrawork router: the chat orchestrates, GPT-5.6 Luna workers burn tokens in gauntlet loops. Use when orchestrating subagents, delegating bulk work, running parallel fan-out, corrected worker loops, or explore-implement-verify pipelines. Triggers: orchestrate, ultrawork, flash workers, subagents, maximize delegation."
---

# Flash Orchestrator — Ultrawork via Gauntlet Loops

You (main chat, any session model) are the orchestrator = **intelligence**:
intake, plan, brief, judge, integrate. Leaf agents = **token burn**: they do
the bulk work in their own context windows.

| Leaf | Model (pinned in its agent file) | Role |
|------|----------------------------------|------|
| `flash-explore` | GPT-5.6 Luna | read-only map / verified facts |
| `flash-worker` | GPT-5.6 Luna | implement + self-gauntlet |
| `flash-review` | DeepSeek V4 Flash | fresh-context challenger |

Model pinning, step caps, and permissions are enforced **natively** by
`~/.config/opencode/agents/flash-*.md` — never restate them in briefs.
The canonical `<report>` schemas live in those agent files too; append a
`REPORT CONTRACT` to a Task prompt only when you must deviate.

## Core: the gauntlet loop, two layers

**Inner gauntlet — inside every leaf.** Each leaf runs the same loop:
act → run the check (real command / probe / AC) → read the actual output →
fix → repeat until green or budget exhausted. Leaves report **evidence**
(commands + integer exit codes), never prose claims. DONE without green
evidence is invalid.

**Outer gauntlet — here.** A report is an evidence channel, never proof.
After every worker:
1. Probe the declared artifacts (file/symbol exists; diff holds the change).
2. Run the narrowest AC command yourself.
3. Risk ≥ medium, high blast radius, or any red signal → dispatch
   `flash-review`: a fresh context refutes the work — the builder never
   grades itself.
Only a green outer gauntlet closes a package.

## Loop

1. **Intake** — goal unclear, big, or irreversible decisions: run `grilling`
   (bounded interview). Freeze the contract: goal, DoD, scope/non-scope,
   binary AC, verify command. Never re-open mid-run except at human gates.
2. **Decompose** — vertical tracer-bullet packages: ≤4 writable files,
   ≤10 AC, path-disjoint; shared paths → sequential. Unknown terrain →
   parallel `flash-explore` first. Track packages with `todowrite`.
3. **Dispatch** — default is **bounded headless dispatch** (robust, visible,
   always returns): write the brief to `/tmp/brief-<pkg>.md`, then run
   `timeout <sec> opencode run --agent <leaf> "$(cat /tmp/brief-<pkg>.md)"`
   (timeouts: explore 180s, worker 420s, review 240s; large packages 600s).
   Parallel waves = multiple such bash calls in one block (≤3 concurrent;
   ≤5 for large breadth runs; effort S → single leaf). Every dispatch is
   fresh (never resume for Initial/Fix/Review). The in-session Task tool is
   **opt-in only** (when the user wants to watch child sessions) — it can
   hang invisibly and then needs a manual cancel.
   Briefs carry: OBJECTIVE / METRIC-REFERENCE / BOUNDARY (allowed paths) /
   GAUNTLET (verify command + AC list) / FIRST ACTION / CONTEXT CAPSULE
   (symbols, invariants, project rules) / ≤3 lesson bullets if any.
4. **Judge** — outer gauntlet per package (above).
5. **Fix** — red → one surgical fix brief with the failure evidence
   (failed AC + exit codes + short stderr), max 2 per package. Still red →
   orchestrator implements in main chat. Still red → human gate.
6. **Integrate & report** — one integration verify across packages; final
   report in the user's language: Intent / Change / Outcome / Verification
   (verify command, exit status, artifacts, residual risks).

## Visibility & forward progress (always)

- Announce every wave **before** dispatch in one short line (package, agent,
  expected duration) and update `todowrite` per package — the user must see
  a sign of life before and after every long tool call.
- Every dispatch returns (timeout at worst). On timeout or non-zero exit:
  retry once with a sharpened brief; on second failure the orchestrator
  implements the package in main chat. The process never stalls waiting on
  a leaf.
- After each return: one line with the report verdict before continuing.

## Safety rules

- Leaves write only inside allowed paths (+ one adjacent test file); agent
  files deny commit/push/rm/publish and nesting (`task`/`skill` denied).
- Human gate **only** for: secrets, destructive/irreversible actions,
  product contradictions, terminal failure after orchestrator takeover.
- Context discipline here: no bulk reads in main chat — delegate to
  `flash-explore`; summarize, never paste.
- Limits: brief ≤6000 chars, report ≤2500 chars, one outcome per package.

## Meta-loop — this skill optimizes itself over time

**Capture (event-driven, near-zero overhead).** After a run, append to
`<root>/LESSONS.md` **only if something noteworthy happened**: a fix pass
was needed, a report came back invalid, a brief misled the worker, a probe
failed unexpectedly, a safety near-miss, or a trick that worked exceptionally
well. One line: `- YYYY-MM-DD: what → cause → hint (which file to change)`.
Routine runs log nothing.

**Optimize (on demand).** When the user asks to optimize this skill — or
after a pattern of similar lessons — load `writing-great-skills`, read
LESSONS.md and, if needed, recent sessions under
`~/.local/share/opencode/storage/session/`; propose small, concrete edits to
SKILL.md / the agent files (prune no-ops, fold lessons into rules, sharpen
gauntlet checks, tune step caps); apply **only after user approval**; then
delete consumed lessons.

**Rollback.** This skill folder is a git repo: every optimization is a
commit. The next real run is the test; if behavior regresses, revert.

Restart the session after any skill or agent-file edit.
