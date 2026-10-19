import { createHash } from "node:crypto"
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readSync, realpathSync, writeSync } from "node:fs"
import { homedir } from "node:os"
import { join, resolve } from "node:path"

const defaultStateDir = () => process.env.AW_STATE_DIR || join(homedir(), ".local", "state", "aw")
const identifier = (value) => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,299}$/.test(value) && value !== "unknown"
const hosts = new Set(["codex", "opencode", "github-copilot"])
const routes = new Set(["explore", "diagnose", "fix", "implement", "review", "computer-use"])
const identityKeys = ["profile_host", "playbook_version", "recipe_id", "prompt_profile_id", "native_profile_id", "task_class", "complexity", "route", "requested_worker_model"]
const valid = (receipt) => receipt && receipt.schema_version === 1 && identifier(receipt.run_id) &&
  Number.isSafeInteger(receipt.at_ms) && receipt.at_ms >= 0 && hosts.has(receipt.profile_host) && routes.has(receipt.route) &&
  identityKeys.every((key) => identifier(receipt[key]))
const safeDirectory = (path, create) => {
  let stat = lstatSync(path, { throwIfNoEntry: false })
  if (!stat && create) {
    mkdirSync(path, { recursive: true })
    stat = lstatSync(path)
  }
  if (!stat || !stat.isDirectory() || stat.isSymbolicLink()) throw new Error("UNSAFE_RECEIPT_DIRECTORY")
  return realpathSync(path)
}
const receiptPath = (stateDir, runID, create = false) => {
  // The explicit state root is trusted. Reject symlinks at that root and in
  // every directory below it, then use its canonical path for the final open.
  const root = safeDirectory(resolve(stateDir), create)
  const directory = safeDirectory(join(root, "selections"), create)
  return join(directory, `${createHash("sha256").update(runID).digest("hex")}.jsonl`)
}

// This is local selection intent, never proof of a model's executed identity.
export const writeSelectionReceipt = ({ runID, selection, stateDir = defaultStateDir(), atMs = Date.now() }) => {
  const receipt = {
    schema_version: 1,
    run_id: runID,
    at_ms: atMs,
    profile_host: selection?.effective_policy?.capabilities?.profile_host,
    playbook_version: selection?.effective_policy?.playbook_version,
    recipe_id: selection?.recipe_id,
    prompt_profile_id: selection?.prompt_profile_id,
    native_profile_id: selection?.profile_id,
    task_class: selection?.task_class,
    complexity: selection?.complexity,
    route: selection?.route,
    requested_worker_model: selection?.model,
  }
  if (selection?.role !== "worker" || !valid(receipt)) throw new Error("INVALID_SELECTION_RECEIPT")
  const path = receiptPath(stateDir, runID, true)
  const buffer = Buffer.from(`${JSON.stringify(receipt)}\n`)
  const fd = openSync(path, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600)
  try {
    const stat = fstatSync(fd)
    if (!stat.isFile() || stat.nlink !== 1 || stat.size + buffer.length > 1024 * 1024) throw new Error("INVALID_RECEIPT_FILE")
    if (writeSync(fd, buffer) !== buffer.length) throw new Error("INCOMPLETE_RECEIPT_WRITE")
  } finally { closeSync(fd) }
  return receipt
}

export const readSelectionReceipt = ({ runID, profileHost, playbookVersion, startedAt, endedAt = Date.now(), stateDir = defaultStateDir() }) => {
  const unknown = (reason) => ({ complete: false, reason, receipt: null })
  if (!identifier(runID) || !hosts.has(profileHost) || !identifier(playbookVersion) ||
      !Number.isSafeInteger(startedAt) || !Number.isSafeInteger(endedAt) || startedAt < 0 || endedAt < startedAt) return unknown("INVALID_RECEIPT_SCOPE")
  let receipts
  let fd
  try {
    const path = receiptPath(stateDir, runID)
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
    const stat = fstatSync(fd)
    if (!stat.isFile() || stat.nlink !== 1) return unknown("INVALID_SELECTION_RECEIPT")
    const buffer = Buffer.alloc(1024 * 1024 + 1)
    let size = 0
    while (size < buffer.length) {
      const count = readSync(fd, buffer, size, buffer.length - size, null)
      if (!count) break
      size += count
    }
    if (size > 1024 * 1024) return unknown("SELECTION_RECEIPT_TOO_LARGE")
    receipts = buffer.subarray(0, size).toString("utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line))
  } catch (error) {
    return unknown(error.code === "ENOENT" ? "SELECTION_RECEIPT_MISSING" : "INVALID_SELECTION_RECEIPT")
  } finally {
    if (fd !== undefined) closeSync(fd)
  }
  if (!receipts.length || receipts.some((receipt) => !valid(receipt))) return unknown("INVALID_SELECTION_RECEIPT")
  if (receipts.some((receipt) => receipt.run_id !== runID || receipt.profile_host !== profileHost ||
      receipt.playbook_version !== playbookVersion || receipt.at_ms < startedAt || receipt.at_ms > endedAt)) return unknown("STALE_OR_FOREIGN_SELECTION_RECEIPT")
  const first = receipts[0]
  if (receipts.some((receipt) => identityKeys.some((key) => receipt[key] !== first[key]))) return unknown("MIXED_SELECTION_RECEIPTS")
  return { complete: true, reason: null, receipt: first }
}
