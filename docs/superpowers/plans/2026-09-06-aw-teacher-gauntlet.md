# AW Teacher Gauntlet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a main-mediated, evidence-seeking Sol teacher loop, model-specific prompt composition, lean TDD routing, and compact per-run waste diagnostics to AW.

**Architecture:** A pure resolver selects one versioned prompt profile without starting agents. Native harness agents exchange four frozen contracts while the main agent owns orchestration and validation. Telemetry moves to a prompt-free v4 run schema with compact traces, bounded redacted anomaly excerpts, and paired profile evaluation.

**Tech Stack:** Markdown Agent Skills, Node.js ESM, `node:test`, append-only JSONL, native Codex/OpenCode/GitHub Copilot agent facilities.

---

## Execution guardrails

The repository is already dirty. Before implementation, capture `git status
--short` as the ownership baseline. Preserve every pre-existing edit and never
restore, overwrite, or stage it merely because a task also touches that file.
Before each commit below, inspect `git diff --cached` and stage only files or
hunks created by this plan. If a task has no safely separable change, skip its
intermediate commit and report that fact; verification is still mandatory.

Implement the tasks in dependency order. Within a task, keep the RED, GREEN,
and verification steps together. Do not run a later adapter or benchmark task
against a partly implemented schema transition.

---

## File structure

### New files

- `contracts/worker.md` — frozen worker completion and escalation messages.
- `contracts/teacher.md` — frozen teacher question, final, and evidence messages.
- `prompts/profiles.json` — exact harness/model-to-component registry.
- `prompts/core/worker.md` — shared worker invariants.
- `prompts/core/teacher.md` — shared teacher invariants.
- `prompts/models/glm-5.3-flash.md` — GLM execution delta.
- `prompts/models/gpt-5.6-luna.md` — Luna fallback delta.
- `prompts/models/gpt-5.6-sol.md` — Sol teacher delta.
- `prompts/models/gpt-6-astra.md` — explicit Astra override delta.
- `scripts/resolve-profile.mjs` — pure profile and playbook resolver CLI.
- `scripts/resolve-profile.test.mjs` — resolver behavior tests.
- `scripts/teacher-state.mjs` — pure teacher eligibility and transition rules.
- `scripts/teacher-state.test.mjs` — state-machine tests.
- `scripts/diagnostics.mjs` — trace normalization, redaction, and waste detection.
- `scripts/diagnostics.test.mjs` — diagnostics and privacy tests.
- `scripts/aw-v4-contract.test.mjs` — static AW v4 contract tests.

### Modified files

- `SKILL.md` — smaller router that loads only selected components.
- `playbooks/current.json` — v4 profile and bounded-loop fields.
- `references/routing.md` — evidence-gap teacher route and Grilling boundary.
- `references/teacher.md` — main-mediated interactive protocol.
- `references/telemetry.md` — v4 trace and anomaly schema.
- `references/autoresearch.md` — prompt-profile experiments and teacher metrics.
- `references/autoresearch-backlog.md` — deferred research variants after v4.
- `references/runtimes-{codex,opencode,copilot}.md` — native harness application.
- `workflows/{diagnose,fix,implement,review}.md` — escalation and lean-TDD rules.
- `agents/opencode/{aw-glm-worker,aw-glm-review,aw-luna-worker}.md` — dedicated profiles.
- `agents/copilot/aw-worker.agent.md` — frozen worker contract reference.
- `scripts/evidence.mjs` — v4 run normalization and comparison.
- `scripts/usage.mjs` — trace inspection and waste summary commands.
- `scripts/research.mjs` — one-field profile mutations and promotion gates.
- `scripts/benchmark.mjs` — resolved prompt-component load measurement.
- `scripts/autoresearch.test.mjs` — v4 comparison and promotion coverage.
- `scripts/usage.test.mjs` — new CLI coverage.
- `integrations/opencode/aw-usage.js` — compact high-fidelity OpenCode trace.
- `integrations/opencode/aw-usage.test.mjs` — OpenCode telemetry coverage.
- `integrations/lifecycle/aw-hook.mjs` — lower-fidelity Codex/Copilot trace.
- `integrations/lifecycle/aw-hook.test.mjs` — lifecycle telemetry coverage.
- `benchmarks/use-cases.json` and `benchmarks/latest.json` — profile-aware baseline.

### Removed file

- `scripts/aw-v3-contract.test.mjs` — v4 replaces the contract without a compatibility layer.

## Task 1: Freeze the four message contracts

**Files:**
- Create: `contracts/worker.md`
- Create: `contracts/teacher.md`
- Create: `scripts/aw-v4-contract.test.mjs`
- Remove: `scripts/aw-v3-contract.test.mjs`

- [ ] **Step 1: Write the failing contract test**

Create `scripts/aw-v4-contract.test.mjs` with these initial assertions:

