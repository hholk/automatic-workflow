import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { handleHook } from "./aw-hook.mjs"
import { writeSelectionReceipt } from "../../scripts/selection-receipt.mjs"

test("Codex CLI records a run when the skill directory is a symlink", () => {
  const { stateDir, playbookPath } = fixture()
  try {
    const skillLink = join(stateDir, "skill")
    symlinkSync(new URL("../../", import.meta.url).pathname, skillLink, "dir")
    const script = join(skillLink, "integrations/lifecycle/aw-hook.mjs")
    for (const event of [
      { hook_event_name: "UserPromptSubmit", session_id: "native-symlink", prompt: "$aw private smoke prompt" },
      { hook_event_name: "Stop", session_id: "native-symlink", last_assistant_message: "private smoke output" },
    ]) {
      const result = spawnSync(process.execPath, [script, "--host", "codex"], {
        input: JSON.stringify(event),
        encoding: "utf8",
        env: { ...process.env, AW_STATE_DIR: stateDir, AW_PLAYBOOK_PATH: playbookPath },
      })
      assert.equal(result.status, 0, result.stderr)
      assert.equal(result.stdout.trim(), "{}")
    }
    const stored = readFileSync(join(stateDir, "runs.jsonl"), "utf8")
    const runs = stored.trim().split("\n").map(JSON.parse)
    assert.equal(runs.length, 1)
    assert.equal(runs[0].host, "codex")
    assert.equal(runs[0].route, "direct")
    assert.doesNotMatch(stored, /private smoke|native-symlink/)
  } finally {
    rmSync(stateDir, { recursive: true, force: true })
  }
})

const fixture = () => {
  const stateDir = mkdtempSync(join(tmpdir(), "aw-lifecycle-"))
  const playbookPath = join(stateDir, "playbook.json")
  writeFileSync(playbookPath, JSON.stringify({
    schema_version: 4,
    version: "weekly-v2",
    defaults: { recipe_id: "base-v1", prompt_profile_id: "codex-gpt6-luna-worker-v1", context_budget: 1600, worker_step_budget: 125, teacher_after_failed_hypotheses: 3 },
    cells: {},
  }))
  return { stateDir, playbookPath }
}

test("Codex lifecycle hooks record native models without reading transcripts or inventing tokens", () => {
  const { stateDir, playbookPath } = fixture()
  const options = { stateDir, playbookPath, primaryWorkerModel: "venice/openai-gpt-6-luna" }
  handleHook("codex", { hook_event_name: "UserPromptSubmit", session_id: "codex-session", model: "venice/openai-gpt-6-luna", prompt: "$aw fix it", timestamp: "2026-09-06T10:00:00Z" }, options)
  handleHook("codex", { hook_event_name: "PostToolUse", session_id: "codex-session", model: "venice/openai-gpt-6-luna", tool_name: "Read", tool_input: { file_path: "/skill/workflows/fix.md" } }, options)
  handleHook("codex", { hook_event_name: "SubagentStart", session_id: "codex-session", agent_id: "child", agent_type: "aw-worker", model: "venice/openai-gpt-6-luna", transcript_path: "/must/not/be/read" }, options)
  const result = handleHook("codex", { hook_event_name: "Stop", session_id: "codex-session", model: "venice/openai-gpt-6-luna", last_assistant_message: "must not be stored" }, options)

  assert.equal(result.run.route, "fix")
  assert.equal(result.run.schema_version, 4)
  assert.equal(result.run.prompt.profile_id, "unknown")
  assert.equal(result.run.recipe_id, "unknown")
  assert.equal(result.run.quality.policy_provenance_complete, false)
  assert.equal(result.run.timeline.length, 2)
  assert.equal(result.run.playbook_version, "weekly-v2")
  assert.equal(result.run.actors.worker.resolved_model, "venice/openai-gpt-6-luna")
  assert.equal(result.run.actors.worker.model_source, "native")
  assert.equal(result.run.tokens.operational_total, null)
  assert.equal(result.run.quality.eligible, false)
  const stored = readFileSync(join(stateDir, "runs.jsonl"), "utf8")
  assert.doesNotMatch(stored, /fix it|must\/not|must not be stored/)
})

