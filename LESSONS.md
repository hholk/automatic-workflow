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

## 2026-08-17 — Sol Markdown frontmatter indentation

- Date: 2026-08-17
- Todo/Playbook: canonical Sol frontmatter / fix
- feedback/result: malformed bash mapping prevented YAML parsing
- symptom/evidence: YAML parser rejected `git push*` at inconsistent indentation
- root cause: trailing bash deny entries were indented outside `permission.bash`
- orchestrator intervention: aligned entries and added four-profile delimiter/indentation regression
- prevention lesson: parse canonical Markdown frontmatter in the contract test
- status: validated

## 2026-08-17 — Canonical Sol deploy deny parity

- Date: 2026-08-17
- Todo/Playbook: Sol deploy permissions / fix
- feedback/result: canonical Sol policies needed active runtime deploy denies
- symptom/evidence: active contract denied deploy variants while YAML/Markdown omitted them
- root cause: canonical descriptors drifted from the effective mutation deny matrix
- orchestrator intervention: added `deploy*`, `npm run deploy*`, and `pnpm run deploy*` to both profiles and asserted parity
- prevention lesson: contract-test every canonical mutation deny shared with active runtime policy
- status: validated

## 2026-08-17 — Sol release command boundary

- Date: 2026-08-17
- Todo/Playbook: Sol release permissions / fix
- feedback/result: release commands needed explicit denies in active and canonical Sol policies
- symptom/evidence: deploy and publish were denied, but release patterns were absent
- root cause: release-specific shell vectors were not included in the mutation deny contract
- orchestrator intervention: denied release, npm/pnpm release, and publish patterns and added active-profile assertions
- prevention lesson: keep release and publish vectors explicit in every gated contributor policy
- status: validated

## 2026-08-17 — Active flash-review verification allowlist

- Date: 2026-08-17
- Todo/Playbook: flash-review safe verification permissions / fix
- feedback/result: active reviewer bash policy lacked canonical test, lint, typecheck, and build commands
- symptom/evidence: wildcard bash deny had no safe verification exceptions; contract assertion covered verification only for Sol
- root cause: active reviewer policy and effective-config contract had drifted from the canonical verification profile
- orchestrator intervention: added deny-first verification allowlist and explicit mutation/release denials; generalized active assertions
- prevention lesson: assert safe verification patterns and every mutation vector for each read-only active profile
- status: validated

## 2026-08-17 — Depth, permissions, and optional parallel progress

- Date: 2026-08-17
- Todo/Playbook: confirmed AW contract improvements / implement
- feedback/result: active depth and role matrices plus parallel guidance needed explicit enforcement
- symptom/evidence: depth was absent; safe verification/build allowances and non-binding parallel wording were incomplete
- root cause: runtime config and documentation had drifted from the intended bounded delegation contract
- orchestrator intervention: added depth 2, deny-first role capabilities, soft parallel-progress guidance, and regressions
- prevention lesson: contract-test effective config, role boundaries, and optional rather than mandatory fan-out semantics
- status: validated

## 2026-08-17 — Active review/Sol runtime drift

- Date: 2026-08-17
- Todo/Playbook: independent runtime permission review / fix
- feedback/result: active flash-review and aw-sol-expert matrices diverged from intended roles
- symptom/evidence: reviewer permitted edit/write; Sol denied edits and lacked safe verification commands; default-config assertions were swallowed
- root cause: effective config checks treated all failures as optional when only an absent explicit override should be skippable
- orchestrator intervention: repaired the two active permission blocks and narrowed contract-test skip behavior to absent overridden configs
- prevention lesson: always enforce the default active config and test deny-first shell policy plus gated verification allowlists
- status: validated

## 2026-08-17 — Active runtime permission synchronization

- Date: 2026-08-17
- Todo/Playbook: runtime role matrix drift / fix
- feedback/result: active worker task routing and Sol contributor permissions diverged from canonical profiles
- symptom/evidence: worker task was broadly allowed; Sol lacked write capability and safe verification allowlist
- root cause: effective host config was not contract-tested against the canonical deny-first and gated-contributor matrices
- orchestrator intervention: synchronized only the active worker/Sol blocks and asserted safe commands plus mutation denies
- prevention lesson: test effective permission objects, ordering, verification allowlists, and every shell mutation vector
- status: validated

## 2026-08-17 — Hook arguments and role/evidence boundaries

- Date: 2026-08-17
- Todo/Playbook: P0 hook and role/evidence improvements / implement
- feedback/result: corrected before-hook argument source, non-binding checkpoint suggestion, LSP limitation, and bounded verification sensor
- symptom/evidence: OpenCode before args arrive on output; absent LSP counts must not become zero; Sol needs gated contributor capability
- root cause: host hook/API semantics and canonical/effective role policies were underspecified
- routing/intervention: use output.args fallback, preserve exactly three next-step options, allow safe verification, and keep release/destructive gates explicit
- prevention lesson: contract-test hook signatures, sensor evidence shape, deny-first task permissions, and active profile parity
- status: pending

