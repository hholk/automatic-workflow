import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

const usageScript = new URL("./usage.mjs", import.meta.url).pathname
const researchScript = new URL("./research.mjs", import.meta.url).pathname
const state = mkdtempSync(join(tmpdir(), "aw-autoresearch-"))
const runUsageAt = (targetState, ...args) => spawnSync(process.execPath, [usageScript, ...args], {
  env: { ...process.env, AW_STATE_DIR: targetState }, encoding: "utf8",
})
const runUsage = (...args) => runUsageAt(state, ...args)

const event = ({ runID, recipe, variant = recipe, taskID, tokens = 100, mainTokens = 20, workerActions = 8, accepted, fallback = false, pass = true, profile = "codex-haiku-worker-v1" }) => ({
  schema_version: 4,
  kind: "run",
  run_id: runID,
  host: "codex",
  route: "implement",
  task: { id: taskID, class: "known-change", complexity: "small" },
  recipe_id: recipe,
  playbook_version: variant,
  harness_version: "test",
  prompt: {
    profile_id: profile,
    component_ids: ["core/worker", "contracts/worker", "models/claude-haiku-5-5", "workflows/implement", recipe],
    component_tokens: 100,
    loaded_files: ["prompts/core/worker.md", "contracts/worker.md", "prompts/models/claude-haiku-5-5.md", "workflows/implement.md", `playbooks/recipes/${recipe}.md`],
    duplicate_context_tokens: 0,
  },
  actors: {
    main: { used: true, requested_model: "venice/mimo-2.6-flash", resolved_model: "venice/mimo-2.6-flash", model_source: "native", token_source: "native", tokens: mainTokens },
    worker: {
      used: true,
      requested_model: "venice/mimo-2.6-flash",
      resolved_model: fallback ? "gpt-5.6-luna" : "venice/mimo-2.6-flash",
      fallback_reason: fallback ? "primary-http-402" : null,
      model_source: "native",
      token_source: "native",
      tokens: tokens - mainTokens,
    },
    teacher: { used: false, requested_model: null, resolved_model: null, model_source: "unknown", token_source: "unknown", tokens: null },
  },
  quality: {
    verify_id: "unit-test",
    verify_exit_code: pass ? 0 : 1,
    semantic_success: pass,
    scope_covered: 1,
    scope_total: 1,
    review_pass: pass,
    forbidden_changes: 0,
  },
  work: { main_actions: 2, worker_actions: workerActions, accepted_worker_actions: accepted ?? workerActions, parent_rework: 0 },
  friction: { reroutes: 0, followups: 0, teacher_turns: 0, errors: pass ? 0 : 1 },
  timeline: [],
  gauntlet: [],
  teacher: [],
  waste_events: [],
  outcome: pass ? "VERIFIED" : "FAILED_VERIFICATION",
  duration_ms: 1000,
})

const recordAt = (targetState, item) => {
  const input = join(targetState, `${item.run_id}.json`)
  writeFileSync(input, JSON.stringify(item))
  return runUsageAt(targetState, "record", "--file", input)
}
const record = (item) => recordAt(state, item)
const attestAt = (targetState, item) => runUsageAt(
  targetState,
  "attest", "--run-id", item.run_id, "--verify-id", item.quality.verify_id,
  "--verify-exit-code", String(item.quality.verify_exit_code),
  "--semantic-success", String(item.quality.semantic_success),
  "--scope-covered", String(item.quality.scope_covered), "--scope-total", String(item.quality.scope_total),
  "--review-pass", String(item.quality.review_pass),
  "--forbidden-changes", String(item.quality.forbidden_changes),
  "--accepted-worker-actions", String(item.work.accepted_worker_actions),
  "--parent-rework", String(item.work.parent_rework),
)
const recordVerifiedAt = (targetState, item) => {
  const recorded = recordAt(targetState, item)
  if (recorded.status !== 0) return recorded
  return attestAt(targetState, item)
}
const recordVerified = (item) => recordVerifiedAt(state, item)

