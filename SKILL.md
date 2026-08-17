---
name: aw
description: "Autonomous supervisor workflow with native OpenCode sessions."
user-invocable: true
argument-hint: task
---

# AW 2.0 — autonomous supervisor

Matt Pocock's skills are available through the shared OpenCode skill
directory, including `ask-matt`, `grill-with-docs`, `tdd`, `codebase-design`,
`diagnosing-bugs`, and `implement`. Use them when their workflow is the best
fit; do not copy their contents into AW. At most once every seven days during
AW intake, run `node <skill-root>/scripts/check-matt-skills.mjs`. The check
compares the local checkout with upstream, fast-forwards only a clean checkout,
and records the result in `LESSONS.md`. It is explicit and bounded: there is
no background updater or daemon.

AW is a native OpenCode supervisor, not a runner. Before dispatch, capture the
graph snapshot, complete the full Todo list with `todowrite`, and perform the
handoff before dispatch; OpenCode is the source of
truth: child session state is authoritative and there is no ledger, daemon, PID,
custom runner, token budget, step budget, or mechanical two-fail gate.

The pure supervisor contract lives in `supervisor/supervisor.mjs`. It exposes
checkpoint/help parsing, semantic comparison and stall routing, evidence and
brief normalization, capability/reasoning selection, canonical prompts, and
in-memory telemetry/metrics/memory validation. Hosts call these functions and
decide how to control native sessions; the module has no persistence, daemon,
polling, ledger, or automatic control of native sessions.

## OpenCode sensor layer

`plugin/aw-supervisor.js` is the thin host integration layer. It observes
`tool.execute.before`/`tool.execute.after`, file edits, session diffs, LSP
diagnostics, permission events, session lifecycle events, and
`experimental.session.compacting`. It keeps only bounded, process-local
observations and exposes `aw_supervisor_status`; it never persists a ledger,
stores full prompts/secrets, aborts a worker, or starts Sol automatically.
Hooks provide objective evidence. The Luna orchestrator remains responsible
for choosing continue, context, review, Sol, or human escalation through the
 native OpenCode session tools.
Action-risk is distinct from reasoning-risk: sensors report bounded evidence;
the host owns blast-radius gates and reasoning interventions.

OpenCode agent profiles are real Markdown frontmatter files in
`agents/opencode/`. Install them explicitly into a host's agent directory only
after checking for existing files; do not overwrite user profiles silently:

```sh
for f in agents/opencode/*.md; do
  target="$HOME/.config/opencode/agents/$(basename "$f")"
  test -e "$target" || ln -s "$(pwd)/$f" "$target"
done
```

The worker and reviewer profiles use Venice.ai GPT-5.6 Luna, the expert uses
Sol, and the orchestrator model remains host-configurable. Restart OpenCode
after installing or changing profiles/plugins.

## Roles and model mapping

The canonical active OpenCode role profiles live in `agents/opencode/`; do not
create a redundant `profiles/` directory.

Role is separate from model. The orchestrator model is freely configurable by
the host profile. Worker and reviewer roles map to Venice.ai GPT-5.6 Luna;
expert maps to Sol. Never route with `if model == Luna`; route by role and
capability. Background agents are read-only. Foreground implementation is a
native synchronous task.

## Supervisor loop

Read-only background work uses `aw_spawn` asynchronous native child sessions;
the returned native child session ID is the job ID. `aw_status` and `aw_read`
are explicit pull controls, while a toast is notification only and does not
inject results.

1. Capture a graph snapshot, define the objective and acceptance evidence, then
   dispatch a tight brief. A brief contains `OBJECTIVE`, `SUCCESS`, `CONTEXT`,
   `NON-GOALS`, `INITIAL SCOPE`, `VERIFY`, `HELP`, and `SUPERVISOR`.
