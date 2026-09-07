import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { detectWaste, redactExcerpt, wasteKinds } from "./diagnostics.mjs"

const hosts = new Set(["codex", "opencode", "github-copilot"])
const tokenSources = new Set(["native", "provider", "unknown"])
const modelSources = new Set(["native", "provider", "unknown"])
const outcomes = new Set([
  "VERIFIED",
  "PARTIAL_WITH_UNKNOWN",
  "HUMAN_REQUIRED",
  "BLOCKED_ENVIRONMENT",
  "TEACHER_EXHAUSTED",
  "FAILED_VERIFICATION",
])
const incompleteFallbackReasons = new Set([
  "unapproved-runtime-mismatch",
  "unknown-provider-error",
  "provider-error",
  "runtime-resolved-different-from-primary",
])
const explicitFallbackReason = (value) => /^(?:primary-(?:http-[1-5]\d\d|[a-z0-9]+-[a-z0-9-]+)|provider-[a-z0-9][a-z0-9_-]{2,47}|runtime-[a-z0-9]+-[a-z0-9-]+)$/.test(value || "")
const forbiddenKeys = new Set([
  "prompt_text",
  "transcript",
  "transcript_path",
  "diff",
  "secret",
  "cookies",
  "tool_input",
  "tool_args",
  "tool_arguments",
  "raw_output",
  "full_output",
])

const finiteOrNull = (value, name) => {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number or null`)
  return value
}
const integerOrNull = (value, name) => {
  const number = finiteOrNull(value, name)
  if (number !== null && !Number.isInteger(number)) throw new Error(`${name} must be an integer or null`)
  return number
}
const stringOrNull = (value, name) => {
  if (value === null || value === undefined || value === "") return null
  if (typeof value !== "string") throw new Error(`${name} must be a string or null`)
  return value
}
const requiredString = (value, name) => {
  const result = stringOrNull(value, name)
  if (!result) throw new Error(`${name} is required`)
  return result
}
const booleanOrNull = (value, name) => {
  if (value === null || value === undefined) return null
  if (typeof value !== "boolean") throw new Error(`${name} must be boolean or null`)
  return value
}
const strings = (value, name) => {
  if (value === null || value === undefined) return []
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item)) {
    throw new Error(`${name} must be an array of non-empty strings`)
  }
  return [...value]
}
const records = (value, name) => {
  if (value === null || value === undefined) return []
  if (!Array.isArray(value) || value.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
    throw new Error(`${name} must be an array of objects`)
  }
  return value
}
const assertPromptFree = (value, location = "run") => {
  if (!value || typeof value !== "object") return
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key.toLowerCase())) throw new Error(`${location}.${key} is forbidden`)
    assertPromptFree(child, `${location}.${key}`)
  }
}
const isoWeek = (value) => {
  const date = new Date(value)
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((day - yearStart) / 86400000) + 1) / 7)
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}

const actor = (value, name) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} is required`)
  const requestedModel = stringOrNull(value.requested_model, `${name}.requested_model`)
  const resolvedModel = stringOrNull(value.resolved_model, `${name}.resolved_model`)
  const fallbackReason = stringOrNull(value.fallback_reason, `${name}.fallback_reason`)
  const modelSource = value.model_source || "unknown"
  const tokenSource = value.token_source || "unknown"
  if (!modelSources.has(modelSource)) throw new Error(`${name}.model_source must be native, provider, or unknown`)
  if (!tokenSources.has(tokenSource)) throw new Error(`${name}.token_source must be native, provider, or unknown`)
  const tokens = finiteOrNull(value.tokens, `${name}.tokens`)
  if (typeof value.used !== "boolean") throw new Error(`${name}.used is required and must be boolean`)
  if (!value.used && (resolvedModel || tokens !== null)) throw new Error(`${name} cannot hide a resolved model or tokens with used false`)
  if (resolvedModel && modelSource === "unknown") throw new Error(`${name}.resolved_model requires native or provider model_source`)
  if (!resolvedModel && modelSource !== "unknown") throw new Error(`${name}.model_source cannot claim a resolved model when resolved_model is null`)
  if (tokenSource === "unknown" && tokens !== null) throw new Error(`${name}.tokens require a native or provider source`)
  if (tokenSource !== "unknown" && tokens === null) throw new Error(`${name}.token_source cannot claim observed tokens when tokens are null`)
  if (requestedModel && resolvedModel && requestedModel !== resolvedModel && !fallbackReason) {
    throw new Error(`${name}.fallback_reason is required when requested and resolved models differ`)
  }
  if (requestedModel && resolvedModel && requestedModel === resolvedModel && fallbackReason) {
    throw new Error(`${name}.fallback_reason requires differing requested and resolved models`)
  }
  return {
    used: value.used,
    requested_model: requestedModel,
    resolved_model: resolvedModel,
    fallback_reason: fallbackReason,
    model_source: modelSource,
    token_source: tokenSource,
    tokens,
  }
}

