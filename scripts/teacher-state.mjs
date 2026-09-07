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

export const selectEvidenceWorker = ({ type, conflicting = false }) => {
  if (!askTypes.has(type)) throw new Error(`invalid ASK type: ${type}`)
  return type === "compare" || conflicting ? "fresh-read-only" : "existing"
}

export const acceptTeacherReply = (state, reply) => {
  const asks = Number(state.asks || 0)
  const turns = Number(state.turns || 0)
  const askRepairs = Number(state.askRepairs || 0)
  const nextTurns = turns + 1
  if (!new Set(["ASK", "FINAL"]).has(reply.type)) throw new Error(`invalid teacher reply: ${reply.type}`)

  if (reply.type === "FINAL") {
    return { asks, turns: nextTurns, askRepairs, action: "STOP", terminal: "FINAL", reason: null }
  }
  if (nextTurns >= 5 || asks >= 3) {
    return {
      asks,
      turns: nextTurns,
      askRepairs,
      action: "STOP",
      terminal: "TEACHER_EXHAUSTED",
      reason: "TEACHER_BUDGET_EXHAUSTED",
    }
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
    return {
      asks,
      turns: nextTurns,
      askRepairs,
      action: "FORCE_FINAL",
      terminal: null,
      reason: "INVALID_ASK",
    }
  }
  if (asks > 0 && state.informationGain === false) {
    return {
      asks,
      turns: nextTurns,
      askRepairs,
      action: "FORCE_FINAL",
      terminal: null,
      reason: "NO_INFORMATION_GAIN",
    }
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
