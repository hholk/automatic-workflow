import test from "node:test"
import assert from "node:assert/strict"
import * as importedModule from "./aw-native.js"
import { AwNativePlugin } from "./aw-native.js"

const context = { sessionID: "parent", directory: "/repo" }

function fakeClient({ children = [], statuses = {}, messages = {}, created = { id: "child-1" } } = {}) {
  const calls = []
  const client = {
    session: {
      children: async (args) => { calls.push(["children", args]); return { data: children } },
      create: async (args) => { calls.push(["create", args]); return { data: created } },
      promptAsync: async (args) => { calls.push(["promptAsync", args]); return { data: {} } },
      status: async ({ path, query }) => { calls.push(["status", { path, query }]); return { data: statuses[path.id] ?? { status: "idle" } } },
      messages: async ({ path, query }) => { calls.push(["messages", { path, query }]); return { data: messages[path.id] ?? [] } },
      abort: async (args) => { calls.push(["abort", args]); return { data: {} } },
      get: async ({ path, query }) => { calls.push(["get", { path, query }]); return { data: children.find((child) => (child.id ?? child.sessionID) === path.id) } },
    },
    tui: { showToast: async (args) => { calls.push(["toast", args]) } },
  }
  return { client, calls }
}

function result(value) { return JSON.parse(value) }

test("exports exactly one loader-valid named plugin", async () => {
  assert.deepEqual(Object.keys(importedModule), ["AwNativePlugin"])
  assert.equal(Object.values(importedModule).length, 1)
  for (const value of Object.values(importedModule)) {
    assert.ok(typeof value === "function" || (value && typeof value.server === "function"))
  }
  const plugin = await AwNativePlugin({ client: {}, directory: "/repo" })
  assert.deepEqual(Object.keys(plugin.tool).sort(), ["aw_control", "aw_read", "aw_spawn", "aw_status"])
})

test("registers exactly the native AW tools", async () => {
  const plugin = await AwNativePlugin({ client: {}, directory: "/repo" })
  assert.deepEqual(Object.keys(plugin.tool).sort(), ["aw_control", "aw_read", "aw_spawn", "aw_status"])
})

test("spawn creates and prompts a read-only child without touching the parent", async () => {
  const { client, calls } = fakeClient()
  const tool = (await AwNativePlugin({ client, directory: "/repo" })).tool
  const output = result(await tool.aw_spawn.execute({ prompt: "inspect it", title: "look", agent: "flash-review" }, context))
  assert.equal(output.id, "child-1")
  assert.equal(calls.filter(([name]) => name === "status").length, 0)
  assert.deepEqual(calls[0], ["create", { body: { parentID: "parent", title: "[aw] look", permission: [
    { permission: "*", pattern: "*", action: "deny" },
    { permission: "read", pattern: "*", action: "allow" }, { permission: "glob", pattern: "*", action: "allow" },
    { permission: "grep", pattern: "*", action: "allow" }, { permission: "list", pattern: "*", action: "allow" },
  ] }, query: { directory: "/repo" } }])
  assert.deepEqual(calls[1][1].path, { id: "child-1" })
  assert.deepEqual(calls[1][1].query, { directory: "/repo" })
  assert.equal(calls[1][1].body.agent, "flash-review")
  assert.deepEqual(calls[1][1].body.parts, [{ type: "text", text: "inspect it" }])
  assert.match(calls[1][1].body.system, /read-only/)
})

test("spawn fails closed when a brief exceeds the byte limit", async () => {
  const { client, calls } = fakeClient()
  const tool = (await AwNativePlugin({ client, directory: "/repo" })).tool
  const output = await tool.aw_spawn.execute({ prompt: "x".repeat(4097), title: "too large", agent: "flash-explore" }, context)
  assert.equal(output, "AW_BRIEF_TOO_LARGE bytes=4097 limit=4096")
  assert.deepEqual(calls, [])
})

test("status authorizes fresh direct AW children and projects native state", async () => {
  const children = Array.from({ length: 22 }, (_, i) => ({ id: `c${i}`, title: `[aw] ${i}`, status: "idle" }))
  children.push({ id: "other", title: "not AW", status: "busy" })
  const { client, calls } = fakeClient({ children, statuses: { c2: { status: "busy" }, c21: { status: "retry" } } })
  const tool = (await AwNativePlugin({ client, directory: "/repo" })).tool
  const list = result(await tool.aw_status.execute({}, context))
  assert.equal(list.length, 20)
  assert.equal(list[0].id, "c2")
  assert.equal(list.at(-1).status, "retry")
  const one = result(await tool.aw_status.execute({ id: "c2" }, context))
  assert.deepEqual(one, { id: "c2", title: "[aw] 2", status: "busy" })
  await tool.aw_status.execute({ id: "unknown" }, context)
  assert.deepEqual(calls.filter(([name]) => name === "status").map(([, x]) => x.path.id), ["c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10", "c11", "c12", "c13", "c14", "c15", "c16", "c17", "c18", "c19", "c20", "c21", "c2"])
})

