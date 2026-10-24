# Diagnose

Use when a symptom is known but the causal boundary is not.

Establish and run one narrow command that exercises the actual bug path and
detects the user's exact symptom. Record the command, expected result and observed
failure before testing a causal hypothesis. Use the feedback-loop and reproduction
phases of `diagnosing-bugs` when the loop needs building or minimising.

If the bug cannot be reproduced, return the attempted checks, available artifacts
and missing prerequisite; the cause remains UNKNOWN. For intermittent bugs, record
the trigger, trial count and observed failure rate instead of claiming determinism.

Test one falsifiable hypothesis with the cheapest discriminating check. Repeat
only when evidence changes. Do not edit production code. After two distinct failed
hypotheses, hand back using the worker contract. Request a teacher only for an
unresolved material technical decision. Return the evidenced cause and the repro
command for the fix workflow, otherwise the narrowest decisive unknown.
