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

export const resolveSelection = (input, overrides = {}) => {
  const registry = overrides.registry || defaultRegistry
  const playbook = overrides.playbook || defaultPlaybook
  if (playbook.schema_version !== 4) throw new Error("playbook schema_version 4 is required")
  if (registry.schema_version !== 1) throw new Error("profile registry schema_version 1 is required")
  if (!hosts.has(input.host)) throw new Error(`unknown host: ${input.host}`)
  if (!new Set(["worker", "teacher"]).has(input.role)) throw new Error(`unknown role: ${input.role}`)

  if (input.role === "teacher") {
    if (input.route !== "teacher") throw new Error(`unknown route for teacher: ${input.route}`)
    const model = input.model || registry.teacher_default
    if (model !== registry.teacher_default
      && (!input.explicitModelRequest || !registry.teacher_explicit_overrides.includes(model))) {
      throw new Error(`${model} requires an explicit user request`)
    }
    const profile = registry.teacher_profiles[model]
    if (!profile) throw new Error(`unknown teacher profile: ${model}`)
    const components = [profile.core, profile.contract, profile.model_delta]
    assertComponents(components)
    return {
      host: input.host,
      role: input.role,
      route: input.route,
      model,
      profile_id: profile.id,
      recipe_id: null,
      components,
      teacher: {
        max_asks: playbook.frozen.teacher_max_asks,
        max_turns: playbook.frozen.teacher_max_turns,
      },
    }
  }

  if (!workerRoutes.has(input.route)) throw new Error(`unknown route: ${input.route}`)
  const profile = registry.worker_profiles[`${input.host}|${input.model}`]
  if (!profile) throw new Error(`unknown worker profile: ${input.host}|${input.model}`)
  const recipeID = playbook.defaults.recipe_id
  const components = [
    profile.core,
    profile.contract,
    profile.model_delta,
    `workflows/${input.route}.md`,
    `playbooks/recipes/${recipeID}.md`,
  ]
  assertComponents(components)
  return {
    host: input.host,
    role: input.role,
    route: input.route,
    task_class: input.taskClass || null,
    complexity: input.complexity || null,
    model: input.model,
    profile_id: profile.id,
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
      explicitModelRequest: process.argv.includes("--explicit-model-request"),
    })
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
  } catch (error) {
    process.stderr.write(`resolve-profile.mjs: ${error.message}\n`)
    process.exitCode = 1
  }
}
