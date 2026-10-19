import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { buildCellID } from "./evidence.mjs"
import { resolveSelection } from "./resolve-profile.mjs"

test("selects the native OpenCode DeepSeek 1017 worker components", () => {
  const value = resolveSelection({
    host: "opencode",
    role: "worker",
    route: "fix",
    taskClass: "bug",
    complexity: "small",
  })

  assert.equal(value.model, "venice/deepseek-v4-1-flash-1017")
  assert.equal(value.profile_id, "opencode-deepseek-1017-worker-v1")
  assert.equal(value.prompt_profile_id, "model-bound-v1")
  assert.deepEqual(value.components, [
    "prompts/core/worker.md",
    "contracts/worker.md",
    "prompts/models/deepseek-1017.md",
    "workflows/fix.md",
    "playbooks/recipes/bounded-v3.md",
  ])
  assert.equal(value.teacher, null)
})

test("Copilot DeepSeek binding is unsupported without native host availability", () => {
  for (const route of ["explore", "diagnose", "fix", "implement", "review", "computer-use"]) {
    for (const model of [undefined, "venice/deepseek-v4-1-flash-1017"]) {
      assert.throws(() => resolveSelection({ host: "github-copilot", role: "worker", route, model }),
        /BLOCKED_ENVIRONMENT: unsupported worker profile: github-copilot\|venice\/deepseek-v4-1-flash-1017/)
    }
  }
})

test("replaced OpenCode family profiles stay retired instead of silently switching models", () => {
  for (const model of ["venice/z-ai-glm-5-3-flash", "venice/openai-gpt-6-luna"]) {
    assert.throws(() => resolveSelection({ host: "opencode", role: "worker", model, route: "fix" }), /retired worker profile/)
  }
  for (const route of ["diagnose", "fix"]) {
    const value = resolveSelection({ host: "opencode", role: "worker", route })
    assert.equal(value.profile_id, "opencode-deepseek-1017-worker-v1")
    assert.equal(value.native_agent, route === "fix" ? "aw-worker" : "aw-reviewer")
    assert.equal(value.model_provider, "venice")
    assert.ok(value.components.includes("prompts/models/deepseek-1017.md"))
  }
})

test("binds Opus 5.5 to the correct native provider on each host", () => {
  for (const [host, model, provider] of [
    ["codex", "venice/claude-opus-5-5", "codex-router"],
    ["opencode", "venice/claude-opus-5-5", "venice"],
  ]) {
    const value = resolveSelection({ host, role: "teacher", route: "teacher" })
    assert.equal(value.model, model)
    assert.equal(value.model_provider, provider)
    assert.equal(value.native_agent, "aw-teacher")
    assert.equal(value.profile_id, "opus-teacher-v1")
    assert.equal(value.prompt_profile_id, "model-bound-v1")
    assert.equal(value.components.length, 3)
  }
  assert.throws(() => resolveSelection({
    host: "codex", role: "teacher", route: "teacher", model: "unknown-teacher",
    explicitModelRequest: true,
  }), /unsupported teacher model/)
})

test("uses each host registry binding with actionable bounded budgets", () => {
  const defaults = {
    codex: "venice-responses/deepseek-v4-1-flash-1017",
    opencode: "venice/deepseek-v4-1-flash-1017",
  }
  for (const [host, model] of Object.entries(defaults)) {
    for (const route of ["explore", "diagnose", "fix", "implement", "review"]) {
      const value = resolveSelection({ host, role: "worker", route })
      assert.equal(value.model, model)
      assert.equal(value.model_provider, host === "codex" ? "codex-router" : model.split("/")[0])
      assert.equal(
        value.native_agent,
        ["fix", "implement"].includes(route) ? "aw-worker" : "aw-reviewer",
      )
      assert.deepEqual(value.budget, { context_tokens: 1600, worker_steps: 125, failed_hypotheses: 2 })
      assert.equal(new Set(value.components).size, value.components.length)
    }
    assert.throws(() => resolveSelection({
      host, role: "worker", route: "fix", model: host === "codex" ? "gpt-5.6-luna" : "openai-codex/gpt-5.6-luna",
    }), /retired worker profile/)
  }
})

test("pins computer-use work to the configured host model", () => {
  const models = { codex: "venice-responses/deepseek-v4-1-flash-1017", opencode: "venice/deepseek-v4-1-flash-1017" }
  for (const [host, model] of Object.entries(models)) {
    const value = resolveSelection({ host, role: "worker", route: "computer-use" })
    assert.equal(value.model, model)
    assert.equal(value.native_agent, "aw-worker")
    assert.ok(value.components.includes("workflows/computer-use.md"))
    assert.throws(() => resolveSelection({
      host,
      role: "worker",
      route: "computer-use",
      model: "venice/z-ai-glm-5-3-flash",
    }), /requires worker model:/)
  }
})

