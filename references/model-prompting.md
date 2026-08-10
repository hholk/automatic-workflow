# Model-specific briefing guidelines

**Orchestrator** = the main-chat session model (not pinned). May plan, use the full
harness, and switch models mid-session when the user wants. Session switches do
not change leaf Task models.

**Worker + explorer (pinned):** `venice/openai-gpt-56-luna` (Venice GPT-5.6 Luna).
**Challenger (pinned, only `flash-review`):** `venice/deepseek-v4-flash-0731`.
**Never** dispatch workers/explorers on DeepSeek, Sol, Terra, or Luna Pro.
**Never** use unversioned DeepSeek Flash for Ultrawork packages.

The Luna guidance follows the official [GPT-5.6 prompting guidance](https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6), which documents the GPT-5.6 family under Sol rather than a separate Luna page. Apply only the family-level prompting guidance; do not infer undocumented API parameters or capabilities.

## GPT-5.6 Luna — default worker and explorer

- **Outcome first:** state the user-visible goal, success criteria, evidence available, constraints, and completion bar; leave the efficient path to the model.
- **Lean prompts:** remove repeated instructions, examples, and unrelated tools. Keep only rules that change behavior.
- **No contradictions:** use absolute language only for true invariants. Express judgment calls as decision rules.
- **Explicit autonomy:** permit safe in-scope reads, edits, and non-destructive verification; require a human gate for destructive, external, costly, or scope-expanding actions.
- **Tool routing:** parallelize independent discovery, keep dependent steps sequential, and stop once the core request has sufficient evidence. Do not search again only to improve phrasing.
- **Reasoning:** never request chain-of-thought. Preserve the configured reasoning effort; raise it only when representative tasks show a meaningful quality gain.
- **Output:** keep status and final prose concise, but preserve required facts, evidence, caveats, decisions, and next steps. Use the exact report contract.
- **Verification:** name targeted tests, type/lint/build checks, and a minimal smoke test as applicable; explain any validation that could not run.

Delegate to Luna:

- codebase search and file mapping;
- mechanical implementation from a complete spec (tiered: up to 4 files medium; high stays ≤2; +1 adjacent test);
- boilerplate, renames, test scaffolding, and lint fixes;
- named verification commands and evidence collection;
- parallel independent investigations.

Keep on the orchestrator:

- ambiguous product decisions and architecture without a written plan;
- auth/security-sensitive judgment;
- conflicting parallel edits, final quality judgment, and user communication.

## DeepSeek V4 Flash 0731 — independent challenger

- **Challenge, do not build:** inspect the Luna artifact and its evidence; never edit, silently repair, or approve based on worker prose.
- **Adversarial scope:** actively seek failed or ambiguous AC, contradictions, missing evidence, scope creep, untested edge cases, and likely regressions.
- **Evidence first:** run only narrow, read-only probes and relevant checks within the brief boundary; cite exact files, symbols, commands, and exit results.
- **Reference comparison:** judge the artifact against the named spec, metric, or exemplar—not against the worker's reasoning or history.
- **Concrete verdict:** return `APPROVE` only when every assigned check passes and no material defect remains; otherwise give a minimal file/symbol-level fix request.
- **Output discipline:** emit exactly the reviewer report contract, with no chain-of-thought, preface, or raw log dump.

## The four mandatory fields

Every write package carries these four mandatory core headings; each is terse and observable. Operational scaffolding such as ROLE, DO, ACCEPTANCE, and REPORT remains required by the templates.

- `OBJECTIVE` — the concrete result, stated as an artifact or action, not a vibe.
- `METRIC / REFERENCE` — a hard, outstanding standard the work is measured against: a named spec, exemplar file, benchmark, or prior accepted ref. Vague "make it good" is forbidden.
- `BOUNDARY` — stop/safety/iteration limits: allowed paths, forbidden paths, max files, timeout, max fix rounds. What to do when hit (BLOCKED / NEEDS_CONTEXT), never guess.
- `GAUNTLET` — who critically judges, what evidence, and against which reference. The builder verifies commands but never approves its own output; a fresh-context critic gets the artifact + reference, not the builder's reasoning or history.

