# Access tiers — skills & MCPs

Focused overhead: orchestrator decides; leaves execute. Matt principles are
**inline in briefs**, not full skill loads.

## Orchestrator (`build` / main chat / `/orchestrate`)

The orchestrator **is the chat LLM** — session model, user-switchable, full
OpenCode harness (plan, tools, ledger, MCPs, gates). Not a pinned leaf model.
Changing the session model does not change leaf Task models.

### Skills (allowlist — everything else denied)

| Skill | When |
|-------|------|
| `flash-orchestrator` | **Always** for `/orchestrate` |
| `grilling` | Intake only — unclear DoD/scope (pre-contract) |
| `writing-plans` | L / multi-session only — **before** autonomous loop |
| `systematic-debugging` | After Fix1 or unclear root cause |
| `codebase-design` | Module/interface decision blocking a package |

**Never auto-load:** `using-superpowers`, `test-driven-development`, `tdd`,
`verification-before-completion`, `subagent-driven-development`,
`dispatching-parallel-agents`, `requesting-code-review`, gstack/venice/figma
noise.

### MCPs

| MCP | Role |
|-----|------|
| `codebase-memory-mcp` | Map / impact / call graph (prefer over bulk grep) |
| `context7` | Library/API docs **before** writing briefs |
| ~~penpot / open-design / node_repl / openaiDeveloperDocs~~ | Denied on coding path |

## Leaves

| Agent | Skills | MCP | Tools focus |
|-------|--------|-----|-------------|
| `flash-explore` | none | **optional** codebase-memory graph only | read/grep/glob/bash (read-only) |
| `flash-worker` | none | **none** | repo paths + brief + verify command |
| `flash-review` | none | **none** | named artifacts + AC probes only |

Leaves never load skills or nest Tasks. Worker/review have web fetch/search denied.

## Matt principles (inline — no full skill)

Inject into every write brief (see brief-templates):

1. **Tracer bullet packages** — one vertical outcome, path-bounded, ≤ tier budgets.
2. **RED → GREEN** — failing/missing test or probe first, then minimal implementation.
3. **Evidence before done** — artifact probe + named verify exit 0; prose is never proof.
4. **Human gate only for real ambiguity** — secrets, destructive, product contradiction, final recovery failure.

## Pre-loop vs in-loop

```text
[optional] grilling | writing-plans | codebase-design
        ↓ freeze contract
/orchestrate  → skill flash-orchestrator only (+ memory/context7 tools)
        ↓ packages via flash-explore / flash-worker / flash-review
[optional] systematic-debugging only if Fix path stuck
```
