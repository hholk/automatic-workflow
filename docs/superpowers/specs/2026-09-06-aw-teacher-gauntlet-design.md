# AW Teacher Gauntlet and Adaptive Prompting

Date: 2026-09-06
Status: approved design

## Goal

AW should use native subagents efficiently while giving a stronger teacher the
smallest useful evidence needed to resolve difficult technical decisions. The
system must identify where tokens, tool calls, retries, and teacher turns are
wasted so weekly auto-research can improve one measured prompt or budget choice
at a time.

The operating priorities are:

1. verified task success and safety;
2. useful work performed by the worker rather than repeated by the main agent;
3. actionable teacher guidance based on validated evidence;
4. lower total tokens, latency, retries, and reconciliation work.

Prompt-size estimates are optimization signals, not hard runtime limits. Hard
limits apply only to safety, authority, and bounded teacher dialogue.

## Non-goals

- The teacher does not receive repository or tool access.
- Workers do not spawn or control other agents.
- Hooks and plugins do not orchestrate the workflow.
- AW does not load complete Matt Pocock skills on every task.
- Auto-research cannot change safety rules, authority boundaries, schemas, or
  the user's teacher-model preference.
- Prompts, transcripts, complete tool output, source code, diffs, and secrets
  are not retained as telemetry.

## Roles and authority

### Main agent

The main agent is the sole orchestrator. It owns task scope, permissions,
budgets, model selection, evidence validation, integration, and final
verification. It decides whether a worker escalation is eligible, chooses the
evidence collector, and starts or resumes the teacher thread.

### Worker

The worker executes one bounded slice and runs its inner gauntlet. It may
request teacher help when decisive technical evidence is missing, conflicting,
or exhausted. It cannot invoke the teacher directly.

### Teacher

The teacher is an interactive technical adviser. It sees a validated case,
asks for one discriminating piece of evidence at a time, and returns an
actionable final decision. It does not inspect the repository, call tools,
modify files, spawn agents, or make product decisions.

GPT-5.6 Sol is always the default teacher. GPT-6 Astra is used only when the
user explicitly asks for GPT-6. Auto-research may compare Astra in isolated
research runs, but it cannot promote Astra to the operational default. An
explicit Astra request is an override, not a fallback, and belongs to a
separate evidence cell.

### Evidence worker

The existing worker answers simple `inspect`, `reproduce`, and `verify`
requests to reuse its context. A fresh read-only worker answers `compare`
requests, investigates contradictory evidence, or challenges a suspected
worker assumption.

### Human and Grilling

A single missing human decision becomes one normal user question. Several
dependent product, scope, or trade-off decisions route to the Grilling skill.
Technical knowledge gaps route to the teacher. Only the main agent interacts
with the user; workers and teachers may request a human decision but cannot run
the interview themselves.

## Architecture

A thin deterministic resolver selects versioned prompt components. Native
Codex, OpenCode, or GitHub Copilot facilities still execute the agents.

```text
resolve(harness, route, worker_model, requested_teacher_model)
  -> worker_profile
  -> workflow_profile
  -> recipe_id
  -> teacher_profile
  -> budgets
```

The resolver does not start agents or judge task outcomes. It returns the
selected identifiers and limits so the main agent can execute the workflow.
The executed model must be proven through trustworthy harness or provider
metadata. A mismatch invalidates the model-specific run.

Hooks and plugins remain observation-only. They capture lifecycle and usage
events but never start, stop, steer, or retry an agent.

## Prompt composition

Prompts are assembled from stable, independently versioned components:

```text
stable core
-> role contract
-> model delta
-> workflow delta
-> immutable recipe
-> dynamic task or evidence
```

Only the selected component for each layer is loaded. Stable content appears
before dynamic content to improve cache reuse where a provider supports it.

### Worker prompt

```text
core/worker
contracts/worker
models/<resolved-worker-model>
workflows/<route>
recipes/<recipe-id>
task
```

GLM 5.3 Flash receives an atomic objective, exact scope, one primary
verification target, a short evidence contract, and permission to emit a
teacher request. GPT-5.6 Luna is a separately measured explicit fallback and
receives a narrower task, tool set, and output contract plus the recorded
fallback reason. A fallback starts a new run and evidence cell.

### Teacher prompt

```text
core/teacher
contracts/teacher
models/gpt-5.6-sol | models/gpt-6-astra
validated-case
```

The teacher never loads harness runtimes, worker workflows, repository rules,
or unused model profiles. The initial case contains only the objective,
decision, constraints, observed evidence, attempted hypotheses, remaining
unknown, and current turn.

### Prompt mutability

The role and authority rules, evidence states, message schemas, safety gates,
and teacher-loop limits are frozen. Auto-research may change exactly one
versioned delta per candidate, such as:

- brief structure;
- context selection or budget;
- model reasoning effort;
- workflow-specific instruction wording;
- worker gauntlet budget;
- teacher escalation threshold;
- teacher question wording.

