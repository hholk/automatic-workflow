import test from "node:test"
import assert from "node:assert/strict"
import { AwSupervisorPlugin, __testing } from "./aw-supervisor.js"

const hooks = await AwSupervisorPlugin()
test("records defensive tool before/after evidence without payloads", async () => {
  await hooks["tool.execute.before"]({ sessionID: "s", tool: "bash", args: { command: "secret=hidden" } })
  await hooks["tool.execute.after"]({ sessionID: "s", tool: "bash", args: { command: "secret=hidden" } }, { output: "changed src/a.js" })
  const events = __testing.state.get("s").events
  assert.equal(events.length, 2); assert.equal(JSON.stringify(events).includes("hidden"), false); assert.ok(events[1].result.signature)
})
test("handles realistic event fixtures, idle observation, and compaction", async () => {
  for (const type of ["file.edited", "session.diff", "lsp.client.diagnostics", "lsp.updated", "permission.asked", "permission.replied", "session.status", "session.compacted"]) await hooks.event({ event: { type, properties: { sessionID: "e", path: "src/a.js", status: "ok" } } })
  await hooks.event({ event: { type: "session.idle", properties: { sessionID: "e" } } })
  const output = { context: [] }; await hooks["experimental.session.compacting"]({ sessionID: "e" }, output)
  assert.match(output.context[0], /AW supervisor observation/); assert.ok(__testing.state.get("e").observations.length)
})
test("ignores empty and unknown payloads without leaking full history", async () => {
  await hooks.event({}); await hooks.event({ event: { type: "unrelated.event", properties: { sessionID: "e", secret: "hidden" } } })
  await hooks["tool.execute.before"]({ sessionID: "payload", tool: "bash", args: undefined })
  await hooks["tool.execute.after"]({ sessionID: "payload", tool: "bash" }, undefined)
  const state = __testing.state.get("payload")
  assert.equal(state.events.length, 2); assert.equal(JSON.stringify(state).includes("hidden"), false)
  assert.ok(state.events.length <= 12)
})
test("does not auto-abort or invoke Sol and summaries remain bounded", async () => {
  const status = JSON.parse(await hooks.tool.aw_supervisor_status.execute({}, { sessionID: "e" }))
  assert.ok(status.observations.length <= 4); assert.ok(status.recent.length <= 4); assert.doesNotMatch(JSON.stringify(status), /hidden|secret/i)
})
test("bounds process-local state across distinct sessions", async () => {
  for (let index = 0; index < 80; index++) await hooks["tool.execute.before"]({ sessionID: `bounded-${index}`, tool: "bash", args: {} })
  assert.ok(__testing.state.size <= 64)
  assert.equal(__testing.state.has("bounded-0"), false)
  assert.equal(__testing.state.has("bounded-79"), true)
})
test("initializes missing compaction context", async () => {
  const output = {}
  await hooks["experimental.session.compacting"]({ sessionID: "missing-context" }, output)
  assert.ok(Array.isArray(output.context))
  assert.equal(output.context.length, 1)
})