```js
import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (path) => readFileSync(join(root, path), "utf8")

test("ships frozen worker and teacher contracts", () => {
  for (const path of ["contracts/worker.md", "contracts/teacher.md"]) {
    assert.equal(existsSync(join(root, path)), true, path)
  }
  const worker = read("contracts/worker.md")
  assert.match(worker, /TYPE: DONE/)
  assert.match(worker, /TYPE: TEACHER_REQUEST/)
  assert.match(worker, /MISSING_DECISIVE \| CONFLICTING \| EXHAUSTED/)
  assert.doesNotMatch(worker, /HUMAN_REQUEST/)

  const teacher = read("contracts/teacher.md")
  assert.match(teacher, /ASK:/)
  assert.match(teacher, /FINAL:/)
  assert.match(teacher, /TYPE: EVIDENCE/)
  assert.match(teacher, /inspect \| reproduce \| compare \| verify/)
})
```

- [ ] **Step 2: Run the test and confirm the missing-file failure**

Run:

```bash
node --test scripts/aw-v4-contract.test.mjs
```

Expected: FAIL because `contracts/worker.md` and `contracts/teacher.md` do not exist.

- [ ] **Step 3: Create the worker contract**

Create `contracts/worker.md`:

```markdown
# Worker contract v1

Return exactly one message type.

## Completion

TYPE: DONE
CHANGED: <paths or none>
EVIDENCE: <path, command, exit code, and semantic result references>
VERIFY: <command | exit code | semantic result>
RISKS: <concrete risks or none>

## Teacher request

TYPE: TEACHER_REQUEST
STATE: MISSING_DECISIVE | CONFLICTING | EXHAUSTED
DECISION: <blocked technical decision>
KNOWN: <supported facts>
MISSING: <one decisive knowledge gap>
ATTEMPTED: <at most two distinct probes>

Use observed states, never a numeric confidence score. Do not start another
agent. The main agent decides whether to activate the teacher.
```

- [ ] **Step 4: Create the teacher contract**

Create `contracts/teacher.md`:

```markdown
# Teacher contract v1

Return exactly one teacher message type.

## Evidence request

ASK:
  ID: <unique request ID>
  TYPE: inspect | reproduce | compare | verify
  TARGET: <one information target>
  WHY: <decision it can change>
  EVIDENCE: <expected evidence form>
  STOP: <completion condition>

## Final recommendation

FINAL:
  DECISION: <actionable recommendation>
  WHY: <brief rationale>
  WORKER_STEPS: <ordered actions>
  RISKS: <material residual risks>
  VERIFY: <final proof>
  ASSUMPTIONS: <remaining assumptions or none>

## Evidence response

TYPE: EVIDENCE
ASK_ID: <request ID>
RESULT: <observed result>
SOURCE: <path, symbol, command, or runtime metadata>
EXIT: <exit code or n/a>
UNKNOWN: <remaining missing information or none>

One ASK has one target, expected evidence, and a stop condition. FINAL ends the
thread. The existing worker answers inspect, reproduce, and verify; a fresh
read-only worker answers compare or challenges conflicting evidence. The main
agent validates every EVIDENCE message before forwarding it.
```

- [ ] **Step 5: Remove the old contract test and run the new one**

Run:

```bash
node --test scripts/aw-v4-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit the contract slice**

```bash
git add contracts/worker.md contracts/teacher.md scripts/aw-v4-contract.test.mjs scripts/aw-v3-contract.test.mjs
git commit -m "feat: define AW teacher contracts"
```

## Task 2: Add model prompt profiles and the pure resolver

**Files:**
- Create: `prompts/profiles.json`
- Create: `prompts/core/worker.md`
- Create: `prompts/core/teacher.md`
- Create: `prompts/models/glm-5.3-flash.md`
- Create: `prompts/models/gpt-5.6-luna.md`
- Create: `prompts/models/gpt-5.6-sol.md`
- Create: `prompts/models/gpt-6-astra.md`
- Create: `scripts/resolve-profile.mjs`
- Create: `scripts/resolve-profile.test.mjs`
- Modify: `playbooks/current.json`

- [ ] **Step 1: Write failing resolver tests**

Create `scripts/resolve-profile.test.mjs`:

```js
import test from "node:test"
import assert from "node:assert/strict"
import { resolveSelection } from "./resolve-profile.mjs"

test("selects only the OpenCode GLM worker components", () => {
  const value = resolveSelection({
    host: "opencode",
    role: "worker",
    model: "venice/z-ai-glm-5-3-flash",
    route: "fix",
    taskClass: "bug",
    complexity: "small",
  })
  assert.equal(value.profile_id, "opencode-glm-worker-v1")
  assert.deepEqual(value.components, [
    "prompts/core/worker.md",
    "contracts/worker.md",
    "prompts/models/glm-5.3-flash.md",
    "workflows/fix.md",
    "playbooks/recipes/base-v1.md",
  ])
  assert.equal(value.teacher, null)
})

