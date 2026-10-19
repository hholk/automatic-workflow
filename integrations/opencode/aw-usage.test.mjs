import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { appendAttestation, compareRecipes, readRuns } from "../../scripts/evidence.mjs"
import { writeSelectionReceipt } from "../../scripts/selection-receipt.mjs"

test("separates native Opus teacher usage and includes cached tokens without double counting", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "aw-plugin-opus-"))
  process.env.AW_STATE_DIR = stateDir
  const { AwUsagePlugin } = await import(`./aw-usage.js?test=opus-${Date.now()}`)
  const hooks = await AwUsagePlugin()
  await hooks["tool.execute.before"]({ tool: "skill", sessionID: "root" }, { args: { name: "aw" } })
  for (const [id, agent, model, tokens] of [
    ["root", "build", "mimo-2.6-flash", { total: 110, input: 5, output: 5, cache: { read: 100 } }],
    ["worker", "aw-worker", "xiaomi-mimo-v2-6-flash", { input: 5, output: 5, cache: { read: 15, write: 5 } }],
    ["teacher", "aw-teacher", "claude-opus-5-5", { total: 50, input: 5, output: 5, cache: { read: 40 } }],
  ]) {
    if (id !== "root") {
      await hooks["tool.execute.before"]({ tool: "task", sessionID: "root" }, { args: { subagent_type: agent } })
      await hooks.event({ event: { type: "session.created", properties: { info: { id, parentID: "root" } } } })
    }
    const event = { type: "message.updated", properties: { info: {
      id, role: "assistant", sessionID: id, agent, providerID: "venice", modelID: model, tokens,
    } } }
    await hooks.event({ event })
    await hooks.event({ event })
  }
  await hooks.event({ event: { type: "session.idle", properties: { sessionID: "root" } } })
  const item = JSON.parse(readFileSync(join(stateDir, "runs.jsonl"), "utf8").trim())
  assert.equal(item.actors.main.tokens, 110)
  assert.equal(item.actors.worker.tokens, 30)
  assert.equal(item.actors.teacher.tokens, 50)
  assert.equal(item.actors.teacher.resolved_model, "venice/claude-opus-5-5")
  assert.equal(item.actors.teacher.requested_model, "venice/claude-opus-5-5")
  assert.equal(item.tokens.operational_total, 190)
  assert.equal(item.friction.teacher_turns, 1)
  assert.equal(item.friction.followups, 0)
  assert.equal(item.timeline.filter(e => e.event === "message" && e.actor === "teacher").length, 1)
})

test("records one prompt-free v4 trace with components and repeated-read waste", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "aw-plugin-"))
  process.env.AW_STATE_DIR = stateDir
  const { AwUsagePlugin } = await import(`./aw-usage.js?test=${Date.now()}`)
  const hooks = await AwUsagePlugin()
  const sessionID = "session-test"

  await hooks["tool.execute.before"]({ tool: "skill", sessionID }, { args: { name: "aw" } })
  await hooks["tool.execute.before"]({ tool: "read", sessionID }, { args: { filePath: "/tmp/workflows/fix.md" } })
  await hooks["tool.execute.before"]({ tool: "read", sessionID }, { args: { filePath: "/tmp/workflows/fix.md" } })
  await hooks["tool.execute.before"]({ tool: "task", sessionID }, { args: {} })
  const message = {
    type: "message.updated",
    properties: { info: { id: "m1", role: "assistant", sessionID, providerID: "venice", modelID: "mimo-2.6-flash", tokens: { input: 80, output: 15, reasoning: 5 } } },
  }
  await hooks.event({ event: message })
  await hooks.event({ event: message })
  await hooks.event({ event: { type: "session.idle", properties: { sessionID } } })

  const item = JSON.parse(readFileSync(join(stateDir, "runs.jsonl"), "utf8").trim())
  assert.deepEqual({ route: item.route, tokens: item.tokens.operational_total }, { route: "fix", tokens: null })
  assert.equal(item.schema_version, 4)
  assert.equal(item.prompt.profile_id, "unknown")
  assert.equal(item.quality.policy_provenance_complete, false)
  assert.deepEqual(item.prompt.loaded_files, ["workflows/fix.md"])
  assert.deepEqual(item.waste_events.map((event) => event.kind), ["repeated_read"])
  assert.equal("prompt_text" in item, false)
  assert.doesNotMatch(JSON.stringify(item), /\/tmp\//)
  assert.doesNotMatch(JSON.stringify(item), /session-test/)
})

