import { createHash } from "node:crypto"
import { compareCheckpoints, detectStall, chooseIntervention } from "../supervisor/supervisor.mjs"

export const MAX = 12
export const MAX_SESSIONS = 64
const LIMIT = 240
export const state = new Map()
export const text = (value) => typeof value === "string" ? value : value == null ? "" : String(value)
export const bounded = (value) => text(value).replace(/\s+/g, " ").slice(0, LIMIT)
export const signature = (value) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value ?? null)).digest("hex").slice(0, 12)
export const sessionId = (input = {}) => input.sessionID ?? input.sessionId ?? input.id ?? input.properties?.sessionID ?? "default"
export const paths = (value) => {
  const found = []
  const visit = (item) => {
    if (typeof item === "string" && /(^|\/|\\)(?:src|test|tests|plugin|supervisor|README|SKILL|commands|playbooks)(?:\/|\\|\.|$)/i.test(item)) found.push(bounded(item))
    else if (Array.isArray(item)) item.forEach(visit)
    else if (item && typeof item === "object") Object.values(item).forEach(visit)
  }
  visit(value)
  return [...new Set(found)].slice(0, 8)
}
export function snapshot(id) {
  if (!state.has(id)) {
    state.set(id, { events: [], checkpoints: [], observations: [], sensors: { files: [], lsp: { previous: { errors: 0, warnings: 0 }, current: { errors: 0, warnings: 0 } }, verification: [], toolPairs: [], permissions: [] } })
    while (state.size > MAX_SESSIONS) state.delete(state.keys().next().value)
  }
  return state.get(id)
}
export function record(id, kind, payload = {}) {
  const s = snapshot(id)
  s.events.push({ kind, at: Date.now(), ...payload })
  if (s.events.length > MAX) s.events.splice(0, s.events.length - MAX)
  return s
}
function sensorSummary(s) {
  const repeatedToolPair = s.sensors.toolPairs.at(-1) ?? null
  return { newPaths: s.sensors.files.slice(-8), lsp: s.sensors.lsp, verification: s.sensors.verification.slice(-4), repeatedToolPair, doom_loop: Boolean(repeatedToolPair?.count >= 2), permissions: s.sensors.permissions.slice(-4) }
}
export function observeSensors(id) { return sensorSummary(snapshot(id)) }
export function observation(id, reason) {
  const s = snapshot(id), history = s.checkpoints
  const comparison = history.length > 1 ? compareCheckpoints(history.at(-2), history.at(-1)) : null
  const stall = detectStall(history)
  const decision = chooseIntervention({ history, actionRisk: "low" })
  const sensors = sensorSummary(s)
  const signals = [...stall.signals, ...sensors.newPaths.map(value => ({ name: "new_path", value })), ...(sensors.repeatedToolPair ? [{ name: "repeated_tool_pair", value: sensors.repeatedToolPair }] : []), ...(sensors.doom_loop ? [{ name: "doom_loop", value: sensors.repeatedToolPair, strength: "strong" }] : []), ...sensors.permissions.map(value => ({ name: "permission", value }))]
  const item = { reason, informationGain: comparison?.informationGain ?? 0, productive: comparison?.productive ?? false, stalled: stall.stalled, signals, decision: decision.route, sensors }
  s.observations.push(item); if (s.observations.length > MAX) s.observations.shift(); return item
}
export function addCheckpoint(id, input) {
  const s = snapshot(id)
  const checkpoint = { PROGRESS: bounded(input.progress), CURRENT_HYPOTHESIS: bounded(input.hypothesis), EVIDENCE: bounded(input.evidence), BLOCKED_ON: bounded(input.blocked_on), HELP: bounded(input.help), NEXT: bounded(input.next), ...(input.relevant_paths ? { relevant_paths: paths(input.relevant_paths) } : {}), ...(input.known_facts ? { known_facts: bounded(input.known_facts) } : {}) }
  s.checkpoints.push(checkpoint); if (s.checkpoints.length > MAX) s.checkpoints.shift()
  const item = observation(id, "checkpoint")
  return { checkpoint, item, comparison: s.checkpoints.length > 1 ? compareCheckpoints(s.checkpoints.at(-2), checkpoint) : null, stall: detectStall(s.checkpoints), decision: chooseIntervention({ history: s.checkpoints, actionRisk: "low" }) }
}
export function toolInputSignature(args) { return signature(args) }
export function toolOutputSignature(output) { return signature(output?.result ?? output?.output ?? output?.data ?? output) }
export const isVerificationCommand = (command) => /(?:test|lint|typecheck|build|pytest|cargo\s+test|go\s+test)/i.test(text(command))
export function verificationEvidence(input, output) {
  const args = input?.args ?? {}, command = args.command ?? args.cmd ?? ""
  if (!isVerificationCommand(command)) return null
  const exit = output?.metadata?.exit ?? output?.exit ?? output?.exitCode
  return { input_sig: toolInputSignature(args), output_sig: toolOutputSignature(output), chars: JSON.stringify(output ?? null).length, ...(Number.isInteger(exit) ? { exit } : {}) }
}
export function observeEvent(id, name, props = {}) {
  const s = snapshot(id)
  const found = paths(props)
  if (/^(file\.edited|session\.diff)$/.test(name)) s.sensors.files.push(...found.filter(p => !s.sensors.files.includes(p)))
  if (/^lsp\./.test(name)) { const counts = {}; if (props.errors != null || props.errorCount != null || props.diagnostics) counts.errors = Number(props.errors ?? props.errorCount ?? props.diagnostics.filter?.(x => x?.severity === "error").length ?? 0); if (props.warnings != null || props.warningCount != null || props.diagnostics) counts.warnings = Number(props.warnings ?? props.warningCount ?? props.diagnostics.filter?.(x => x?.severity === "warning").length ?? 0); s.sensors.lsp = { previous: s.sensors.lsp.current, current: { changed: true, path: bounded(props.path), ...counts } } }
  if (/^permission\./.test(name)) s.sensors.permissions.push({ type: bounded(props.type), action: bounded(props.action), risk: bounded(props.risk), permission: bounded(props.permission) })
  if (/verification|verify/i.test(name)) s.sensors.verification.push(bounded(props.signature ?? props.output ?? props.status))
  record(id, name, { paths: found, status: bounded(props.status ?? props.error), signature: props.output ? signature(props.output) : undefined })
  return s
}
