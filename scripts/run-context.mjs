import { randomBytes } from "node:crypto"
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readSync, realpathSync, unlinkSync, writeSync } from "node:fs"
import { homedir } from "node:os"
import { join, resolve } from "node:path"

const maxAge = 4 * 60 * 60 * 1000
const defaultStateDir = () => process.env.AW_STATE_DIR || join(homedir(), ".local/state/aw")
const identifier = (value) => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,299}$/.test(value)
const tokenID = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
const directory = (stateDir, create) => {
  let path = resolve(stateDir)
  for (const part of [null, "run-contexts"]) {
    if (part) path = join(path, part)
    if (create && !lstatSync(path, { throwIfNoEntry: false })) mkdirSync(path, { recursive: true, mode: 0o700 })
    const stat = lstatSync(path)
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("UNSAFE_RUN_CONTEXT_DIRECTORY")
    path = realpathSync(path)
  }
  return path
}
const contextPath = (stateDir, token, create = false) => {
  if (!tokenID(token)) throw new Error("INVALID_RUN_CONTEXT_TOKEN")
  return join(directory(stateDir, create), `${token}.json`)
}
const fields = new Set(["schema_version", "token", "run_id", "provider_host", "playbook_version", "scope_ref", "issued_at", "expires_at"])
const valid = (value, token) => value?.schema_version === 1 && Object.keys(value).every((key) => fields.has(key)) && value.token === token && identifier(value.run_id) &&
  ["codex", "opencode"].includes(value.provider_host) && identifier(value.playbook_version) &&
  /^[a-f0-9]{64}$/.test(value.scope_ref || "") && Number.isSafeInteger(value.issued_at) && value.issued_at >= 0 &&
  value.expires_at === value.issued_at + maxAge

// This token correlates local hook events with a selection. It authenticates no
// user, reviewer, model, tool permission or provider capability.
export const createRunContext = ({ runID, profileHost, playbookVersion, scopeRef, stateDir = defaultStateDir(), now = Date.now() }) => {
  const token = randomBytes(32).toString("hex")
  const value = { schema_version: 1, token, run_id: runID, provider_host: profileHost,
    playbook_version: playbookVersion, scope_ref: scopeRef, issued_at: now, expires_at: now + maxAge }
  if (!valid(value, token)) throw new Error("INVALID_RUN_CONTEXT")
  const path = contextPath(stateDir, token, true)
  const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
  try {
    const buffer = Buffer.from(`${JSON.stringify(value)}\n`)
    if (writeSync(fd, buffer) !== buffer.length) throw new Error("INCOMPLETE_RUN_CONTEXT_WRITE")
  } finally { closeSync(fd) }
  return token
}

export const readRunContext = ({ token, profileHost, playbookVersion, stateDir = defaultStateDir(), now = Date.now() }) => {
  const path = contextPath(stateDir, token)
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const stat = fstatSync(fd)
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 4096) throw new Error("INVALID_RUN_CONTEXT_FILE")
    const buffer = Buffer.alloc(4097)
    let size = 0
    while (size < buffer.length) {
      const count = readSync(fd, buffer, size, buffer.length - size, null)
      if (!count) break
      size += count
    }
    if (size > 4096) throw new Error("INVALID_RUN_CONTEXT_FILE")
    const value = JSON.parse(buffer.subarray(0, size).toString("utf8"))
    if (!valid(value, token) || value.provider_host !== profileHost || value.playbook_version !== playbookVersion ||
        !Number.isSafeInteger(now) || now < value.issued_at || now >= value.expires_at) throw new Error("STALE_OR_FOREIGN_RUN_CONTEXT")
    return Object.freeze(value)
  } finally { closeSync(fd) }
}

export const closeRunContext = ({ token, stateDir = defaultStateDir() }) => {
  try { unlinkSync(contextPath(stateDir, token)) } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
}
