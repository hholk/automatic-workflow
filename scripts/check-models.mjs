#!/usr/bin/env node
// Single source of truth: prompts/profiles.json. Agent files must match it.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const profiles = JSON.parse(readFileSync(join(root, "prompts/profiles.json"), "utf8"))
const read = (path) => readFileSync(join(root, path), "utf8")
const worker = profiles.worker_defaults
const teacher = profiles.teacher_bindings

const expected = [
  ["agents/codex/aw-worker.toml", new RegExp(`model = "${worker.codex}"`)],
  ["agents/codex/aw-mimo-review.toml", new RegExp(`model = "${worker.codex}"`)],
  ["agents/codex/aw-opus-teacher.toml", new RegExp(`model = "${teacher.codex.model}"`)],
  ["agents/opencode/aw-worker.md", new RegExp(`model: ${worker.opencode}`)],
  ["agents/opencode/aw-mimo-review.md", new RegExp(`model: ${worker.opencode}`)],
  ["agents/opencode/aw-opus-teacher.md", new RegExp(`model: ${teacher.opencode.model}`)],
  ["agents/copilot/aw-worker.agent.md", new RegExp(`model: ${worker["github-copilot"]}`)],
]

const failures = expected.filter(([path, pattern]) => !pattern.test(read(path))).map(([path]) => path)
if (failures.length) {
  console.error(`model drift vs prompts/profiles.json: ${failures.join(", ")}`)
  process.exitCode = 1
} else {
  console.log("models consistent with prompts/profiles.json")
}
