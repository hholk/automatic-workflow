# Flash Brief Templates

The **orchestrator** is the main-chat session model (switchable). Leaf Tasks are
pinned: workers and explorers use Venice **GPT-5.6 Luna**
(`venice/openai-gpt-56-luna`); **only** reviewers use
`venice/deepseek-v4-flash-0731` (DeepSeek V4 Flash 0731). A brief is at most 6000 characters; a report is
at most 2500. Implementers get one iteration and return only after verification.

Every write brief (Initial Worker and each Fix) carries four mandatory core headings — `OBJECTIVE`,
`METRIC / REFERENCE`, `BOUNDARY`, `GAUNTLET` — plus operational scaffolding such as `ROLE`, `DO`,
and `REPORT CONTRACT`. The builder runs its own verification but never approves its own work; a
fresh-context critic judges the artifact against the reference. For the semantics of each field, see
[model-prompting](model-prompting.md).

## Dispatch rule

Every Task the orchestrator dispatches must APPEND the applicable exact `<report>` schema from the
**Canonical report schemas** section VERBATIM to the dispatched prompt. A link/reference alone is
forbidden: a fresh subagent reads only its brief and the appended schema, not sibling docs. The
built-in Task returns the raw final text inside an outer `<task_result>`; the extracted single inner
`<report>` block is what the orchestrator judges. (Envelope semantics: model-prompting.md.)

## Canonical report schemas

### Exact Explorer `<report>` schema (read-only)

```text
<report>
status: DONE|BLOCKED|NEEDS_CONTEXT
answer: <direct answer>
files_inspected: []|<paths>
evidence: <concise, <=240 chars per item>
risks: none|<list>
recommended_next_step: <concrete>
requested_input: none|<exact request>
</report>
```

### Exact Worker `<report>` schema (implementer / Fix1–3)

```text
<report>
status: DONE|DONE_WITH_CONCERNS|BLOCKED|NEEDS_CONTEXT
summary: <=3 bullets
artifacts:
- path: <path>
  observable: <what changed>
artifact_probe:
- command: <exact command>
  exit: <integer>
  evidence: <=240 chars
verification:
- command: <exact command>
  exit: <integer>
  evidence: <=240 chars
acceptance:
- id: <AC id>
  result: PASS|FAIL
  evidence: <=240 chars
deviations: none|<list>
concerns: none|<list>
requested_input: none|<exact request>
</report>
```

Status invariants:

- DONE: >=1 declared artifact for a write task, probe exit 0, every verification exit 0, every AC
  PASS, and deviations/concerns/requested_input all none.
- DONE_WITH_CONCERNS: same successful evidence, concerns non-empty; no failed AC.
- BLOCKED: blocker/evidence in concerns, failed or not-run AC explicit; never imply completion.
- NEEDS_CONTEXT: requested_input exact and necessary; state what cannot proceed; never guess.
- DONE with unchanged files is invalid: artifacts and exit evidence outrank prose.

### Exact Reviewer `<report>` schema (gauntlet critic — no DONE status)

```text
<report>
verdict: APPROVE|REQUEST_CHANGES
axis: SPEC|QUALITY
artifact/reference inspected: <paths>
checks:
- id: <check>
  result: PASS|FAIL
  evidence: <=240 chars
required_fixes: none|<list>
risks: none|<list>
</report>
```

A builder may report verification but never uses APPROVE/REQUEST_CHANGES and never judges quality.
The reviewer must ignore builder prose/history and inspect the artifact independently.

---

## Explore

