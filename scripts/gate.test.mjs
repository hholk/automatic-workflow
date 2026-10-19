import test from "node:test"
import assert from "node:assert/strict"
import { evaluateDone } from "./gate.mjs"
import { spawnSync } from "node:child_process"

const done = (verify, coverage = "coverage 3/3") => [
  "TYPE: DONE",
  "CHANGED: src/a.ts",
  "EVIDENCE: src/a.ts, npm test, exit 0, all green; " + coverage,
  `VERIFY: ${verify}`,
  "RISKS: none",
].join("\n")

test("a passing worker report remains preliminary without versioned main acceptance", () => {
  assert.equal(evaluateDone(done("npm test | exit 0 | 55 pass")).outcome, "PARTIAL_WITH_UNKNOWN")
  assert.equal(evaluateDone(done("npm test | exit 0 | no tests", "coverage 0/0")).outcome, "PARTIAL_WITH_UNKNOWN")
})

test("normal gate CLI requires scoped acceptance and rejects stale proof", () => {
  const scope = { task_id: "task", objective_revision: "r1", snapshot_id: "s1" }
  const verify = { check_id: "behavior", check_version: "1", command: "node --test", expected: "behavior passes" }
  const observed = { command: "node --test", exit_code: 0, result: "passed", result_ref: "output:1" }
  const evidence = { version: 1, ...scope, criterion_id: 1, check_id: "behavior", check_version: "1", evidence_ref: "worker:1", status: "passed", verify: observed }
  const acceptance = { brief: { version: 1, ...scope, objective: "Preserve saving behavior", success: [{ id: 1, claim: "Saving persists the value", verify }] },
    evidence: [evidence], main_confirmation: { version: 1, ...scope, actor: "main", integrated: true, status: "passed", evidence_ref: "main:1", criterion_ids: [1], evidence_refs: ["worker:1"], verify: observed } }
  const run = () => spawnSync(process.execPath, [new URL("./gate.mjs", import.meta.url).pathname], {
    input: JSON.stringify({ message: done("node --test | exit 0 | behavior passes", "coverage 1/1"), acceptance }), encoding: "utf8" })
  let result = run()
  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).outcome, "VERIFIED")
  acceptance.evidence[0].snapshot_id = "old"
  result = run()
  assert.equal(result.status, 1)
  assert.equal(JSON.parse(result.stdout).outcome, "PARTIAL_WITH_UNKNOWN")
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
