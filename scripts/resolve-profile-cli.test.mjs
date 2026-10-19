import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { buildCellID } from "./evidence.mjs"
import { readSelectionReceipt } from "./selection-receipt.mjs"
import { closeRunContext, createRunContext } from "./run-context.mjs"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const registry = JSON.parse(readFileSync(join(root, "prompts/profiles.json"), "utf8"))
const current = JSON.parse(readFileSync(join(root, "playbooks/current.json"), "utf8"))
const actor = (model) => ({ used: true, requested_model: model, resolved_model: model, model_source: "provider", fallback_reason: null })
const actors = { main: actor(registry.main_default), worker: actor(registry.worker_defaults.opencode), teacher: { used: false } }
const base = ["--host", "opencode", "--role", "worker", "--route", "fix", "--task-class", "bug", "--complexity", "small"]
const run = (args) => spawnSync(process.execPath, [join(root, "scripts/resolve-profile.mjs"), ...base, ...args], {
  encoding: "utf8", timeout: 5000, env: { ...process.env, AW_RUN_ID: "", AW_RUN_CONTEXT: "" },
})
const json = (path, value) => { writeFileSync(path, JSON.stringify(value)); return path }
const fixture = () => mkdtempSync(join(tmpdir(), "aw-resolver-cli-"))

test("installed skill symlink runs the real resolver CLI", () => {
  const dir = fixture()
  try {
    symlinkSync(root, join(dir, "aw"), "dir")
    const result = spawnSync(process.execPath, [join(dir, "aw/scripts/resolve-profile.mjs"), ...base], {
      encoding: "utf8", timeout: 5000, env: { ...process.env, AW_RUN_ID: "", AW_RUN_CONTEXT: "" },
    })
    assert.equal(result.status, 0, result.stderr)
    const selected = JSON.parse(result.stdout)
    assert.equal(selected.model, registry.worker_defaults.opencode)
    assert.equal(selected.native_agent, "aw-worker")
  } finally { rmSync(dir, { recursive: true }) }
})

test("CLI modules remain importable from stdin without running their entrypoints", () => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-"], {
    input: `await import(${JSON.stringify(new URL("./resolve-profile.mjs", import.meta.url).href)}); await import(${JSON.stringify(new URL("./install-agents.mjs", import.meta.url).href)}); process.stdout.write("imported")`,
    encoding: "utf8", timeout: 5000, env: { ...process.env, AW_RUN_ID: "", AW_RUN_CONTEXT: "" },
  })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, "imported")
})

test("normal resolver CLI selects an exact promoted cell only with observed actor metadata", () => {
  const dir = fixture()
  try {
    const cellID = buildCellID({ host: "opencode", actors, route: "fix", task: { class: "bug", complexity: "small" }, promptProfileID: current.defaults.prompt_profile_id })
    const book = json(join(dir, "policy.json"), { ...current, cells: { [cellID]: { context_budget: 500, recipe_id: "base-v1" } } })
    const metadata = json(join(dir, "actors.json"), actors)
    const observed = run(["--playbook", book, "--actors", metadata])
    assert.equal(observed.status, 0, observed.stderr)
    const selected = JSON.parse(observed.stdout)
    assert.equal(selected.effective_policy.policy_cell_id, cellID)
    assert.equal(selected.budget.context_tokens, 500)
    assert.equal(selected.recipe_id, "base-v1")
    const absent = run(["--playbook", book])
    assert.equal(absent.status, 0, absent.stderr)
    assert.equal(JSON.parse(absent.stdout).budget.context_tokens, current.defaults.context_budget)
    assert.equal(JSON.parse(absent.stdout).effective_policy.policy_cell_id, null)
    assert.deepEqual(JSON.parse(readFileSync(metadata, "utf8")), actors)
  } finally { rmSync(dir, { recursive: true }) }
})

test("CLI rejects unknown model sources, missing actual models, mismatched workers and raw fields", () => {
  const dir = fixture()
  try {
    for (const change of [{ model_source: "unknown" }, { model_source: undefined }, { resolved_model: null },
      { resolved_model: "venice/other", requested_model: "venice/other" }, { transcript: "private raw text" }]) {
      const metadata = json(join(dir, "actors.json"), { ...actors, worker: { ...actors.worker, ...change } })
      const value = run(["--actors", metadata])
      assert.equal(value.status, 1)
      assert.equal(value.stdout, "")
      assert.match(value.stderr, /requires requested and resolved models|must match the selected worker|supported actor metadata/)
    }
    writeFileSync(join(dir, "actors.json"), " ".repeat(16385))
    assert.match(run(["--actors", join(dir, "actors.json")]).stderr, /exceeds 16384 bytes/)
    assert.match(run(["--actors"]).stderr, /--actors requires a value/)
  } finally { rmSync(dir, { recursive: true }) }
})

