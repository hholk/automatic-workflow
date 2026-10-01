#!/usr/bin/env node
import { createHash } from "node:crypto"
import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { appendRun } from "../../scripts/evidence.mjs"

const modulePath = fileURLToPath(import.meta.url)
const defaultPlaybookPath = fileURLToPath(new URL("../../playbooks/current.json", import.meta.url))
const supportedHosts = new Set(["codex", "github-copilot"])
const actionTools = new Set(["bash", "shell", "edit", "write", "apply_patch", "create", "Bash", "Edit", "Write"])
const eventName = (event) => event.hook_event_name || event.hookEventName || event.eventName
const sessionID = (event) => event.session_id || event.sessionId
const timestamp = (event) => {
  const value = event.timestamp
  if (Number.isFinite(value)) return new Date(value).toISOString()
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString()
  return new Date().toISOString()
}
const promptOf = (event) => event.prompt || event.initial_prompt || event.initialPrompt || ""
const isAwPrompt = (event) => /(?:^|\s)(?:\$|\/)aw(?:\s|$)/i.test(promptOf(event))
const safeSession = (host, id) => createHash("sha256").update(`${host}\0${id}`).digest("hex")
const safeSignature = (event) => createHash("sha256")
  .update(`${event.tool_name || event.toolName || "tool"}\0${JSON.stringify(event.tool_input ?? event.toolInput ?? event.toolArgs ?? {})}`)
  .digest("hex")
  .slice(0, 20)
const hookDir = (stateDir) => join(stateDir, "hooks")
const hookPath = (stateDir, host, id) => join(hookDir(stateDir), `${safeSession(host, id)}.jsonl`)
const readLines = (path) => existsSync(path)
  ? readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)] } catch { return [] }
  })
  : []
const appendEvent = (path, item) => {
  mkdirSync(dirname(path), { recursive: true })
  appendFileSync(path, `${JSON.stringify(item)}\n`)
}
const routeFromEvent = (event) => {
  const serialized = JSON.stringify(event.tool_input ?? event.toolInput ?? event.toolArgs ?? "")
  return serialized.match(/workflows[\\/](explore|diagnose|fix|implement|review)\.md/)?.[1] || null
}
const cleanModel = (value) => typeof value === "string" && value.trim() ? value.trim() : null
const mixedModel = (values) => {
  const models = [...new Set(values.filter(Boolean))]
  return models.length === 1 ? models[0] : models.length > 1 ? `mixed:${models.join(",")}` : null
}
const actor = ({ used, requested, resolved, fallbackReason = null }) => ({
  used,
  requested_model: requested || null,
  resolved_model: resolved || null,
  fallback_reason: requested && resolved && requested !== resolved ? fallbackReason || "unapproved-runtime-mismatch" : null,
  model_source: resolved ? "native" : "unknown",
  token_source: "unknown",
  tokens: null,
})
const blankQuality = {
  verify_id: null,
  verify_exit_code: null,
  semantic_success: null,
  scope_covered: null,
  scope_total: null,
  review_pass: null,
  forbidden_changes: null,
}

