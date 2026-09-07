---
id: base-v1
brief_type: bounded-execution
context_strategy: paths-first-minimal
instruction_style: objective-and-constraints
evidence_contract: observed-command-and-scope
---

# Base worker recipe

Give the worker only:

```text
OBJECTIVE: one observable target state
SUCCESS: concrete acceptance criteria
CONTEXT: facts already established; no conclusions to imitate
PATHS: exact writable or read-only scope
NON_GOALS: nearby work that must remain untouched
VERIFY: one executable command or probe
```

Require the worker to preserve unrelated edits, start with the cheapest
discriminating inspection, and stop on conflicting evidence or missing
authority. It returns only:

```text
STATUS | CHANGED | EVIDENCE | RISKS | NEXT
```

Evidence contains paths, real exit codes, semantic results, and scope `n/N`.
Unknowns stay `UNKNOWN`; the worker does not claim host acceptance.
