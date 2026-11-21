import { readMission, writeMission, recoverMissionLock, exportMissionTsv } from "./mission-state.mjs"

try {
  const action = process.argv[2]
  if (process.argv.length !== 3 || !["read", "write", "recover-lock", "export-tsv"].includes(action)) throw new Error("ONE_MISSION_ACTION_REQUIRED")
  const chunks = []
  let size = 0
  for await (const chunk of process.stdin) {
    size += chunk.length
    if (size > 1024 * 1024) { process.stdin.destroy(); throw new Error("INPUT_TOO_LARGE") }
    chunks.push(chunk)
  }
  const input = JSON.parse(Buffer.concat(chunks).toString("utf8"))
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("OBJECT_INPUT_REQUIRED")
  let result
  if (action === "read") result = readMission(input)
  if (action === "recover-lock") result = recoverMissionLock(input)
  if (action === "export-tsv") result = exportMissionTsv(input)
  if (action === "write") {
    const { attestation_payload, ...state } = writeMission(input)
    result = { state, attestation_payload }
  }
  process.stdout.write(`${JSON.stringify({ allowed: true, ...result })}\n`)
} catch (error) {
  process.stdout.write(`${JSON.stringify({ allowed: false, reason: error.code || error.message })}\n`)
  process.exitCode = 1
}
