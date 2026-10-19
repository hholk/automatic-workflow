import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const cli = fileURLToPath(new URL("./execution-state-cli.mjs", import.meta.url))
const invoke = (action, input, extra = []) => {
  const result = spawnSync(process.execPath, [cli, action, ...extra], { input: typeof input === "string" ? input : JSON.stringify(input), encoding: "utf8", maxBuffer: 2 * 1024 * 1024 })
  assert.equal(result.error, undefined)
  assert.equal(result.stderr, "")
  return { status: result.status, value: JSON.parse(result.stdout) }
}
const brief = { version: 1, task_id: "synthetic", objective_revision: "1", snapshot_id: "1", objective: "Preserve a title", success: [{ id: 1, claim: "Saving preserves the entered title", verify: { check_id: "title", check_version: "1", command: "synthetic check", expected: "Saved title matches input" } }] }

test("CLI accepts bounded synthetic stdin and returns a denied gate with nonzero status", () => {
  assert.deepEqual(invoke("brief", brief), { status: 0, value: { allowed: true, reason: null } })
  assert.deepEqual(invoke("acceptance", { brief, evidence: [] }), { status: 1, value: { accepted: false, reason: "UNIQUE_EVIDENCE_REQUIRED" } })
  for (const action of ["reuse", "route", "recovery", "authority", "dispatch"]) {
    assert.equal(invoke(action, {}).status, 1)
  }
})

test("CLI rejects invalid JSON, nonobjects, unknown actions and file arguments without effects", () => {
  assert.deepEqual(invoke("brief", "{"), { status: 1, value: { allowed: false, reason: "INVALID_JSON" } })
  for (const value of ["null", "[]", "1"]) assert.equal(invoke("brief", value).value.reason, "OBJECT_INPUT_REQUIRED")
  for (const action of ["__proto__", "exec", "../task.json"]) {
    assert.deepEqual(invoke(action, {}), { status: 1, value: { allowed: false, reason: "UNKNOWN_ACTION" } })
  }
  assert.equal(invoke("brief", brief, ["/etc/passwd"]).value.reason, "ONE_ACTION_REQUIRED")
  assert.equal(invoke("acceptance", { brief: null }).status, 1)
  assert.equal(invoke("acceptance", { brief: { ...brief, success: [null] } }).status, 1)
})

test("CLI stops reading when synthetic stdin exceeds one MiB", () => {
  assert.deepEqual(invoke("brief", " ".repeat(1024 * 1024 + 1)), { status: 1, value: { allowed: false, reason: "INPUT_TOO_LARGE" } })
})
