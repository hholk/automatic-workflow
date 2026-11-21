# Hstack within AW

AW uses Poteto and compatible Hstack skills under the user's standing
authorization. Preserve installed frontmatter, manual-only flags and global
skill discovery.

## Load and select

Resolve `poteto-mode` from the same Hstack installation as AW. Prefer curated
`../../poteto-mode/poteto-core.md` and use `../../poteto-mode/SKILL.md` if the
core is absent. These paths are relative to this reference in the bundle.
`resolve-profile.mjs` reports the selected path and availability in
`poteto_style_reference` (`mode` is `core`, `full`, or `missing`). Read the
selected file once per session. Preserve Poteto's manual-only flag outside
AW and apply the compatibility filter before following nested triggers.

Use `recommended_hstack_skills` from `resolve-profile.mjs` to shortlist references
from the canonical task class, route and observed needs. Each entry gives its
name, path, availability and reason. Pass observed triggers such as
`--signals retry,typescript` when relevant. Choose the smallest useful installed skill
and read its source before applying it. Standing authorization covers these
lightweight references within AW:

| Need | Relevant Hstack reference |
|---|---|
| Replies or product prose | `unslop` |
| Skills or agent instructions | `writing-for-agents` |
| Substantial technical documentation | `technical-writing` |
| Unclear code structure or rationale | `how`, `why`, `codebase-design` |
| Stateful logic or a repeated conditional shape | `principle-model-the-domain` |
| Boundary parsing or typed contracts | `principle-boundary-discipline`, `principle-type-system-discipline` |
| Refactoring or unnecessary layers | `principle-laziness-protocol`, `principle-subtract-before-you-add`, `principle-minimize-reader-load` |
| Repeated failed hypotheses | `principle-attack-the-premise`, `principle-fix-root-causes` |
| Repeated agent correction | `principle-encode-lessons-in-structure` |
| Concurrent writes or retries | `principle-separate-before-serializing-shared-state`, `principle-make-operations-idempotent` |
| Multi-step delivery | `principle-sequence-verifiable-units` |
| Interpreting measured results | `principle-explain-the-number`, `benchmark-checklist` |

Use other model-invocable Hstack skills when their documented triggers match.
Other manual-only skills require explicit invocation. Resolve against the
installed catalog. If a reference is absent, use the AW contract and disclose
the gap when it materially affects the result.

## Worker handoff

Add a short CONTEXT instruction when an authorized skill prevents a specific
mistake. Link it to an existing numbered SUCCESS criterion and omit hints that
repeat the brief. The v2 brief accepts up to eight `skill_hints` records with
`skill`, `criterion_id` and `instruction`.

For a retry safety criterion, ask the worker to reproduce a timeout after the
first commit, retry with the same import ID and verify one stored row.

## Curated Animatic

Use `../../animatic/SKILL.md` for requested narrations and the
[completion threshold](routing.md#task-class-and-completion). Read its toolchain
config and use the curated `MEDIA.md` and `scripts/build-media.mjs`. Follow its
mixed-media verification and hand back the video. If the curated package or
required tools are absent, report the animatic blocker.

## Task-specific access

| Task | Hstack skill |
|---|---|
| Diagnose a broken behavior | `diagnosing-bugs` |
| TypeScript implementation | `typescript-best-practices` |
| Existing cheap regression target or requested test-first work | `tdd` |
| Frontend visual direction and implementation | `design-taste-frontend` |
| Explain a subsystem to the user | `teach-code` |
| Requested research deliverable | `research` |
| PR description | `pr` |
| Requested review of a change | `h-code-review` |
| Resuming a session with missing recent context | `recall` and the current mission snapshot |
| Reviewable decision trail for a longer mission | `show-me-your-work` |

Use `node scripts/mission-state-cli.mjs export-tsv` to produce the decision
trail from the existing mission ledger. It reads `{ workspace, task_id, stateDir? }`
as JSON on stdin and returns the TSV in `tsv`. On resume, use `recall` to
reconstruct current context from the snapshot, decision trail and live evidence.

Preserve invocation and delegation gates for optional additions such as
`blast-radius`, `create-verification-skill` and `statechart`. `arena`, `swarm`,
`interrogate`, `reflect`, setup commands and global changes require an explicit
user request or existing authorization.

## Resolve conflicts before acting

System and host instructions, explicit user constraints and applicable repository
rules remain authoritative. Within this integration, AW owns execution policy;
Poteto and supporting skills contribute only compatible task methods and style.

- Models, providers, roles, effort and budgets come from AW's registry and the
  live host. Poteto/pstack defaults, guessed slugs and implicit model fallbacks
  do not replace them.
- Main alone orchestrates under AW's dispatch rules. Poteto-agent roles,
  automatic background tasks, fresh-agent mandates and nested skill fanout do
  not create additional delegation. Keep each handoff within the assigned scope
  and preserve the worker's no-delegation contract.
- Heavy workflows such as architect/arena/swarm/interrogate/reflect, automatic
  independent review, mandatory prototypes and PR creation remain opt-in or
  justified by the task's risk under the user's existing rules. A Poteto trigger
  alone does not authorize them. Select a relevant lightweight method instead.
- User limits on tests, benchmarks, artifacts and external actions take priority.
  Poteto's verification and benchmark triggers cannot override a no-tests request.
  Unknown checks remain unknown. Existing authorization is reused rather than
  asking again because a supporting skill says to pause.
- Follow AW's operating-learning scope. Poteto's hillclimb, eval, automatic skill
  repair PRs and per-change commits do not widen self-optimization authority.
- Keep the task's requested output format and language. Use Poteto's concise,
  evidence-based prose without adding mandatory principle inventories, copied
  playbook TODOs or repetitive goal restatements to every response.

Skip the conflicting instruction, not the useful remainder of a skill. Briefly
explain a conflict when it changes expected behavior. If a material conflict
cannot be resolved by these priorities, continue independent work and ask one
focused question. Do not invent missing user authority.

## Escalate repeated problems

| Observed problem | Next path |
|---|---|
| Repeated budget, routing or rework drift | [AW operating learning](operating-learning.md), with one `active_trial` in `playbooks/current.json` |
| The same repository or code mistake on at least two occasions | `correct` and `principle-encode-lessons-in-structure` |
| Repeated repository navigation, tool economy or coding-standards friction | `h-retro` |
| Fundamental skill or judgment gap | `reflect`, on explicit user request |

Apply the invocation and delegation rules above when a skill proposes work.

## Keep selection useful

Name selected skills once when first applying them. Reuse already loaded material.
Do not recursively load every skill a reference mentions. Workers receive only
references needed for their assigned outcome, not the complete Hstack catalog.

Start observing handoffs with delegated retry tasks. At the normal
operating-learning checkpoint, attach each observed hint with repeatable
`usage.mjs attest --skill-hint <skill>:<first_pass>:<rework>` flags. Express each
outcome as `yes`, `no` or `unknown` from verification and actual repair history.
Record comparable no-hint handoffs in the [local observation](lessons.md#entry-format)
with run and task IDs, first-pass outcome and rework. Keep separate handoffs
distinct. Use total cost through acceptance only when all actor costs are observed.

Compare like task classes, harnesses and actual model profiles. Selection by main
can favor harder cases; these observations can guide the next change. A causal
claim needs a separately authorized controlled comparison. A trial may randomly omit an optional hint on eligible real tasks while
keeping scope, required guidance and checks fixed.

For other tasks, record a skill choice when it informed a decision, prevented a
repeated error or introduced observable overhead.
Treat the effect as provisional. Adjust future selection from real evidence;
never turn the number of loaded skills into a quality or efficiency target.
