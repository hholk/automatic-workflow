import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { renderTemplate } from "./render-agents.mjs"
import { effectivePolicy } from "./effective-policy.mjs"

const read = (path) => readFileSync(new URL(`../agents/${path}`, import.meta.url), "utf8")
test("committed profiles match registry models and effective policy generation", () => {
  for (const directory of ["codex", "opencode", "copilot"]) {
    const host = directory === "copilot" ? "github-copilot" : directory
    for (const file of readdirSync(new URL(`../agents/${directory}/`, import.meta.url))) {
      const role = file.includes("teacher") ? "teacher" : "worker"
      const rendered = renderTemplate(read(`${directory}/${file}`), { host, role })
      assert.equal(read(`generated/${directory}/${file}`), rendered, `regenerate ${directory}/${file}`)
      assert.doesNotMatch(rendered, /\{\{[a-z_]+\}\}/)
      if (directory === "opencode" && role === "worker" && !file.includes("luna")) {
        assert.match(rendered, new RegExp(`steps: ${effectivePolicy({ host }).worker_step_budget}`))
      }
    }
  }
})