test("counts native default-agent task dispatches as worker calls", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "aw-plugin-default-"))
  process.env.AW_STATE_DIR = stateDir
  const { AwUsagePlugin } = await import(`./aw-usage.js?test=default-${Date.now()}`)
  const hooks = await AwUsagePlugin()
  const sessionID = "session-default"
  await hooks["tool.execute.before"]({ tool: "skill", sessionID }, { args: { name: "aw" } })
  await hooks["tool.execute.before"]({ tool: "task", sessionID }, { args: { subagent_type: "general" } })
  await hooks.event({ event: { type: "session.idle", properties: { sessionID } } })

  const item = JSON.parse(readFileSync(join(stateDir, "runs.jsonl"), "utf8").trim())
  assert.equal(item.friction.followups, 0)
  assert.equal(item.route, "unknown")
})

test("joins child tokens and executed models to the active parent run", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "aw-plugin-child-"))
  process.env.AW_STATE_DIR = stateDir
  const { AwUsagePlugin } = await import(`./aw-usage.js?test=child-${Date.now()}`)
  const hooks = await AwUsagePlugin()
  const parentID = "session-parent"
  const childID = "session-child"
  await hooks["tool.execute.before"]({ tool: "skill", sessionID: parentID }, { args: { name: "aw" } })
  await hooks.event({ event: { type: "session.created", properties: { info: { id: childID, parentID } } } })
  await hooks.event({ event: { type: "message.updated", properties: { info: {
    id: "parent-message", role: "assistant", sessionID: parentID,
    providerID: "venice", modelID: "mimo-2.6-flash", tokens: { input: 10, output: 5, reasoning: 5 },
  } } } })
  await hooks.event({ event: { type: "message.updated", properties: { info: {
    id: "child-message", role: "assistant", sessionID: childID,
    providerID: "venice", modelID: "xiaomi-mimo-v2-6-flash", tokens: { input: 40, output: 20, reasoning: 20 },
  } } } })
  await hooks.event({ event: { type: "session.idle", properties: { sessionID: parentID } } })

  const item = JSON.parse(readFileSync(join(stateDir, "runs.jsonl"), "utf8").trim())
  assert.equal(item.actors.main.resolved_model, "venice/mimo-2.6-flash")
  assert.equal(item.actors.main.model_source, "native")
  assert.equal(item.actors.worker.resolved_model, "venice/xiaomi-mimo-v2-6-flash")
  assert.equal(item.tokens.operational_total, 100)
  assert.equal(item.metrics.worker_token_share, 0.8)
  assert.equal(item.quality.eligible, false)
})

