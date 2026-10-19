import { createHash } from "node:crypto"
import { assessTeacherInspection } from "./teacher-state.mjs"

export const teacherReadPolicy = Object.freeze({
  capability: "teacher-text-snapshot-v1",
  min_no_progress_attempts: 2,
  max_files: 8,
  max_snapshot_bytes: 65536,
  max_ttl_ms: 120000,
  max_read_bytes: 8192,
  max_total_bytes: 32768,
  max_operations: 8,
  max_hits: 20,
})

const contents = new WeakMap()
const scopeKeys = ["task_id", "objective_revision", "blocker_id", "state_id", "call_id"]
const text = (value) => typeof value === "string" && value.trim().length > 0
const sameScope = (left, right) => scopeKeys.every((key) => left?.[key] === right?.[key])
const digest = (value) => createHash("sha256").update(value).digest("hex")
const denied = (reason) => ({ ok: false, reason })
const bounded = (value, max) => Number.isSafeInteger(value) && value > 0 && value <= max

export const isTeacherSnapshotPath = (path) => {
  if (typeof path !== "string" || path.length > 240 || !/^[a-zA-Z0-9_./-]+$/.test(path)) return false
  const parts = path.split("/")
  if (parts.some((part) => !part || part.startsWith(".") ||
      /^(?:node_modules|vendor|sessions?|traces?|logs?|config|credentials?|secrets?)$/i.test(part))) return false
  if (parts.some((part) => /(?:^|[-_.])(?:env|auth|credentials?|secrets?|tokens?|passwords?|settings|config)(?:[-_.]|$)/i.test(part))) return false
  return /\.(?:md|txt|json|mjs|cjs|js|jsx|ts|tsx|py|toml|yaml|yml|go|rs|java|c|h|cpp|css|html|sh)$/.test(path)
}

