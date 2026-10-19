import { createHash, randomUUID } from "node:crypto"
import { closeSync, constants, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join, resolve } from "node:path"
import { validateTaskBrief, contractDigest, assessContractReview, assessCompletionReview, assessDispatch,
  assessAcceptance, assessEvidenceReuse, assessReplan, assessRecovery, resolveAuthority } from "./execution-state.mjs"

const text = (value) => typeof value === "string" && value.trim().length > 0
const requireValue = (valid, reason) => { if (!valid) throw new Error(reason) }
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex")
const maxBytes = 1024 * 1024
const defaultStateDir = () => process.env.AW_STATE_DIR || join(homedir(), ".local/state/aw")
const acceptance = (state) => assessAcceptance({ brief: state.brief, contract_review: state.contract_review,
  completion_review: state.completion_review, builder_ids: state.builder_ids, evidence: state.evidence, main_confirmation: state.main_confirmation })
const openIssues = (state) => state.issues.some((item) => !item.resolution_ref)
const evidenceValid = (brief, item) => {
  const criterion = brief.success.find((entry) => entry.id === item?.criterion_id)
  return criterion && assessEvidenceReuse({ evidence: item, context: { ...brief, criterion_id: criterion.id,
    check_id: criterion.verify.check_id, check_version: criterion.verify.check_version, command: criterion.verify.command } }).allowed
}

export const createMission = ({ brief, workspace, next_action }) => {
  const valid = validateTaskBrief(brief)
  requireValue(valid.allowed, valid.reason)
  requireValue(text(next_action), "NEXT_ACTION_REQUIRED")
  return { version: 1, workspace: realpathSync(workspace), sequence: 0, last_event_id: null, last_event_digest: null,
    brief: structuredClone(brief), status: "active", next_action, needs_revision: false, contract_review: null, completion_review: null,
    main_confirmation: null, evidence: [], active_workers: [], dispatched_ids: [], builder_ids: [],
    recovery_ledger: [], authority_ledger: [], issues: [],
    history: [{ type: "init", brief: structuredClone(brief), next_action }] }
}

const validateState = (state) => {
  requireValue(state?.version === 1 && text(state.workspace) && Number.isSafeInteger(state.sequence) && state.sequence >= 0 &&
    ["active", "done"].includes(state.status) && text(state.next_action) && typeof state.needs_revision === "boolean", "INVALID_MISSION_STATE")
  const valid = validateTaskBrief(state.brief)
  requireValue(valid.allowed, valid.reason)
  for (const key of ["evidence", "active_workers", "dispatched_ids", "builder_ids", "recovery_ledger", "authority_ledger", "issues", "history"]) {
    requireValue(Array.isArray(state[key]), "INVALID_MISSION_LEDGER")
  }
  requireValue(state.active_workers.length <= 2 && state.dispatched_ids.every(text) &&
    new Set(state.dispatched_ids).size === state.dispatched_ids.length && state.builder_ids.every(text) &&
    state.active_workers.every((worker) => text(worker?.id) && state.dispatched_ids.includes(worker.id)) &&
    new Set(state.active_workers.map((worker) => worker.id)).size === state.active_workers.length &&
    state.evidence.every((item) => evidenceValid(state.brief, item)) &&
    state.issues.every((item) => text(item?.issue_id) && text(item.evidence_ref)), "INVALID_MISSION_LEDGER")
  if (state.status === "done") requireValue(!state.needs_revision && !openIssues(state) && state.active_workers.length === 0 && acceptance(state).accepted, "UNVERIFIED_MISSION_COMPLETION")
  return state
}

