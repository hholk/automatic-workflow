import test from "node:test"
import assert from "node:assert/strict"
import { openTeacherReadSession, prepareTeacherSnapshot, isTeacherSnapshotPath, teacherReadPolicy } from "./teacher-read-policy.mjs"
import { inspectionRequest, reviewedFile, inspectionGrant, mockSnapshotHost } from "./fixtures/teacher-inspection.mjs"
import { acceptTeacherReply } from "./teacher-state.mjs"

const setup = (files = [reviewedFile()]) => {
  const request = inspectionRequest()
  const scope = Object.fromEntries(["task_id", "objective_revision", "blocker_id", "state_id"].map((key) => [key, request[key]]))
  scope.call_id = "teacher-call-4"
  const snapshot = prepareTeacherSnapshot(files)
  const grant = inspectionGrant(snapshot, scope)
  const host = mockSnapshotHost(grant)
  let now = 1000
  const input = { request, scope, snapshot, grant, host, clock: () => now }
  return { ...input, advance: (value) => { now = value }, open: () => openTeacherReadSession(input) }
}

test("snapshot inspection is unsupported without a real host bridge and approval", () => {
  const f = setup()
  assert.deepEqual(openTeacherReadSession({ ...f, host: undefined }), { ok: false, reason: "UNSUPPORTED_HOST" })
  assert.equal(openTeacherReadSession({ ...f, host: { capability: teacherReadPolicy.capability, approved: true } }).reason, "UNSUPPORTED_HOST")
  const deniedHost = { ...f.host, consumeGrant: () => false }
  assert.equal(openTeacherReadSession({ ...f, host: deniedHost }).reason, "HOST_APPROVAL_REQUIRED")
  f.request.attempts.pop()
  assert.equal(f.open().reason, "TWO_NO_PROGRESS_ATTEMPTS_REQUIRED")
})

test("snapshot content is immutable, exact-path scoped and grants are single use", () => {
  const file = reviewedFile()
  const f = setup([file])
  file.text = "mutated after snapshot"
  const session = f.open()
  assert.equal(session.ok, true)
  assert.equal(f.open().reason, "HOST_APPROVAL_REQUIRED")
  assert.deepEqual(session.handle({ scope: f.scope, operation: "read", path: file.path, max_bytes: 6 }), {
    ok: true, text: "export", bytes: 6, next_offset: 6, eof: false,
    source: { snapshot_id: f.snapshot.id, path: file.path, sha256: f.snapshot.manifest[0].sha256, start_byte: 0, end_byte: 6 },
  })
  const result = session.handle({ scope: f.scope, operation: "search", path: file.path, query: "answer", max_hits: 2 })
  assert.deepEqual(result.matches, [
    { line: 1, text: "export const answer = 42", start_byte: 0, end_byte: 24 },
    { line: 2, text: "// answer is stable", start_byte: 25, end_byte: 44 },
  ])
  assert.equal(result.source.snapshot_id, f.snapshot.id)
  assert.equal(result.source.sha256, f.snapshot.manifest[0].sha256)
  assert.equal(result.truncated, false)
})

test("rejects traversal, absolute paths, hidden data, credentials, foreign trees and special files", () => {
  for (const path of ["../src/a.js", "/src/a.js", "src/../a.js", "src//a.js", "src\\a.js", "C:/a.js",
    "src/%2e%2e/a.js", ".git/config", ".env", "src/.env.production", "secrets/key.txt", "credentials.json",
    "config/settings.json", "logs/result.txt", "node_modules/lib/a.js", "src/key.pem", "src/a.js\n"]) {
    assert.equal(isTeacherSnapshotPath(path), false, path)
    assert.throws(() => prepareTeacherSnapshot([reviewedFile(path)]), /UNSAFE_SNAPSHOT_PATH/)
  }
  for (const patch of [{ symlink: true }, { kind: "fifo" }, { kind: "directory" },
    { task_selected: false }, { secret_review: "unknown" }]) {
    assert.throws(() => prepareTeacherSnapshot([{ ...reviewedFile(), ...patch }]), /UNREVIEWED_SNAPSHOT_FILE/)
  }
  assert.throws(() => prepareTeacherSnapshot([reviewedFile(), reviewedFile("src/PARSER.mjs")]), /UNSAFE_SNAPSHOT_PATH/)
  assert.throws(() => prepareTeacherSnapshot([reviewedFile("src/a.js", "api_key = 'synthetic000000'")]), /SENSITIVE_SNAPSHOT_CONTENT/)
  assert.throws(() => prepareTeacherSnapshot([reviewedFile("src/a.js", "a".repeat(65537))]), /SNAPSHOT_TOO_LARGE/)
})

