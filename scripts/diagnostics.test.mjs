import test from "node:test"
import assert from "node:assert/strict"
import { detectWaste, redactExcerpt } from "./diagnostics.mjs"
import { normalizeRun } from "./evidence.mjs"

const actor = (model) => ({
  used: Boolean(model),
  requested_model: model,
  resolved_model: model,
  fallback_reason: null,
  model_source: model ? "native" : "unknown",
  token_source: model ? "native" : "unknown",
  tokens: model ? 10 : null,
})

const run = (overrides = {}) => ({
  schema_version: 4,
  kind: "run",
  run_id: "run-v4",
  host: "codex",
  harness_version: "1.0.0",
  route: "implement",
  task: { id: "task", class: "known-change", complexity: "small" },
  recipe_id: "base-v1",
  playbook_version: "base-v2",
  prompt: {
    profile_id: "codex-glm-worker-v1",
    component_ids: ["core/worker", "contracts/worker", "models/glm"],
    component_tokens: 80,
    loaded_files: ["prompts/core/worker.md"],
    duplicate_context_tokens: 0,
  },
  actors: {
    main: actor("gpt-5.6-sol"),
    worker: actor("venice/glm-5.3-flash"),
    teacher: actor(null),
  },
  work: { main_actions: 1, worker_actions: 2 },
  friction: { reroutes: 0, followups: 0, teacher_turns: 0, errors: 0 },
  timeline: [],
  gauntlet: [],
  teacher: [],
  waste_events: [],
  outcome: "VERIFIED",
  duration_ms: 100,
  ...overrides,
})

test("redacts bounded excerpts", () => {
  assert.equal(
    redactExcerpt("token=secret123 /Users/alice/repo failed"),
    "token=[REDACTED] [HOME]/repo failed",
  )
  assert.equal(redactExcerpt("owner@example.com 123e4567-e89b-12d3-a456-426614174000"), "[EMAIL] [ID]")
  assert.equal(redactExcerpt("x".repeat(700)).length, 500)
})

test("detects repeated work deterministically", () => {
  assert.deepEqual(detectWaste([
    { actor: "worker", phase: "explore", event: "read", signature: "a", revision: "1" },
    { actor: "worker", phase: "explore", event: "read", signature: "a", revision: "1" },
  ]).map((item) => item.kind), ["repeated_read"])
  assert.deepEqual(detectWaste([
    { actor: "main", phase: "verify", event: "verify", signature: "v", changed: false },
    { actor: "main", phase: "verify", event: "verify", signature: "v", changed: false },
  ]).map((item) => item.kind), ["duplicate_verification"])
})

test("v4 rejects old schema and protected raw content", () => {
  assert.throws(() => normalizeRun({ ...run(), schema_version: 3 }), /schema_version 4/)
  assert.throws(() => normalizeRun({ ...run(), prompt: "raw task text" }), /prompt must be an object/)
  assert.throws(() => normalizeRun({ ...run(), transcript: "raw transcript" }), /forbidden/)
  assert.throws(() => normalizeRun({ ...run(), timeline: [{ actor: "worker", event: "read", tool_arguments: "secret" }] }), /forbidden/)
})

test("v4 bounds diagnostic excerpts", () => {
  assert.throws(() => normalizeRun(run({ waste_events: [{ kind: "repeated_read", actor: "worker", phase: "explore", excerpts: ["a", "b", "c"] }] })), /at most two excerpts/)
  assert.throws(() => normalizeRun(run({ waste_events: Array.from({ length: 6 }, (_, index) => ({
    kind: "repeated_read",
    actor: "worker",
    phase: "explore",
    excerpts: [`${index}-a`, `${index}-b`],
  })) })), /at most ten excerpts/)

  const normalized = normalizeRun(run({ waste_events: [{
    kind: "repeated_read",
    actor: "worker",
    phase: "explore",
    excerpts: ["x".repeat(700)],
  }] }))
  assert.equal(normalized.waste_events[0].excerpts[0].length, 500)
})