export const applyMissionEvent = (previous, event) => {
  validateState(previous)
  requireValue(previous.status !== "done", "MISSION_ALREADY_COMPLETE")
  requireValue(event && text(event.type) && text(event.next_action), "MISSION_EVENT_REQUIRED")
  const state = structuredClone(previous)
  state.next_action = event.next_action
  const check = (result) => { requireValue(result.allowed, result.reason); return result }
  switch (event.type) {
    case "contract_review":
    case "completion_review": {
      requireValue(state.active_workers.length === 0, "COLLECT_REVIEW_BEFORE_RECORDING")
      const gate = event.type === "contract_review" ? assessContractReview : assessCompletionReview
      const result = gate({ brief: state.brief, review: event.review, builder_ids: state.builder_ids })
      requireValue(result.allowed || ["CONTRACT_GAPS_OR_UNKNOWN", "PRODUCT_GAPS_OR_UNKNOWN"].includes(result.reason), result.reason)
      state[event.type] = event.review
      state.main_confirmation = null
      break
    }
    case "dispatch": {
      requireValue(event.purpose === "contract_review" || !state.needs_revision, "BRIEF_REVISION_REQUIRED")
      check(assessDispatch({ brief: state.brief, contract_review: state.contract_review, builder_ids: state.builder_ids,
        purpose: event.purpose, workers: event.workers, active_workers: state.active_workers,
        dispatched_ids: state.dispatched_ids, integration: event.integration }))
      for (const worker of event.workers) {
        state.active_workers.push({ ...worker, purpose: event.purpose, host_task_id: null })
        state.dispatched_ids.push(worker.id)
        if (event.purpose === "work") state.builder_ids.push(worker.id)
      }
      state.completion_review = null
      state.main_confirmation = null
      break
    }
    case "attach": {
      const worker = state.active_workers.find((item) => item.id === event.worker_id)
      requireValue(worker && text(event.host_task_id) && (!worker.host_task_id || worker.host_task_id === event.host_task_id), "RESERVED_WORKER_REQUIRED")
      requireValue(!state.active_workers.some((item) => item.id !== worker.id && item.host_task_id === event.host_task_id), "DUPLICATE_HOST_TASK")
      worker.host_task_id = event.host_task_id
      if (worker.purpose === "work" && !state.builder_ids.includes(event.host_task_id)) state.builder_ids.push(event.host_task_id)
      break
    }
    case "collect": {
      requireValue(state.active_workers.some((item) => item.id === event.worker_id) && text(event.evidence_ref) &&
        ["completed", "cancelled", "not_started"].includes(event.outcome), "OBSERVED_WORKER_TERMINATION_REQUIRED")
      state.active_workers = state.active_workers.filter((item) => item.id !== event.worker_id)
      break
    }
    case "evidence":
      requireValue(Array.isArray(event.evidence) && event.evidence.every((item) => evidenceValid(state.brief, item)) &&
        new Set(event.evidence.map((item) => item.evidence_ref)).size === event.evidence.length, "FRESH_EVIDENCE_REQUIRED")
      state.evidence = event.evidence
      state.main_confirmation = null
      break
    case "replan": {
      const result = check(assessReplan({ brief: state.brief, diagnosis: event.diagnosis }))
      requireValue(!state.issues.some((item) => item.issue_id === event.diagnosis.issue_id), "DUPLICATE_ISSUE")
      state.issues.push({ ...event.diagnosis, resolution_ref: null })
      state.needs_revision ||= result.revise_objective
      if (result.revise_objective) state.contract_review = null
      state.evidence = state.evidence.filter((item) => !result.invalidate_criteria.includes(item.criterion_id))
      state.completion_review = null
      state.main_confirmation = null
      break
    }
    case "resolve": {
      const issue = state.issues.find((item) => item.issue_id === event.issue_id)
      requireValue(issue && !issue.resolution_ref && text(event.evidence_ref), "ISSUE_RESOLUTION_EVIDENCE_REQUIRED")
      requireValue(!state.needs_revision, "BRIEF_REVISION_REQUIRED")
      issue.resolution_ref = event.evidence_ref
      break
    }
    case "revise": {
      requireValue(state.active_workers.length === 0, "RECONCILE_ACTIVE_WORKERS_FIRST")
      const valid = validateTaskBrief(event.brief)
      requireValue(valid.allowed, valid.reason)
      requireValue(event.brief.task_id === state.brief.task_id && event.brief.objective_revision !== state.brief.objective_revision &&
        event.brief.assurance === state.brief.assurance && text(event.evidence_ref), "NEW_OBJECTIVE_REVISION_REQUIRED")
      if (state.brief.assurance === "reviewed") requireValue(state.brief.sources.every((source, index) =>
        hash(source) === hash(event.brief.sources[index])), "PRESERVE_ACCEPTED_SOURCES")
      state.brief = event.brief
      state.needs_revision = false
      state.contract_review = null
      state.completion_review = null
      state.main_confirmation = null
      state.evidence = []
      break
    }
    case "snapshot":
      requireValue(text(event.snapshot_id) && event.snapshot_id !== state.brief.snapshot_id && text(event.evidence_ref) &&
        state.active_workers.length === 0, "OBSERVED_INTEGRATED_SNAPSHOT_REQUIRED")
      state.brief.snapshot_id = event.snapshot_id
      state.evidence = []
      state.completion_review = null
      state.main_confirmation = null
      break
    case "checkpoint":
      if (event.recovery_record) {
        const result = assessRecovery(event.recovery_record)
        requireValue(!["INVALID_RECOVERY_CONTEXT", "DUPLICATE_OR_INVALID_ATTEMPT"].includes(result.reason), result.reason)
        const record = event.recovery_record
        requireValue(record.task_id === state.brief.task_id && record.objective_revision === state.brief.objective_revision, "FOREIGN_RECOVERY_RECORD")
        const prior = state.recovery_ledger.findLast((item) => item.request.blocker_id === record.blocker_id)
        const verifiedProgress = result.allowed && record.last_progress_sequence > (prior?.request.last_progress_sequence ?? 0)
        const used = prior?.used_recoveries ?? prior?.request.recovery_count ?? 0
        requireValue(!prior || verifiedProgress || record.recovery_count >= used, "RECOVERY_BUDGET_CANNOT_RESET")
        state.recovery_ledger.push({ request: record, result,
          used_recoveries: Math.max(record.recovery_count, result.action === "RECOVER_ONCE" ? 1 : 0) })
      }
      if (event.authority_record) {
        const result = resolveAuthority(event.authority_record)
        requireValue(result.reason !== "INVALID_AUTHORITY_CONTEXT" && event.authority_record.task_id === state.brief.task_id, "INVALID_AUTHORITY_RECORD")
        state.authority_ledger.push({ request: event.authority_record, result })
      }
      break
    case "accept": {
      requireValue(!state.needs_revision && !openIssues(state) && state.active_workers.length === 0, "UNRESOLVED_MISSION_WORK")
      state.main_confirmation = event.main_confirmation
      const result = acceptance(state)
      requireValue(result.accepted, result.reason)
      state.status = "done"
      break
    }
    default: throw new Error("UNKNOWN_MISSION_EVENT")
  }
  state.history.push(structuredClone(event))
  return validateState(state)
}

