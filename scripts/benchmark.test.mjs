import test from "node:test"
import assert from "node:assert/strict"
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"))
const offline = (skill = root, ...args) => spawnSync(process.execPath, [join(root, "scripts/benchmark.mjs"), "--skill", skill, ...args], {
  encoding: "utf8", maxBuffer: 2 * 1024 * 1024,
})
const fixture = () => {
  const skill = join(mkdtempSync(join(tmpdir(), "aw-offline-benchmark-")), "aw")
  mkdirSync(skill)
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
    const expected = item.id === "architecture_opus" ? "opus-teacher-v1" : registry.teacher_bindings[item.host].profile_id
    assert.equal(item.profile_id, expected)
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
    writeFileSync(path, readFileSync(path, "utf8").replace(/^model: .*$/m, "model: stale/worker"))
    const run = offline(skill)
    assert.equal(run.status, 1, run.stderr)
    const value = JSON.parse(run.stdout)
    assert.equal(value.invariants.opencode_default_worker, false)
    assert.equal(value.profiles.passed, value.profiles.total)
  } finally { rmSync(dirname(skill), { recursive: true }) }
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
  } finally { rmSync(dirname(skill), { recursive: true }) }
})

test("offline benchmark rejects an enabled Copilot profile without native model support", () => {
  const skill = fixture()
  try {
    const path = join(skill, "agents/generated/copilot/aw-worker.agent.md")
    writeFileSync(path, readFileSync(path, "utf8").replace("disable-model-invocation: true", "disable-model-invocation: false"))
    const run = offline(skill)
    assert.equal(run.status, 1, run.stderr)
    assert.equal(JSON.parse(run.stdout).invariants.copilot_model_unsupported, false)
  } finally { rmSync(dirname(skill), { recursive: true }) }
})


test("startup context counts actual files and only gates the core Poteto build", () => {
  const skill = fixture()
  try {
    const poteto = join(dirname(skill), "poteto-mode")
    let value = JSON.parse(offline(skill).stdout)
    assert.equal(value.hstack_startup.poteto_mode, "absent")
    assert.equal(value.budgets.hstack_core_startup, "skipped_absent_poteto")
    assert.deepEqual(value.hstack_startup.files, ["SKILL.md", "references/hstack.md"])
    mkdirSync(poteto)
    writeFileSync(join(poteto, "SKILL.md"), "x".repeat(20000))
    let run = offline(skill)
    assert.equal(run.status, 0, run.stderr)
    value = JSON.parse(run.stdout)
    assert.equal(value.hstack_startup.poteto_mode, "full")
    assert.equal(value.budgets.hstack_core_startup, "skipped_full_poteto")
    assert.ok(value.hstack_startup.estimated_tokens > value.budgets.hstack_core_startup_max_tokens)
    assert.equal(value.budgets.pass, true)

    const core = join(poteto, "poteto-core.md")
    writeFileSync(core, "Compact style guide.")
    run = offline(skill)
    assert.equal(run.status, 0, run.stderr)
    value = JSON.parse(run.stdout)
    assert.equal(value.hstack_startup.poteto_mode, "core")
    assert.deepEqual(value.hstack_startup.files, ["SKILL.md", "references/hstack.md", "../poteto-mode/poteto-core.md"])
    const context = value.hstack_startup.files.map((path) => readFileSync(join(skill, path), "utf8")).join("\n")
    assert.equal(value.hstack_startup.estimated_tokens, Math.ceil(context.length / 4))
    assert.equal(value.budgets.hstack_core_startup, "pass")

    appendFileSync(core, "x".repeat(20000))
    run = offline(skill)
    assert.equal(run.status, 1, run.stderr)
    value = JSON.parse(run.stdout)
    assert.equal(value.budgets.hstack_core_startup, "fail")
    assert.equal(value.budgets.pass, false)
  } finally { rmSync(dirname(skill), { recursive: true }) }
})

test("benchmark reports entrypoint and average route budget failures", () => {
  const skill = fixture()
  try {
    const entrypoint = join(skill, "SKILL.md")
    const original = readFileSync(entrypoint, "utf8")
    appendFileSync(entrypoint, "x".repeat(4 * 1850 + 1 - original.length))
    let run = offline(skill)
    assert.equal(run.status, 1, run.stderr)
    let value = JSON.parse(run.stdout)
    assert.equal(value.entrypoint.estimated_tokens, 1851)
    assert.equal(value.budgets.pass, false)

    writeFileSync(entrypoint, original)
    appendFileSync(join(skill, "references/runtimes-codex.md"), "x".repeat(20000))
    run = offline(skill)
    assert.equal(run.status, 1, run.stderr)
    value = JSON.parse(run.stdout)
    assert.ok(value.entrypoint.estimated_tokens <= value.budgets.entrypoint_max_tokens)
    assert.ok(value.average_route_estimated_tokens > value.budgets.average_route_max_tokens)
    assert.equal(value.budgets.pass, false)
  } finally { rmSync(dirname(skill), { recursive: true }) }
})

test("offline --write replaces the snapshot with results from the current benchmark", () => {
  const skill = fixture()
  try {
    const snapshot = join(skill, "benchmarks/latest.json")
    writeFileSync(snapshot, JSON.stringify({ version: "v4", live: { model: "stale/model" } }))
    const run = offline(skill, "--write")
    assert.equal(run.status, 0, run.stderr)
    assert.equal(readFileSync(snapshot, "utf8"), run.stdout)
    assert.equal(Object.hasOwn(JSON.parse(run.stdout), "live"), false)
  } finally { rmSync(dirname(skill), { recursive: true }) }
})
