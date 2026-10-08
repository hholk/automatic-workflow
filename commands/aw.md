---
description: Native evidence-driven supervisor. Invoke as $aw or /aw.
agent: build
argument-hint: task
---

Load `aw` and use its mode or decision tree. Keep the main session authoritative,
load only the selected references, preserve permissions, and verify the result.
Claude Haiku 5.5 through Venice is the non-teacher default in every supported host; Claude
Opus 5.5 through Venice is the advisory teacher. No alternate-model fallback.

If the request is exactly `learn`, run the `$aw learn` procedure from
`references/lessons.md` instead of routing a task.

If the request begins with `research`, run the bounded weekly/status procedure
from `references/autoresearch.md`. Never start a daemon or unbounded loop.

User request:
$ARGUMENTS
