// Pure decisions only. Callers own persistence, execution, and host permissions.
const text = (value) => typeof value === "string" && value.trim().length > 0
const unique = (values) => new Set(values).size === values.length
const scopeKeys = ["task_id", "objective_revision", "snapshot_id"]
const validScope = (value) => value && scopeKeys.every((key) => text(value[key]))
const sameScope = (left, right) => validScope(left) && validScope(right) && scopeKeys.every((key) => left[key] === right[key])
const decision = (allowed, reason, extra = {}) => ({ allowed, reason, ...extra })
const passedVerify = (value) => value && text(value.command) && value.exit_code === 0 && value.result === "passed" && text(value.result_ref)
const normalized = (value) => value.trim().toLowerCase().replace(/\s+/g, " ")

export const validateTaskBrief = (brief = {}) => {
  if (!brief || brief.version !== 1 || !validScope(brief)) return decision(false, "INVALID_TASK_SCOPE")
  if (!text(brief.objective) || brief.objective.length > 500) return decision(false, "INVALID_OBJECTIVE")
  if (!Array.isArray(brief.success) || brief.success.length === 0 || brief.success.length > 32) {
    return decision(false, "SUCCESS_REQUIRED")
  }
  if (brief.success.some((criterion, index) => !criterion || criterion.id !== index + 1 ||
      !text(criterion.claim) || criterion.claim.length > 300 || !criterion.verify ||
      ![criterion.verify.check_id, criterion.verify.check_version, criterion.verify.command, criterion.verify.expected].every(text))) {
    return decision(false, "NUMBERED_FALSIFIABLE_CRITERIA_REQUIRED")
  }
  return decision(true, null)
}

export const assessEvidenceReuse = ({ evidence, context } = {}) => {
  if (!context || !evidence || evidence.version !== 1 || !sameScope(evidence, context) ||
      !Number.isSafeInteger(context.criterion_id) || context.criterion_id < 1 ||
      ![context.check_id, context.check_version, context.command].every(text)) {
    return decision(false, "EVIDENCE_SCOPE_UNKNOWN_OR_CHANGED")
  }
  if (evidence.criterion_id !== context.criterion_id || evidence.check_id !== context.check_id ||
      evidence.check_version !== context.check_version || evidence.verify?.command !== context.command) {
    return decision(false, "CHECK_CHANGED")
  }
  if (!text(evidence.evidence_ref) || evidence.status !== "passed" || !passedVerify(evidence.verify)) {
    return decision(false, "PASSING_EVIDENCE_REQUIRED")
  }
  return decision(true, null, { evidence_ref: evidence.evidence_ref })
}

export const assessAcceptance = ({ brief, evidence, main_confirmation } = {}) => {
  const invalid = validateTaskBrief(brief)
  const reject = (reason, extra = {}) => ({ accepted: false, reason, ...extra })
  if (!invalid.allowed) return reject(invalid.reason)
  if (!Array.isArray(evidence) || evidence.length === 0 || !unique(evidence.map((item) => item?.evidence_ref))) {
    return reject("UNIQUE_EVIDENCE_REQUIRED")
  }
  // Reject stale, foreign, unknown, and failed records even when another record covers the criterion.
  for (const item of evidence) {
    const criterion = brief.success.find((entry) => entry.id === item?.criterion_id)
    if (!criterion) return reject("UNKNOWN_CRITERION")
    const result = assessEvidenceReuse({ evidence: item, context: { ...brief, criterion_id: criterion.id, check_id: criterion.verify.check_id, check_version: criterion.verify.check_version, command: criterion.verify.command } })
    if (!result.allowed) return reject(result.reason)
  }
  const missing = brief.success.filter((criterion) => !evidence.some((item) => item.criterion_id === criterion.id)).map((item) => item.id)
  if (missing.length) return reject("INCOMPLETE_COVERAGE", { missing_criteria: missing })
  const confirmation = main_confirmation
  if (!confirmation || confirmation.version !== 1 || !sameScope(confirmation, brief) ||
      confirmation.actor !== "main" || confirmation.integrated !== true || confirmation.status !== "passed" ||
      !text(confirmation.evidence_ref) || !passedVerify(confirmation.verify) ||
      !Array.isArray(confirmation.criterion_ids) || !unique(confirmation.criterion_ids) ||
      confirmation.criterion_ids.length !== brief.success.length ||
      brief.success.some((criterion) => !confirmation.criterion_ids.includes(criterion.id)) ||
      !Array.isArray(confirmation.evidence_refs) || !unique(confirmation.evidence_refs) ||
      confirmation.evidence_refs.length !== evidence.length ||
      evidence.some((item) => !confirmation.evidence_refs.includes(item.evidence_ref))) {
    return reject("MAIN_INTEGRATION_VERIFICATION_REQUIRED")
  }
  return { accepted: true, reason: null, coverage: `${brief.success.length}/${brief.success.length}`, evidence_refs: evidence.map((item) => item.evidence_ref) }
}

