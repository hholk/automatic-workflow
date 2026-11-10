const accepted = (run) => {
  const q = run.quality
  return run.outcome === "VERIFIED" && q.attested && q.verify_exit_code === 0 &&
    q.semantic_success === true && q.scope_total > 0 && q.scope_covered === q.scope_total &&
    q.forbidden_changes === 0 && Boolean(q.verify_id) && q.routing_provenance_complete && q.participation_complete &&
    Object.values(run.actors).every((actor) => !actor.used ||
      (actor.requested_model && actor.resolved_model && ["native", "provider"].includes(actor.model_source)))
}

export const operatingReport = (records, cheapModels) => {
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
  for (const run of runs) {
    const key = `${run.playbook_version}|${run.cell_id}`
    const group = groups.get(key) || { playbook_version: run.playbook_version, cell_id: run.cell_id,
      run_ids: [], accepted: 0, failed: 0, unknown: 0, teacher_runs: 0,
      parent_rework: 0, parent_rework_observed_runs: 0, duration_ms: 0, duration_observed_runs: 0 }
    group.run_ids.push(run.run_id)
    if (accepted(run)) group.accepted++
    else if (["FAILED_VERIFICATION", "FAILED"].includes(run.outcome) ||
      (run.quality.attested && run.quality.semantic_success === false)) group.failed++
    else group.unknown++
    group.teacher_runs += Number(run.actors.teacher.used)
    if (Number.isFinite(run.work.parent_rework)) {
      group.parent_rework += run.work.parent_rework
      group.parent_rework_observed_runs++
    }
    if (Number.isFinite(run.duration_ms)) {
      group.duration_ms += run.duration_ms
      group.duration_observed_runs++
    }
    groups.set(key, group)
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
    groups: [...groups.values()].map((group) => ({ ...group,
      parent_rework: group.parent_rework_observed_runs ? group.parent_rework : null,
      duration_ms: group.duration_observed_runs ? group.duration_ms : null })),
  }
}