```text
ROLE: explorer (read-only)
OBJECTIVE: map files/symbols to answer one question; <=15 bullets plus risks and next step.
METRIC / REFERENCE: existing symbols/docs that define "found".
BOUNDARY: read-only; allowed dirs; no edits, no installs, no destructive commands.
  If this explore is part of a parallel wave: do not touch sibling scopes <list>.
GAUNTLET: not required — read-only map, no code change to judge. Orchestrator reviews the answer.
DO: run the named read-only VERIFY command; list risks and next step.
PARALLEL TOOLS: independent greps/reads/globs in one turn (3+ when useful); sequential only if a later call needs a prior result.
REPORT CONTRACT: append the Exact Explorer <report> schema (Canonical report schemas) VERBATIM
to this prompt; extract exactly one inner <report> from the outer <task_result>; all fields mandatory.
```

## Matt principles (inline — paste into every write brief)

```text
PRINCIPLES (inline; no skill loads):
1. TRACER BULLET: one vertical outcome only; stay inside BOUNDARY paths; stop at tier max files/AC.
2. RED→GREEN: first create/observe failing probe or test for the missing behavior; then minimal code to pass.
3. EVIDENCE BEFORE DONE: run ARTIFACT PROBE and VERIFY; DONE requires integer exit 0 on both; prose is not proof.
4. NO HUMAN ASK: never block on preferences; only NEEDS_CONTEXT/BLOCKED for true missing facts or hard errors.
```

## Initial Worker

```text
ROLE: implementer — fresh GPT-5.6 Luna worker, one iteration
OBJECTIVE: <one observable result — an artifact, not a vibe>
METRIC / REFERENCE: <named exemplar/spec/benchmark the work is measured against>
BOUNDARY: <allowed paths / forbidden paths / max files / max fix rounds / timeout / stop rule>
GAUNTLET: <review_mode=none|single|dual — none: orchestrator evidence only; single: one combined
DeepSeek critic; dual: parallel SPEC + QUALITY DeepSeek critics before sign-off>
RISK: <low|medium|high>
LESSONS: <≤3 bullets from ledger lessons/similar, or none>
FIRST ACTION: <inspect named pattern OR create exact file>
EXPECTED ARTIFACTS: <path — symbol/observable>
ARTIFACT PROBE: <small command>
CONTEXT CAPSULE: <symbols, invariants, project rules>
PRINCIPLES: (paste Matt principles block above)
NON-OVERLAP: do not edit paths owned by sibling packages <list or none>
DO: <ordered implementation steps including RED then GREEN>; when gathering independent facts/files, issue **3+ parallel tool calls** in one turn; run <exact verification>; verify before reporting.
PARALLEL TOOLS: independent reads/greps/tests same turn; sequential only if parameter depends on prior result; never invent placeholders.
DO NOT: expand scope, add deps, commit, judge own output, return an exploratory preface, use MCP/skills/web.
ACCEPTANCE: <binary checks within risk tier; split before dispatch if over budget>
ALLOWED: primary writable paths + one adjacent test file if needed
IF BLOCKED: exact command/error.
NEW TASK: dispatcher uses a NEW task with no task_id (initial attempt is not a resume).
REPORT CONTRACT: append the Exact Worker <report> schema (Canonical report schemas) VERBATIM
to this prompt; extract exactly one inner <report> from the outer <task_result>; all fields mandatory.
```

## Review

```text
ROLE: DeepSeek V4 Flash 0731 challenger (read-only) — the gauntlet critic
MODEL: venice/deepseek-v4-flash-0731
OBJECTIVE: judge either spec compliance or code quality — never both implicitly.
METRIC / REFERENCE: <the named spec/standard that produced this artifact>
BOUNDARY: read-only; <files to inspect>; do not edit or fix.
GAUNTLET: you are the independent critic — judge the artifact vs its reference, not the builder's
claims or build history; both spec critic and quality critic must approve before integration.
AC/CHECKS: <binary list>
VERIFICATION ALREADY RUN: <commands and evidence>
DO: inspect artifacts, independently run narrow checks, report concrete failures.
NEW TASK: dispatcher uses a NEW task with no task_id; critics never reuse a worker task_id.
REPORT CONTRACT: append the Exact Reviewer <report> schema (Canonical report schemas) VERBATIM
to this prompt; extract exactly one inner <report> from the outer <task_result>; all fields mandatory.
```

