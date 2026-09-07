import test from "node:test"
import assert from "node:assert/strict"
import {
  assessTeacherRequest,
  acceptTeacherReply,
  selectEvidenceWorker,
} from "./teacher-state.mjs"

test("accepts a decisive bounded request after a useful probe", () => {
  assert.deepEqual(assessTeacherRequest({
    state: "MISSING_DECISIVE",
    decision: "choose ownership boundary",
    known: ["src/a.js:10"],
    missing: "whether callers require synchronous completion",
    attempted: ["rg caller src"],
    humanDecision: false,
  }), { eligible: true, reason: null })
})

test("rejects ineligible requests with stable reasons", () => {
  assert.equal(assessTeacherRequest({
    state: "MISSING_DECISIVE",
    decision: "choose product behavior",
    known: [],
    missing: "preferred UX",
    attempted: [],
    humanDecision: true,
  }).reason, "HUMAN_DECISION_REQUIRED")
  assert.equal(assessTeacherRequest({
    state: "MISSING_DECISIVE",
    decision: "choose implementation",
    known: [],
    missing: "caller behavior",
    attempted: [],
  }).reason, "MISSING_EVIDENCE_REFERENCES")
  assert.equal(assessTeacherRequest({
    state: "CONFLICTING",
    decision: "cosmetic naming",
    known: ["a.js"],
    missing: "preferred spelling",
    attempted: ["rg name"],
    material: false,
  }).reason, "NOT_DECISION_RELEVANT")
  assert.equal(assessTeacherRequest({
    state: "EXHAUSTED",
    decision: "pick causal fix",
    known: ["test output"],
    missing: "root cause",
    attempted: ["test"],
    cheaperCheckAvailable: true,
  }).reason, "CHEAPER_CHECK_AVAILABLE")
})

test("routes evidence collection by independence need", () => {
  assert.equal(selectEvidenceWorker({ type: "verify", conflicting: false }), "existing")
  assert.equal(selectEvidenceWorker({ type: "compare", conflicting: false }), "fresh-read-only")
  assert.equal(selectEvidenceWorker({ type: "inspect", conflicting: true }), "fresh-read-only")
})

test("enforces three asks, five turns, and one ASK repair", () => {
  const exhausted = acceptTeacherReply(
    { asks: 3, turns: 4, askRepairs: 0, informationGain: true },
    { type: "ASK", valid: true },
  )
  assert.equal(exhausted.terminal, "TEACHER_EXHAUSTED")

  const repair = acceptTeacherReply(
    { asks: 1, turns: 2, askRepairs: 0, informationGain: true },
    { type: "ASK", valid: false },
  )
  assert.equal(repair.action, "REPAIR_ASK")

  const force = acceptTeacherReply(
    { asks: 1, turns: 3, askRepairs: 1, informationGain: true },
    { type: "ASK", valid: false },
  )
  assert.equal(force.action, "FORCE_FINAL")
})

test("stops more questions after zero information gain", () => {
  const value = acceptTeacherReply(
    { asks: 1, turns: 2, askRepairs: 0, informationGain: false },
    { type: "ASK", valid: true },
  )
  assert.equal(value.action, "FORCE_FINAL")
  assert.equal(value.reason, "NO_INFORMATION_GAIN")
})

test("FINAL ends the thread immediately", () => {
  const value = acceptTeacherReply(
    { asks: 1, turns: 2, askRepairs: 0, informationGain: true },
    { type: "FINAL", valid: true },
  )
  assert.equal(value.terminal, "FINAL")
  assert.equal(value.turns, 3)
})