test("defaults the teacher to Sol and requires an explicit Astra request", () => {
  const sol = resolveSelection({ host: "codex", role: "teacher", route: "teacher" })
  assert.equal(sol.model, "gpt-5.6-sol")
  assert.equal(sol.profile_id, "sol-teacher-v1")

  const astra = resolveSelection({
    host: "codex",
    role: "teacher",
    route: "teacher",
    model: "gpt-6-astra",
    explicitModelRequest: true,
  })
  assert.equal(astra.model, "gpt-6-astra")
  assert.equal(astra.profile_id, "astra-teacher-v1")
  assert.throws(() => resolveSelection({
    host: "codex",
    role: "teacher",
    route: "teacher",
    model: "gpt-6-astra",
  }), /explicit user request/)
})
```

- [ ] **Step 2: Run the resolver tests and confirm the import failure**

Run:

```bash
node --test scripts/resolve-profile.test.mjs
```

Expected: FAIL because `scripts/resolve-profile.mjs` does not exist.

- [ ] **Step 3: Create the profile registry**

Create `prompts/profiles.json`:

```json
{
  "schema_version": 1,
  "worker_profiles": {
    "codex|venice/glm-5.3-flash": {
      "id": "codex-glm-worker-v1",
      "core": "prompts/core/worker.md",
      "contract": "contracts/worker.md",
      "model_delta": "prompts/models/glm-5.3-flash.md"
    },
    "opencode|venice/z-ai-glm-5-3-flash": {
      "id": "opencode-glm-worker-v1",
      "core": "prompts/core/worker.md",
      "contract": "contracts/worker.md",
      "model_delta": "prompts/models/glm-5.3-flash.md"
    },
    "codex|gpt-5.6-luna": {
      "id": "codex-luna-worker-v1",
      "core": "prompts/core/worker.md",
      "contract": "contracts/worker.md",
      "model_delta": "prompts/models/gpt-5.6-luna.md"
    },
    "opencode|openai-codex/gpt-5.6-luna": {
      "id": "opencode-luna-worker-v1",
      "core": "prompts/core/worker.md",
      "contract": "contracts/worker.md",
      "model_delta": "prompts/models/gpt-5.6-luna.md"
    }
  },
  "teacher_profiles": {
    "gpt-5.6-sol": {
      "id": "sol-teacher-v1",
      "core": "prompts/core/teacher.md",
      "contract": "contracts/teacher.md",
      "model_delta": "prompts/models/gpt-5.6-sol.md"
    },
    "gpt-6-astra": {
      "id": "astra-teacher-v1",
      "core": "prompts/core/teacher.md",
      "contract": "contracts/teacher.md",
      "model_delta": "prompts/models/gpt-6-astra.md"
    }
  },
  "teacher_default": "gpt-5.6-sol",
  "teacher_explicit_overrides": ["gpt-6-astra"]
}
```

- [ ] **Step 4: Create the prompt components**

Use these exact responsibilities:

```markdown
<!-- prompts/core/worker.md -->
Own only the assigned scope. Preserve unrelated edits. Use observed evidence,
stop at missing authority, and return one valid worker-contract message.
```

```markdown
<!-- prompts/core/teacher.md -->
Act only as a technical adviser over the supplied case. Use no tools or outside
evidence. Return one valid teacher-contract message and never orchestrate.
```

```markdown
<!-- prompts/models/glm-5.3-flash.md -->
Execute one atomic objective. Start with the cheapest discriminating action,
run the declared probe, and correct only when its result changes the evidence.
Request the teacher when decisive evidence is missing, conflicting, or exhausted.
```

```markdown
<!-- prompts/models/gpt-5.6-luna.md -->
Execute the explicit fallback slice with the smallest relevant tool set. Follow
the output schema exactly and do not broaden scope to compensate for missing context.
```

```markdown
<!-- prompts/models/gpt-5.6-sol.md -->
Choose between one discriminating ASK and an actionable FINAL. Optimize for the
decision and proof rather than prescribing unnecessary process.
```

```markdown
<!-- prompts/models/gpt-6-astra.md -->
Honor the frozen contract before optional guidance. Continue autonomously from
routine evidence, keep delegation inside the main-agent boundary, and calibrate
testing to the stated verification target.
```

- [ ] **Step 5: Update the playbook to v4**

Change `playbooks/current.json` to:

```json
{
  "schema_version": 4,
  "version": "base-v2",
  "generated_at": "2026-09-06T00:00:00.000Z",
  "frozen": {
    "evaluator": "quality-v1",
    "telemetry": "run-v4",
    "safety": "aw-v2",
    "worker_contract": "worker-v1",
    "teacher_contract": "teacher-v1",
    "teacher_default": "gpt-5.6-sol",
    "teacher_max_asks": 3,
    "teacher_max_turns": 5
  },
  "defaults": {
    "recipe_id": "base-v1",
    "prompt_profile_id": "model-bound-v1",
    "context_budget": 1600,
    "worker_step_budget": 8,
    "teacher_after_failed_hypotheses": 2
  },
  "cells": {}
}
```

- [ ] **Step 6: Implement the resolver**

`scripts/resolve-profile.mjs` must export `resolveSelection(input)` and provide
a CLI accepting `--host`, `--role`, `--model`, `--route`, `--task-class`,
`--complexity`, and `--explicit-model-request`. It must:

```js
const teacherModel = input.model || registry.teacher_default
if (teacherModel !== registry.teacher_default
  && (!input.explicitModelRequest
    || !registry.teacher_explicit_overrides.includes(teacherModel))) {
  throw new Error(`${teacherModel} requires an explicit user request`)
}
```

For workers, resolve the exact `${host}|${model}` key. Return components in
core, contract, model delta, workflow, recipe order. Reject unknown hosts,
roles, models, routes, missing component files, and any playbook other than v4.
The CLI prints the selected object as formatted JSON and performs no writes.

- [ ] **Step 7: Run resolver and contract tests**

Run:

```bash
node --test scripts/resolve-profile.test.mjs scripts/aw-v4-contract.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 8: Commit the profile slice**