test("uses the active playbook version and never reuses child evidence across activations", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "aw-plugin-reactivation-"))
  const playbookPath = join(stateDir, "playbook.json")
  writeFileSync(playbookPath, JSON.stringify({
    schema_version: 4,
    version: "weekly-v7",
    defaults: { recipe_id: "lean-worker-v2", prompt_profile_id: "opencode-gpt6-luna-worker-v1", context_budget: 1200, worker_step_budget: 6, teacher_after_failed_hypotheses: 2 },
    cells: {},
  }))
  process.env.AW_STATE_DIR = stateDir
  process.env.AW_PLAYBOOK_PATH = playbookPath
  const { AwUsagePlugin } = await import(`./aw-usage.js?test=reactivation-${Date.now()}`)
  const hooks = await AwUsagePlugin()
  const parentID = "repeat-parent"
  const childID = "old-child"

  await hooks["tool.execute.before"]({ tool: "skill", sessionID: parentID }, { args: { name: "aw" } })
  await hooks.event({ event: { type: "session.created", properties: { info: { id: childID, parentID } } } })
  await hooks.event({ event: { type: "message.updated", properties: { info: {
    id: "old-message", role: "assistant", sessionID: childID,
    providerID: "venice", modelID: "xiaomi-mimo-v2-6-flash", tokens: { input: 10, output: 10, reasoning: 0 },
  } } } })
  await hooks.event({ event: { type: "session.idle", properties: { sessionID: parentID } } })

  await hooks["tool.execute.before"]({ tool: "skill", sessionID: parentID }, { args: { name: "aw" } })
  await hooks["tool.execute.before"]({ tool: "task", sessionID: parentID }, { args: {} })
  await hooks.event({ event: { type: "session.idle", properties: { sessionID: parentID } } })

  const items = readFileSync(join(stateDir, "runs.jsonl"), "utf8").trim().split("\n").map(JSON.parse)
  assert.equal(items[1].playbook_version, "weekly-v7")
  assert.equal(items[1].recipe_id, "unknown")
  assert.equal(items[1].quality.policy_provenance_complete, false)
  assert.equal(items[1].actors.worker.resolved_model, null)
  delete process.env.AW_PLAYBOOK_PATH
})

const observeRun = async (hooks, rootID) => {
  await hooks["tool.execute.before"]({ tool: "task", sessionID: rootID }, { args: { subagent_type: "aw-worker" } })
  const childID = `${rootID}-worker`
  await hooks.event({ event: { type: "session.created", properties: { info: { id: childID, parentID: rootID } } } })
  for (const [id, agent] of [[rootID, "build"], [childID, "aw-worker"]]) {
    await hooks.event({ event: { type: "message.updated", properties: { info: {
      id: `message-${id}`, role: "assistant", sessionID: id, agent,
      providerID: "venice", modelID: "openai-gpt-6-luna", tokens: { input: 10, output: 5 },
    } } } })
  }
  await hooks.event({ event: { type: "session.idle", properties: { sessionID: rootID } } })
}
const attest = (stateDir, runID) => appendAttestation({ run_id: runID, verify_id: "synthetic-check", verify_exit_code: 0, semantic_success: true, scope_covered: 1, scope_total: 1, review_pass: true, forbidden_changes: 0, accepted_worker_actions: 1, parent_rework: 0 }, stateDir)

test("shell.env and the normal resolver subprocess preserve a selected task cell through idle telemetry", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "aw-plugin-receipt-"))
  const playbookPath = join(stateDir, "playbook.json")
  const priorState = process.env.AW_STATE_DIR
  const priorPlaybook = process.env.AW_PLAYBOOK_PATH
  writeFileSync(playbookPath, JSON.stringify({
    schema_version: 4, version: "cell-policy-v1",
    defaults: { recipe_id: "base-v1", prompt_profile_id: "unused-default-v1", context_budget: 1200, worker_step_budget: 125, teacher_after_failed_hypotheses: 2 },
    cells: { "opencode|known-change|small": { recipe_id: "bounded-v2", prompt_profile_id: "model-bound-v1" } },
  }))
  try {
    process.env.AW_STATE_DIR = stateDir
    process.env.AW_PLAYBOOK_PATH = playbookPath
    const { AwUsagePlugin } = await import(`./aw-usage.js?test=receipt-${Date.now()}`)
    const hooks = await AwUsagePlugin()
    const rootID = "cell-selection"
    await hooks["tool.execute.before"]({ tool: "skill", sessionID: rootID }, { args: { name: "aw" } })
    const output = { env: {} }
    await hooks["shell.env"]({ sessionID: rootID }, output)
    assert.equal(output.env.AW_STATE_DIR, stateDir)
    const result = spawnSync(process.execPath, [new URL("../../scripts/resolve-profile.mjs", import.meta.url).pathname,
      "--host", "opencode", "--role", "worker", "--route", "fix", "--task-class", "known-change", "--complexity", "small", "--playbook", playbookPath,
      "--task-id", "fixture-a", "--snapshot-id", "fixture-rev-1", "--check-version", "fixture-check-v1"], {
      env: { ...process.env, ...output.env }, encoding: "utf8",
    })
    assert.equal(result.status, 0, result.stderr)
    const selected = JSON.parse(result.stdout)
    await observeRun(hooks, rootID)
    const [run] = readRuns(stateDir)
    assert.equal(run.recipe_id, "bounded-v2")
    assert.equal(run.prompt.profile_id, selected.prompt_profile_id)
    assert.equal(run.route, "fix")
    assert.deepEqual(run.task, { id: "fixture-a", snapshot_id: "fixture-rev-1", check_version: "fixture-check-v1", class: "known-change", complexity: "small" })
    assert.notEqual(run.task.id, run.run_id)
    assert.equal(run.playbook_version, "cell-policy-v1")
    assert.equal(run.actors.worker.requested_model, "venice/openai-gpt-6-luna")
    assert.equal(run.actors.worker.resolved_model, "venice/openai-gpt-6-luna")
    assert.equal(run.actors.worker.fallback_reason, null)
    assert.equal(run.quality.policy_provenance_complete, true)
    attest(stateDir, run.run_id)
    assert.equal(readRuns(stateDir)[0].quality.eligible, true)
  } finally {
    if (priorState === undefined) delete process.env.AW_STATE_DIR
    else process.env.AW_STATE_DIR = priorState
    if (priorPlaybook === undefined) delete process.env.AW_PLAYBOOK_PATH
    else process.env.AW_PLAYBOOK_PATH = priorPlaybook
    rmSync(stateDir, { recursive: true, force: true })
  }
})

