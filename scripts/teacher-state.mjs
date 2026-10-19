const evidenceStates = new Set(["MISSING_DECISIVE", "CONFLICTING", "EXHAUSTED"])
const askTypes = new Set(["inspect", "reproduce", "compare", "verify"])

const hasValue = (value) => Array.isArray(value)
  ? value.some((item) => `${item || ""}`.trim())
  : Boolean(`${value || ""}`.trim())

export const assessTeacherRequest = (request) => {
  if (!evidenceStates.has(request.state)) throw new Error(`invalid evidence state: ${request.state}`)
  if (request.humanDecision) return { eligible: false, reason: "HUMAN_DECISION_REQUIRED" }
  if (!hasValue(request.known) || !hasValue(request.attempted)) {
    return { eligible: false, reason: "MISSING_EVIDENCE_REFERENCES" }
  }
  if (request.material === false || !hasValue(request.decision) || !hasValue(request.missing)) {
    return { eligible: false, reason: "NOT_DECISION_RELEVANT" }
  }
  if (request.cheaperCheckAvailable) return { eligible: false, reason: "CHEAPER_CHECK_AVAILABLE" }
  if (request.budgetExhausted) return { eligible: false, reason: "TEACHER_BUDGET_EXHAUSTED" }
  return { eligible: true, reason: null }
}

const text = (value) => typeof value === "string" && value.trim().length > 0
const scopeKeys = ["task_id", "objective_revision", "blocker_id", "state_id"]
const sameScope = (left, right) => scopeKeys.every((key) => left[key] === right[key])
const normalized = (value) => value.trim().toLowerCase().replace(/\s+/g, " ")

// This assessment never authorizes a tool or changes a host permission.
export const assessTeacherInspection = (request = {}) => {
  const reject = (reason) => ({ eligible: false, reason })
  if (!request || typeof request !== "object") return reject("INVALID_INSPECTION_CONTEXT")
  if (!scopeKeys.every((key) => text(request[key]))) return reject("INVALID_INSPECTION_CONTEXT")
  if (request.unresolved !== true) return reject("BLOCKER_RESOLVED")
  if (!Number.isSafeInteger(request.last_progress_sequence) || request.last_progress_sequence < 0) {
    return reject("INVALID_PROGRESS_MARKER")
  }
  if (!Array.isArray(request.attempts) || request.attempts.length > 32) return reject("INVALID_ATTEMPT_LEDGER")
  const scoped = request.attempts.filter((attempt) => attempt && sameScope(attempt, request))
  if (request.last_progress_sequence > 0 && !request.attempts.some((attempt) => attempt &&
    ["task_id", "objective_revision", "blocker_id"].every((key) => attempt[key] === request[key]) &&
    attempt.sequence === request.last_progress_sequence && attempt.outcome === "progress" &&
    attempt.status === "completed" && attempt.main_verified === true &&
    [attempt.action_ref, attempt.result_ref, attempt.before_state, attempt.after_state].every(text) &&
    attempt.before_state !== attempt.after_state && attempt.after_state === request.state_id)) return reject("UNVERIFIED_PROGRESS_MARKER")
  if (scoped.some((attempt) => attempt.outcome === "progress" && attempt.sequence > request.last_progress_sequence)) {
    return reject("PROGRESS_MARKER_STALE")
  }
  const recent = scoped.filter((attempt) => attempt.sequence > request.last_progress_sequence)
    .sort((a, b) => a.sequence - b.sequence)
  const pair = recent.slice(-2)
  if (pair.length < 2) return reject("TWO_NO_PROGRESS_ATTEMPTS_REQUIRED")
  if (new Set(pair.map((attempt) => attempt.attempt_id)).size !== 2 ||
      pair.some((attempt) => request.attempts.filter((other) => other?.attempt_id === attempt.attempt_id).length !== 1)) {
    return reject("DUPLICATE_ATTEMPT")
  }
  if (pair.some((attempt) => !text(attempt.attempt_id) || !Number.isSafeInteger(attempt.sequence) ||
      attempt.status !== "completed" || attempt.outcome !== "no_progress" ||
      attempt.failure_kind !== "technical" || attempt.main_verified !== true ||
      ![attempt.hypothesis, attempt.action_ref, attempt.result_ref].every(text) ||
      attempt.before_state !== request.state_id || attempt.after_state !== request.state_id) ||
      pair[0].sequence === pair[1].sequence) {
    return reject("NO_PROGRESS_NOT_PROVEN")
  }
  if (normalized(pair[0].hypothesis) === normalized(pair[1].hypothesis) ||
      pair[0].action_ref === pair[1].action_ref || pair[0].result_ref === pair[1].result_ref) {
    return reject("DISTINCT_PROBES_REQUIRED")
  }
  const confirmation = request.main_confirmation
  if (!confirmation || !sameScope(confirmation, request) || !text(confirmation.evidence_ref) ||
      !Array.isArray(confirmation.attempt_ids) || confirmation.attempt_ids.length !== 2 ||
      pair.some((attempt, index) => confirmation.attempt_ids[index] !== attempt.attempt_id)) {
    return reject("MAIN_CONFIRMATION_REQUIRED")
  }
  return { eligible: true, reason: null, attempt_ids: pair.map((attempt) => attempt.attempt_id) }
}