```bash
git add prompts scripts/resolve-profile.mjs scripts/resolve-profile.test.mjs playbooks/current.json
git commit -m "feat: resolve model-specific AW prompts"
```

## Task 3: Implement the pure teacher state machine

**Files:**
- Create: `scripts/teacher-state.mjs`
- Create: `scripts/teacher-state.test.mjs`

- [ ] **Step 1: Write failing transition tests**

Cover these cases in `scripts/teacher-state.test.mjs`:

```js
import test from "node:test"
import assert from "node:assert/strict"
import { assessTeacherRequest, acceptTeacherReply, selectEvidenceWorker } from "./teacher-state.mjs"

test("accepts a decisive bounded request after a useful probe", () => {
  assert.deepEqual(assessTeacherRequest({
    state: "MISSING_DECISIVE",
    decision: "choose ownership boundary",
    known: ["src/a.js:10"],
    missing: "whether callers require synchronous completion",
    attempted: ["rg caller src"],
    humanDecision: false,
  }), { eligible: true, reason: null })
})

test("rejects human decisions and empty evidence", () => {
  assert.equal(assessTeacherRequest({
    state: "MISSING_DECISIVE", decision: "choose product behavior",
    known: [], missing: "preferred UX", attempted: [], humanDecision: true,
  }).reason, "HUMAN_DECISION_REQUIRED")
})

test("routes evidence collection by independence need", () => {
  assert.equal(selectEvidenceWorker({ type: "verify", conflicting: false }), "existing")
  assert.equal(selectEvidenceWorker({ type: "compare", conflicting: false }), "fresh-read-only")
  assert.equal(selectEvidenceWorker({ type: "inspect", conflicting: true }), "fresh-read-only")
})

test("enforces three asks, five turns, and one ASK repair", () => {
  const exhausted = acceptTeacherReply({ asks: 3, turns: 4, askRepairs: 0 }, { type: "ASK", valid: true })
  assert.equal(exhausted.terminal, "TEACHER_EXHAUSTED")
  const repair = acceptTeacherReply({ asks: 1, turns: 2, askRepairs: 0 }, { type: "ASK", valid: false })
  assert.equal(repair.action, "REPAIR_ASK")
})
```

- [ ] **Step 2: Run tests and confirm the import failure**

Run:

```bash
node --test scripts/teacher-state.test.mjs
```

Expected: FAIL because `scripts/teacher-state.mjs` is missing.

- [ ] **Step 3: Implement pure rules**

Define frozen sets for evidence states, ASK types, rejection reasons, and
terminal outcomes. `assessTeacherRequest()` returns the first applicable stable
rejection reason in this order: human decision, missing evidence references,
non-material decision, cheaper check available, exhausted budget. A valid
request returns `{ eligible: true, reason: null }`.

`acceptTeacherReply()` increments turns, ends immediately on `FINAL`, repairs
one invalid ASK, forces `FINAL` after a second invalid ASK, and returns
`TEACHER_EXHAUSTED` when the next accepted ASK would exceed three asks or five
responses. Continue only when the prior evidence reports information gain.

- [ ] **Step 4: Run tests**

```bash
node --test scripts/teacher-state.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 5: Commit the state-machine slice**

```bash
git add scripts/teacher-state.mjs scripts/teacher-state.test.mjs
git commit -m "feat: enforce bounded teacher dialogue"
```

## Task 4: Wire contracts and profiles into AW instructions

**Files:**
- Modify: `SKILL.md`
- Modify: `references/routing.md`
- Modify: `references/teacher.md`
- Modify: `workflows/diagnose.md`
- Modify: `workflows/fix.md`
- Modify: `workflows/implement.md`
- Modify: `workflows/review.md`
- Modify: `scripts/aw-v4-contract.test.mjs`

- [ ] **Step 1: Extend the static tests first**

Add assertions that `SKILL.md` names `resolve-profile.mjs`, loads one returned
component list, gives the main agent sole spawn authority, defaults the teacher
to Sol, and allows Astra only by explicit user request. Assert that `fix.md` and
`implement.md` contain `SEAM -> RED -> MINIMAL CHANGE -> GREEN`, while
`routing.md` separates technical evidence gaps from human and Grilling routes.

- [ ] **Step 2: Run the test and confirm failure**

```bash
node --test scripts/aw-v4-contract.test.mjs
```

Expected: FAIL on the new resolver, teacher, and lean-TDD assertions.

- [ ] **Step 3: Replace the AW execution section**

Keep the six-line fast route, then make execution read:

```markdown
## Execute

