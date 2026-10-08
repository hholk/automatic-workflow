import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

test("separates native Opus teacher usage and includes cached tokens without double counting", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "aw-plugin-opus-"))
  process.env.AW_STATE_DIR = stateDir
  const { AwUsagePlugin } = await import(`./aw-usage.js?test=opus-${Date.now()}`)
  const hooks = await AwUsagePlugin()
  await hooks["tool.execute.before"]({ tool: "skill", sessionID: "root" }, { args: { name: "aw" } })
  for (const [id, agent, model, tokens] of [
    ["root", "build", "mimo-2.6-flash", { total: 110, input: 5, output: 5, cache: { read: 100 } }],
    ["worker", "aw-mimo-worker", "xiaomi-mimo-v2-6-flash", { input: 5, output: 5, cache: { read: 15, write: 5 } }],
    ["teacher", "aw-opus-teacher", "claude-opus-5-5", { total: 50, input: 5, output: 5, cache: { read: 40 } }],
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
  assert.equal(item.prompt.profile_id, "model-bound-v1")
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
    defaults: { recipe_id: "lean-worker-v2", prompt_profile_id: "opencode-haiku-worker-v1", context_budget: 1200, worker_step_budget: 6, teacher_after_failed_hypotheses: 2 },
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
  assert.equal(items[1].recipe_id, "lean-worker-v2")
  assert.equal(items[1].actors.worker.resolved_model, null)
  delete process.env.AW_PLAYBOOK_PATH
})