const actorCell = (name, value) => {
  if (!value.used) return `${name}:no-${name}`
  const requested = value.requested_model || "unknown"
  const resolved = value.resolved_model || "unknown"
  const provenance = value.fallback_reason
    || (requested === resolved && resolved !== "unknown" ? "direct" : resolved === "unknown" ? "unresolved" : "unrequested")
  return `${name}:${requested}>${resolved}@${provenance}`
}

export const buildCellID = ({ host, actors, route, task, promptProfileID }) => [
  host,
  actorCell("main", actors.main),
  actorCell("worker", actors.worker),
  actorCell("teacher", actors.teacher),
  route,
  task.class,
  task.complexity,
  `profile:${promptProfileID || "unknown"}`,
].join("|")

const tokenMeasure = (value = {}, name) => {
  const tokenSource = value.token_source || "unknown"
  if (!tokenSources.has(tokenSource)) throw new Error(`${name}.token_source must be native, provider, or unknown`)
  const tokens = finiteOrNull(value.tokens, `${name}.tokens`)
  if (tokenSource === "unknown" && tokens !== null) throw new Error(`${name}.tokens require a native or provider source`)
  if (tokenSource !== "unknown" && tokens === null) throw new Error(`${name}.token_source cannot claim observed tokens when tokens are null`)
  return { token_source: tokenSource, tokens }
}
const ratio = (numerator, denominator) => Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0
  ? numerator / denominator
  : null
const sumFinite = (values) => {
  const finite = values.filter(Number.isFinite)
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) : null
}

const normalizePrompt = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("prompt must be an object")
  return {
    profile_id: requiredString(value.profile_id, "prompt.profile_id"),
    component_ids: strings(value.component_ids, "prompt.component_ids"),
    component_tokens: integerOrNull(value.component_tokens, "prompt.component_tokens"),
    loaded_files: strings(value.loaded_files, "prompt.loaded_files"),
    duplicate_context_tokens: integerOrNull(value.duplicate_context_tokens, "prompt.duplicate_context_tokens"),
  }
}

const normalizeTimeline = (value) => records(value, "timeline").map((item, index) => ({
  at_ms: integerOrNull(item.at_ms, `timeline[${index}].at_ms`),
  actor: requiredString(item.actor, `timeline[${index}].actor`),
  phase: stringOrNull(item.phase, `timeline[${index}].phase`),
  event: requiredString(item.event, `timeline[${index}].event`),
  duration_ms: finiteOrNull(item.duration_ms, `timeline[${index}].duration_ms`),
  input_tokens: integerOrNull(item.input_tokens, `timeline[${index}].input_tokens`),
  output_tokens: integerOrNull(item.output_tokens, `timeline[${index}].output_tokens`),
  tool_category: stringOrNull(item.tool_category, `timeline[${index}].tool_category`),
  result_code: stringOrNull(item.result_code, `timeline[${index}].result_code`),
  signature: stringOrNull(item.signature, `timeline[${index}].signature`),
  revision: stringOrNull(item.revision, `timeline[${index}].revision`),
  changed: booleanOrNull(item.changed, `timeline[${index}].changed`),
  information_gain: stringOrNull(item.information_gain, `timeline[${index}].information_gain`),
}))

