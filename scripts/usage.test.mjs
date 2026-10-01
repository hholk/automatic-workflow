import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { compareRecipes, normalizeRun } from "./evidence.mjs"

const usageScript = new URL("./usage.mjs", import.meta.url).pathname

const run = ({ runID, recipe, taskID, host = "codex", taskClass = "known-change", tokens = 100, mainTokens = 20, requestedWorker = "worker", resolvedWorker = "worker", fallbackReason = null, profile = "worker-profile-v1", teacher = [], wasteEvents = [], mainActions = 2, workerActions = 8 }) => {
  const quality = {
    verify_id: "test",
    verify_exit_code: 0,
    semantic_success: true,
    scope_covered: 1,
    scope_total: 1,
    review_pass: true,
    forbidden_changes: 0,
    accepted_worker_actions: workerActions,
    parent_rework: 0,
  }
  return normalizeRun({
  schema_version: 4,
  kind: "run",
  run_id: runID,
  host,
  route: "implement",
  task: { id: taskID, class: taskClass, complexity: "small" },
  recipe_id: recipe,
  playbook_version: recipe,
  harness_version: "test",
  prompt: {
    profile_id: profile,
    component_ids: ["core/worker"],
    component_tokens: 10,
    loaded_files: ["prompts/core/worker.md"],
    duplicate_context_tokens: 0,
  },
  actors: {
    main: { used: true, requested_model: "main", resolved_model: "main", model_source: "native", token_source: "native", tokens: mainTokens },
    worker: { used: true, requested_model: requestedWorker, resolved_model: resolvedWorker, fallback_reason: fallbackReason, model_source: "native", token_source: "native", tokens: tokens - mainTokens },
    teacher: teacher.length
      ? { used: true, requested_model: "venice/opus-5.5", resolved_model: "venice/opus-5.5", model_source: "native", token_source: "native", tokens: 0 }
      : { used: false, requested_model: null, resolved_model: null, model_source: "unknown", token_source: "unknown", tokens: null },
  },
  quality,
  work: { main_actions: mainActions, worker_actions: workerActions, accepted_worker_actions: workerActions, parent_rework: 0 },
  friction: { reroutes: 0, followups: 0, teacher_turns: teacher.length, errors: 0 },
  timeline: [],
  gauntlet: [],
  teacher,
  waste_events: wasteEvents,
  outcome: "VERIFIED",
  duration_ms: 100,
  }, quality)
}

test("does not pair different tasks or harness cells", () => {
  const runs = [
    run({ runID: "base", recipe: "base", taskID: "task-a" }),
    run({ runID: "candidate", recipe: "candidate", taskID: "task-b" }),
    run({ runID: "candidate-other-host", recipe: "candidate", taskID: "task-a", host: "opencode" }),
  ]
  const result = compareRecipes(runs, "base", "candidate", 5)
  assert.equal(result.verdict, "insufficient-data")
  assert.equal(result.cells.length, 1)
  assert.equal(result.cells[0].matched_pairs, 0)
})

test("keeps task classes in separate evidence cells", () => {
  const runs = []
  for (let index = 0; index < 5; index += 1) {
    runs.push(run({ runID: `base-small-${index}`, recipe: "base", taskID: `task-${index}`, taskClass: "known-change" }))
    runs.push(run({ runID: `candidate-small-${index}`, recipe: "candidate", taskID: `task-${index}`, taskClass: "known-change", tokens: 90, mainTokens: 10 }))
    runs.push(run({ runID: `base-review-${index}`, recipe: "base", taskID: `review-${index}`, taskClass: "review" }))
    runs.push(run({ runID: `candidate-review-${index}`, recipe: "candidate", taskID: `review-${index}`, taskClass: "review", tokens: 90, mainTokens: 10 }))
  }
  const result = compareRecipes(runs, "base", "candidate", 5)
  assert.equal(result.verdict, "eligible-to-promote")
  assert.equal(result.cells.length, 2)
  assert.ok(result.cells.every((cell) => cell.matched_pairs === 5))
})

test("keeps direct Luna and MiMo-to-Luna fallback in separate evidence cells", () => {
  const direct = run({ runID: "direct", recipe: "base", taskID: "task", requestedWorker: "luna", resolvedWorker: "luna" })
  const fallback = run({ runID: "fallback", recipe: "candidate", taskID: "task", requestedWorker: "mimo", resolvedWorker: "luna", fallbackReason: "primary-http-402" })
  assert.notEqual(direct.cell_id, fallback.cell_id)
  assert.match(direct.cell_id, /worker:luna>luna@direct/)
  assert.match(fallback.cell_id, /worker:mimo>luna@primary-http-402/)
})

