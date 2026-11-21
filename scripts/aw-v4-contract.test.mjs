import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (path) => readFileSync(join(root, path), "utf8")
const frontmatter = (path) => read(path).match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ""

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
  assert.match(skill, /AW v7/)
  assert.match(skill, /resolve-profile\.mjs/)
  assert.match(skill, /Load only returned\s+components/i)
  assert.match(skill, /Main alone dispatches/i)
  assert.match(skill, /focused teacher help/i)
  assert.match(skill, /DONE.*TEACHER_REQUEST/is)
  assert.doesNotMatch(skill, /HUMAN_REQUEST/)
})

test("uses AW v7 Hstack defaults and a scoped Animatic threshold", () => {
  const skill = read("SKILL.md")
  const hstack = read("references/hstack.md")
  const completion = skill.split("## Completion animatic")[1]
  assert.match(skill, /poteto-core\.md.*poteto-mode\/SKILL\.md/s)
  assert.match(skill, /recommended_hstack_skills/)
  assert.match(hstack, /poteto_style_reference/)
  assert.match(completion, /assurance: "reviewed"/)
  assert.match(completion, /user-visible UI changes/)
  assert.match(completion, /pull-request deliverables/)
  assert.match(completion, /explicit user requests/)
  assert.match(completion, /short direct non-UI work.*ketchup/is)
})

test("keeps one active operating trial and explicit Hstack escalation", () => {
  const policy = JSON.parse(read("playbooks/current.json"))
  assert.equal(policy.schema_version, 4)
  assert.ok(Object.hasOwn(policy.operating_learning, "active_trial"))
  assert.deepEqual(policy.operating_learning.rollup_dimensions, [
    "playbook_version", "host", "route", "worker_model",
  ])

  const hstack = read("references/hstack.md")
  assert.match(hstack, /correct.*principle-encode-lessons-in-structure/)
  assert.match(hstack, /friction.*h-retro/)
  assert.match(hstack, /reflect.*explicit user request/)
  const lessons = read("references/lessons.md")
  assert.match(lessons, /\.aw\/lessons\.json/)
  assert.match(lessons, /selectReviewedLessons/)
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
    const procedure = read(`workflows/${workflow}.md`)
    assert.match(procedure, /project-local `verify-\*` skill/)
    assert.match(procedure, /verify\.command.*verify\.expected/s)
    assert.match(procedure, /SEAM -> RED -> MINIMAL CHANGE -> GREEN/)
  }
  assert.match(teacher, /five.*ASK|5.*ASK/i)
  assert.match(teacher, /seven turns per ASK/i)
  assert.match(teacher, /same teacher thread/i)
  assert.match(teacher, /one ASK repair/i)
  assert.match(teacher, /one evidence repair/i)
})

test("prefers useful MCP evidence without forcing redundant calls", () => {
  const skill = read("SKILL.md")
  const worker = read("prompts/core/worker.md")
  assert.match(worker, /Codebase Memory/)
  assert.match(worker, /Context7/)

  assert.match(worker, /reuse.*supplied evidence|reuse sufficient supplied evidence/is)

  assert.match(worker, /useful and cheaper/is)
  assert.match(worker, /skip unavailable, redundant, or non-decisive\s+calls/is)

  for (const text of [skill, worker]) {
    assert.doesNotMatch(text, /always call/i)
  }

  const codex = read("references/runtimes-codex.md")
  const opencode = read("references/runtimes-opencode.md")
  const copilot = read("references/runtimes-copilot.md")
  assert.match(codex, /configured native MCPs/i)
  assert.match(opencode, /explicitly allow both (?:MCP )?namespaces/i)
  assert.match(copilot, /configured MCP servers/i)
  assert.match(copilot, /unavailable tools remain UNKNOWN/i)

  const teacher = read("prompts/core/teacher.md")
  assert.match(teacher, /Use no tools or outside\s+evidence/i)
  assert.doesNotMatch(teacher, /Codebase Memory|Context7/)
})

