#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { appendAttestation, appendRun, compareRecipes, readRuns } from "./evidence.mjs"

const stateDir = process.env.AW_STATE_DIR || join(homedir(), ".local", "state", "aw")
const command = process.argv[2]
const arg = (name) => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}
const requiredArg = (name) => {
  const value = arg(name)
  if (!value) throw new Error(`${name} is required`)
  return value
}
const booleanArg = (name) => {
  const value = requiredArg(name)
  if (value !== "true" && value !== "false") throw new Error(`${name} must be true or false`)
  return value === "true"
}
const average = (values) => {
  const finite = values.filter(Number.isFinite)
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null
}
const filteredRuns = (runs) => runs.filter((run) => (
  (!arg("--route") || run.route === arg("--route"))
  && (!arg("--profile") || run.prompt.profile_id === arg("--profile"))
))

try {
  if (command === "record") {
    const input = JSON.parse(readFileSync(requiredArg("--file"), "utf8"))
    process.stdout.write(`${JSON.stringify(appendRun(input, stateDir), null, 2)}\n`)
  } else if (command === "attest") {
    const attestation = appendAttestation({
      run_id: requiredArg("--run-id"),
      verify_id: requiredArg("--verify-id"),
      verify_exit_code: Number(requiredArg("--verify-exit-code")),
      semantic_success: booleanArg("--semantic-success"),
      scope_covered: Number(requiredArg("--scope-covered")),
      scope_total: Number(requiredArg("--scope-total")),
      review_pass: booleanArg("--review-pass"),
      forbidden_changes: Number(requiredArg("--forbidden-changes")),
      accepted_worker_actions: Number(requiredArg("--accepted-worker-actions")),
      parent_rework: Number(requiredArg("--parent-rework")),
    }, stateDir)
    process.stdout.write(`${JSON.stringify(attestation, null, 2)}\n`)
  } else if (command === "show") {
    const runID = requiredArg("--run-id")
    const run = readRuns(stateDir).filter((item) => item.run_id === runID).at(-1)
    if (!run) throw new Error(`run not found: ${runID}`)
    process.stdout.write(`${JSON.stringify(run, null, 2)}\n`)
  } else if (command === "latest") {
    const host = requiredArg("--host")
    const run = readRuns(stateDir).filter((item) => item.host === host).at(-1)
    if (!run) throw new Error(`no runs found for host: ${host}`)
    process.stdout.write(`${JSON.stringify(run, null, 2)}\n`)
  } else if (command === "waste") {
    const runs = filteredRuns(readRuns(stateDir))
    const groups = new Map()
    for (const run of runs) {
      for (const event of run.waste_events) {
        if (arg("--kind") && event.kind !== arg("--kind")) continue
        if (arg("--actor") && event.actor !== arg("--actor")) continue
        const key = [event.kind, event.actor, event.phase, run.prompt.profile_id].join("|")
        const group = groups.get(key) || {
          kind: event.kind,
          actor: event.actor,
          phase: event.phase,
          prompt_profile_id: run.prompt.profile_id,
          run_ids: new Set(),
          events: 0,
          observed_wasted_tokens: 0,
          estimated_wasted_tokens: 0,
          observed_token_events: 0,
          estimated_token_events: 0,
        }
        group.run_ids.add(run.run_id)
        group.events += 1
        if (Number.isFinite(event.observed_wasted_tokens)) {
          group.observed_wasted_tokens += event.observed_wasted_tokens
          group.observed_token_events += 1
        }
        if (Number.isFinite(event.estimated_wasted_tokens)) {
          group.estimated_wasted_tokens += event.estimated_wasted_tokens
          group.estimated_token_events += 1
        }
        groups.set(key, group)
      }
    }
    const result = [...groups.values()].map((group) => ({
      ...group,
      runs: group.run_ids.size,
      run_ids: undefined,
      observed_wasted_tokens: group.observed_token_events ? group.observed_wasted_tokens : null,
      estimated_wasted_tokens: group.estimated_token_events ? group.estimated_wasted_tokens : null,
    })).sort((left, right) => `${left.kind}|${left.actor}|${left.phase}|${left.prompt_profile_id}`
      .localeCompare(`${right.kind}|${right.actor}|${right.phase}|${right.prompt_profile_id}`))
    process.stdout.write(`${JSON.stringify({ schema_version: 4, runs: runs.length, groups: result }, null, 2)}\n`)
  } else if (command === "teacher") {
    const runs = filteredRuns(readRuns(stateDir)).filter((run) => run.teacher.length || run.actors.teacher.used)
    const asks = runs.flatMap((run) => run.teacher).filter((turn) => turn.response_type === "ASK")
    const finals = runs.flatMap((run) => run.teacher).filter((turn) => turn.response_type === "FINAL")
    const decisions = runs.flatMap((run) => run.teacher).filter((turn) => turn.decision_changed !== null)
    process.stdout.write(`${JSON.stringify({
      schema_version: 4,
      runs: runs.length,
      ask_count: asks.length,
      answer_rate: asks.length ? asks.filter((turn) => turn.evidence_received === true).length / asks.length : null,
      decision_change_rate: decisions.length ? decisions.filter((turn) => turn.decision_changed === true).length / decisions.length : null,
      actionable_final_rate: finals.length ? finals.filter((turn) => turn.actionable === true).length / finals.length : null,
      post_teacher_green_rate: finals.length ? finals.filter((turn) => turn.post_teacher_green === true).length / finals.length : null,
      repeated_requests: runs.reduce((sum, run) => sum + run.metrics.teacher_repeat_requests, 0),
      zero_information_turns: runs.reduce((sum, run) => sum + run.metrics.teacher_zero_information_turns, 0),
      main_repairs: runs.reduce((sum, run) => sum + run.metrics.teacher_main_repairs, 0),
      human_redirects: runs.reduce((sum, run) => sum + run.metrics.teacher_human_redirects, 0),
      average_asks_per_run: average(runs.map((run) => run.metrics.teacher_ask_count)),
    }, null, 2)}\n`)
  } else if (command === "analyze") {
    const result = compareRecipes(
      readRuns(stateDir),
      requiredArg("--baseline"),
      requiredArg("--candidate"),
      Number(arg("--min-pairs") || 5),
    )
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } else if (command === "summary") {
    const runs = readRuns(stateDir)
    process.stdout.write(`${JSON.stringify({
      schema_version: 4,
      runs: runs.length,
      eligible: runs.filter((run) => run.quality.eligible).length,
      waste_events: runs.reduce((sum, run) => sum + run.metrics.waste_event_count, 0),
      teacher_runs: runs.filter((run) => run.actors.teacher.used).length,
    }, null, 2)}\n`)
  } else {
    throw new Error("usage.mjs: use record, attest, show, latest, waste, teacher, analyze, or summary")
  }
} catch (error) {
  process.stderr.write(`usage.mjs: ${error.message}\n`)
  process.exitCode = 1
}
