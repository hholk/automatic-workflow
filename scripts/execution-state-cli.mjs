import {
  validateTaskBrief, assessAcceptance, assessEvidenceReuse, routeMilestone,
  assessRecovery, resolveAuthority, assessDispatch,
} from "./execution-state.mjs"

const actions = new Map([
  ["brief", validateTaskBrief], ["acceptance", assessAcceptance],
  ["reuse", assessEvidenceReuse], ["route", routeMilestone],
  ["recovery", assessRecovery], ["authority", resolveAuthority],
  ["dispatch", assessDispatch],
])
const respond = (result) => {
  process.stdout.write(`${JSON.stringify(result)}\n`)
  process.exitCode = result.allowed === true || result.accepted === true ? 0 : 1
}
const reject = (reason) => respond({ allowed: false, reason })

const run = async () => {
  if (process.argv.length !== 3) return reject("ONE_ACTION_REQUIRED")
  const action = actions.get(process.argv[2])
  if (!action) return reject("UNKNOWN_ACTION")
  const chunks = []
  let bytes = 0
  try {
    for await (const chunk of process.stdin) {
      bytes += chunk.length
      if (bytes > 1024 * 1024) {
        process.stdin.destroy()
        return reject("INPUT_TOO_LARGE")
      }
      chunks.push(chunk)
    }
  } catch {
    return reject("INPUT_READ_FAILED")
  }
  let input
  try {
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"))
  } catch {
    return reject("INVALID_JSON")
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) return reject("OBJECT_INPUT_REQUIRED")
  try {
    respond(action(input))
  } catch {
    reject("INVALID_INPUT")
  }
}

await run()