test("applies one registered prompt experiment to the resolved native profile", () => {
  const registry = {
    schema_version: 1,
    worker_defaults: {
      opencode: "venice/xiaomi-mimo-v2-6-flash",
    },
    worker_profiles: {
      "opencode|venice/xiaomi-mimo-v2-6-flash": {
        id: "opencode-mimo-worker-v1",
        core: "prompts/core/worker.md",
        contract: "contracts/worker.md",
        model_delta: "prompts/models/mimo-v2.6-flash.md",
      },
    },
    teacher_profiles: {},
    teacher_default: "opus-5.5",
    teacher_explicit_overrides: [],
    prompt_profiles: {
      "model-bound-v1": { overlays: {} },
      "mimo-tight-v1": {
        overlays: { "opencode-mimo-worker-v1": "playbooks/recipes/base-v1.md" },
      },
    },
  }
  const value = resolveSelection({
    host: "opencode",
    role: "worker",
    route: "fix",
    promptProfileID: "mimo-tight-v1",
  }, { registry })

  assert.equal(value.profile_id, "opencode-mimo-worker-v1")
  assert.equal(value.prompt_profile_id, "mimo-tight-v1")
  assert.equal(value.components[3], "playbooks/recipes/base-v1.md")
  assert.throws(() => resolveSelection({
    host: "opencode",
    role: "worker",
    route: "fix",
    promptProfileID: "missing-v1",
  }, { registry }), /unknown prompt profile/)
})

test("rejects unknown models, routes, and old playbooks", () => {
  assert.throws(() => resolveSelection({
    host: "opencode",
    role: "worker",
    model: "venice/unknown",
    route: "fix",
  }), /unknown worker profile/)
  assert.throws(() => resolveSelection({
    host: "codex",
    role: "worker",
    route: "invent",
  }), /unknown route/)
  assert.throws(() => resolveSelection({
    host: "codex",
    role: "worker",
    route: "fix",
  }, { playbook: { schema_version: 3 } }), /playbook schema_version 4 or 5/)
})

test("resolves cell budgets and recipe through the effective policy", () => {
  const playbook = JSON.parse(readFileSync(new URL("../playbooks/current.json", import.meta.url), "utf8"))
  playbook.cells["opencode|bug|small"] = { context_budget: 900, worker_step_budget: 17, recipe_id: "base-v1" }
  const value = resolveSelection({ host: "opencode", role: "worker", route: "fix", taskClass: "bug", complexity: "small" }, { playbook })
  assert.deepEqual(value.budget, { context_tokens: 900, worker_steps: 17, failed_hypotheses: playbook.defaults.teacher_after_failed_hypotheses })
  assert.equal(value.recipe_id, "base-v1")
  assert.ok(value.components.includes("playbooks/recipes/base-v1.md"))
  assert.equal(value.effective_policy.policy_cell_id, "opencode|bug|small")
})

test("T3 selects an explicit Codex or OpenCode provider delegate without claiming discovery", () => {
  for (const providerHost of ["codex", "opencode"]) {
    const value = resolveSelection({ host: "t3", providerHost, role: "worker", route: "fix" })
    assert.equal(value.host, "t3")
    assert.equal(value.native_agent, "aw-worker")
    assert.equal(value.effective_policy.capabilities.profile_host, providerHost)
    assert.equal(value.effective_policy.capabilities.dispatch, "provider-delegate")
    assert.equal(value.effective_policy.capabilities.teacher_text_snapshot, false)
  }
  assert.throws(() => resolveSelection({ host: "t3", role: "worker", route: "fix" }), /requires providerHost/)
})

test("teacher inspection is additive and never selects a tool-enabled agent", () => {
  const ordinary = resolveSelection({ host: "codex", role: "teacher", route: "teacher" })
  const requested = resolveSelection({ host: "codex", role: "teacher", route: "teacher", inspectionRequest: {} })
  assert.equal(requested.native_agent, ordinary.native_agent)
  assert.equal(requested.model, ordinary.model)
  assert.equal(requested.model_provider, ordinary.model_provider)
  assert.deepEqual(requested.teacher.inspection, { status: "INELIGIBLE", reason: "INVALID_INSPECTION_CONTEXT", fallback: "WORKER_EVIDENCE", capability: "teacher-text-snapshot-v1" })
  assert.equal(Object.hasOwn(ordinary.teacher, "inspection"), false)
  assert.ok(requested.components.includes("references/teacher-inspection.md"))
})

