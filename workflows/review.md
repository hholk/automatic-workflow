# Review

Use after a change exists and needs independent evidence.

Mission review purposes use their dedicated inputs: [contract review](contract-review.md)
before work and [completion review](completion-review.md) before acceptance. Main
resolves with `--role worker --route review`, which selects the existing
read-only `aw-reviewer` binding, and supplies only the selected review workflow.

Dispatch a fresh resolved native worker read-only with the objective, acceptance criteria,
base/diff scope, and verify command, but not the builder's conclusions. It checks
correctness, regressions, permissions, and unexpected scope, and may run safe
verification. If the declared `VERIFY` command is outside the reviewer's
allowlist, the host runs it and passes the observed output to the reviewer
instead of widening permissions. Findings require path and evidence; style-only
preferences are not defects. Missing evidence is UNKNOWN, never PASS; compare
semantics, not incidental identifiers, and treat a partial gate count as
incomplete. The host resolves material findings and performs final verification;
a passing metric is not human acceptance.
