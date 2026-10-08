#!/usr/bin/env node
// Mechanical acceptance gate: VERIFIED needs a passing VERIFY line and full SUCCESS coverage.
const VERIFY_PATTERN = /^VERIFY:\s*(?<command>.+?)\s*\|\s*exit\s+(?<exit>-?\d+)\s*\|\s*(?<semantic>.+)$/m
const COVERAGE_PATTERN = /coverage\s+(?<covered>\d+)\s*\/\s*(?<total>\d+)/i

export function evaluateDone(message) {
  if (!/^TYPE:\s*DONE\b/m.test(message)) return { outcome: null, reason: "not a DONE message" }
  const verify = message.match(VERIFY_PATTERN)
  if (!verify) return { outcome: "PARTIAL_WITH_UNKNOWN", reason: "missing VERIFY: <command> | exit <n> | <semantic>" }
  if (Number(verify.groups.exit) !== 0) return { outcome: "PARTIAL_WITH_UNKNOWN", reason: `verify exit ${verify.groups.exit}` }
  const coverage = message.match(COVERAGE_PATTERN)
  if (!coverage) return { outcome: "PARTIAL_WITH_UNKNOWN", reason: "missing coverage n/N against SUCCESS" }
  if (Number(coverage.groups.covered) !== Number(coverage.groups.total)) {
    return { outcome: "PARTIAL_WITH_UNKNOWN", reason: "SUCCESS coverage incomplete" }
  }
  return { outcome: "VERIFIED", reason: "exit 0 and full SUCCESS coverage" }
}

if (process.argv[1] && process.argv[1].endsWith("gate.mjs")) {
  const { readFileSync } = await import("node:fs")
  const input = readFileSync(0, "utf8")
  const result = evaluateDone(input)
  console.log(JSON.stringify(result))
  if (result.outcome !== "VERIFIED") process.exitCode = result.outcome ? 1 : 0
}