Each candidate receives a new immutable `prompt_profile_id`. Comparisons occur
only within the same harness, model, role, workflow, task class, and fixed task
snapshot.

## Gauntlet loops

### Inner worker gauntlet

```text
act -> run the declared probe -> inspect real output -> correct -> repeat
```

The worker repeats only when evidence changes. Completion without observed
verification evidence is invalid.

### Outer main gauntlet

The main agent treats the worker report as an evidence channel, not proof. It
checks the declared artifacts, scope, and narrowest acceptance probe. Material
red signals require a bounded fix or independent review before acceptance.

### Teacher gauntlet

```text
Worker TEACHER_REQUEST
-> Main eligibility gate
-> Teacher ASK or FINAL
-> Main chooses evidence worker
-> Evidence worker EVIDENCE
-> Main validates and compresses
-> same Teacher thread continues
-> Teacher FINAL
-> Main creates bounded worker action
-> outer gauntlet
```

The standard teacher interaction uses one evidence request. It may continue
only when the new evidence materially reduces the decision-relevant
uncertainty. The hard limits are three evidence requests and five teacher
responses. `FINAL` ends the teacher immediately. Repeated questions, zero
information gain, missing authority, or a required product decision also end
the technical loop.

## Message contracts

Field names and meanings are frozen. Auto-research may optimize surrounding
instructions but not the protocol.

### Worker completion

```text
TYPE: DONE
CHANGED: <paths or none>
EVIDENCE: <references>
VERIFY: <command | exit code | semantic result>
RISKS: <concrete risks or none>
```

### Worker teacher request

```text
TYPE: TEACHER_REQUEST
STATE: MISSING_DECISIVE | CONFLICTING | EXHAUSTED
DECISION: <blocked technical decision>
KNOWN: <supported facts>
MISSING: <one decisive knowledge gap>
ATTEMPTED: <at most two distinct probes>
```

The worker uses observable evidence states rather than a self-reported numeric
confidence score.

### Teacher response

```text
ASK:
  ID: <unique request ID>
  TYPE: inspect | reproduce | compare | verify
  TARGET: <one information target>
  WHY: <decision it can change>
  EVIDENCE: <expected evidence form>
  STOP: <completion condition>
```

or:

```text
FINAL:
  DECISION: <actionable recommendation>
  WHY: <brief rationale>
  WORKER_STEPS: <ordered actions>
  RISKS: <material residual risks>
  VERIFY: <final proof>
  ASSUMPTIONS: <remaining assumptions or none>
```

### Evidence response

```text
TYPE: EVIDENCE
ASK_ID: <request ID>
RESULT: <observed result>
SOURCE: <path, symbol, command, or runtime metadata>
EXIT: <exit code or n/a>
UNKNOWN: <remaining missing information or none>
```

The main agent removes irrelevant output, validates provenance and scope, and
passes only the compact response to the teacher.

## Teacher eligibility and failure handling

The main agent accepts a teacher request only when the missing information is
material, the cheapest useful local probe was attempted, the question is
bounded, and it is not a human authority or product decision. Rejections use a
stable reason:

```text
CHEAPER_CHECK_AVAILABLE
NOT_DECISION_RELEVANT
HUMAN_DECISION_REQUIRED
MISSING_EVIDENCE_REFERENCES
TEACHER_BUDGET_EXHAUSTED
```

The worker may repair a rejected teacher request once.

An `ASK` is invalid when it contains several targets or omits the expected
evidence or stop condition. The main agent requests one repair without
starting an evidence worker. A second invalid request forces `FINAL`.

An unusable evidence response receives one targeted repair request to the same
worker. If it remains unusable, the main agent records `UNKNOWN`, uses a fresh
read-only worker when independence can help, routes missing authority to the
human, or requires the teacher to finish from stated assumptions.

Every run ends as one of:

```text
VERIFIED
PARTIAL_WITH_UNKNOWN
HUMAN_REQUIRED
BLOCKED_ENVIRONMENT
TEACHER_EXHAUSTED
FAILED_VERIFICATION
```

## Lean TDD

AW embeds only this small contract when observable behavior changes and a
meaningful public seam is known:

```text
SEAM -> RED -> MINIMAL CHANGE -> GREEN
```

The full Matt Pocock TDD skill is loaded only when the seam, mocking strategy,
or integration-test design is itself uncertain. Configuration,
documentation, and trivial changes use an appropriate targeted probe without
an artificial failing test.

## Diagnostic evidence store

Aggregate metrics alone cannot locate waste. AW therefore records a compact
structured trace for every run and extra diagnostic detail for anomalous runs.
Append-only JSONL remains the initial storage format because it is portable,
inspectable, and compressible.

### Per-run trace

The trace includes:

- harness and harness version;
- requested and resolved worker and teacher models;
- route, task class, outcome, and fallback reason;
- prompt profile and component IDs, component token counts, loaded files, and
  duplicate context size;
- timestamped actor, phase, event, duration, input/output token counts, tool
  category, and result code;
