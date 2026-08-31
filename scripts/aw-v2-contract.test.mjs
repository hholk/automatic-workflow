import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { parseModelJson } from "./benchmark-output.mjs"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (path) => readFileSync(join(root, path), "utf8")
const words = (value) => value.trim().split(/\s+/).filter(Boolean).length
const estimatedTokens = (value) => Math.ceil(value.length / 4)

test("keeps the always-loaded entrypoint small", () => {
  const skill = read("SKILL.md")
  assert.ok(words(skill) <= 420, `SKILL.md has ${words(skill)} words`)
  assert.ok(estimatedTokens(skill) <= 700, `SKILL.md is ~${estimatedTokens(skill)} tokens`)
})

test("routes progressively to modular references", () => {
  const skill = read("SKILL.md")
  for (const path of [
    "references/routing.md",
    "references/runtimes.md",
    "references/teacher.md",
    "references/lessons.md",
  ]) {
    assert.match(skill, new RegExp(path.replace(".", "\\.")), path)
    assert.ok(existsSync(join(root, path)), path)
  }
  for (const workflow of ["explore", "diagnose", "fix", "implement", "review"]) {
    assert.ok(existsSync(join(root, `workflows/${workflow}.md`)), workflow)
  }
})

test("uses GLM Flash for work and Codex Sol only as teacher", () => {
  const runtime = read("references/runtimes.md")
  const teacher = read("references/teacher.md")
  assert.match(runtime, /venice\/z-ai-glm-5-3-flash/)
  assert.match(runtime, /venice\/glm-5\.3-flash/)
  assert.match(teacher, /gpt-5\.6-sol/)
  assert.match(teacher, /Codex\s+subscription/i)
  assert.match(teacher, /five|5/i)
  assert.match(teacher, /no tools|must not use tools/i)
  assert.doesNotMatch(`${runtime}\n${teacher}`, /venice\/openai-gpt-56-sol/)
})

test("installs only native OpenCode GLM roles", () => {
  for (const name of ["aw-glm-worker.md", "aw-glm-review.md"]) {
    const profile = read(`agents/opencode/${name}`)
    assert.match(profile, /model: venice\/z-ai-glm-5-3-flash/)
    assert.match(profile, /mode: subagent/)
  }
  for (const obsolete of ["aw-luna-worker.md", "aw-luna-review.md", "aw-sol-expert.md"]) {
    assert.equal(existsSync(join(root, `agents/opencode/${obsolete}`)), false, obsolete)
  }
})

test("removes custom orchestration runtime", () => {
  for (const obsolete of ["bin.mjs", "bin.mjs.map", "plugin", "supervisor", "quality", "expert-skills"]) {
    assert.equal(existsSync(join(root, obsolete)), false, obsolete)
  }
})

test("separates skill experiments from repository lessons", () => {
  const skillLessons = read("LESSONS.md")
  const repoLessons = read("LESSONS-REPO.md")
  assert.match(skillLessons, /AW skill improvement experiments/i)
  assert.match(repoLessons, /Repository-specific lessons/i)
  assert.doesNotMatch(skillLessons, /YouTube media 403|Stitchcraft|SmartTube/)
})

test("ships reproducible routing and token benchmarks", () => {
  const cases = JSON.parse(read("benchmarks/use-cases.json"))
  const routes = new Map(cases.map((item) => [item.id, item.expected_route]))
  assert.deepEqual(Object.fromEntries(routes), {
    tiny_local: "direct",
    read_only_map: "explore",
    unknown_bug: "diagnose",
    diagnosed_bug: "fix",
    known_change: "implement",
    architecture: "teacher",
    hard_fix: "teacher",
    completed_change: "review",
    irreversible: "human",
  })
  assert.ok(existsSync(join(root, "scripts/benchmark.mjs")))
  const latest = JSON.parse(read("benchmarks/latest.json"))
  assert.equal(latest.routing.passed, 9)
  assert.equal(latest.live.passed, 9)
  assert.ok(latest.entrypoint.estimated_tokens < 700)
  const lessons = read("LESSONS.md")
  assert.match(lessons, /2,377 estimated initialization tokens/)
  assert.match(lessons, /13,932 live total tokens/)
})

test("accepts fenced JSON from live GLM benchmarks", () => {
  assert.deepEqual(parseModelJson('```json\n{"routes":[]}\n```'), { routes: [] })
})