test("grant binds exact task, revision, blocker, state, call and snapshot", () => {
  for (const field of ["task_id", "objective_revision", "blocker_id", "state_id", "call_id", "snapshot_id"]) {
    const f = setup()
    f.grant[field] = "other"
    assert.equal(f.open().reason, "INVALID_HOST_GRANT", field)
  }
  const f = setup()
  f.grant.paths.push("src/other.js")
  assert.equal(f.open().reason, "INVALID_HOST_GRANT")
})

test("TTL, byte, operation and hit limits cannot be expanded by request or grant", () => {
  for (const patch of [{ max_bytes: 32769 }, { max_operations: 9 }, { max_hits: 21 },
    { expires_at: 121001 }, { issued_at: 1001 }, { expires_at: 1000 }, { operations: ["read", "exec"] }]) {
    const f = setup()
    Object.assign(f.grant, patch)
    assert.equal(f.open().reason, "INVALID_HOST_GRANT", JSON.stringify(patch))
  }
  const f = setup()
  f.grant.max_bytes = 6
  f.host = mockSnapshotHost(f.grant)
  const session = openTeacherReadSession(f)
  assert.equal(session.handle({ scope: f.scope, operation: "read", path: "src/parser.mjs", max_bytes: 6 }).text, "export")
  assert.equal(session.handle({ scope: f.scope, operation: "read", path: "src/parser.mjs" }).reason, "INSPECTION_BUDGET_EXHAUSTED")
})

test("expiry, scope changes, FINAL, abort, errors and revocation end all reads", () => {
  for (const terminal of ["FINAL", "ABORT", "ERROR"]) {
    const f = setup(); const session = f.open()
    assert.equal(session.close(terminal).ok, true)
    assert.equal(session.handle({ scope: f.scope, operation: "read", path: "src/parser.mjs" }).reason, "INSPECTION_CLOSED")
  }
  const expired = setup(); const session = expired.open(); expired.advance(61000)
  assert.equal(session.handle({ scope: expired.scope, operation: "read", path: "src/parser.mjs" }).reason, "INSPECTION_EXPIRED")
  const changed = setup(); const other = changed.open()
  assert.equal(other.handle({ scope: { ...changed.scope, call_id: "new-call" }, operation: "read", path: "src/parser.mjs" }).reason, "INSPECTION_SCOPE_CHANGED")
  const revoked = setup(); const third = revoked.open(); revoked.host.revokeGrant()
  assert.equal(third.handle({ scope: revoked.scope, operation: "read", path: "src/parser.mjs" }).reason, "HOST_GRANT_REVOKED")
  const failing = setup(); failing.host.revokeGrant = () => false; const fourth = failing.open()
  assert.equal(fourth.close("FINAL").reason, "HOST_REVOCATION_UNCONFIRMED")
  assert.equal(fourth.close("FINAL").reason, "HOST_REVOCATION_UNCONFIRMED")
  assert.equal(fourth.handle({}).reason, "INSPECTION_CLOSED")
})

test("teacher terminal decisions close the optional inspection session before handback", () => {
  for (const [state, reply, expected] of [
    [{}, { type: "FINAL" }, "FINAL"],
    [{}, { type: "HUMAN_QUESTION" }, "HUMAN_REQUIRED"],
    [{ asks: 5 }, { type: "ASK" }, "TEACHER_EXHAUSTED"],
    [{ asks: 1, informationGain: false }, { type: "ASK" }, null],
  ]) {
    const f = setup(); const session = f.open()
    const result = acceptTeacherReply(state, reply, { maxAsks: 5, maxTurnsPerAsk: 7 }, session)
    assert.equal(result.terminal, expected)
    assert.equal(session.handle({ scope: f.scope, operation: "read", path: "src/parser.mjs" }).reason, "INSPECTION_CLOSED")
  }
})

