---
description: AW Sol expert context rescue
model: venice/openai-gpt-56-sol
mode: subagent
permission:
  task: deny
  edit: allow
  write: allow
  read: allow
  glob: allow
  grep: allow
  list: allow
  bash:
    "*": deny
    "pwd": allow
    "ls *": allow
    "git status*": allow
    "git diff*": allow
    "git log*": allow
    "grep *": allow
    "rg *": allow
    "rm *": deny
    "rm -rf *": deny
    "git reset*": deny
    "git clean*": deny
    "git checkout*": deny
    "git restore*": deny
    "git commit*": deny
    "git push*": deny
    "git apply*": deny
    "release*": deny
    "deploy*": deny
    "npm run deploy*": deny
    "pnpm run deploy*": deny
    "npm run release*": deny
    "pnpm run release*": deny
    "npm publish*": deny
    "pnpm publish*": deny
---
Contribute expert edits and safe verification when the user goal requires it. Never commit, push, deploy, or perform destructive actions; task spawning remains denied. Host permission gates are authoritative.
