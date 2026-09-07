import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (path) => readFileSync(join(root, path), "utf8")

test("ships frozen worker and teacher contracts", () => {
  for (const path of ["contracts/worker.md", "contracts/teacher.md"]) {
    assert.equal(existsSync(join(root, path)), true, path)
  }

  const worker = read("contracts/worker.md")
  assert.match(worker, /TYPE: DONE/)
  assert.match(worker, /TYPE: TEACHER_REQUEST/)
  assert.match(worker, /MISSING_DECISIVE \| CONFLICTING \| EXHAUSTED/)
  assert.doesNotMatch(worker, /HUMAN_REQUEST/)

  const teacher = read("contracts/teacher.md")
  assert.match(teacher, /ASK:/)
  assert.match(teacher, /FINAL:/)
  assert.match(teacher, /TYPE: EVIDENCE/)
  assert.match(teacher, /inspect \| reproduce \| compare \| verify/)
})

test("loads one resolved prompt profile under main-agent authority", () => {
  const skill = read("SKILL.md")
  assert.match(skill, /AW v4/)
  assert.match(skill, /resolve-profile\.mjs/)
  assert.match(skill, /load only the returned component paths/i)
  assert.match(skill, /Only the main agent may start or resume agents/i)
  assert.match(skill, /Sol is default/i)
  assert.match(skill, /Astra requires an explicit user request/i)
  assert.match(skill, /DONE.*TEACHER_REQUEST/is)
  assert.doesNotMatch(skill, /HUMAN_REQUEST/)
})

test("routes evidence gaps, human authority, and lean TDD explicitly", () => {
  const routing = read("references/routing.md")
  const teacher = read("references/teacher.md")
  for (const state of ["MISSING_DECISIVE", "CONFLICTING", "EXHAUSTED"]) {
    assert.match(routing, new RegExp(state))
  }
  assert.match(routing, /HUMAN_DECISION_REQUIRED/)
  assert.match(routing, /Grilling/)
  assert.match(routing, /dependent decision tree/i)
  for (const workflow of ["fix", "implement"]) {
    assert.match(read(`workflows/${workflow}.md`), /SEAM -> RED -> MINIMAL CHANGE -> GREEN/)
  }
  assert.match(teacher, /three.*ASK|3.*ASK/i)
  assert.match(teacher, /five.*response|5.*response/i)
  assert.match(teacher, /same teacher thread/i)
  assert.match(teacher, /one ASK repair/i)
  assert.match(teacher, /one evidence repair/i)
})

test("binds dedicated native harness profiles without recursive agents", () => {
  for (const name of ["aw-glm-worker", "aw-glm-review"]) {
    const profile = read(`agents/opencode/${name}.md`)
    assert.match(profile, /model: venice\/z-ai-glm-5-3-flash/)
    assert.match(profile, /mode: all/)
    assert.match(profile, /task: deny/)
    assert.match(profile, /DONE.*TEACHER_REQUEST/is)
    assert.doesNotMatch(profile, /HUMAN_REQUEST/)
  }
  const luna = read("agents/opencode/aw-luna-worker.md")
  assert.match(luna, /model: openai-codex\/gpt-5\.6-luna/)
  assert.match(luna, /mode: all/)
  assert.match(luna, /recorded GLM availability failure/i)
  assert.match(luna, /task: deny/)

  const opencode = read("references/runtimes-opencode.md")
  assert.match(opencode, /aw-glm-worker/)
  assert.match(opencode, /aw-glm-review/)
  assert.match(opencode, /aw-luna-worker/)
  assert.match(opencode, /dedicated AW profiles are the default/i)
  assert.doesNotMatch(opencode, /subagent_type:\s*(?:general|explore)/)
  assert.match(opencode, /providerID.*modelID/is)
  assert.match(opencode, /mismatch.*stop/is)

  const codex = read("references/runtimes-codex.md")
  assert.match(codex, /explicit native model selection/i)
  assert.match(codex, /prompt profile/i)
  const copilot = read("references/runtimes-copilot.md")
  assert.match(copilot, /unresolved.*unknown/is)
  assert.match(copilot, /exclude.*model-specific/is)
  assert.doesNotMatch(`${codex}\n${copilot}`, /\bv3\b/)
})

test("benchmarks resolved v4 component sets including explicit Astra", () => {
  const cases = JSON.parse(read("benchmarks/use-cases.json"))
  for (const item of cases.filter((entry) => !["direct", "human"].includes(entry.expected_route))) {
    assert.equal(typeof item.host, "string", item.id)
    assert.ok("expected_profile_id" in item, item.id)
  }
  const astra = cases.find((item) => item.id === "architecture_astra")
  assert.equal(astra.teacher_model, "gpt-6-astra")
  assert.equal(astra.explicit_model_request, true)
  assert.equal(astra.expected_profile_id, "astra-teacher-v1")

  const benchmark = read("scripts/benchmark.mjs")
  assert.match(benchmark, /resolveSelection/)
  assert.match(benchmark, /component_ids/)
  assert.match(benchmark, /profile_id/)
  assert.doesNotMatch(benchmark, /version:\s*"v3"/)
})
