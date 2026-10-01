# Repository-specific lessons

Historical lessons captured while AW worked on target repositories. New entries
should live in the target repository when writable; this file is the fallback.
Never store secrets, full prompts, full histories, or whole diffs.
Use Failure / Cause / Prevention / Evidence for new entries; numeric data is
optional. Historical headings below have no supporting detail and are not
verified causal lessons. Recover evidence before turning them into rules.

<!-- lessons -->

EXPERIMENT: 2026-09-06-default-native-glm

## 2026-09-06 — Runtime model must be proven, not configured
- Root cause: an AW child dispatched under a new OpenCode profile still executed the old cached pipeline config; the builder reported a partial 14/44 gate check and palette-index diffs as passes, and the audit only found the missing return afterward.
- Intervention: default to native `general` (implementation + fresh read-only review) and `explore` agents; require a cheap read-only runtime-model preflight (child message providerID/modelID; resolved config and self-identification are not proof); stop dispatch on mismatch or unknown; host re-validates incomplete, contradictory, or stale evidence directly and reports scope as n/N with real exit codes.
- Verification: contract tests in `scripts/aw-v2-contract.test.mjs` cover default-native routing, preflight proof, stop-on-mismatch, and UNKNOWN-not-PASS; static benchmark before/after recorded in `LESSONS.md`.
- Prevention: treat a running OpenCode session's config as stale after profile edits; reload and re-probe before dispatch. A SKILL edit never reloads configuration.

EXPERIMENT: 2026-08-31-host-split-learn-loop

## 2026-08-28 — Group artifact phases at the inventory seam
## 2026-08-27 — Source-background and local-reasoning boundaries
## 2026-08-19 — YouTube media 403 recovery
## 2026-08-13
## 2026-08-14
## 2026-08-17 — Matt skills weekly check
## 2026-08-19 — SmartTube YouTube Feed vendor + 720p cache
## 2026-08-19 — Venice Luna default after stalled LLM switch
## 2026-08-19 — Pipeline catch-up: stale outbox 409 + 403 retries
## 2026-08-19 — OpenCode catalogs + local Qwen DFlash2
## 2026-08-19 — Master 720p files are the offline cache, not live SmartTube
## 2026-08-27 — yt-viewer-v2 auth recovery
## 2026-08-27 — Stitchcraft quality-loop continuity and visual rendering
## 2026-08-27 — Stitchcraft Qwen path was indirect, not direct-pattern
## 2026-08-27 — Direct-Qwen worker delivered core but deferred integration
## 2026-08-27 — Venice Qwen strict-schema preflight remained malformed
## 2026-08-27 — Single-grid RLE proved output-size failure
## 2026-08-27 — Simple three-call GLM probe exposed useful inherent capability
## 2026-08-27 — Semantic recognizability is not source fidelity
