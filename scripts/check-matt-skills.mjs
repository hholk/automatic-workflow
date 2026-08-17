#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, appendFileSync } from "node:fs"
import { resolve } from "node:path"

const repo = process.env.MATT_SKILLS_REPO || resolve(process.env.HOME, ".local/share/agent-skills/mattpocock-skills")
const root = process.env.AW_SKILL_ROOT || resolve(new URL("..", import.meta.url).pathname)
const lessons = resolve(root, "LESSONS.md")
const remote = "https://github.com/mattpocock/skills.git"
const today = new Date().toISOString().slice(0, 10)
const force = process.argv.includes("--force")

function run(command, args, options = {}) {
  return execFileSync(command, args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }).trim()
}

function log({ action, before = "unknown", after = "unknown", evidence, status }) {
  appendFileSync(lessons, `\n## ${today} — Matt skills weekly check\n\n- Date: ${today}\n  Todo/Playbook: Matt skills upstream maintenance / AW intake\n  forecast vs actual/check-in count: one bounded remote check; no background daemon\n  symptom/evidence: ${evidence}\n  root cause: local checkout ${before}\n  orchestrator intervention: ${action}\n  proposed skill/playbook change: keep the check explicit, at most once every seven days, and record the result in LESSONS.md\n  status: ${status}\n  upstream revision: ${after}\n`)
}

if (!existsSync(repo)) {
  log({ action: "blocked; install mattpocock/skills into the shared skill checkout", evidence: `repository missing at ${repo}`, status: "pending" })
  process.exitCode = 1
  process.exit()
}

const content = readFileSync(lessons, "utf8")
const checks = [...content.matchAll(/^## (\d{4}-\d{2}-\d{2}) — Matt skills weekly check$/gm)]
const last = checks.at(-1)?.[1]
const age = last ? Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / 86400000) : Infinity
if (!force && age < 7) {
  console.log(`Matt skills check skipped: last check ${last} (${age} days ago), revision ${run("git", ["rev-parse", "HEAD"])}`)
  process.exit()
}

const before = run("git", ["rev-parse", "HEAD"])
const upstream = execFileSync("git", ["ls-remote", remote, "refs/heads/main"], { encoding: "utf8" }).trim().split(/\s+/)[0]
if (!upstream) throw new Error("Unable to resolve mattpocock/skills main revision")

if (before === upstream) {
  log({ action: "no update required", before, after: upstream, evidence: `local checkout matches upstream main at ${upstream}`, status: "validated" })
} else {
  if (run("git", ["status", "--porcelain"])) {
    log({ action: "blocked; did not overwrite local changes", before, after: upstream, evidence: "shared Matt checkout is dirty", status: "pending" })
    process.exitCode = 1
    process.exit()
  }
  run("git", ["pull", "--ff-only", "origin", "main"], { stdio: "inherit" })
  const after = run("git", ["rev-parse", "HEAD"])
  log({ action: `fast-forwarded shared checkout from ${before} to ${after}`, before, after, evidence: `upstream main advanced from ${before} to ${upstream}`, status: "promoted" })
}
