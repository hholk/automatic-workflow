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
