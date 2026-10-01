# AW skill improvement experiments

This file contains AW improvement experiments and actionable usage lessons.
Performance claims require numeric before/after values and a verify command.
Qualitative lessons retain Failure / Cause / Prevention / Evidence; unresolved
hypotheses stay explicit. Repository root causes belong in LESSONS-REPO.md.
See `references/lessons.md` for measurement and retention rules.

 <!-- lessons -->

## 2026-09-21 — Acceptance-first routing and consistent handbacks

- Change: direct execution precedes ordinary delegation; one worker return contract with explicit unfinished work; main constructs teacher evidence; bounded-v3 permits one explicitly authorized new probe; main verifies the integrated output; teacher/review are conditional; qualitative lessons are retained; quality-v2 treats worker shares as diagnostics. Active playbook: acceptance-routing-v4. Existing model bindings are unchanged.
- Hypothesis: fewer unnecessary handoffs and contract repairs lower total cost per accepted task without reducing main-agent output quality.
- Benchmark: `node --test scripts/*.test.mjs integrations/opencode/*.test.mjs integrations/lifecycle/*.test.mjs`; `node scripts/benchmark.mjs`; `git diff --check`.
- Before / After / Delta: tests 52/52 → 54/54 (+2 regressions, both observed failing before fixes); static routing/profile cases 10/10 → 11/11; entrypoint 367 → 366 words (−1), 698 → 695 estimated tokens (−3); mean context over the same original ten cases 1445 → 1542 estimated tokens (+97, +6.7%). The new direct case is excluded from that mean for comparability.
- Evidence: local baseline telemetry had 36 v4 runs, 5 quality-eligible runs, and 0 combining eligibility with complete total-token data. Independent read-only review found no material defects. Static checks do not establish live routing accuracy, savings or output quality parity.
- Result: keep corrected instructions and evaluator; measured efficiency remains insufficient-data. Next evidence is five matched main-only/AW task pairs with identical acceptance criteria and all actor costs included, following references/lessons.md.
- Lesson: handoff cost includes context, verification and repair. Higher worker share is not a useful optimization target; DONE ends a worker turn and cannot substitute for accepted task completion.
- Status: pending


## 2026-09-13 — Host-bound Astra teacher, DeepSeek-only workers, bounded context

- Change: resolver now returns model+provider+native agent+budget together; Astra teacher is `gpt-6-astra` via `openai` on Codex and `venice/openai-gpt-6-astra` on OpenCode; every worker route is DeepSeek with no alternate-model fallback; new `bounded-v2` recipe (1600-token brief, 8 steps, 2 failed hypotheses, 300-word single contract); Codex agents installed as regular 0600 files (O_NOFOLLOW); child skill instructions and plugins disabled; hidden Luna vision bridge off; only Matt skills + AW active
- Benchmark: `node --test scripts/*.test.mjs integrations/opencode/*.test.mjs integrations/lifecycle/*.test.mjs`; `node scripts/benchmark.mjs`; `python3 scripts/verify_aw_setup.py`; native OpenCode DeepSeek/Astra probes; native Codex Astra→DeepSeek spawn canary
- Before: 45/46 tests (1 failing), entrypoint 357 words (~670 est. tokens), average route 1,538 est. tokens, broken GLM symlinks, Codex default child GLM, teacher Sol
- After: 52/52 tests, entrypoint 348 words (~666 est. tokens), average route 1,410 est. tokens, routing 10/10, profiles 10/10, setup checks 32/32; OpenCode proved `venice/deepseek-v4-1-flash` and `venice/openai-gpt-6-astra` from native metadata; Codex proved `openai/gpt-6-astra` root and `codex-router/venice/deepseek-v4-1-flash` child
- Delta: tests +7; entrypoint −9 words and −4 est. tokens; average route −128 est. tokens (−8.3%); Codex root input 101,798→72,520 (−28.8%) after disabling child skill instructions/plugins; OpenCode Astra teacher 1,874 tokens with zero tools; DeepSeek child still 137,249 input tokens
- Result: keep; productive efficiency remains `insufficient-data` until five matched, token-bearing pairs per cell
- Lesson: bind provider and agent with the model, install Codex roles as regular files (symlinks are discovered but rejected at spawn), and disable child skill/plugin context — but Codex child fork/context overhead can still dominate and must be measured per run
- Status: pending

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
