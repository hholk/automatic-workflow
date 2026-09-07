#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { parseModelJson } from "./benchmark-output.mjs"
import { resolveSelection } from "./resolve-profile.mjs"

const ownRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const valueAfter = (name) => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}
const root = resolve(valueAfter("--skill") || ownRoot)
const live = process.argv.includes("--live")
const write = process.argv.includes("--write")
const read = (path) => readFileSync(join(root, path), "utf8")
const metric = (paths) => {
  const files = [...new Set(paths)]
  const value = files.map(read).join("\n")
  return {
    files,
    words: value.trim().split(/\s+/).filter(Boolean).length,
    characters: value.length,
    estimated_tokens: Math.ceil(value.length / 4),
  }
}

const cases = JSON.parse(read("benchmarks/use-cases.json"))
const playbook = JSON.parse(read("playbooks/current.json"))
const routing = read("references/routing.md")
const runtimeFor = {
  codex: "references/runtimes-codex.md",
  opencode: "references/runtimes-opencode.md",
  "github-copilot": "references/runtimes-copilot.md",
}
const selectionFor = (item) => {
  if (["direct", "human"].includes(item.expected_route) || !item.expected_profile_id) return null
  return resolveSelection({
    host: item.host,
    role: item.role,
    model: item.role === "teacher" ? item.teacher_model : item.worker_model,
    route: item.expected_route,
    taskClass: item.task_class,
    complexity: item.complexity,
    explicitModelRequest: item.explicit_model_request === true,
  })
}
const routeCoverage = cases.map(({ id, routing_case, expected_route }) => {
  const row = routing.split("\n").find((line) => line.includes(`\`${routing_case || id}\``)) || ""
  return { id, expected_route, pass: row.includes(`\`${expected_route}\``) }
})
const routeContexts = cases.map((item) => {
  const selection = selectionFor(item)
  const component_ids = selection?.components || []
  const runtime = selection ? runtimeFor[item.host] : null
  return {
    id: item.id,
    route: item.expected_route,
    host: item.host,
    profile_id: selection?.profile_id || null,
    prompt_profile_id: selection?.prompt_profile_id || null,
    expected_profile_id: item.expected_profile_id,
    profile_pass: (selection?.profile_id || null) === item.expected_profile_id,
    prompt_profile_pass: !selection || selection.prompt_profile_id === playbook.defaults.prompt_profile_id,
    component_ids,
    ...metric(["SKILL.md", ...(runtime ? [runtime] : []), ...component_ids]),
  }
})
const entrypoint = metric(["SKILL.md"])
const averageRouteTokens = Math.round(routeContexts.reduce((sum, item) => sum + item.estimated_tokens, 0) / routeContexts.length)
const obsolete = ["bin.mjs", "bin.mjs.map", "plugin", "supervisor", "quality", "expert-skills", "scripts/aw-v2-contract.test.mjs"].filter((path) => existsSync(join(root, path)))
const runtime = `${read("references/runtimes-opencode.md")}\n${read("references/runtimes-codex.md")}`
const teacher = read("references/teacher.md")

const result = {
  version: "v4",
  entrypoint,
  average_route_estimated_tokens: averageRouteTokens,
  route_contexts: routeContexts,
  routing: {
    passed: routeCoverage.filter((item) => item.pass).length,
    total: routeCoverage.length,
    cases: routeCoverage,
  },
  profiles: {
    passed: routeContexts.filter((item) => item.profile_pass).length,
    total: routeContexts.length,
    cases: routeContexts.map(({ id, profile_id, expected_profile_id, profile_pass }) => ({ id, profile_id, expected_profile_id, pass: profile_pass })),
  },
  prompt_profiles: {
    passed: routeContexts.filter((item) => item.prompt_profile_pass).length,
    total: routeContexts.length,
    cases: routeContexts.map(({ id, prompt_profile_id, prompt_profile_pass }) => ({ id, prompt_profile_id, pass: prompt_profile_pass })),
  },
  invariants: {
    codex_glm: runtime.includes("venice/glm-5.3-flash"),
    opencode_glm: runtime.includes("venice/z-ai-glm-5-3-flash"),
    codex_sol_teacher: teacher.includes("gpt-5.6-sol") && /Codex\s+subscription/i.test(teacher),
    no_venice_sol: !`${runtime}\n${teacher}`.includes("venice/openai-gpt-56-sol"),
    teacher_five_turn_cap: /Maximum five Sol responses/.test(teacher),
    custom_runtime_removed: obsolete.length === 0,
  },
  obsolete,
}

if (live) {
  const instructionPath = valueAfter("--instructions")
  const instructions = instructionPath
    ? readFileSync(resolve(instructionPath), "utf8")
    : `${read("SKILL.md")}\n\n${routing}`
  const prompt = [
    "Classify every use case using the supplied AW instructions.",
    "Return only JSON shaped as {\"routes\":[{\"id\":\"...\",\"route\":\"...\"}]}; include every id once.",
    instructions,
    JSON.stringify(cases.map(({ id, prompt }) => ({ id, prompt }))),
  ].join("\n\n")
  const run = spawnSync("opencode", [
    "run", "--pure", "--format", "json", "--model", "venice/z-ai-glm-5-3-flash",
    "--dir", root, prompt,
  ], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 })
  if (run.status !== 0) {
    throw new Error(`live benchmark failed (${run.status}): ${run.stderr.slice(-1000)}`)
  }
  const events = run.stdout.split(/\r?\n/).filter(Boolean).flatMap((line) => { try { return [JSON.parse(line)] } catch { return [] } })
  const answerText = events.filter((event) => event.type === "text").map((event) => event.part?.text || "").join("").trim()
  const answer = parseModelJson(answerText)
  const actual = new Map(answer.routes.map((item) => [item.id, item.route]))
  const scored = cases.map((item) => ({ id: item.id, expected: item.expected_route, actual: actual.get(item.id), pass: actual.get(item.id) === item.expected_route }))
  const finish = events.filter((event) => event.type === "step_finish").at(-1)
  result.live = {
    status: "current",
    engine: "opencode --pure",
    model: "venice/z-ai-glm-5-3-flash",
    instruction_characters: instructions.length,
    passed: scored.filter((item) => item.pass).length,
    total: scored.length,
    cases: scored,
    tokens: finish?.part?.tokens || null,
    cost: finish?.part?.cost ?? null,
  }
}

if (write && !live && existsSync(join(root, "benchmarks/latest.json"))) {
  result.live = { ...JSON.parse(read("benchmarks/latest.json")).live, status: "historical-not-current" }
}
if (write) writeFileSync(join(root, "benchmarks/latest.json"), `${JSON.stringify(result, null, 2)}\n`)
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
if (result.routing.passed !== result.routing.total
  || result.profiles.passed !== result.profiles.total
  || result.prompt_profiles.passed !== result.prompt_profiles.total
  || !Object.values(result.invariants).every(Boolean)) {
  process.exitCode = 1
}
