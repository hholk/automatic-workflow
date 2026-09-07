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
  assert.equal(value.prompt_profile_id, "model-bound-v1")
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
  assert.equal(sol.prompt_profile_id, "model-bound-v1")

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

test("applies one registered prompt experiment to the resolved native profile", () => {
  const registry = {
    schema_version: 1,
    worker_profiles: {
      "opencode|venice/z-ai-glm-5-3-flash": {
        id: "opencode-glm-worker-v1",
        core: "prompts/core/worker.md",
        contract: "contracts/worker.md",
        model_delta: "prompts/models/glm-5.3-flash.md",
      },
    },
    teacher_profiles: {},
    teacher_default: "gpt-5.6-sol",
    teacher_explicit_overrides: [],
    prompt_profiles: {
      "model-bound-v1": { overlays: {} },
      "glm-tight-v1": {
        overlays: { "opencode-glm-worker-v1": "playbooks/recipes/base-v1.md" },
      },
    },
  }
  const value = resolveSelection({
    host: "opencode",
    role: "worker",
    model: "venice/z-ai-glm-5-3-flash",
    route: "fix",
    promptProfileID: "glm-tight-v1",
  }, { registry })

  assert.equal(value.profile_id, "opencode-glm-worker-v1")
  assert.equal(value.prompt_profile_id, "glm-tight-v1")
  assert.equal(value.components[3], "playbooks/recipes/base-v1.md")
  assert.throws(() => resolveSelection({
    host: "opencode",
    role: "worker",
    model: "venice/z-ai-glm-5-3-flash",
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
    model: "venice/glm-5.3-flash",
    route: "invent",
  }), /unknown route/)
  assert.throws(() => resolveSelection({
    host: "codex",
    role: "worker",
    model: "venice/glm-5.3-flash",
    route: "fix",
  }, { playbook: { schema_version: 3 } }), /playbook schema_version 4/)
})
