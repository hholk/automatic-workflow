import { createHash } from "node:crypto"
import { compareRecipes } from "./evidence.mjs"

const canonical = (value) => JSON.stringify(value && typeof value === "object"
  ? Array.isArray(value) ? value.map((item) => JSON.parse(canonical(item)))
    : Object.fromEntries(Object.keys(value).sort().map((key) => [key, JSON.parse(canonical(value[key]))]))
  : value)
export const learningIdentity = (value) => `sha256:${createHash("sha256").update(canonical(value)).digest("hex")}`
const nonempty = (value) => typeof value === "string" && value.trim().length > 0
const exactKeys = (value, keys, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !keys.includes(key))) {
    throw new Error(`${label} must contain only supported structured fields`)
  }
}
const identifiers = (values, label) => {
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => !nonempty(value)) || new Set(values).size !== values.length) {
    throw new Error(`${label} must contain unique nonempty identifiers`)
  }
}

// Only the prompt-free local event store is accepted. The split manifest names
// its exact records; it cannot supply its own quality verdicts or run content.
export const evaluateLearningCandidate = ({ baseline, candidate, runs, manifest, proposer, minimumPairs = 5 }) => {
  if (!nonempty(proposer)) throw new Error("an independent-review proposer identity is required")
  if (!nonempty(baseline.version) || !nonempty(candidate.version) || baseline.version === candidate.version) throw new Error("baseline and candidate versions must be distinct")
  exactKeys(manifest, ["schema_version", "id", "discovery", "holdout"], "evidence manifest")
  if (manifest.schema_version !== 1 || !nonempty(manifest.id)) throw new Error("evidence manifest schema_version 1 and id are required")
  const usedRuns = new Set()
  const tasks = new Set()
  const identities = { baseline: learningIdentity(baseline), candidate: learningIdentity(candidate) }
  const results = {}
  for (const split of ["discovery", "holdout"]) {
    const spec = manifest[split]
    exactKeys(spec, ["baseline_run_ids", "candidate_run_ids"], split)
    const selected = []
    const splitTasks = new Set()
    for (const side of ["baseline", "candidate"]) {
      const ids = spec[`${side}_run_ids`]
      identifiers(ids, `${split}.${side}_run_ids`)
      const sideTasks = new Set()
      for (const id of ids) {
        if (usedRuns.has(id)) throw new Error(`evidence run reused: ${id}`)
        const matches = runs.filter((run) => run.run_id === id)
        if (matches.length !== 1) throw new Error(`evidence run missing or ambiguous: ${id}`)
        const run = matches[0]
        if (run.playbook_version !== (side === "baseline" ? baseline.version : candidate.version)) throw new Error(`wrong evidence version: ${id}`)
        const taskCell = `${run.cell_id.replace(/\|profile:[^|]+$/, "")}|task:${run.task.id}`
        if (sideTasks.has(taskCell)) throw new Error(`duplicate paired task in ${split}: ${run.task.id}`)
        if (split === "holdout" && tasks.has(run.task.id)) throw new Error(`holdout task overlaps discovery: ${run.task.id}`)
        usedRuns.add(id)
        sideTasks.add(taskCell)
        splitTasks.add(run.task.id)
        selected.push(run)
      }
    }
    // Unpaired records must not disappear from an otherwise eligible analysis.
    const taskPairs = new Map()
    for (const run of selected) {
      const key = `${run.cell_id.replace(/\|profile:[^|]+$/, "")}|task:${run.task.id}`
      taskPairs.set(key, (taskPairs.get(key) || 0) + 1)
    }
    if ([...taskPairs.values()].some((count) => count !== 2)) throw new Error(`${split} evidence must contain only matched pairs`)
    const analysis = compareRecipes(selected, baseline.version, candidate.version, minimumPairs)
    if (analysis.verdict !== "eligible-to-promote") throw new Error(`${split} recomputed analysis verdict is ${analysis.verdict}`)
    results[split] = analysis
    identities[split] = learningIdentity({ spec, runs: selected, analysis })
    for (const id of splitTasks) tasks.add(id)
  }
  identities.manifest = learningIdentity(manifest)
  const packet = { schema_version: 1, proposer, identities, results }
  return { ...packet, review_id: learningIdentity(packet) }
}