test("records prompt-free actor and resolved-model evidence", () => {
  const item = event({ runID: "fallback", recipe: "base-v1", taskID: "task-fallback", fallback: true })
  assert.equal(record(item).status, 0)
  const stored = JSON.parse(readFileSync(join(state, "runs.jsonl"), "utf8").trim())
  assert.equal(stored.actors.worker.resolved_model, "gpt-5.6-luna")
  assert.equal(stored.actors.worker.fallback_reason, "primary-http-402")
  assert.equal(stored.actors.worker.model_source, "native")
  assert.equal(stored.quality.attested, false)
  assert.equal(stored.quality.eligible, false)
  assert.equal(stored.tokens.operational_total, 100)
  assert.equal(stored.metrics.worker_token_share, 0.8)
  assert.equal(stored.metrics.worker_execution_share, null)
  assert.equal(stored.prompt.profile_id, "codex-haiku-worker-v1")
  assert.equal("prompt_text" in stored, false)
  const latest = runUsage("latest", "--host", "codex")
  assert.equal(latest.status, 0)
  assert.equal(JSON.parse(latest.stdout).run_id, "fallback")
})

test("keeps weekly judge tokens outside operational efficiency", () => {
  const item = event({ runID: "research-cost", recipe: "base-v1", taskID: "task-research" })
  item.research = { token_source: "native", tokens: 40 }
  assert.equal(record(item).status, 0)
  const stored = JSON.parse(readFileSync(join(state, "runs.jsonl"), "utf8").trim().split("\n").at(-1))
  assert.equal(stored.tokens.operational_total, 100)
  assert.equal(stored.tokens.research_total, 40)
})

test("does not claim total operational tokens when a used actor is unobserved", () => {
  const item = event({ runID: "unknown-teacher-cost", recipe: "base-v1", taskID: "task-teacher" })
  item.actors.teacher = {
    used: true,
    requested_model: "venice/opus-5.5",
    resolved_model: "venice/opus-5.5",
    model_source: "native",
    token_source: "unknown",
    tokens: null,
  }
  assert.equal(record(item).status, 0)
  const stored = JSON.parse(readFileSync(join(state, "runs.jsonl"), "utf8").trim().split("\n").at(-1))
  assert.equal(stored.tokens.operational_total, null)
})

test("rejects silent fallback, guessed tokens, hidden actor cost, unproved models, and prompt content", () => {
  const silent = event({ runID: "silent", recipe: "base-v1", taskID: "task-silent", fallback: true })
  silent.actors.worker.fallback_reason = null
  assert.notEqual(record(silent).status, 0)

  const guessed = event({ runID: "guessed", recipe: "base-v1", taskID: "task-guessed" })
  guessed.actors.worker.token_source = "estimated"
  assert.notEqual(record(guessed).status, 0)

  const hidden = event({ runID: "hidden", recipe: "base-v1", taskID: "task-hidden" })
  hidden.actors.worker.used = false
  assert.notEqual(record(hidden).status, 0)

  const unproved = event({ runID: "unproved", recipe: "base-v1", taskID: "task-unproved" })
  delete unproved.actors.worker.model_source
  assert.notEqual(record(unproved).status, 0)

  const leaked = event({ runID: "leaked", recipe: "base-v1", taskID: "task-leaked" })
  leaked.prompt = "secret task text"
  assert.notEqual(record(leaked).status, 0)
})

test("merges a host quality attestation even when it arrives before the trace", () => {
  const runID = "attested-run"
  let result = runUsage(
    "attest", "--run-id", runID, "--verify-id", "targeted-test", "--verify-exit-code", "0",
    "--semantic-success", "true", "--scope-covered", "2", "--scope-total", "2",
    "--review-pass", "true", "--forbidden-changes", "0",
    "--accepted-worker-actions", "8", "--parent-rework", "0",
  )
  assert.equal(result.status, 0)
  const pending = event({ runID, recipe: "base-v1", taskID: "attested-task" })
  pending.quality = {
    verify_id: null, verify_exit_code: null, semantic_success: null,
    scope_covered: null, scope_total: null, review_pass: null, forbidden_changes: null,
  }
  assert.equal(record(pending).status, 0)
  result = runUsage("show", "--run-id", runID)
  assert.equal(result.status, 0)
  assert.equal(JSON.parse(result.stdout).quality.eligible, true)
})

test("keeps an unapproved model mismatch ineligible even after host quality attestation", () => {
  const item = event({ runID: "unapproved-fallback", recipe: "base-v1", taskID: "unapproved-task", fallback: true })
  item.actors.worker.fallback_reason = "unapproved-runtime-mismatch"
  assert.equal(recordVerified(item).status, 0)
  const result = runUsage("show", "--run-id", item.run_id)
  const stored = JSON.parse(result.stdout)
  assert.equal(stored.quality.attested, true)
  assert.equal(stored.quality.routing_provenance_complete, false)
  assert.equal(stored.quality.eligible, false)
})

