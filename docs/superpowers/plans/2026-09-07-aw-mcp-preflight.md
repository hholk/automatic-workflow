# AW MCP Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give AW main agents and eligible workers early, optional access to Codebase Memory MCP and Context7 without forcing redundant calls or changing the teacher boundary.

**Architecture:** Extend the existing main and worker instructions with one flexible evidence rule. Bind the two existing MCP namespaces directly in OpenCode and Copilot profiles; Codex continues to use its configured native MCPs. Reuse the current v4 telemetry instead of adding state or schemas.

**Tech Stack:** Markdown skill/agent profiles, OpenCode YAML permissions, GitHub Copilot custom-agent YAML, Node.js test runner.

---

### Task 1: Add the flexible evidence-preflight contract

**Files:**
- Modify: `scripts/aw-v4-contract.test.mjs`
- Modify: `SKILL.md`
- Modify: `prompts/core/worker.md`
- Modify: `references/runtimes-codex.md`
- Modify: `references/runtimes-opencode.md`
- Modify: `references/runtimes-copilot.md`

- [ ] **Step 1: Write the failing contract test**

Add one test that requires:

```js
test("prefers useful MCP evidence without forcing redundant calls", () => {
  const main = read("SKILL.md")
  const worker = read("prompts/core/worker.md")
  const runtimes = ["codex", "opencode", "copilot"]
    .map((host) => read(`references/runtimes-${host}.md`)).join("\n")
  assert.match(`${main}\n${worker}`, /Codebase Memory/i)
  assert.match(`${main}\n${worker}`, /Context7/i)
  assert.match(`${main}\n${worker}`, /reuse/i)
  assert.match(`${main}\n${worker}`, /when.*(?:cheaper|useful|decision)/is)
  assert.doesNotMatch(`${main}\n${worker}`, /always (?:call|use).*(?:Codebase Memory|Context7)/is)
  assert.match(runtimes, /configured.*MCP|MCP.*configured/is)
  assert.match(read("prompts/core/teacher.md"), /Use no tools/i)
})
```

- [ ] **Step 2: Verify RED**

Run:

```bash
node --test scripts/aw-v4-contract.test.mjs
```

Expected: FAIL because the main and worker prompts do not name either MCP or evidence reuse.

- [ ] **Step 3: Add the minimal main and worker rules**

In `SKILL.md`, add this sentence before manual discovery or dispatch:

```markdown
Use Codebase Memory for decision-relevant code structure or Context7 for
current library behavior when either is likely cheaper than manual discovery;
reuse sufficient supplied evidence.
```

Append this compact rule to `prompts/core/worker.md`:

```markdown
Before manual discovery, prefer Codebase Memory for decision-relevant structure
or Context7 for current library behavior when useful and cheaper. Reuse
sufficient supplied evidence; skip unavailable, redundant, or non-decisive calls.
```

- [ ] **Step 4: Describe the native behavior once per runtime**

Add one short runtime-specific sentence:

```markdown
Codex workers use the configured native MCPs under the shared preflight rule.
OpenCode profiles explicitly allow both MCP namespaces under the shared preflight rule.
Copilot uses the configured MCP servers under the shared preflight rule; unavailable tools remain UNKNOWN.
```

Do not add tool sequences, wrappers, or duplicated explanations.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
node --test scripts/aw-v4-contract.test.mjs scripts/resolve-profile.test.mjs
```

Expected: PASS.

### Task 2: Bind native MCP permissions and verify the full skill

**Files:**
- Modify: `scripts/aw-v4-contract.test.mjs`
- Modify: `agents/opencode/aw-deepseek-worker.md`
- Modify: `agents/opencode/aw-deepseek-review.md`
- Modify: `agents/opencode/aw-luna-worker.md`
- Modify: `agents/copilot/aw-worker.agent.md`
- Modify: `benchmarks/latest.json`
- Modify: `LESSONS.md`

- [ ] **Step 1: Write failing profile assertions**

Extend the harness-profile test with:

```js
for (const name of ["aw-deepseek-worker", "aw-deepseek-review", "aw-luna-worker"]) {
  const profile = read(`agents/opencode/${name}.md`)
  assert.match(profile, /codebase-memory-mcp_\*/)
  assert.match(profile, /context7_\*/)
}
const copilot = read("agents/copilot/aw-worker.agent.md")
assert.match(copilot, /codebase-memory-mcp\/\*/)
assert.match(copilot, /context7\/\*/)
```

- [ ] **Step 2: Verify RED**

Run:

```bash
node --test scripts/aw-v4-contract.test.mjs
```

Expected: FAIL because the profile allowlists are absent.

- [ ] **Step 3: Add OpenCode permissions**

Under `permission:` in all three OpenCode AW profiles, add:

```yaml
  "codebase-memory-mcp_*": allow
  "context7_*": allow
```

Keep `task: deny` and every read/write restriction unchanged.

- [ ] **Step 4: Add Copilot MCP tools**

Append these entries to the existing `tools` list:

```yaml
  - codebase-memory-mcp/*
  - context7/*
```

Do not add `agent` or embed new MCP server credentials/configuration.

- [ ] **Step 5: Run full verification and regenerate metrics**

Run:

```bash
node --test scripts/*.test.mjs integrations/opencode/*.test.mjs integrations/lifecycle/*.test.mjs
for file in scripts/*.mjs integrations/opencode/*.js integrations/lifecycle/*.mjs; do node --check "$file" || exit 1; done
node scripts/benchmark.mjs --write
node scripts/benchmark.mjs
node scripts/usage.mjs summary
git diff --check
```

Expected: all tests, routing, native profiles, prompt profiles, and invariants pass. Record the entrypoint/route token delta in `LESSONS.md`; no matched-run efficiency claim is allowed without five attested pairs.

- [ ] **Step 6: Commit only safely owned changes**

Preserve every pre-existing dirty or untracked file. Stage only files or hunks known to belong to this change; do not sweep the working tree with `git add -A`.

```bash
git status --short
git diff --check
```
