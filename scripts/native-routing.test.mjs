import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("native agents exist and enforce provider, effort and recursion boundaries", () => {
  for (const name of ["aw-worker", "aw-reviewer"]) {
    const oc = read(`agents/opencode/${name}.md`)
    assert.match(oc, /steps: \{\{worker_steps\}\}/)
    assert.match(read(`agents/generated/opencode/${name}.md`), /steps: 125/)
    assert.match(oc, /task: deny/)
    const codex = read(`agents/codex/${name}.toml`)
    assert.match(codex, new RegExp(`name = "${name}"`))
    const rendered = read(`agents/generated/codex/${name}.toml`)
    assert.match(rendered, /model_provider = "codex-router"/)
    assert.match(rendered, /model = "venice\/openai-gpt-6-luna"/)
    assert.match(codex, /model_reasoning_effort = "high"/)
    assert.match(codex, /\[agents\]\nenabled = false/)
    assert.match(codex, /\[skills\]\ninclude_instructions = false/)
  }
  const teacher = read("agents/opencode/aw-teacher.md")
  assert.match(read("agents/generated/opencode/aw-teacher.md"), /model: venice\/claude-opus-5-5/)
  assert.match(teacher, /steps: 1/)
  assert.match(teacher, /"\*": deny/)
  const codex = read("agents/codex/aw-teacher.toml")
  const renderedTeacher = read("agents/generated/codex/aw-teacher.toml")
  assert.match(renderedTeacher, /model_provider = "codex-router"/)
  assert.match(renderedTeacher, /model = "venice\/claude-opus-5-5"/)
  assert.match(codex, /model_reasoning_effort = "high"/)
  assert.match(codex, /plugins = false/)
  assert.match(codex, /shell_tool = false/)
})

test("active recipe uses one output contract and bounded context", () => {
  const recipe = read("playbooks/recipes/bounded-v3.md")
  assert.match(recipe, /1600/)
  assert.match(recipe, /125 tool steps/)
  assert.match(recipe, /300 words/)
  assert.match(recipe, /contracts\/worker.md/)
  assert.doesNotMatch(recipe, /STATUS \| CHANGED/)
  const runtime = read("references/runtimes-opencode.md")
  assert.doesNotMatch(runtime, /codex exec|aw-luna-worker/)
  assert.match(runtime, /once per.*session/is)
})
