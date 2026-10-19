#!/usr/bin/env node
// Single source of truth: prompts/profiles.json. Templates keep placeholders;
// rendered agent files must match the current registry.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const profiles = JSON.parse(readFileSync(join(root, "prompts/profiles.json"), "utf8"))
const read = (path) => readFileSync(join(root, path), "utf8")
const worker = profiles.worker_defaults
const teacher = profiles.teacher_bindings

const expected = [
  ["agents/generated/codex/aw-worker.toml", new RegExp(`model = "${worker.codex}"`)],
  ["agents/generated/codex/aw-reviewer.toml", new RegExp(`model = "${worker.codex}"`)],
  ["agents/generated/codex/aw-teacher.toml", new RegExp(`model = "${teacher.codex.model}"`)],
  ["agents/generated/opencode/aw-worker.md", new RegExp(`model: ${worker.opencode}`)],
  ["agents/generated/opencode/aw-reviewer.md", new RegExp(`model: ${worker.opencode}`)],
  ["agents/generated/opencode/aw-teacher.md", new RegExp(`model: ${teacher.opencode.model}`)],
  ["agents/generated/copilot/aw-worker.agent.md", new RegExp(`model: ${worker["github-copilot"]}`)],
]

for (const name of ["aw-glm53-worker", "aw-glm53-review", "aw-luna-worker"]) {
  expected.push([`agents/generated/opencode/${name}.md`, new RegExp(`model: ${worker.opencode}`)])
}

const failures = expected.filter(([path, pattern]) => !pattern.test(read(path))).map(([path]) => path)
if (failures.length) {
  console.error(`model drift vs prompts/profiles.json: ${failures.join(", ")}`)
  process.exitCode = 1
} else {
  console.log("models consistent with prompts/profiles.json")
}
