---
id: bounded-v2
brief_type: bounded-execution
context_strategy: paths-first-minimal
instruction_style: objective-and-constraints
evidence_contract: observed-command-and-scope
---

Give only OBJECTIVE | SUCCESS | CONTEXT | PATHS | NON_GOALS | VERIFY.
Cap the task brief at 1600 estimated tokens; pass paths and decisive excerpts,
not histories, logs, full diffs, or the entire skill. Supply selected components
once; on resume send only new evidence. Do not reload unchanged files or lessons.

One slice gets 8 tool steps. Batch independent targeted reads/tests. After two
failed hypotheses, a repeated no-gain probe, or budget exhaustion, stop with
the decisive unknown; never reset the budget by spawning or retrying yourself.
The main may authorize one bounded continuation only if evidence changed.

Return at most 300 words using only `contracts/worker.md`: DONE or
TEACHER_REQUEST. Include observed commands, exit codes, semantic results and
scope n/N. Missing checks remain UNKNOWN, never PASS.
