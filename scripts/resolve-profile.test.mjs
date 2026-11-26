import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { buildCellID } from "./evidence.mjs"
import { resolveSelection } from "./resolve-profile.mjs"
import { normalizeTaskClass, TASK_CLASSES } from "./run-identity.mjs"

test("selects the native OpenCode Terra low worker components", () => {
  const value = resolveSelection({
    host: "opencode",
    role: "worker",
    route: "fix",
    taskClass: "bug",
    complexity: "small",
  })

  assert.equal(value.model, "openai/gpt-6.1-terra")
  assert.equal(value.profile_id, "opencode-gpt61-terra-worker-v1")
  assert.equal(value.prompt_profile_id, "model-bound-v1")
  assert.deepEqual(value.components, [
    "prompts/core/worker.md",
    "contracts/worker.md",
    "prompts/models/gpt-6.1-terra.md",
    "workflows/fix.md",
    "playbooks/recipes/bounded-v4.md",
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

test("removed OpenCode family profiles are unknown", () => {
  assert.throws(() => resolveSelection({ host: "opencode", role: "worker", model: "venice/z-ai-glm-5-3-flash", route: "fix" }), /unknown worker profile/)
  for (const route of ["diagnose", "fix"]) {
    const value = resolveSelection({ host: "opencode", role: "worker", route })
    assert.equal(value.profile_id, "opencode-gpt61-terra-worker-v1")
    assert.equal(value.native_agent, route === "fix" ? "aw-worker" : "aw-reviewer")
    assert.equal(value.model_provider, "openai")
    assert.ok(value.components.includes("prompts/models/gpt-6.1-terra.md"))
  }
})

test("binds Astra as default teacher and Opus 5.5 as explicit override on each host", () => {
  for (const [host, model, provider] of [
    ["codex", "gpt-6.2-astra", "openai"],
    ["opencode", "openai/gpt-6.2-astra", "openai"],
  ]) {
    const value = resolveSelection({ host, role: "teacher", route: "teacher" })
    assert.equal(value.model, model)
    assert.equal(value.model_provider, provider)
    assert.equal(value.native_agent, "aw-teacher")
    assert.equal(value.profile_id, "astra-teacher-v1")
    assert.equal(value.prompt_profile_id, "model-bound-v1")
    assert.equal(value.components.length, 3)
  }
  for (const [host, model, provider] of [
    ["codex", "venice-responses/claude-opus-5-5", "codex-router"],
    ["opencode", "venice/claude-opus-5-5", "venice"],
  ]) {
    const value = resolveSelection({ host, role: "teacher", route: "teacher", model, explicitModelRequest: true })
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
    codex: "gpt-6.1-terra",
    opencode: "openai/gpt-6.1-terra",
  }
  for (const [host, model] of Object.entries(defaults)) {
    for (const route of ["explore", "diagnose", "fix", "implement", "review"]) {
      const value = resolveSelection({ host, role: "worker", route })
      assert.equal(value.model, model)
      assert.equal(value.model_provider, model.includes("/") ? model.split("/")[0] : "openai")
      assert.equal(
        value.native_agent,
        ["fix", "implement"].includes(route) ? "aw-worker" : "aw-reviewer",
      )
      assert.deepEqual(value.budget, { context_tokens: 3200, worker_steps: 125, failed_hypotheses: 2 })
      assert.equal(new Set(value.components).size, value.components.length)
    }
    assert.throws(() => resolveSelection({
      host, role: "worker", route: "fix", model: host === "codex" ? "gpt-5.6-luna" : "openai-codex/gpt-5.6-luna",
    }), /unknown worker profile/)
  }
})

test("pins computer-use work to the configured host model", () => {
  const models = { codex: "gpt-6.1-terra", opencode: "venice/deepseek-v4-1-flash-1017" }
  for (const [host, model] of Object.entries(models)) {
    const value = resolveSelection({ host, role: "worker", route: "computer-use" })
    assert.equal(value.model, model)
    assert.equal(value.native_agent, host === "opencode" ? "aw-deepseek-worker" : "aw-worker")
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
        binding: { model_provider: "venice", write_agent: "aw-worker", read_agent: "aw-reviewer" },
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
  }, { playbook: { schema_version: 3 } }), /playbook schema_version 4, 5 or 6/)
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

test("Terra medium binds all native and T3 code routes without a fallback", () => {
  for (const [host, providerHost] of [["codex", "codex"], ["opencode", "opencode"], ["t3", "codex"], ["t3", "opencode"]]) {
    for (const route of ["explore", "diagnose", "fix", "implement", "review"]) {
      const selected = resolveSelection({ host, providerHost, role: "worker", route })
      assert.equal(selected.model, providerHost === "codex" ? "gpt-6.1-terra" : "openai/gpt-6.1-terra")
      assert.equal(selected.reasoning_effort, "medium")
      assert.equal(selected.model_provider, "openai")
      assert.equal(selected.native_agent, ["fix", "implement"].includes(route) ? "aw-worker" : "aw-reviewer")
      assert.equal(Object.hasOwn(selected, "fallback_reason"), false)
    }
  }
})

test("removed Luna selections and automatic model substitutions are rejected", () => {
  for (const host of ["codex", "opencode"]) {
    for (const model of ["gpt-6-luna", "venice/openai-gpt-6-luna"]) {
      assert.throws(() => resolveSelection({ host, role: "worker", route: "fix", model }), /unknown worker profile/)
    }
    for (const primaryFailure of ["LUNA_ROUTE_UNAVAILABLE", "DEEPSEEK_SPEND_LIMIT", "AUTH_DENIED", "UNKNOWN"]) {
      assert.throws(() => resolveSelection({ host, role: "worker", route: "fix", primaryFailure }), /no fallback policy/)
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
  const actors = { main: actor("venice/deepseek-v4-1-flash-1017"), worker: actor("openai/gpt-6.1-terra"), teacher: { used: false } }
  assert.equal(resolveSelection({ ...input, actors }).model, actors.worker.resolved_model)
  for (const model_source of [undefined, "unknown"]) {
    assert.throws(() => resolveSelection({ ...input, actors: { ...actors, worker: { ...actors.worker, model_source } } }), /native or provider model_source/)
  }
  assert.throws(() => resolveSelection({ ...input, actors: { ...actors, worker: { ...actors.worker, requested_model: "venice/other", fallback_reason: "provider-error" } } }), /explicit fallback provenance/)
})

test("registry selections ignore inherited defaults, routes, profiles and overlays", () => {
  const fresh = () => JSON.parse(readFileSync(new URL("../prompts/profiles.json", import.meta.url), "utf8"))
  const input = { host: "codex", role: "worker", route: "fix" }
  let registry = fresh()
  registry.worker_defaults = Object.create(registry.worker_defaults)
  assert.throws(() => resolveSelection(input, { registry }), /missing default worker model/)
  registry = fresh()
  registry.worker_profiles = Object.create(registry.worker_profiles)
  assert.throws(() => resolveSelection(input, { registry }), /unknown worker profile/)
  registry = fresh()
  registry.prompt_profiles = Object.create(registry.prompt_profiles)
  assert.throws(() => resolveSelection(input, { registry }), /unknown prompt profile/)
  registry = fresh()
  registry.worker_route_models = Object.create({ fix: { codex: "not-registered" } })
  assert.equal(resolveSelection(input, { registry }).model, "gpt-6.1-terra")
  registry = fresh()
  registry.worker_route_models.fix = Object.create({ codex: "not-registered" })
  assert.equal(resolveSelection(input, { registry }).model, "gpt-6.1-terra")
  registry = fresh()
  registry.prompt_profiles["model-bound-v1"].overlays = Object.create({ "codex-gpt61-terra-worker-v1": "not-a-component" })
  assert.equal(resolveSelection(input, { registry }).model, "gpt-6.1-terra")
  registry = fresh()
  registry.teacher_bindings = Object.create(registry.teacher_bindings)
  assert.throws(() => resolveSelection({ host: "codex", role: "teacher", route: "teacher" }, { registry }), /unsupported teacher host/)
})


test("reports canonical classes without changing the stated task class", () => {
  assert.deepEqual(TASK_CLASSES, [
    "bugfix", "feature", "refactor", "diagnosis", "review", "research", "ui", "release", "ops", "docs", "architecture", "unknown",
  ])
  for (const value of TASK_CLASSES) assert.equal(normalizeTaskClass(value), value)
  const aliases = {
    bugfix: ["known-bug", "diagnosed-bug", "bug", "fix"],
    feature: ["known-change", "implement", "implementation"],
    diagnosis: ["unknown-bug", "debugging", "usage-diagnosis", "account-usage"],
    research: ["read-only-map", "explore"],
    ui: ["ui-ux", "frontend"],
    refactor: ["repo-cleanup"],
    architecture: ["technical-decision"],
  }
  for (const [canonical, values] of Object.entries(aliases)) {
    for (const value of values) assert.equal(normalizeTaskClass(value), canonical)
  }
  assert.equal(normalizeTaskClass(" Known_Bug "), "bugfix")
  for (const value of [undefined, null, 4, "toString", "Custom/Import"]) assert.equal(normalizeTaskClass(value), "unknown")
  const input = { host: "opencode", role: "worker", route: "fix", complexity: "small" }
  for (const [raw, canonical] of [["bug", "bugfix"], ["Custom/Import", "unknown"]]) {
    const selection = resolveSelection({ ...input, taskClass: raw })
    assert.equal(selection.task_class, raw)
    assert.equal(selection.canonical_task_class, canonical)
  }
  assert.equal(resolveSelection(input).canonical_task_class, "unknown")
})

test("recommends skills deterministically from route, class and explicit signals", () => {
  const input = { host: "opencode", role: "worker", route: "review", taskClass: "frontend" }
  const signals = ["retry", "typescript", "pr", "repeat-error", "repeat-hypothesis", "ui", "typescript", "other"]
  const selected = resolveSelection({ ...input, signals })
  assert.deepEqual(selected.recommended_hstack_skills.map(({ name }) => name), [
    "h-code-review", "design-taste-frontend", "typescript-best-practices", "pr", "correct",
    "principle-make-operations-idempotent", "principle-attack-the-premise",
  ])
  assert.deepEqual(selected.recommended_hstack_skills, resolveSelection({ ...input, signals: [...signals].reverse() }).recommended_hstack_skills)
  assert.deepEqual(selected.components, resolveSelection(input).components)
})
