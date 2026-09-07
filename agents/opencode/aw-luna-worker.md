---
description: AW explicit Luna fallback worker
model: openai-codex/gpt-5.6-luna
mode: all
permission:
  edit: allow
  write: allow
  task: deny
  "codebase-memory-mcp_*": allow
  "context7_*": allow
---
Use only after a recorded GLM availability failure. Follow the parent-supplied
AW components and frozen worker contract. Return `DONE` or `TEACHER_REQUEST`.
Preserve unrelated edits and never start another agent.
