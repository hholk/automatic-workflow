# AW native routing repair Implementation Plan

**Goal:** Astra advises via Venice on OpenCode and native OpenAI on Codex;
DeepSeek V4.1 Flash performs every other AW role without silent fallbacks.

**Architecture:** Keep native task/spawn tools and shared prompt components.
Bind provider and agent alongside the model in the existing resolver. Install
owned agent files, never edit router-generated agent definitions by hand.

**Tech Stack:** Node test runner, OpenCode 1.18.29, Codex 0.153.4, Codex Router.

## Evidence and scope

Baseline: 45/46 tests; static benchmark exits 1. Broken GLM symlinks omit the
new OpenCode workers. Codex lacks the named DeepSeek agent and selects GLM/Luna.
Existing dirty work is preserved in the private pre-change backup.

- [ ] Add regressions in `scripts/resolve-profile.test.mjs` and
  `scripts/aw-v4-contract.test.mjs`: host-specific Astra bindings, all DeepSeek
  worker routes, rejected mismatched models, exposed budgets, matching recipes.
- [ ] Run `node --test scripts/resolve-profile.test.mjs scripts/aw-v4-contract.test.mjs`
  and confirm new assertions fail before implementation.
- [ ] Update `scripts/resolve-profile.mjs`, `prompts/profiles.json`, native files
  under `agents/{codex,opencode}/`, selected runtime docs and benchmark fixtures.
  Keep old model profiles available only for historical telemetry, not dispatch.
- [ ] Fold lessons into a new immutable recipe: paths-first brief, no history
  fork, one contract, eight-step slice, two failed probes then stop, concise
  results. Return the active budgets from the resolver and enforce OpenCode steps.
- [ ] Safely install agent links; update only AW-related router selection and
  add an AW exception to the global Codex Ultra policy. Keep unrelated defaults,
  credentials, provider definitions, router source changes and MCP setup intact.
- [ ] Verify `node --test scripts/*.test.mjs integrations/opencode/*.test.mjs integrations/lifecycle/*.test.mjs`
  and `node scripts/benchmark.mjs`. Verify parser/config and native runtime
  metadata with bounded read-only probes; missing execution proof stays UNKNOWN.
- [ ] Record numeric static before/after values in `LESSONS.md`. No claim of
  measured token efficiency without five matched token-bearing pairs.

Official references checked: developers.openai.com/codex/subagents;
OpenCode agents/permissions documentation via Context7; installed CLI help;
router `src/multi-agent-state.mjs` and `src/codex-agent-catalog.mjs`.
No commits, pushes, upgrades, router code refactors, or long paid benchmarks.
