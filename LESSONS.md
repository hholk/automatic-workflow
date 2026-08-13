# Flash Orchestrator — Lessons (meta-loop capture)

Append one structured entry per forecast mismatch before close; routine runs log nothing.
Required fields: Date, Todo/Playbook, forecast vs actual/check-in count,
symptom/evidence, root cause, orchestrator intervention, proposed
skill/playbook change, status: pending|promoted|validated.
Noteworthy triggers include orchestrator rework, material forecast overrun,
repeated check-ins, avoidable routing errors, and user hang intervention.
Lessons remain after promotion and may be archived only after later validation.

<!-- lessons -->

## 2026-08-13

- Date: 2026-08-13
  Todo/Playbook: Forecast-Mismatches / native sessions
  forecast vs actual/check-in count: planned synchronous task; actual synchronous task blocked advertised check-ins
  symptom/evidence: long task blocked the advertised check-in
  root cause: long read-only work used a blocking route instead of a native async session
  orchestrator intervention: route read-only intervention through native async read-only sessions; keep bounded write checkpoints
  proposed skill/playbook change: use aw_spawn with explicit status/read/control and bounded foreground writes
  status: promoted
  validation note: validation pending fresh real smoke

- Date: 2026-08-13
  Todo/Playbook: TTS root-cause escalation / diagnose
  forecast vs actual/check-in count: one guru escalation expected; actual required one rejected dispatch plus one corrected redispatch
  symptom/evidence: flash-guru-debug returned NEEDS_CONTEXT without technical analysis because the brief omitted the literal `FIRST_ATTEMPT_STATUS: FAILED` contract field
  root cause: the orchestrator supplied the failed probes narratively but did not encode the guru's required escalation-status marker
  orchestrator intervention: resent the same read-only evidence packet with explicit failed status, expected behavior, and observed result; the second run resolved the 4096-frame TTS limit
  proposed skill/playbook change: add a guru-escalation brief checklist requiring `FIRST_ATTEMPT_STATUS`, failed probe, expected result, and observed output before dispatch
  status: pending
