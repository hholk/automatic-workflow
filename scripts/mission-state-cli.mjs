import { readMission, writeMission, recoverMissionLock } from "./mission-state.mjs"

try {
  if (process.argv.length !== 3 || !["read", "write", "recover-lock"].includes(process.argv[2])) throw new Error("ONE_MISSION_ACTION_REQUIRED")
  const chunks = []
  let size = 0
  for await (const chunk of process.stdin) {
    size += chunk.length
    if (size > 1024 * 1024) { process.stdin.destroy(); throw new Error("INPUT_TOO_LARGE") }
    chunks.push(chunk)
  }
  const input = JSON.parse(Buffer.concat(chunks).toString("utf8"))
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("OBJECT_INPUT_REQUIRED")
  const result = process.argv[2] === "read" ? readMission(input) : process.argv[2] === "recover-lock" ? recoverMissionLock(input) : { state: writeMission(input) }
  process.stdout.write(`${JSON.stringify({ allowed: true, ...result })}\n`)
} catch (error) {
  process.stdout.write(`${JSON.stringify({ allowed: false, reason: error.code || error.message })}\n`)
  process.exitCode = 1
}