const lesson = (id, patch = {}) => ({
  id, project_id: "project-a", project_versions: ["rev-a"], policy_versions: [current.version],
  prerequisites: { runtime: "node22" }, instruction: "Use the declared package test command for this project.",
  author: "author-a", review: { decision: "approve", reviewed_by: "reviewer-b", reviewed_at: "2020-01-01T00:00:00Z" },
  expires_at: "2099-01-01T00:00:00Z", ...patch,
})
test("normal worker CLI returns only current reviewed lessons for exact project, policy and prerequisites", () => {
  const dir = fixture()
  try {
    const lessons = json(join(dir, "lessons.json"), [lesson("current"), lesson("wrong-project", { project_id: "other" }),
      lesson("wrong-version", { project_versions: ["rev-b"] }), lesson("wrong-policy", { policy_versions: ["acceptance-routing-v0"] }),
      lesson("wrong-prerequisite", { prerequisites: { runtime: "different" } }), lesson("expired", { expires_at: "2021-01-01T00:00:00Z" })])
    const prerequisites = json(join(dir, "prerequisites.json"), { runtime: "node22" })
    const args = ["--lessons", lessons, "--project", "project-a", "--project-version", "rev-a", "--prerequisites", prerequisites]
    const selected = run(args)
    assert.equal(selected.status, 0, selected.stderr)
    assert.deepEqual(JSON.parse(selected.stdout).lessons.map((entry) => entry.id), ["current"])
    assert.equal(JSON.parse(selected.stdout).lessons[0].instruction, lesson("current").instruction)
    assert.match(run([...args, "--project-version", "rev-b"]).stderr, /may be supplied only once/)
    // A separate invocation with mismatched context cannot reuse a previous selection.
    const mismatch = run(["--lessons", lessons, "--project", "other-project", "--project-version", "rev-a", "--prerequisites", prerequisites])
    assert.equal(mismatch.status, 0, mismatch.stderr)
    assert.deepEqual(JSON.parse(mismatch.stdout).lessons, [])
    assert.match(run(["--lessons", lessons]).stderr, /requires --project/)
    const teacher = spawnSync(process.execPath, [join(root, "scripts/resolve-profile.mjs"), "--host", "codex", "--role", "teacher", "--route", "teacher", ...args], { encoding: "utf8", env: { ...process.env, AW_RUN_ID: "", AW_RUN_CONTEXT: "" } })
    assert.equal(teacher.status, 0, teacher.stderr)
    assert.equal(Object.hasOwn(JSON.parse(teacher.stdout), "lessons"), false)
    assert.equal(JSON.parse(teacher.stdout).native_agent, "aw-teacher")
  } finally { rmSync(dir, { recursive: true }) }
})

