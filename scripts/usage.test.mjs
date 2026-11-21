import test from "node:test"
import assert from "node:assert/strict"
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { appendAttestation, appendRun, compareRecipes, normalizeRun, readRuns } from "./evidence.mjs"
import { operatingReport } from "./operating-report.mjs"

const usageScript = new URL("./usage.mjs", import.meta.url).pathname

const run = ({ runID, recipe, taskID, host = "codex", taskClass = "known-change", tokens = 100, mainTokens = 20, requestedWorker = "worker", resolvedWorker = "worker", fallbackReason = null, profile = "worker-profile-v1", teacher = [], wasteEvents = [], mainActions = 2, workerActions = 8 }) => {
  const quality = {
    policy_provenance_complete: true,
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
  task: { id: taskID, snapshot_id: "fixture-rev-1", check_version: "fixture-check-v1", class: taskClass, complexity: "small" },
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

test("diagnostic commands report invalid records without losing valid runs or exposing content", (t) => {
  const stateDir = mkdtempSync(join(tmpdir(), "aw-invalid-records-"))
  t.after(() => rmSync(stateDir, { recursive: true, force: true }))
  const valid = run({ runID: "valid", recipe: "base", taskID: "fixture" })
  writeFileSync(join(stateDir, "runs.jsonl"), [
    JSON.stringify({ ...valid, prompt: { ...valid.prompt, profile_id: null } }),
    "{sensitive-fixture-content",
    JSON.stringify({ ...valid, outcome: "sensitive-fixture-content" }),
    JSON.stringify(valid),
  ].join("\n") + "\n")
  const invoke = (...args) => spawnSync(process.execPath, [usageScript, ...args], {
    encoding: "utf8", env: { ...process.env, AW_STATE_DIR: stateDir },
  })
  for (const command of ["summary", "waste", "teacher"]) {
    const result = invoke(command)
    assert.equal(result.status, 0, result.stderr)
    const output = JSON.parse(result.stdout)
    assert.equal(output.excluded_records, 3)
    assert.equal(output.runs, command === "teacher" ? 0 : 1)
    assert.match(result.stderr, /excluded 3 invalid records/)
    assert.match(result.stderr, /runs\.jsonl:1: invalid-run/)
    assert.match(result.stderr, /runs\.jsonl:2: invalid-json/)
    assert.doesNotMatch(result.stdout + result.stderr, /sensitive-fixture-content/)
  }
  assert.throws(() => readRuns(stateDir), /runs\.jsonl:2: invalid-json/)
  const analysis = invoke("analyze", "--baseline", "base", "--candidate", "next")
  assert.equal(analysis.status, 1)
  assert.equal(analysis.stdout, "")
  assert.doesNotMatch(analysis.stderr, /sensitive-fixture-content/)
  writeFileSync(join(stateDir, "runs.jsonl"), JSON.stringify({ ...valid, prompt: null }) + "\n")
  assert.throws(() => readRuns(stateDir), /runs\.jsonl:1: invalid-run/)
  writeFileSync(join(stateDir, "runs.jsonl"), JSON.stringify(valid) + "\n")
  writeFileSync(join(stateDir, "attestations.jsonl"), "{sensitive-fixture-content\n")
  const inspection = invoke("summary")
  assert.equal(inspection.status, 0, inspection.stderr)
  assert.equal(JSON.parse(inspection.stdout).excluded_records, 1)
  assert.equal(JSON.parse(inspection.stdout).eligible, 0)
  assert.match(inspection.stderr, /attestations\.jsonl:1: invalid-json/)
  assert.doesNotMatch(inspection.stderr, /sensitive-fixture-content/)
  assert.throws(() => readRuns(stateDir), /attestations\.jsonl:1: invalid-json/)
})

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

test("pairs separate run IDs only for the same task, snapshot and check version", () => {
  const base = run({ runID: "separate-base", recipe: "base", taskID: "fixture" })
  const candidate = run({ runID: "separate-next", recipe: "candidate", taskID: "fixture" })
  assert.equal(compareRecipes([base, candidate], "base", "candidate").cells[0].matched_pairs, 1)
  for (const changed of [{ snapshot_id: "fixture-rev-2" }, { check_version: "fixture-check-v2" }, { snapshot_id: null }, { check_version: null }]) {
    const next = { ...candidate, task: { ...candidate.task, ...changed } }
    assert.equal(compareRecipes([base, next], "base", "candidate").cells[0].matched_pairs, 0)
    const normalized = normalizeRun(next, { ...candidate.quality, task_provenance_complete: true })
    if (Object.values(changed).includes(null)) assert.equal(normalized.quality.eligible, false)
  }
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

test("host attestations update outcomes and carry bounded, sanitized skill observations", (t) => {
  const stateDir = mkdtempSync(join(tmpdir(), "aw-attest-hints-"))
  t.after(() => rmSync(stateDir, { recursive: true, force: true }))
  const invoke = (...args) => spawnSync(process.execPath, [usageScript, ...args], {
    encoding: "utf8", env: { ...process.env, AW_STATE_DIR: stateDir },
  })
  const item = run({ runID: "hint-run", recipe: "acceptance-routing-v7", taskID: "task" })
  const initial = appendRun({ ...item, outcome: "PARTIAL_WITH_UNKNOWN",
    skill_hints: [{ skill: " initial-hint ", first_pass: null, rework: true, extra: "discarded text" }] }, stateDir)
  assert.deepEqual(initial.skill_hints, [{ skill: "initial-hint", first_pass: null, rework: true }])
  assert.equal(readRuns(stateDir)[0].outcome, "PARTIAL_WITH_UNKNOWN")
  assert.throws(() => appendRun({ ...item, skill_hints: Array(17).fill(initial.skill_hints[0]) }, stateDir), /at most 16/)
  assert.throws(() => appendRun({ ...item, skill_hints: [{ skill: "raw prompt text" }] }, stateDir), /skill identifier/)
  assert.throws(() => appendAttestation({ run_id: item.run_id, verify_id: "test", skill_hints: [{ skill: "hstack", first_pass: "yes" }] }, stateDir), /must be boolean/)
  assert.throws(() => appendAttestation({ run_id: item.run_id, verify_id: "test", outcome: "invented" }, stateDir), /invalid outcome/)

  const flags = ["attest", "--run-id", item.run_id, "--verify-id", "test", "--verify-exit-code", "0", "--semantic-success", "true",
    "--scope-covered", "1", "--scope-total", "1", "--review-pass", "true", "--forbidden-changes", "0",
    "--accepted-worker-actions", "1", "--parent-rework", "0"]
  const rejected = invoke(...flags, "--skill-hint", "hstack:maybe:no")
  assert.equal(rejected.status, 1)
  assert.match(rejected.stderr, /--skill-hint requires/)
  const attested = invoke(...flags, "--outcome", "VERIFIED", "--skill-hint", "principle-make-operations-idempotent:yes:no",
    "--skill-hint", "hstack:review:unknown:yes")
  assert.equal(attested.status, 0, attested.stderr)
  const expected = [{ skill: "principle-make-operations-idempotent", first_pass: true, rework: false },
    { skill: "hstack:review", first_pass: null, rework: true }]
  assert.deepEqual(JSON.parse(attested.stdout).skill_hints, expected)
  const [merged] = readRuns(stateDir)
  assert.deepEqual(merged.skill_hints, expected)
  assert.equal(merged.outcome, "VERIFIED")
  assert.equal(merged.quality.eligible, true)

  const payload = join(stateDir, "attestation.json")
  writeFileSync(payload, JSON.stringify({ run_id: item.run_id, verify_id: "second-check", parent_rework: null }))
  const fromFile = invoke("attest", "--file", payload)
  assert.equal(fromFile.status, 0, fromFile.stderr)
  const [updated] = readRuns(stateDir)
  assert.equal(updated.quality.verify_id, "second-check")
  assert.equal(updated.work.parent_rework, null)
  assert.equal(updated.outcome, "VERIFIED")
  assert.deepEqual(updated.skill_hints, expected)
})

test("operating reports roll up fragmented cells and evaluate dated trials", () => {
  const recipe = "acceptance-routing-v7"
  const base = (runID, taskClass) => run({ runID, recipe, taskID: runID, taskClass })
  const accepted = { ...base("accepted", "known-bug"), at: "2026-11-03T00:00:00Z",
    skill_hints: [{ skill: "review", first_pass: true, rework: false }] }
  const failed = { ...base("failed", "diagnosed-bug"), at: "2026-11-04T00:00:00Z", outcome: "FAILED_VERIFICATION",
    duration_ms: null, work: { parent_rework: null }, skill_hints: [{ skill: "review", first_pass: false, rework: true }] }
  const unknown = { ...base("unknown", "usage-diagnosis"), at: "2026-11-05T00:00:00Z", outcome: "PARTIAL_WITH_UNKNOWN",
    skill_hints: [{ skill: "review", first_pass: null, rework: null }] }
  const prior = { ...accepted, run_id: "prior", at: "2026-11-01T00:00:00Z", skill_hints: [] }
  const v6 = { ...accepted, run_id: "v6", playbook_version: "acceptance-routing-v6", skill_hints: [] }
  const otherRoute = { ...accepted, run_id: "other", route: "diagnose", skill_hints: [] }
  const records = [accepted, accepted, failed, unknown, prior, v6, otherRoute]
  const rollupKey = `${recipe}|codex|implement|worker`
  const activeTrial = { id: "trial-a", status: "active", started_at: "2026-11-03T00:00:00Z",
    playbook_version: recipe, target_route: rollupKey, trial_run_limit: 10 }
  const report = operatingReport(records, [], { minimumObservedRuns: 4, activeTrial })
  assert.equal(report.duplicate_records, 1)
  assert.equal(report.groups.length, 4)
  assert.deepEqual(report.route_rollups[rollupKey], { runs: 4, accepted: 2, failed: 1, unknown: 1, teacher_runs: 0,
    parent_rework: 0, parent_rework_observed_runs: 3, duration_ms: 300, duration_observed_runs: 3, meets_min_runs: true })
  assert.equal(report.route_rollups[`${recipe}|codex|diagnose|worker`].meets_min_runs, false)
  assert.deepEqual(report.skill_hints, [{ skill: "review", observations: 3, first_pass_yes: 1, first_pass_no: 1,
    first_pass_unknown: 1, rework_yes: 1, rework_no: 1, rework_unknown: 1 }])
  assert.deepEqual(report.active_trial, { id: "trial-a", status: "active", target_cell: null,
    started_at: activeTrial.started_at, observed_runs: 3, trial_run_limit: 10, accepted: 1, failed: 1, unknown: 1, decision_due: true })
  const cellTrial = { ...activeTrial, target_cell: unknown.cell_id, target_route: undefined, trial_run_limit: 1 }
  assert.equal(operatingReport(records, [], { activeTrial: cellTrial }).active_trial.decision_due, true)
  assert.equal(operatingReport(records, [], { activeTrial: { ...cellTrial, trial_run_limit: 2 } }).active_trial.decision_due, false)
  assert.equal(operatingReport(records, []).active_trial, null)
})

test("doctor reports store exclusions and coverage without echoing payloads or changing evidence", (t) => {
  const stateDir = mkdtempSync(join(tmpdir(), "aw-usage-doctor-"))
  t.after(() => rmSync(stateDir, { recursive: true, force: true }))
  appendRun(run({ runID: "v6", recipe: "acceptance-routing-v6", taskID: "v6" }), stateDir)
  const v7 = run({ runID: "v7", recipe: "acceptance-routing-v7", taskID: "v7" })
  appendRun({ ...v7, actors: { ...v7.actors, worker: { ...v7.actors.worker, token_source: "unknown", tokens: null } } }, stateDir)
  appendAttestation({ run_id: "v7", verify_id: "unprinted-evidence" }, stateDir)
  const runsPath = join(stateDir, "runs.jsonl")
  const attestationsPath = join(stateDir, "attestations.jsonl")
  appendFileSync(runsPath, '{unprinted-evidence\n{"schema_version":3,"kind":"run"}\n{"kind":"MONITOR_CHECK"}\n{"schema_version":4,"kind":"other"}\n{"schema_version":5,"kind":"run"}\n{"schema_version":4,"kind":"run"}\n')
  appendFileSync(attestationsPath, '{unprinted-evidence\n{"schema_version":4,"kind":"attestation"}\n{"schema_version":3,"kind":"attestation"}\n')
  const original = [runsPath, attestationsPath].map((path) => readFileSync(path, "utf8"))
  const result = spawnSync(process.execPath, [usageScript, "doctor"], { encoding: "utf8", env: { ...process.env, AW_STATE_DIR: stateDir } })
  assert.equal(result.status, 0, result.stderr)
  assert.doesNotMatch(result.stdout + result.stderr, /unprinted-evidence/)
  const report = JSON.parse(result.stdout)
  assert.equal(report.valid_runs, 2)
  assert.deepEqual(report.files["runs.jsonl"], { valid: 2, excluded: { "invalid-json": 1, "legacy-schema": 1,
    "foreign-monitor": 1, "foreign-kind": 1, "unsupported-schema": 1, "invalid-run": 1 } })
  assert.deepEqual(report.files["attestations.jsonl"], { valid: 1, excluded: { "invalid-json": 1, "invalid-attestation": 1, "legacy-schema": 1 } })
  assert.deepEqual(report.attestation_coverage, { v6: { runs: 1, attested: 0 }, v7: { runs: 1, attested: 1 } })
  assert.deepEqual(report.token_coverage, { runs: 2, any_observed: 2, complete: 1, main: 2, worker: 1, teacher: 0 })
  assert.equal(report.active_trial, null)
  assert.deepEqual([runsPath, attestationsPath].map((path) => readFileSync(path, "utf8")), original)
})
