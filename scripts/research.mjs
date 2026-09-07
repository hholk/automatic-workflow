#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { buildCellID, compareRecipes, readRuns } from "./evidence.mjs"

const command = process.argv[2]
const arg = (name) => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}
const requiredArg = (name) => {
  const value = arg(name)
  if (!value) throw new Error(`${name} is required`)
  return value
}
const readJson = (path) => JSON.parse(readFileSync(resolve(path), "utf8"))
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const mutableFields = new Set(["recipe_id", "prompt_profile_id", "context_budget", "worker_step_budget", "teacher_after_failed_hypotheses"])
const stateDir = process.env.AW_STATE_DIR || join(homedir(), ".local", "state", "aw")

const leafDiffs = (before, after, prefix = "") => {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
  return [...keys].flatMap((key) => {
    const path = prefix ? `${prefix}.${key}` : key
    const left = before?.[key]
    const right = after?.[key]
    if (same(left, right)) return []
    const leftObject = left && typeof left === "object" && !Array.isArray(left)
    const rightObject = right && typeof right === "object" && !Array.isArray(right)
    if (leftObject || rightObject) {
      return leafDiffs(leftObject ? left : {}, rightObject ? right : {}, path)
    }
    return [path]
  })
}
const currentWeek = () => {
  const now = new Date()
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7))
  const start = new Date(Date.UTC(day.getUTCFullYear(), 0, 1))
  return `${day.getUTCFullYear()}-W${String(Math.ceil((((day - start) / 86400000) + 1) / 7)).padStart(2, "0")}`
}