1. Freeze `OBJECTIVE | SUCCESS | CONTEXT | PATHS | NON_GOALS | VERIFY`.
2. Read exactly one harness runtime and one workflow.
3. Run `node scripts/resolve-profile.mjs` for the intended native agent and
   load only the returned component paths in their returned order.
4. Dispatch one bounded worker. Only the main agent may start or resume agents.
5. Accept `DONE` or `TEACHER_REQUEST`. Validate worker evidence directly;
   missing evidence is UNKNOWN. Teacher requests that require human authority
   are rejected with `HUMAN_DECISION_REQUIRED` and routed to a normal question
   or Grilling according to `references/routing.md`.
6. For an eligible teacher request, follow `references/teacher.md` in the same
   teacher thread. Sol is default; Astra requires an explicit user request.
7. Run the outer verification gauntlet and record v4 telemetry.
```

Move detailed model, telemetry, and protocol prose out of `SKILL.md`. Keep its
frontmatter description concise and specific enough for implicit activation.

- [ ] **Step 4: Update routing and workflows**

Add `MISSING_DECISIVE`, `CONFLICTING`, and `EXHAUSTED` as evidence-gap teacher
signals. Preserve the hard two-distinct-hypothesis trigger. Route one missing
human decision to a normal question and a dependent decision tree to Grilling.

Add the lean-TDD contract to `fix.md` and `implement.md` only when observable
behavior changes at a known seam. State that uncertain seams, mocking, or
integration-test design load the full Matt TDD skill; documentation and config
use a targeted probe without artificial RED.

- [ ] **Step 5: Update the teacher reference**

Replace the existing generic ASK prose with the frozen contracts, the main
eligibility gate, dynamic evidence-worker selection, one ASK repair, one
evidence repair, three-ASK/five-turn limits, no-information stop, and exact
terminal outcomes. Preserve the Codex subscription and no-tools isolation.

- [ ] **Step 6: Run the static tests and benchmark**

```bash
node --test scripts/aw-v4-contract.test.mjs scripts/resolve-profile.test.mjs scripts/teacher-state.test.mjs
node scripts/benchmark.mjs
```

Expected: tests PASS; benchmark reports entrypoint and resolved-route token
estimates without enforcing the design's soft size targets.

- [ ] **Step 7: Commit the instruction slice**

```bash
git add SKILL.md references/routing.md references/teacher.md workflows scripts/aw-v4-contract.test.mjs
git commit -m "feat: route AW through teacher gauntlets"
```

## Task 5: Add compact diagnostics and move telemetry to v4

**Files:**
- Create: `scripts/diagnostics.mjs`
- Create: `scripts/diagnostics.test.mjs`
- Modify: `scripts/evidence.mjs`
- Modify: `scripts/autoresearch.test.mjs`

- [ ] **Step 1: Write failing privacy and waste tests**

Test that diagnostics:

```js
assert.equal(redactExcerpt("token=secret123 /Users/alice/repo failed"), "token=[REDACTED] [HOME]/repo failed")
assert.equal(redactExcerpt("x".repeat(700)).length, 500)
assert.deepEqual(detectWaste([
  { actor: "worker", event: "read", signature: "a", revision: "1" },
  { actor: "worker", event: "read", signature: "a", revision: "1" },
]).map((item) => item.kind), ["repeated_read"])
assert.deepEqual(detectWaste([
  { actor: "main", event: "verify", signature: "v", changed: false },
  { actor: "main", event: "verify", signature: "v", changed: false },
]).map((item) => item.kind), ["duplicate_verification"])
```

Also test that `normalizeRun()` rejects schema v3, forbidden raw-content keys,
more than ten excerpts per run, more than two excerpts per waste event, and an
excerpt longer than 500 characters after normalization.

- [ ] **Step 2: Run tests and confirm failure**

```bash
node --test scripts/diagnostics.test.mjs scripts/autoresearch.test.mjs
```

Expected: FAIL because diagnostics and schema v4 do not exist.

- [ ] **Step 3: Implement redaction and waste detection**

In `scripts/diagnostics.mjs`, export:

```js
export const redactExcerpt = (value) => `${value || ""}`
  .replace(/\b(api[_-]?key|token|secret|password)\s*[:=]\s*\S+/gi, "$1=[REDACTED]")
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
  .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "[ID]")
  .replace(/\/Users\/[^/]+/g, "[HOME]")
  .replace(/\/home\/[^/]+/g, "[HOME]")
  .slice(0, 500)
