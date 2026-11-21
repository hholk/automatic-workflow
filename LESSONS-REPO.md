# Repository-specific lessons

Historical lessons captured while AW worked on target repositories. New entries
should live in the target repository when writable; this file is the fallback.
Never store secrets, full prompts, full histories, or whole diffs.
Use Failure / Cause / Prevention / Evidence for new entries. Numeric data is
optional. Recover evidence before turning a historical observation into a rule.

<!-- lessons -->

EXPERIMENT: 2026-09-06-default-native-glm

## 2026-09-06 — Runtime model must be proven, not configured
- Root cause: an AW child dispatched under a new OpenCode profile still executed the old cached pipeline config; the builder reported a partial 14/44 gate check and palette-index diffs as passes, and the audit only found the missing return afterward.
- Intervention: default to native `general` (implementation + fresh read-only review) and `explore` agents; require a cheap read-only runtime-model preflight (child message providerID/modelID; resolved config and self-identification are not proof); stop dispatch on mismatch or unknown; host re-validates incomplete, contradictory, or stale evidence directly and reports scope as n/N with real exit codes.
- Verification: contract tests in `scripts/aw-v2-contract.test.mjs` cover default-native routing, preflight proof, stop-on-mismatch, and UNKNOWN-not-PASS; static benchmark before/after recorded in `LESSONS.md`.
- Prevention: treat a running OpenCode session's config as stale after profile edits; reload and re-probe before dispatch. A SKILL edit never reloads configuration.
