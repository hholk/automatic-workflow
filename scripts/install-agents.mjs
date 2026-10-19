#!/usr/bin/env node
import { chmodSync, copyFileSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, renameSync, symlinkSync, writeFileSync, constants } from "node:fs"
import { createHash } from "node:crypto"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const names = ["aw-worker", "aw-reviewer", "aw-teacher"]
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
  if (!stat(path)) return {}
  if (!stat(path).isFile()) throw new Error(`Refusing unrelated manifest: ${path}`)
  const manifest = JSON.parse(readFileSync(path, "utf8"))
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error(`Invalid ownership manifest: ${path}`)
  return manifest
}
const assertDirectories = (path, home) => {
  let parent = dirname(path)
  while (parent !== home) {
    const existing = stat(parent)
    if (existing && !existing.isDirectory()) throw new Error(`Refusing non-directory ancestor: ${parent}`)
    const next = dirname(parent)
    if (next === parent) throw new Error(`Destination outside home: ${path}`)
    parent = next
  }
}

export function installAgents({ home = homedir(), apply = false, host, hosts } = {}) {
  if (host && hosts) throw new Error("select host or hosts, not both")
  const requested = hosts ?? (host ? [host] : ["codex", "opencode", "github-copilot"])
  if (!Array.isArray(requested) || !requested.length) throw new Error("at least one host is required")
  const selected = new Set(requested.map((name) => name === "github-copilot" ? "copilot" : name))
  for (const name of selected) {
    if (!["codex", "opencode", "copilot"].includes(name)) throw new Error(`unsupported install host: ${name}`)
  }
  const manifestPath = join(home, ".local/state/aw/installed-agents.json")
  assertDirectories(manifestPath, home)
  const manifest = readManifest(manifestPath)
  const entries = [
    ["opencode", "opencode", join(home, ".config/opencode/agents"), ".md", [...names, "aw-glm53-worker", "aw-glm53-review"]],
    ["codex", "codex", join(home, ".codex/agents"), ".toml", names],
    ["copilot", "copilot", join(home, ".copilot/agents"), ".agent.md", ["aw-worker"]],
  ].filter(([host]) => selected.has(host)).flatMap(([host, sourceHost, directory, suffix, hostNames]) => {
    const directoryStat = stat(directory)
    if (directoryStat && !directoryStat.isDirectory()) throw new Error(`Agent path is not a directory: ${directory}`)
    return hostNames.map((name) => {
      const filename = `${name}${suffix}`
      const source = join(root, "agents/generated", sourceHost, filename)
      const target = join(directory, filename)
      if (!stat(source)?.isFile()) throw new Error(`Missing generated agent: ${source}`)
      assertDirectories(target, home)
      const existing = stat(target)
      let current = false
      if (existing) {
        if (existing.isSymbolicLink()) {
          // Owned links point into this skill's agents tree; a renamed source
          // leaves a broken link that must be replaceable.
          const linked = resolve(dirname(target), readlinkSync(target))
          let owned = linked.startsWith(`${join(root, "agents")}/`)
          try { owned = owned && realpathSync(target).startsWith(`${join(root, "agents")}/`) } catch (error) {
            if (error.code !== "ENOENT") throw error
          }
          if (!owned) throw new Error(`Refusing unrelated destination: ${target}`)
          try { current = host === "opencode" && realpathSync(target) === realpathSync(source) } catch (error) {
            if (error.code !== "ENOENT") throw error
          }
        } else if (["codex", "copilot"].includes(host) && existing.isFile()) {
          const digest = hash(target)
          const owned = digest === hash(source)
            || manifest[target] === digest
            || withoutMarker(target) === withoutMarker(source)
          if (!owned) throw new Error(`Refusing unrelated destination: ${target}`)
          current = digest === hash(source) && (host !== "codex" || (existing.mode & 0o777) === 0o600)
        } else {
          throw new Error(`Refusing unrelated destination: ${target}`)
        }
      }
      return { host, source, target, current, exists: Boolean(existing) }
    })
  })
  // Validate every destination before installing anything.
  if (apply) {
    for (const directory of new Set(entries.map((entry) => dirname(entry.target)))) {
      mkdirSync(directory, { recursive: true, mode: 0o700 })
    }
    for (const entry of entries) {
      if (entry.current) continue
      if (entry.exists) {
        const temporary = `${entry.target}.tmp.${process.pid}`
        if (["codex", "copilot"].includes(entry.host)) {
          // Codex's sensitive config reader uses O_NOFOLLOW when spawning roles.
          // Copilot and Codex user agents are installed as regular files.
          copyFileSync(entry.source, temporary, constants.COPYFILE_EXCL)
          if (entry.host === "codex") chmodSync(temporary, 0o600)
          renameSync(temporary, entry.target)
        } else {
          symlinkSync(entry.source, temporary)
          renameSync(temporary, entry.target)
        }
      } else if (["codex", "copilot"].includes(entry.host)) {
        const temporary = `${entry.target}.tmp.${process.pid}`
        copyFileSync(entry.source, temporary, constants.COPYFILE_EXCL)
        if (entry.host === "codex") chmodSync(temporary, 0o600)
        renameSync(temporary, entry.target)
      } else {
        symlinkSync(entry.source, entry.target)
      }
    }
    const next = { ...manifest }
    for (const entry of entries) next[entry.target] = hash(entry.source)
    const renderedManifest = `${JSON.stringify(next, null, 2)}\n`
    if (!stat(manifestPath) || readFileSync(manifestPath, "utf8") !== renderedManifest) {
      mkdirSync(dirname(manifestPath), { recursive: true, mode: 0o700 })
      writeFileSync(manifestPath, renderedManifest)
    }
  }
  return entries.map(({ host, target, current, exists }) => ({
    host, target, status: current ? "current" : apply ? "installed" : exists ? "drift" : "missing",
  }))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const hostIndex = process.argv.indexOf("--host")
    if (hostIndex >= 0 && !process.argv[hostIndex + 1]) throw new Error("--host requires a host name")
    const result = installAgents({ apply: process.argv.includes("--apply"), host: hostIndex >= 0 ? process.argv[hostIndex + 1] : undefined })
    console.log(JSON.stringify(result, null, 2))
    if (!process.argv.includes("--apply") && result.some((entry) => entry.status !== "current")) process.exitCode = 1
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
