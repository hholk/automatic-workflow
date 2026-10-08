import test from "node:test"
import assert from "node:assert/strict"
import { evaluateDone } from "./gate.mjs"

const done = (verify, coverage = "coverage 3/3") => [
  "TYPE: DONE",
  "CHANGED: src/a.ts",
  "EVIDENCE: src/a.ts, npm test, exit 0, all green; " + coverage,
  `VERIFY: ${verify}`,
  "RISKS: none",
].join("\n")

test("VERIFIED requires a passing VERIFY line and full SUCCESS coverage", () => {
  assert.equal(evaluateDone(done("npm test | exit 0 | 55 pass")).outcome, "VERIFIED")
})

test("a worker claim without a VERIFY line is never VERIFIED", () => {
  const message = "TYPE: DONE\nCHANGED: a\nEVIDENCE: all good, coverage 3/3\nRISKS: none"
  assert.equal(evaluateDone(message).outcome, "PARTIAL_WITH_UNKNOWN")
})

test("a non-zero verify exit stays PARTIAL", () => {
  assert.equal(evaluateDone(done("npm test | exit 1 | 2 fail")).outcome, "PARTIAL_WITH_UNKNOWN")
})

test("incomplete SUCCESS coverage stays PARTIAL", () => {
  assert.equal(evaluateDone(done("npm test | exit 0 | 55 pass", "coverage 2/3")).outcome, "PARTIAL_WITH_UNKNOWN")
})

test("TEACHER_REQUEST is not evaluated as DONE", () => {
  assert.equal(evaluateDone("TYPE: TEACHER_REQUEST\nSTATE: MISSING_DECISIVE").outcome, null)
})
