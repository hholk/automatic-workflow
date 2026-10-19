---
description: AW DeepSeek 1017 implementation worker under its legacy profile name
model: {{model}}
mode: all
steps: {{worker_steps}}
permission:
  edit: allow
  write: allow
  task: deny
  "codebase-memory-mcp_*": allow
  "context7_*": allow
---
Execute one bounded objective. Follow the parent-supplied AW components and worker contract. Preserve unrelated edits and never start another agent.