test("status projects the requested child from the legacy all-session status map", async () => {
  const { client } = fakeClient({ children: [{ id: "c", title: "[aw] child" }] })
  client.session.status = async () => ({ data: { parent: { type: "busy" }, c: { type: "idle" } } })
  const tool = (await AwNativePlugin({ client, directory: "/repo" })).tool
  assert.deepEqual(result(await tool.aw_status.execute({ id: "c" }, context)), {
    id: "c", title: "[aw] child", status: { type: "idle" },
  })
})

test("status treats a child absent from the legacy active-session map as idle", async () => {
  const { client } = fakeClient({ children: [{ id: "c", title: "[aw] child" }] })
  client.session.status = async () => ({ data: { parent: { type: "busy" } } })
  const tool = (await AwNativePlugin({ client, directory: "/repo" })).tool
  assert.deepEqual(result(await tool.aw_status.execute({ id: "c" }, context)).status, { type: "idle" })
  assert.deepEqual(result(await tool.aw_read.execute({ id: "c" }, context)).status, { type: "idle" })
})

test("read selects only the latest assistant text and authorizes before native calls", async () => {
  const { client, calls } = fakeClient({ children: [{ id: "c", title: "[aw] child" }], messages: { c: [
    { role: "user", parts: [{ type: "text", text: "secret prompt" }] },
    { role: "assistant", parts: [{ type: "reasoning", text: "hidden" }, { type: "text", text: "first" }] },
    { role: "tool", parts: [{ type: "text", text: "tool" }] },
    { role: "assistant", parts: [{ type: "text", text: "latest" }, { type: "text", text: " answer" }] },
  ] } })
  const tool = (await AwNativePlugin({ client, directory: "/repo" })).tool
  assert.deepEqual(result(await tool.aw_read.execute({ id: "c" }, context)), { id: "c", status: "idle", text: "latest answer", truncated: false, bytes_total: 13, bytes_returned: 13 })
  assert.deepEqual(calls.slice(0, 3).map(([name]) => name), ["children", "status", "messages"])
  const before = calls.length
  const rejected = await tool.aw_read.execute({ id: "nope" }, context)
  assert.match(rejected, /not authorized/)
  assert.equal(calls.length, before + 1)
})

test("read supports the legacy native message envelope", async () => {
  const { client } = fakeClient({ children: [{ id: "c", title: "[aw] child" }], messages: { c: [
    { info: { role: "assistant" }, parts: [{ type: "reasoning", text: "hidden" }, { type: "text", text: "native result" }] },
  ] } })
  const tool = (await AwNativePlugin({ client, directory: "/repo" })).tool
  assert.equal(result(await tool.aw_read.execute({ id: "c" }, context)).text, "native result")
})

test("read exposes truncation metadata", async () => {
  const { client } = fakeClient({ children: [{ id: "c", title: "[aw] child" }], messages: { c: [
    { role: "assistant", parts: [{ type: "text", text: "x".repeat(4097) }] },
  ] } })
  const tool = (await AwNativePlugin({ client, directory: "/repo" })).tool
  const output = result(await tool.aw_read.execute({ id: "c" }, context))
  assert.equal(output.truncated, true)
  assert.equal(output.bytes_total, 4097)
  assert.equal(output.bytes_returned, 4096)
})

test("control aborts or steers only an authorized child and validates messages", async () => {
  const { client, calls } = fakeClient({ children: [{ id: "c", title: "[aw] child" }] })
  const tool = (await AwNativePlugin({ client, directory: "/repo" })).tool
  await tool.aw_control.execute({ id: "c", action: "abort" }, context)
  await tool.aw_control.execute({ id: "c", action: "steer", message: "  continue  " }, context)
  const rejected = await tool.aw_control.execute({ id: "nope", action: "abort" }, context)
  assert.match(rejected, /not authorized/)
  assert.deepEqual(calls.map(([name]) => name), ["children", "abort", "children", "promptAsync", "children"])
  assert.equal(calls[3][1].body.parts[0].text, "  continue  ")
})

test("event toasts only terminal AW children, dedupes, and swallows toast failures", async () => {
  const { client, calls } = fakeClient({ children: [{ id: "c", title: "[aw] child", status: "completed" }, { id: "x", title: "other", status: "error" }] })
  client.tui.showToast = async (args) => { calls.push(["toast", args]); throw new Error("toast unavailable") }
  const plugin = await AwNativePlugin({ client, directory: "/repo" })
  await plugin.event({ event: { type: "session.idle", properties: { sessionID: "c" } } })
  await plugin.event({ event: { type: "session.idle", properties: { sessionID: "c" } } })
  await plugin.event({ event: { type: "session.idle", properties: { sessionID: "x" } } })
  assert.equal(calls.filter(([name]) => name === "get").length, 2)
  assert.equal(calls.filter(([name]) => name === "toast").length, 1)
})

test("native adapter has no persistent ledger or polling implementation", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("./aw-native.js", import.meta.url), "utf8"))
  assert.doesNotMatch(source, /node:fs|createLedger|jobs\.json|ledger|polling|sleep|setInterval/)
  assert.deepEqual(Object.keys((await AwNativePlugin({ client: {}, directory: "/repo" })).tool).sort(), ["aw_control", "aw_read", "aw_spawn", "aw_status"])
})
