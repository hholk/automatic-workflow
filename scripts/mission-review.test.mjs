import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { validateTaskBrief, assessContractReview, assessCompletionReview, assessAcceptance, assessDispatch, assessReplan, contractDigest } from "./execution-state.mjs"
import { fixture } from "./test-fixtures/mission.mjs"

test("reviewed briefs trace request and decisions to concrete acceptance criteria", () => {
  const { brief } = fixture()
  assert.equal(validateTaskBrief(brief).allowed, true)
  for (const change of [{ version: 1 }, { assurance: undefined }, { sources: [] }, { requirements: [] },
    { requirements: [{ ...brief.requirements[0], criterion_ids: [2] }] },
    { sources: [...brief.sources, { id: "steering", kind: "decision", text: "Also support empty titles", source_ref: "user:2" }] }]) {
    assert.equal(validateTaskBrief({ ...brief, ...change }).allowed, false)
  }
})

test("contract review checks coverage and fake-pass counterexamples before work dispatch", () => {
  const { brief, review } = fixture()
  const worker = { id: "builder", task_id: brief.task_id, objective_revision: brief.objective_revision, independent: true, can_delegate: false, write_paths: ["src/save.mjs"] }
  const request = { brief, purpose: "work", workers: [worker], integration: { owner: "main", verify_command: "node --test" } }
  assert.equal(assessDispatch(request).reason, "FRESH_CONTRACT_REVIEW_REQUIRED")
  assert.equal(assessDispatch({ ...request, contract_review: review }).allowed, true)
  for (const change of [{ requirement_ids: [] }, { checks: [] }, { checks: [{ ...review.checks[0], status: "unknown" }] },
    { reviewer_id: "main" }, { reviewer_id: "builder" }, { fresh_context: false }, { status: "unknown" }, { gaps: [{ id: "gap" }] }]) {
    assert.equal(assessDispatch({ ...request, contract_review: { ...review, ...change } }).allowed, false)
  }
  assert.equal(assessDispatch({ ...request, purpose: "contract_review", workers: [{ ...worker, write_paths: [] }] }).allowed, true)
  assert.equal(assessDispatch({ ...request, purpose: "contract_review" }).reason, "REVIEW_MUST_BE_READ_ONLY")
})

test("contract review survives implementation snapshots, but altered checks or intent invalidate it", () => {
  const { brief, review } = fixture()
  assert.equal(assessContractReview({ brief: { ...brief, snapshot_id: "implemented" }, review }).allowed, true)
  const changed = { ...brief, success: [{ ...brief.success[0], verify: { ...brief.success[0].verify, command: "weaker check" } }] }
  assert.notEqual(contractDigest(brief), contractDigest(changed))
  assert.equal(assessContractReview({ brief: changed, review }).allowed, false)
})

test("green criteria cannot hide a product gap found from the original request", () => {
  const { acceptance, completion } = fixture()
  assert.equal(assessAcceptance(acceptance).accepted, true)
  const gap = { id: "GAP-001", source_id: "request", expected: "Title survives reload", observed: "Only the current screen updates", evidence_ref: "browser:reload" }
  assert.equal(assessAcceptance({ ...acceptance, completion_review: { ...completion, status: "gaps", gaps: [gap] } }).reason, "PRODUCT_GAPS_OR_UNKNOWN")
  assert.equal(assessAcceptance({ ...acceptance, completion_review: undefined }).reason, "FRESH_COMPLETION_REVIEW_REQUIRED")
  for (const change of [{ snapshot_id: "old" }, { source_ids: [] }, { inputs: "worker-report" }, { status: "unknown" },
    { fresh_context: false }, { reviewer_id: "builder" }, { verify: { ...completion.verify, exit_code: 1 } }]) {
    assert.equal(assessAcceptance({ ...acceptance, completion_review: { ...completion, ...change } }).accepted, false)
  }
})

test("final review dispatch waits for integration and cannot write product files", () => {
  const { brief, review } = fixture()
  const worker = { id: "reviewer", task_id: brief.task_id, objective_revision: brief.objective_revision, independent: true, can_delegate: false, write_paths: [] }
  const request = { brief, purpose: "completion_review", contract_review: review, workers: [worker], integration: { owner: "main", verify_command: "node --test" } }
  assert.equal(assessDispatch(request).allowed, true)
  assert.equal(assessDispatch({ ...request, active_workers: [{ ...worker, id: "pending" }] }).reason, "INTEGRATION_MUST_BE_QUIESCENT")
  assert.equal(assessCompletionReview({ brief, review: { ...fixture().completion, reviewer_id: "main" } }).allowed, false)
})

test("replanning repairs the earliest invalid artifact without resetting recovery budgets", () => {
  const { brief } = fixture()
  const expected = { scope: "REVISE_BRIEF", criteria: "REVISE_BRIEF", topology: "REPLAN_TASKS", environment: "RESTORE_ENVIRONMENT",
    implementation: "FIX_IMPLEMENTATION", validation: "REPAIR_VERIFICATION", evidence: "REPAIR_VERIFICATION" }
  for (const [artifact, action] of Object.entries(expected)) {
    const result = assessReplan({ brief, diagnosis: { issue_id: "gap-1", earliest_invalid_artifact: artifact, reason: "Observed mismatch",
      evidence_ref: "output:failure", affected_criteria: [1], next_action: "Repair the failing artifact" } })
    assert.equal(result.action, action)
    assert.equal(result.recovery_budget_reset, false)
  }
  assert.equal(assessReplan({ brief, diagnosis: { earliest_invalid_artifact: "guess" } }).allowed, false)
})

test("CLI and normal DONE gate enforce reviewed acceptance end to end", () => {
  const { acceptance, brief, review, completion } = fixture()
  for (const [action, input] of [["contract", { brief, review }], ["completion", { brief, review: completion }], ["acceptance", acceptance]]) {
    const result = spawnSync(process.execPath, [new URL("./execution-state-cli.mjs", import.meta.url).pathname, action], { input: JSON.stringify(input), encoding: "utf8" })
    assert.equal(result.status, 0, result.stdout + result.stderr)
  }
  const run = (input) => spawnSync(process.execPath, [new URL("./gate.mjs", import.meta.url).pathname], {
    input: JSON.stringify({ message: "TYPE: DONE\nEVIDENCE: coverage 1/1\nVERIFY: node --test | exit 0 | passed", acceptance: input }), encoding: "utf8" })
  assert.equal(run(acceptance).status, 0)
  const failed = run({ ...acceptance, completion_review: { ...completion, status: "gaps", gaps: [{ id: "missing-feature" }] } })
  assert.equal(failed.status, 1)
  assert.equal(JSON.parse(failed.stdout).reason, "PRODUCT_GAPS_OR_UNKNOWN")
})