test("missing, stale and mixed policy receipts remain unknown and ineligible after attestation", async () => {
  const priorState = process.env.AW_STATE_DIR
  const priorPlaybook = process.env.AW_PLAYBOOK_PATH
  try {
    for (const mode of ["missing", "stale", "mixed"]) {
      const stateDir = mkdtempSync(join(tmpdir(), `aw-plugin-${mode}-`))
      try {
        process.env.AW_STATE_DIR = stateDir
        delete process.env.AW_PLAYBOOK_PATH
        const { AwUsagePlugin } = await import(`./aw-usage.js?test=${mode}-receipt-${Date.now()}`)
        const hooks = await AwUsagePlugin()
        const rootID = `${mode}-root`
        await hooks["tool.execute.before"]({ tool: "skill", sessionID: rootID }, { args: { name: "aw" } })
        const output = { env: {} }
        await hooks["shell.env"]({ sessionID: rootID }, output)
        const selection = { role: "worker", route: "fix", task_class: "known-change", complexity: "small", model: "venice/openai-gpt-6-luna", profile_id: "opencode-gpt6-luna-worker-v1", prompt_profile_id: "model-bound-v1", recipe_id: "base-v1", effective_policy: { playbook_version: output.env.AW_PLAYBOOK_VERSION, capabilities: { profile_host: "opencode" } } }
        if (mode !== "missing") writeSelectionReceipt({ runID: output.env.AW_RUN_ID, selection, stateDir, atMs: mode === "stale" ? Date.now() - 100000 : Date.now() })
        if (mode === "mixed") writeSelectionReceipt({ runID: output.env.AW_RUN_ID, selection: { ...selection, recipe_id: "lean-worker-v2" }, stateDir })
        await observeRun(hooks, rootID)
        const [run] = readRuns(stateDir)
        attest(stateDir, run.run_id)
        const [attested] = readRuns(stateDir)
        assert.equal(attested.recipe_id, "unknown", mode)
        assert.equal(attested.prompt.profile_id, "unknown", mode)
        assert.equal(attested.actors.worker.requested_model, null, mode)
        assert.equal(attested.quality.attested, true, mode)
        assert.equal(attested.quality.policy_provenance_complete, false, mode)
        assert.equal(attested.quality.eligible, false, mode)
      } finally { rmSync(stateDir, { recursive: true, force: true }) }
    }
  } finally {
    if (priorState === undefined) delete process.env.AW_STATE_DIR
    else process.env.AW_STATE_DIR = priorState
    if (priorPlaybook === undefined) delete process.env.AW_PLAYBOOK_PATH
    else process.env.AW_PLAYBOOK_PATH = priorPlaybook
  }
})