const costRoles = ["main", "worker", "teacher", "handoff", "test"]
export const routeMilestone = ({ event, required_capabilities = [], selected_profile_id, profiles, costs, baseline_cost } = {}) => {
  if (!["start", "evidence_change", "integration", "recovery"].includes(event)) return decision(false, "MILESTONE_REQUIRED")
  if (!Array.isArray(required_capabilities) || required_capabilities.length === 0 || !required_capabilities.every(text) ||
      !Array.isArray(profiles) || !unique(profiles.map((profile) => profile?.id))) return decision(false, "INVALID_ROUTE_CONTEXT")
  const capable = (profile) => profile && [profile.id, profile.strategy, profile.model].every(text) && profile.tested === true &&
    Array.isArray(profile.evidence_refs) && profile.evidence_refs.length > 0 && profile.evidence_refs.every(text) &&
    Array.isArray(profile.capabilities) && required_capabilities.every((capability) => profile.capabilities.includes(capability))
  const profile = selected_profile_id === undefined ? profiles.find(capable)
    : profiles.find((item) => item?.id === selected_profile_id)
  if (!capable(profile)) {
    return decision(false, "TESTED_CAPABLE_PROFILE_REQUIRED")
  }
  const complete = Array.isArray(costs) && costs.length >= costRoles.length &&
    costRoles.every((role) => costs.some((item) => item?.role === role)) &&
    costs.every((item) => item && costRoles.includes(item.role) && Number.isFinite(item.amount) && item.amount >= 0 && text(item.currency)) &&
    new Set(costs.map((item) => item.currency)).size === 1
  // Multiple entries per role are permitted; every turn and handoff belongs in the ledger.
  const sum = complete ? costs.reduce((total, item) => total + item.amount, 0) : null
  const total = Number.isFinite(sum) ? sum : null
  const comparable = total !== null && baseline_cost && Number.isFinite(baseline_cost.amount) && baseline_cost.amount >= 0 && baseline_cost.currency === costs[0].currency
  return decision(true, null, { profile_id: profile.id, strategy: profile.strategy, model: profile.model,
    total_cost: total, currency: total !== null ? costs[0].currency : null,
    savings: comparable ? baseline_cost.amount - total : null })
}

