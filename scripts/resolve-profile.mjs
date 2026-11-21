#!/usr/bin/env node
import { closeSync, constants, existsSync, fstatSync, openSync, readFileSync, readSync, realpathSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { effectivePolicy, hostCapabilities, validateActorProvenance } from "./effective-policy.mjs"
import { assessTeacherInspection } from "./teacher-state.mjs"
import { selectReviewedLessons } from "./learning-policy.mjs"
import { writeSelectionReceipt } from "./selection-receipt.mjs"
import { normalizeTaskClass, resolveTaskIdentity } from "./run-identity.mjs"
import { readRunContext } from "./run-context.mjs"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"))
const defaultRegistry = readJson(join(root, "prompts/profiles.json"))
const defaultPlaybook = readJson(join(root, "playbooks/current.json"))
const own = (object, key) => object && Object.hasOwn(object, key) ? object[key] : undefined
const workerRoutes = new Set(["explore", "diagnose", "fix", "implement", "review", "computer-use"])

const skillDirectory = dirname(root)
const potetoStyleReference = () => {
  const core = join(skillDirectory, "poteto-mode/poteto-core.md")
  if (existsSync(core)) return { path: core, mode: "core", exists: true }
  const full = join(skillDirectory, "poteto-mode/SKILL.md")
  const exists = existsSync(full)
  return { path: full, mode: exists ? "full" : "missing", exists }
}

const skillRecommendations = [
  [["diagnose", "diagnosis"], "diagnosing-bugs", "engineering/diagnosing-bugs", "Trace a symptom to its cause before changing code."],
  [["review"], "h-code-review", "engineering/h-code-review", "Check the change against repository standards and the request."],
  [["ui"], "design-taste-frontend", "taste-skill", "Check the design in the browser."],
  [["typescript"], "typescript-best-practices", "typescript-best-practices", "Apply TypeScript conventions to the affected code."],
  [["fix", "bugfix", "tdd"], "tdd", "tdd", "Use a focused failing behavior check when one is available."],
  [["release", "pr"], "pr", "engineering/pr", "Summarize externally visible changes and verification for reviewers."],
  [["research", "explore"], "research", "engineering/research", "Verify findings against primary sources."],
  [["architecture", "refactor", "blast-radius"], "blast-radius", "blast-radius", "Verify affected callers and boundaries."],
  [["repeat-error"], "correct", "correct", "Find a way to prevent the recurring mistake."],
  [["retry"], "principle-make-operations-idempotent", "principle-make-operations-idempotent", "Check that retries converge after partial work."],
  [["repeat-hypothesis"], "principle-attack-the-premise", "principle-attack-the-premise", "Test the shared premise before retrying a failed hypothesis."],
]

const recommendedSkills = ({ route, signals }, taskClass) => {
  const tags = new Set([route, taskClass, ...(Array.isArray(signals) ? signals : [])])
  return skillRecommendations.filter(([triggers]) => triggers.some((tag) => tags.has(tag)))
    .map(([, name, directory, reason]) => {
      const path = join(skillDirectory, directory, "SKILL.md")
      return { name, path, exists: existsSync(path), reason }
    })
}

const assertComponents = (components) => {
  for (const component of components) {
    if (!existsSync(join(root, component))) throw new Error(`component not found: ${component}`)
  }
}

const resolvePromptProfile = (input, registry, playbook, nativeProfile) => {
  const id = input.promptProfileID || playbook.defaults?.prompt_profile_id
  const profile = own(registry.prompt_profiles, id)
  if (!profile) throw new Error(`unknown prompt profile: ${id}`)
  const overlay = own(profile.overlays, nativeProfile.id) || null
  if (id !== "model-bound-v1" && !overlay) {
    throw new Error(`prompt profile ${id} is not applicable to ${nativeProfile.id}`)
  }
  return { id, overlay }
}

export const resolveSelection = (input, overrides = {}) => {
  const registry = overrides.registry || defaultRegistry
  const playbook = overrides.playbook || defaultPlaybook
  if (registry.schema_version !== 1) throw new Error("profile registry schema_version 1 is required")
  if (input.actors !== undefined) validateActorProvenance(input.actors)
  const capabilities = hostCapabilities(input.host, input.providerHost)
  const profileHost = capabilities.profile_host
  const taskIdentity = resolveTaskIdentity(input)
  const taskClass = input.taskClass ?? input.task?.class
  const canonicalTaskClass = normalizeTaskClass(taskClass)
  const skillReferences = {
    canonical_task_class: canonicalTaskClass,
    recommended_hstack_skills: recommendedSkills(input, canonicalTaskClass),
    poteto_style_reference: potetoStyleReference(),
  }
  const modelCapability = (model) => ({ status: "unverified", model, provider_host: profileHost, reason: "CONFIGURATION_ONLY" })
  if (!new Set(["worker", "teacher"]).has(input.role)) throw new Error(`unknown role: ${input.role}`)

  if (input.role === "teacher") {
    if (input.route !== "teacher") throw new Error(`unknown route for teacher: ${input.route}`)
    const binding = own(registry.teacher_bindings, profileHost)
    if (!binding) throw new Error(`unsupported teacher host: ${input.host}`)
    if (input.model && ![registry.teacher_default, binding.model].includes(input.model)) {
      throw new Error(`unsupported teacher model: ${input.model}`)
    }
    const model = registry.teacher_default
    const profile = Object.values(registry.teacher_profiles || {}).find((item) => item.id === binding.profile_id)
    if (!profile || own(registry.teacher_profiles, model)?.id !== profile.id) throw new Error(`inconsistent teacher binding: ${profileHost}`)
    const policy = effectivePolicy(input, { playbook })
    const promptProfile = resolvePromptProfile({ ...input, promptProfileID: policy.prompt_profile_id }, registry, playbook, profile)
    const components = [profile.core, profile.contract, profile.model_delta, promptProfile.overlay,
      input.inspectionRequest ? "references/teacher-inspection.md" : null].filter(Boolean)
    const assessment = input.inspectionRequest ? assessTeacherInspection(input.inspectionRequest) : null
    assertComponents(components)
    return {
      host: input.host,
      frontend_host: capabilities.frontend_host,
      provider_host: profileHost,
      role: input.role,
      route: input.route,
      ...binding,
      ...skillReferences,
      model_capability: modelCapability(binding.model),
      profile_id: profile.id,
      prompt_profile_id: promptProfile.id,
      recipe_id: null,
      effective_policy: policy,
      components,
      teacher: {
        max_asks: playbook.frozen.teacher_max_asks,
        max_turns_per_ask: playbook.frozen.teacher_max_turns_per_ask,
        ...(assessment ? { inspection: {
          status: assessment.eligible ? "UNSUPPORTED_HOST" : "INELIGIBLE",
          reason: assessment.eligible ? "UNSUPPORTED_HOST" : assessment.reason,
          fallback: "WORKER_EVIDENCE",
          capability: "teacher-text-snapshot-v1",
        } } : {}),
      },
    }
  }

  if (!workerRoutes.has(input.route)) throw new Error(`unknown route: ${input.route}`)
  const routeModel = own(own(registry.worker_route_models, input.route), profileHost)
  if (routeModel && input.model && input.model !== routeModel) {
    throw new Error(`route ${input.route} requires worker model: ${routeModel}`)
  }
  const model = routeModel || input.model || own(registry.worker_defaults, profileHost)
  if (input.primaryFailure !== undefined) throw new Error("fallback blocked: no fallback policy for host")
  if (!model) throw new Error(`missing default worker model: ${input.host}`)
  const profile = own(registry.worker_profiles, `${profileHost}|${model}`)
  if (!profile) throw new Error(`unknown worker profile: ${input.host}|${model}`)
  if (!profile.binding?.model_provider || !profile.binding.write_agent || !profile.binding.read_agent) throw new Error("incomplete worker binding")
  if (profile.retired) throw new Error(`retired worker profile: ${input.host}|${model}`)
  if (profile.unsupported_reason) throw new Error(`BLOCKED_ENVIRONMENT: unsupported worker profile: ${input.host}|${model}: ${profile.unsupported_reason}`)
  if (input.actors && (!input.actors.worker.used || input.actors.worker.resolved_model !== model)) {
    throw new Error("observed worker model must match the selected worker model")
  }
  const policy = effectivePolicy(input, { playbook })
  if (input.lessons !== undefined && (!input.prerequisites || typeof input.prerequisites !== "object" || Array.isArray(input.prerequisites) ||
      Object.values(input.prerequisites).some((value) => !["string", "number", "boolean"].includes(typeof value)))) {
    throw new Error("reviewed lessons require explicit scalar prerequisite facts")
  }
  const lessons = input.lessons === undefined ? [] : selectReviewedLessons(input.lessons, {
    project_id: input.projectID,
    project_version: input.projectVersion,
    policy_version: policy.playbook_version,
    prerequisites: input.prerequisites,
  })
  const promptProfile = resolvePromptProfile({ ...input, promptProfileID: policy.prompt_profile_id }, registry, playbook, profile)
  const recipeID = policy.recipe_id
  const components = [...new Set([
    profile.core,
    profile.contract,
    profile.model_delta,
    promptProfile.overlay,
    `workflows/${input.route}.md`,
    `playbooks/recipes/${recipeID}.md`,
  ].filter(Boolean))]
  assertComponents(components)
  return {
    host: input.host,
    frontend_host: capabilities.frontend_host,
    provider_host: profileHost,
    role: input.role,
    route: input.route,
    task_class: taskClass || null,
    ...skillReferences,
    complexity: input.complexity || null,
    task_identity: taskIdentity,
    model,
    model_capability: modelCapability(model),
    model_provider: profile.binding.model_provider,
    ...(profile.binding.reasoning_effort ? { reasoning_effort: profile.binding.reasoning_effort } : {}),
    native_agent: profile.binding[["fix", "implement", "computer-use"].includes(input.route) ? "write_agent" : "read_agent"],
    effective_policy: policy,
    budget: {
      context_tokens: policy.context_budget,
      worker_steps: policy.worker_step_budget,
      failed_hypotheses: policy.teacher_after_failed_hypotheses,
    },
    profile_id: profile.id,
    prompt_profile_id: promptProfile.id,
    recipe_id: recipeID,
    components,
    teacher: null,
    lessons,
  }
}

const arg = (name) => {
  const index = process.argv.indexOf(name)
  if (index < 0) return undefined
  if (process.argv.lastIndexOf(name) !== index) throw new Error(`${name} may be supplied only once`)
  const value = process.argv[index + 1]
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`)
  return value
}

// Read bounded regular JSON files supplied by the caller or the opt-in project lesson path.
const readBoundedJson = (path, maxBytes) => {
  const fd = openSync(resolve(path), constants.O_RDONLY | constants.O_NONBLOCK)
  try {
    if (!fstatSync(fd).isFile()) throw new Error("JSON input must be a regular file")
    const buffer = Buffer.alloc(maxBytes + 1)
    let size = 0
    while (size < buffer.length) {
      const count = readSync(fd, buffer, size, buffer.length - size, null)
      if (count === 0) break
      size += count
    }
    if (size > maxBytes) throw new Error(`JSON input exceeds ${maxBytes} bytes`)
    return JSON.parse(buffer.subarray(0, size).toString("utf8"))
  } finally { closeSync(fd) }
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const actorsPath = arg("--actors")
    const legacyLessonsPath = arg("--lessons")
    const explicitLessonsPath = arg("--project-lessons")
    const legacyProject = arg("--project")
    const projectID = arg("--project-id")
    const projectVersion = arg("--project-version")
    const prerequisitesPath = arg("--prerequisites")
    const workspace = arg("--workspace")
    const role = arg("--role")
    const playbookPath = arg("--playbook")
    if (legacyLessonsPath && explicitLessonsPath) throw new Error("provide only one of --project-lessons and --lessons")
    if (projectID && legacyProject) throw new Error("provide only one of --project-id and --project")
    const explicitPath = explicitLessonsPath ?? legacyLessonsPath
    if (explicitPath && (!(projectID ?? legacyProject) || !projectVersion || !prerequisitesPath)) {
      throw new Error(`${explicitLessonsPath ? "--project-lessons" : "--lessons"} requires --project-id (or --project), --project-version and --prerequisites`)
    }
    const projectLessonsPath = role === "worker" && workspace && projectID && projectVersion && prerequisitesPath
      ? resolve(workspace, ".aw/lessons.json") : undefined
    const lessonsPath = explicitPath ?? (projectLessonsPath && existsSync(projectLessonsPath) ? projectLessonsPath : undefined)
    const value = resolveSelection({
      actors: actorsPath ? readBoundedJson(actorsPath, 16384) : undefined,
      lessons: lessonsPath ? readBoundedJson(lessonsPath, 262144) : undefined,
      projectID: projectID ?? legacyProject,
      projectVersion,
      prerequisites: prerequisitesPath ? readBoundedJson(prerequisitesPath, 16384) : undefined,
      host: arg("--host"),
      providerHost: arg("--provider-host"),
      role,
      model: arg("--model"),
      route: arg("--route"),
      taskClass: arg("--task-class"),
      signals: arg("--signals")?.split(",").map((signal) => signal.trim()),
      complexity: arg("--complexity"),
      taskID: arg("--task-id"),
      snapshotID: arg("--snapshot-id"),
      checkVersion: arg("--check-version"),
      promptProfileID: arg("--prompt-profile-id"),
      explicitModelRequest: process.argv.includes("--explicit-model-request"),
      primaryFailure: arg("--primary-failure"),
    }, playbookPath ? { playbook: readBoundedJson(playbookPath, 1048576) } : {})
    const explicitRunID = arg("--run-id")
    const contextToken = arg("--run-context") || process.env.AW_RUN_CONTEXT
    const context = contextToken ? readRunContext({ token: contextToken,
      profileHost: value.provider_host, playbookVersion: value.effective_policy.playbook_version }) : null
    if (context && [explicitRunID, process.env.AW_RUN_ID].some((id) => id && id !== context.run_id)) {
      throw new Error("CONFLICTING_RUN_CONTEXT")
    }
    const runID = context?.run_id || explicitRunID || process.env.AW_RUN_ID
    if (value.role === "worker" && runID) {
      if (!value.task_class || !value.complexity) {
        value.selection_receipt = { status: "UNRECORDED", reason: "MISSING_TASK_IDENTITY" }
      } else {
        writeSelectionReceipt({ runID, selection: value })
        value.selection_receipt = { status: "RECORDED", source: context ? "run-context" : "supplied-run-id" }
      }
    }
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
  } catch (error) {
    process.stderr.write(`resolve-profile.mjs: ${error.message}\n`)
    process.exitCode = 1
  }
}
