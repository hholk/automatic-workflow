#!/usr/bin/env node
import { chmodSync, copyFileSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, symlinkSync, writeFileSync, constants } from "node:fs"
import { createHash } from "node:crypto"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const names = ["aw-mimo-worker", "aw-mimo-review", "aw-opus-teacher"]
const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex")
// The marker line is added by this installer; strip it so a file installed
// before the marker existed is still recognized as owned.
const withoutMarker = (path) => readFileSync(path, "utf8").replace(/^# Managed by the AW skill[^\n]*\n/, "")
const stat = (path) => {
  try { return lstatSync(path) } catch (error) {
    if (error.code === "ENOENT") return null
    throw error
  }
}
const readManifest = (path) => {
  try { return JSON.parse(readFileSync(path, "utf8")) } catch { return {} }
}

export function installAgents({ home = homedir(), apply = false } = {}) {
  const manifestPath = join(home, ".local/state/aw/installed-agents.json")
  const manifest = readManifest(manifestPath)
  const entries = [
    ["opencode", join(home, ".config/opencode/agents"), "md", [...names, "aw-glm53-worker", "aw-glm53-review"]],
    ["codex", join(home, ".codex/agents"), "toml", names],
  ].flatMap(([host, directory, extension, hostNames]) => {
    if (!stat(directory)?.isDirectory()) throw new Error(`Missing agent directory: ${directory}`)
    return hostNames.map((name) => {
      const source = join(root, "agents", host, `${name}.${extension}`)
      const target = join(directory, `${name}.${extension}`)
      const existing = stat(target)
      let current = false
      if (existing) {
        if (existing.isSymbolicLink()) {
          // Owned links point into this skill's agents tree; a renamed source
          // leaves a broken link that must be replaceable.
          let owned = false
          try { owned = realpathSync(target).startsWith(join(root, "agents")) } catch { owned = true }
          if (!owned) throw new Error(`Refusing unrelated destination: ${target}`)
          current = host === "opencode" && realpathSync(target) === realpathSync(source)
        } else if (host === "codex" && existing.isFile()) {
          const digest = hash(target)
          const owned = digest === hash(source)
            || manifest[target] === digest
            || withoutMarker(target) === withoutMarker(source)
          if (!owned) throw new Error(`Refusing unrelated destination: ${target}`)
          current = digest === hash(source)
        } else {
          throw new Error(`Refusing unrelated destination: ${target}`)
        }
      }
      return { host, source, target, current, exists: Boolean(existing) }
    })
  })
  // Validate every destination before installing anything.
  if (apply) {
    for (const entry of entries) {
      if (entry.current) continue
      if (entry.exists) {
        const temporary = `${entry.target}.tmp.${process.pid}`
        if (entry.host === "codex") {
          // Codex's sensitive config reader uses O_NOFOLLOW when spawning roles.
          // Discovery may show a symlinked role that then fails at dispatch.
          copyFileSync(entry.source, temporary, constants.COPYFILE_EXCL)
          chmodSync(temporary, 0o600)
          renameSync(temporary, entry.target)
        } else {
          symlinkSync(entry.source, temporary)
          renameSync(temporary, entry.target)
        }
      } else if (entry.host === "codex") {
        const temporary = `${entry.target}.tmp.${process.pid}`
        copyFileSync(entry.source, temporary, constants.COPYFILE_EXCL)
        chmodSync(temporary, 0o600)
        renameSync(temporary, entry.target)
      } else {
        symlinkSync(entry.source, entry.target)
      }
    }
    const next = { ...manifest }
    for (const entry of entries) next[entry.target] = hash(entry.source)
    mkdirSync(dirname(manifestPath), { recursive: true, mode: 0o700 })
    writeFileSync(manifestPath, `${JSON.stringify(next, null, 2)}\n`)
  }
  return entries.map(({ host, target, current, exists }) => ({
    host, target, status: current ? "current" : apply ? "installed" : exists ? "drift" : "missing",
  }))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = installAgents({ apply: process.argv.includes("--apply") })
    console.log(JSON.stringify(result, null, 2))
    if (result.some((entry) => entry.status !== "current")) process.exitCode = 1
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
