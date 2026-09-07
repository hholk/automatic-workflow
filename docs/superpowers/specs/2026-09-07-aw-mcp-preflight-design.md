# AW MCP Preflight Design

## Goal

Let AW main agents and workers use Codebase Memory MCP or Context7 early when
either can resolve a material information gap more efficiently than manual
search, without making either tool mandatory or adding orchestration machinery.

## Decision

Add one short evidence-preflight rule to the existing main, worker, and harness
instructions. Do not add a resolver, wrapper, state machine, prompt component,
or telemetry schema.

The rule is advisory:

- Prefer Codebase Memory for structural code questions such as callers,
  dependencies, ownership, architecture, and change impact.
- Prefer Context7 for current, version-dependent library, framework, API, type,
  or configuration behavior.
- Skip either tool when evidence is already supplied, a direct read is cheaper,
  the task is trivial, the tool is unavailable, or its result would not affect
  the next decision.
- Reuse MCP evidence supplied by the main agent. Do not repeat a query unless
  the evidence is missing, stale, conflicting, or insufficient.

No fixed call order is required. `search_graph` and `query-docs` are preferred
starting points, with narrower follow-up calls only when useful. Context7 still
resolves a library ID first when the user did not provide one.

## Roles and harnesses

- Main, explore, diagnose, fix, implement, and review may use the preflight.
- Sol and Astra teachers remain tool-free and receive compressed evidence only.
- Codex uses its configured native MCP tools.
- OpenCode profiles explicitly allow the two MCP namespaces.
- The Copilot worker explicitly lists both MCP namespaces; an unavailable or
  unrecognized server is treated as unavailable, never as evidence.

## Evidence and telemetry

The main agent includes useful MCP findings and their source in the worker
brief. Existing v4 telemetry already records actor, tool category, and hashed
signature, so this change adds no stored queries, results, prompts, or source
content.

## Failure behavior

MCP failure is not a task failure when an allowed cheaper fallback exists.
Continue with targeted native search and record the missing evidence as
unknown. Never invent a graph or documentation result.

## Verification

Add contract tests proving that main and worker instructions contain the
flexible preflight, OpenCode and Copilot expose both MCP namespaces, the teacher
remains tool-free, evidence reuse is explicit, and no unconditional-call rule
is introduced. Run the complete AW test and benchmark suites afterward.