## Fix 1

```text
ROLE: implementer — Fix1, fresh GPT-5.6 Luna worker, one iteration
MODEL: venice/openai-gpt-56-luna
OBJECTIVE: produce an updated artifact that clears the failed AC without architecture changes.
METRIC / REFERENCE: <same named reference as Initial Worker>
BOUNDARY: same/narrower paths; one-shot; no scope change; Fix1; may include one adjacent test file.
GAUNTLET: fresh critic(s) re-compare the updated artifact vs the reference; builder does not approve.
FAILED AC: <exact checks>
TEST EVIDENCE: <concise failure>
AFFECTED FILES: <same or narrower paths>
EXPECTED ARTIFACT CHANGE: <path/symbol/test>
VERIFY: <single narrow command>
LIMITS: brief<=6000; report<=2500; final report only.
NEW TASK: dispatcher uses a NEW task with no task_id (a fix attempt is never a resume).
REPORT CONTRACT: append the Exact Worker <report> schema (Canonical report schemas) VERBATIM
to this prompt; extract exactly one inner <report> from the outer <task_result>; all fields mandatory.
```

## Fix 2

```text
ROLE: implementer — Fix2, fresh GPT-5.6 Luna worker, one iteration
MODEL: venice/openai-gpt-56-luna
OBJECTIVE: correct the reviewed root cause in the existing artifact.
METRIC / REFERENCE: <same named reference as Initial Worker>
BOUNDARY: same/narrower paths; one-shot; Fix2; use diagnose error_class + fix_hint.
GAUNTLET: fresh critic(s) re-compare the updated artifact vs the reference; builder does not approve.
ROOT CAUSE: <review-derived cause>
NARROW SYMBOLS: <files/functions/tests>
REQUIRED INVARIANT: <observable before/after rule>
EXPECTED ARTIFACT CHANGE: <path/symbol/test>
VERIFY: <single targeted command>
LIMITS: brief<=6000; report<=2500; final report only.
NEW TASK: dispatcher uses a NEW task with no task_id (a fix attempt is never a resume).
REPORT CONTRACT: append the Exact Worker <report> schema (Canonical report schemas) VERBATIM
to this prompt; extract exactly one inner <report> from the outer <task_result>; all fields mandatory.
```

## Fix 3

```text
ROLE: implementer — Fix3, fresh GPT-5.6 Luna worker, one iteration
MODEL: venice/openai-gpt-56-luna
OBJECTIVE: apply this mechanical final patch to the artifact.
METRIC / REFERENCE: <same named reference as Initial Worker>
BOUNDARY: one exact location; one-shot; Fix3 (prefer HIGH risk); else orchestrator implements after Fix2.
GAUNTLET: fresh critic(s) re-compare the patched artifact vs the reference; builder does not approve.
FILE/FUNCTION/TEST: <exact location>
BEFORE: <failing state>
AFTER: <required state>
ONLY CHANGES: <concrete edits>
EXPECTED ARTIFACT CHANGE: <path/symbol/test>
VERIFY: <single exact command>
LIMITS: brief<=6000; report<=2500; final report only.
NEW TASK: dispatcher uses a NEW task with no task_id (a fix attempt is never a resume).
REPORT CONTRACT: append the Exact Worker <report> schema (Canonical report schemas) VERBATIM
to this prompt; extract exactly one inner <report> from the outer <task_result>; all fields mandatory.
```

### Combined single-review schema (review_mode=single)

Use one flash-review Task with both axes listed under checks; still use the Exact Reviewer
`<report>` schema with `axis: SPEC+QUALITY` (or two check groups in `checks`).

After terminal Fix failure, the orchestrator implements. There is no Fix4 or Pro fallback.
On every failure call `ledger.py diagnose` before writing the next Fix brief.
