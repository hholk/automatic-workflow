# Planner-Routed Ultrawork Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `aw` route every non-trivial phase through a dedicated read-only planner while preserving bounded worker execution and independent verification.

**Architecture:** Add a `flash-plan` leaf that emits a compact route/package plan. The main orchestrator owns decisions and acceptance; planning is required before intake freeze, package dispatch, fixes, reviews, and integration. Existing explore/worker/review agents remain specialized execution adapters.

**Tech Stack:** OpenCode agent YAML frontmatter, Markdown skill contracts, shell-based bounded dispatch.

---

### Task 1: Add the planner agent

**Files:**
- Create: `agents/flash-plan.md`

- [ ] **Step 1: Define a read-only planner profile**

Create a `mode: all` profile so bounded `opencode run --agent flash-plan` dispatch works. Deny edits, nested tasks, skills, and external research. Allow repository inspection and external directories, matching the existing explorer safety model.

- [ ] **Step 2: Define the planner gauntlet and report contract**

Require the planner to classify the workflow, ownership, parallelism, packages, dependencies, acceptance criteria, verification commands, stop conditions, and risks. Require evidence for repository-derived claims and reject unsupported assumptions.

- [ ] **Step 3: Verify profile syntax and contract shape**

Inspect the file and parse its YAML frontmatter with the repository's available YAML tooling if present; otherwise use a targeted text check for required keys and report markers.

### Task 2: Make planning the mandatory workflow gateway

**Files:**
- Modify: `SKILL.md`

- [ ] **Step 1: Add planner role and planner-first invariant**

Document `flash-plan` as the route/package planner and state that every non-trivial task must pass through planning before any explorer, worker, reviewer, fix, or integration dispatch.

- [ ] **Step 2: Add workflow routing matrix**

Document `direct`, `explore-first`, `sequential-chain`, `parallel-sectioning`, `orchestrator-workers`, `evaluator-optimizer`, and `long-running-incremental`, including when not to delegate.

- [ ] **Step 3: Add planner dispatch contract**

Define the planner brief fields: objective, non-goals, inputs, risk, ownership, parallelism, allowed paths, expected artifacts, ACs, verification, effort budget, stop/abort conditions, and report format.

- [ ] **Step 4: Route every phase through plan → execute → verify**

Update the loop so the planner produces the initial route, then a package plan before workers, a surgical fix plan after red results, a review plan before challenger dispatch, and an integration plan before final verification. The orchestrator must judge planner output and may reject/re-plan it.

- [ ] **Step 5: Add conflict, ownership, and re-routing rules**

Require sequential execution for overlapping write paths or dependent packages, manager ownership for explore/review, and explicit re-routing after repeated failures or scope leaks.

- [ ] **Step 6: Add long-running state and observability guidance**

Describe planner-maintained state handoffs, end-state verification, route metrics, and event-driven lessons without requiring a new runtime dependency.

### Task 3: Align existing leaf contracts with planner routing

**Files:**
- Modify: `agents/flash-explore.md`
- Modify: `agents/flash-worker.md`
- Modify: `agents/flash-review.md`

- [ ] **Step 1: Add planner-input requirements to explorer**

Require an approved planner route or an explicit `explore-first` exception, and return verified symbols, dependencies, write boundary, and verification recommendation.

- [ ] **Step 2: Add planner-contract requirements to worker**

Require package ID, allowed paths, non-goals, ACs, verification command, and stop conditions. Reject missing contracts with `NEEDS_CONTEXT` rather than guessing.

- [ ] **Step 3: Add planner-contract requirements to reviewer**

Require the review plan, artifact references, AC list, and exact probes. Keep the reviewer read-only and independent of builder claims.

### Task 4: Verify the complete upgrade

**Files:**
- Inspect: all changed skill and agent files

- [ ] **Step 1: Check the diff and required references**

Confirm that `flash-plan` is referenced consistently, every phase has a planning gate, and no existing safety rule was removed.

- [ ] **Step 2: Run targeted syntax/configuration checks**

Run available OpenCode configuration validation and inspect frontmatter delimiters, required model names, permissions, and report schemas.

- [ ] **Step 3: Record outcome and residual risk**

Report that the session must restart after skill/agent edits because OpenCode caches skill content, and note that runtime route quality still requires future trace-based evaluation.
