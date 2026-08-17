const CHECKPOINT_FIELDS = ["PROGRESS", "CURRENT_HYPOTHESIS", "EVIDENCE", "BLOCKED_ON", "HELP", "NEXT"]
const HELP_TYPES = new Set(["sol", "review", "context", "human"])
const RISKS = new Set(["low", "medium", "high"])
const FAILURES = new Set(["CODE", "TEST", "CONTEXT", "REQUIREMENT", "TOOL", "NETWORK", "RATE_LIMIT", "PERMISSION", "FORMAT", "UNKNOWN"])
const FAILURE_ALIASES = { scope: "REQUIREMENT", environment: "CONTEXT", dependency: "TOOL", logic: "CODE", evidence: "TEST", human_gate: "PERMISSION" }
const text = (v) => Array.isArray(v) ? v.map(text).filter(Boolean).join("; ") : typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim()
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v)
const fields = (source, names) => Object.fromEntries(names.map(k => [k, text(source[k])]))

function parseLines(input, keyPattern) {
  const out = {}; let key = null
  for (const line of input.split(/\r?\n/)) {
    const match = line.match(keyPattern)
    if (match) { key = match[1].toUpperCase(); out[key] = match[2].trim() }
    else if (key && line.trim()) out[key] += `\n${line.trim()}`
  }
  return out
}
export function parseCheckpoint(input) {
  const source = typeof input === "string" ? parseLines(input, /^\s*([A-Z][A-Z0-9_]*):\s*(.*)$/) : object(input) ? input : {}
  const value = fields(source, CHECKPOINT_FIELDS)
  const missing = CHECKPOINT_FIELDS.filter(k => !value[k])
  return { ...value, valid: missing.length === 0, missing }
}
export const validateCheckpoint = (input) => parseCheckpoint(input).valid

export function parseHelpRequest(input) {
  const source = typeof input === "string" ? parseLines(input, /^\s*([a-z][a-z0-9_]*):\s*(.*)$/i) : object(input) ? input : {}
  const value = { type: text(source.type).toLowerCase(), reason: text(source.reason || source.attempted), question: text(source.question), evidence: Array.isArray(source.evidence) ? source.evidence.map(text).filter(Boolean) : text(source.evidence), risk: text(source.risk).toLowerCase() }
  const errors = [!HELP_TYPES.has(value.type) && "type", !value.reason && "reason", !value.question && "question", !(Array.isArray(value.evidence) ? value.evidence.length : value.evidence) && "evidence", !RISKS.has(value.risk) && "risk"].filter(Boolean)
  return { ...value, valid: errors.length === 0, errors }
}
export const validateHelpRequest = (input) => parseHelpRequest(input).valid
export function normalizeFailure(value) { const raw = text(value).toLowerCase().replace(/[- ]/g, "_"); if (FAILURE_ALIASES[raw]) return FAILURE_ALIASES[raw]; const key = raw.toUpperCase(); return FAILURES.has(key) ? key : "UNKNOWN" }

