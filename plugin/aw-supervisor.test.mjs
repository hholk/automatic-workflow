import test from "node:test"
import assert from "node:assert/strict"
import { AwSupervisorPlugin } from "./aw-supervisor.js"
import { state } from "./aw-supervisor-core.js"
import { isVerificationCommand, toolOutputSignature } from "./aw-supervisor-core.js"

const hooks = await AwSupervisorPlugin()
test("records defensive tool before/after evidence without payloads", async () => {
  await hooks["tool.execute.before"]({ sessionID: "s", tool: "bash", args: { command: "secret=hidden" } })
  await hooks["tool.execute.after"]({ sessionID: "s", tool: "bash", args: { command: "secret=hidden" } }, { output: "changed src/a.js" })
  const events = state.get("s").events
  assert.equal(events.length, 2); assert.equal(JSON.stringify(events).includes("hidden"), false); assert.ok(events[1].result.signature)
})
test("does not mark an intent or result repeated when the output changes", async () => {
  const input = { sessionID: "different-output", tool: "bash", args: { command: "same input" } }
  await hooks["tool.execute.before"](input)
  await hooks["tool.execute.after"](input, { output: "first result" })
  await hooks["tool.execute.before"](input)
  await hooks["tool.execute.after"](input, { output: "different result" })
  const events = state.get("different-output").events
  assert.equal(events[2].repeated, false)
  assert.equal(events[3].repeated, false)
})
test("uses before output args and after input args for stable fingerprints", async () => {
  const before = { sessionID: "before-output", tool: "bash", args: { command: "wrong" } }
  await hooks["tool.execute.before"](before, { args: { command: "right" } })
  await hooks["tool.execute.after"]({ sessionID: "before-output", tool: "bash", args: { command: "right" } }, { output: "same" })
  await hooks["tool.execute.before"]({ sessionID: "before-output", tool: "bash" }, { args: { command: "right" } })
  await hooks["tool.execute.after"]({ sessionID: "before-output", tool: "bash", args: { command: "right" } }, { output: "same" })
  assert.ok(state.get("before-output").events[1].input_sig)
  assert.equal(state.get("before-output").events[3].repeated, true)
})
test("records verification evidence and does not invent LSP counts", async () => {
  await hooks["tool.execute.before"]({ sessionID: "sensors", tool: "bash" }, { args: { command: "npm test" } })
  await hooks["tool.execute.after"]({ sessionID: "sensors", tool: "bash", args: { command: "npm test" } }, { output: "passed", exit: 0 })
  await hooks.event({ event: { type: "lsp.updated", properties: { sessionID: "sensors", path: "src/a.js" } } })
  assert.equal(state.get("sensors").sensors.verification.at(-1).exit, 0)
  assert.deepEqual(state.get("sensors").sensors.lsp.current, { changed: true, path: "src/a.js" })
})
test("marks two repeated identical tool pairs as a medium repeated_pair observation", async () => {
  const input = { sessionID: "doom", tool: "bash", args: { command: "same" } }
  await hooks["tool.execute.before"](input)
  await hooks["tool.execute.after"](input, { output: "same result" })
  await hooks["tool.execute.before"](input)
  await hooks["tool.execute.after"](input, { output: "same result" })
  await hooks.event({ event: { type: "session.idle", properties: { sessionID: "doom" } } })
  const status = JSON.parse(await hooks.tool.aw_supervisor_status.execute({}, { sessionID: "doom" }))
  const observation = status.observations.at(-1)
  assert.equal(observation.sensors.repeated_pair.strength, "medium")
  assert.equal(observation.signals.at(-1).name, "repeated_pair")
  assert.equal(observation.signals.at(-1).strength, "medium")
})
test("includes normalized exit code in bounded output signatures", () => {
  assert.notEqual(toolOutputSignature({ output: "same", metadata: { exit: 0 } }), toolOutputSignature({ output: "same", metadata: { exit: 1 } }))
  assert.equal(toolOutputSignature({ output: "same", metadata: { exit: "0" } }), toolOutputSignature({ output: "same", exitCode: 0 }))
})
test("recognizes only known verification command shapes", () => {
  for (const command of ["npm test", "npm run lint", "npm run typecheck", "npm run build -- --quiet", "pnpm test", "pnpm run build", "pytest tests", "go test ./...", "cargo test", "cd project && npm test"]) assert.equal(isVerificationCommand(command), true, command)
  for (const command of ["echo test", "contest", "printf lint", "npm run deploy", "pnpm lint", "node build.js"]) assert.equal(isVerificationCommand(command), false, command)
})
test("extracts runtime metadata verification exit codes", async () => {
  await hooks["tool.execute.before"]({ sessionID: "metadata-exit", tool: "bash" }, { args: { command: "npm test" } })
  await hooks["tool.execute.after"]({ sessionID: "metadata-exit", tool: "bash", args: { command: "npm test" } }, { output: "passed", metadata: { exit: 0 } })
  assert.equal(state.get("metadata-exit").sensors.verification.at(-1).exit, 0)
  await hooks["tool.execute.before"]({ sessionID: "metadata-exit-1", tool: "bash" }, { args: { command: "npm test" } })
  await hooks["tool.execute.after"]({ sessionID: "metadata-exit-1", tool: "bash", args: { command: "npm test" } }, { output: "failed", metadata: { exit: 1 } })
  assert.equal(state.get("metadata-exit-1").sensors.verification.at(-1).exit, 1)
})
test("handles realistic event fixtures, idle observation, and compaction", async () => {
  for (const type of ["file.edited", "session.diff", "lsp.client.diagnostics", "lsp.updated", "permission.asked", "permission.replied", "session.status", "session.compacted"]) await hooks.event({ event: { type, properties: { sessionID: "e", path: "src/a.js", status: "ok" } } })
  await hooks.event({ event: { type: "session.idle", properties: { sessionID: "e" } } })
  const output = { context: [] }; await hooks["experimental.session.compacting"]({ sessionID: "e" }, output)
  assert.match(output.context[0], /AW supervisor checkpoint/); assert.ok(state.get("e").observations.length)
})
test("ignores empty and unknown payloads without leaking full history", async () => {
  await hooks.event({}); await hooks.event({ event: { type: "unrelated.event", properties: { sessionID: "e", secret: "hidden" } } })
  await hooks["tool.execute.before"]({ sessionID: "payload", tool: "bash", args: undefined })
  await hooks["tool.execute.after"]({ sessionID: "payload", tool: "bash" }, undefined)
  const session = state.get("payload")
  assert.equal(session.events.length, 2); assert.equal(JSON.stringify(session).includes("hidden"), false)
  assert.ok(session.events.length <= 12)
})
test("does not auto-abort or invoke Sol and summaries remain bounded", async () => {
  const status = JSON.parse(await hooks.tool.aw_supervisor_status.execute({}, { sessionID: "e" }))
  assert.ok(status.observations.length <= 4); assert.ok(status.recent.length <= 4); assert.doesNotMatch(JSON.stringify(status), /hidden|secret/i)
})
test("bounds process-local state across distinct sessions", async () => {
  for (let index = 0; index < 80; index++) await hooks["tool.execute.before"]({ sessionID: `bounded-${index}`, tool: "bash", args: {} })
  assert.ok(state.size <= 64)
  assert.equal(state.has("bounded-0"), false)
  assert.equal(state.has("bounded-79"), true)
})
test("entry loader exposes only callable exports and checkpoint is bounded", async () => {
  const entry = await import("./aw-supervisor.js")
  assert.ok(Object.values(entry).every(value => typeof value === "function"))
  const result = JSON.parse(await hooks.tool.aw_checkpoint.execute({ progress: "p", hypothesis: "h", evidence: "e", blocked_on: "none", help: "none", next: "n" }, { sessionID: "checkpoint" }))
  assert.equal(result.accepted, true)
})
test("initializes missing compaction context", async () => {
  const output = {}
  await hooks["experimental.session.compacting"]({ sessionID: "missing-context" }, output)
  assert.ok(Array.isArray(output.context))
  assert.equal(output.context.length, 1)
})