test("rejects generic fallback, omitted actors, and fewer than five requested pairs", () => {
  const generic = event({ runID: "generic-fallback", recipe: "base-v1", taskID: "generic-task", fallback: true })
  generic.actors.worker.fallback_reason = "fallback"
  assert.equal(recordVerified(generic).status, 0)
  let result = runUsage("show", "--run-id", generic.run_id)
  assert.equal(JSON.parse(result.stdout).quality.routing_provenance_complete, false)

  const omitted = event({ runID: "omitted-worker", recipe: "base-v1", taskID: "omitted-task" })
  delete omitted.actors.worker
  assert.notEqual(record(omitted).status, 0)

  const unused = event({ runID: "unused-worker", recipe: "base-v1", taskID: "unused-task" })
  unused.actors.worker = { used: false, requested_model: null, resolved_model: null, model_source: "unknown", token_source: "unknown", tokens: null }
  assert.equal(recordVerified(unused).status, 0)
  result = runUsage("show", "--run-id", unused.run_id)
  assert.equal(JSON.parse(result.stdout).quality.participation_complete, false)
  assert.equal(JSON.parse(result.stdout).quality.eligible, false)

  result = runUsage("analyze", "--baseline", "base-v1", "--candidate", "candidate-v1", "--min-pairs", "1")
  assert.notEqual(result.status, 0)
})

test("compares only paired cells and requires verified quality", () => {
  for (let index = 0; index < 5; index += 1) {
    assert.equal(recordVerified(event({ runID: `base-${index}`, recipe: "base-v1", taskID: `task-${index}`, tokens: 100, workerActions: 8 })).status, 0)
    assert.equal(recordVerified(event({ runID: `candidate-${index}`, recipe: "candidate-v1", taskID: `task-${index}`, tokens: 80, mainTokens: 10, workerActions: 9 })).status, 0)
  }
  let result = runUsage("analyze", "--baseline", "base-v1", "--candidate", "candidate-v1", "--min-pairs", "5")
  assert.equal(result.status, 0)
  let analysis = JSON.parse(result.stdout)
  assert.equal(analysis.verdict, "eligible-to-promote")
  assert.equal(analysis.cells[0].matched_pairs, 5)
  assert.equal(analysis.cells[0].candidate.median_tokens, 80)
  assert.ok(analysis.cells[0].candidate.worker_execution_share > analysis.cells[0].baseline.worker_execution_share)

  assert.equal(recordVerified(event({ runID: "candidate-fail", recipe: "candidate-v1", taskID: "task-0", tokens: 70, pass: false })).status, 0)
  result = runUsage("analyze", "--baseline", "base-v1", "--candidate", "candidate-v1", "--min-pairs", "5")
  analysis = JSON.parse(result.stdout)
  assert.equal(analysis.verdict, "revise-or-revert")
})

test("promotes only one mutable playbook field with eligible evidence", () => {
  const promotionState = mkdtempSync(join(tmpdir(), "aw-promotion-"))
  const playbookPath = join(promotionState, "playbook.json")
  const candidatePath = join(promotionState, "candidate.json")
  const current = {
    schema_version: 4,
    version: "base-v1",
    frozen: { evaluator: "quality-v1", telemetry: "run-v4", safety: "aw-v2", worker_contract: "worker-v1", teacher_contract: "teacher-v1", teacher_default: "opus-5.5", teacher_max_asks: 3, teacher_max_turns: 5 },
    defaults: { recipe_id: "base-v1", prompt_profile_id: "codex-haiku-worker-v1", context_budget: 1600, worker_step_budget: 8, teacher_after_failed_hypotheses: 2 },
    cells: {},
  }
  for (let index = 0; index < 5; index += 1) {
    assert.equal(recordVerifiedAt(promotionState, event({ runID: `promotion-base-${index}`, recipe: "base-v1", variant: "base-v1", taskID: `promotion-task-${index}`, tokens: 100 })).status, 0)
    assert.equal(recordVerifiedAt(promotionState, event({ runID: `promotion-candidate-${index}`, recipe: "base-v1", variant: "candidate-v1", taskID: `promotion-task-${index}`, tokens: 80, mainTokens: 10, workerActions: 9 })).status, 0)
  }
  writeFileSync(playbookPath, JSON.stringify(current))
  writeFileSync(candidatePath, JSON.stringify({ ...current, version: "candidate-v1", defaults: { ...current.defaults, context_budget: 1200 } }))

  let result = spawnSync(process.execPath, [researchScript, "promote", "--playbook", playbookPath, "--candidate", candidatePath], { env: { ...process.env, AW_STATE_DIR: promotionState }, encoding: "utf8" })
  assert.equal(result.status, 0)
  assert.equal(JSON.parse(readFileSync(playbookPath, "utf8")).defaults.context_budget, 1200)

  const promoted = JSON.parse(readFileSync(playbookPath, "utf8"))
  writeFileSync(candidatePath, JSON.stringify({ ...promoted, version: "evil-v1", evil: { context_budget: 1 } }))
  result = spawnSync(process.execPath, [researchScript, "promote", "--playbook", playbookPath, "--candidate", candidatePath], { env: { ...process.env, AW_STATE_DIR: promotionState }, encoding: "utf8" })
  assert.notEqual(result.status, 0)

  const unsafe = { ...promoted, version: "unsafe-v1", frozen: { ...promoted.frozen, evaluator: "quality-v2" } }
  writeFileSync(candidatePath, JSON.stringify(unsafe))
  result = spawnSync(process.execPath, [researchScript, "promote", "--playbook", playbookPath, "--candidate", candidatePath], { env: { ...process.env, AW_STATE_DIR: promotionState }, encoding: "utf8" })
  assert.notEqual(result.status, 0)
})

