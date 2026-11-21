const accepted = (run) => {
  const q = run.quality
  return run.outcome === "VERIFIED" && q.attested && q.verify_exit_code === 0 &&
    q.semantic_success === true && q.scope_total > 0 && q.scope_covered === q.scope_total &&
    q.forbidden_changes === 0 && Boolean(q.verify_id) && q.routing_provenance_complete && q.participation_complete &&
    Object.values(run.actors).every((actor) => !actor.used ||
      (actor.requested_model && actor.resolved_model && ["native", "provider"].includes(actor.model_source)))
}

const outcomeKey = (run) => {
  if (accepted(run)) return "accepted"
  if (["FAILED_VERIFICATION", "FAILED"].includes(run.outcome) ||
    (run.quality.attested && run.quality.semantic_success === false)) return "failed"
  return "unknown"
}

const emptyOutcomes = () => ({ accepted: 0, failed: 0, unknown: 0 })
const emptyMetrics = () => ({ ...emptyOutcomes(), teacher_runs: 0, parent_rework: 0,
  parent_rework_observed_runs: 0, duration_ms: 0, duration_observed_runs: 0 })
const observeRun = (group, run) => {
  group[outcomeKey(run)]++
  group.teacher_runs += Number(run.actors.teacher.used)
  if (Number.isFinite(run.work.parent_rework)) {
    group.parent_rework += run.work.parent_rework
    group.parent_rework_observed_runs++
  }
  if (Number.isFinite(run.duration_ms)) {
    group.duration_ms += run.duration_ms
    group.duration_observed_runs++
  }
}
const summarizeMetrics = (group) => ({ ...group,
  parent_rework: group.parent_rework_observed_runs ? group.parent_rework : null,
  duration_ms: group.duration_observed_runs ? group.duration_ms : null })
const routeKey = (run) => [run.playbook_version, run.host, run.route, run.actors.worker.resolved_model || "unknown"].join("|")
const observationKey = (value) => value === true ? "yes" : value === false ? "no" : "unknown"

const evaluateTrial = (runs, trial) => {
  if (!trial) return null
  const summary = { id: trial.id, status: trial.status, target_cell: trial.target_cell ?? null,
    started_at: trial.started_at, observed_runs: 0, trial_run_limit: trial.trial_run_limit, ...emptyOutcomes() }
  const startedAt = Date.parse(trial.started_at)
  for (const run of runs) {
    if (run.playbook_version !== trial.playbook_version || !(Date.parse(run.at) >= startedAt)) continue
    const matches = trial.target_cell
      ? trial.target_cell === run.cell_id
      : trial.target_route === run.route || trial.target_route === routeKey(run)
    if (!matches) continue
    summary.observed_runs++
    summary[outcomeKey(run)]++
  }
  return { ...summary, decision_due: summary.observed_runs >= summary.trial_run_limit || summary.failed > 0 }
}

export const operatingReport = (records, cheapModels, options = {}) => {
  const unique = new Map()
  for (const run of records) unique.set(run.run_id, run)
  const runs = [...unique.values()]
  const cheap = new Set(cheapModels)
  const complete = runs.filter((run) => Object.values(run.actors).some((actor) => actor.used) &&
    Object.values(run.actors).every((actor) => !actor.used ||
      (Number.isFinite(actor.tokens) && ["native", "provider"].includes(actor.token_source) &&
        ["native", "provider"].includes(actor.model_source) && actor.resolved_model)))
  const modelTokens = new Map()
  for (const run of complete) {
    for (const actor of Object.values(run.actors).filter((item) => item.used)) {
      modelTokens.set(actor.resolved_model, (modelTokens.get(actor.resolved_model) || 0) + actor.tokens)
    }
  }
  const total = [...modelTokens.values()].reduce((sum, value) => sum + value, 0)
  const cheapTotal = [...modelTokens].reduce((sum, [model, value]) => sum + (cheap.has(model) ? value : 0), 0)
  const groups = new Map()
  const routes = new Map()
  const hints = new Map()
  for (const run of runs) {
    const key = `${run.playbook_version}|${run.cell_id}`
    const group = groups.get(key) || { playbook_version: run.playbook_version, cell_id: run.cell_id,
      run_ids: [], ...emptyMetrics() }
    group.run_ids.push(run.run_id)
    observeRun(group, run)
    groups.set(key, group)

    const route = routeKey(run)
    const rollup = routes.get(route) || { runs: 0, ...emptyMetrics() }
    rollup.runs++
    observeRun(rollup, run)
    routes.set(route, rollup)

    for (const { skill, first_pass, rework } of run.skill_hints || []) {
      const hint = hints.get(skill) || { skill, observations: 0, first_pass_yes: 0, first_pass_no: 0,
        first_pass_unknown: 0, rework_yes: 0, rework_no: 0, rework_unknown: 0 }
      hint.observations++
      hint[`first_pass_${observationKey(first_pass)}`]++
      hint[`rework_${observationKey(rework)}`]++
      hints.set(skill, hint)
    }
  }
  return {
    runs: runs.length,
    duplicate_records: records.length - runs.length,
    cheap_token_share: total > 0 ? cheapTotal / total : null,
    token_share_target: null,
    complete_usage_runs: complete.length,
    incomplete_usage_runs: runs.length - complete.length,
    observed_operational_tokens: complete.length ? total : null,
    model_tokens: Object.fromEntries(modelTokens),
    token_scope: "main, worker and teacher in complete-usage runs; separate research usage excluded",
    research_usage_observed_runs: runs.filter((run) => Number.isFinite(run.tokens.research_total)).length,
    observed_research_tokens: runs.some((run) => Number.isFinite(run.tokens.research_total))
      ? runs.reduce((sum, run) => sum + (run.tokens.research_total || 0), 0) : null,
    provider_cost: null,
    human_interventions: null,
    limitation: "Observational diagnostics, not causal improvement or quality parity; missing usage and attestations remain unknown.",
    groups: [...groups.values()].map(summarizeMetrics),
    route_rollups: Object.fromEntries([...routes].map(([key, group]) => [key, {
      ...summarizeMetrics(group), meets_min_runs: group.runs >= (options.minimumObservedRuns ?? 3),
    }])),
    skill_hints: [...hints.values()].sort((left, right) => left.skill.localeCompare(right.skill)),
    active_trial: evaluateTrial(runs, options.activeTrial),
  }
}