try {
  if (command === "promote") {
    const playbookPath = resolve(requiredArg("--playbook"))
    const current = readJson(playbookPath)
    const candidate = readJson(requiredArg("--candidate"))
    if (current.schema_version !== 4 || candidate.schema_version !== 4) throw new Error("playbooks must use schema_version 4")
    if (!same(current.frozen, candidate.frozen)) throw new Error("frozen evaluator, telemetry, and safety fields cannot change")
    const changes = leafDiffs(current, candidate).filter((path) => path !== "version" && path !== "generated_at")
    if (changes.length !== 1) throw new Error(`candidate must contain exactly one mutation; found ${changes.length}`)
    const field = changes[0].split(".").at(-1)
    const allowedPath = changes[0] === `defaults.${field}` || (changes[0].startsWith("cells.") && changes[0].endsWith(`.${field}`))
    if (!mutableFields.has(field) || !allowedPath) throw new Error(`field is not mutable: ${changes[0]}`)
    if (field === "recipe_id") {
      const cellKey = changes[0].startsWith("cells.") ? changes[0].slice("cells.".length, -".recipe_id".length) : null
      const recipeID = cellKey ? candidate.cells?.[cellKey]?.recipe_id : candidate.defaults.recipe_id
      if (!/^[a-z0-9][a-z0-9-]*$/.test(recipeID || "")) throw new Error("recipe_id must be a lowercase immutable ID")
      const recipesDir = resolve(arg("--recipes") || join(dirname(playbookPath), "recipes"))
      if (!existsSync(join(recipesDir, `${recipeID}.md`))) throw new Error(`recipe file not found: ${recipeID}.md`)
    }
    if (field === "prompt_profile_id") {
      const registryPath = resolve(arg("--profiles") || join(dirname(playbookPath), "..", "prompts", "profiles.json"))
      const registry = readJson(registryPath)
      const profileID = changes[0].startsWith("cells.")
        ? candidate.cells?.[changes[0].slice("cells.".length, -".prompt_profile_id".length)]?.prompt_profile_id
        : candidate.defaults.prompt_profile_id
      const known = Boolean(registry.prompt_profiles?.[profileID])
      if (!known) throw new Error(`prompt profile not found: ${profileID}`)
    }
    const analysis = compareRecipes(readRuns(stateDir), current.version, candidate.version, Number(arg("--min-pairs") || 5))
    if (analysis.verdict !== "eligible-to-promote") throw new Error(`recomputed analysis verdict is ${analysis.verdict}`)
    const promoted = { ...candidate, generated_at: new Date().toISOString() }
    writeFileSync(playbookPath, `${JSON.stringify(promoted, null, 2)}\n`)
    mkdirSync(stateDir, { recursive: true })
    appendFileSync(join(stateDir, "research.jsonl"), `${JSON.stringify({ kind: "promotion", at: promoted.generated_at, baseline: current.version, candidate: candidate.version, mutation: changes[0] })}\n`)
    process.stdout.write(`${JSON.stringify({ result: "promoted", version: candidate.version, mutation: changes[0] }, null, 2)}\n`)
  } else if (command === "select") {
    const playbook = readJson(requiredArg("--playbook"))
    if (playbook.schema_version !== 4) throw new Error("playbook must use schema_version 4")
    const mainModel = requiredArg("--main-model")
    const workerModel = requiredArg("--worker-model")
    const requestedMain = arg("--requested-main-model") || mainModel
    const requestedWorker = arg("--requested-worker-model") || workerModel
    const mainFallback = arg("--main-fallback-reason") || null
    const workerFallback = arg("--worker-fallback-reason") || null
    if (requestedMain !== mainModel && !mainFallback) throw new Error("--main-fallback-reason is required when requested and resolved main models differ")
    if (requestedWorker !== workerModel && !workerFallback) throw new Error("--worker-fallback-reason is required when requested and resolved worker models differ")
    const teacherModel = arg("--teacher-model") || null
    const requestedTeacher = arg("--requested-teacher-model") || teacherModel
    const teacherFallback = arg("--teacher-fallback-reason") || null
    if (requestedTeacher !== teacherModel && teacherModel && !teacherFallback) throw new Error("--teacher-fallback-reason is required when requested and resolved teacher models differ")
    const key = buildCellID({
      host: requiredArg("--host"),
      actors: {
        main: { used: true, requested_model: requestedMain, resolved_model: mainModel, fallback_reason: mainFallback },
        worker: { used: true, requested_model: requestedWorker, resolved_model: workerModel, fallback_reason: workerFallback },
        teacher: { used: Boolean(teacherModel), requested_model: requestedTeacher, resolved_model: teacherModel, fallback_reason: teacherFallback },
      },
      route: requiredArg("--route"),
      task: { class: requiredArg("--task-class"), complexity: requiredArg("--complexity") },
      promptProfileID: playbook.defaults?.prompt_profile_id,
    })
    process.stdout.write(`${JSON.stringify({ ...playbook.defaults, ...(playbook.cells?.[key] || {}), playbook_version: playbook.version, cell_id: key }, null, 2)}\n`)
  } else if (command === "due") {
    const week = currentWeek()
    const historyPath = join(stateDir, "research.jsonl")
    const completed = existsSync(historyPath) && readFileSync(historyPath, "utf8").split(/\r?\n/).some((line) => line.includes(`\"week\":\"${week}\"`))
    process.stdout.write(`${JSON.stringify({ week, due: !completed, action: completed ? "no-change" : "run-weekly-research" }, null, 2)}\n`)
  } else if (command === "close") {
    const result = requiredArg("--result")
    if (!["promoted", "reverted", "no-change"].includes(result)) throw new Error("invalid weekly result")
    mkdirSync(stateDir, { recursive: true })
    const item = { kind: "weekly-result", at: new Date().toISOString(), week: currentWeek(), result }
    appendFileSync(join(stateDir, "research.jsonl"), `${JSON.stringify(item)}\n`)
    process.stdout.write(`${JSON.stringify(item, null, 2)}\n`)
  } else {
    throw new Error("research.mjs: use due, select, promote, or close")
  }
} catch (error) {
  process.stderr.write(`research.mjs: ${error.message}\n`)
  process.exitCode = 1
}
