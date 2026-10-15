#!/usr/bin/env node
// Renders agent templates from prompts/profiles.json, the single source of model truth.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const profiles = JSON.parse(readFileSync(join(root, "prompts/profiles.json"), "utf8"))

const workerModel = (host) => profiles.worker_defaults[host]
const teacherBinding = (host) => profiles.teacher_bindings[host]

// Each template gets its model and provider from one role-based lookup.
const valuesFor = (host, role) => {
  if (role === "teacher") {
    const binding = teacherBinding(host)
    return { model: binding.model, provider: binding.model_provider }
  }
  return { model: workerModel(host), provider: host === "codex" ? "codex-router" : "venice" }
}

const hostOf = (name) => name.startsWith("opencode/") ? "opencode"
  : name.startsWith("codex/") ? "codex" : "github-copilot"
const roleOf = (file) => /teacher/.test(file) ? "teacher" : "worker"

export function renderAll() {
  const sources = ["codex", "opencode", "copilot"].flatMap((dir) => {
    const directory = join(root, "agents", dir)
    return readdirSync(directory).filter((file) => /\.(md|toml)$/.test(file)).map((file) => ({
      dir,
      file,
      host: dir === "copilot" ? "github-copilot" : dir,
      role: roleOf(file),
    }))
  })
  for (const { dir, file, host, role } of sources) {
    const { model, provider } = valuesFor(host, role)
    const template = readFileSync(join(root, "agents", dir, file), "utf8")
    const rendered = template.replaceAll("{{model}}", model).replaceAll("{{provider}}", provider)
    const outDir = join(root, "agents/generated", dir)
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, file), rendered)
  }
}

if (process.argv[1] && process.argv[1].endsWith("render-agents.mjs")) renderAll()