const semantic = (v) => ({ hypothesis: text(v.CURRENT_HYPOTHESIS ?? v.hypothesis), evidence: text(v.EVIDENCE ?? v.evidence), paths: text(v.RELEVANT_PATHS ?? v.paths), facts: text(v.KNOWN_FACTS ?? v.known_facts), failure: normalizeFailure(v.BLOCKED_ON ?? v.failure) })
export function compareCheckpoints(previous, next) {
  const a = parseCheckpoint(previous), b = parseCheckpoint(next), sa = semantic(previous || {}), sb = semantic(next || {})
  const changed = CHECKPOINT_FIELDS.filter(k => a[k] !== b[k])
  const semanticChanges = ["hypothesis", "evidence", "paths", "facts"].filter(k => sa[k] !== sb[k])
  const sameFailure = sa.failure === sb.failure && sb.failure !== "UNKNOWN"
  const productive = semanticChanges.length > 0 || (sameFailure && ["CURRENT_HYPOTHESIS", "EVIDENCE", "NEXT"].some(k => a[k] !== b[k]))
  return { changed, semanticChanges, sameFailure, informationGain: productive ? Math.min(1, semanticChanges.length / 3 + .25) : 0, identical: changed.length === 0, productive }
}
export function detectStall(history = []) {
  const items = history.slice(-3), parsed = items.map(parseCheckpoint)
  if (parsed.length < 3) return { stalled: false, signals: [] }
  const latest = parsed.at(-1), unchanged = (key) => parsed.every(x => semantic(x)[key] === semantic(latest)[key])
  const signals = []
  if (unchanged("hypothesis")) signals.push({ name: "same_hypothesis", value: semantic(latest).hypothesis })
  if (unchanged("failure") && semantic(latest).failure !== "UNKNOWN") signals.push({ name: "same_failure", value: semantic(latest).failure })
  if (unchanged("evidence")) signals.push({ name: "no_evidence_movement", value: semantic(latest).evidence })
  if (unchanged("paths")) signals.push({ name: "no_path_movement", value: semantic(latest).paths })
  if (unchanged("facts")) signals.push({ name: "no_known_fact_movement", value: semantic(latest).facts })
  const productive = parsed.slice(1).some((_, i) => compareCheckpoints(items[i], items[i + 1]).productive)
  return { stalled: signals.length >= 2 && !productive, signals, checkpoints: parsed.length }
}
export function chooseIntervention({ history = [], risk = "low", help, contextBlocked = false, protectedWork = false, destructive = false, irreversible = false, humanGate = false } = {}) {
  const request = help && parseHelpRequest(help)
  if (risk === "high" || protectedWork || destructive || irreversible || humanGate) return { level: 4, route: "human", reason: risk === "high" ? "high_risk" : "protected_work" }
  const latest = history.at(-1), failure = latest && semantic(latest).failure
  if (["NETWORK", "RATE_LIMIT", "TOOL"].includes(failure)) return { level: 0, route: "continue", reason: "no_reasoning_failure" }
  if (contextBlocked) return { level: 2, route: "context", reason: "context_blockage" }
  if (request?.valid) return { level: { human: 4, sol: 3, context: 2, review: 1 }[request.type], route: request.type, reason: "explicit_help" }
  const stall = detectStall(history)
  return stall.stalled ? { level: 1, route: history.length >= 4 ? "reframe" : "nudge", reason: stall.signals.map(x => x.name).join(","), signals: stall.signals } : { level: 0, route: "continue", reason: "productive_or_insufficient_signal" }
}
export const routeHelp = (request, options = {}) => chooseIntervention({ ...options, help: request })
export const chooseContextRescue = (blockedOn) => /context|missing|unknown/i.test(text(blockedOn))

