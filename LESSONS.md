# AW skill improvement experiments

This file contains only measured changes to AW itself. Every new entry must
include a benchmark command plus numeric before/after values. Runtime lessons
from target repositories belong in `LESSONS-REPO.md`. Entries without numbers
are deleted; validated entries already folded into the skill are compressed to
one line (see `references/lessons.md`).

<!-- lessons -->

## 2026-09-07 — Native standard-MCP permissions for worker profiles

- Change: added `codebase-memory-mcp_*` and `context7_*` allow wildcards to the three OpenCode worker/reviewer profiles and `codebase-memory-mcp/*` plus `context7/*` to the Copilot worker tools; task denies and edit restrictions unchanged
- Benchmark: `node --test scripts/*.test.mjs integrations/opencode/*.test.mjs integrations/lifecycle/*.test.mjs`; `node scripts/benchmark.mjs --write`
- Live proof: OpenCode 1.18.29 via `aw-glm-worker` completed `codebase-memory-mcp_list_projects` and `context7_resolve-library-id` (2/2 live MCP probes)
- Before: 45/45 tests, 322 entrypoint words (~605 estimated tokens), 1,431 average route estimated tokens
- After: 46/46 tests, 357 entrypoint words (~668 estimated tokens), 1,532 average route estimated tokens
- Delta: tests +1; entrypoint +35 words and +63 estimated tokens; average route +101 estimated tokens; efficiency verdict not asserted (no five matched comparison pairs)
- Status: pending

## 2026-09-07 — Evidence-seeking teacher gauntlet and resolved prompt profiles

- Change: replaced v3 with frozen worker/teacher contracts, composable harness/model prompt profiles, a bounded main-mediated Sol teacher loop, lean TDD workflows, prompt-free v4 actor timelines, compact waste diagnostics, strict teacher-quality promotion gates, dedicated OpenCode profiles, and a ten-variant auto-research backlog
- Benchmark: `node --test scripts/*.test.mjs integrations/opencode/*.test.mjs integrations/lifecycle/*.test.mjs`; `node scripts/benchmark.mjs --write`; native OpenCode GLM profile probe; isolated two-turn Sol teacher canary; outer ordering-invariant probe; prompt-leak scan of stored v4 evidence
- Before: v3 had 36/36 deterministic tests, static routing 9/9, 349 entrypoint words (~702 estimated tokens), 1,435 average resolved-route estimated tokens, no model-aware prompt resolver, no bounded teacher state machine, and no queryable teacher/waste metrics
- After: v4 has 45/45 deterministic tests, static routing, native-profile resolution, and prompt-profile resolution 10/10 each, 322 entrypoint words (~605 estimated tokens), 1,431 average resolved-route estimated tokens; OpenCode proved `venice/z-ai-glm-5-3-flash` from native metadata; the teacher used one ASK and one FINAL on the same thread, answer/actionable/post-green rates were all 1.0, and no stored raw case text was found
- Delta: tests +9; routes +1; entrypoint −27 words and −97 estimated tokens (−13.8%); average resolved route −4 estimated tokens (−0.3%); OpenCode direct preflight consumed 37,865 tokens; the two Sol turns consumed 50,001 native tokens and produced one `duplicate_context` event with 48,000 estimated wasted tokens
- Result: keep v4 infrastructure; productive efficiency remains `insufficient-data` until five matched, fully attested pairs exist per comparable cell; revise direct CLI context loading before treating live canaries as representative
- Lesson: resolve and prove the native model, keep prompt genes immutable and selectively loaded, let low-evidence workers request a bounded teacher, and measure every actor separately—contract correctness can coexist with severe harness-context overhead
- Status: pending

## 2026-09-06 — Staged evidence flywheel with actor-level v3 telemetry

- Change: added bounded weekly auto-research for Codex, OpenCode, and GitHub Copilot; immutable prompt recipes; prompt-free lifecycle adapters and actor evidence; explicit GLM→Luna provenance; host-only quality/work attestations; task-paired cell comparisons; strict-gain single-mutation promotion; separate research tokens; and a nine-method backlog
- Benchmark: failing baseline pressure test with GLM then explicit Luna fallback; `node --test scripts/*.test.mjs integrations/**/*.test.mjs`; `node scripts/benchmark.mjs --write`; skill quick validation and syntax checks
- Before: 2 documented harnesses; 13 legacy usage records, 9 token-bearing and 4 errors; no actor/model/task/recipe/verified-success fields; 16/16 tests; 459 entrypoint words (~839 estimated tokens); 1,461 average route estimated tokens
- After: 3 harnesses; v3 actor-level schema, lifecycle adapters, attestations, prompt recipes, and frozen evaluator; 36/36 tests; static routing 9/9; 349 entrypoint words (~702 estimated tokens); 1,435 average route estimated tokens; paid live GLM benchmark unavailable with HTTP 402 and therefore retained only as historical-not-current
- Delta: harness coverage +1; tests +20; entrypoint −110 words (−24.0%) and −137 estimated tokens (−16.3%); average route context −26 estimated tokens (−1.8%); verified operational before/after pairs 0
- Result: keep infrastructure; efficiency verdict remains `insufficient-data` until at least 5 matched v3 pairs exist in a comparable cell
- Lesson: total tokens require every used actor; quality and accepted work require separate host attestation; generic fallback, unproved models, heterogeneous cells, or equal-without-gain candidates cannot promote
- Status: pending

## 2026-09-06 — Native default agents with runtime-model preflight