const directory = (path, create) => {
  if (create) mkdirSync(path, { recursive: true, mode: 0o700 })
  const stat = lstatSync(path)
  requireValue(stat.isDirectory() && !stat.isSymbolicLink(), "UNSAFE_MISSION_DIRECTORY")
  return realpathSync(path)
}
const location = ({ task_id, workspace, stateDir = defaultStateDir() }, create = false) => {
  requireValue(text(task_id) && text(workspace), "MISSION_IDENTITY_REQUIRED")
  const canonicalWorkspace = realpathSync(workspace)
  const root = directory(resolve(stateDir), create)
  const missions = directory(join(root, "missions"), create)
  const path = directory(join(missions, hash([canonicalWorkspace, task_id])), create)
  return { file: join(path, "state.json"), directory: path, workspace: canonicalWorkspace }
}
const readState = (file) => {
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const stat = fstatSync(fd)
    requireValue(stat.isFile() && stat.nlink === 1 && stat.size <= maxBytes, "INVALID_MISSION_FILE")
    const buffer = Buffer.alloc(maxBytes + 1)
    let size = 0
    while (size < buffer.length) {
      const count = readSync(fd, buffer, size, buffer.length - size, null)
      if (!count) break
      size += count
    }
    requireValue(size <= maxBytes, "MISSION_STATE_TOO_LARGE")
    return validateState(JSON.parse(buffer.subarray(0, size).toString("utf8")))
  } finally { closeSync(fd) }
}

export const readMission = (request) => {
  const target = location(request)
  const state = readState(target.file)
  requireValue(state.brief.task_id === request.task_id && state.workspace === target.workspace, "FOREIGN_MISSION_STATE")
  requireValue(text(request.snapshot_id), "OBSERVED_SNAPSHOT_REQUIRED")
  const matches = state.brief.snapshot_id === request.snapshot_id
  return { state, can_resume: matches, action: matches ? "RECONCILE_ACTIVE_TASKS" : "REVALIDATE_SNAPSHOT" }
}

