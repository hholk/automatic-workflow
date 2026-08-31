# AW skill improvement experiments

This file contains only measured changes to AW itself. Every new entry must
include a benchmark command plus numeric before/after values. Runtime lessons
from target repositories belong in `LESSONS-REPO.md`.

<!-- lessons -->

## 2026-08-30 — Progressive disclosure cuts AW startup and sharpens routing

- Change: replaced the monolithic supervisor/plugin stack with a 305-word entrypoint, conditional references, five workflows, and native GLM roles
- Benchmark: `node --test scripts/aw-v2-contract.test.mjs` and `node scripts/benchmark.mjs --live --write` across nine routing use cases
- Before: 1,271 entrypoint words; ~2,377 estimated initialization tokens; 9,496 live instruction characters; 0/9 exact live routes; 16,100 live total tokens; 0/7 v2 contract tests
- After: 305 entrypoint words; ~554 estimated initialization tokens; 3,766 live instruction characters; 9/9 exact live routes; 13,932 live total tokens; 8/8 contract tests
- Delta: words −76.0%; estimated initialization tokens −76.7%; instruction characters −60.3%; live total tokens −13.5%; exact routing +9 cases
- Result: keep
- Lesson: keep only stable routing and contracts in `SKILL.md`; load one runtime/workflow/teacher reference after the route is known
- Status: validated

## 2026-08-30 — Benchmark through the worker's native pure runtime

- Change: replaced the nested Codex live benchmark with OpenCode `--pure` using Venice GLM 5.3 Flash, then accepted fenced JSON explicitly
- Benchmark: one nine-case Codex run, two initial OpenCode runs, parser regression, and two repeated OpenCode before/after runs
- Before: Codex reported 154,212 input tokens for 9/9 routes; both first OpenCode runs failed parsing fenced JSON (0/2 completed)
- After: final OpenCode v2 reported 13,932 total tokens and 9/9 exact routes; fenced/unfenced parser test passes and both repeated runs completed (2/2)
- Delta: reported benchmark context at least −91.0% versus nested Codex; completed live comparisons +2
- Result: keep
- Lesson: benchmark GLM workflows in the same minimal native runtime they will use; reserve Codex subscription context for the Sol teacher only
- Status: validated

## 2026-08-30 — Isolate and constrain the Codex teacher invocation

- Change: added an empty working directory, read-only sandbox, ignored user/rule config, disabled optional skill/plugin/app features, and an exact one-line teacher response prefix
- Benchmark: two isolated `codex exec -m gpt-5.6-sol` response-1 smoke tests with identical architecture evidence
- Before: 21,833 input tokens; response followed the requested fields but omitted the literal `FINAL:` contract marker
- After: 18,933 input tokens; exact `FINAL | WHY | GLM_STEPS | RISKS | VERIFY` contract and no tool event
- Delta: input tokens −13.3%; exact teacher contract 0/1 → 1/1; tool calls remained 0
- Result: keep
- Lesson: isolate the teacher operationally and repeat the output grammar in the first turn; use one resumable thread rather than resending history
- Status: validated

## 2026-08-17 — Verification fingerprints and observation thresholds
## 2026-08-17 — Canonical Markdown write permission parity
## 2026-08-17 — Orchestrator write permission parity
## 2026-08-17 — Active Sol npm build verification parity
## 2026-08-17 — Canonical Sol YAML permission nesting
## 2026-08-17 — Sol wording, verification permissions, and runtime exit metadata
## 2026-08-17 — Sol Markdown frontmatter indentation
## 2026-08-17 — Canonical Sol deploy deny parity
## 2026-08-17 — Sol release command boundary
## 2026-08-17 — Active flash-review verification allowlist
## 2026-08-17 — Depth, permissions, and optional parallel progress
## 2026-08-17 — Active review/Sol runtime drift
## 2026-08-17 — Active runtime permission synchronization
## 2026-08-17 — Hook arguments and role/evidence boundaries
## 2026-08-17 — Active AW role matrix repair
## 2026-08-17 — Active reviewer/Sol shell policy repair
## 2026-08-17 — AW Sol read-only profile security repair
## 2026-08-17 — AW repeated tool result predicate
## 2026-08-17 — AW review defect: doom-loop and legacy profiles
## 2026-08-17 — AW supervisor review repair
## 2026-08-17 — AW-2.0 contract correction
## 2026-08-17
