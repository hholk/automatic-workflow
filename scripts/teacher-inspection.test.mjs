import test from "node:test"
import assert from "node:assert/strict"
import { assessTeacherInspection, assessTeacherRequest } from "./teacher-state.mjs"
import { inspectionRequest } from "./fixtures/teacher-inspection.mjs"

test("preventive tool-free advice is available before any failed worker attempt", () => {
  assert.equal(assessTeacherRequest({ state: "MISSING_DECISIVE", decision: "select a durable ownership boundary",
    known: ["design@baseline"], missing: "whether the boundary should be synchronous",
    attempted: ["reviewed current design and callers"], cheaperCheckAvailable: false }).eligible, true)
  const request = inspectionRequest()
  request.attempts = []
  assert.equal(assessTeacherInspection(request).eligible, false)
})

test("inspection needs two distinct completed technical probes confirmed by main", () => {
  for (const count of [0, 1]) {
    const request = inspectionRequest()
    request.attempts = request.attempts.slice(0, count)
    assert.equal(assessTeacherInspection(request).reason, "TWO_NO_PROGRESS_ATTEMPTS_REQUIRED")
  }
  assert.deepEqual(assessTeacherInspection(inspectionRequest()), {
    eligible: true, reason: null, attempt_ids: ["attempt-1", "attempt-2"],
  })
  assert.equal(assessTeacherInspection(null).eligible, false)
})

test("duplicate errors, IDs, hypotheses, and evidence references do not establish two attempts", () => {
  for (const field of ["attempt_id", "hypothesis", "action_ref", "result_ref"]) {
    const request = inspectionRequest()
    request.attempts[1][field] = request.attempts[0][field]
    assert.equal(assessTeacherInspection(request).eligible, false, field)
  }
  const request = inspectionRequest()
  request.attempts[1].hypothesis = "  INPUT   encoding "
  assert.equal(assessTeacherInspection(request).reason, "DISTINCT_PROBES_REQUIRED")
})

test("foreign task, revised objective, changed blocker or state cannot contribute attempts", () => {
  for (const field of ["task_id", "objective_revision", "blocker_id", "state_id"]) {
    const request = inspectionRequest()
    request.attempts[0][field] = "other"
    assert.equal(assessTeacherInspection(request).eligible, false, field)
  }
})

test("progress resets the pair; a stale progress marker and resolved blocker fail closed", () => {
  const request = inspectionRequest()
  request.last_progress_sequence = 1
  assert.equal(assessTeacherInspection(request).reason, "UNVERIFIED_PROGRESS_MARKER")
  request.attempts[0].outcome = "progress"
  request.attempts[0].before_state = "earlier-state"
  assert.equal(assessTeacherInspection(request).reason, "TWO_NO_PROGRESS_ATTEMPTS_REQUIRED")
  request.last_progress_sequence = 0
  request.attempts.push({ ...request.attempts[1], attempt_id: "progress", sequence: 3, outcome: "progress" })
  assert.equal(assessTeacherInspection(request).reason, "PROGRESS_MARKER_STALE")
  request.unresolved = false
  assert.equal(assessTeacherInspection(request).reason, "BLOCKER_RESOLVED")
})

test("two fresh probes after verified progress can qualify in the new state", () => {
  const request = inspectionRequest()
  const progress = { ...request.attempts[0], attempt_id: "progress", sequence: 1,
    outcome: "progress", state_id: "earlier-state", before_state: "earlier-state" }
  request.attempts.forEach((attempt) => attempt.sequence++)
  request.attempts.unshift(progress)
  request.last_progress_sequence = 1
  assert.equal(assessTeacherInspection(request).eligible, true)
  progress.main_verified = false
  assert.equal(assessTeacherInspection(request).reason, "UNVERIFIED_PROGRESS_MARKER")
})

test("environment failures, partial probes, unverified claims and missing observations do not count", () => {
  for (const patch of [
    { failure_kind: "provider" }, { failure_kind: "network" }, { failure_kind: "permission" },
    { status: "running" }, { outcome: "unknown" }, { main_verified: false },
    { before_state: "different" }, { after_state: "improved" },
    { sequence: 1 }, { sequence: "2" }, { result_ref: "" }, { hypothesis: "" },
  ]) {
    const request = inspectionRequest()
    Object.assign(request.attempts[1], patch)
    assert.equal(assessTeacherInspection(request).eligible, false, JSON.stringify(patch))
  }
})

test("main confirmation must name the current pair and exact problem state", () => {
  for (const patch of [undefined, { ...inspectionRequest().main_confirmation, state_id: "old" },
    { ...inspectionRequest().main_confirmation, attempt_ids: ["attempt-2", "attempt-1"] },
    { ...inspectionRequest().main_confirmation, evidence_ref: "" }]) {
    const request = inspectionRequest()
    request.main_confirmation = patch
    assert.equal(assessTeacherInspection(request).reason, "MAIN_CONFIRMATION_REQUIRED")
  }
})
