import test from "node:test"
import assert from "node:assert/strict"
import { authorizeLearningPromotion, evaluateLearningCandidate, learningIdentity, requireLearningReview, selectReviewedLessons } from "./learning-policy.mjs"

const fixture = () => {
  const baseline = { version: "baseline", defaults: { context_budget: 1600 } }
  const candidate = { version: "candidate", defaults: { context_budget: 1200 } }
  const runs = []
  const manifest = { schema_version: 1, id: "offline-v1" }
  for (const split of ["discovery", "holdout"]) {
    manifest[split] = { baseline_run_ids: [], candidate_run_ids: [] }
    for (const side of ["baseline", "candidate"]) {
      for (let index = 0; index < 5; index += 1) {
        const run_id = `${split}-${side}-${index}`
        manifest[split][`${side}_run_ids`].push(run_id)
        runs.push({ run_id, playbook_version: side, cell_id: "codex|known-change|small|profile:base",
          task: { id: `${split}-${index}`, snapshot_id: "fixture-rev-1", check_version: "fixture-check-v1" }, tokens: { operational_total: side === "baseline" ? 100 : 80 },
          quality: { eligible: true }, metrics: {} })
      }
    }
  }
  return { baseline, candidate, runs, manifest, proposer: "author" }
}
const approval = (packet) => ({ schema_version: 1, decision: "approve", approved_by: "independent-reviewer",
  approved_at: "2026-10-19T00:00:00Z", review_id: packet.review_id, identities: packet.identities })

test("reuses paired quality gates for discovery and disjoint holdout with exact review identity", () => {
  const input = fixture()
  const packet = evaluateLearningCandidate(input)
  assert.equal(packet.results.holdout.cells[0].matched_pairs, 5)
  assert.doesNotThrow(() => requireLearningReview(packet, approval(packet)))
  assert.equal(learningIdentity({ a: 1, b: 2 }), learningIdentity({ b: 2, a: 1 }))
  assert.throws(() => requireLearningReview(packet, { ...approval(packet), approved_by: "author" }), /independent reviewer/)
  assert.throws(() => requireLearningReview(packet, { ...approval(packet), decision: "pending" }), /independent reviewer/)
  assert.throws(() => requireLearningReview(packet, { ...approval(packet), review_id: "old" }), /does not match/)
  input.candidate.defaults.context_budget = 1100
  assert.throws(() => requireLearningReview(evaluateLearningCandidate(input), approval(packet)), /does not match/)
})

test("holdout rejects overlap, reused evidence, failures, missing pairs and unpaired records", () => {
  let input = fixture()
  input.runs.find((run) => run.run_id === "holdout-baseline-0").task.id = "discovery-0"
  assert.throws(() => evaluateLearningCandidate(input), /overlaps discovery/)
  input = fixture()
  input.manifest.holdout.baseline_run_ids[0] = input.manifest.discovery.baseline_run_ids[0]
  assert.throws(() => evaluateLearningCandidate(input), /reused/)
  input = fixture()
  input.runs.find((run) => run.run_id === "holdout-candidate-0").quality.eligible = false
  assert.throws(() => evaluateLearningCandidate(input), /holdout recomputed analysis verdict/)
  input = fixture()
  input.manifest.holdout.baseline_run_ids.pop()
  input.manifest.holdout.candidate_run_ids.pop()
  assert.throws(() => evaluateLearningCandidate(input), /insufficient-data/)
  input = fixture()
  input.manifest.holdout.baseline_run_ids.pop()
  assert.throws(() => evaluateLearningCandidate(input), /only matched pairs/)
  input = fixture()
  input.runs.find((run) => run.run_id === "holdout-candidate-0").tokens.operational_total = 200
  assert.throws(() => evaluateLearningCandidate(input), /holdout recomputed analysis verdict/)
})

test("promotion evaluation rejects changed snapshots, checks and legacy incomplete identities", () => {
  for (const changed of [{ snapshot_id: "other-revision" }, { check_version: "other-check" }, { snapshot_id: null }]) {
    const input = fixture()
    Object.assign(input.runs.find((run) => run.run_id === "discovery-candidate-0").task, changed)
    assert.throws(() => evaluateLearningCandidate(input), /only matched pairs|task identity is incomplete/)
  }
})

