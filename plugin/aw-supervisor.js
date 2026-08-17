import { createHash } from "node:crypto"
import { tool } from "@opencode-ai/plugin"
import { compareCheckpoints, detectStall, chooseIntervention } from "../supervisor/supervisor.mjs"

const MAX = 12
const MAX_SESSIONS = 64
const LIMIT = 240
const state = new Map()
const text = (value) => typeof value === "string" ? value : value == null ? "" : String(value)
const bounded = (value) => text(value).replace(/\s+/g, " ").slice(0, LIMIT)
const signature = (value) => createHash("sha256").update(text(value)).digest("hex").slice(0, 12)
const sessionId = (input = {}) => input.sessionID ?? input.sessionId ?? input.id ?? input.properties?.sessionID ?? "default"
const paths = (value) => {
  const found = []
  const visit = (item) => {
    if (typeof item === "string" && /(^|\/|\\)(?:src|test|tests|plugin|supervisor|README|SKILL|commands|playbooks)(?:\/|\\|\.|$)/i.test(item)) found.push(bounded(item))
    else if (Array.isArray(item)) item.forEach(visit)
    else if (item && typeof item === "object") Object.values(item).forEach(visit)
  }
  visit(value)
  return [...new Set(found)].slice(0, 8)
}
function snapshot(id) {
  if (!state.has(id)) {
    state.set(id, { events: [], checkpoints: [], observations: [] })
    while (state.size > MAX_SESSIONS) state.delete(state.keys().next().value)
  }
  return state.get(id)
}
function record(id, kind, payload = {}) {
  const s = snapshot(id)
  s.events.push({ kind, at: Date.now(), ...payload })
  if (s.events.length > MAX) s.events.splice(0, s.events.length - MAX)
  return s
}
function observation(id, reason) {
  const s = snapshot(id), history = s.checkpoints
  const comparison = history.length > 1 ? compareCheckpoints(history.at(-2), history.at(-1)) : null
  const stall = detectStall(history)
  const decision = chooseIntervention({ history, actionRisk: "low" })
  const item = { reason, informationGain: comparison?.informationGain ?? 0, productive: comparison?.productive ?? false, stalled: stall.stalled, signalCount: stall.signals.length, decision: decision.route }
  s.observations.push(item); if (s.observations.length > MAX) s.observations.shift(); return item
}
function eventName(event) { return event?.type ?? event?.event?.type }

export async function AwSupervisorPlugin() {
  return {
    "tool.execute.before": async (input) => {
      record(sessionId(input), "tool.intent", { tool: bounded(input.tool), args: { keys: Object.keys(input.args ?? {}).slice(0, 12) } })
    },
    "tool.execute.after": async (input, output) => {
      const raw = output?.result ?? output?.output ?? output?.data ?? output
      record(sessionId(input), "tool.result", { tool: bounded(input?.tool), result: { signature: signature(raw), chars: text(raw).length, paths: paths([input?.args, raw]) } })
    },
    event: async ({ event } = {}) => {
      const name = eventName(event); if (!name) return
      const id = sessionId(event?.properties ? event : event?.properties ?? event)
      const props = event?.properties ?? {}
      const relevant = /^(file\.edited|session\.diff|lsp\.client\.diagnostics|lsp\.updated|permission\.(asked|replied)|session\.(idle|error|status|compacted))$/.test(name)
      if (!relevant) return
      record(id, name, { paths: paths(props), status: bounded(props.status ?? props.error), signature: props.output ? signature(props.output) : undefined })
      if (name === "session.idle" || name === "session.error") observation(id, name)
    },
    "experimental.session.compacting": async (input, output) => {
      const id = sessionId(input); const item = observation(id, "compacting")
      if (!Array.isArray(output.context)) output.context = []
      output.context.push(`AW supervisor observation: progress=${item.productive ? "semantic" : "structural/unknown"}; stalled=${item.stalled}; decision=${item.decision}. Host decides any control action.`)
    },
    tool: {
      aw_supervisor_status: tool({
        description: "Read compact AW supervisor observations for the current session.", args: {},
        async execute(_args, context) {
          const s = snapshot(context?.sessionID ?? "default")
          return JSON.stringify({ observations: s.observations.slice(-4), recent: s.events.slice(-4).map(({ kind, at, tool, status, paths }) => ({ kind, at, tool, status, paths })) })
        },
      }),
    },
  }
}

export const __testing = { state, record, observation, signature }
export default AwSupervisorPlugin
