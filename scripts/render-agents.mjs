#!/usr/bin/env node
// Renders agent templates from prompts/profiles.json, the single source of model truth.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { effectivePolicy } from "./effective-policy.mjs"

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

const roleOf = (file) => /teacher/.test(file) ? "teacher" : "worker"

export function renderTemplate(template, { host, role }) {
  const { model, provider } = valuesFor(host, role)
  const policy = effectivePolicy({ host })
  return template.replaceAll("{{model}}", model).replaceAll("{{provider}}", provider)
    .replaceAll("{{worker_steps}}", String(policy.worker_step_budget))
    .replaceAll("{{failed_hypotheses}}", String(policy.teacher_after_failed_hypotheses))
}

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
    const template = readFileSync(join(root, "agents", dir, file), "utf8")
    const rendered = renderTemplate(template, { host, role })
    const outDir = join(root, "agents/generated", dir)
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, file), rendered)
  }
}

if (process.argv[1] && process.argv[1].endsWith("render-agents.mjs")) renderAll()