test("approval binds holdout evidence and cannot be replaced by a supplied verdict", () => {
  const input = fixture()
  const packet = evaluateLearningCandidate(input)
  input.runs.find((run) => run.run_id === "holdout-candidate-0").tokens.operational_total = 79
  assert.throws(() => requireLearningReview(evaluateLearningCandidate(input), approval(packet)), /does not match/)
  assert.throws(() => evaluateLearningCandidate({ ...fixture(), manifest: { ...input.manifest, verdict: "eligible-to-promote" } }), /supported structured fields/)
})

test("only an explicit synchronous trusted-host mock can authorize the exact packet", () => {
  const packet = evaluateLearningCandidate(fixture())
  const review = approval(packet)
  for (const host of [undefined, { capability: "aw-reviewed-promotion-v1", approved: true },
    { capability: "aw-reviewed-promotion-v1", verifyPromotion: "true" },
    { capability: "other", verifyPromotion: () => true },
    { capability: "aw-reviewed-promotion-v1", verifyPromotion: () => false },
    { capability: "aw-reviewed-promotion-v1", verifyPromotion: () => Promise.resolve(true) },
    { capability: "aw-reviewed-promotion-v1", verifyPromotion: () => { throw new Error("untrusted") } }]) {
    assert.throws(() => authorizeLearningPromotion(packet, review, host), /REVIEW_REQUIRED/)
  }
  // This mock represents the host's external review boundary only. It performs
  // no production approval and writes no playbook or installed skill.
  const trustedHostMock = { capability: "aw-reviewed-promotion-v1", verifyPromotion: (exactPacket, exactReview) => {
    assert.ok(Object.isFrozen(exactPacket.identities))
    assert.ok(Object.isFrozen(exactReview))
    return learningIdentity(exactPacket) === learningIdentity(packet) && learningIdentity(exactReview) === learningIdentity(review)
  } }
  assert.deepEqual(authorizeLearningPromotion(packet, review, trustedHostMock), {
    authorized: true, review_id: packet.review_id, capability: "aw-reviewed-promotion-v1",
  })
  assert.throws(() => authorizeLearningPromotion(packet, { ...review, approved_by: packet.proposer }, trustedHostMock), /independent reviewer/)
  const changed = evaluateLearningCandidate({ ...fixture(), candidate: { version: "candidate", defaults: { context_budget: 900 } } })
  assert.throws(() => authorizeLearningPromotion(changed, approval(changed), trustedHostMock), /REVIEW_REQUIRED/)
})

const lessonFixture = () => ({ id: "known-script-scope", project_id: "project-a", project_versions: ["rev-a"],
  policy_versions: ["acceptance-routing-v5"], prerequisites: { runner: "node:test", fixture_only: true },
  instruction: "Run the affected offline test file before the complete suite.", author: "author",
  review: { decision: "approve", reviewed_by: "reviewer", reviewed_at: "2026-10-18T00:00:00Z" }, expires_at: "2026-11-18T00:00:00Z" })
const context = { project_id: "project-a", project_version: "rev-a", policy_version: "acceptance-routing-v5",
  prerequisites: { runner: "node:test", fixture_only: true } }
const now = new Date("2026-10-19T00:00:00Z")

test("lessons require reviewed exact project/version scope, all prerequisites and unexpired review", () => {
  const lesson = lessonFixture()
  assert.deepEqual(selectReviewedLessons([lesson], context, now).map((entry) => entry.id), [lesson.id])
  for (const mismatch of [{ project_id: "project-b" }, { project_version: "rev-b" }, { policy_version: "new-policy" }, { prerequisites: {} }]) {
    assert.deepEqual(selectReviewedLessons([lesson], { ...context, ...mismatch }, now), [])
  }
  assert.deepEqual(selectReviewedLessons([lesson], context, new Date("2026-12-01T00:00:00Z")), [])
  assert.throws(() => selectReviewedLessons([{ ...lesson, review: { ...lesson.review, reviewed_by: lesson.author } }], context, now), /independent dated review/)
  assert.throws(() => selectReviewedLessons([{ ...lesson, session: "private transcript" }], context, now), /structured fields/)
  assert.throws(() => selectReviewedLessons([{ ...lesson, instruction: "api_key=secret" }], context, now), /potential secret/)
  assert.throws(() => selectReviewedLessons([lesson], { ...context, project_version: undefined }, now), /explicit project/)
})
