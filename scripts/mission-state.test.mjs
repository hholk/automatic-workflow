import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync, statSync, symlinkSync, unlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { createMission, applyMissionEvent, writeMission, readMission, recoverMissionLock } from "./mission-state.mjs"
import { fixture } from "./test-fixtures/mission.mjs"

const setup = (t) => {
  const root = mkdtempSync(join(tmpdir(), "aw-mission-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const data = fixture()
  const context = { stateDir: join(root, "state"), workspace: root, task_id: data.brief.task_id, snapshot_id: data.brief.snapshot_id }
  const init = { ...context, event_id: "init", expected_sequence: -1, brief: data.brief, next_action: "Review the contract" }
  let state = writeMission(init)
  const apply = (event, changes = {}) => {
    state = writeMission({ ...context, snapshot_id: state.brief.snapshot_id, event_id: `event-${state.sequence + 1}`,
      expected_sequence: state.sequence, event: { next_action: "Continue the mission", ...event }, ...changes })
    return state
  }
  const file = () => join(context.stateDir, "missions", readdirSync(join(context.stateDir, "missions"))[0], "state.json")
  return { ...data, context, init, apply, file, current: () => state }
}
const worker = (brief, id = "builder") => ({ id, task_id: brief.task_id, objective_revision: brief.objective_revision,
  independent: true, can_delegate: false, write_paths: ["src/save.mjs"] })

test("restart preserves reserved task IDs and refuses duplicate dispatch after ambiguous starts", (t) => {
  const f = setup(t)
  f.apply({ type: "contract_review", review: f.review })
  f.apply({ type: "dispatch", purpose: "work", workers: [worker(f.brief)], integration: { owner: "main", verify_command: "node --test" } })
  let resumed = readMission(f.context)
  assert.equal(resumed.can_resume, true)
  assert.equal(resumed.state.active_workers[0].host_task_id, null)
  f.apply({ type: "attach", worker_id: "builder", host_task_id: "native:123" })
  resumed = readMission(f.context)
  assert.equal(resumed.state.active_workers[0].host_task_id, "native:123")
  f.apply({ type: "collect", worker_id: "builder", outcome: "completed", evidence_ref: "native:123:final" })
  assert.throws(() => f.apply({ type: "dispatch", purpose: "work", workers: [worker(f.brief)], integration: { owner: "main", verify_command: "node --test" } }), /DUPLICATE_DISPATCH/)
  assert.deepEqual(readMission(f.context).state.dispatched_ids, ["builder"])
})

test("checkpoints reject stale writes and changed retries while identical lost-response retries are idempotent", (t) => {
  const f = setup(t)
  assert.deepEqual(writeMission(f.init), f.current())
  assert.throws(() => writeMission({ ...f.init, next_action: "Different" }), /EVENT_ID_REUSED_WITH_DIFFERENT_INPUT/)
  f.apply({ type: "checkpoint" })
  assert.throws(() => writeMission({ ...f.init, event_id: "new" }), /STALE_CHECKPOINT_REVISION/)
  const before = readFileSync(f.file(), "utf8")
  assert.throws(() => f.apply({ type: "unsupported" }), /UNKNOWN_MISSION_EVENT/)
  assert.equal(readFileSync(f.file(), "utf8"), before)
  assert.equal(statSync(f.file()).mode & 0o777, 0o600)
})

test("snapshot mismatch blocks new work but still allows reconciliation before revalidation", (t) => {
  const f = setup(t)
  f.apply({ type: "contract_review", review: f.review })
  f.apply({ type: "dispatch", purpose: "work", workers: [worker(f.brief)], integration: { owner: "main", verify_command: "node --test" } })
  assert.equal(readMission({ ...f.context, snapshot_id: "tree-2" }).can_resume, false)
  assert.throws(() => f.apply({ type: "completion_review", review: f.completion }, { snapshot_id: "tree-2" }), /SNAPSHOT_REVALIDATION_REQUIRED/)
  f.apply({ type: "collect", worker_id: "builder", outcome: "completed", evidence_ref: "host:done" }, { snapshot_id: "tree-2" })
  f.apply({ type: "snapshot", snapshot_id: "tree-2", evidence_ref: "git:working-tree-digest" }, { snapshot_id: "tree-2" })
  const current = readMission({ ...f.context, snapshot_id: "tree-2" }).state
  assert.equal(current.contract_review.report_ref, f.review.report_ref)
  assert.equal(current.completion_review, null)
  assert.deepEqual(current.evidence, [])
})

test("replanning and revisions preserve recovery, authority, original intent and dispatch history", (t) => {
  const f = setup(t)
  const recovery_record = { task_id: f.brief.task_id, objective_revision: "1", blocker_id: "save", state_id: "unchanged",
    unresolved: true, last_progress_sequence: 0, recovery_count: 1, attempts: [] }
  const authority_record = { task_id: f.brief.task_id, objective_revision: "1", decision_id: "publish", scope: "publish site A", kind: "missing_authority", answers: [] }
  f.apply({ type: "checkpoint", recovery_record, authority_record })
  f.apply({ type: "contract_review", review: f.review })
  f.apply({ type: "evidence", evidence: [f.evidence] })
  f.apply({ type: "completion_review", review: f.completion })
  f.apply({ type: "replan", diagnosis: { issue_id: "missing", earliest_invalid_artifact: "criteria", reason: "Reload not tested",
    evidence_ref: "review:missing-reload", affected_criteria: [1], next_action: "Replace the inadequate reload check" } })
  let current = readMission(f.context).state
  assert.equal(current.needs_revision, true)
  assert.equal(current.completion_review, null)
  assert.deepEqual(current.evidence, [])
  assert.equal(current.recovery_ledger[0].request.recovery_count, 1)
  assert.equal(current.authority_ledger[0].result.action, "ASK_ONCE")
  const revised = { ...f.brief, objective_revision: "2" }
  assert.throws(() => f.apply({ type: "revise", brief: { ...revised, sources: [{ ...revised.sources[0], text: "Narrower request" }] }, evidence_ref: "decision:revision" }), /PRESERVE_ACCEPTED_SOURCES/)
  f.apply({ type: "revise", brief: revised, evidence_ref: "decision:stronger-check" })
  current = readMission(f.context).state
  assert.equal(current.needs_revision, false)
  assert.equal(current.contract_review, null)
  assert.equal(current.issues[0].resolution_ref, null)
  assert.equal(current.recovery_ledger.length, 1)
  assert.equal(current.authority_ledger.length, 1)
  assert.equal(current.brief.sources[0].text, f.brief.sources[0].text)
  assert.throws(() => f.apply({ type: "checkpoint", recovery_record: { ...recovery_record, objective_revision: "2", recovery_count: 0 } }), /RECOVERY_BUDGET_CANNOT_RESET/)
})

test("mission completion requires independent reviews, current evidence and resolved issues", (t) => {
  const f = setup(t)
  f.apply({ type: "contract_review", review: f.review })
  f.apply({ type: "evidence", evidence: [f.evidence] })
  assert.throws(() => f.apply({ type: "accept", main_confirmation: f.confirmation }), /FRESH_COMPLETION_REVIEW_REQUIRED/)
  f.apply({ type: "completion_review", review: { ...f.completion, status: "gaps", gaps: [{ id: "GAP-001" }] } })
  assert.throws(() => f.apply({ type: "accept", main_confirmation: f.confirmation }), /PRODUCT_GAPS_OR_UNKNOWN/)
  f.apply({ type: "replan", diagnosis: { issue_id: "reload", earliest_invalid_artifact: "implementation", reason: "Reload loses value",
    evidence_ref: "browser:reload", affected_criteria: [1], next_action: "Fix persistence" } })
  f.apply({ type: "evidence", evidence: [f.evidence] })
  f.apply({ type: "completion_review", review: f.completion })
  assert.throws(() => f.apply({ type: "accept", main_confirmation: f.confirmation }), /UNRESOLVED_MISSION_WORK/)
  f.apply({ type: "resolve", issue_id: "reload", evidence_ref: "browser:reload-passed" })
  f.apply({ type: "accept", main_confirmation: f.confirmation, next_action: "Report accepted completion" })
  assert.equal(readMission(f.context).state.status, "done")
  assert.throws(() => f.apply({ type: "checkpoint" }), /MISSION_ALREADY_COMPLETE/)
})

test("revision history survives restart while old criteria and proof cannot satisfy current acceptance", (t) => {
  const f = setup(t)
  f.apply({ type: "contract_review", review: f.review })
  f.apply({ type: "evidence", evidence: [f.evidence] })
  f.apply({ type: "completion_review", review: f.completion })
  const revised = { ...f.brief, objective_revision: "2", success: [{ ...f.brief.success[0],
    verify: { ...f.brief.success[0].verify, check_version: "2", command: "node --test reload.test.mjs" } }] }
  f.apply({ type: "revise", brief: revised, evidence_ref: "decision:reload-check" })
  const current = readMission(f.context).state
  assert.deepEqual(current.history.find((event) => event.type === "init").brief, f.brief)
  assert.deepEqual(current.history.find((event) => event.type === "evidence").evidence, [f.evidence])
  assert.deepEqual(current.history.find((event) => event.type === "contract_review").review, f.review)
  assert.deepEqual(current.history.find((event) => event.type === "completion_review").review, f.completion)
  assert.deepEqual(current.history.find((event) => event.type === "revise").brief, revised)
  assert.deepEqual(current.evidence, [])
  assert.equal(current.contract_review, null)
  assert.equal(current.completion_review, null)
  assert.throws(() => f.apply({ type: "evidence", evidence: [f.evidence] }), /FRESH_EVIDENCE_REQUIRED/)
  assert.throws(() => f.apply({ type: "accept", main_confirmation: f.confirmation }), /FRESH_CONTRACT_REVIEW_REQUIRED/)
})

test("corrupt, oversized and linked state is rejected without overwriting it", (t) => {
  const f = setup(t)
  const original = readFileSync(f.file(), "utf8")
  writeFileSync(f.file(), "{")
  assert.throws(() => readMission(f.context), SyntaxError)
  assert.throws(() => f.apply({ type: "checkpoint" }), SyntaxError)
  assert.equal(readFileSync(f.file(), "utf8"), "{")
  writeFileSync(f.file(), "x".repeat(1024 * 1024 + 1))
  assert.throws(() => readMission(f.context), /INVALID_MISSION_FILE/)
  const other = join(f.context.workspace, "other.json")
  writeFileSync(other, original)
  unlinkSync(f.file())
  symlinkSync(other, f.file())
  assert.throws(() => readMission(f.context))
  assert.throws(() => f.apply({ type: "checkpoint" }))
  assert.equal(readFileSync(other, "utf8"), original)
})

test("an orphan lock can be reconciled only after its exact writer has exited", (t) => {
  const f = setup(t)
  const lock = `${f.file()}.lock`
  writeFileSync(lock, JSON.stringify({ pid: process.pid, event_id: "blocked-write" }))
  assert.throws(() => f.apply({ type: "checkpoint" }), /MISSION_BUSY_RECONCILE_LOCK/)
  assert.throws(() => recoverMissionLock({ ...f.context, event_id: "blocked-write" }), /MISSION_WRITER_STILL_ALIVE/)
  const child = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" })
  writeFileSync(lock, JSON.stringify({ pid: Number(child.stdout), event_id: "crashed-write" }))
  assert.throws(() => recoverMissionLock({ ...f.context, event_id: "wrong" }), /MISSION_LOCK_IDENTITY_REQUIRED/)
  assert.equal(recoverMissionLock({ ...f.context, event_id: "crashed-write" }).recovered, true)
  f.apply({ type: "checkpoint" })
  assert.equal(readMission(f.context).state.sequence, 1)
})

test("CLI restart uses the same AW_STATE_DIR and resumes the exact workspace mission", (t) => {
  const f = setup(t)
  const invoke = (action, input) => spawnSync(process.execPath, [new URL("./mission-state-cli.mjs", import.meta.url).pathname, action], {
    input: JSON.stringify(input), encoding: "utf8", env: { ...process.env, AW_STATE_DIR: f.context.stateDir } })
  const input = { task_id: f.context.task_id, workspace: f.context.workspace, snapshot_id: f.context.snapshot_id }
  let result = invoke("write", { ...input, expected_sequence: 0, event_id: "cli-checkpoint", event: { type: "checkpoint", next_action: "Resume here" } })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  result = invoke("read", input)
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.equal(JSON.parse(result.stdout).state.next_action, "Resume here")
  assert.equal(JSON.parse(result.stdout).state.sequence, 1)
  assert.equal(invoke("write", { ...input, expected_sequence: 0, event_id: "stale", event: { type: "checkpoint", next_action: "Wrong" } }).status, 1)
  assert.equal(invoke("read", { ...input, snapshot_id: undefined }).status, 1)
})

test("direct tasks can checkpoint without independent-review overhead", (t) => {
  const root = mkdtempSync(join(tmpdir(), "aw-direct-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const f = fixture()
  const brief = { ...f.brief, assurance: "direct" }
  let state = createMission({ brief, workspace: root, next_action: "Check the title" })
  state = applyMissionEvent(state, { type: "evidence", evidence: [f.evidence], next_action: "Accept the checked result" })
  state = applyMissionEvent(state, { type: "accept", main_confirmation: f.confirmation, next_action: "Report completion" })
  assert.equal(state.status, "done")
})
