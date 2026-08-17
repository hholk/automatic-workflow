# Flash Orchestrator — Lessons (meta-loop capture)

Append one compact structured entry after every meaningful orchestrator feedback,
worker result, or checkpoint, including routine success, failures, infra/tool
errors, inefficient workflows, wrong assignment, interventions, scope drift,
and user corrections. Never store secrets, private full prompts, complete tool
history, or entire diffs. Required fields: Date, Todo/Playbook, feedback/result,
symptom/evidence, root cause or contributing factor, routing/intervention,
prevention lesson, status: pending|promoted|validated.
Lessons remain after promotion and may be archived only after later validation.

<!-- lessons -->

## 2026-08-17

- Date: 2026-08-17
  Todo/Playbook: AW lesson capture and guarded next steps / implement
  feedback/result: helper and documentation changes completed; all declared probes passed
  symptom/evidence: 18 supervisor tests, 13 native plugin tests, contract PASS, and diff check exit 0
  root cause or contributing factor: lifecycle rules were inconsistent and lacked pure helper coverage
  routing/intervention: added `buildLessonEntry` and `nextStepOptions`, then aligned core docs and playbooks
  prevention lesson: test compact metadata, routine success capture, exact option count, and human-gated release wording
  status: validated

## 2026-08-13

- Date: 2026-08-13
  Todo/Playbook: Forecast-Mismatches / native sessions
  feedback/result: planned synchronous task; actual synchronous task blocked advertised check-ins
  symptom/evidence: long task blocked the advertised check-in
  root cause or contributing factor: long read-only work used a blocking route instead of a native async session
  routing/intervention: route read-only intervention through native async read-only sessions; keep bounded write checkpoints
  prevention lesson: use aw_spawn with explicit status/read/control and bounded foreground writes
  status: promoted
  validation note: validation pending fresh real smoke

- Date: 2026-08-13
  Todo/Playbook: TTS root-cause escalation / diagnose
  feedback/result: one guru escalation expected; actual required one rejected dispatch plus one corrected redispatch
  symptom/evidence: flash-guru-debug returned NEEDS_CONTEXT without technical analysis because the brief omitted the literal `FIRST_ATTEMPT_STATUS: FAILED` contract field
  root cause or contributing factor: the orchestrator supplied the failed probes narratively but did not encode the guru's required escalation-status marker
  routing/intervention: resent the same read-only evidence packet with explicit failed status, expected behavior, and observed result; the second run resolved the 4096-frame TTS limit
  prevention lesson: add a guru-escalation brief checklist requiring `FIRST_ATTEMPT_STATUS`, failed probe, expected result, and observed output before dispatch
  status: pending

## 2026-08-14

- Date: 2026-08-14
  Todo/Playbook: Unified Google/YouTube OAuth / implement + review + fix
  forecast vs actual/check-in count: one 20-minute implementation plus one review expected; actual required two red reviews, one worker fix, and one main-takeover fix
  symptom/evidence: the first implementation left npm/pnpm metadata inconsistent; the first fix aligned Google Auth but not `googleapis-common`, so the second review remained red
  root cause: the implementation and fix briefs checked the conflicting client package but did not require an exact cross-manager comparison of the full Google dependency trio before completion
  orchestrator intervention: pinned the already-used `googleapis`/`googleapis-common` versions, synchronized both lockfiles, reran frozen dependency checks, Auth tests, builds, and Frontend flow tests
  proposed skill/playbook change: when a write changes package sources or overrides in a repo with multiple tracked lockfiles, require exact root/transitive version comparison across every manager before worker DONE; review cast rules should apply to newly introduced compatibility casts, not unrelated pre-existing casts
  status: pending

- Date: 2026-08-14
  Todo/Playbook: Qwen supplied-segment chunking and three-video publish / implement + fast + diagnose
  forecast vs actual/check-in count: one implementation and one publish checkpoint expected; actual required one test-runner reroute, one dirty-baseline reroute, and one lifecycle diagnosis
  symptom/evidence: the implementation worker stopped because the generated plan prescribed unavailable pytest although the package uses unittest; the first publish worker then treated the task's own expected diffs and a known pre-existing cache diff as unexpected
  root cause: briefs did not bind test commands to the repository's verified runner and did not encode expected dirty files as an explicit allowed baseline distinct from forbidden mutations
  orchestrator intervention: rerouted TDD through `python3 -m unittest`, supplied an explicit hash-protected dirty baseline, completed generation/publish, then diagnosed the later health failure as the configured 180-second idle exit
  proposed skill/playbook change: implement plans must reuse a previously proven package-local test command; operational fast briefs in dirty worktrees must list allowed baseline paths and compare pre/post hashes instead of treating baseline dirtiness as a stop condition
  status: pending

- Date: 2026-08-14
  Todo/Playbook: Qwen sentence chunking and abbreviation dictionary / implement + fix + review
  forecast vs actual/check-in count: one implementation plus one review expected; actual required two punctuation fixes, three metric clarifications, one main-takeover abbreviation fix, and three reviews
  symptom/evidence: a resumed metric worker rejected an abbreviated brief; later reports contradicted `min=2` with “no chunks <20” and omitted the requested exact records; adversarial review then exposed compact-abbreviation splitting and one imprecise documentation claim
  root cause: resumed tasks did not retain the full route contract, aggregate metric acceptance was not machine-schema-enforced, and the first test matrix did not include real production punctuation/abbreviation sequences before implementation
  orchestrator intervention: resent the full brief, required exact chunk records, traced real `' .'` fragments, added punctuation-fragment and dotted-abbreviation regressions, introduced the preprocessing dictionary, reran real-video probes, and tightened documentation wording
  proposed skill/playbook change: every resumed task must repeat PLAYBOOK/READ-WRITE/STOP/VERIFY; metric briefs must require raw records for every outlier and internally assert aggregate/list consistency; TTS splitter briefs should seed tests from observed production substrings before general regex work
  status: pending

## 2026-08-17 — Matt skills weekly check

- Date: 2026-08-17
  Todo/Playbook: Matt skills upstream maintenance / AW intake
  forecast vs actual/check-in count: one bounded remote check; no background daemon
  symptom/evidence: local checkout advanced from 5d78bd0903420f97c791f834201e550c765699f8 to upstream main 9c9f36ccd3995266cd675468af71639c8dde1ec5; OpenCode symlinks already resolve through ~/.local/share/agent-skills/mattpocock-skills
  root cause: shared Matt checkout was behind upstream
  orchestrator intervention: fast-forwarded the clean shared checkout; preserved OpenCode's existing symlink-based installation
  proposed skill/playbook change: run scripts/check-matt-skills.mjs at AW intake no more than once every seven days; record every check/update here
  status: promoted