```

Implement `detectWaste(events)` with deterministic adjacent-event rules for
`repeated_read`, `duplicate_probe`, `duplicate_verification`,
`unchanged_hypothesis`, `teacher_repeat_request`, and
`zero_information_gain`. Accept host-attested explicit events for
`teacher_called_too_early`, `teacher_called_too_late`,
`teacher_ask_too_broad`, `unusable_evidence`, `main_repair`, `scope_rework`,
`model_mismatch`, and `fallback`. Store only actor, phase, kind, numeric waste,
signatures, and bounded redacted excerpts.

- [ ] **Step 4: Replace run schema v3 with v4**

Update `scripts/evidence.mjs` so `normalizeRun()` requires:

```js
if (input.schema_version !== 4 || input.kind !== "run") {
  throw new Error("run must use schema_version 4 and kind run")
}
```

Add normalized `harness_version`, `prompt`, `timeline`, `gauntlet`, `teacher`,
`waste_events`, and terminal `outcome`. Include `prompt_profile_id` in the cell
ID. Keep exact provider tokens nullable and preserve the host quality
attestation as the acceptance authority. `readRuns()` reads v4 only; do not add
a v3 converter or fallback.

- [ ] **Step 5: Add derived teacher and waste metrics**

Normalize and expose:

```js
metrics: {
  worker_token_share,
  worker_execution_share,
  friction_score,
  waste_event_count,
  estimated_wasted_tokens,
  teacher_ask_count,
  teacher_answer_rate,
  teacher_decision_change_rate,
  teacher_final_actionable,
  post_teacher_green,
  teacher_repeat_requests,
  teacher_zero_information_turns,
  teacher_main_repairs,
}
```

- [ ] **Step 6: Run diagnostics and evidence tests**

```bash
node --test scripts/diagnostics.test.mjs scripts/autoresearch.test.mjs
```

Expected: all tests PASS and stored fixtures contain no raw prompt, transcript,
diff, secret, absolute home path, or full tool output.

- [ ] **Step 7: Commit the telemetry-core slice**

```bash
git add scripts/diagnostics.mjs scripts/diagnostics.test.mjs scripts/evidence.mjs scripts/autoresearch.test.mjs
git commit -m "feat: record AW v4 waste diagnostics"
```

## Task 6: Populate v4 traces from OpenCode and lifecycle hooks

**Files:**
- Modify: `integrations/opencode/aw-usage.js`
- Modify: `integrations/opencode/aw-usage.test.mjs`
- Modify: `integrations/lifecycle/aw-hook.mjs`
- Modify: `integrations/lifecycle/aw-hook.test.mjs`

- [ ] **Step 1: Add failing adapter tests**

For OpenCode, simulate skill activation, workflow read, child creation, repeated
read signatures, a teacher command, message token events, and parent idle.
Assert one v4 run containing component IDs, actor timeline, one
`repeated_read`, teacher counts, exact native model IDs, and no tool arguments.

For Codex/Copilot lifecycle fixtures, assert v4 output with available lifecycle
events and null fields where the hook has no trustworthy data. Preserve tests
that sensitive prompt, transcript, error, and path values are absent.

- [ ] **Step 2: Run adapter tests and confirm schema failures**

```bash
node --test integrations/opencode/aw-usage.test.mjs integrations/lifecycle/aw-hook.test.mjs
```

Expected: FAIL because adapters still emit schema v3.

- [ ] **Step 3: Extend OpenCode's bounded in-memory state**

Add these fields at activation:

```js
timeline: [],
gauntlet: [],
teacher: [],
signatures: new Map(),
promptProfileID: playbook.defaults.prompt_profile_id,
harnessVersion: process.env.OPENCODE_VERSION || null,
```

Record timestamp offsets, actor, phase, event kind, token deltas, and hashed
tool signatures. Never store tool arguments. Derive waste events at parent
idle, pass the compact structures to `appendRun()`, then clear descendant state.

- [ ] **Step 4: Extend lifecycle traces conservatively**

Map only fields supplied by documented hook events. Hash session and tool
signatures, omit prompt and error bodies, and emit null for unavailable tokens,
model IDs, information gain, or component size. Do not infer values from text
length or transcript paths.

- [ ] **Step 5: Run adapter tests**

```bash
node --test integrations/opencode/aw-usage.test.mjs integrations/lifecycle/aw-hook.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 6: Commit the adapter slice**

```bash
git add integrations/opencode integrations/lifecycle
git commit -m "feat: capture AW v4 harness traces"
```

## Task 7: Make waste and teacher efficiency queryable and promotable

**Files:**
- Modify: `scripts/usage.mjs`
- Modify: `scripts/usage.test.mjs`
- Modify: `scripts/evidence.mjs`
- Modify: `scripts/research.mjs`
- Modify: `scripts/autoresearch.test.mjs`
- Modify: `references/telemetry.md`
- Modify: `references/autoresearch.md`
- Modify: `references/autoresearch-backlog.md`

- [ ] **Step 1: Write failing CLI and comparison tests**