const normalizeGauntlet = (value) => records(value, "gauntlet").map((item, index) => ({
  cycle: integerOrNull(item.cycle, `gauntlet[${index}].cycle`),
  actor: requiredString(item.actor, `gauntlet[${index}].actor`),
  hypothesis_type: stringOrNull(item.hypothesis_type, `gauntlet[${index}].hypothesis_type`),
  probe_type: stringOrNull(item.probe_type, `gauntlet[${index}].probe_type`),
  artifact_changed: booleanOrNull(item.artifact_changed, `gauntlet[${index}].artifact_changed`),
  outcome: stringOrNull(item.outcome, `gauntlet[${index}].outcome`),
  information_gain: stringOrNull(item.information_gain, `gauntlet[${index}].information_gain`),
}))

const normalizeTeacher = (value) => records(value, "teacher").map((item, index) => ({
  turn: integerOrNull(item.turn, `teacher[${index}].turn`),
  response_type: requiredString(item.response_type, `teacher[${index}].response_type`),
  question_type: stringOrNull(item.question_type, `teacher[${index}].question_type`),
  ask_id: stringOrNull(item.ask_id, `teacher[${index}].ask_id`),
  evidence_received: booleanOrNull(item.evidence_received, `teacher[${index}].evidence_received`),
  decision_changed: booleanOrNull(item.decision_changed, `teacher[${index}].decision_changed`),
  actionable: booleanOrNull(item.actionable, `teacher[${index}].actionable`),
  post_teacher_green: booleanOrNull(item.post_teacher_green, `teacher[${index}].post_teacher_green`),
  information_gain: stringOrNull(item.information_gain, `teacher[${index}].information_gain`),
  main_repair: booleanOrNull(item.main_repair, `teacher[${index}].main_repair`),
  human_redirect: booleanOrNull(item.human_redirect, `teacher[${index}].human_redirect`),
}))

const normalizeWaste = (explicit, timeline) => {
  const raw = explicit === undefined ? detectWaste(timeline) : records(explicit, "waste_events")
  let excerptCount = 0
  return raw.map((item, index) => {
    if (!wasteKinds.has(item.kind)) throw new Error(`waste_events[${index}].kind is invalid`)
    const excerpts = strings(item.excerpts, `waste_events[${index}].excerpts`)
    if (excerpts.length > 2) throw new Error("waste events allow at most two excerpts")
    excerptCount += excerpts.length
    if (excerptCount > 10) throw new Error("a run allows at most ten excerpts")
    return {
      kind: item.kind,
      actor: requiredString(item.actor, `waste_events[${index}].actor`),
      phase: requiredString(item.phase, `waste_events[${index}].phase`),
      signature: stringOrNull(item.signature, `waste_events[${index}].signature`),
      observed_wasted_tokens: integerOrNull(item.observed_wasted_tokens, `waste_events[${index}].observed_wasted_tokens`),
      estimated_wasted_tokens: integerOrNull(item.estimated_wasted_tokens, `waste_events[${index}].estimated_wasted_tokens`),
      excerpts: excerpts.map(redactExcerpt),
    }
  })
}

