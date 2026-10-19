import { readFileSync } from "node:fs"
import { buildCellID } from "./evidence.mjs"

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"))
const defaultPlaybook = read("../playbooks/current.json")
const nativeHosts = new Set(["codex", "opencode", "github-copilot"])
const mutableFields = new Set(["recipe_id", "prompt_profile_id", "context_budget", "worker_step_budget"])

// A declaration of supported dispatch, never runtime discovery or a tool grant.
export const hostCapabilities = (host, providerHost) => {
  if (host === "t3") {
    if (!["codex", "opencode"].includes(providerHost)) throw new Error("t3 requires providerHost codex or opencode")
  } else if (!nativeHosts.has(host)) throw new Error(`unknown host: ${host}`)
  const profileHost = host === "t3" ? providerHost : host
  return Object.freeze({
    profile_host: profileHost,
    dispatch: host === "t3" ? "provider-delegate" : "native-agent",
    worker: true,
    teacher: profileHost !== "github-copilot",
    model_provenance_required: true,
    teacher_text_snapshot: false,
  })
}

const assertFields = (policy, playbook) => {
  for (const field of ["context_budget", "worker_step_budget", "teacher_after_failed_hypotheses"]) {
    if (!Number.isSafeInteger(policy[field]) || policy[field] <= 0) throw new Error(`${field} must be a positive integer`)
  }
  for (const field of ["recipe_id", "prompt_profile_id"]) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(policy[field] || "")) throw new Error(`${field} must be a lowercase immutable ID`)
  }
  if ((playbook.schema_version === 5 || /-v5$/.test(playbook.version || "")) && policy.teacher_after_failed_hypotheses !== 2) {
    throw new Error("v5 teacher handback threshold is fixed at two attempts")
  }
}

// Validation has no host selection or dispatch effect. Promotion validates all
// cells without pretending that their actor provenance has been observed.
export const validatePolicy = (playbook) => {
  if (![4, 5].includes(playbook.schema_version)) throw new Error("playbook schema_version 4 or 5 is required")
  assertFields(playbook.defaults || {}, playbook)
  if (!playbook.cells || typeof playbook.cells !== "object" || Array.isArray(playbook.cells)) throw new Error("policy cells must be an object")
  for (const cell of Object.values(playbook.cells)) {
    if (!cell || typeof cell !== "object" || Array.isArray(cell)) throw new Error("policy cell must be an object")
    for (const field of Object.keys(cell)) {
      if (!mutableFields.has(field)) throw new Error(`unsupported policy cell field: ${field}`)
    }
    assertFields({ ...playbook.defaults, ...cell }, playbook)
  }
  return true
}

export const effectivePolicy = (input, { playbook = defaultPlaybook } = {}) => {
  validatePolicy(playbook)
  const capabilities = hostCapabilities(input.host, input.providerHost)
  const taskClass = input.taskClass ?? input.task?.class
  const complexity = input.complexity ?? input.task?.complexity
  // Only supplied execution provenance can activate a full model/fallback cell.
  const cellID = input.actors && input.route && taskClass && complexity ? buildCellID({
    host: input.host,
    actors: input.actors,
    route: input.route,
    task: { class: taskClass, complexity },
    promptProfileID: input.promptProfileID || playbook.defaults?.prompt_profile_id,
  }) : null
  const taskCell = taskClass && complexity ? [input.host, taskClass, complexity].join("|") : null
  const matched = cellID && Object.hasOwn(playbook.cells, cellID) ? cellID
    : taskCell && Object.hasOwn(playbook.cells, taskCell) ? taskCell : null
  const policy = { ...playbook.defaults, ...(matched ? playbook.cells[matched] : {}) }
  if (input.promptProfileID) policy.prompt_profile_id = input.promptProfileID
  assertFields(policy, playbook)
  return { ...policy, playbook_version: playbook.version, cell_id: cellID || taskCell, policy_cell_id: matched, capabilities }
}

// Resolver input is explicit caller-supplied metadata, not host authentication.
// Never turn configured model intent into claimed execution provenance.
export const validateActorProvenance = (actors) => {
  const roles = ["main", "worker", "teacher"]
  if (!actors || typeof actors !== "object" || Array.isArray(actors) ||
      Object.keys(actors).some((key) => !roles.includes(key))) throw new Error("actors must contain only main, worker and teacher metadata")
  const fields = new Set(["used", "requested_model", "resolved_model", "fallback_reason", "model_source", "tokens", "token_source"])
  const modelID = (value) => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_./:-]{0,199}$/.test(value)
  const explicitFallback = (value) => typeof value === "string" &&
    /^(?:primary-(?:http-[1-5]\d\d|[a-z0-9]+-[a-z0-9-]+)|provider-[a-z0-9][a-z0-9_-]{2,47}|runtime-[a-z0-9]+-[a-z0-9-]+)$/.test(value) &&
    !["provider-error", "runtime-resolved-different-from-primary"].includes(value)
  for (const role of roles) {
    const actor = actors[role]
    if (!actor || typeof actor !== "object" || Array.isArray(actor) || typeof actor.used !== "boolean" ||
        Object.keys(actor).some((key) => !fields.has(key))) throw new Error(`actors.${role} must contain only supported actor metadata`)
    if (actor.used) {
      if (!["native", "provider"].includes(actor.model_source) || !modelID(actor.resolved_model) || !modelID(actor.requested_model)) {
        throw new Error(`actors.${role} requires requested and resolved models with native or provider model_source`)
      }
      const substituted = actor.requested_model !== actor.resolved_model
      if (substituted ? !explicitFallback(actor.fallback_reason) : Boolean(actor.fallback_reason)) {
        throw new Error(`actors.${role} requires explicit fallback provenance only for differing models`)
      }
    } else if ((actor.requested_model != null && !modelID(actor.requested_model)) || actor.resolved_model || actor.fallback_reason || actor.tokens != null ||
        (actor.token_source != null && actor.token_source !== "unknown") ||
        (actor.model_source != null && actor.model_source !== "unknown")) {
      throw new Error(`actors.${role} cannot claim execution metadata when unused`)
    }
    if (actor.tokens != null && (!Number.isFinite(actor.tokens) || actor.tokens < 0 || !["native", "provider"].includes(actor.token_source))) {
      throw new Error(`actors.${role} tokens require observed native or provider usage`)
    }
    if (actor.token_source != null && !["native", "provider", "unknown"].includes(actor.token_source)) {
      throw new Error(`actors.${role} has invalid token_source`)
    }
  }
  return actors
}
