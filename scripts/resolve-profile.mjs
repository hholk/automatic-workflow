#!/usr/bin/env node
import { closeSync, constants, existsSync, fstatSync, openSync, readFileSync, readSync, realpathSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { effectivePolicy, hostCapabilities, validateActorProvenance } from "./effective-policy.mjs"
import { assessTeacherInspection } from "./teacher-state.mjs"
import { selectReviewedLessons } from "./learning-policy.mjs"
import { writeSelectionReceipt } from "./selection-receipt.mjs"
import { resolveTaskIdentity } from "./run-identity.mjs"
import { readRunContext } from "./run-context.mjs"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"))
const defaultRegistry = readJson(join(root, "prompts/profiles.json"))
const defaultPlaybook = readJson(join(root, "playbooks/current.json"))
const workerRoutes = new Set(["explore", "diagnose", "fix", "implement", "review", "computer-use"])

const assertComponents = (components) => {
  for (const component of components) {
    if (!existsSync(join(root, component))) throw new Error(`component not found: ${component}`)
  }
}

const resolvePromptProfile = (input, registry, playbook, nativeProfile) => {
  const id = input.promptProfileID || playbook.defaults?.prompt_profile_id
  const profile = registry.prompt_profiles?.[id]
  if (!profile) throw new Error(`unknown prompt profile: ${id}`)
  const overlay = profile.overlays?.[nativeProfile.id] || null
  if (id !== "model-bound-v1" && !overlay) {
    throw new Error(`prompt profile ${id} is not applicable to ${nativeProfile.id}`)
  }
  return { id, overlay }
}

export const resolveSelection = (input, overrides = {}) => {
  const registry = overrides.registry || defaultRegistry
  const playbook = overrides.playbook || defaultPlaybook
  if (![4, 5].includes(playbook.schema_version)) throw new Error("playbook schema_version 4 or 5 is required")
  if (registry.schema_version !== 1) throw new Error("profile registry schema_version 1 is required")
  if (input.actors !== undefined) validateActorProvenance(input.actors)
  const capabilities = hostCapabilities(input.host, input.providerHost)
  const profileHost = capabilities.profile_host
  const taskIdentity = resolveTaskIdentity(input)
  const modelCapability = (model) => ({ status: "unverified", model, provider_host: profileHost, reason: "CONFIGURATION_ONLY" })
  if (!new Set(["worker", "teacher"]).has(input.role)) throw new Error(`unknown role: ${input.role}`)

  if (input.role === "teacher") {
    if (input.route !== "teacher") throw new Error(`unknown route for teacher: ${input.route}`)
    const binding = registry.teacher_bindings?.[profileHost]
    if (!binding) throw new Error(`unsupported teacher host: ${input.host}`)
    if (input.model && ![registry.teacher_default, binding.model].includes(input.model)) {
      throw new Error(`unsupported teacher model: ${input.model}`)
    }
    const model = registry.teacher_default
    const profile = Object.values(registry.teacher_profiles || {}).find((item) => item.id === binding.profile_id)
    if (!profile || registry.teacher_profiles[model]?.id !== profile.id) throw new Error(`inconsistent teacher binding: ${profileHost}`)
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
  const routeModel = registry.worker_route_models?.[input.route]?.[profileHost]
  if (routeModel && input.model && input.model !== routeModel) {
    throw new Error(`route ${input.route} requires worker model: ${routeModel}`)
  }
  const primaryModel = routeModel || input.model || registry.worker_defaults?.[profileHost]
  const fallbackPolicy = registry.worker_fallbacks?.[profileHost]
  let fallback = null
  if (input.primaryFailure !== undefined) {
    const reason = fallbackPolicy?.confirmed_primary_failures?.[input.primaryFailure]
    if (!reason) throw new Error(`fallback blocked: unconfirmed primary failure: ${input.primaryFailure}`)
    if (input.host !== "codex" || profileHost !== "codex") throw new Error("fallback blocked: native Codex host required")
    if (input.route === "computer-use") throw new Error("fallback blocked: computer-use capability is unverified")
    if (input.explicitModelRequest) throw new Error("fallback blocked: explicit model request")
    if (primaryModel !== fallbackPolicy.primary_model) throw new Error("fallback blocked: configured primary mismatch")
    fallback = { requested_model: primaryModel, resolved_model: fallbackPolicy.fallback_model, reason }
  }
  const model = fallback?.resolved_model || primaryModel
  if (!fallback && model === fallbackPolicy?.fallback_model) {
    throw new Error("fallback blocked: Luna requires a confirmed primary failure")
  }
  if (!model) throw new Error(`missing default worker model: ${input.host}`)
  const profile = registry.worker_profiles[`${profileHost}|${model}`]
  if (!profile) throw new Error(`unknown worker profile: ${input.host}|${model}`)
  if (profile.retired) throw new Error(`retired worker profile: ${input.host}|${model}`)
  if (profile.unsupported_reason) throw new Error(`BLOCKED_ENVIRONMENT: unsupported worker profile: ${input.host}|${model}: ${profile.unsupported_reason}`)
  if (input.actors && (!input.actors.worker.used || input.actors.worker.resolved_model !== model)) {
    throw new Error("observed worker model must match the selected worker model")
  }
  if (fallback && input.actors && (input.actors.worker.requested_model !== fallback.requested_model ||
      input.actors.worker.fallback_reason !== fallback.reason)) {
    throw new Error("observed fallback provenance must match the confirmed primary failure")
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
    task_class: input.taskClass || null,
    complexity: input.complexity || null,
    task_identity: taskIdentity,
    model,
    model_capability: modelCapability(model),
    ...(fallback ? {} : { model_provider: profileHost === "codex" ? "codex-router" : (model.includes("/") ? model.split("/")[0] : "venice") }),
    ...(fallback ? { requested_model: fallback.requested_model, fallback_reason: fallback.reason } : {}),
    native_agent: profileHost === "github-copilot"
        ? "aw-worker"
        : (["fix", "implement", "computer-use"].includes(input.route) ? "aw-worker" : "aw-reviewer"),
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

// Read only explicitly named bounded regular JSON files. Never discover state,
// scan sessions or read transcripts to reconstruct actors or lesson evidence.
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
    const lessonsPath = arg("--lessons")
    const prerequisitesPath = arg("--prerequisites")
    const playbookPath = arg("--playbook")
    if (lessonsPath && (!arg("--project") || !arg("--project-version") || !prerequisitesPath)) {
      throw new Error("--lessons requires --project, --project-version and --prerequisites")
    }
    const value = resolveSelection({
      actors: actorsPath ? readBoundedJson(actorsPath, 16384) : undefined,
      lessons: lessonsPath ? readBoundedJson(lessonsPath, 262144) : undefined,
      projectID: arg("--project"),
      projectVersion: arg("--project-version"),
      prerequisites: prerequisitesPath ? readBoundedJson(prerequisitesPath, 16384) : undefined,
      host: arg("--host"),
      providerHost: arg("--provider-host"),
      role: arg("--role"),
      model: arg("--model"),
      route: arg("--route"),
      taskClass: arg("--task-class"),
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