test("promotes only a registered immutable prompt profile", () => {
  const profileState = mkdtempSync(join(tmpdir(), "aw-profile-promotion-"))
  const playbookPath = join(profileState, "playbook.json")
  const candidatePath = join(profileState, "candidate.json")
  const profilesPath = join(profileState, "profiles.json")
  const current = {
    schema_version: 4,
    version: "base-v2",
    frozen: { evaluator: "quality-v1", telemetry: "run-v4", safety: "aw-v2", worker_contract: "worker-v1", teacher_contract: "teacher-v1", teacher_default: "opus-5.5", teacher_max_asks: 3, teacher_max_turns: 5 },
    defaults: { recipe_id: "base-v1", prompt_profile_id: "model-bound-v1", context_budget: 1600, worker_step_budget: 8, teacher_after_failed_hypotheses: 2 },
    cells: {},
  }
  for (let index = 0; index < 5; index += 1) {
    assert.equal(recordVerifiedAt(profileState, event({ runID: `profile-base-${index}`, recipe: "base-v1", variant: "base-v2", taskID: `profile-task-${index}`, profile: "model-bound-v1", tokens: 100 })).status, 0)
    assert.equal(recordVerifiedAt(profileState, event({ runID: `profile-candidate-${index}`, recipe: "base-v1", variant: "profile-v1", taskID: `profile-task-${index}`, profile: "mimo-tight-v1", tokens: 80, mainTokens: 10, workerActions: 9 })).status, 0)
  }
  writeFileSync(profilesPath, JSON.stringify({
    schema_version: 1,
    prompt_profiles: {
      "model-bound-v1": { overlays: {} },
      "mimo-tight-v1": { overlays: { "codex-haiku-worker-v1": "prompts/experiments/mimo-tight-v1.md" } },
    },
  }))
  writeFileSync(playbookPath, JSON.stringify(current))
  writeFileSync(candidatePath, JSON.stringify({ ...current, version: "profile-v1", defaults: { ...current.defaults, prompt_profile_id: "mimo-tight-v1" } }))

  let result = spawnSync(process.execPath, [researchScript, "promote", "--playbook", playbookPath, "--candidate", candidatePath, "--profiles", profilesPath], { env: { ...process.env, AW_STATE_DIR: profileState }, encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(readFileSync(playbookPath, "utf8")).defaults.prompt_profile_id, "mimo-tight-v1")

  const promoted = JSON.parse(readFileSync(playbookPath, "utf8"))
  writeFileSync(candidatePath, JSON.stringify({ ...promoted, version: "unknown-profile-v1", defaults: { ...promoted.defaults, prompt_profile_id: "missing-profile" } }))
  result = spawnSync(process.execPath, [researchScript, "promote", "--playbook", playbookPath, "--candidate", candidatePath, "--profiles", profilesPath], { env: { ...process.env, AW_STATE_DIR: profileState }, encoding: "utf8" })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /prompt profile not found/)
})