export const normalizeRun = (input, attestation = null) => {
  assertPromptFree(input)
  if (input.schema_version !== 4 || input.kind !== "run") throw new Error("run must use schema_version 4 and kind run")
  if (!hosts.has(input.host)) throw new Error("host must be codex, opencode, or github-copilot")
  const at = input.at || new Date().toISOString()
  if (Number.isNaN(Date.parse(at))) throw new Error("at must be an ISO timestamp")
  const prompt = normalizePrompt(input.prompt)
  const actors = {
    main: actor(input.actors?.main, "actors.main"),
    worker: actor(input.actors?.worker, "actors.worker"),
    teacher: actor(input.actors?.teacher, "actors.teacher"),
  }
  const research = tokenMeasure(input.research, "research")
  const rawQuality = attestation || input.quality || {}
  const routingProvenanceComplete = Object.values(actors).every((item) => {
    const substituted = item.requested_model && item.resolved_model && item.requested_model !== item.resolved_model
    return !substituted || (explicitFallbackReason(item.fallback_reason)
      && !incompleteFallbackReasons.has(item.fallback_reason)
      && !item.fallback_reason.startsWith("unknown-"))
  })
  const quality = {
    attested: Boolean(attestation),
    source: attestation ? "host-attestation" : "untrusted-run-claim",
    routing_provenance_complete: routingProvenanceComplete,
    verify_id: stringOrNull(rawQuality.verify_id, "quality.verify_id"),
    verify_exit_code: integerOrNull(rawQuality.verify_exit_code, "quality.verify_exit_code"),
    semantic_success: booleanOrNull(rawQuality.semantic_success, "quality.semantic_success"),
    scope_covered: integerOrNull(rawQuality.scope_covered, "quality.scope_covered"),
    scope_total: integerOrNull(rawQuality.scope_total, "quality.scope_total"),
    review_pass: booleanOrNull(rawQuality.review_pass, "quality.review_pass"),
    forbidden_changes: integerOrNull(rawQuality.forbidden_changes, "quality.forbidden_changes"),
  }
  quality.eligible = quality.attested && quality.routing_provenance_complete && Boolean(
    quality.verify_id
    && quality.verify_exit_code === 0
    && quality.semantic_success === true
    && quality.scope_total > 0
    && quality.scope_covered === quality.scope_total
    && quality.review_pass === true
    && quality.forbidden_changes === 0
  )
  const work = {
    main_actions: integerOrNull(input.work?.main_actions, "work.main_actions"),
    worker_actions: integerOrNull(input.work?.worker_actions, "work.worker_actions"),
    accepted_worker_actions: integerOrNull(attestation?.accepted_worker_actions, "work.accepted_worker_actions"),
    parent_rework: integerOrNull(attestation?.parent_rework, "work.parent_rework"),
  }
  const friction = {
    reroutes: integerOrNull(input.friction?.reroutes, "friction.reroutes") || 0,
    followups: integerOrNull(input.friction?.followups, "friction.followups") || 0,
    teacher_turns: integerOrNull(input.friction?.teacher_turns, "friction.teacher_turns") || 0,
    errors: integerOrNull(input.friction?.errors, "friction.errors") || 0,
  }
  const timeline = normalizeTimeline(input.timeline)
  const gauntlet = normalizeGauntlet(input.gauntlet)
  const teacher = normalizeTeacher(input.teacher)
  const wasteEvents = normalizeWaste(input.waste_events, timeline)
  const usedActors = Object.values(actors).filter((item) => item.used)
  const operationalTotal = usedActors.length && usedActors.every((item) => Number.isFinite(item.tokens))
    ? usedActors.reduce((sum, item) => sum + item.tokens, 0)
    : null
  const executionTotal = sumFinite([work.main_actions, work.accepted_worker_actions])
  const task = {
    id: requiredString(input.task?.id, "task.id"),
    class: requiredString(input.task?.class, "task.class"),
    complexity: requiredString(input.task?.complexity, "task.complexity"),
  }
  const route = requiredString(input.route, "route")
  const participationComplete = route === "teacher"
    ? actors.teacher.used
    : ["explore", "diagnose", "fix", "implement", "review"].includes(route)
      ? actors.worker.used
      : true
  quality.participation_complete = participationComplete
  quality.eligible = quality.eligible && participationComplete
  const asks = teacher.filter((item) => item.response_type === "ASK")
  const finals = teacher.filter((item) => item.response_type === "FINAL")
  const evidenceReceived = asks.filter((item) => item.evidence_received === true).length
  const decisionTurns = teacher.filter((item) => item.decision_changed !== null)
  const estimatedWaste = wasteEvents.reduce((sum, item) => sum + (item.estimated_wasted_tokens || 0), 0)
  const outcome = requiredString(input.outcome, "outcome")
  if (!outcomes.has(outcome)) throw new Error(`invalid outcome: ${outcome}`)
  const cellID = buildCellID({ host: input.host, actors, route, task, promptProfileID: prompt.profile_id })
  return {
    schema_version: 4,
    kind: "run",
    run_id: requiredString(input.run_id, "run_id"),
    at,
    week: input.week || isoWeek(at),
    host: input.host,
    harness_version: stringOrNull(input.harness_version, "harness_version"),
    route,
    task,
    recipe_id: requiredString(input.recipe_id, "recipe_id"),
    playbook_version: requiredString(input.playbook_version, "playbook_version"),
    prompt,
    cell_id: cellID,
    actors,
    tokens: { operational_total: operationalTotal, research_total: research.tokens },
    research,
    quality,
    work,
    friction,
    timeline,
    gauntlet,
    teacher,
    waste_events: wasteEvents,
    metrics: {
      worker_token_share: ratio(actors.worker.tokens, operationalTotal),
      worker_execution_share: ratio(work.accepted_worker_actions, executionTotal),
      friction_score: friction.reroutes + friction.followups + friction.teacher_turns + friction.errors,
      waste_event_count: wasteEvents.length,
      estimated_wasted_tokens: estimatedWaste,
      teacher_ask_count: asks.length,
      teacher_answer_rate: asks.length ? evidenceReceived / asks.length : null,
      teacher_decision_change_rate: decisionTurns.length
        ? decisionTurns.filter((item) => item.decision_changed).length / decisionTurns.length
        : null,
      teacher_final_actionable: finals.length ? Number(finals.some((item) => item.actionable === true)) : null,
      post_teacher_green: finals.length ? Number(finals.some((item) => item.post_teacher_green === true)) : null,
      teacher_repeat_requests: wasteEvents.filter((item) => item.kind === "teacher_repeat_request").length,
      teacher_zero_information_turns: wasteEvents.filter((item) => item.kind === "zero_information_gain").length,
      teacher_main_repairs: teacher.filter((item) => item.main_repair === true).length
        + wasteEvents.filter((item) => item.kind === "main_repair").length,
      teacher_human_redirects: teacher.filter((item) => item.human_redirect === true).length,
    },
    outcome,
    duration_ms: finiteOrNull(input.duration_ms, "duration_ms"),
  }
}

