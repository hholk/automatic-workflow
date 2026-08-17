import { tool } from "@opencode-ai/plugin"
import { addCheckpoint, bounded, observeEvent, observation, paths, record, sessionId, snapshot, toolInputSignature, toolOutputSignature } from "./aw-supervisor-core.js"

function eventName(event) { return event?.type ?? event?.event?.type }

export async function AwSupervisorPlugin() {
  return {
    "tool.execute.before": async (input) => {
      const id = sessionId(input), input_sig = toolInputSignature(input.args ?? {})
      const repeated = false
      record(id, "tool.intent", { tool: bounded(input.tool), input_sig, args: { keys: Object.keys(input.args ?? {}).slice(0, 12) }, repeated })
    },
    "tool.execute.after": async (input, output) => {
       const id = sessionId(input), output_sig = toolOutputSignature(output), s = snapshot(id), intent = [...s.events].reverse().find(e => e.kind === "tool.intent" && e.tool === bounded(input?.tool))
       const input_sig = toolInputSignature(input?.args ?? {})
       const fingerprint = intent?.input_sig === input_sig ? `${bounded(input?.tool)}:${intent.input_sig}:${output_sig}` : null
       const repeated = Boolean(fingerprint && s.events.some(e => e.kind === "tool.result" && e.tool === bounded(input?.tool) && e.input_sig === input_sig && e.output_sig === output_sig))
       if (fingerprint) {
         const previousPair = s.sensors.toolPairs.findLast(pair => pair.fingerprint === fingerprint)
         s.sensors.toolPairs.push({ fingerprint, count: (previousPair?.count ?? 0) + 1 })
         if (s.sensors.toolPairs.length > 8) s.sensors.toolPairs.shift()
       }
      record(id, "tool.result", { tool: bounded(input?.tool), input_sig: intent?.input_sig, output_sig, repeated, result: { signature: output_sig, chars: JSON.stringify(output ?? null).length, paths: paths([input?.args, output]) } })
    },
    event: async ({ event } = {}) => {
      const name = eventName(event); if (!name) return
      const id = sessionId(event?.properties ? event : event?.properties ?? event), props = event?.properties ?? {}
      if (!/^(file\.edited|session\.diff|lsp\.client\.diagnostics|lsp\.updated|permission\.(asked|replied)|session\.(idle|error|status|compacted))$/.test(name)) return
      observeEvent(id, name, props)
      if (name === "session.idle" || name === "session.error") observation(id, name)
    },
    "experimental.session.compacting": async (input, output) => {
      const id = sessionId(input), s = snapshot(id), item = observation(id, "compacting"), latest = s.checkpoints.at(-1)
      if (!Array.isArray(output.context)) output.context = []
      output.context.push(`AW supervisor checkpoint: ${latest ? `progress=${latest.PROGRESS}; hypothesis=${latest.CURRENT_HYPOTHESIS}; evidence=${latest.EVIDENCE}; next=${latest.NEXT}` : "none"}. Sensors: ${JSON.stringify(item.sensors)}. Host decides any control action.`)
    },
    tool: {
      aw_checkpoint: tool({
        description: "Record an optional event-driven AW milestone and inspect bounded stall signals.",
        args: { progress: tool.schema.string(), hypothesis: tool.schema.string(), evidence: tool.schema.string(), blocked_on: tool.schema.string(), help: tool.schema.string(), next: tool.schema.string(), relevant_paths: tool.schema.array(tool.schema.string()).optional(), known_facts: tool.schema.array(tool.schema.string()).optional() },
        async execute(args, context) { const result = addCheckpoint(context?.sessionID ?? "default", args); return JSON.stringify({ accepted: true, informationGain: result.item.informationGain, productive: result.item.productive, stalled: result.stall.stalled, signals: result.item.signals, decision: result.decision }) },
      }),
      aw_supervisor_status: tool({ description: "Read compact AW supervisor observations for the current session.", args: {}, async execute(_args, context) { const s = snapshot(context?.sessionID ?? "default"); return JSON.stringify({ observations: s.observations.slice(-4), recent: s.events.slice(-4).map(({ kind, at, tool, status, paths: eventPaths, input_sig, output_sig }) => ({ kind, at, tool, status, paths: eventPaths, input_sig, output_sig })) }) } }),
    },
  }
}
export default AwSupervisorPlugin
