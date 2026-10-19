import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync, readdirSync, symlinkSync, readFileSync, unlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { writeSelectionReceipt, readSelectionReceipt } from "./selection-receipt.mjs"
import { normalizeRun, compareRecipes } from "./evidence.mjs"

const selection = (changes = {}) => ({ role: "worker", route: "fix", task_class: "known-change", complexity: "small", model: "venice/openai-gpt-6-luna", profile_id: "opencode-gpt6-luna-worker-v1", prompt_profile_id: "model-bound-v1", recipe_id: "lean-worker-v2", effective_policy: { playbook_version: "weekly-v2", capabilities: { profile_host: "opencode" } }, ...changes })
const fixture = () => {
  const stateDir = mkdtempSync(join(tmpdir(), "aw-selection-"))
  const scope = { stateDir, runID: "run:synthetic", profileHost: "opencode", playbookVersion: "weekly-v2", startedAt: 100, endedAt: 200 }
  return { stateDir, scope, put: (changes = {}, atMs = 150) => writeSelectionReceipt({ ...scope, selection: selection(changes), atMs }) }
}

test("receipt preserves only prompt-free selected identity and accepts repeated identical selection", () => {
  const f = fixture()
  try {
    f.put({ arbitrary_prompt: "never stored" })
    f.put()
    const result = readSelectionReceipt(f.scope)
    assert.equal(result.complete, true)
    assert.equal(result.receipt.recipe_id, "lean-worker-v2")
    assert.equal(result.receipt.requested_worker_model, "venice/openai-gpt-6-luna")
    assert.equal("arbitrary_prompt" in result.receipt, false)
    assert.equal(readdirSync(join(f.stateDir, "selections")).length, 1)
  } finally { rmSync(f.stateDir, { recursive: true, force: true }) }
})

test("missing, stale, foreign, future and mixed receipts cannot identify a policy", () => {
  for (const change of ["missing", "stale", "future", "host", "version", "mixed"]) {
    const f = fixture()
    try {
      if (change !== "missing") f.put({}, change === "stale" ? 99 : change === "future" ? 201 : 150)
      if (change === "mixed") f.put({ recipe_id: "base-v1" }, 160)
      const result = readSelectionReceipt({ ...f.scope, ...(change === "host" ? { profileHost: "codex" } : {}), ...(change === "version" ? { playbookVersion: "old" } : {}) })
      assert.equal(result.complete, false, change)
      assert.equal(result.receipt, null)
    } finally { rmSync(f.stateDir, { recursive: true, force: true }) }
  }
})

test("receipts preserve frontend/provider and reject mixed task or provider selections", () => {
  const f = fixture()
  const task = { id: "fixture-a", snapshot_id: "sha256:revision-a", check_version: "check-v1" }
  try {
    f.put({ host: "t3", task_identity: task })
    let result = readSelectionReceipt(f.scope)
    assert.equal(result.receipt.frontend_host, "t3")
    assert.equal(result.receipt.provider_host, "opencode")
    assert.equal(result.receipt.task_id, "fixture-a")
    assert.throws(() => f.put({ host: "codex" }), /must match providerHost/)
    f.put({ host: "t3", task_identity: { ...task, snapshot_id: "sha256:revision-b" } })
    result = readSelectionReceipt(f.scope)
    assert.equal(result.reason, "MIXED_SELECTION_RECEIPTS")
  } finally { rmSync(f.stateDir, { recursive: true, force: true }) }
})

test("receipts require complete selected metadata and reject corrupt or oversized ledgers", () => {
  const f = fixture()
  try {
    for (const changes of [{ role: "teacher" }, { task_class: null }, { complexity: "unknown" }, { route: "invented" }, { model: "private prompt text" }]) {
      assert.throws(() => f.put(changes), /INVALID_SELECTION_RECEIPT/)
    }
    f.put()
    const path = join(f.stateDir, "selections", readdirSync(join(f.stateDir, "selections"))[0])
    writeFileSync(path, "{broken")
    assert.equal(readSelectionReceipt(f.scope).reason, "INVALID_SELECTION_RECEIPT")
    writeFileSync(path, " ".repeat(1024 * 1024 + 1))
    assert.equal(readSelectionReceipt(f.scope).reason, "SELECTION_RECEIPT_TOO_LARGE")
  } finally { rmSync(f.stateDir, { recursive: true, force: true }) }
})