test("Copilot lifecycle hooks record participation but keep undocumented model and token fields unknown", () => {
  const { stateDir, playbookPath } = fixture()
  const options = { stateDir, playbookPath }
  handleHook("github-copilot", { hook_event_name: "UserPromptSubmit", session_id: "copilot-session", prompt: "/aw implement", timestamp: "2026-09-06T11:00:00Z" }, options)
  handleHook("github-copilot", { hook_event_name: "SubagentStart", session_id: "copilot-session", agent_id: "child", agent_name: "aw-worker" }, options)
  handleHook("github-copilot", { hook_event_name: "ErrorOccurred", session_id: "copilot-session", error: "sensitive provider failure" }, options)
  const result = handleHook("github-copilot", { hook_event_name: "Stop", session_id: "copilot-session", transcript_path: "/private/transcript" }, options)

  assert.equal(result.run.actors.main.resolved_model, null)
  assert.equal(result.run.actors.worker.used, true)
  assert.equal(result.run.actors.worker.requested_model, null)
  assert.equal(result.run.actors.worker.resolved_model, null)
  assert.equal(result.run.actors.worker.model_source, "unknown")
  assert.equal(result.run.tokens.operational_total, null)
  assert.equal(result.run.friction.errors, 1)
  assert.equal(result.run.outcome, "BLOCKED_ENVIRONMENT")
  const stored = readFileSync(join(stateDir, "runs.jsonl"), "utf8")
  assert.doesNotMatch(stored, /sensitive provider failure|private\/transcript/)
})

test("ignores non-AW sessions", () => {
  const { stateDir, playbookPath } = fixture()
  const options = { stateDir, playbookPath }
  handleHook("codex", { hook_event_name: "UserPromptSubmit", session_id: "ordinary", model: "venice/mimo-2.6-flash", prompt: "normal task" }, options)
  const result = handleHook("codex", { hook_event_name: "Stop", session_id: "ordinary", model: "venice/mimo-2.6-flash" }, options)
  assert.equal(result.run, null)
})


test("lifecycle uses only an explicit receipt bound to its run and native profile host", () => {
  const { stateDir, playbookPath } = fixture()
  const options = { stateDir, playbookPath }
  try {
    const activation = handleHook("codex", { hook_event_name: "UserPromptSubmit", session_id: "explicit-receipt", prompt: "$aw fix" }, options)
    writeSelectionReceipt({ stateDir, runID: activation.run_id, selection: {
      role: "worker", route: "fix", task_class: "known-change", complexity: "small", model: "venice/openai-gpt-6-luna",
      profile_id: "codex-gpt6-luna-worker-v1", prompt_profile_id: "model-bound-v1", recipe_id: "lean-worker-v2",
      effective_policy: { playbook_version: "weekly-v2", capabilities: { profile_host: "codex" } },
    } })
    const { run } = handleHook("codex", { hook_event_name: "Stop", session_id: "explicit-receipt" }, options)
    assert.equal(run.recipe_id, "lean-worker-v2")
    assert.equal(run.prompt.profile_id, "model-bound-v1")
    assert.equal(run.task.class, "known-change")
    assert.equal(run.task.complexity, "small")
    assert.equal(run.quality.policy_provenance_complete, true)
    assert.equal(run.actors.worker.requested_model, "venice/openai-gpt-6-luna")
  } finally { rmSync(stateDir, { recursive: true, force: true }) }
})

test("resolver CLI carries stable fixture identity through Codex/T3 and Copilot lifecycle events", () => {
  for (const [provider, frontend] of [["codex", "t3"], ["github-copilot", "github-copilot"]]) {
    const { stateDir, playbookPath } = fixture()
    const options = { stateDir, playbookPath }
    try {
      const activation = handleHook(provider, { hook_event_name: "UserPromptSubmit", session_id: "fixture-session", prompt: "$aw fix" }, options)
      const selected = spawnSync(process.execPath, [new URL("../../scripts/resolve-profile.mjs", import.meta.url).pathname,
        "--host", frontend, ...(frontend === "t3" ? ["--provider-host", provider] : []), "--role", "worker", "--route", "fix",
        "--task-class", "known-change", "--complexity", "small", "--task-id", "fixture-a", "--snapshot-id", "fixture-rev-a",
        "--check-version", "fixture-check-v1", "--run-id", activation.run_id, "--playbook", playbookPath, "--prompt-profile-id", "model-bound-v1"], {
        env: { ...process.env, AW_STATE_DIR: stateDir, AW_RUN_ID: "" }, encoding: "utf8", timeout: 5000,
      })
      assert.equal(selected.status, 0, selected.stderr)
      const { run } = handleHook(provider, { hook_event_name: "Stop", session_id: "fixture-session" }, options)
      assert.equal(run.host, provider)
      assert.equal(run.frontend_host, frontend)
      assert.equal(run.provider_host, provider)
      assert.equal(run.task.id, "fixture-a")
      assert.equal(run.task.snapshot_id, "fixture-rev-a")
      assert.equal(run.task.check_version, "fixture-check-v1")
      assert.notEqual(run.run_id, run.task.id)
      assert.equal(run.quality.task_provenance_complete, true)
      assert.equal(run.actors.worker.resolved_model, null)
      assert.equal(run.quality.eligible, false)
    } finally { rmSync(stateDir, { recursive: true, force: true }) }
  }
})
