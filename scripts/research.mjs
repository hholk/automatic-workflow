#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { readRuns } from "./evidence.mjs"
import { effectivePolicy, validatePolicy } from "./effective-policy.mjs"
import { evaluateLearningCandidate, requireLearningReview, selectReviewedLessons } from "./learning-policy.mjs"

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
const mutableFields = new Set(["recipe_id", "prompt_profile_id", "context_budget", "worker_step_budget"])
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
  if (command === "promote" || command === "evaluate") {
    const playbookPath = resolve(requiredArg("--playbook"))
    const current = readJson(playbookPath)
    const candidate = readJson(requiredArg("--candidate"))
    if (![4, 5].includes(current.schema_version) || candidate.schema_version !== current.schema_version) throw new Error("playbooks must use the same schema_version 4 or 5")
    if (current.schema_version === 5 && [current, candidate].some((policy) =>
      policy.defaults?.teacher_after_failed_hypotheses !== 2 || Object.values(policy.cells || {}).some((cell) =>
        cell.teacher_after_failed_hypotheses !== undefined && cell.teacher_after_failed_hypotheses !== 2))) {
      throw new Error("v5 teacher threshold is fixed at two failed attempts")
    }
    if (!same(current.frozen, candidate.frozen)) throw new Error("frozen evaluator, telemetry, and safety fields cannot change")
    const changes = leafDiffs(current, candidate).filter((path) => path !== "version" && path !== "generated_at")
    if (changes.length !== 1) throw new Error(`candidate must contain exactly one mutation; found ${changes.length}`)
    const field = changes[0].split(".").at(-1)
    const allowedPath = changes[0] === `defaults.${field}` || Object.keys(candidate.cells || {}).some((key) => changes[0] === `cells.${key}.${field}`)
    if (!mutableFields.has(field) || !allowedPath) throw new Error(`field is not mutable: ${changes[0]}`)
    validatePolicy(candidate)
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
    const runs = readRuns(stateDir)
    const manifest = readJson(requiredArg("--manifest"))
    const packet = evaluateLearningCandidate({ baseline: current, candidate, runs,
      manifest, proposer: requiredArg("--proposer"), minimumPairs: Number(arg("--min-pairs") || 5) })
    if (changes[0].startsWith("cells.")) {
      const targetCell = changes[0].slice("cells.".length, -`.${field}`.length)
      const evidenceIDs = new Set(["discovery", "holdout"].flatMap((split) =>
        ["baseline_run_ids", "candidate_run_ids"].flatMap((side) => manifest[split][side])))
      for (const run of runs.filter((item) => evidenceIDs.has(item.run_id))) {
        const input = { host: run.host, actors: run.actors, route: run.route, task: run.task }
        const selected = effectivePolicy(input, { playbook: candidate })
        const prior = effectivePolicy(input, { playbook: current })
        if (selected.policy_cell_id !== targetCell || (Object.hasOwn(current.cells, targetCell) && prior.policy_cell_id !== targetCell)) {
          throw new Error(`evidence run ${run.run_id} does not select mutated policy cell ${targetCell}`)
        }
      }
    }
    if (command === "evaluate") {
      process.stdout.write(`${JSON.stringify(packet, null, 2)}\n`)
    } else {
      // Review must be supplied independently from the candidate and evidence.
      const reviewPath = resolve(requiredArg("--review"))
      if ([playbookPath, resolve(requiredArg("--candidate")), resolve(requiredArg("--manifest"))].includes(reviewPath)) throw new Error("review must be a separate approval artifact")
      const review = readJson(reviewPath)
      requireLearningReview(packet, review)
      const promoted = { ...candidate, generated_at: new Date().toISOString() }
      writeFileSync(playbookPath, `${JSON.stringify(promoted, null, 2)}\n`)
      mkdirSync(stateDir, { recursive: true })
      appendFileSync(join(stateDir, "research.jsonl"), `${JSON.stringify({ kind: "promotion", at: promoted.generated_at, baseline: current.version, candidate: candidate.version, mutation: changes[0], review_id: packet.review_id, identities: packet.identities, approved_by: review.approved_by })}\n`)
      process.stdout.write(`${JSON.stringify({ result: "promoted", version: candidate.version, mutation: changes[0] }, null, 2)}\n`)
    }
  } else if (command === "select") {
    const playbook = readJson(requiredArg("--playbook"))
    if (![4, 5].includes(playbook.schema_version)) throw new Error("playbook must use schema_version 4 or 5")
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
    const selection = effectivePolicy({
      host: requiredArg("--host"),
      providerHost: arg("--provider-host"),
      actors: {
        main: { used: true, requested_model: requestedMain, resolved_model: mainModel, fallback_reason: mainFallback },
        worker: { used: true, requested_model: requestedWorker, resolved_model: workerModel, fallback_reason: workerFallback },
        teacher: { used: Boolean(teacherModel), requested_model: requestedTeacher, resolved_model: teacherModel, fallback_reason: teacherFallback },
      },
      route: requiredArg("--route"),
      task: { class: requiredArg("--task-class"), complexity: requiredArg("--complexity") },
    }, { playbook })
    if (arg("--lessons")) selection.lessons = selectReviewedLessons(readJson(arg("--lessons")), {
      project_id: requiredArg("--project"), project_version: requiredArg("--project-version"), policy_version: playbook.version,
      prerequisites: arg("--prerequisites") ? readJson(arg("--prerequisites")) : {},
    })
    process.stdout.write(`${JSON.stringify(selection, null, 2)}\n`)
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
    throw new Error("research.mjs: use due, select, evaluate, promote, or close")
  }
} catch (error) {
  process.stderr.write(`research.mjs: ${error.message}\n`)
  process.exitCode = 1
}