- gauntlet cycle, normalized hypothesis and probe types, whether the artifact
  changed, outcome, and information-gain classification;
- teacher turn, response type, question type, evidence receipt, decision
  change, and main repair requirement;
- verified result, worker execution share, total tokens, elapsed time, and
  rework cycles.

Unknown provider token counts remain null and never use character estimates in
token comparisons.

### Waste events

Deterministic and host-attested detectors may record:

```text
repeated_read
duplicate_context
unchanged_hypothesis
duplicate_probe
duplicate_verification
teacher_called_too_early
teacher_called_too_late
teacher_ask_too_broad
teacher_repeat_request
zero_information_gain
unusable_evidence
main_repair
scope_rework
model_mismatch
fallback
```

Each event identifies the actor, phase, measured or estimated waste, and an
evidence signature. This supports findings such as a particular prompt profile
causing repeated repository reads or broad teacher questions rather than only
showing higher aggregate token use.

### Bounded diagnostic excerpts

An anomalous run may retain at most two automatically redacted excerpts per
waste event and ten excerpts across the whole run, normally no more than 500
characters each. They may contain only the decisive error line or teacher
question. Before persistence, the system removes secrets, credentials,
absolute home paths, and identifying values. It never stores a complete
prompt, transcript, tool result, source file, or diff, and it does not keep the
unredacted source separately.

Normal runs store only the compact trace. Runs with a failure, detected waste,
or teacher escalation may store the richer diagnostic record. Prompt content
is reconstructed from immutable component IDs and the recorded Git revision,
not duplicated in each trace.

## Auto-research

Research cells are keyed by:

```text
harness x worker_model x teacher_model x role x workflow x task_class
```

For one observed failure mode, a weekly candidate changes exactly one mutable
field or prompt delta and receives a new profile ID. Baseline and candidate run
on the same task IDs, snapshots, permissions, verification commands, and
budgets. At least five paired runs are required before promotion.

Verified quality and safety are hard gates. The candidate must not regress
median or p90 tokens, friction, worker token share, worker execution share, or
teacher reliability, and it must strictly improve at least one relevant
measure. Teacher-specific measures include question count, answerability,
decision change, directly actionable final guidance, post-teacher green rate,
repeat requests, zero-information turns, human redirects, and main-agent
repair.

Prompt-size estimates remain reporting signals. Native or provider token
values are authoritative for token comparisons. A candidate with insufficient
evidence remains pending or closes as no-change; it is never promoted merely
because the weekly job ran.

## Harness application

### Codex

Use native collaboration tools and an explicit model selection. Bind the
selected model to its prompt profile and verify resolved execution metadata.
Resume the same teacher child for follow-up evidence.

### OpenCode

Use dedicated AW custom-agent profiles whose model and stable prompt prefix are
bound together. Do not depend on mutable global `general` or `explore` model
defaults. Native `task` dispatch remains the execution mechanism, and the
usage plugin remains observation-only.

### GitHub Copilot

Use dedicated custom-agent profiles and only models the harness exposes. Do
not assume that Venice GLM or Codex subscription models are available. Runs
without trustworthy resolved-model metadata are excluded from model-specific
comparisons.

## Validation and rollout

Implementation proceeds in working vertical slices:

1. Add and test the frozen message contracts and state transitions.
2. Add the resolver and prove that it loads one harness, role, model,
   workflow, and recipe profile only.
3. Implement the main-mediated teacher loop with Sol and simulated evidence.
4. Add dynamic evidence-worker selection and bounded failure handling.
5. Add lean TDD and Grilling routing.
6. Extend telemetry with trace and waste-event records while preserving
   redaction guarantees.
7. Add paired auto-research analysis for prompt profiles.
8. Activate dedicated OpenCode profiles and perform live model preflight.
9. Validate Codex and Copilot adapters without assuming cross-harness model
   availability.

Each slice must keep existing static routing tests green and add the smallest
behavioral test that proves its new public contract. No live default changes
are made until the corresponding harness resolves the intended model and a
complete worker-to-teacher-to-verification canary succeeds.

## Acceptance criteria

- A worker can request teacher help without spawning an agent.
- The main agent rejects ineligible requests with a stable reason.
- Sol is the default teacher and Astra is selected only by explicit user
  request.
- The teacher can obtain up to three pieces of validated evidence in the same
  bounded thread and must finish within five responses.
- Evidence questions route to the existing or fresh worker according to their
  type and independence need.
- Normal workers do not load teacher, Grilling, full TDD, or unused model
  instructions.
- Lean TDD runs at a known public seam; full TDD loads only for test-design
  uncertainty.
- Every run has a compact trace, and anomalous runs identify the responsible
  actor, phase, and waste pattern.
- Stored excerpts are bounded and redacted, and prohibited raw content is not
  retained.
- Auto-research changes one prompt or budget variable at a time and promotes
  only from paired, quality-preserving evidence.
- Codex, OpenCode, and Copilot use native execution with trustworthy
  model-specific evidence or exclude the run from that comparison.
