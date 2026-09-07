import { homedir } from "node:os"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { appendRun } from "../../scripts/evidence.mjs"
import { detectWaste } from "../../scripts/diagnostics.mjs"

const stateDir = process.env.AW_STATE_DIR || join(homedir(), ".local", "state", "aw")
const sessions = new Map()
const parentBySession = new Map()
const actionTools = new Set(["bash", "shell", "edit", "write", "apply_patch", "create"])
const defaultPlaybookPath = fileURLToPath(new URL("../../playbooks/current.json", import.meta.url))

const get = (sessionID) => {
  const state = sessions.get(sessionID) || { messages: new Map(), active: null }
  sessions.set(sessionID, state)
  return state
}
const rootFor = (sessionID) => {
  let current = sessionID
  const seen = new Set()
  while (current && !seen.has(current)) {
    seen.add(current)
    if (get(current).active) return current
    current = parentBySession.get(current)
  }
  return null
}
const descendsFrom = (sessionID, ancestorID) => {
  let current = parentBySession.get(sessionID)
  const seen = new Set()
  while (current && !seen.has(current)) {
    if (current === ancestorID) return true
    seen.add(current)
    current = parentBySession.get(current)
  }
  return false
}
const clearDescendants = (sessionID) => {
  for (const candidate of [...parentBySession.keys()]) {
    if (!descendsFrom(candidate, sessionID)) continue
    parentBySession.delete(candidate)
    sessions.delete(candidate)
  }
}
const loadPlaybook = () => {
  const playbook = JSON.parse(readFileSync(process.env.AW_PLAYBOOK_PATH || defaultPlaybookPath, "utf8"))
  if (playbook.schema_version !== 4 || !playbook.version || !playbook.defaults?.recipe_id || !playbook.defaults?.prompt_profile_id) {
    throw new Error("AW playbook must be schema v4 with version, recipe_id, and prompt_profile_id")
  }
  return playbook
}
const start = (sessionID) => {
  const state = get(sessionID)
  clearDescendants(sessionID)
  state.messages.clear()
  const activation = (state.activation || 0) + 1
  const playbook = loadPlaybook()
  state.activation = activation
  state.active = {
    runID: `opencode:${createHash("sha256").update(sessionID).digest("hex").slice(0, 20)}:${activation}`,
    startedAt: Date.now(),
    playbookVersion: playbook.version,
    recipeID: playbook.defaults.recipe_id,
    promptProfileID: playbook.defaults.prompt_profile_id,
    harnessVersion: process.env.OPENCODE_VERSION || null,
    childIDs: new Set(),
    routes: [],
    workerCalls: 0,
    teacherTurns: 0,
    errors: 0,
    mainActions: 0,
    workerActions: 0,
    primaryFailure: null,
    timeline: [],
    gauntlet: [],
    teacher: [],
    loadedFiles: new Set(),
    signatures: new Map(),
  }
}
const routeFromPath = (path = "") => path.match(/workflows\/(explore|diagnose|fix|implement|review)\.md$/)?.[1]
const messageTokens = (message) => (message.tokens?.input || 0) + (message.tokens?.output || 0) + (message.tokens?.reasoning || 0)
const sessionTokens = (sessionID) => [...get(sessionID).messages.values()].reduce((sum, message) => sum + message.tokens, 0)
const resolvedModels = (sessionIDs) => [...new Set(sessionIDs.flatMap((sessionID) => [...get(sessionID).messages.values()].map((message) => message.model).filter(Boolean)))]
const actor = (tokens, resolvedModel, requestedModel = resolvedModel, used = Boolean(resolvedModel || Number.isFinite(tokens)), fallbackReason = null) => ({
  used,
  requested_model: requestedModel || null,
  resolved_model: resolvedModel || null,
  fallback_reason: requestedModel && resolvedModel && requestedModel !== resolvedModel ? fallbackReason || "unapproved-runtime-mismatch" : null,
  model_source: resolvedModel ? "native" : "unknown",
  token_source: Number.isFinite(tokens) ? "native" : "unknown",
  tokens: Number.isFinite(tokens) ? tokens : null,
})
const classifyError = (event) => {
  const error = event.properties?.error || event.properties || {}
  const status = error.statusCode || error.status || error.httpStatus
  if (Number.isInteger(status)) return `provider-http-${status}`
  const code = typeof error.code === "string" ? error.code.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 48) : null
  return code ? `provider-${code}` : "unknown-provider-error"
}
const signature = (tool, args) => createHash("sha256").update(`${tool}\0${JSON.stringify(args || {})}`).digest("hex").slice(0, 20)
const componentFromPath = (path = "") => path.match(/(?:^|\/)((?:prompts|contracts|workflows|playbooks)\/[^\s]+)$/)?.[1] || null
const timelineEvent = (active, sessionID, rootID, event, values = {}) => {
  active.timeline.push({
    at_ms: Math.max(0, Date.now() - active.startedAt),
    actor: sessionID === rootID ? "main" : "worker",
    phase: active.routes.at(-1) || "unknown",
    event,
    duration_ms: null,
    input_tokens: null,
    output_tokens: null,
    tool_category: values.toolCategory || null,
    result_code: values.resultCode || null,
    signature: values.signature || null,
    revision: values.revision || null,
    changed: values.changed ?? null,
    information_gain: values.informationGain || null,
  })
}

