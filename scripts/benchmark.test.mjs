import test from "node:test"
import assert from "node:assert/strict"
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"))
const offline = (skill = root) => spawnSync(process.execPath, [join(root, "scripts/benchmark.mjs"), "--skill", skill], {
  encoding: "utf8", maxBuffer: 2 * 1024 * 1024,
})
const fixture = () => {
  const skill = mkdtempSync(join(tmpdir(), "aw-offline-benchmark-"))
  for (const path of ["SKILL.md", "benchmarks", "playbooks", "prompts", "contracts", "references", "workflows", "agents"]) {
    cpSync(join(root, path), join(skill, path), { recursive: true })
  }
  return skill
}

test("offline benchmark succeeds with current v5 registry profiles, routes and executable limits", () => {
  const historical = readFileSync(join(root, "benchmarks/latest.json"))
  const run = offline()
  assert.equal(run.status, 0, run.stderr)
  const value = JSON.parse(run.stdout)
  const registry = readJson("prompts/profiles.json")
  const playbook = readJson("playbooks/current.json")
  assert.equal(value.version, "v5")
  assert.equal(value.playbook_version, playbook.version)
  for (const name of ["routing", "profiles", "prompt_profiles"]) {
    assert.equal(value[name].passed, value[name].total, name)
    assert.equal(value[name].total, readJson("benchmarks/use-cases.json").length)
  }
  for (const item of value.route_contexts.filter((item) => !["direct", "human", "teacher"].includes(item.route))) {
    assert.equal(item.profile_id, registry.worker_profiles[`${item.host}|${registry.worker_defaults[item.host]}`].id)
    assert.equal(item.prompt_profile_id, playbook.defaults.prompt_profile_id)
    assert.ok(item.component_ids.includes(`playbooks/recipes/${playbook.defaults.recipe_id}.md`))
  }
  for (const item of value.route_contexts.filter((item) => item.route === "teacher")) {
    assert.equal(item.profile_id, registry.teacher_bindings[item.host].profile_id)
  }
  assert.deepEqual(Object.keys(value.invariants).sort(), [
    "codex_default_worker", "opencode_default_worker", "copilot_model_unsupported", "native_worker_budgets",
    "codex_opus_teacher", "opencode_opus_teacher", "no_venice_sol", "teacher_frozen_limits",
    "teacher_ask_cap", "teacher_turns_per_ask_cap", "teacher_handback_threshold", "custom_runtime_removed",
  ].sort())
  assert.ok(Object.values(value.invariants).every((passed) => passed === true))
  assert.equal(Object.hasOwn(value, "live"), false)
  assert.deepEqual(readFileSync(join(root, "benchmarks/latest.json")), historical)
})

test("offline benchmark fails when a generated worker drifts from the current model", () => {
  const skill = fixture()
  try {
    const path = join(skill, "agents/generated/opencode/aw-worker.md")
    writeFileSync(path, readFileSync(path, "utf8").replace("model: venice/deepseek-v4-1-flash-1017", "model: stale/worker"))
    const run = offline(skill)
    assert.equal(run.status, 1, run.stderr)
    const value = JSON.parse(run.stdout)
    assert.equal(value.invariants.opencode_default_worker, false)
    assert.equal(value.profiles.passed, value.profiles.total)
  } finally { rmSync(skill, { recursive: true }) }
})

test("offline benchmark rejects changed frozen teacher limits", () => {
  const skill = fixture()
  try {
    const path = join(skill, "playbooks/current.json")
    const playbook = JSON.parse(readFileSync(path, "utf8"))
    playbook.frozen.teacher_max_turns_per_ask = 8
    writeFileSync(path, JSON.stringify(playbook))
    const run = offline(skill)
    assert.equal(run.status, 1, run.stderr)
    const value = JSON.parse(run.stdout)
    assert.equal(value.invariants.teacher_frozen_limits, false)
    assert.equal(value.invariants.teacher_turns_per_ask_cap, false)
  } finally { rmSync(skill, { recursive: true }) }
})

test("offline benchmark rejects an enabled Copilot profile without native model support", () => {
  const skill = fixture()
  try {
    const path = join(skill, "agents/generated/copilot/aw-worker.agent.md")
    writeFileSync(path, readFileSync(path, "utf8").replace("disable-model-invocation: true", "disable-model-invocation: false"))
    const run = offline(skill)
    assert.equal(run.status, 1, run.stderr)
    assert.equal(JSON.parse(run.stdout).invariants.copilot_model_unsupported, false)
  } finally { rmSync(skill, { recursive: true }) }
})
