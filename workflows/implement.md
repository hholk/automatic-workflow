# Implement

Use when desired behavior, scope, and verification are known.

Assign exact file ownership to one GLM worker. Implement the smallest complete
vertical slice, using existing dependencies and patterns. Add or update a focused
behavior test when it provides durable value. The worker runs the declared verify
command and reports changed paths plus observed output. The host reviews the diff
and reruns the smallest relevant verification before accepting the result.
