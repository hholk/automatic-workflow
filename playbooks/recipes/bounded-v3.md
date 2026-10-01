---
id: bounded-v3
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
failed hypotheses, a repeated no-gain probe, or budget exhaustion, hand back
using the worker contract. Budget exhaustion alone returns DONE with unfinished
work in RISKS; TEACHER_REQUEST needs a material technical decision.
Main may authorize one continuation of at most 8 steps for changed evidence or
a new discriminating probe, including a teacher ASK. Repeated ASKs never reset
this allowance. Send only the delta and explicit remaining budget.

Return at most 300 words using only `contracts/worker.md`: DONE or
TEACHER_REQUEST. Include observed commands, exit codes, semantic results and
scope n/N. Missing checks remain UNKNOWN, never PASS.