const attemptScopeKeys = ["task_id", "objective_revision", "blocker_id", "state_id"]
const validAttemptScope = (value) => value && attemptScopeKeys.every((key) => text(value[key]))
const sameAttemptScope = (left, right) => validAttemptScope(left) && validAttemptScope(right) && attemptScopeKeys.every((key) => left[key] === right[key])
export const assessRecovery = (request = {}) => {
  if (!validAttemptScope(request) || request.unresolved !== true ||
      !Number.isSafeInteger(request.last_progress_sequence) || request.last_progress_sequence < 0 ||
      !Array.isArray(request.attempts) || request.attempts.length > 32 ||
      !Number.isSafeInteger(request.recovery_count) || request.recovery_count < 0) return decision(false, "INVALID_RECOVERY_CONTEXT")
  if (request.last_progress_sequence > 0 && !request.attempts.some((attempt) =>
      attempt && ["task_id", "objective_revision", "blocker_id"].every((key) => attempt[key] === request[key]) &&
      attempt.sequence === request.last_progress_sequence && attempt.status === "completed" &&
      attempt.outcome === "progress" && attempt.main_verified === true &&
      [attempt.action_ref, attempt.result_ref, attempt.before_state, attempt.after_state].every(text) &&
      attempt.before_state !== attempt.after_state && attempt.after_state === request.state_id)) {
    return decision(false, "VERIFIED_PROGRESS_REQUIRED")
  }
  const scoped = request.attempts.filter((attempt) => sameAttemptScope(attempt, request))
  if (request.attempts.some((attempt) => attempt &&
      ["task_id", "objective_revision", "blocker_id"].every((key) => attempt[key] === request[key]) &&
      attempt.outcome === "progress" && attempt.sequence > request.last_progress_sequence)) {
    return decision(false, "PROGRESS_MARKER_STALE")
  }
  if (!unique(request.attempts.map((attempt) => attempt?.attempt_id))) return decision(false, "DUPLICATE_OR_INVALID_ATTEMPT")
  const recent = scoped.filter((attempt) => attempt.sequence > request.last_progress_sequence).sort((a, b) => a.sequence - b.sequence)
  if (recent.some((attempt) => !text(attempt.attempt_id) || !Number.isSafeInteger(attempt.sequence)) ||
      !unique(recent.map((attempt) => attempt.attempt_id)) || !unique(recent.map((attempt) => attempt.sequence))) return decision(false, "DUPLICATE_OR_INVALID_ATTEMPT")
  const latest = recent.at(-1)
  if (["provider", "network", "permission"].includes(latest?.failure_kind)) return decision(false, "ENVIRONMENT_BLOCKED", { action: "STOP" })
  if (latest && latest.status !== "completed") return decision(false, "ATTEMPT_PENDING", { action: "WAIT" })
  const probes = recent.filter((attempt) => attempt.status === "completed" && attempt.outcome === "no_progress" &&
    attempt.failure_kind === "technical" && attempt.main_verified === true &&
    [attempt.hypothesis, attempt.action_ref, attempt.result_ref, attempt.before_state, attempt.after_state].every(text))
  const distinct = probes.filter((attempt, index) => probes.findIndex((other) => normalized(other.hypothesis) === normalized(attempt.hypothesis) ||
    other.action_ref === attempt.action_ref || other.result_ref === attempt.result_ref) === index)
  if (distinct.length !== probes.length) return decision(false, "REPEATED_PROBE", { action: "STOP", distinct_attempts: distinct.length })
  const cycle = distinct.some((attempt, index) => distinct.slice(0, index).some((earlier) => earlier.before_state === attempt.after_state && earlier.before_state !== earlier.after_state))
  const stalled = distinct.filter((attempt) => attempt.before_state === request.state_id && attempt.after_state === request.state_id).length >= 2
  if (!stalled && !cycle) return decision(true, null, { action: "CONTINUE", distinct_attempts: distinct.length })
  if (request.recovery_count >= 1) return decision(false, "RECOVERY_EXHAUSTED", { action: "STOP", distinct_attempts: distinct.length })
  const confirmation = request.main_confirmation
  if (!sameAttemptScope(confirmation, request) || !text(confirmation.evidence_ref) ||
      !Array.isArray(confirmation.attempt_ids) || confirmation.attempt_ids.length !== distinct.length ||
      distinct.some((attempt, index) => confirmation.attempt_ids[index] !== attempt.attempt_id)) return decision(false, "MAIN_CONFIRMATION_REQUIRED", { action: "STOP" })
  return decision(true, cycle ? "CYCLE_DETECTED" : "NO_PROGRESS", { action: "RECOVER_ONCE", distinct_attempts: distinct.length })
}

