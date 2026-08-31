#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { parseModelJson } from "./benchmark-output.mjs"

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
  const value = paths.map(read).join("\n")
  return {
    files: paths,
    words: value.trim().split(/\s+/).filter(Boolean).length,
    characters: value.length,
    estimated_tokens: Math.ceil(value.length / 4),
  }
}

const cases = JSON.parse(read("benchmarks/use-cases.json"))
const routing = read("references/routing.md")
const routeFiles = {
  direct: [], human: [],
  explore: ["references/runtimes.md", "workflows/explore.md"],
  diagnose: ["references/runtimes.md", "workflows/diagnose.md"],
  fix: ["references/runtimes.md", "workflows/fix.md"],
  implement: ["references/runtimes.md", "workflows/implement.md"],
  review: ["references/runtimes.md", "workflows/review.md"],
  teacher: ["references/runtimes.md", "references/teacher.md"],
}
const routeCoverage = cases.map(({ id, expected_route }) => {
  const row = routing.split("\n").find((line) => line.includes(`\`${id}\``)) || ""
  return { id, expected_route, pass: row.includes(`\`${expected_route}\``) }
})
const routeContexts = cases.map(({ id, expected_route }) => ({
  id,
  route: expected_route,
  ...metric(["SKILL.md", ...routeFiles[expected_route]]),
}))
const entrypoint = metric(["SKILL.md"])
const averageRouteTokens = Math.round(routeContexts.reduce((sum, item) => sum + item.estimated_tokens, 0) / routeContexts.length)
const obsolete = ["bin.mjs", "bin.mjs.map", "plugin", "supervisor", "quality", "expert-skills"].filter((path) => existsSync(join(root, path)))
const runtime = read("references/runtimes.md")
const teacher = read("references/teacher.md")

const result = {
  version: "v2",
  entrypoint,
  average_route_estimated_tokens: averageRouteTokens,
  route_contexts: routeContexts,
  routing: {
    passed: routeCoverage.filter((item) => item.pass).length,
    total: routeCoverage.length,
    cases: routeCoverage,
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
  result.live = JSON.parse(read("benchmarks/latest.json")).live
}
if (write) writeFileSync(join(root, "benchmarks/latest.json"), `${JSON.stringify(result, null, 2)}\n`)
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