test("operation and cumulative search-hit ceilings stop further access", () => {
  const f = setup(); f.grant.max_operations = 1
  const session = f.open()
  assert.equal(session.handle({ scope: f.scope, operation: "read", path: "src/parser.mjs" }).ok, true)
  assert.equal(session.handle({ scope: f.scope, operation: "read", path: "src/parser.mjs" }).reason, "INSPECTION_BUDGET_EXHAUSTED")
  const g = setup(); g.grant.max_hits = 1; const search = g.open()
  const first = search.handle({ scope: g.scope, operation: "search", path: "src/parser.mjs", query: "answer" })
  assert.equal(first.matches.length, 1)
  assert.equal(first.truncated, true)
  assert.equal(search.handle({ scope: g.scope, operation: "search", path: "src/parser.mjs", query: "answer" }).reason, "INSPECTION_BUDGET_EXHAUSTED")
})

test("write, exec, shell, network, delegation and out-of-snapshot reads revoke the session", () => {
  for (const operation of ["write", "exec", "shell", "network", "delegate"]) {
    const f = setup(); const session = f.open()
    assert.equal(session.handle({ scope: f.scope, operation, path: "src/parser.mjs" }).reason, "FORBIDDEN_OPERATION")
    assert.equal(session.handle({ scope: f.scope, operation: "read", path: "src/parser.mjs" }).reason, "INSPECTION_CLOSED")
  }
  const f = setup(); const session = f.open()
  assert.equal(session.handle({ scope: f.scope, operation: "read", path: "src/unselected.js" }).reason, "PATH_OUTSIDE_SNAPSHOT")
  const malformed = setup(); const other = malformed.open()
  assert.equal(other.handle(null).reason, "INVALID_INSPECTION_OPERATION")
  assert.equal(other.handle({}).reason, "INSPECTION_CLOSED")
})

test("UTF-8 slices preserve byte budgets and reject continuation-byte offsets", () => {
  const f = setup([reviewedFile("src/a.txt", "Ä🙂x")]); const session = f.open()
  assert.deepEqual(session.handle({ scope: f.scope, operation: "read", path: "src/a.txt", max_bytes: 5 }), {
    ok: true, text: "Ä", bytes: 2, next_offset: 2, eof: false,
    source: { snapshot_id: f.snapshot.id, path: "src/a.txt", sha256: f.snapshot.manifest[0].sha256, start_byte: 0, end_byte: 2 },
  })
  assert.equal(session.handle({ scope: f.scope, operation: "read", path: "src/a.txt", offset: 3 }).reason, "INVALID_READ_RANGE")
})

test("malformed teacher counters and limits fail closed and revoke inspection", () => {
  for (const [state, limits] of [
    [{ asks: -1, turns: -100 }, { maxAsks: 5, maxTurnsPerAsk: 7 }],
    [{ asks: "1" }, { maxAsks: 5, maxTurnsPerAsk: 7 }],
    [{ turns: NaN }, { maxAsks: 5, maxTurnsPerAsk: 7 }],
    [{}, { maxAsks: NaN, maxTurnsPerAsk: 7 }],
    [{}, { maxAsks: 6, maxTurnsPerAsk: 7 }],
    [{}, { maxAsks: 5, maxTurnsPerAsk: 8 }],
  ]) {
    const f = setup(); const session = f.open()
    assert.equal(acceptTeacherReply(state, { type: "ASK" }, limits, session).reason, "INVALID_TEACHER_STATE_OR_LIMITS")
    assert.equal(session.handle({ scope: f.scope, operation: "read", path: "src/parser.mjs" }).reason, "INSPECTION_CLOSED")
  }
})
