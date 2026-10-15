import test from "node:test"
import assert from "node:assert/strict"
import { resolveSelection } from "./resolve-profile.mjs"

test("selects the OpenCode GPT-6 Luna default worker components", () => {
  const value = resolveSelection({
    host: "opencode",
    role: "worker",
    route: "fix",
    taskClass: "bug",
    complexity: "small",
  })

  assert.equal(value.model, "venice/openai-gpt-6-luna")
  assert.equal(value.profile_id, "opencode-gpt6-luna-worker-v1")
  assert.equal(value.prompt_profile_id, "model-bound-v1")
  assert.deepEqual(value.components, [
    "prompts/core/worker.md",
    "contracts/worker.md",
    "prompts/models/gpt-6-luna.md",
    "workflows/fix.md",
    "playbooks/recipes/bounded-v3.md",
  ])
  assert.equal(value.teacher, null)
})

test("explicit GLM model binds a separate OpenCode AW worker without changing MiMo", () => {
  const model = "venice/z-ai-glm-5-3-flash"
  for (const route of ["diagnose", "fix"]) {
    const value = resolveSelection({ host: "opencode", role: "worker", model, route })
    assert.equal(value.profile_id, "opencode-glm53-worker-v1")
    assert.equal(value.native_agent, route === "fix" ? "aw-glm53-worker" : "aw-glm53-review")
    assert.equal(value.model_provider, "venice")
    assert.ok(value.components.includes("prompts/models/glm-5.3-flash-v4.md"))
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

test("uses the GPT-6 Luna default for every worker host with actionable bounded budgets", () => {
  const defaults = {
    codex: "venice/openai-gpt-6-luna",
    opencode: "venice/openai-gpt-6-luna",
    "github-copilot": "venice/openai-gpt-6-luna",
  }
  for (const [host, model] of Object.entries(defaults)) {
    for (const route of ["explore", "diagnose", "fix", "implement", "review"]) {
      const value = resolveSelection({ host, role: "worker", route })
      assert.equal(value.model, model)
      assert.equal(value.model_provider, host === "codex" ? "codex-router" : model.split("/")[0])
      assert.equal(
        value.native_agent,
        host === "github-copilot"
          ? "aw-worker"
          : ["fix", "implement"].includes(route) ? "aw-worker" : "aw-reviewer",
      )
      assert.deepEqual(value.budget, { context_tokens: 1600, worker_steps: 125, failed_hypotheses: 3 })
      assert.equal(new Set(value.components).size, value.components.length)
    }
    if (host === "github-copilot") continue
    assert.throws(() => resolveSelection({
      host, role: "worker", route: "fix", model: host === "codex" ? "gpt-5.6-luna" : "openai-codex/gpt-5.6-luna",
    }), /retired worker profile/)
  }
})

test("pins computer-use work to Venice GPT-6 Luna on every worker host", () => {
  for (const host of ["codex", "opencode", "github-copilot"]) {
    const value = resolveSelection({ host, role: "worker", route: "computer-use" })
    assert.equal(value.model, "venice/openai-gpt-6-luna")
    assert.equal(value.native_agent, "aw-worker")
    assert.ok(value.components.includes("workflows/computer-use.md"))
    assert.throws(() => resolveSelection({
      host,
      role: "worker",
      route: "computer-use",
      model: "venice/z-ai-glm-5-3-flash",
    }), /requires worker model: venice\/openai-gpt-6-luna/)
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
  }, { playbook: { schema_version: 3 } }), /playbook schema_version 4/)
})