test("runs the weekly boundary once and records no-change", () => {
  let result = spawnSync(process.execPath, [researchScript, "due"], {
    env: { ...process.env, AW_STATE_DIR: state }, encoding: "utf8",
  })
  assert.equal(result.status, 0)
  assert.equal(JSON.parse(result.stdout).due, true)
  result = spawnSync(process.execPath, [researchScript, "close", "--result", "no-change"], {
    env: { ...process.env, AW_STATE_DIR: state }, encoding: "utf8",
  })
  assert.equal(result.status, 0)
  result = spawnSync(process.execPath, [researchScript, "due"], {
    env: { ...process.env, AW_STATE_DIR: state }, encoding: "utf8",
  })
  assert.equal(JSON.parse(result.stdout).due, false)
})

test("can promote one field into a new harness-specific playbook cell", () => {
  const cellState = mkdtempSync(join(tmpdir(), "aw-cell-promotion-"))
  const playbookPath = join(cellState, "cell-playbook.json")
  const candidatePath = join(cellState, "cell-candidate.json")
  const current = {
    schema_version: 4,
    version: "base-v1",
    frozen: { evaluator: "quality-v1", telemetry: "run-v4", safety: "aw-v2", worker_contract: "worker-v1", teacher_contract: "teacher-v1", teacher_default: "opus-5.5", teacher_max_asks: 3, teacher_max_turns: 5 },
    defaults: { recipe_id: "base-v1", prompt_profile_id: "codex-haiku-worker-v1", context_budget: 1600, worker_step_budget: 8, teacher_after_failed_hypotheses: 2 },
    cells: {},
  }
  const cellID = "codex|main:venice/mimo-2.6-flash>venice/mimo-2.6-flash@direct|worker:venice/claude-haiku-5-5>venice/claude-haiku-5-5@direct|teacher:no-teacher|implement|known-change|small|profile:codex-haiku-worker-v1"
  for (let index = 0; index < 5; index += 1) {
    assert.equal(recordVerifiedAt(cellState, event({ runID: `cell-base-${index}`, recipe: "base-v1", variant: "base-v1", taskID: `cell-task-${index}`, tokens: 100 })).status, 0)
    assert.equal(recordVerifiedAt(cellState, event({ runID: `cell-candidate-${index}`, recipe: "base-v1", variant: "cell-v1", taskID: `cell-task-${index}`, tokens: 80, mainTokens: 10, workerActions: 9 })).status, 0)
  }
  writeFileSync(playbookPath, JSON.stringify(current))
  writeFileSync(candidatePath, JSON.stringify({ ...current, version: "cell-v1", cells: { [cellID]: { context_budget: 1200 } } }))
  const result = spawnSync(process.execPath, [researchScript, "promote", "--playbook", playbookPath, "--candidate", candidatePath], { env: { ...process.env, AW_STATE_DIR: cellState }, encoding: "utf8" })
  assert.equal(result.status, 0)
  assert.equal(JSON.parse(readFileSync(playbookPath, "utf8")).cells[cellID].context_budget, 1200)
})

test("does not trust a supplied promotion verdict without local paired evidence", () => {
  const emptyState = mkdtempSync(join(tmpdir(), "aw-empty-evidence-"))
  const playbookPath = join(emptyState, "playbook.json")
  const candidatePath = join(emptyState, "candidate.json")
  const analysisPath = join(emptyState, "analysis.json")
  const current = {
    schema_version: 4,
    version: "base-v1",
    frozen: { evaluator: "quality-v1", telemetry: "run-v4", safety: "aw-v2", worker_contract: "worker-v1", teacher_contract: "teacher-v1", teacher_default: "opus-5.5", teacher_max_asks: 3, teacher_max_turns: 5 },
    defaults: { recipe_id: "base-v1", prompt_profile_id: "codex-haiku-worker-v1", context_budget: 1600, worker_step_budget: 8, teacher_after_failed_hypotheses: 2 },
    cells: {},
  }
  writeFileSync(playbookPath, JSON.stringify(current))
  writeFileSync(candidatePath, JSON.stringify({ ...current, version: "forged-v1", defaults: { ...current.defaults, context_budget: 1 } }))
  writeFileSync(analysisPath, JSON.stringify({ verdict: "eligible-to-promote", baseline: "base-v1", candidate: "forged-v1" }))
  const result = spawnSync(process.execPath, [researchScript, "promote", "--playbook", playbookPath, "--candidate", candidatePath, "--analysis", analysisPath], {
    env: { ...process.env, AW_STATE_DIR: emptyState }, encoding: "utf8",
  })
  assert.notEqual(result.status, 0)
})