test("rejects a teacher binding to a different registered profile", () => {
  const registry = JSON.parse(readFileSync(new URL("../prompts/profiles.json", import.meta.url), "utf8"))
  registry.teacher_bindings.codex.profile_id = "missing-teacher"
  assert.throws(() => resolveSelection({ host: "codex", role: "teacher", route: "teacher" }, { registry }), /inconsistent teacher binding/)
})

test("configured worker and teacher bindings are explicitly unverified on every host", () => {
  for (const [host, providerHost] of [["codex"], ["opencode"], ["t3", "codex"], ["t3", "opencode"]]) {
    for (const role of ["worker", "teacher"]) {
      const selected = resolveSelection({ host, providerHost, role, route: role === "worker" ? "fix" : "teacher" })
      assert.equal(selected.model_capability.status, "unverified")
      assert.equal(selected.model_capability.reason, "CONFIGURATION_ONLY")
      assert.equal(selected.model_capability.model, selected.model)
      assert.equal(selected.frontend_host, host)
      assert.equal(selected.provider_host, providerHost || host)
    }
  }
})

test("configured models never activate a provenance cell without supplied actor evidence", () => {
  const registry = JSON.parse(readFileSync(new URL("../prompts/profiles.json", import.meta.url), "utf8"))
  const playbook = JSON.parse(readFileSync(new URL("../playbooks/current.json", import.meta.url), "utf8"))
  const actor = (model) => ({ used: true, requested_model: model, resolved_model: model, model_source: "provider", fallback_reason: null })
  const actors = { main: actor(registry.main_default), worker: actor(registry.worker_defaults.opencode), teacher: { used: false } }
  const input = { host: "opencode", role: "worker", route: "fix", taskClass: "bug", complexity: "small" }
  const cellID = buildCellID({ ...input, actors, task: { class: "bug", complexity: "small" }, promptProfileID: playbook.defaults.prompt_profile_id })
  playbook.cells[cellID] = { context_budget: 500 }
  assert.equal(resolveSelection(input, { playbook }).budget.context_tokens, playbook.defaults.context_budget)
  assert.equal(resolveSelection({ ...input, actors }, { playbook }).budget.context_tokens, 500)
})

test("eligible inspection stays unsupported on both native teacher hosts and T3 delegates", () => {
  const scope = { task_id: "task", objective_revision: "rev1", blocker_id: "blocker", state_id: "state" }
  const request = { ...scope, unresolved: true, last_progress_sequence: 0,
    attempts: [1, 2].map((sequence) => ({ ...scope, attempt_id: `attempt${sequence}`, sequence,
      status: "completed", outcome: "no_progress", failure_kind: "technical", main_verified: true,
      hypothesis: `hypothesis${sequence}`, action_ref: `action${sequence}`, result_ref: `result${sequence}`,
      before_state: "state", after_state: "state" })),
    main_confirmation: { ...scope, evidence_ref: "main-check", attempt_ids: ["attempt1", "attempt2"] },
  }
  for (const input of [{ host: "codex" }, { host: "opencode" }, { host: "t3", providerHost: "codex" }, { host: "t3", providerHost: "opencode" }]) {
    const value = resolveSelection({ ...input, role: "teacher", route: "teacher", inspectionRequest: request })
    assert.equal(value.teacher.inspection.status, "UNSUPPORTED_HOST")
    assert.equal(value.teacher.inspection.reason, "UNSUPPORTED_HOST")
    assert.equal(value.teacher.inspection.fallback, "WORKER_EVIDENCE")
    assert.equal(value.native_agent, "aw-teacher")
    assert.equal(value.effective_policy.capabilities.teacher_text_snapshot, false)
  }
})

test("programmatic resolver rejects unproved actor metadata instead of converting intent to proof", () => {
  const input = { host: "opencode", role: "worker", route: "fix" }
  const actor = (model) => ({ used: true, requested_model: model, resolved_model: model, model_source: "native" })
  const actors = { main: actor("venice/deepseek-v4-1-flash-1017"), worker: actor("venice/deepseek-v4-1-flash-1017"), teacher: { used: false } }
  assert.equal(resolveSelection({ ...input, actors }).model, actors.worker.resolved_model)
  for (const model_source of [undefined, "unknown"]) {
    assert.throws(() => resolveSelection({ ...input, actors: { ...actors, worker: { ...actors.worker, model_source } } }), /native or provider model_source/)
  }
  assert.throws(() => resolveSelection({ ...input, actors: { ...actors, worker: { ...actors.worker, requested_model: "venice/other", fallback_reason: "provider-error" } } }), /explicit fallback provenance/)
})
