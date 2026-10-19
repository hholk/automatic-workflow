#!/usr/bin/env node
import { assessAcceptance } from "./execution-state.mjs"

// A worker report is preliminary evidence. Final acceptance needs scoped main proof.
const VERIFY_PATTERN = /^VERIFY:\s*(?<command>.+?)\s*\|\s*exit\s+(?<exit>-?\d+)\s*\|\s*(?<semantic>.+)$/m
const COVERAGE_PATTERN = /coverage\s+(?<covered>\d+)\s*\/\s*(?<total>\d+)/i

export function evaluateDone(message, acceptance) {
  if (!/^TYPE:\s*DONE\b/m.test(message)) return { outcome: null, reason: "not a DONE message" }
  const verify = message.match(VERIFY_PATTERN)
  if (!verify) return { outcome: "PARTIAL_WITH_UNKNOWN", reason: "missing VERIFY: <command> | exit <n> | <semantic>" }
  if (Number(verify.groups.exit) !== 0) return { outcome: "PARTIAL_WITH_UNKNOWN", reason: `verify exit ${verify.groups.exit}` }
  const coverage = message.match(COVERAGE_PATTERN)
  if (!coverage) return { outcome: "PARTIAL_WITH_UNKNOWN", reason: "missing coverage n/N against SUCCESS" }
  if (Number(coverage.groups.total) < 1 || Number(coverage.groups.covered) !== Number(coverage.groups.total)) {
    return { outcome: "PARTIAL_WITH_UNKNOWN", reason: "SUCCESS coverage incomplete" }
  }
  if (!acceptance) return { outcome: "PARTIAL_WITH_UNKNOWN", reason: "versioned main acceptance evidence required", worker_report_complete: true }
  const checked = assessAcceptance(acceptance)
  return checked.accepted ? { outcome: "VERIFIED", reason: "versioned full coverage and main integration verification", acceptance: checked }
    : { outcome: "PARTIAL_WITH_UNKNOWN", reason: checked.reason }
}

if (process.argv[1] && process.argv[1].endsWith("gate.mjs")) {
  const { readFileSync } = await import("node:fs")
  const input = readFileSync(0, "utf8")
  let result
  try {
    if (input.trimStart().startsWith("{")) {
      const { message, acceptance } = JSON.parse(input)
      if (typeof message !== "string") throw new Error("message required")
      result = evaluateDone(message, acceptance)
    } else result = evaluateDone(input)
  } catch {
    result = { outcome: "PARTIAL_WITH_UNKNOWN", reason: "invalid acceptance envelope" }
  }
  console.log(JSON.stringify(result))
  if (result.outcome !== "VERIFIED") process.exitCode = result.outcome ? 1 : 0
}
