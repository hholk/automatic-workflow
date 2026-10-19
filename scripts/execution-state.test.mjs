import test from "node:test"
import assert from "node:assert/strict"
import { validateTaskBrief, assessEvidenceReuse, assessAcceptance, routeMilestone, assessRecovery, resolveAuthority, assessDispatch } from "./execution-state.mjs"

const scope = { task_id: "task-a", objective_revision: "objective-2", snapshot_id: "tree-3" }
const verify = { check_id: "behavior", check_version: "1", command: "npm test", expected: "No failing behavior tests" }
const brief = { version: 1, ...scope, objective: "Fix the failing save operation", success: [{ id: 1, claim: "Saving preserves the entered title", verify }] }
const evidence = { version: 1, ...scope, criterion_id: 1, check_id: "behavior", check_version: "1", evidence_ref: "log:worker-test", status: "passed", verify: { command: "npm test", exit_code: 0, result: "passed", result_ref: "log:save-test" } }
const confirmation = { version: 1, ...scope, actor: "main", integrated: true, status: "passed", criterion_ids: [1], evidence_ref: "log:integration", evidence_refs: [evidence.evidence_ref], verify: { command: "npm test", exit_code: 0, result: "passed", result_ref: "log:main-test" } }
const acceptance = (overrides = {}) => assessAcceptance({ brief, evidence: [evidence], main_confirmation: confirmation, ...overrides })

test("task brief requires a concise objective and numbered criteria with an observable expected result", () => {
  assert.equal(validateTaskBrief(brief).allowed, true)
  for (const changed of [{ objective_revision: null }, { objective: " " }, { objective: "x".repeat(501) }, { success: [] }, { success: [{ ...brief.success[0], id: 2 }] }, { success: [{ ...brief.success[0], verify: { ...verify, expected: "" } }] }]) {
    assert.equal(validateTaskBrief({ ...brief, ...changed }).allowed, false)
  }
})

test("acceptance requires full passing evidence and fresh main integration verification", () => {
  assert.deepEqual(acceptance(), { accepted: true, reason: null, coverage: "1/1", evidence_refs: ["log:worker-test"] })
  assert.equal(acceptance({ main_confirmation: undefined }).reason, "MAIN_INTEGRATION_VERIFICATION_REQUIRED")
  for (const changed of [{ actor: "worker" }, { integrated: false }, { snapshot_id: "old" }, { evidence_refs: [] }, { criterion_ids: [] }, { verify: { ...confirmation.verify, exit_code: 1 } }]) {
    assert.equal(acceptance({ main_confirmation: { ...confirmation, ...changed } }).accepted, false)
  }
  const more = { ...brief, success: [...brief.success, { id: 2, claim: "Saving an empty title shows a validation error", verify }] }
  assert.deepEqual(acceptance({ brief: more }), { accepted: false, reason: "INCOMPLETE_COVERAGE", missing_criteria: [2] })
})

test("stale, foreign, unknown and failed evidence never count even alongside passing evidence", () => {
  for (const changed of [{ version: 2 }, { task_id: "other" }, { objective_revision: "old" }, { snapshot_id: "old" }, { criterion_id: 9 }, { check_version: "0" }, { check_id: "unknown" }, { status: "unknown" }, { verify: { ...evidence.verify, exit_code: 1 } }, { verify: { ...evidence.verify, result: "unknown" } }, { verify: { ...evidence.verify, command: "different" } }]) {
    assert.equal(acceptance({ evidence: [evidence, { ...evidence, ...changed, evidence_ref: "log:bad" }] }).accepted, false)
  }
  const scopedCheck = { ...brief, success: [{ ...brief.success[0], verify: { ...verify, snapshot_id: "old" } }] }
  assert.equal(acceptance({ brief: scopedCheck, evidence: [{ ...evidence, snapshot_id: "old" }] }).accepted, false)
  assert.equal(acceptance({ evidence: [evidence, evidence] }).reason, "UNIQUE_EVIDENCE_REQUIRED")
})

test("reuse requires the exact task, revision, snapshot and versioned check", () => {
  const context = { ...scope, criterion_id: 1, ...verify }
  assert.equal(assessEvidenceReuse({ evidence, context }).allowed, true)
  for (const changed of [{ snapshot_id: undefined }, { objective_revision: "new" }, { check_version: undefined }, { criterion_id: 2 }, { command: "new check" }]) {
    assert.equal(assessEvidenceReuse({ evidence, context: { ...context, ...changed } }).allowed, false)
  }
})

