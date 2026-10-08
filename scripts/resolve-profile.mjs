#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"))
const defaultRegistry = readJson(join(root, "prompts/profiles.json"))
const defaultPlaybook = readJson(join(root, "playbooks/current.json"))
const hosts = new Set(["codex", "opencode", "github-copilot"])
const workerRoutes = new Set(["explore", "diagnose", "fix", "implement", "review"])

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
  if (playbook.schema_version !== 4) throw new Error("playbook schema_version 4 is required")
  if (registry.schema_version !== 1) throw new Error("profile registry schema_version 1 is required")
  if (!hosts.has(input.host)) throw new Error(`unknown host: ${input.host}`)
  if (!new Set(["worker", "teacher"]).has(input.role)) throw new Error(`unknown role: ${input.role}`)

  if (input.role === "teacher") {
    if (input.route !== "teacher") throw new Error(`unknown route for teacher: ${input.route}`)
    const binding = registry.teacher_bindings?.[input.host]
    if (!binding) throw new Error(`unsupported teacher host: ${input.host}`)
    if (input.model && ![registry.teacher_default, binding.model].includes(input.model)) {
      throw new Error(`unsupported teacher model: ${input.model}`)
    }
    const model = registry.teacher_default
    const profile = registry.teacher_profiles[model]
    if (!profile) throw new Error(`unknown teacher profile: ${model}`)
    const promptProfile = resolvePromptProfile(input, registry, playbook, profile)
    const components = [profile.core, profile.contract, profile.model_delta, promptProfile.overlay].filter(Boolean)
    assertComponents(components)
    return {
      host: input.host,
      role: input.role,
      route: input.route,
      ...binding,
      profile_id: profile.id,
      prompt_profile_id: promptProfile.id,
      recipe_id: null,
      components,
      teacher: {
        max_asks: playbook.frozen.teacher_max_asks,
        max_turns: playbook.frozen.teacher_max_turns,
      },
    }
  }

  if (!workerRoutes.has(input.route)) throw new Error(`unknown route: ${input.route}`)
  const model = input.model || registry.worker_defaults?.[input.host]
  if (!model) throw new Error(`missing default worker model: ${input.host}`)
  const profile = registry.worker_profiles[`${input.host}|${model}`]
  if (!profile) throw new Error(`unknown worker profile: ${input.host}|${model}`)
  if (profile.retired) throw new Error(`retired worker profile: ${input.host}|${model}`)
  const promptProfile = resolvePromptProfile(input, registry, playbook, profile)
  const recipeID = playbook.defaults.recipe_id
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
    model_provider: input.host === "codex" ? "codex-router" : (model.includes("/") ? model.split("/")[0] : "venice"),
    native_agent: input.host === "opencode" && input.model === "venice/z-ai-glm-5-3-flash"
      ? (["fix", "implement"].includes(input.route) ? "aw-glm53-worker" : "aw-glm53-review")
      : input.host === "github-copilot"
        ? "aw-worker"
        : (["fix", "implement"].includes(input.route) ? "aw-mimo-worker" : "aw-mimo-review"),
    budget: {
      context_tokens: playbook.defaults.context_budget,
      worker_steps: playbook.defaults.worker_step_budget,
      failed_hypotheses: playbook.defaults.teacher_after_failed_hypotheses,
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
