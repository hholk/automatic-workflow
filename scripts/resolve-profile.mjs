#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { effectivePolicy, hostCapabilities } from "./effective-policy.mjs"
import { assessTeacherInspection } from "./teacher-state.mjs"

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
  const capabilities = hostCapabilities(input.host, input.providerHost)
  const profileHost = capabilities.profile_host
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
      role: input.role,
      route: input.route,
      ...binding,
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
  const model = routeModel || input.model || registry.worker_defaults?.[profileHost]
  if (!model) throw new Error(`missing default worker model: ${input.host}`)
  const profile = registry.worker_profiles[`${profileHost}|${model}`]
  if (!profile) throw new Error(`unknown worker profile: ${input.host}|${model}`)
  if (profile.retired) throw new Error(`retired worker profile: ${input.host}|${model}`)
  const policy = effectivePolicy(input, { playbook })
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
    role: input.role,
    route: input.route,
    task_class: input.taskClass || null,
    complexity: input.complexity || null,
    model,
    model_provider: profileHost === "codex" ? "codex-router" : (model.includes("/") ? model.split("/")[0] : "venice"),
    native_agent: profileHost === "opencode" && input.model === "venice/z-ai-glm-5-3-flash"
      ? (["fix", "implement"].includes(input.route) ? "aw-glm53-worker" : "aw-glm53-review")
      : profileHost === "github-copilot"
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
  }
}

const arg = (name) => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const value = resolveSelection({
      host: arg("--host"),
      providerHost: arg("--provider-host"),
      role: arg("--role"),
      model: arg("--model"),
      route: arg("--route"),
      taskClass: arg("--task-class"),
      complexity: arg("--complexity"),
      promptProfileID: arg("--prompt-profile-id"),
      explicitModelRequest: process.argv.includes("--explicit-model-request"),
    })
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
  } catch (error) {
    process.stderr.write(`resolve-profile.mjs: ${error.message}\n`)
    process.exitCode = 1
  }
}