const profile = { id: "tested", strategy: "one-worker", model: "configured-model", tested: true, capabilities: ["edit"], evidence_refs: ["evaluation:1"] }
const costs = ["main", "worker", "teacher", "handoff", "test"].map((role) => ({ role, amount: role === "worker" ? 2 : 0, currency: "USD" }))
const route = (changes = {}) => routeMilestone({ event: "start", required_capabilities: ["edit"], selected_profile_id: "tested", profiles: [profile], costs, baseline_cost: { amount: 3, currency: "USD" }, ...changes })

test("routing uses the caller's tested capable profile only at milestones", () => {
  assert.deepEqual(route(), { allowed: true, reason: null, profile_id: "tested", strategy: "one-worker", model: "configured-model", total_cost: 2, currency: "USD", savings: 1 })
  assert.equal(route({ event: "tool_call" }).reason, "MILESTONE_REQUIRED")
  for (const changes of [{ selected_profile_id: "invented" }, { required_capabilities: ["vision"] }, { profiles: [{ ...profile, tested: false }] }, { profiles: [{ ...profile, evidence_refs: [] }] }]) {
    assert.equal(route(changes).reason, "TESTED_CAPABLE_PROFILE_REQUIRED")
  }
})

test("rule routing chooses the first proven capable path in configured preference order", () => {
  const inventory = [{ ...profile, id: "unproved", tested: false }, { ...profile, id: "wrong-capability", capabilities: ["vision"] },
    profile, { ...profile, id: "alternative", model: "alternative-configured-model" }]
  assert.equal(route({ profiles: inventory, selected_profile_id: undefined }).profile_id, "tested")
  assert.equal(route({ profiles: inventory, selected_profile_id: "alternative" }).profile_id, "alternative")
  assert.equal(route({ profiles: inventory, selected_profile_id: "unproved" }).allowed, false)
})

test("unknown or partial total costs cannot claim savings", () => {
  for (const incomplete of [undefined, costs.slice(0, 4), [...costs, { role: "main", amount: null, currency: "USD" }], costs.map((item) => ({ ...item, currency: item.role === "test" ? "EUR" : "USD" }))]) {
    const result = route({ costs: incomplete })
    assert.equal(result.total_cost, null)
    assert.equal(result.savings, null)
  }
  assert.equal(route({ costs: [...costs, { role: "main", amount: 4, currency: "USD" }] }).savings, -3)
  assert.equal(route({ baseline_cost: { amount: 4, currency: "EUR" } }).savings, null)
})

const recoveryScope = { task_id: "task-a", objective_revision: "objective-2", blocker_id: "save", state_id: "same-state" }
const attempt = (number, changes = {}) => ({ ...recoveryScope, attempt_id: `probe-${number}`, sequence: number, status: "completed", outcome: "no_progress", failure_kind: "technical", main_verified: true, hypothesis: `cause ${number}`, action_ref: `command:${number}`, result_ref: `result:${number}`, before_state: "same-state", after_state: "same-state", ...changes })
const recovery = (changes = {}) => assessRecovery({ ...recoveryScope, unresolved: true, last_progress_sequence: 0, recovery_count: 0, attempts: [attempt(1), attempt(2)], main_confirmation: { ...recoveryScope, evidence_ref: "log:confirmed", attempt_ids: ["probe-1", "probe-2"] }, ...changes })

test("two verified distinct technical probes allow one recovery and then stop", () => {
  assert.equal(recovery().action, "RECOVER_ONCE")
  assert.equal(recovery({ recovery_count: 1 }).reason, "RECOVERY_EXHAUSTED")
  assert.equal(recovery({ main_confirmation: undefined }).reason, "MAIN_CONFIRMATION_REQUIRED")
  assert.equal(recovery({ main_confirmation: { ...recoveryScope, evidence_ref: "proof", attempt_ids: ["probe-2", "probe-1"] } }).reason, "MAIN_CONFIRMATION_REQUIRED")
})

test("duplicate probes and environment failures are not new technical attempts", () => {
  for (const changed of [{ hypothesis: " CAUSE   1 " }, { action_ref: "command:1" }, { result_ref: "result:1" }]) {
    assert.equal(recovery({ attempts: [attempt(1), attempt(2, changed)] }).reason, "REPEATED_PROBE")
  }
  for (const failure_kind of ["network", "provider", "permission"]) {
    assert.equal(recovery({ attempts: [attempt(1), attempt(2, { failure_kind })] }).reason, "ENVIRONMENT_BLOCKED")
  }
  assert.equal(recovery({ attempts: [attempt(1), attempt(2, { main_verified: false })] }).action, "CONTINUE")
  assert.equal(recovery({ attempts: [attempt(1), attempt(2, { status: "pending" })] }).action, "WAIT")
  assert.equal(recovery({ attempts: [attempt(1), attempt(1)] }).reason, "DUPLICATE_OR_INVALID_ATTEMPT")
})