// The host supplies reviewed text, never a filesystem handle or a path to open.
export const prepareTeacherSnapshot = (files) => {
  if (!Array.isArray(files) || !bounded(files.length, teacherReadPolicy.max_files)) throw new Error("INVALID_SNAPSHOT_FILES")
  const data = new Map()
  const names = new Set()
  let bytes = 0
  for (const file of files) {
    if (!file || !isTeacherSnapshotPath(file.path) || names.has(file.path.toLowerCase())) throw new Error("UNSAFE_SNAPSHOT_PATH")
    if (file.kind !== "regular" || file.symlink !== false || file.task_selected !== true ||
        file.secret_review !== "clear" || typeof file.text !== "string" || /\u0000/.test(file.text)) {
      throw new Error("UNREVIEWED_SNAPSHOT_FILE")
    }
    if (/-----BEGIN [^-]*PRIVATE KEY-----|(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[a-zA-Z0-9+/_=-]{8,}/i.test(file.text)) {
      throw new Error("SENSITIVE_SNAPSHOT_CONTENT")
    }
    names.add(file.path.toLowerCase())
    const buffer = Buffer.from(file.text, "utf8")
    bytes += buffer.length
    if (bytes > teacherReadPolicy.max_snapshot_bytes) throw new Error("SNAPSHOT_TOO_LARGE")
    data.set(file.path, buffer)
  }
  const manifest = [...data].sort(([a], [b]) => a.localeCompare(b)).map(([path, buffer]) =>
    Object.freeze({ path, bytes: buffer.length, sha256: digest(buffer) }))
  const snapshot = Object.freeze({ id: digest(JSON.stringify(manifest)), bytes, manifest: Object.freeze(manifest) })
  contents.set(snapshot, data)
  return snapshot
}

const utf8Slice = (buffer, start, maxBytes) => {
  if (start < buffer.length && (buffer[start] & 0xc0) === 0x80) return null
  let end = Math.min(buffer.length, start + maxBytes)
  while (end < buffer.length && end > start && (buffer[end] & 0xc0) === 0x80) end--
  return buffer.subarray(start, end).toString("utf8")
}

export const openTeacherReadSession = ({ request, scope, snapshot, grant, host, clock = Date.now }) => {
  const assessment = assessTeacherInspection(request)
  if (!assessment.eligible) return denied(assessment.reason)
  if (host?.capability !== teacherReadPolicy.capability ||
      ![host.consumeGrant, host.isGrantActive, host.revokeGrant].every((fn) => typeof fn === "function")) {
    return denied("UNSUPPORTED_HOST")
  }
  if (!scopeKeys.every((key) => text(scope?.[key])) ||
      !scopeKeys.slice(0, -1).every((key) => request[key] === scope[key]) || !contents.has(snapshot)) {
    return denied("INVALID_INSPECTION_SCOPE")
  }
  const now = clock()
  if (!Number.isSafeInteger(now)) return denied("INVALID_HOST_CLOCK")
  if (!grant || !sameScope(grant, scope) || grant.snapshot_id !== snapshot.id || !text(grant.id) ||
      !text(grant.approval_ref) || !Number.isSafeInteger(grant.issued_at) || grant.issued_at > now ||
      !Number.isSafeInteger(grant.expires_at) || grant.expires_at <= now ||
      !bounded(grant.expires_at - grant.issued_at, teacherReadPolicy.max_ttl_ms) ||
      !bounded(grant.max_bytes, teacherReadPolicy.max_total_bytes) ||
      !bounded(grant.max_operations, teacherReadPolicy.max_operations) ||
      !bounded(grant.max_hits, teacherReadPolicy.max_hits) ||
      !Array.isArray(grant.paths) || grant.paths.length !== snapshot.manifest.length ||
      new Set(grant.paths).size !== grant.paths.length ||
      !snapshot.manifest.every(({ path }) => grant.paths.includes(path)) ||
      !Array.isArray(grant.operations) || grant.operations.length !== 2 ||
      !["read", "search"].every((operation) => grant.operations.includes(operation))) {
    return denied("INVALID_HOST_GRANT")
  }
  const boundScope = Object.freeze(Object.fromEntries(scopeKeys.map((key) => [key, scope[key]])))
  const boundGrant = Object.freeze({ ...grant, paths: Object.freeze([...grant.paths]), operations: Object.freeze([...grant.operations]) })
  const context = Object.freeze({ grant: boundGrant, scope: boundScope, snapshot })
  try {
    if (host.consumeGrant(context) !== true) return denied("HOST_APPROVAL_REQUIRED")
  } catch {
    return denied("HOST_APPROVAL_REQUIRED")
  }
  let data = contents.get(snapshot)
  let closed = false
  let operations = 0
  let bytes = 0
  let hits = 0
  let closure
  const close = (reason = "ABORT") => {
    if (closed) return closure
    closed = true
    data = null
    try {
      if (host.revokeGrant({ ...context, reason }) !== true) return closure = denied("HOST_REVOCATION_UNCONFIRMED")
    } catch {
      return closure = denied("HOST_REVOCATION_UNCONFIRMED")
    }
    return closure = { ok: true, closed: true }
  }
  const stop = (reason) => {
    const result = close(reason)
    return { ...denied(reason), ...(!result.ok ? { revocation_error: result.reason } : {}) }
  }
  const handle = (input = {}) => {
    if (closed) return denied("INSPECTION_CLOSED")
    if (!input || typeof input !== "object" || Array.isArray(input)) return stop("INVALID_INSPECTION_OPERATION")
    const current = clock()
    if (!Number.isSafeInteger(current) || current < now || current >= boundGrant.expires_at) return stop("INSPECTION_EXPIRED")
    if (!sameScope(input.scope, boundScope)) return stop("INSPECTION_SCOPE_CHANGED")
    try {
      if (host.isGrantActive(context) !== true) return stop("HOST_GRANT_REVOKED")
    } catch { return stop("HOST_GRANT_REVOKED") }
    if (!["read", "search"].includes(input.operation)) return stop("FORBIDDEN_OPERATION")
    if (!isTeacherSnapshotPath(input.path) || !data.has(input.path)) return stop("PATH_OUTSIDE_SNAPSHOT")
    if (++operations > boundGrant.max_operations || bytes >= boundGrant.max_bytes) return stop("INSPECTION_BUDGET_EXHAUSTED")
    const limit = Math.min(teacherReadPolicy.max_read_bytes, boundGrant.max_bytes - bytes)
    const buffer = data.get(input.path)
    const source = Object.freeze({ snapshot_id: snapshot.id, path: input.path,
      sha256: snapshot.manifest.find(({ path }) => path === input.path).sha256 })
    if (input.operation === "read") {
      const offset = input.offset ?? 0
      const size = input.max_bytes ?? limit
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > buffer.length || !bounded(size, limit)) return stop("INVALID_READ_RANGE")
      const value = utf8Slice(buffer, offset, size)
      if (value === null || (value.length === 0 && offset < buffer.length)) return stop("INVALID_READ_RANGE")
      const count = Buffer.byteLength(value)
      bytes += count
      return { ok: true, text: value, bytes: count, next_offset: offset + count,
        eof: offset + count === buffer.length, source: { ...source, start_byte: offset, end_byte: offset + count } }
    }
    if (!text(input.query) || input.query.length > 200 || !bounded(input.max_hits ?? 5, teacherReadPolicy.max_hits)) return stop("INVALID_SEARCH")
    if (hits >= boundGrant.max_hits) return stop("INSPECTION_BUDGET_EXHAUSTED")
    const matches = []
    let count = 0
    let truncated = false
    let lineOffset = 0
    for (const [index, line] of buffer.toString("utf8").split("\n").entries()) {
      const start = lineOffset
      lineOffset += Buffer.byteLength(line) + 1
      if (!line.includes(input.query)) continue
      if (matches.length >= Math.min(input.max_hits ?? 5, boundGrant.max_hits - hits) || count >= limit) { truncated = true; break }
      const value = utf8Slice(Buffer.from(line, "utf8"), 0, limit - count)
      if (!value) { truncated = true; break }
      matches.push({ line: index + 1, text: value, start_byte: start, end_byte: start + Buffer.byteLength(value) })
      count += Buffer.byteLength(value)
      if (value.length < line.length) truncated = true
    }
    bytes += count
    hits += matches.length
    return { ok: true, matches, bytes: count, truncated, source }
  }
  return Object.freeze({ ok: true, handle, close })
}
