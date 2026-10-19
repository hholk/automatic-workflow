const nativeHosts = new Set(["codex", "opencode", "github-copilot"])
const identifier = (value) => typeof value === "string" &&
  /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,299}$/.test(value) && value !== "unknown"

export const resolveHostIdentity = ({ host, providerHost } = {}) => {
  if (host === "t3") {
    if (!["codex", "opencode"].includes(providerHost)) throw new Error("t3 requires providerHost codex or opencode")
  } else {
    if (!nativeHosts.has(host)) throw new Error(`unknown host: ${host}`)
    if (providerHost !== undefined && providerHost !== host) throw new Error("native host must match providerHost")
  }
  return { frontend_host: host, provider_host: host === "t3" ? providerHost : host }
}

export const hostCell = ({ host, providerHost, frontendHost } = {}) => {
  const identity = resolveHostIdentity({ host: frontendHost || host, providerHost })
  return identity.frontend_host === "t3" ? `t3>${identity.provider_host}` : identity.provider_host
}

// Explicit sanitized fixture identities, never inferred from prompts or sessions.
export const resolveTaskIdentity = ({ taskID, snapshotID, checkVersion } = {}) => {
  const values = [taskID, snapshotID, checkVersion]
  if (values.every((value) => value == null)) return { id: null, snapshot_id: null, check_version: null }
  if (!values.every(identifier)) throw new Error("task identity requires --task-id, --snapshot-id and --check-version as bounded opaque identifiers")
  return { id: taskID, snapshot_id: snapshotID, check_version: checkVersion }
}

export const taskComparisonKey = (task) => [task?.id, task?.snapshot_id, task?.check_version].every(identifier)
  ? JSON.stringify([task.id, task.snapshot_id, task.check_version]) : null
