import test from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { linkSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { closeRunContext, createRunContext, readRunContext } from "./run-context.mjs"

const fixture = () => {
  const stateDir = mkdtempSync(join(tmpdir(), "aw-run-context-"))
  const token = createRunContext({ runID: "codex:fixture-run", profileHost: "codex", playbookVersion: "fixture-v1",
    scopeRef: createHash("sha256").update("fixture-turn").digest("hex"), stateDir, now: 100 })
  return { stateDir, token, profileHost: "codex", playbookVersion: "fixture-v1", now: 101 }
}

test("exact run contexts expire, close and reject foreign providers or policy versions", () => {
  const f = fixture()
  try {
    const value = readRunContext(f)
    assert.equal(value.run_id, "codex:fixture-run")
    assert.ok(Object.isFrozen(value))
    for (const changes of [{ profileHost: "opencode" }, { playbookVersion: "other" }, { now: 99 }, { now: value.expires_at }]) {
      assert.throws(() => readRunContext({ ...f, ...changes }), /STALE_OR_FOREIGN_RUN_CONTEXT/)
    }
    closeRunContext(f)
    assert.throws(() => readRunContext(f), /ENOENT/)
    assert.doesNotThrow(() => closeRunContext(f))
  } finally { rmSync(f.stateDir, { recursive: true, force: true }) }
})

test("run contexts reject trust claims, renamed records, large files and link substitutions", () => {
  const f = fixture()
  const foreign = mkdtempSync(join(tmpdir(), "aw-context-foreign-"))
  try {
    const path = join(f.stateDir, "run-contexts", `${f.token}.json`)
    const original = readFileSync(path, "utf8")
    writeFileSync(path, JSON.stringify({ ...JSON.parse(original), trusted: true }))
    assert.throws(() => readRunContext(f), /STALE_OR_FOREIGN_RUN_CONTEXT/)
    writeFileSync(path, " ".repeat(4097))
    assert.throws(() => readRunContext(f), /INVALID_RUN_CONTEXT_FILE/)
    writeFileSync(path, original)
    const another = "a".repeat(64)
    writeFileSync(join(f.stateDir, "run-contexts", `${another}.json`), original)
    assert.throws(() => readRunContext({ ...f, token: another }), /STALE_OR_FOREIGN_RUN_CONTEXT/)
    const target = join(foreign, "record.json")
    writeFileSync(target, original)
    unlinkSync(path)
    symlinkSync(target, path)
    assert.throws(() => readRunContext(f))
    assert.equal(readFileSync(target, "utf8"), original)
    unlinkSync(path)
    linkSync(target, path)
    assert.throws(() => readRunContext(f), /INVALID_RUN_CONTEXT_FILE/)
    const rootLink = join(foreign, "root")
    symlinkSync(f.stateDir, rootLink, "dir")
    assert.throws(() => readRunContext({ ...f, stateDir: rootLink }), /UNSAFE_RUN_CONTEXT_DIRECTORY/)
    assert.throws(() => readRunContext({ ...f, token: "../outside" }), /INVALID_RUN_CONTEXT_TOKEN/)
  } finally {
    rmSync(f.stateDir, { recursive: true, force: true })
    rmSync(foreign, { recursive: true, force: true })
  }
})
