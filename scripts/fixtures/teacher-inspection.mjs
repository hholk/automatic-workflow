// Synthetic offline evidence only. This host is a test double, never a runtime adapter.
export const inspectionRequest = () => {
  const scope = { task_id: "task-7", objective_revision: "r2", blocker_id: "parser", state_id: "failing-check-3" }
  return {
    ...scope,
    unresolved: true,
    last_progress_sequence: 0,
    attempts: ["input encoding", "caller lifetime"].map((hypothesis, index) => ({
      ...scope,
      attempt_id: `attempt-${index + 1}`,
      sequence: index + 1,
      status: "completed",
      outcome: "no_progress",
      failure_kind: "technical",
      main_verified: true,
      hypothesis,
      action_ref: `probe-${index + 1}@immutable`,
      result_ref: `result-${index + 1}@immutable`,
      before_state: scope.state_id,
      after_state: scope.state_id,
    })),
    main_confirmation: { ...scope, attempt_ids: ["attempt-1", "attempt-2"], evidence_ref: "main-check@r2" },
  }
}

export const reviewedFile = (path = "src/parser.mjs", text = "export const answer = 42\n// answer is stable\n") => ({
  path, text, kind: "regular", symlink: false, task_selected: true, secret_review: "clear",
})

export const inspectionGrant = (snapshot, scope) => ({
  ...scope,
  id: "grant-7",
  approval_ref: "mock-host-receipt-7",
  snapshot_id: snapshot.id,
  issued_at: 1000,
  expires_at: 61000,
  max_bytes: 1024,
  max_operations: 4,
  max_hits: 3,
  operations: ["read", "search"],
  paths: snapshot.manifest.map(({ path }) => path),
})

export const mockSnapshotHost = (approvedGrant) => {
  let consumed = false
  let active = true
  return {
    capability: "teacher-text-snapshot-v1",
    consumeGrant: ({ grant }) => {
      if (consumed || JSON.stringify(grant) !== JSON.stringify(approvedGrant)) return false
      consumed = true
      return true
    },
    isGrantActive: () => active,
    revokeGrant: () => { active = false; return true },
  }
}