test("returns no-change when a candidate has no strict efficiency gain", () => {
  const runs = []
  for (let index = 0; index < 5; index += 1) {
    runs.push(run({ runID: `base-${index}`, recipe: "base", taskID: `task-${index}` }))
    runs.push(run({ runID: `same-${index}`, recipe: "same", taskID: `task-${index}` }))
  }
  assert.equal(compareRecipes(runs, "base", "same", 5).verdict, "no-change")
})

test("rejects token improvement when teacher reliability regresses", () => {
  const runs = []
  for (let index = 0; index < 5; index += 1) {
    const goodTeacher = [
      { turn: 1, response_type: "ASK", question_type: "inspect", ask_id: `a-${index}`, evidence_received: true, human_redirect: false },
      { turn: 2, response_type: "FINAL", actionable: true, post_teacher_green: true },
    ]
    const badTeacher = [
      { turn: 1, response_type: "ASK", question_type: "inspect", ask_id: `b-${index}`, evidence_received: true, human_redirect: true },
      { turn: 2, response_type: "FINAL", actionable: true, post_teacher_green: true },
    ]
    runs.push(run({ runID: `base-teacher-${index}`, recipe: "base", taskID: `teacher-task-${index}`, teacher: goodTeacher }))
    runs.push(run({ runID: `candidate-teacher-${index}`, recipe: "candidate", taskID: `teacher-task-${index}`, tokens: 80, mainTokens: 10, teacher: badTeacher }))
  }
  assert.equal(compareRecipes(runs, "base", "candidate", 5).verdict, "revise-or-revert")
})

test("queries waste causes and teacher efficiency by profile", () => {
  const stateDir = mkdtempSync(join(tmpdir(), "aw-usage-query-"))
  const item = run({
    runID: "teacher-run",
    recipe: "base",
    taskID: "teacher-task",
    profile: "opus-teacher-v1",
    teacher: [
      { turn: 1, response_type: "ASK", question_type: "inspect", ask_id: "a1", evidence_received: true, decision_changed: false },
      { turn: 2, response_type: "FINAL", actionable: true, post_teacher_green: true, decision_changed: true },
    ],
    wasteEvents: [{ kind: "repeated_read", actor: "worker", phase: "inspect", estimated_wasted_tokens: 12, excerpts: [] }],
  })
  writeFileSync(join(stateDir, "runs.jsonl"), `${JSON.stringify(item)}\n`)
  const invoke = (...args) => spawnSync(process.execPath, [usageScript, ...args], {
    env: { ...process.env, AW_STATE_DIR: stateDir },
    encoding: "utf8",
  })

  let result = invoke("waste", "--kind", "repeated_read")
  assert.equal(result.status, 0)
  let parsed = JSON.parse(result.stdout)
  assert.equal(parsed.groups[0].estimated_wasted_tokens, 12)
  assert.equal(parsed.groups[0].prompt_profile_id, "opus-teacher-v1")

  result = invoke("teacher", "--profile", "opus-teacher-v1")
  assert.equal(result.status, 0)
  parsed = JSON.parse(result.stdout)
  assert.equal(parsed.ask_count, 1)
  assert.equal(parsed.answer_rate, 1)
  assert.equal(parsed.actionable_final_rate, 1)
  assert.equal(parsed.post_teacher_green_rate, 1)
  assert.equal(parsed.human_redirects, 0)
})


test("worker shares are diagnostic, not a promotion objective", () => {
  const runs = []
  for (let index = 0; index < 5; index += 1) {
    const taskID = `share-${index}`
    runs.push(run({ runID: `base-${index}`, recipe: "base", taskID }))
    runs.push(run({ runID: `cheaper-${index}`, recipe: "cheaper", taskID, tokens: 80, mainTokens: 30, workerActions: 2, mainActions: 8 }))
    runs.push(run({ runID: `share-only-${index}`, recipe: "share-only", taskID, mainTokens: 10, workerActions: 9, mainActions: 1 }))
  }
  assert.equal(compareRecipes(runs, "base", "cheaper", 5).verdict, "eligible-to-promote")
  assert.equal(compareRecipes(runs, "base", "share-only", 5).verdict, "no-change")
})
