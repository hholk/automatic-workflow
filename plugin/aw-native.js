const PREFIX = "[aw] "
const MAX_CHILDREN = 20
const MAX_MESSAGES = 50
const MAX_TEXT_BYTES = 4096
const MAX_INPUT_BYTES = 4096
const terminal = new Set(["idle", "completed", "failed", "cancelled", "canceled", "error"])

function unwrap(result) {
  if (result && typeof result === "object" && "error" in result && result.error) {
    throw new Error("native session request failed")
  }
  return result?.data ?? result
}

function bounded(value, limit = MAX_INPUT_BYTES) {
  let text = String(value ?? "")
  while (Buffer.byteLength(text, "utf8") > limit) text = text.slice(0, -1)
  return text
}

function checkedBrief(value, limit = MAX_INPUT_BYTES) {
  const text = String(value ?? "")
  const bytes = Buffer.byteLength(text, "utf8")
  if (bytes > limit) {
    const error = new Error(`AW_BRIEF_TOO_LARGE bytes=${bytes} limit=${limit}`)
    error.code = "AW_BRIEF_TOO_LARGE"
    error.bytes = bytes
    error.limit = limit
    throw error
  }
  return text
}

function textReport(text, limit = MAX_TEXT_BYTES) {
  const value = String(text ?? "")
  const bytesTotal = Buffer.byteLength(value, "utf8")
  const returned = bounded(value, limit)
  return { text: returned, truncated: bytesTotal > limit,
    bytes_total: bytesTotal, bytes_returned: Buffer.byteLength(returned, "utf8") }
}

function errorText(error) {
  if (error?.code === "AW_BRIEF_TOO_LARGE")
    return `${error.code} bytes=${error.bytes} limit=${error.limit}`
  return `AW native session error: ${bounded(error?.message || "request failed", 512)}`
}

function permission() {
  return [
    { permission: "*", pattern: "*", action: "deny" },
    ...["read", "glob", "grep", "list"].map((name) => ({ permission: name, pattern: "*", action: "allow" })),
  ]
}

function childId(child) { return child?.id ?? child?.sessionID }
function childTitle(child) { return child?.title ?? "" }
function nativeStatus(value, id) {
  const current = value?.status ?? value
  if (!current || typeof current !== "object" || "type" in current) return current
  return id in current ? current[id] : { type: "idle" }
}
function projection(child, status) {
  return { id: childId(child), title: childTitle(child), status: nativeStatus(status, childId(child)) ?? child?.status,
    ...(child?.time ? { time: child.time } : {}) }
}

async function childrenFor(client, context) {
  const data = unwrap(await client.session.children({ path: { id: context.sessionID }, query: { directory: context.directory } }))
  return (Array.isArray(data) ? data : data?.children ?? []).filter((child) => childId(child) && childTitle(child).startsWith(PREFIX))
}

async function authorized(client, context, id) {
  const child = (await childrenFor(client, context)).find((item) => childId(item) === id)
  if (!child) throw new Error("AW child session is not authorized")
  return child
}

async function status(client, context, id) {
  return unwrap(await client.session.status({ path: { id }, query: { directory: context.directory } }))
}

function textParts(message) {
  if ((message?.info?.role ?? message?.role) !== "assistant") return []
  return (message.parts ?? []).filter((part) => part?.type === "text" && typeof part.text === "string").map((part) => part.text)
}

export async function AwNativePlugin(input) {
  const { client } = input
  const seen = new Set()
  const z = tool.schema
  const makeTool = (description, args, execute) => tool({ description, args, execute })
  const spawn = makeTool("Spawn a stateless read-only AW child session.", {
    prompt: z.string(), title: z.string().optional(), agent: z.enum(["flash-explore", "flash-review"]).default("flash-explore"),
  }, async ({ prompt, title, agent }, context) => {
    try {
      const brief = checkedBrief(prompt)
      const created = unwrap(await client.session.create({ body: { parentID: context.sessionID, title: PREFIX + bounded(title || prompt, 512), permission: permission() }, query: { directory: context.directory } }))
      const id = created?.id ?? created?.sessionID
      if (!id) throw new Error("native session did not return an id")
      await client.session.promptAsync({ path: { id }, query: { directory: context.directory }, body: {
        agent, system: "You are a read-only AW child. Do not edit, write, commit, push, run destructive commands, or create nested tasks.",
          parts: [{ type: "text", text: brief }],
      } })
      return JSON.stringify({ id, sessionID: id, status: "running" })
    } catch (error) { return errorText(error) }
  })
  const statusTool = makeTool("Inspect native AW child sessions.", { id: z.string().optional() }, async ({ id }, context) => {
    try {
      const children = await childrenFor(client, context)
      if (id) {
        const child = children.find((item) => childId(item) === id)
        if (!child) throw new Error("AW child session is not authorized")
        return JSON.stringify(projection(child, await status(client, context, id)))
      }
      const result = []
      for (const child of children.slice(-MAX_CHILDREN)) result.push(projection(child, await status(client, context, childId(child))))
      return JSON.stringify(result)
    } catch (error) { return errorText(error) }
  })
  const read = makeTool("Read the latest native AW assistant text.", { id: z.string() }, async ({ id }, context) => {
    try {
      await authorized(client, context, id)
      const current = await status(client, context, id)
      const messages = unwrap(await client.session.messages({ path: { id }, query: { directory: context.directory, limit: MAX_MESSAGES } }))
      const list = Array.isArray(messages) ? messages : messages?.messages ?? []
      const text = list.slice().reverse().map((message) => textParts(message).join("")).find(Boolean) || ""
      return JSON.stringify({ id, status: nativeStatus(current, id), ...textReport(text) })
    } catch (error) { return errorText(error) }
  })
  const control = makeTool("Control an authorized native AW child.", {
    id: z.string(), action: z.enum(["abort", "steer", "message"]), message: z.string().optional(),
  }, async ({ id, action, message }, context) => {
    try {
      await authorized(client, context, id)
      if (action === "abort") await client.session.abort({ path: { id }, query: { directory: context.directory } })
      else {
        if (!message?.trim()) throw new Error("message must be nonblank")
        await client.session.promptAsync({ path: { id }, query: { directory: context.directory }, body: { parts: [{ type: "text", text: checkedBrief(message) }] } })
      }
      return JSON.stringify({ id, action, status: "accepted" })
    } catch (error) { return errorText(error) }
  })
  return {
    tool: { aw_spawn: spawn, aw_status: statusTool, aw_read: read, aw_control: control },
    event: async ({ event }) => {
      if (!event || !["session.idle", "session.error"].includes(event.type)) return
      const id = event.properties?.sessionID ?? event.properties?.id ?? event.sessionID
      if (!id || seen.has(id)) return
      try {
        const data = unwrap(await client.session.get({ path: { id }, query: { directory: input.directory } }))
        if (!childTitle(data).startsWith(PREFIX) || !terminal.has(data.status)) return
        seen.add(id)
        if (seen.size > MAX_CHILDREN * 2) seen.delete(seen.values().next().value)
        await client.tui?.showToast?.({ body: { title: "AW", message: bounded(`${childTitle(data)}: ${data.status}`), variant: data.status === "completed" ? "success" : "error" } })
      } catch { /* notifications are best effort */ }
    },
  }
}

import { tool } from "@opencode-ai/plugin"
