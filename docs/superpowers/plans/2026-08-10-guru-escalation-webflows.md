# Guru Escalation Webflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add token-efficient, evidence-gated Guru escalations for unresolved failures, architecture decisions, and conflicting expert recommendations.

**Architecture:** Keep MCP discovery first and require the cheap worker's first solution attempt to fail before any Guru escalation. Use `flash-guru-debug` for root cause, `flash-guru-architecture` for design seams, and `flash-guru-decision` only to arbitrate materially conflicting expert reports. All Gurus are read-only manager-owned coach tools; every resolved report returns to `flash-plan`, then instructs the cheap worker to retry.

**Tech Stack:** OpenCode agent profiles, Markdown workflow contracts, Venice model routing.

---

### Task 1: Add Guru leaf agents

**Files:**
- Create: `/Users/henrikholkenbrink/.config/opencode/agents/flash-guru-debug.md`
- Create: `/Users/henrikholkenbrink/.config/opencode/agents/flash-guru-architecture.md`
- Create: `/Users/henrikholkenbrink/.config/opencode/agents/flash-guru-decision.md`

- [ ] **Step 1: Add read-only profiles with explicit model routing**
- [ ] **Step 2: Add bounded evidence-first prompts and report contracts**
- [ ] **Step 3: Verify all profiles expose no write, task, skill, or MCP tools**

### Task 2: Add Guru routing to the orchestrator

**Files:**
- Modify: `/Users/henrikholkenbrink/.config/opencode/skills/flash-orchestrator/SKILL.md`

- [ ] **Step 1: Add Guru roles and escalation invariant**
- [ ] **Step 2: Add debug, architecture, and decision webflows**
- [ ] **Step 3: Add evidence packet and token budget contract**
- [ ] **Step 4: Require planner re-entry after every Guru report**
- [ ] **Step 5: Add stop conditions, approval gates, and route metrics**

### Task 3: Align the planner with Guru escalation

**Files:**
- Modify: `/Users/henrikholkenbrink/.config/opencode/agents/flash-plan.md`

- [ ] **Step 1: Add Guru escalation route taxonomy**
- [ ] **Step 2: Require evidence sufficiency and escalation triggers**
- [ ] **Step 3: Require post-Guru implementation boundaries and verification**

### Task 4: Verify configuration and runtime smoke paths

**Files:**
- Inspect: all changed agent and skill files

- [ ] **Step 1: Validate JSON and OpenCode model identifiers**
- [ ] **Step 2: Run one debug-Guru and one architecture-Guru read-only smoke run**
- [ ] **Step 3: Check every report contract and planner re-entry marker**