const readJsonLines = (path) => {
  if (!existsSync(path)) return []
  return readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)] } catch { return [] }
  })
}

export const appendRun = (input, stateDir) => {
  const run = normalizeRun(input)
  mkdirSync(stateDir, { recursive: true })
  appendFileSync(join(stateDir, "runs.jsonl"), `${JSON.stringify(run)}\n`)
  return run
}

export const appendAttestation = (input, stateDir) => {
  const attestation = {
    schema_version: 4,
    kind: "attestation",
    source: "host",
    run_id: requiredString(input.run_id, "run_id"),
    at: input.at || new Date().toISOString(),
    verify_id: requiredString(input.verify_id, "verify_id"),
    verify_exit_code: integerOrNull(input.verify_exit_code, "verify_exit_code"),
    semantic_success: booleanOrNull(input.semantic_success, "semantic_success"),
    scope_covered: integerOrNull(input.scope_covered, "scope_covered"),
    scope_total: integerOrNull(input.scope_total, "scope_total"),
    review_pass: booleanOrNull(input.review_pass, "review_pass"),
    forbidden_changes: integerOrNull(input.forbidden_changes, "forbidden_changes"),
    accepted_worker_actions: integerOrNull(input.accepted_worker_actions, "accepted_worker_actions"),
    parent_rework: integerOrNull(input.parent_rework, "parent_rework"),
  }
  mkdirSync(stateDir, { recursive: true })
  appendFileSync(join(stateDir, "attestations.jsonl"), `${JSON.stringify(attestation)}\n`)
  return attestation
}

