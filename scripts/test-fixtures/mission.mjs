import { contractDigest } from "../execution-state.mjs"

export const fixture = () => {
  const scope = { task_id: "save-title", objective_revision: "1", snapshot_id: "tree-1" }
  const verify = { check_id: "save", check_version: "1", command: "node --test save.test.mjs", expected: "The title survives reload" }
  const brief = { version: 2, ...scope, assurance: "reviewed", objective: "Save and reload a title",
    sources: [{ id: "request", kind: "request", text: "Save the title and preserve it after reload.", source_ref: "user:1" }],
    requirements: [{ id: "persist", claim: "The title survives reload", source_ids: ["request"], criterion_ids: [1] }],
    success: [{ id: 1, claim: "The saved title is visible after reload", verify }] }
  const observed = { command: verify.command, exit_code: 0, result: "passed", result_ref: "output:behavior" }
  const review = { version: 1, ...scope, contract_digest: contractDigest(brief), fresh_context: true,
    reviewer_id: "contract-reviewer", inputs: "request-and-criteria", source_ids: ["request"], status: "passed", gaps: [],
    report_ref: "report:contract", requirement_ids: ["persist"], checks: [{ criterion_id: 1, status: "adequate", counterexample_ref: "report:contract:fake-save" }] }
  const completion = { ...review, reviewer_id: "product-reviewer", inputs: "request-and-artifact", report_ref: "report:product",
    coverage_ref: "report:product:request-map", verify: observed }
  const evidence = { version: 1, ...scope, criterion_id: 1, check_id: verify.check_id, check_version: verify.check_version,
    evidence_ref: "output:worker", status: "passed", verify: observed }
  const confirmation = { version: 1, ...scope, actor: "main", integrated: true, status: "passed", criterion_ids: [1],
    evidence_ref: "output:integration", evidence_refs: [evidence.evidence_ref], verify: observed }
  return { brief, review, completion, evidence, confirmation,
    acceptance: { brief, contract_review: review, completion_review: completion, evidence: [evidence], main_confirmation: confirmation, builder_ids: ["builder"] } }
}