test("verified progress resets the attempt window and repeated state cycles trigger recovery", () => {
  const progress = attempt(3, { outcome: "progress", after_state: "changed" })
  assert.equal(recovery({ attempts: [attempt(1), attempt(2), progress] }).reason, "PROGRESS_MARKER_STALE")
  assert.equal(recovery({ attempts: [attempt(1), attempt(2), progress], last_progress_sequence: 3, recovery_count: 0, state_id: "changed" }).action, "CONTINUE")
  assert.equal(recovery({ last_progress_sequence: 100 }).reason, "VERIFIED_PROGRESS_REQUIRED")
  assert.equal(recovery({ attempts: [attempt(1, { before_state: "a", after_state: "b" }), attempt(2, { before_state: "b", after_state: "a" })] }).reason, "CYCLE_DETECTED")
})

test("cross-state progress invalidates old probes before considering another recovery", () => {
  const progress = attempt(3, { state_id: "earlier-state", before_state: "earlier-state", after_state: "same-state", outcome: "progress" })
  assert.equal(recovery({ attempts: [attempt(1), attempt(2), progress] }).reason, "PROGRESS_MARKER_STALE")
})

const authority = { task_id: "task-a", objective_revision: "objective-2", decision_id: "decision-1", scope: "publish site-a to production", kind: "missing_authority" }
test("authority asks once, waits on the stable id, and reuses the exact answered scope", () => {
  assert.equal(resolveAuthority(authority).action, "ASK_ONCE")
  const pending = { ...authority, status: "pending", evidence_ref: "request:1" }
  const repeat = { ...authority, decision_id: "new-id", answers: [pending] }
  assert.deepEqual(resolveAuthority(repeat), { allowed: false, reason: "HUMAN_DECISION_REQUIRED", action: "WAIT", decision_id: "decision-1" })
  assert.equal(resolveAuthority({ ...repeat, answers: [{ ...pending, status: "approved" }] }).action, "REUSE_ANSWER")
  assert.equal(resolveAuthority({ ...repeat, answers: [{ ...pending, status: "denied" }] }).reason, "AUTHORITY_DENIED")
  for (const changed of [{ task_id: "other" }, { objective_revision: "new" }, { scope: "publish site-b to production" }, { kind: "goal_conflict" }]) {
    assert.equal(resolveAuthority({ ...authority, ...changed, answers: [{ ...pending, status: "approved" }] }).action, "ASK_ONCE")
  }
})

const worker = (id, path) => ({ id, task_id: "task-a", objective_revision: "objective-2", independent: true, can_delegate: false, write_paths: [path], worktree_id: `tree-${id}`, isolated: true, writable: true, worktree_ready: true })
const dispatch = (changes = {}) => assessDispatch({ task_id: "task-a", objective_revision: "objective-2", workers: [worker("a", "src/a"), worker("b", "src/b")], integration: { owner: "main", verify_command: "npm test" }, ...changes })
test("parallel dispatch requires independent unique owners and prepared isolated writable worktrees", () => {
  assert.equal(dispatch().allowed, true)
  for (const changed of [{ write_paths: ["src"] }, { write_paths: ["SRC/A"] }, { write_paths: ["C:/src/a"] }, { write_paths: ["src/*"] },
    { worktree_id: "tree-a" }, { isolated: false }, { worktree_ready: false }, { can_delegate: true }, { independent: false }, { write_paths: ["src/../a"] }]) {
    assert.equal(dispatch({ workers: [worker("a", "src/a"), { ...worker("b", "src/b"), ...changed }] }).allowed, false)
  }
  assert.equal(dispatch({ parent_role: "worker" }).reason, "MAIN_DISPATCH_ONLY")
  assert.equal(dispatch({ dispatched_ids: ["a"] }).reason, "DUPLICATE_DISPATCH")
  assert.equal(dispatch({ integration: undefined }).reason, "INTEGRATION_PLAN_REQUIRED")
  assert.equal(dispatch({ active_workers: [worker("c", "src/c")] }).reason, "AT_MOST_TWO_UNIQUE_WORKERS")
  assert.equal(dispatch({ workers: [worker("b", "src/b")], active_workers: [worker("a", "src/a")], dispatched_ids: ["a"] }).allowed, true)
})