export const readRuns = (stateDir) => {
  const attestations = new Map(readJsonLines(join(stateDir, "attestations.jsonl"))
    .filter((item) => item.schema_version === 4)
    .map((item) => [item.run_id, item]))
  return readJsonLines(join(stateDir, "runs.jsonl"))
    .filter((item) => item.schema_version === 4 && item.kind === "run")
    .map((item) => normalizeRun(item, attestations.get(item.run_id)))
}

const median = (values) => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
const p90 = (values) => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.9) - 1)]
}
const average = (values) => {
  const finite = values.filter(Number.isFinite)
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null
}
const latestByTask = (runs) => new Map(runs.map((run) => [run.task.id, run]))
const comparisonCell = (run) => run.cell_id.replace(/\|profile:[^|]+$/, "")
const summarizeSide = (runs) => {
  const tokenValues = runs.map((run) => run.tokens.operational_total).filter(Number.isFinite)
  const totalTokens = tokenValues.reduce((sum, value) => sum + value, 0)
  const successes = runs.filter((run) => run.quality.eligible).length
  return {
    runs: runs.length,
    verified_successes: successes,
    success_rate: runs.length ? successes / runs.length : null,
    token_runs: tokenValues.length,
    median_tokens: median(tokenValues),
    p90_tokens: p90(tokenValues),
    friction_per_run: average(runs.map((run) => run.metrics.friction_score)),
    worker_token_share: average(runs.map((run) => run.metrics.worker_token_share)),
    worker_execution_share: average(runs.map((run) => run.metrics.worker_execution_share)),
    measured_waste_per_run: average(runs.map((run) => run.metrics.estimated_wasted_tokens)),
    teacher_answer_rate: average(runs.map((run) => run.metrics.teacher_answer_rate)),
    teacher_final_actionable: average(runs.map((run) => run.metrics.teacher_final_actionable)),
    post_teacher_green: average(runs.map((run) => run.metrics.post_teacher_green)),
    teacher_repeat_requests: average(runs.map((run) => run.metrics.teacher_repeat_requests)),
    teacher_zero_information_turns: average(runs.map((run) => run.metrics.teacher_zero_information_turns)),
    teacher_main_repairs: average(runs.map((run) => run.metrics.teacher_main_repairs)),
    teacher_human_redirects: average(runs.map((run) => run.metrics.teacher_human_redirects)),
    verified_successes_per_100k_tokens: totalTokens ? (successes / totalTokens) * 100000 : null,
  }
}

