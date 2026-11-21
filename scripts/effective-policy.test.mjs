import test from "node:test"
import assert from "node:assert/strict"
import { effectivePolicy, hostCapabilities } from "./effective-policy.mjs"
import { buildCellID } from "./evidence.mjs"

const defaults = { recipe_id: "bounded-v3", prompt_profile_id: "model-bound-v1", context_budget: 1600, worker_step_budget: 125, teacher_after_failed_hypotheses: 2 }
const playbook = { schema_version: 4, version: "test-v5", defaults, cells: {} }
const actor = (model) => ({ used: true, requested_model: model, resolved_model: model })
const input = { host: "opencode", route: "fix", taskClass: "bug", complexity: "small", actors: { main: actor("main"), worker: actor("worker"), teacher: { used: false } } }

test("selects one exact provenance cell before the host/task cell and defaults", () => {
  const cellID = buildCellID({ ...input, task: { class: "bug", complexity: "small" }, promptProfileID: defaults.prompt_profile_id })
  const book = { ...playbook, cells: { "opencode|bug|small": { context_budget: 800 }, [cellID]: { context_budget: 1000, worker_step_budget: 20, recipe_id: "base-v1" } } }
  const exact = effectivePolicy(input, { playbook: book })
  assert.equal(exact.context_budget, 1000)
  assert.equal(exact.worker_step_budget, 20)
  assert.equal(exact.recipe_id, "base-v1")
  assert.equal(exact.policy_cell_id, cellID)
  const coarse = effectivePolicy({ host: "opencode", taskClass: "bug", complexity: "small" }, { playbook: book })
  assert.equal(coarse.context_budget, 800)
  assert.equal(effectivePolicy({ host: "codex" }, { playbook: book }).context_budget, 1600)
  assert.deepEqual(playbook.defaults, defaults)
})

test("host capabilities fail closed and T3 requires an explicit provider delegate", () => {
  for (const host of ["codex", "opencode", "github-copilot"]) {
    assert.equal(hostCapabilities(host).teacher_text_snapshot, false)
    assert.equal(hostCapabilities(host).dispatch, "native-agent")
    assert.equal(hostCapabilities(host).model_availability, "unverified")
    assert.equal(hostCapabilities(host).dispatch_verified, false)
  }
  assert.equal(hostCapabilities("github-copilot").teacher, false)
  for (const providerHost of ["codex", "opencode"]) {
    const policy = effectivePolicy({ host: "t3", providerHost }, { playbook })
    assert.equal(policy.capabilities.profile_host, providerHost)
    assert.equal(policy.capabilities.dispatch, "provider-delegate")
    assert.equal(policy.capabilities.teacher_text_snapshot, false)
  }
  assert.throws(() => hostCapabilities("unknown"), /unknown host/)
  assert.throws(() => hostCapabilities("t3"), /requires providerHost/)
  assert.throws(() => hostCapabilities("t3", "github-copilot"), /requires providerHost/)
})

test("T3 provider cells never pool with each other or native host cells", () => {
  const book = { ...playbook, cells: { "t3>codex|bug|small": { context_budget: 700 },
    "t3>opencode|bug|small": { context_budget: 900 }, "opencode|bug|small": { context_budget: 1100 } } }
  const select = (host, providerHost) => effectivePolicy({ host, providerHost, taskClass: "bug", complexity: "small" }, { playbook: book })
  assert.equal(select("t3", "codex").context_budget, 700)
  assert.equal(select("t3", "opencode").context_budget, 900)
  assert.equal(select("opencode").context_budget, 1100)
  assert.throws(() => select("codex", "opencode"), /must match providerHost/)
})

test("rejects invalid policy values and cells that try to change capabilities", () => {
  assert.throws(() => effectivePolicy(input, { playbook: { ...playbook, defaults: { ...defaults, worker_step_budget: 0 } } }), /positive integer/)
  assert.throws(() => effectivePolicy(input, { playbook: { ...playbook, cells: { "opencode|bug|small": { teacher_text_snapshot: true } } } }), /unsupported policy cell field/)
  for (const [schema_version, version] of [[4, "test-v7"], [5, "test"], [6, "test"]]) {
    const invalid = { ...playbook, schema_version, version, defaults: { ...defaults, teacher_after_failed_hypotheses: 3 } }
    assert.throws(() => effectivePolicy(input, { playbook: invalid }), /fixed at two/)
  }
})

test("a cell can never tune the teacher threshold, including legacy schema 4", () => {
  assert.throws(() => effectivePolicy(input, { playbook: { ...playbook, cells: { "opencode|bug|small": { teacher_after_failed_hypotheses: 1 } } } }), /unsupported policy cell field: teacher_after_failed_hypotheses/)
})


test("matches canonical policy cells while retaining exact evidence cell identity", () => {
  const canonical = "opencode|bugfix|small"
  const exact = "opencode|bug|small"
  const canonicalModel = buildCellID({ ...input, task: { class: "bugfix", complexity: "small" }, promptProfileID: defaults.prompt_profile_id })
  const exactModel = buildCellID({ ...input, task: { class: "bug", complexity: "small" }, promptProfileID: defaults.prompt_profile_id })
  const book = { ...playbook, schema_version: 6, version: "test-v7", cells: {
    [canonical]: { context_budget: 700 },
    [exact]: { context_budget: 800 },
    [canonicalModel]: { context_budget: 900 },
    [exactModel]: { context_budget: 1000 },
  } }
  const select = (cells, overrides = {}) => effectivePolicy({ ...input, ...overrides }, { playbook: { ...book, cells } })
  assert.equal(select(book.cells).policy_cell_id, exactModel)
  const alias = select({ [canonicalModel]: book.cells[canonicalModel], [exact]: book.cells[exact] })
  assert.equal(alias.policy_cell_id, canonicalModel)
  assert.equal(alias.cell_id, exactModel)
  assert.equal(select(book.cells, { actors: undefined }).policy_cell_id, exact)
  const fallback = select({ [canonical]: book.cells[canonical] }, { actors: undefined })
  assert.equal(fallback.policy_cell_id, canonical)
  assert.equal(fallback.cell_id, exact)
  const custom = "opencode|Custom/Import|small"
  assert.equal(select({ [custom]: { context_budget: 500 } }, { taskClass: "Custom/Import" }).policy_cell_id, custom)
})