test("automatic fixture traces pair across runs while snapshot, check and T3 frontend changes stay separate", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "aw-plugin-paired-fixtures-"))
  const playbookPath = join(stateDir, "playbook.json")
  const priorState = process.env.AW_STATE_DIR
  const priorPlaybook = process.env.AW_PLAYBOOK_PATH
  try {
    process.env.AW_STATE_DIR = stateDir
    process.env.AW_PLAYBOOK_PATH = playbookPath
    const { AwUsagePlugin } = await import(`./aw-usage.js?test=paired-fixtures-${Date.now()}`)
    const hooks = await AwUsagePlugin()
    const runFixture = async (version, index, { snapshot = "fixture-rev-a", check = "fixture-check-v1", frontend = "t3" } = {}) => {
      writeFileSync(playbookPath, JSON.stringify({ schema_version: 4, version,
        defaults: { recipe_id: "base-v1", prompt_profile_id: "model-bound-v1", context_budget: 1200,
          worker_step_budget: 125, teacher_after_failed_hypotheses: 2 }, cells: {} }))
      const rootID = `synthetic-${version}-${index}`
      await hooks["tool.execute.before"]({ tool: "skill", sessionID: rootID }, { args: { name: "aw" } })
      const output = { env: {} }
      await hooks["shell.env"]({ sessionID: rootID }, output)
      const selected = spawnSync(process.execPath, [new URL("../../scripts/resolve-profile.mjs", import.meta.url).pathname,
        "--host", frontend, ...(frontend === "t3" ? ["--provider-host", "opencode"] : []), "--role", "worker", "--route", "fix",
        "--task-class", "known-change", "--complexity", "small", "--task-id", `fixture-${index}`, "--snapshot-id", snapshot,
        "--check-version", check, "--playbook", playbookPath], {
        encoding: "utf8", timeout: 5000, env: { ...process.env, ...output.env },
      })
      assert.equal(selected.status, 0, selected.stderr)
      assert.equal(JSON.parse(selected.stdout).model_capability.status, "unverified")
      await observeRun(hooks, rootID)
      attest(stateDir, output.env.AW_RUN_ID)
      return readRuns(stateDir).find((run) => run.run_id === output.env.AW_RUN_ID)
    }
    for (const version of ["baseline", "candidate"]) {
      for (let index = 0; index < 5; index++) {
        const run = await runFixture(version, index)
        assert.equal(run.frontend_host, "t3")
        assert.equal(run.provider_host, "opencode")
        assert.equal(run.host, "opencode")
        assert.match(run.cell_id, /^t3>opencode\|/)
        assert.equal(run.quality.eligible, true)
      }
    }
    const runs = readRuns(stateDir)
    const pair = runs.filter((run) => run.task.id === "fixture-0")
    assert.notEqual(pair[0].run_id, pair[1].run_id)
    assert.equal(compareRecipes(pair, "baseline", "candidate").cells[0].matched_pairs, 1)
    const comparison = compareRecipes(runs, "baseline", "candidate")
    assert.equal(comparison.cells[0].matched_pairs, 5)
    assert.equal(comparison.verdict, "no-change")
    for (const [version, change] of [["snapshot-changed", { snapshot: "fixture-rev-b" }],
      ["check-changed", { check: "fixture-check-v2" }], ["native-host", { frontend: "opencode" }]]) {
      const changed = await runFixture(version, 0, change)
      const result = compareRecipes([pair[0], changed], "baseline", version)
      assert.equal(result.cells.reduce((sum, cell) => sum + cell.matched_pairs, 0), 0)
      assert.equal(result.verdict, "insufficient-data")
    }
  } finally {
    if (priorState === undefined) delete process.env.AW_STATE_DIR
    else process.env.AW_STATE_DIR = priorState
    if (priorPlaybook === undefined) delete process.env.AW_PLAYBOOK_PATH
    else process.env.AW_PLAYBOOK_PATH = priorPlaybook
    rmSync(stateDir, { recursive: true, force: true })
  }
})