test("binds dedicated native harness profiles without recursive agents", () => {
  for (const name of ["aw-worker", "aw-reviewer"]) {
    const profile = read(`agents/opencode/${name}.md`)
    const config = frontmatter(`agents/opencode/${name}.md`)
    assert.match(read(`agents/generated/opencode/${name}.md`), /^model: openai\/gpt-6\.1-terra#low$/m)
    assert.match(profile, /mode: all/)
    assert.match(config, /task: deny/)
    assert.match(config, /"codebase-memory-mcp_\*": allow/)
    assert.match(config, /"context7_\*": allow/)
    assert.match(profile, /DONE.*TEACHER_REQUEST/is)
    assert.doesNotMatch(profile, /HUMAN_REQUEST/)
    if (name === "aw-worker") {
      assert.match(config, /edit: allow/)
      assert.match(config, /write: allow/)
    }
  }
  assert.match(frontmatter("agents/opencode/aw-reviewer.md"), /edit: deny/)
  assert.match(frontmatter("agents/opencode/aw-reviewer.md"), /write: deny/)

  const opencode = read("references/runtimes-opencode.md")
  assert.match(opencode, /aw-worker/)
  assert.match(opencode, /aw-reviewer/)
  assert.match(opencode, /aw-teacher/)
  assert.match(opencode, /dedicated AW profiles are the default/i)
  assert.doesNotMatch(opencode, /subagent_type:\s*(?:general|explore)/)
  assert.match(opencode, /providerID.*modelID/is)
  assert.match(opencode, /mismatch.*stop/is)

  const codex = read("references/runtimes-codex.md")
  assert.match(codex, /explicit native model selection/i)
  assert.match(codex, /prompt profile/i)
  assert.match(codex, /gpt-6\.1-terra/)
  assert.match(codex, /venice-responses\/claude-opus-5-5/)
  const copilot = read("references/runtimes-copilot.md")
  assert.match(copilot, /unresolved.*unknown/is)
  assert.match(copilot, /exclude.*model-specific/is)
  const copilotAgent = read("agents/generated/copilot/aw-worker.agent.md")
  assert.match(copilotAgent, /model: venice\/deepseek-v4-1-flash-1017/)
  assert.match(copilotAgent, /- codebase-memory-mcp\/\*/)
  assert.match(copilotAgent, /- context7\/\*/)
  assert.doesNotMatch(`${codex}\n${copilot}`, /\bv3\b/)
})

test("benchmarks resolved v4 component sets including explicit Opus", () => {
  const cases = JSON.parse(read("benchmarks/use-cases.json"))
  for (const item of cases.filter((entry) => !["direct", "human"].includes(entry.expected_route))) {
    assert.equal(typeof item.host, "string", item.id)
    assert.ok("expected_profile_id" in item, item.id)
  }
  const opus = cases.find((item) => item.id === "architecture_opus")
  assert.equal(opus.teacher_model, "venice-responses/claude-opus-5-5")
  assert.equal(opus.explicit_model_request, true)
  assert.equal(opus.expected_profile_id, "opus-teacher-v1")

  const benchmark = read("scripts/benchmark.mjs")
  assert.match(benchmark, /resolveSelection/)
  assert.match(benchmark, /component_ids/)
  assert.match(benchmark, /profile_id/)
  assert.doesNotMatch(benchmark, /version:\s*"v3"/)
})


test("routing reserves direct for tiny tasks and delegates non-trivial work by default", () => {
  const skill = read("SKILL.md")
  const routing = read("references/routing.md")
  assert.match(skill, /references\/routing\.md/)
  assert.match(skill, /Delegate by default for multi-file discovery,\s+diagnosis, non-trivial implementation, independent verification or review, and\s+two or more useful parallel slices/)
  assert.match(skill, /Main alone dispatches scoped `aw-worker` or `aw-reviewer` subagents/)
  assert.match(skill, /up to two ready independent workers concurrently\.\s+Honor explicit concurrency requests up to the host cap/)
  const rows = routing.split("\n")
    .filter((line) => line.startsWith("| `"))
    .map((line) => line.split("|").slice(1, 4).map((cell) => cell.trim()))
  const direct = rows.filter(([, , route]) => route === "`direct`")
  assert.equal(direct.length, 1)
  assert.equal(direct[0][0], "`tiny_local`")
  assert.match(direct[0][1], /tiny single-location edit or immediate read\/check.*one verified step/)
  const directIndex = rows.indexOf(direct[0])
  for (const [id, route] of [
    ["read_only_map", "explore"],
    ["unknown_bug", "diagnose"],
    ["diagnosed_bug", "fix"],
    ["known_change", "implement"],
    ["completed_change", "review"],
  ]) {
    const index = rows.findIndex(([key]) => key === `\`${id}\``)
    assert.ok(index > directIndex, id)
    assert.equal(rows[index][2], `\`${route}\``, id)
  }
  assert.match(routing, /Default to delegation for `explore`, `diagnose`, `fix`, `implement`, and\s+`review`/)
})

test("worker handoffs share one contract", () => {
  const explore = read("workflows/explore.md")
  assert.match(explore, /contracts\/worker\.md/)
  assert.doesNotMatch(explore, /STATUS \| EVIDENCE|native `explore` subagent/)
  assert.match(read("contracts/teacher.md"), /main agent.*EVIDENCE/is)
  assert.match(read("contracts/worker.md"), /unfinished|unmet/)
})