export const requireLearningReview = (packet, review) => {
  exactKeys(review, ["schema_version", "decision", "review_id", "identities", "approved_by", "approved_at"], "review approval")
  if (review.schema_version !== 1 || review.decision !== "approve" || !nonempty(review.approved_by)
    || review.approved_by === packet.proposer || !Number.isFinite(Date.parse(review.approved_at))) {
    throw new Error("separate reviewer approval with a dated independent reviewer identity is required")
  }
  if (review.review_id !== packet.review_id || canonical(review.identities) !== canonical(packet.identities)) {
    throw new Error("review approval does not match exact baseline, candidate, discovery and holdout identities")
  }
}

// Only an in-process host capability can authenticate external review and
// holdout provenance. JSON metadata is never an authorization capability.
export const authorizeLearningPromotion = (packet, review, host) => {
  requireLearningReview(packet, review)
  const denied = () => { throw new Error("REVIEW_REQUIRED: a trusted aw-reviewed-promotion-v1 host verifier must approve this exact packet") }
  if (host?.capability !== "aw-reviewed-promotion-v1" || typeof host.verifyPromotion !== "function") denied()
  const freeze = (value) => {
    if (value && typeof value === "object") {
      for (const child of Object.values(value)) freeze(child)
      Object.freeze(value)
    }
    return value
  }
  const exact = freeze(JSON.parse(canonical({ packet, review })))
  let verified
  try { verified = host.verifyPromotion(exact.packet, exact.review) } catch { denied() }
  if (verified !== true) denied()
  return Object.freeze({ authorized: true, review_id: packet.review_id, capability: host.capability })
}

// Deliberately accepts authored structured lessons, never sessions or traces.
export const selectReviewedLessons = (entries, context, now = new Date()) => {
  if (!Array.isArray(entries)) throw new Error("lessons must be a structured array")
  if (![context.project_id, context.project_version, context.policy_version].every(nonempty)) throw new Error("lesson selection requires explicit project, project version and policy version")
  if (!Number.isFinite(now.getTime())) throw new Error("invalid lesson selection time")
  const seen = new Set()
  return entries.filter((entry) => {
    exactKeys(entry, ["id", "project_id", "project_versions", "policy_versions", "prerequisites", "instruction", "author", "review", "expires_at"], "lesson")
    if (![entry.id, entry.project_id, entry.instruction, entry.author].every(nonempty) || seen.has(entry.id)) throw new Error("lesson needs unique id, project, sanitized instruction and author")
    seen.add(entry.id)
    identifiers(entry.project_versions, "lesson.project_versions")
    identifiers(entry.policy_versions, "lesson.policy_versions")
    exactKeys(entry.review, ["decision", "reviewed_by", "reviewed_at"], "lesson review")
    if (entry.review.decision !== "approve" || !nonempty(entry.review.reviewed_by) || entry.review.reviewed_by === entry.author
      || !Number.isFinite(Date.parse(entry.review.reviewed_at)) || !Number.isFinite(Date.parse(entry.expires_at))
      || Date.parse(entry.expires_at) <= Date.parse(entry.review.reviewed_at) || Date.parse(entry.review.reviewed_at) > now.getTime()) throw new Error("lesson requires independent dated review and a later expiry")
    if (!entry.prerequisites || typeof entry.prerequisites !== "object" || Array.isArray(entry.prerequisites) || Object.keys(entry.prerequisites).length === 0 || Object.entries(entry.prerequisites).some(([key, value]) => !nonempty(key) || !["string", "number", "boolean"].includes(typeof value))) throw new Error("lesson prerequisites must contain explicit scalar facts")
    if (/(?:sk-[a-zA-Z0-9_-]{16,}|-----BEGIN .*PRIVATE KEY-----|(?:password|api[_-]?key|access[_-]?token)["']?\s*[:=])/i.test(canonical(entry))) throw new Error("lesson contains potential secret material")
    return entry.project_id === context.project_id && entry.project_versions.includes(context.project_version)
      && entry.policy_versions.includes(context.policy_version) && Date.parse(entry.expires_at) > now.getTime()
      && Object.entries(entry.prerequisites).every(([key, value]) => context.prerequisites?.[key] === value)
  }).map((entry) => ({ id: entry.id, instruction: entry.instruction, expires_at: entry.expires_at }))
}
