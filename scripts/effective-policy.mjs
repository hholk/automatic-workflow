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