Add fixtures with paired successful runs where the candidate reduces broad
teacher questions and repeated reads while preserving success. Assert:

```text
usage.mjs waste --kind repeated_read
usage.mjs teacher --profile sol-teacher-v1
usage.mjs analyze --baseline base-v2 --candidate ask-stop-v1 --min-pairs 5
```

The first two commands must return grouped actor/phase/profile causes. The
analysis must reject a candidate that improves tokens but regresses
`post_teacher_green`, answer rate, repeat requests, zero-information turns, or
main repair.

- [ ] **Step 2: Run tests and confirm command failures**

```bash
node --test scripts/usage.test.mjs scripts/autoresearch.test.mjs
```

Expected: FAIL because `waste`, `teacher`, and v4 promotion gates are missing.

- [ ] **Step 3: Add query commands**

Implement `usage.mjs waste` with optional `--kind`, `--actor`, `--route`, and
`--profile` filters. Group by `kind|actor|phase|prompt_profile_id` and return
run count plus observed/estimated waste totals. Implement `usage.mjs teacher`
with optional profile and route filters and return ask count, answer rate,
decision-change rate, actionable-final rate, post-teacher-green rate, repeated
requests, zero-information turns, and main repairs.

- [ ] **Step 4: Extend paired comparisons**

Keep success, median/p90 tokens, friction, worker token share, and worker
execution share as gates. Add non-regression gates for teacher answer rate,
actionable finals, post-teacher green rate, repeat requests, zero-information
turns, main repairs, and measured waste. Require one strict improvement across
the existing or new efficiency measures.

- [ ] **Step 5: Extend mutable playbook fields**

Allow exactly one mutation to one of:

```js
new Set([
  "recipe_id",
  "prompt_profile_id",
  "context_budget",
  "worker_step_budget",
  "teacher_after_failed_hypotheses",
])
```

Keep teacher default, maximum asks, maximum turns, schemas, evaluator, safety,
and permission boundaries frozen. A new `prompt_profile_id` must resolve to an
existing immutable profile before promotion.

Preserve `research.mjs due` and `close` as the scheduler-neutral weekly gate;
make `select` and `promote` reject any playbook other than v4. Add tests proving
that a completed ISO week is not scheduled twice and that insufficient paired
evidence closes as `no-change` instead of promoting.

- [ ] **Step 6: Update operator references**

Document every v4 field, null behavior, diagnostic excerpt cap, waste query,
teacher query, paired gates, weekly due/close operation, and the rule that
Astra research cannot change the Sol operational default. Update
`autoresearch-backlog.md` from its v3 prerequisite to v4, keep all nine
deferred variants, and mark the staged evidence flywheel as the implemented
tenth variant rather than silently removing the alternatives.

- [ ] **Step 7: Run tests**

```bash
node --test scripts/usage.test.mjs scripts/autoresearch.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 8: Commit the research slice**

```bash
git add scripts/usage.mjs scripts/usage.test.mjs scripts/evidence.mjs scripts/research.mjs scripts/autoresearch.test.mjs references/telemetry.md references/autoresearch.md references/autoresearch-backlog.md
git commit -m "feat: optimize AW from diagnosed waste"
```

## Task 8: Bind dedicated native harness profiles

**Files:**
- Modify: `agents/opencode/aw-glm-worker.md`
- Modify: `agents/opencode/aw-glm-review.md`
- Modify: `agents/opencode/aw-luna-worker.md`
- Modify: `agents/copilot/aw-worker.agent.md`
- Modify: `references/runtimes-opencode.md`
- Modify: `references/runtimes-codex.md`
- Modify: `references/runtimes-copilot.md`
- Modify: `scripts/aw-v4-contract.test.mjs`

- [ ] **Step 1: Write failing harness-profile assertions**

Assert that OpenCode's runtime names `aw-glm-worker`, `aw-glm-review`, and
`aw-luna-worker` as the AW profiles and no longer uses global `general` or
`explore` model defaults for evidence cells. Assert exact GLM/Luna model slugs,
no recursive task permission, and the worker contract output types. Assert
Codex uses explicit native model selection and Copilot records unsupported or
unresolved models as unknown.

- [ ] **Step 2: Run the static test and confirm failure**

```bash
node --test scripts/aw-v4-contract.test.mjs
```

Expected: FAIL because the OpenCode runtime still treats AW profiles as
optional compatibility profiles.

- [ ] **Step 3: Update dedicated agent profiles**

Keep model and permissions in frontmatter. Replace each body with a minimal
model-appropriate invariant plus:

```text
Follow the parent-supplied AW component contract. Return DONE or
TEACHER_REQUEST. Never start another agent.
```

The reviewer remains read-only. Luna states that it is valid only after a
recorded GLM availability failure.

- [ ] **Step 4: Update runtime documentation**

OpenCode dispatches the dedicated AW profile by name and proves the child
`providerID/modelID`. A mismatch stops the run. Codex binds the explicit model
to the selected prompt profile and resumes one teacher child. Copilot uses only
available custom-agent models and excludes unresolved model evidence.

- [ ] **Step 5: Install OpenCode profile symlinks without overwriting files**

For each profile, first run:

```bash
test ! -e "$HOME/.config/opencode/agents/aw-glm-worker.md"
test ! -e "$HOME/.config/opencode/agents/aw-glm-review.md"
test ! -e "$HOME/.config/opencode/agents/aw-luna-worker.md"
```

Expected: all three commands exit 0. Then create explicit symlinks:

```bash
ln -s "$HOME/.config/opencode/skills/aw/agents/opencode/aw-glm-worker.md" "$HOME/.config/opencode/agents/aw-glm-worker.md"
ln -s "$HOME/.config/opencode/skills/aw/agents/opencode/aw-glm-review.md" "$HOME/.config/opencode/agents/aw-glm-review.md"
ln -s "$HOME/.config/opencode/skills/aw/agents/opencode/aw-luna-worker.md" "$HOME/.config/opencode/agents/aw-luna-worker.md"
```

If any preflight exits nonzero, stop this installation step and report the
existing path; do not replace it.

- [ ] **Step 6: Run static tests**

```bash
node --test scripts/aw-v4-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit repository profile changes**