export const AwUsagePlugin = async () => ({
  "tool.execute.before": async (input, output) => {
    const sessionID = input.sessionID
    if (!sessionID) return
    const args = output.args || {}
    if (input.tool === "skill" && args.name === "aw") start(sessionID)
    const rootID = rootFor(sessionID)
    if (!rootID) return
    const active = get(rootID).active
    const route = input.tool === "read" ? routeFromPath(args.filePath) : null
    if (route && active.routes.at(-1) !== route) active.routes.push(route)
    const component = input.tool === "read" ? componentFromPath(args.filePath) : null
    if (component) active.loadedFiles.add(component)
    if (input.tool === "task" || input.tool === "subagent") active.workerCalls += 1
    const teacherCall = (input.tool === "bash" || input.tool === "shell") && /\bcodex exec\b/.test(args.command || "")
    if (teacherCall) {
      active.teacherTurns += 1
      active.teacher.push({
        turn: active.teacherTurns,
        response_type: "UNKNOWN",
        question_type: null,
        ask_id: null,
        evidence_received: null,
        decision_changed: null,
        actionable: null,
        post_teacher_green: null,
        information_gain: null,
        main_repair: null,
      })
    }
    timelineEvent(active, sessionID, rootID, input.tool === "read" ? "read" : teacherCall ? "teacher_call" : "tool", {
      toolCategory: input.tool,
      signature: signature(input.tool, args),
      revision: args.revision,
      changed: args.changed,
    })
    if (actionTools.has(input.tool)) {
      if (sessionID === rootID) active.mainActions += 1
      else active.workerActions += 1
    }
  },
  "shell.env": async (input, output) => {
    const rootID = input.sessionID ? rootFor(input.sessionID) : null
    if (rootID) {
      const active = get(rootID).active
      output.env.AW_RUN_ID = active.runID
      output.env.AW_PLAYBOOK_VERSION = active.playbookVersion
      output.env.AW_RECIPE_ID = active.recipeID
    }
  },
  event: async ({ event }) => {
    if (event.type === "session.created") {
      const info = event.properties?.info
      if (info?.id && info.parentID) {
        sessions.delete(info.id)
        parentBySession.set(info.id, info.parentID)
        const rootID = rootFor(info.id)
        if (rootID) get(rootID).active.childIDs.add(info.id)
      }
      return
    }
    if (event.type === "message.updated") {
      const info = event.properties.info
      if (info?.role !== "assistant" || !info.sessionID || !info.tokens) return
      const model = info.providerID && info.modelID ? `${info.providerID}/${info.modelID}` : null
      const messageState = get(info.sessionID)
      const prior = messageState.messages.get(info.id)
      const tokens = messageTokens(info)
      messageState.messages.set(info.id, { tokens, model })
      const rootID = rootFor(info.sessionID)
      if (rootID && (!prior || prior.tokens !== tokens || prior.model !== model)) {
        const active = get(rootID).active
        active.timeline.push({
          at_ms: Math.max(0, Date.now() - active.startedAt),
          actor: info.sessionID === rootID ? "main" : "worker",
          phase: active.routes.at(-1) || "unknown",
          event: "message",
          duration_ms: null,
          input_tokens: info.tokens.input || 0,
          output_tokens: (info.tokens.output || 0) + (info.tokens.reasoning || 0),
          tool_category: null,
          result_code: null,
          signature: null,
          revision: null,
          changed: null,
          information_gain: null,
        })
      }
      return
    }
    const sessionID = event.properties?.sessionID
    if (!sessionID) return
    const rootID = rootFor(sessionID)
    if (!rootID) return
    const state = get(rootID)
    if (event.type === "session.error") {
      state.active.errors += 1
      state.active.primaryFailure ||= classifyError(event)
    }
    if (event.type !== "session.idle" || sessionID !== rootID) return
    const active = state.active
    const childIDs = [...active.childIDs]
    const mainModels = resolvedModels([rootID])
    const workerModels = resolvedModels(childIDs)
    const mainModel = mainModels.length === 1 ? mainModels[0] : mainModels.length > 1 ? `mixed:${mainModels.join(",")}` : null
    const workerModel = workerModels.length === 1 ? workerModels[0] : workerModels.length > 1 ? `mixed:${workerModels.join(",")}` : null
    const mainTokens = mainModels.length ? sessionTokens(rootID) : null
    const workerTokens = workerModels.length ? childIDs.reduce((sum, childID) => sum + sessionTokens(childID), 0) : null
    const route = active.routes.at(-1) || (active.teacherTurns ? "teacher" : active.workerCalls ? "unknown" : "direct")
    appendRun({
      schema_version: 4,
      kind: "run",
      run_id: active.runID,
      host: "opencode",
      harness_version: active.harnessVersion,
      route,
      task: { id: active.runID, class: route, complexity: "unknown" },
      recipe_id: active.recipeID,
      playbook_version: active.playbookVersion,
      prompt: {
        profile_id: active.promptProfileID,
        component_ids: [...active.loadedFiles],
        component_tokens: null,
        loaded_files: [...active.loadedFiles],
        duplicate_context_tokens: null,
      },
      actors: {
        main: actor(mainTokens, mainModel, mainModel, true),
        worker: actor(workerTokens, workerModel, "venice/z-ai-glm-5-3-flash", active.workerCalls > 0 || childIDs.length > 0, active.primaryFailure),
        teacher: active.teacherTurns ? actor(null, null, "gpt-5.6-sol", true) : actor(null, null),
      },
      quality: {
        verify_id: null,
        verify_exit_code: null,
        semantic_success: null,
        scope_covered: null,
        scope_total: null,
        review_pass: null,
        forbidden_changes: null,
      },
      work: {
        main_actions: active.mainActions,
        worker_actions: active.workerActions,
        accepted_worker_actions: null,
        parent_rework: null,
      },
      friction: {
        reroutes: Math.max(0, active.routes.length - 1),
        followups: Math.max(0, active.workerCalls - 1),
        teacher_turns: active.teacherTurns,
        errors: active.errors,
      },
      timeline: active.timeline,
      gauntlet: active.gauntlet,
      teacher: active.teacher,
      waste_events: detectWaste(active.timeline),
      outcome: active.errors ? "BLOCKED_ENVIRONMENT" : "PARTIAL_WITH_UNKNOWN",
      duration_ms: Date.now() - active.startedAt,
    }, stateDir)
    state.active = null
  },
})