const quality = { verify_id: "test", verify_exit_code: 0, semantic_success: true, scope_covered: 1, scope_total: 1, review_pass: true, forbidden_changes: 0 }
const unknownRun = (version, index) => ({ schema_version: 4, kind: "run", run_id: `${version}-${index}`, host: "opencode", route: "fix", task: { id: `task-${index}`, class: "unknown", complexity: "unknown" }, recipe_id: "unknown", playbook_version: version, prompt: { profile_id: "unknown" }, actors: {
  main: { used: true, requested_model: "main", resolved_model: "main", model_source: "native", token_source: "native", tokens: 10 },
  worker: { used: true, requested_model: "worker", resolved_model: "worker", model_source: "native", token_source: "native", tokens: version === "base" ? 100 : 50 },
  teacher: { used: false, model_source: "unknown", token_source: "unknown", tokens: null },
}, quality: { policy_provenance_complete: false }, outcome: "PARTIAL_WITH_UNKNOWN" })

test("unknown policy provenance survives host attestation and prevents comparison", () => {
  const runs = []
  for (let index = 0; index < 5; index++) {
    for (const version of ["base", "candidate"]) {
      const run = normalizeRun(unknownRun(version, index), { ...quality, policy_provenance_complete: true })
      assert.equal(run.quality.attested, true)
      assert.equal(run.quality.policy_provenance_complete, false)
      assert.equal(run.quality.eligible, false)
      assert.equal(normalizeRun(run, quality).quality.policy_provenance_complete, false)
      runs.push(run)
    }
  }
  assert.equal(compareRecipes(runs, "base", "candidate").verdict, "insufficient-data")
  const explicitlyIncomplete = unknownRun("base", 6)
  explicitlyIncomplete.recipe_id = "base-v1"
  explicitlyIncomplete.prompt.profile_id = "model-bound-v1"
  assert.equal(normalizeRun(explicitlyIncomplete, quality).quality.eligible, false)
})


test("receipt I/O rejects symlinked state roots, directories and final files without touching targets", () => {
  const f = fixture()
  const foreign = mkdtempSync(join(tmpdir(), "aw-receipt-foreign-"))
  try {
    const target = join(foreign, "target.jsonl")
    writeFileSync(target, "foreign content stays private")
    const rootLink = join(foreign, "root-link")
    symlinkSync(f.stateDir, rootLink, "dir")
    assert.throws(() => writeSelectionReceipt({ ...f.scope, stateDir: rootLink, selection: selection() }), /UNSAFE_RECEIPT_DIRECTORY/)
    assert.equal(readSelectionReceipt({ ...f.scope, stateDir: rootLink }).complete, false)
    symlinkSync(foreign, join(f.stateDir, "selections"), "dir")
    assert.throws(() => f.put(), /UNSAFE_RECEIPT_DIRECTORY/)
    assert.equal(readSelectionReceipt(f.scope).complete, false)
    assert.deepEqual(readdirSync(foreign).sort(), ["root-link", "target.jsonl"])
    unlinkSync(join(f.stateDir, "selections"))
    f.put()
    const path = join(f.stateDir, "selections", readdirSync(join(f.stateDir, "selections"))[0])
    const validContent = readFileSync(path, "utf8")
    writeFileSync(target, validContent)
    unlinkSync(path)
    symlinkSync(target, path)
    assert.throws(() => f.put())
    assert.equal(readSelectionReceipt(f.scope).complete, false)
    assert.equal(readFileSync(target, "utf8"), validContent)
  } finally {
    rmSync(f.stateDir, { recursive: true, force: true })
    rmSync(foreign, { recursive: true, force: true })
  }
})