- Change: OpenCode dispatch now defaults to native `general` (implementation plus fresh read-only review) and `explore` (discovery); custom `aw-glm-worker`/`aw-glm-review` profiles became optional user-approved compatibility fallbacks; added a required runtime-model preflight (child message providerID/modelID is proof, resolved config is not; stop on mismatch or unknown; no per-call task model parameter) and a host evidence contract (n/N scope, real exit codes, semantic comparison, UNKNOWN-not-PASS, host direct validation after one bounded correction request)
- Benchmark: `node --test scripts/aw-v2-contract.test.mjs scripts/usage.test.mjs integrations/opencode/aw-usage.test.mjs` and `node scripts/benchmark.mjs --write` (static only; no paid live benchmark — Venice key spend previously exhausted and no user-approved live need)
- Before: 405 entrypoint words (~735 est. tokens); Ø route context 1,069 est. tokens; 12/12 tests; mandatory custom profile install documented
- After: 459 entrypoint words (~839 est. tokens); Ø route context 1,461 est. tokens; 16/16 tests (4 default-role/preflight/evidence regressions + 1 usage-tracking test)
- Delta: entrypoint +54 words (+104 est. tokens); Ø route context +392 est. tokens (preflight and evidence-detail cost); tests +4; live routing comparison pending
- Result: pending — verdict after five matched runs per route under cohorts pre-default-roles vs default-roles-v1
- Lesson: resolved config proves intent, not runtime; only native child message providerID/modelID proves the executed model, and a cached session keeps old routing until a real reload
- Status: pending

## 2026-08-31 — Native usage cohorts replace repeated synthetic benchmarking

- Change: added an OpenCode event plugin that records prompt-free per-AW token totals, routes, reroutes, worker follow-ups, teacher calls, and errors; added local cohort marking and route-stratified median comparison with a five-run minimum; kept the synthetic live benchmark only as an approved-change regression gate
- Benchmark: `node --test scripts/aw-v2-contract.test.mjs scripts/usage.test.mjs integrations/opencode/aw-usage.test.mjs`, `node scripts/benchmark.mjs --write`, and one fresh `opencode run --format json` AW smoke session
- Before: no automatic native usage records; no cohort comparison; 9 contract/telemetry tests; 400 entrypoint words (~716 est. tokens); Ø route context 1,050 est. tokens
- After: one automatic smoke record with route `direct`, 61,031 observed tokens, 1 error, and no prompt content; 12/12 tests; 405 entrypoint words (~735 est. tokens); Ø route context 1,069 est. tokens; static routing 9/9
- Delta: automatic records 0→1; tests +3; entrypoint +19 est. tokens; Ø route context +19 est. tokens; live quality comparison pending five matched runs per route and unavailable now because the Venice key spend limit was reached
- Result: keep infrastructure; optimization verdict remains pending
- Lesson: native completed-message events provide exact, deduplicated OpenCode token totals at near-zero prompt cost; compare only matched routes with at least five runs and treat missing cohorts as insufficient data
- Status: pending

## 2026-08-31 — Host-split runtimes, domain-neutral routing, and user-gated learning

- Change: split `references/runtimes.md` into per-host files loaded singly; added brief-lint and evidence-return gates to the contracts; reworded routes domain-neutrally with an explicit closest-route escape; replaced ad-hoc lesson writing with automatic `FRICTION:`/`USAGE:` logging plus a user-invoked `$aw learn` optimization loop with decay rules
- Benchmark: `node --test scripts/aw-v2-contract.test.mjs` and `node scripts/benchmark.mjs --live --write` across nine routing use cases
- Before: 305 entrypoint words (~554 est. tokens); Ø route context 1,028 est. tokens; live 9/9 routes at 14,013 total tokens (3,765 instruction chars); 8/8 contract tests
- After: 400 entrypoint words (~716 est. tokens); Ø route context 1,050 est. tokens; live 9/9 routes at 14,365 total tokens (4,698 instruction chars); 9/9 contract tests
- Delta: entrypoint +162 est. tokens; Ø route context +22 est. tokens (host split saved ~190 per dispatch, gates+learning+escape cost ~184); live total +352 tokens (+2.5%); tokens_per_correct_route 1,557 → 1,596; routing held 9/9
- Result: keep
- Lesson: capability additions (automatic friction/usage logging, user-gated `$aw learn`, brief lint, domain-neutral routing) cost ~2.5% live context because the host-split runtimes offset most of it — pair every capability addition with a structural saving
- Status: validated

## 2026-08-30 — Progressive disclosure cuts AW startup and sharpens routing (folded)

- Keep only stable routing and contracts in `SKILL.md`; load one runtime/workflow/teacher reference after the route is known. Measured: entrypoint 1,271→305 words (−76%), ~2,377→~554 estimated initialization tokens, 16,100→13,932 live total tokens, 0/9→9/9 exact live routes.

## 2026-08-30 — Benchmark through the worker's native pure runtime (folded)

- Benchmark GLM workflows in the same minimal native runtime they will use (OpenCode `--pure`, fenced-JSON tolerant parser); reserve Codex context for the Sol teacher. Measured: reported benchmark context −91% versus nested Codex; 9/9 routes at 13,932 total tokens.

## 2026-08-30 — Isolate and constrain the Codex teacher invocation (folded)

- Isolate the teacher operationally (empty dir, read-only sandbox, ignored config) and repeat the output grammar in turn one; use one resumable thread. Measured: input tokens 21,833→18,933 (−13.3%); exact teacher contract 0/1→1/1; tool calls 0.