export function normalizeEvidence(input = {}) {
  const read = (key, ...aliases) => input[key] ?? aliases.map(k => input[k]).find(v => v != null)
  return { verify: { command: text(input.verify_command ?? read("verify")), exit: Number(input.verify_exit ?? input.exit ?? NaN), signature: text(input.verify_signature ?? input.signature) }, scope: { changed: [].concat(input.changed_paths ?? input.changed ?? []).filter(Boolean), unexpected: [].concat(input.unexpected_paths ?? input.unexpected ?? []).filter(Boolean) }, acceptance: { claims: [].concat(input.acceptance_claims ?? input.claims ?? read("acceptance") ?? []).filter(Boolean), evidence: text(input.acceptance_evidence) }, summary: text(input.verification_summary ?? read("summary")), commands: Array.isArray(input.commands) ? input.commands : [] }
}
export const verificationSummary = normalizeEvidence
export function buildBrief({ objective, hypothesis, evidence, failedApproaches, question, paths = [] } = {}) { return { OBJECTIVE: text(objective), CURRENT_HYPOTHESIS: text(hypothesis), EVIDENCE: text(evidence), FAILED_APPROACHES: text(failedApproaches), QUESTION: text(question), PATHS: paths.slice(0, 8) } }
export function normalizeCapabilities(input = {}) { return { reasoning: input.reasoning ?? input.reasoning_effort ?? [], tools: Array.isArray(input.tools) ? input.tools : [], context: Array.isArray(input.context) ? input.context : (input.context ? [input.context] : []), roles: Array.isArray(input.roles) ? input.roles : [], effort: input.effort ?? input.reasoning_effort ?? null } }
export function selectReasoning(capabilities, requested) { const c = normalizeCapabilities(capabilities), levels = Array.isArray(c.reasoning) ? c.reasoning : [c.reasoning].filter(Boolean); if (!levels.length) return requested ?? null; return levels.includes(requested) ? requested : levels.includes("medium") ? "medium" : levels.find(x => x === "high" || x === "low") ?? levels[0] }
const promptField = (key) => text(key).toLowerCase().replace(/[^a-z0-9]/g, "")
const promptUiFields = new Set(["started", "deadline", "checkin", "sessionid", "toast"])
function filterPromptFields(value) { if (Array.isArray(value)) return value.map(filterPromptFields); if (!object(value)) return value; return Object.fromEntries(Object.entries(value).filter(([key]) => !promptUiFields.has(promptField(key))).map(([key, child]) => [key, filterPromptFields(child)])) }
export function canonicalPrompt({ stable = {}, dynamic = {} } = {}) { const order = ["identity", "principles", "schema", "playbook", "expert"]; const cleanStable = Object.fromEntries(order.filter(k => stable[k] != null).map(k => [k, filterPromptFields(stable[k])])); const task = object(dynamic) ? dynamic.task : dynamic; return { stable: cleanStable, dynamic: { task: filterPromptFields(task) } } }
export function telemetry(record = {}) { return { timestamp: record.timestamp ?? null, route: text(record.route || "continue"), intervention: Number(record.intervention ?? 0), verified: !!record.verified, accepted: !!record.accepted, useful: !!record.useful, cost: Number(record.cost || 0), informationGain: Number(record.informationGain ?? 0), failure: normalizeFailure(record.failure), sol_source: text(record.sol_source || record.route_source) } }
export function aggregateMetrics(records = []) { const r = records.map(telemetry), accepted = r.filter(x => x.accepted), interventions = r.filter(x => x.intervention > 0), successes = r.filter(x => x.verified); const rate = (n, d) => d ? n / d : 0; return { false_accept_rate: rate(accepted.filter(x => !x.verified).length, accepted.length), unnecessary_intervention_rate: rate(interventions.filter(x => !x.useful).length, interventions.length), useful_intervention_rate: rate(interventions.filter(x => x.useful).length, interventions.length), cost_per_verified_success: rate(successes.reduce((s, x) => s + x.cost, 0), successes.length), sol_routes: Object.fromEntries([...new Set(r.map(x => x.sol_source).filter(Boolean))].map(k => [k, r.filter(x => x.sol_source === k).length])) } }
export function validateMemory(record = {}) { return ["kind", "signal", "outcome"].every(k => text(record[k])) }
export function shadowAudit(record, rate = .1) { const sample = Number(record?.sample); const bounded = Number.isFinite(rate) && rate >= 0 && rate <= 1; return { sampled: bounded && Number.isFinite(sample) ? sample < rate : false, rate, valid: bounded, reason: "bounded_shadow_sample" } }

const lessonValue = (value) => text(value).replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").slice(0, 240)
export function buildLessonEntry({ date = new Date().toISOString().slice(0, 10), todo = "", playbook = "", feedback = "", result = "", symptom = "", evidence = "", rootCause = "", contributingFactor = "", routing = "", intervention = "", prevention = "", status = "pending" } = {}) {
  const fields = [["Date", date], ["Todo/Playbook", [todo, playbook].filter(Boolean).join(" / ")], ["feedback/result", [feedback, result].filter(Boolean).join("; ")], ["symptom/evidence", [symptom, evidence].filter(Boolean).join("; ")], ["root cause or contributing factor", [rootCause, contributingFactor].filter(Boolean).join("; ")], ["routing/intervention", [routing, intervention].filter(Boolean).join("; ")], ["prevention lesson", prevention], ["status", ["pending", "promoted", "validated"].includes(status) ? status : "pending"]]
  return fields.map(([key, value]) => `- ${key}: ${lessonValue(value) || "none"}`).join("\n")
}
export function nextStepOptions() { return [
  "1. Continue autonomous work / implement the next bounded slice.",
  "2. Run an independent Luna review or targeted verification and return findings.",
  "3. Release workflow: use Matt Pocock skills (code-review, writing-for-agents or relevant docs skill, implement/tdd as needed) to review the current diff/base, update documentation in the target project, run tests, resolve review findings, then ask for explicit human approval before commit, push, and deploy; never auto-deploy or skip the human gate."
] }
