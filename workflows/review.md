# Review

Use after a change exists and needs independent evidence.
For changed interfaces, use the scoped [UI/UX acceptance checks](../references/ui-ux.md).

Mission review purposes use their dedicated inputs: [contract review](contract-review.md)
before work and [completion review](completion-review.md) before acceptance. Main
resolves with `--role worker --route review`, which selects the existing
read-only `aw-reviewer` binding, and supplies only the selected review workflow.

Dispatch a fresh resolved native worker read-only with the objective, acceptance criteria,
base/diff scope, and verify command, but not the builder's conclusions. Report two
separate verdicts: requirements (requested behavior, omissions and extra scope)
and standards (applicable AGENTS.md and documented project conventions). Cite the
source for each finding. Missing required sources stay UNKNOWN; a confirmed
absence of additional project standards is not applicable, not a defect.
Use the `code-review` distinction as a rubric, without invoking its tracker setup
or subagents. Check correctness, regressions and permissions. Follow affected
callers and data contracts beyond the diff when a concrete risk warrants it;
run the smallest probe of the decisive safety assumption or mark it unproven.
If the declared `VERIFY` command is outside the reviewer's
allowlist, the host runs it and passes the observed output to the reviewer
instead of widening permissions. Findings require path and evidence; style-only
preferences are not defects. Missing evidence is UNKNOWN, never PASS; compare
semantics, not incidental identifiers, and treat a partial gate count as
incomplete. The host resolves material findings and performs final verification;
a passing metric is not human acceptance.
