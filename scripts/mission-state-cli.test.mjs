import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { fixture } from "./test-fixtures/mission.mjs"

const cli = fileURLToPath(new URL("./mission-state-cli.mjs", import.meta.url))
const mission = (t) => {
  const workspace = mkdtempSync(join(tmpdir(), "aw-mission-cli-"))
  t.after(() => rmSync(workspace, { recursive: true, force: true }))
  const data = fixture()
  const identity = { workspace, task_id: data.brief.task_id, stateDir: join(workspace, "state") }
  const invoke = (action, input, expectedStatus = 0) => {
    const run = spawnSync(process.execPath, [cli, action], { input: JSON.stringify({ ...identity, ...input }), encoding: "utf8" })
    assert.equal(run.status, expectedStatus, run.stdout + run.stderr)
    return JSON.parse(run.stdout)
  }
  return { ...data, invoke }
}

test("export-tsv uses the persisted mission identity without a snapshot", (t) => {
  const { brief, invoke } = mission(t)
  assert.equal(invoke("export-tsv", {}, 1).allowed, false)
  const result = invoke("write", { brief, snapshot_id: brief.snapshot_id, event_id: "init", expected_sequence: -1, next_action: "Private instructions" })
  assert.deepEqual(Object.keys(result).sort(), ["allowed", "state"])
  const { allowed, tsv } = invoke("export-tsv")
  assert.equal(allowed, true)
  assert.match(tsv, /timestamp\tsequence\tevent_id\ttype\tdecision\treason\tevidence_ref\tresult\n.*\t0\tinit\tinit\t/)
  assert.doesNotMatch(tsv, /Private instructions/)
})

test("accept exposes attestation as a sibling of state without claiming a direct task was reviewed", (t) => {
  const { brief, confirmation, evidence, invoke } = mission(t)
  const snapshot = { snapshot_id: brief.snapshot_id }
  invoke("write", { ...snapshot, brief: { ...brief, assurance: "direct" }, event_id: "init", expected_sequence: -1, next_action: "Verify" })
  invoke("write", { ...snapshot, event_id: "verified", expected_sequence: 0, event: { type: "evidence", evidence: [evidence], next_action: "Accept" } })
  const acceptance = invoke("write", { ...snapshot, event_id: "accepted", expected_sequence: 1,
    event: { type: "accept", main_confirmation: confirmation, next_action: "Report" } })
  assert.equal(acceptance.allowed, true)
  assert.equal(acceptance.state.status, "done")
  assert.equal(acceptance.attestation_payload.verify_id, confirmation.verify.result_ref)
  assert.equal(acceptance.attestation_payload.review_pass, null)
  assert.equal(Object.hasOwn(acceptance.state, "attestation_payload"), false)
})