export const selectEvidenceWorker = ({ type, conflicting = false }) => {
  if (!askTypes.has(type)) throw new Error(`invalid ASK type: ${type}`)
  return type === "compare" || conflicting ? "fresh-read-only" : "existing"
}

export const acceptTeacherReply = (state, reply, limits, inspection = null) => {
  const { maxAsks, maxTurnsPerAsk } = limits || {}
  const asks = state?.asks ?? 0
  const turns = state?.turns ?? 0
  const askRepairs = state?.askRepairs ?? 0
  const nextTurns = Number.isSafeInteger(turns) ? turns + 1 : 0
  const finish = (result) => {
    if (inspection && ["STOP", "FORCE_FINAL", "ASK_HUMAN"].includes(result.action)) {
      const closure = inspection.close(result.terminal || result.action)
      if (!closure.ok) return { ...result, inspection_error: closure.reason }
    }
    return result
  }
  if (!state || typeof state !== "object" ||
      ![asks, turns, askRepairs].every((value) => Number.isSafeInteger(value) && value >= 0) ||
      askRepairs > 1 || !Number.isSafeInteger(maxAsks) || maxAsks < 1 || maxAsks > 5 ||
      !Number.isSafeInteger(maxTurnsPerAsk) || maxTurnsPerAsk < 1 || maxTurnsPerAsk > 7) {
    return finish({ asks: 0, turns: 0, askRepairs: 0, action: "STOP", terminal: "BLOCKED_ENVIRONMENT", reason: "INVALID_TEACHER_STATE_OR_LIMITS" })
  }
  if (!new Set(["ASK", "FINAL", "HUMAN_QUESTION"]).has(reply?.type)) {
    inspection?.close("ERROR")
    throw new Error(`invalid teacher reply: ${reply?.type}`)
  }

  if (reply.type === "FINAL") {
    return finish({ asks, turns: nextTurns, askRepairs, action: "STOP", terminal: "FINAL", reason: null })
  }
  if (reply.type === "HUMAN_QUESTION") {
    return finish({ asks, turns: nextTurns, askRepairs, action: "ASK_HUMAN", terminal: "HUMAN_REQUIRED", reason: "HUMAN_DECISION_REQUIRED" })
  }
  if (asks >= maxAsks || nextTurns > Math.max(asks, 1) * maxTurnsPerAsk) {
    return finish({
      asks,
      turns: nextTurns,
      askRepairs,
      action: "STOP",
      terminal: "TEACHER_EXHAUSTED",
      reason: "TEACHER_BUDGET_EXHAUSTED",
    })
  }
  if (reply.valid === false) {
    if (askRepairs < 1) {
      return {
        asks,
        turns: nextTurns,
        askRepairs: askRepairs + 1,
        action: "REPAIR_ASK",
        terminal: null,
        reason: "INVALID_ASK",
      }
    }
    return finish({
      asks,
      turns: nextTurns,
      askRepairs,
      action: "FORCE_FINAL",
      terminal: null,
      reason: "INVALID_ASK",
    })
  }
  if (asks > 0 && state.informationGain === false) {
    return finish({
      asks,
      turns: nextTurns,
      askRepairs,
      action: "FORCE_FINAL",
      terminal: null,
      reason: "NO_INFORMATION_GAIN",
    })
  }
  return {
    asks: asks + 1,
    turns: nextTurns,
    askRepairs,
    action: "COLLECT_EVIDENCE",
    terminal: null,
    reason: null,
  }
}