export const writeMission = (request) => {
  requireValue(text(request.event_id) && Number.isSafeInteger(request.expected_sequence) && request.expected_sequence >= -1, "CHECKPOINT_REVISION_REQUIRED")
  requireValue(text(request.snapshot_id), "OBSERVED_SNAPSHOT_REQUIRED")
  const target = location(request, true)
  const lock = `${target.file}.lock`
  // Only main writes. A busy or orphaned lock requires host reconciliation, never guessing.
  let lockFD
  try { lockFD = openSync(lock, "wx", 0o600) } catch (error) {
    if (error.code === "EEXIST") throw new Error("MISSION_BUSY_RECONCILE_LOCK")
    throw error
  }
  const temporary = join(target.directory, `.${randomUUID()}.tmp`)
  try {
    writeFileSync(lockFD, JSON.stringify({ pid: process.pid, event_id: request.event_id }))
    let previous
    try { previous = readState(target.file) } catch (error) { if (error.code !== "ENOENT") throw error }
    const digest = hash({ brief: request.brief, event: request.event, next_action: request.next_action, snapshot_id: request.snapshot_id })
    if (previous?.last_event_id === request.event_id) {
      requireValue(previous.last_event_digest === digest, "EVENT_ID_REUSED_WITH_DIFFERENT_INPUT")
      return previous
    }
    requireValue((previous?.sequence ?? -1) === request.expected_sequence, "STALE_CHECKPOINT_REVISION")
    if (previous) requireValue(previous.workspace === target.workspace && previous.brief.task_id === request.task_id, "FOREIGN_MISSION_STATE")
    else requireValue(request.brief?.task_id === request.task_id, "FOREIGN_MISSION_STATE")
    const reconcilesTasks = ["collect", "attach", "checkpoint"].includes(request.event?.type)
    const newSnapshot = request.event?.type === "snapshot" ? request.event.snapshot_id : request.event?.type === "revise" ? request.event.brief?.snapshot_id : null
    requireValue(reconcilesTasks || request.snapshot_id === (newSnapshot ?? previous?.brief.snapshot_id ?? request.brief?.snapshot_id), "SNAPSHOT_REVALIDATION_REQUIRED")
    const state = previous ? applyMissionEvent(previous, request.event) : createMission({ brief: request.brief, workspace: target.workspace, next_action: request.next_action })
    state.sequence = (previous?.sequence ?? -1) + 1
    state.last_event_id = request.event_id
    state.last_event_digest = digest
    const serialized = `${JSON.stringify(state)}\n`
    requireValue(Buffer.byteLength(serialized) <= maxBytes, "MISSION_STATE_TOO_LARGE")
    const fd = openSync(temporary, "wx", 0o600)
    try { writeFileSync(fd, serialized); fsyncSync(fd) } finally { closeSync(fd) }
    renameSync(temporary, target.file)
    const dirFD = openSync(target.directory, "r")
    try { fsyncSync(dirFD) } finally { closeSync(dirFD) }
    return state
  } finally {
    try { unlinkSync(temporary) } catch (error) { if (error.code !== "ENOENT") throw error }
    closeSync(lockFD)
    unlinkSync(lock)
  }
}

export const recoverMissionLock = (request) => {
  const target = location(request)
  const lock = `${target.file}.lock`
  const fd = openSync(lock, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  let owner
  let stat
  try {
    stat = fstatSync(fd)
    requireValue(stat.isFile() && stat.nlink === 1 && stat.size <= 1024, "INVALID_MISSION_LOCK")
    const buffer = Buffer.alloc(1025)
    const count = readSync(fd, buffer, 0, buffer.length, 0)
    owner = JSON.parse(buffer.subarray(0, count).toString("utf8"))
  } finally { closeSync(fd) }
  requireValue(owner.event_id === request.event_id && Number.isSafeInteger(owner.pid) && owner.pid > 0, "MISSION_LOCK_IDENTITY_REQUIRED")
  try { process.kill(owner.pid, 0); throw new Error("MISSION_WRITER_STILL_ALIVE") } catch (error) {
    if (error.code !== "ESRCH") throw error
  }
  requireValue(lstatSync(lock).ino === stat.ino, "MISSION_LOCK_CHANGED")
  unlinkSync(lock)
  return { recovered: true, event_id: owner.event_id }
}
