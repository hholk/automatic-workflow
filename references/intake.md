# Intake — bounded initial interview

Contract the work before any dispatch. Keep main-chat tokens for decisions, review, integration — not discovery.

## Adaptive questions (max 5, stop early)

Ask at most five questions, in order, and **stop as soon as the contract is complete**. Do not ask what is already known.

1. **DoD** — What must be observable/provable for this to count as done?
2. **Scope / Non-scope** — What is in, and what is explicitly out?
3. **Irreversible** — Any irreversible product/architecture decisions?
4. **Mandatory verification** — Which tests/lint/build must pass, and how is it run?
5. **External / human** — Any external access (credentials, services) or human-only steps?

Skip any question whose answer is already fixed by the request or AGENTS.md.

## Freeze the contract

Once every applicable point is pinned, **freeze a compact written contract**: goal (one sentence), DoD, scope/non-scope, decisions, AC, verify command. Do not keep re-opening intake during autonomous execution.

## Human gates (only these)

Ask the human again only for:
- **credentials / secrets**
- **destructive actions** (deletes, force-push, prod/irreversible infra)
- **genuine product ambiguity**
- **contradictory Definition of Done**
- **final autonomous recovery failure** (after Fix 3 + orchestrator implement + integration fails)

All reversible technical standard decisions proceed without approval. When a genuine product/domain question surfaces mid-run (not at intake), store it as `needs_human` in the ledger and report it with concrete options as a Human Gate.

## Adaptive persistence

- **S / M tasks:** keep the contract in memory; no issue tracker, `CONTEXT.md`, or ADR required.
- **L / multisession tasks:** persist a written **PLAN**; use an issue tracker, `CONTEXT.md`, or ADRs **only** when domain or decision complexity demands it. Never create these artifacts for clear S/M work.

## Skill-invocation routing (tiered)

See also [access-tiers.md](access-tiers.md). Orchestrator skill allowlist is enforced in config; do not attempt denied skills.

**Interactive (pre-contract only)** — never inside the autonomous loop:
- `grilling` → unclear requirements (intake question 1/2 unresolved)
- `writing-plans` → L / multi-session only, before dispatch
- `codebase-design` → blocking module/interface language (not for S renames)

**Autonomous loop** — after frozen contract:
- **Only** `flash-orchestrator` behavior + leaf Tasks
- Apply Matt principles **inline** in every write brief (tracer bullets, RED→GREEN, evidence-before-done)
- **Do not** `skill`-load `test-driven-development`, `tdd`, `verification-before-completion`, `using-superpowers`, `subagent-driven-development`, or `dispatching-parallel-agents`
- `systematic-debugging` → only after Fix1 failure or hard-to-localize root cause
- **MCPs:** `codebase-memory-mcp` for map/impact; `context7` for external libs **before** the brief; never penpot/open-design/node_repl here

**Leaves never load skills.** Explore may use graph MCP; worker/review use repo + brief + verify only.

Do **not** auto-start `to-issues` or code-review skills; reuse principles only (tracer-bullet graph, flash-review gauntlet).

## Contract quality bar

If a junior worker could not execute without asking questions, the contract is not ready. Fix the contract; do not hope the worker invents context.