## Briefing implications

- Keep the four core fields mandatory, concise, and observable; template scaffolding remains in place.
- Never request chain-of-thought ("think step by step") — thinking mode is already on and the brief should spend tokens on goal, references, constraints, and AC instead.
- Complete the tool loop before reporting: run the named verification command(s), confirm exit status, and only then write the final report in the required format. A final report that precedes a finished tool loop is an anti-pattern.
- Always include: context capsule (only what's needed), ordered checkable steps, binary acceptance criteria.
- Never include: full chat history, open-ended "figure out the best approach", multiple unrelated goals, vague "improve quality" without metrics, packages over tier budgets. Prefer small packages; batch related files on medium risk instead of dual-review micro-packages.
- Parallelism: wave-dispatch path-disjoint packages (fan-out → barrier → synthesize); explores parallel by default; dual reviews SPEC∥QUALITY; shared files sequential; cap 3 default / 5 breadth L; worker-level 3+ independent tool calls; see [parallelism.md](parallelism.md).
- Correction loop: send a surgical fix brief (exact failures + required changes only), max 3 fresh fix passes, then orchestrator takes over. See [recovery](recovery.md).
- Adaptive gauntlet: `none` / `single` / `dual` from risk (see [config](../config.md) and [quality gates](quality-gates.md)). Dual is default only for high risk. Read-only explore does not require a code gauntlet.
- Before each Fix, run `ledger.py diagnose` and put error_class + fix_hint into the brief. Prefer structured traces over score-only feedback (Meta-Harness).
- Anti-patterns: "fix the bug" without error+AC; worker reading 40 files to "understand the system"; 3 goals in one task; infinite retry of the same brief; worker committing by default; empty/intro-only results (probe artifacts, resume once, then split smaller); DONE report with unchanged files (artifacts and tests outrank prose).

## Native envelope vs inner contract

The exact `<report>` schemas are canonical in [brief-templates](brief-templates.md#canonical-report-schemas);
this file documents the envelope only, never a second copy.

- OpenCode built-in `Task` returns the subagent's raw final message wrapped in an OUTER
  `<task><task_result>RAW_FINAL_TEXT</task_result></task>` envelope.
- The dispatched prompt appends one applicable exact `<report>` schema VERBATIM (from the Canonical
  report schemas section of brief-templates). The worker's real output is the single INNER
  `<report>...</report>` block extracted from inside that outer `<task_result>`.
- The built-in `Task` has no format/json_schema parameter and does not natively validate schema or
  JSON. Validation is the orchestrator's job, done after unpacking the envelope.
- Never confuse the outer wrapper with the inner contract: the envelope is mechanical transport; the
  extracted inner `<report>` is the contract to judge.

## Report quality invariants

- Final response holds exactly one inner `<report>` block and nothing else — no preface, no outro,
  no raw log dump. Every field is mandatory; omit nothing and write `none` or `[]` explicitly.
- Report <=2500 characters; per-item evidence <=240 chars; exact commands with integer exits; no
  raw logs or chain-of-thought; never self-approve.
- A builder may report verification but never uses APPROVE/REQUEST_CHANGES and never judges quality;
  only the Reviewer schema carries a verdict.

## Recovery classification (owned by recovery.md)

Exact INVALID / FALSE / matching classification, the single report-only resume (report-only, `no
edits`, same task_id, does not count as a fix pass), fresh no-task_id rules for Initial/Fix1/Fix2/
Fix3 implementation and all critics, and artifact routing (INVALID+changed, INVALID+unchanged,
FALSE DONE) are owned by [recovery](recovery.md). This file does not duplicate them.

## Links

- [brief templates](brief-templates.md) — canonical report schemas + full brief / fix-brief shapes
- [work graph](work-graph.md) — task graph and dispatch rules
- [recovery](recovery.md) — fix passes and escalation
- [quality gates](quality-gates.md) — verification and probe standards