## 2026-08-17 — Active AW role matrix repair

- Date: 2026-08-17
- Todo/Playbook: final review permissions / fix
- feedback/result: effective flash-worker lacked write permissions; active orchestrator block was absent
- symptom/evidence: host config denied worker task and had no `aw-orchestrator` entry; reviewer shell policy required explicit deny-first ordering
- root cause: canonical role intent and effective host permissions had drifted apart
- orchestrator intervention: aligned worker allow permissions, added deny-first reviewer protections, and added host-configurable primary orchestrator
- prevention lesson: contract-test effective role matrices, exact orchestrator fields, and shell mutation protections
- status: validated

## 2026-08-17 — Active reviewer/Sol shell policy repair

- Date: 2026-08-17
- Todo/Playbook: active permission security defect / fix
- feedback/result: active flash-review allowed `bash *`; Sol was not explicitly present in the active config
- symptom/evidence: wildcard bash allow permitted redirection, scripts, and file mutation despite edit denial
- root cause: canonical read-only profile metadata was not enforced in the effective host config
- orchestrator intervention: denied bash wildcard before a narrow read-only allowlist, added active aw-sol-expert, and asserted dangerous shell vectors statically
- prevention lesson: test effective active permission blocks, key ordering, and deny-by-default policy separately from canonical descriptors
- status: validated

## 2026-08-17 — AW Sol read-only profile security repair

- Date: 2026-08-17
- Todo/Playbook: final review security defect / fix
- feedback/result: Sol's Markdown profile allowed edits and YAML did not clearly deny writes
- symptom/evidence: both Sol descriptors contained `edit: allow`; no write or destructive-bash deny contract existed
- root cause: read-only intent was documented in prose but not enforced consistently in profile metadata
- orchestrator intervention: denied edit/write/task for Sol, denied destructive bash patterns, and added reviewer/Sol versus worker/orchestrator contract regressions
- prevention lesson: security-sensitive role intent must be asserted in every active profile artifact and distinguish read-only allowances from destructive command denial
- status: validated

## 2026-08-17 — AW repeated tool result predicate

- Date: 2026-08-17
- Todo/Playbook: repeated tool/output detection / fix
- feedback/result: identical input with changed output was vulnerable to a false repeated intent
- symptom/evidence: `previous.output_sig === previous.output_sig` was tautological; output-aware result detection already used the current output
- root cause: the before hook had no current output to compare, but claimed repetition from a self-comparison
- orchestrator intervention: removed the premature before-hook repetition claim and added changed-output and doom-loop regressions
- prevention lesson: only mark tool repetition after matching current tool, input, and output; validate active profiles with CLI smoke
- status: validated

## 2026-08-17 — AW review defect: doom-loop and legacy profiles

- Date: 2026-08-17
- Todo/Playbook: independent review defects / fix
- feedback/result: repeated identical tool pairs lacked a bounded doom-loop signal; YAML descriptors diverged from canonical Markdown profiles
- symptom/evidence: sensor summary exposed only the latest repeated pair and legacy YAML used unsupported metadata keys
- root cause: repeated-pair counts and YAML contract parity were not tested at their public seams
- orchestrator intervention: added bounded count-based `doom_loop` observation signals and aligned YAML metadata with Markdown frontmatter
- prevention lesson: contract-test every sensor signal and both intended profile artifacts without treating YAML as active source
- status: validated

## 2026-08-17 — AW supervisor review repair

- Date: 2026-08-17
  Todo/Playbook: independent review findings / fix
  feedback/result: active host registration and current contract checks were missing; supervisor state was unbounded across sessions
  symptom/evidence: host config omitted the supervisor plugin; compaction assumed context; historical lesson text carried the contract test
  root cause: integration lifecycle and process-local memory boundaries were not regression-tested at their public seams
  orchestrator intervention: registered the plugin, added MAX_SESSIONS eviction and defensive compaction, and replaced historical assertions with current behavior checks
  prevention lesson: verify active config conditionally, test bounded multi-session state and every sensor/host boundary, and keep lessons observational
  status: validated

## 2026-08-17 — AW-2.0 contract correction

- Date: 2026-08-17
  Todo/Playbook: AW supervisor documentation/test closure / fix
  feedback/result: remaining contract gaps were closed with explicit assertions
  symptom/evidence: the initial suite omitted direct hook, profile, and risk-boundary checks
  root cause: documentation and tests were not bound to each current AW-2.0 artifact
  orchestrator intervention: added source/profile/lesson assertions and defensive payload/event coverage without control automation
  proposed skill/playbook change: require current assertions for every sensor, host decision boundary, and exactly three numbered next steps
  status: validated

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
