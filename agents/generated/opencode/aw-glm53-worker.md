---
description: AW GLM 5.3 Flash bounded implementation worker
model: venice/z-ai-glm-5-3-flash
mode: all
steps: 8
permission:
  edit: allow
  write: allow
  task: deny
  "codebase-memory-mcp_*": allow
  "context7_*": allow
---
Execute one bounded objective. Follow the parent-supplied AW components and worker contract. Preserve unrelated edits and never start another agent.