export const compareRecipes = (runs, baseline, candidate, minimumPairs = 5) => {
  if (!Number.isInteger(minimumPairs) || minimumPairs < 5) throw new Error("minimumPairs must be an integer of at least 5")
  const baselineRuns = runs.filter((run) => run.playbook_version === baseline)
  const candidateRuns = runs.filter((run) => run.playbook_version === candidate)
  const commonCells = [...new Set(baselineRuns.map(comparisonCell))]
    .filter((cell) => candidateRuns.some((run) => comparisonCell(run) === cell))
    .sort()
  const cells = commonCells.map((cellID) => {
    const before = latestByTask(baselineRuns.filter((run) => comparisonCell(run) === cellID))
    const after = latestByTask(candidateRuns.filter((run) => comparisonCell(run) === cellID))
    const taskIDs = [...before.keys()].filter((taskID) => after.has(taskID)).sort()
    const beforePaired = taskIDs.map((taskID) => before.get(taskID))
    const afterPaired = taskIDs.map((taskID) => after.get(taskID))
    const baselineSummary = summarizeSide(beforePaired)
    const candidateSummary = summarizeSide(afterPaired)
    const tokenPairs = taskIDs.filter((taskID) => Number.isFinite(before.get(taskID).tokens.operational_total)
      && Number.isFinite(after.get(taskID).tokens.operational_total)).length
    const quantityReady = taskIDs.length >= minimumPairs && tokenPairs >= minimumPairs
    const qualityPairs = taskIDs.filter((taskID) => before.get(taskID).quality.eligible && after.get(taskID).quality.eligible).length
    const leverageObserved = [
      baselineSummary.worker_token_share,
      candidateSummary.worker_token_share,
      baselineSummary.worker_execution_share,
      candidateSummary.worker_execution_share,
    ].every(Number.isFinite)
    const comparable = quantityReady && qualityPairs === taskIDs.length && leverageObserved
    const nonDecreasing = (next, prior) => next === null || prior === null || next >= prior
    const nonIncreasing = (next, prior) => next === null || prior === null || next <= prior
    const regressed = quantityReady && !(
      nonDecreasing(candidateSummary.success_rate, baselineSummary.success_rate)
      && nonIncreasing(candidateSummary.median_tokens, baselineSummary.median_tokens)
      && nonIncreasing(candidateSummary.p90_tokens, baselineSummary.p90_tokens)
      && nonIncreasing(candidateSummary.friction_per_run, baselineSummary.friction_per_run)
      && nonDecreasing(candidateSummary.worker_token_share, baselineSummary.worker_token_share)
      && nonDecreasing(candidateSummary.worker_execution_share, baselineSummary.worker_execution_share)
      && nonIncreasing(candidateSummary.measured_waste_per_run, baselineSummary.measured_waste_per_run)
      && nonDecreasing(candidateSummary.teacher_answer_rate, baselineSummary.teacher_answer_rate)
      && nonDecreasing(candidateSummary.teacher_final_actionable, baselineSummary.teacher_final_actionable)
      && nonDecreasing(candidateSummary.post_teacher_green, baselineSummary.post_teacher_green)
      && nonIncreasing(candidateSummary.teacher_repeat_requests, baselineSummary.teacher_repeat_requests)
      && nonIncreasing(candidateSummary.teacher_zero_information_turns, baselineSummary.teacher_zero_information_turns)
      && nonIncreasing(candidateSummary.teacher_main_repairs, baselineSummary.teacher_main_repairs)
      && nonIncreasing(candidateSummary.teacher_human_redirects, baselineSummary.teacher_human_redirects)
    )
    const improved = comparable && (
      candidateSummary.success_rate > baselineSummary.success_rate
      || candidateSummary.median_tokens < baselineSummary.median_tokens
      || candidateSummary.p90_tokens < baselineSummary.p90_tokens
      || candidateSummary.friction_per_run < baselineSummary.friction_per_run
      || candidateSummary.worker_token_share > baselineSummary.worker_token_share
      || candidateSummary.worker_execution_share > baselineSummary.worker_execution_share
      || candidateSummary.measured_waste_per_run < baselineSummary.measured_waste_per_run
      || candidateSummary.teacher_answer_rate > baselineSummary.teacher_answer_rate
      || candidateSummary.teacher_final_actionable > baselineSummary.teacher_final_actionable
      || candidateSummary.post_teacher_green > baselineSummary.post_teacher_green
      || candidateSummary.teacher_repeat_requests < baselineSummary.teacher_repeat_requests
      || candidateSummary.teacher_zero_information_turns < baselineSummary.teacher_zero_information_turns
      || candidateSummary.teacher_main_repairs < baselineSummary.teacher_main_repairs
      || candidateSummary.teacher_human_redirects < baselineSummary.teacher_human_redirects
      || candidateSummary.verified_successes_per_100k_tokens > baselineSummary.verified_successes_per_100k_tokens
    )
    return {
      cell_id: cellID,
      matched_pairs: taskIDs.length,
      token_pairs: tokenPairs,
      quality_pairs: qualityPairs,
      comparable,
      regressed,
      improved,
      baseline: baselineSummary,
      candidate: candidateSummary,
    }
  })
  const comparable = cells.filter((cell) => cell.comparable)
  const verdict = cells.some((cell) => cell.regressed)
    ? "revise-or-revert"
    : comparable.length === 0 || comparable.length !== cells.length
      ? "insufficient-data"
      : comparable.some((cell) => cell.improved)
        ? "eligible-to-promote"
        : "no-change"
  return { schema_version: 4, baseline, candidate, minimum_pairs: minimumPairs, verdict, cells }
}