2. Evaluate semantic progress at checkpoints, not elapsed time or output size.
   Progress means a materially narrower hypothesis, changed artifact, or new
   passing evidence. Information gain is the change in uncertainty between
   checkpoints; ask for the next discriminating action when it is low.
3. Intervene only for a stall, scope/risk violation, or explicit help request.
   Stall signals are repeated unchanged hypotheses, repeated identical
   failures, no artifact/evidence movement, contradictory evidence, or a
   blocked dependency. One slow but productive worker is not stalled.

After every meaningful feedback, worker result, or checkpoint, append a compact
structured entry to `LESSONS.md`, including routine successes. Required fields:
Date, Todo/Playbook, feedback/result, symptom/evidence, root cause or
contributing factor, routing/intervention, prevention lesson, and status
`pending|promoted|validated`. Omit secrets, private full prompts, complete tool
history, and entire diffs; proactively propose prevention after feedback.

At task close, present exactly three numbered next steps: continue the next
bounded slice; run an independent Luna review or targeted verification; or use
Matt Pocock `code-review`, `writing-for-agents` (or relevant docs skill), and
`implement`/`tdd` as needed to review the current diff/base, update target
project docs, run tests, resolve findings, and request explicit human approval
before commit, push, and deploy. Never auto-deploy or bypass that gate.

## Intervention ladder

Continue with a sharper next action → steer scope or request missing evidence →
route `review` for Luna review → route `context` for Context rescue → route
`sol` for expert reasoning → ask `human` for an irreversible, secret, or
product-decision gate. Supervisor Sol path is explicit: preserve the worker's
evidence, send the failure taxonomy and smallest question, then return advice
to the worker; Sol does not edit.

## Help and evidence contracts

Workers may self-escalate with compact YAML:

```yaml
HELP_REQUEST:
  type: sol # sol | review | context | human
  question: one precise missing decision
  evidence: command/output or file path
  attempted: what was tried
  risk: low | medium | high
```

Every checkpoint and final report records `PROGRESS`, `CURRENT_HYPOTHESIS`,
`EVIDENCE`, `BLOCKED_ON`, `HELP`, and `NEXT`. Final output also includes
structured `VERIFY_EVIDENCE`, `SCOPE_EVIDENCE`, `ACCEPTANCE_EVIDENCE`, and a
`VERIFICATION_SUMMARY` with commands, exit codes, and observed output. Review
is semantic and evidence-based; there is no automatic challenger gate.

## Rescue, memory, and quality

Context rescue narrows the question, retrieves only relevant source-of-truth
facts, and updates the worker brief without dumping prompts. Failure taxonomy:
`scope`, `environment`, `dependency`, `test`, `logic`, `evidence`, and
`human_gate`. Repair memory records symptom, hypothesis, repair, and proof;
stall/intervention memory records signal, ladder rung, outcome, and information
gain. An optional compact expert skillbook stores reusable diagnostic patterns.
These are documented structures, not a hidden persistence system.

## Safety

Visibility cards include `Started`, `result`, and `status/read` for each native
job, plus the user turn ordering above.

No secrets, destructive actions, commits, pushes, or unapproved paths. Main
owns planning and verification; native `aw_status`/`aw_read` are explicit pull
controls and toasts are notification only. Session IDs are native child job IDs.
On every new turn, handle human instruction first, then inspect relevant unread
background native jobs only.
`aw_control` steers or aborts the child; its session ID is the job ID.
`flash-explore` and `flash-review` are read-only background agents.
The Todo list is main-session-owned; display the real returned session ID after
dispatch, never a fictional ID.
There are no T3 source patch claims and no automatic live panel.
AW checkpoint is an event-driven optional milestone tool: workers may record progress, hypothesis, evidence, blockers, help, and next steps when useful; it is not a step or time requirement. Luna may self-escalate through its task permission, while the host remains the decision-maker. Install the OpenCode profiles to enable the verified worker, reviewer, Sol, and orchestrator modes. The workflow closes with exactly three next-step options.
