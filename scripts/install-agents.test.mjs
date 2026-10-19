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

test("host selection needs no other host directories and a second apply changes nothing", () => {
  const home = mkdtempSync(join(tmpdir(), "aw-install-selected-"))
  try {
    const first = installAgents({ home, host: "codex", apply: true })
    assert.equal(first.length, 3)
    assert.ok(first.every((entry) => entry.host === "codex" && entry.status === "installed"))
    const target = join(home, ".codex/agents/aw-worker.toml")
    const manifest = join(home, ".local/state/aw/installed-agents.json")
    const before = [lstatSync(target).mtimeMs, lstatSync(manifest).mtimeMs]
    assert.ok(installAgents({ home, host: "codex", apply: true }).every((entry) => entry.status === "current"))
    assert.deepEqual([lstatSync(target).mtimeMs, lstatSync(manifest).mtimeMs], before)
    assert.throws(() => lstatSync(join(home, ".config")), /ENOENT/)
    assert.throws(() => lstatSync(join(home, ".copilot")), /ENOENT/)
    assert.throws(() => installAgents({ home, host: "t3", apply: true }), /unsupported install host/)
  } finally { rmSync(home, { recursive: true }) }
})

test("an unrelated dangling symlink blocks every selected host before writes", () => {
  const home = fixture()
  try {
    const target = join(home, ".codex/agents/aw-teacher.toml")
    symlinkSync(join(home, "unrelated-missing.toml"), target)
    assert.throws(() => installAgents({ home, apply: true }), /Refusing unrelated destination/)
    assert.equal(lstatSync(target).isSymbolicLink(), true)
    assert.throws(() => lstatSync(join(home, ".config/opencode/agents/aw-worker.md")), /ENOENT/)
    assert.throws(() => lstatSync(join(home, ".local")), /ENOENT/)
  } finally { rmSync(home, { recursive: true }) }
})

test("check-only does not create directories or a manifest", () => {
  const home = mkdtempSync(join(tmpdir(), "aw-install-check-"))
  try {
    assert.ok(installAgents({ home, host: "opencode" }).every((entry) => entry.status === "missing"))
    assert.throws(() => lstatSync(join(home, ".config")), /ENOENT/)
    assert.throws(() => lstatSync(join(home, ".local")), /ENOENT/)
  } finally { rmSync(home, { recursive: true }) }
})

test("a symlink ancestor or manifest is rejected before agent writes", () => {
  for (const location of ["ancestor", "manifest"]) {
    const home = fixture()
    const external = mkdtempSync(join(tmpdir(), "aw-install-external-"))
    try {
      if (location === "ancestor") {
        rmSync(join(home, ".codex"), { recursive: true })
        symlinkSync(external, join(home, ".codex"))
      } else {
        mkdirSync(join(home, ".local/state/aw"), { recursive: true })
        writeFileSync(join(external, "manifest.json"), "{}")
        symlinkSync(join(external, "manifest.json"), join(home, ".local/state/aw/installed-agents.json"))
      }
      assert.throws(() => installAgents({ home, apply: true }), /Refusing/)
      assert.throws(() => lstatSync(join(home, ".config/opencode/agents/aw-worker.md")), /ENOENT/)
      assert.throws(() => lstatSync(join(external, "agents")), /ENOENT/)
    } finally { rmSync(home, { recursive: true }); rmSync(external, { recursive: true }) }
  }
})