```bash
git add agents references/runtimes-opencode.md references/runtimes-codex.md references/runtimes-copilot.md scripts/aw-v4-contract.test.mjs
git commit -m "feat: bind AW native agent profiles"
```

## Task 9: Update profile-aware benchmarks and run the complete verification

**Files:**
- Modify: `scripts/benchmark.mjs`
- Modify: `benchmarks/use-cases.json`
- Modify: `benchmarks/latest.json`
- Modify: `LESSONS.md`

- [ ] **Step 1: Add profile expectations to benchmark cases**

Each non-direct use case supplies `host`, `worker_model`, and expected
`profile_id`. Teacher cases expect `sol-teacher-v1`; add one separate explicit
Astra case that expects `astra-teacher-v1` and never changes the default.

- [ ] **Step 2: Measure resolved component sets**

Change `benchmark.mjs` to call `resolveSelection()` for each case and count only
`SKILL.md`, one runtime, and the returned components. Report component IDs,
words, characters, estimated tokens, and route correctness. Keep token targets
informational; fail only missing files, wrong routing/profile selection,
forbidden obsolete paths, or broken invariants.

- [ ] **Step 3: Run the full deterministic suite**

```bash
node --test scripts/*.test.mjs integrations/opencode/*.test.mjs integrations/lifecycle/*.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 4: Regenerate and inspect the benchmark**

```bash
node scripts/benchmark.mjs --write
node scripts/benchmark.mjs
```

Expected: routing and profile selection pass for every case; `SKILL.md` and
normal resolved routes are smaller than the current v3 baseline or the report
explicitly identifies the component responsible for a regression.

- [ ] **Step 5: Run an OpenCode model preflight**

After restarting OpenCode, run a read-only profile probe:

```bash
opencode run --agent aw-glm-worker --format json "Return only TYPE: DONE, CHANGED: none, EVIDENCE: profile-probe, VERIFY: n/a, RISKS: none"
```

Expected: assistant event metadata resolves to
`venice/z-ai-glm-5-3-flash`. Do not treat assistant self-identification text as
proof. If the native metadata differs or is absent, stop before a live AW
canary and record the blocker.

- [ ] **Step 6: Run one bounded teacher canary**

Use a fixed read-only fixture in which the worker emits one valid
`TEACHER_REQUEST`, Sol emits one `ASK`, the existing worker returns one
`EVIDENCE`, and Sol emits `FINAL`. Verify the same teacher thread ID is resumed,
the main agent performs the outer probe, and the stored v4 run contains no raw
case text.

- [ ] **Step 7: Record numeric results**

Append one entry to `LESSONS.md` containing the v3 versus v4 entrypoint and
route estimates, deterministic test count, canary actor/model IDs, teacher
turns, exact provider token values when available, and detected waste events.
Unknown provider tokens remain null.

- [ ] **Step 8: Commit the verified baseline**

```bash
git add scripts/benchmark.mjs benchmarks/use-cases.json benchmarks/latest.json LESSONS.md
git commit -m "test: establish AW teacher gauntlet baseline"
```

## Final acceptance check

Run:

```bash
node --test scripts/*.test.mjs integrations/opencode/*.test.mjs integrations/lifecycle/*.test.mjs
node scripts/benchmark.mjs
node scripts/usage.mjs summary
```

Acceptance requires:

- all deterministic tests pass;
- one exact worker prompt profile is selected per run;
- Sol remains the default teacher and Astra requires explicit request;
- worker escalation is main-mediated;
- ASK/EVIDENCE loops enforce three-ASK/five-turn limits;
- lean TDD and Grilling use the approved routing boundaries;
- v4 traces identify actor, phase, and waste without raw protected content;
- paired promotion rejects teacher-quality regressions;
- the OpenCode profile resolves to GLM before any live result is admitted to a
  GLM evidence cell.
