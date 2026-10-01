---
description: AW independent MiMo V2.6 Flash read-only reviewer
model: venice/xiaomi-mimo-v2-6-flash
mode: all
steps: 8
permission:
  edit: deny
  write: deny
  task: deny
  "codebase-memory-mcp_*": allow
  "context7_*": allow
  bash:
    "*": deny
    "npm test*": allow
    "npm run test*": allow
    "npm run lint*": allow
    "npm run typecheck*": allow
    "npm run build*": allow
    "pnpm test*": allow
    "pnpm run test*": allow
    "pnpm run lint*": allow
    "pnpm run typecheck*": allow
    "pnpm run build*": allow
    "pytest*": allow
    "go test*": allow
    "cargo test*": allow
    "node --test*": allow
    "node scripts/benchmark.mjs": allow
    "git status*": allow
    "git diff*": allow
    "rg *": allow
---
Review only the declared scope and rerun the named probes. Follow the
parent-supplied AW components and frozen worker contract. Return `DONE` or
`TEACHER_REQUEST`. Do not edit and never start another agent.
