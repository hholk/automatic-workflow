import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, lstatSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { installAgents } from "./install-agents.mjs"

const fixture = () => {
  const home = mkdtempSync(join(tmpdir(), "aw-install-test-"))
  mkdirSync(join(home, ".config/opencode/agents"), { recursive: true })
  mkdirSync(join(home, ".codex/agents"), { recursive: true })
  return home
}
test("installs regular Codex/Copilot agents and keeps OpenCode native symlinks", () => {
  const home = fixture()
  try {
    const target = join(home, ".codex/agents/aw-reviewer.toml")
    symlinkSync(fileURLToPath(new URL("../agents/codex/aw-reviewer.toml", import.meta.url)), target)
    installAgents({ home, apply: true })
    assert.equal(lstatSync(target).isSymbolicLink(), false)
    assert.equal(lstatSync(target).mode & 0o777, 0o600)
    assert.match(readFileSync(target, "utf8"), /model_provider = "codex-router"/)
    assert.equal(lstatSync(join(home, ".config/opencode/agents/aw-reviewer.md")).isSymbolicLink(), true)
    assert.equal(lstatSync(join(home, ".config/opencode/agents/aw-glm53-review.md")).isSymbolicLink(), true)
    assert.equal(lstatSync(join(home, ".config/opencode/agents/aw-glm53-worker.md")).isSymbolicLink(), true)
    const copilot = join(home, ".copilot/agents/aw-worker.agent.md")
    assert.equal(lstatSync(copilot).isSymbolicLink(), false)
    assert.match(readFileSync(copilot, "utf8"), /model: venice\/openai-gpt-6-luna/)
    assert.match(readFileSync(copilot, "utf8"), /model-policy: required/)
    assert.ok(installAgents({ home }).every((entry) => entry.status === "current"))
  } finally { rmSync(home, { recursive: true }) }
})
test("an unrelated agent blocks the whole installation before any writes", () => {
  const home = fixture()
  try {
    const target = join(home, ".codex/agents/aw-teacher.toml")
    writeFileSync(target, "user content")
    assert.throws(() => installAgents({ home, apply: true }), /Refusing unrelated destination/)
    assert.equal(readFileSync(target, "utf8"), "user content")
    assert.throws(() => lstatSync(join(home, ".config/opencode/agents/aw-worker.md")), /ENOENT/)
    assert.throws(() => lstatSync(join(home, ".copilot")), /ENOENT/)
  } finally { rmSync(home, { recursive: true }) }
})

test("an unrelated Copilot agent blocks the installation before any writes", () => {
  const home = fixture()
  try {
    const target = join(home, ".copilot/agents/aw-worker.agent.md")
    mkdirSync(join(home, ".copilot/agents"), { recursive: true })
    writeFileSync(target, "user content")
    assert.throws(() => installAgents({ home, apply: true }), /Refusing unrelated destination/)
    assert.equal(readFileSync(target, "utf8"), "user content")
    assert.throws(() => lstatSync(join(home, ".config/opencode/agents/aw-worker.md")), /ENOENT/)
  } finally { rmSync(home, { recursive: true }) }
})
