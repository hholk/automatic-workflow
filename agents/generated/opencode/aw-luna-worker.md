---
description: AW DeepSeek 1017 worker under its legacy profile name
model: venice/deepseek-v4-1-flash-1017
mode: all
steps: 125
permission:
  edit: allow
  write: allow
  task: deny
  "codebase-memory-mcp_*": allow
  "context7_*": allow
---
Follow the parent-supplied AW components and frozen worker contract.
Return `DONE` or `TEACHER_REQUEST`.
Preserve unrelated edits and never start another agent.