test("resolver records explicit run selection using actual T3 provider host without prompts", () => {
  const dir = fixture()
  try {
    const invocation = (args, runID = "") => spawnSync(process.execPath, [join(root, "scripts/resolve-profile.mjs"), ...args], {
      encoding: "utf8", env: { ...process.env, AW_RUN_ID: runID, AW_RUN_CONTEXT: "", AW_STATE_DIR: dir },
    })
    const selected = invocation(["--host", "t3", "--provider-host", "opencode", "--role", "worker", "--route", "fix", "--task-class", "bug", "--complexity", "small", "--run-id", "resolver-explicit-run",
      "--task-id", "fixture-a", "--snapshot-id", "sha256:fixture-rev-a", "--check-version", "acceptance-v1"])
    assert.equal(selected.status, 0, selected.stderr)
    assert.equal(JSON.parse(selected.stdout).selection_receipt.status, "RECORDED")
    const receipt = readSelectionReceipt({ runID: "resolver-explicit-run", profileHost: "opencode", playbookVersion: current.version,
      startedAt: 0, endedAt: Date.now(), stateDir: dir })
    assert.equal(receipt.complete, true, receipt.reason)
    assert.equal(receipt.receipt.profile_host, "opencode")
    assert.equal(receipt.receipt.frontend_host, "t3")
    assert.equal(receipt.receipt.provider_host, "opencode")
    assert.equal(receipt.receipt.task_id, "fixture-a")
    assert.equal(receipt.receipt.snapshot_id, "sha256:fixture-rev-a")
    assert.equal(receipt.receipt.check_version, "acceptance-v1")
    assert.equal(JSON.parse(selected.stdout).model_capability.status, "unverified")
    assert.equal(receipt.receipt.playbook_version, current.version)
    assert.equal(receipt.receipt.recipe_id, current.defaults.recipe_id)
    assert.equal(receipt.receipt.prompt_profile_id, current.defaults.prompt_profile_id)
    assert.equal(receipt.receipt.route, "fix")
    assert.equal(receipt.receipt.task_class, "bug")
    assert.equal(receipt.receipt.complexity, "small")
    assert.equal(receipt.receipt.requested_worker_model, registry.worker_defaults.opencode)
    assert.equal(Object.hasOwn(receipt.receipt, "lessons"), false)
    const envRun = invocation(base, "resolver-environment-run")
    assert.equal(envRun.status, 0, envRun.stderr)
    assert.equal(readSelectionReceipt({ runID: "resolver-environment-run", profileHost: "opencode", playbookVersion: current.version,
      startedAt: 0, endedAt: Date.now(), stateDir: dir }).complete, true)
    const legacy = invocation(["--host", "opencode", "--role", "worker", "--route", "fix"], "resolver-legacy-run")
    assert.equal(legacy.status, 0, legacy.stderr)
    assert.deepEqual(JSON.parse(legacy.stdout).selection_receipt, { status: "UNRECORDED", reason: "MISSING_TASK_IDENTITY" })
    for (const args of [["--task-id", "fixture-a"], ["--task-id", "private task text", "--snapshot-id", "rev", "--check-version", "v1"]]) {
      const partial = invocation([...base, ...args], "rejected-task")
      assert.equal(partial.status, 1)
      assert.match(partial.stderr, /task identity requires/)
      assert.equal(readSelectionReceipt({ runID: "rejected-task", profileHost: "opencode", playbookVersion: current.version,
        startedAt: 0, endedAt: Date.now(), stateDir: dir }).complete, false)
    }
  } finally { rmSync(dir, { recursive: true }) }
})

test("resolver transports exact contexts without run-ID arguments and rejects stale, foreign or conflicting context", () => {
  const dir = fixture()
  const token = createRunContext({ stateDir: dir, runID: "opencode:context-fixture", profileHost: "opencode",
    playbookVersion: current.version, scopeRef: "a".repeat(64) })
  const invoke = (contextToken, host = "opencode", runID = "") => spawnSync(process.execPath, [join(root, "scripts/resolve-profile.mjs"),
    "--host", host, ...base.slice(2)], {
    encoding: "utf8", timeout: 5000, env: { ...process.env, AW_STATE_DIR: dir, AW_RUN_CONTEXT: contextToken, AW_RUN_ID: runID },
  })
  try {
    const selected = invoke(token)
    assert.equal(selected.status, 0, selected.stderr)
    assert.equal(JSON.parse(selected.stdout).selection_receipt.source, "run-context")
    assert.equal(JSON.parse(selected.stdout).model_capability.status, "unverified")
    const receipt = readSelectionReceipt({ stateDir: dir, runID: "opencode:context-fixture", profileHost: "opencode",
      playbookVersion: current.version, startedAt: 0, endedAt: Date.now() })
    assert.equal(receipt.complete, true)
    for (const result of [invoke(token, "codex"), invoke(token, "opencode", "foreign-run"), invoke("../private")]) {
      assert.equal(result.status, 1)
      assert.equal(result.stdout, "")
    }
    const expired = createRunContext({ stateDir: dir, runID: "opencode:expired-fixture", profileHost: "opencode",
      playbookVersion: current.version, scopeRef: "b".repeat(64), now: 0 })
    assert.match(invoke(expired, "opencode", "fallback-not-allowed").stderr, /STALE_OR_FOREIGN_RUN_CONTEXT/)
    closeRunContext({ stateDir: dir, token })
    assert.equal(invoke(token).status, 1)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