export const resolveAuthority = ({ task_id, objective_revision, decision_id, scope, kind, answers = [] } = {}) => {
  if (![task_id, objective_revision, decision_id, scope].every(text) || !["missing_authority", "goal_conflict"].includes(kind) || !Array.isArray(answers)) {
    return decision(false, "INVALID_AUTHORITY_CONTEXT")
  }
  // Opaque exact scope must describe the action and target, including material limits.
  const matching = answers.filter((answer) => answer?.task_id === task_id && answer.objective_revision === objective_revision && answer.scope === scope && answer.kind === kind)
  if (matching.length > 1 || matching.some((answer) => !text(answer.decision_id) || !text(answer.evidence_ref) || !["approved", "denied", "pending"].includes(answer.status))) {
    return decision(false, "AUTHORITY_ANSWER_CONFLICT")
  }
  const answer = matching[0]
  if (answer?.status === "approved") return decision(true, null, { action: "REUSE_ANSWER", decision_id: answer.decision_id, evidence_ref: answer.evidence_ref })
  if (answer?.status === "denied") return decision(false, "AUTHORITY_DENIED", { action: "STOP", decision_id: answer.decision_id })
  return decision(false, "HUMAN_DECISION_REQUIRED", { action: answer ? "WAIT" : "ASK_ONCE", decision_id: answer?.decision_id ?? decision_id })
}

export const assessDispatch = ({ task_id, objective_revision, workers = [], active_workers = [], dispatched_ids = [], parent_role = "main", integration } = {}) => {
  if (![task_id, objective_revision].every(text) || parent_role !== "main") return decision(false, "MAIN_DISPATCH_ONLY")
  if (!Array.isArray(workers) || workers.length === 0 || !Array.isArray(active_workers) ||
      workers.length + active_workers.length > 2 || !Array.isArray(dispatched_ids) ||
      !unique([...workers, ...active_workers].map((worker) => worker?.id))) return decision(false, "AT_MOST_TWO_UNIQUE_WORKERS")
  if (!integration || !text(integration.owner) || integration.owner !== "main" || !text(integration.verify_command)) return decision(false, "INTEGRATION_PLAN_REQUIRED")
  const writes = []
  const worktrees = []
  const combined = [...active_workers, ...workers]
  for (const worker of combined) {
    if (!worker || !text(worker.id) || (workers.includes(worker) && dispatched_ids.includes(worker.id))) return decision(false, "DUPLICATE_DISPATCH")
    if (worker.task_id !== task_id || worker.objective_revision !== objective_revision || worker.independent !== true ||
        worker.can_delegate !== false || !Array.isArray(worker.write_paths) || !worker.write_paths.every(text)) return decision(false, "INDEPENDENT_SCOPED_WORK_REQUIRED")
    if (worker.write_paths.some((path) => path.startsWith("/") || path.split("/").some((part) => ["", ".", ".."].includes(part)) || /[\\:*?\[\]{}\x00-\x1f]/.test(path))) return decision(false, "CANONICAL_WRITE_PATHS_REQUIRED")
    if (combined.length > 1 && worker.write_paths.length > 0) {
      if (!text(worker.worktree_id) || worker.isolated !== true || worker.writable !== true || worker.worktree_ready !== true || worktrees.includes(worker.worktree_id)) return decision(false, "ISOLATED_WRITABLE_WORKTREES_REQUIRED")
      worktrees.push(worker.worktree_id)
    }
    for (const path of worker.write_paths) {
      const canonical = path.toLowerCase()
      if (writes.some((owned) => canonical === owned || canonical.startsWith(`${owned}/`) || owned.startsWith(`${canonical}/`))) return decision(false, "WRITE_OWNER_CONFLICT")
      writes.push(canonical)
    }
  }
  return decision(true, null, { worker_ids: workers.map((worker) => worker.id), acceptance_required: true })
}