export const handleHook = (host, event, options = {}) => {
  if (!supportedHosts.has(host)) throw new Error(`unsupported hook host: ${host}`)
  const id = sessionID(event)
  if (!id) return { run: null }
  const stateDir = options.stateDir || process.env.AW_STATE_DIR || join(homedir(), ".local", "state", "aw")
  const playbookPath = options.playbookPath || process.env.AW_PLAYBOOK_PATH || defaultPlaybookPath
  const primaryWorkerModel = options.primaryWorkerModel !== undefined
    ? options.primaryWorkerModel
    : process.env.AW_PRIMARY_WORKER_MODEL || (host === "codex" || host === "github-copilot"
      ? "venice/mimo-2.6-flash"
      : null)
  const path = hookPath(stateDir, host, id)
  const name = eventName(event)

  if ((name === "UserPromptSubmit" || name === "userPromptSubmitted" || name === "SessionStart" || name === "sessionStart") && isAwPrompt(event)) {
    const playbook = JSON.parse(readFileSync(playbookPath, "utf8"))
    if (playbook.schema_version !== 4 || !playbook.defaults?.prompt_profile_id) throw new Error("AW lifecycle adapter requires playbook v4")
    const at = timestamp(event)
    const runID = `${host}:${safeSession(host, id).slice(0, 20)}:${Date.parse(at)}`
    appendEvent(path, {
      type: "activate",
      at,
      run_id: runID,
      main_model: cleanModel(event.model),
      playbook_version: playbook.version,
      recipe_id: playbook.defaults?.recipe_id,
      prompt_profile_id: playbook.defaults?.prompt_profile_id,
      harness_version: options.harnessVersion || event.harness_version || event.harnessVersion || null,
    })
    return { run: null, run_id: runID }
  }

  const prior = readLines(path)
  const activation = prior.findLast((item) => item.type === "activate")
  if (!activation) return { run: null }

  if (name === "PostToolUse" || name === "postToolUse") {
    appendEvent(path, {
      type: "tool",
      at_ms: Math.max(0, Date.parse(timestamp(event)) - Date.parse(activation.at)),
      action: actionTools.has(event.tool_name || event.toolName) ? 1 : 0,
      route: routeFromEvent(event),
      tool_category: `${event.tool_name || event.toolName || "unknown"}`.toLowerCase(),
      signature: safeSignature(event),
    })
    return { run: null, run_id: activation.run_id }
  }
  if (name === "SubagentStart" || name === "subagentStart") {
    const model = cleanModel(event.model)
    const agent = `${event.agent_type || event.agentType || event.agent_name || event.agentName || ""}`
    appendEvent(path, {
      type: /teacher/i.test(agent) || /gpt-5\.6-sol$/.test(model || "") ? "teacher" : "worker",
      at_ms: Math.max(0, Date.parse(timestamp(event)) - Date.parse(activation.at)),
      model,
    })
    return { run: null, run_id: activation.run_id }
  }
  if (name === "ErrorOccurred" || name === "errorOccurred") {
    appendEvent(path, { type: "error", at_ms: Math.max(0, Date.parse(timestamp(event)) - Date.parse(activation.at)) })
    return { run: null, run_id: activation.run_id }
  }
  if (!["Stop", "agentStop", "SessionEnd", "sessionEnd"].includes(name)) return { run: null, run_id: activation.run_id }

  const events = readLines(path)
  const workers = events.filter((item) => item.type === "worker")
  const teachers = events.filter((item) => item.type === "teacher")
  const routes = events.map((item) => item.route).filter(Boolean)
  const mainModel = activation.main_model || cleanModel(event.model)
  const workerModel = mixedModel(workers.map((item) => item.model))
  const teacherModel = mixedModel(teachers.map((item) => item.model))
  const route = routes.at(-1) || (teachers.length ? "teacher" : workers.length ? "unknown" : "direct")
  const timeline = events.filter((item) => ["tool", "worker", "teacher", "error"].includes(item.type)).map((item) => ({
    at_ms: item.at_ms ?? null,
    actor: item.type === "worker" ? "worker" : item.type === "teacher" ? "teacher" : "main",
    phase: item.route || route,
    event: item.type === "tool" ? (item.tool_category === "read" ? "read" : "tool") : item.type,
    duration_ms: null,
    input_tokens: null,
    output_tokens: null,
    tool_category: item.tool_category || null,
    result_code: item.type === "error" ? "error" : null,
    signature: item.signature || null,
    revision: null,
    changed: null,
    information_gain: null,
  }))
  const loadedFiles = [...new Set(routes.map((item) => `workflows/${item}.md`))]
  const run = appendRun({
    schema_version: 4,
    kind: "run",
    run_id: activation.run_id,
    at: activation.at,
    host,
    harness_version: activation.harness_version,
    route,
    task: { id: activation.run_id, class: route, complexity: "unknown" },
    recipe_id: activation.recipe_id,
    playbook_version: activation.playbook_version,
    prompt: {
      profile_id: activation.prompt_profile_id,
      component_ids: loadedFiles,
      component_tokens: null,
      loaded_files: loadedFiles,
      duplicate_context_tokens: null,
    },
    actors: {
      main: actor({ used: true, requested: mainModel, resolved: mainModel }),
      worker: actor({ used: workers.length > 0, requested: primaryWorkerModel, resolved: workerModel }),
      teacher: actor({ used: teachers.length > 0, requested: teacherModel, resolved: teacherModel }),
    },
    quality: blankQuality,
    work: {
      main_actions: events.reduce((sum, item) => sum + (item.action || 0), 0),
      worker_actions: null,
      accepted_worker_actions: null,
      parent_rework: null,
    },
    friction: {
      reroutes: Math.max(0, new Set(routes).size - 1),
      followups: Math.max(0, workers.length - 1),
      teacher_turns: teachers.length,
      errors: events.filter((item) => item.type === "error").length,
    },
    timeline,
    gauntlet: [],
    teacher: teachers.map((item, index) => ({
      turn: index + 1,
      response_type: "UNKNOWN",
      question_type: null,
      ask_id: null,
      evidence_received: null,
      decision_changed: null,
      actionable: null,
      post_teacher_green: null,
      information_gain: null,
      main_repair: null,
    })),
    outcome: events.some((item) => item.type === "error") ? "BLOCKED_ENVIRONMENT" : "PARTIAL_WITH_UNKNOWN",
    duration_ms: Math.max(0, Date.parse(timestamp(event)) - Date.parse(activation.at)),
  }, stateDir)
  unlinkSync(path)
  writeFileSync(join(hookDir(stateDir), `last-run-${host}.json`), `${JSON.stringify({ run_id: run.run_id })}\n`)
  return { run, run_id: run.run_id }
}

const runCli = async () => {
  const hostIndex = process.argv.indexOf("--host")
  const host = hostIndex >= 0 ? process.argv[hostIndex + 1] : null
  if (!host) throw new Error("--host is required")
  const input = await new Promise((resolve, reject) => {
    let value = ""
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (chunk) => { value += chunk })
    process.stdin.on("end", () => {
      try { resolve(value.trim() ? JSON.parse(value) : {}) } catch (error) { reject(error) }
    })
    process.stdin.on("error", reject)
  })
  handleHook(host, input)
  process.stdout.write("{}\n")
}

if (process.argv[1] === modulePath) {
  runCli().catch((error) => {
    process.stderr.write(`aw-hook: ${error.message}\n`)
    process.exitCode = 1
  })
}
