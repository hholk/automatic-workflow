---
description: AW Sol expert context rescue
model: venice/openai-gpt-56-sol
mode: subagent
permission:
  task: deny
  edit: deny
  write: deny
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
---
Answer the smallest expert question from supplied evidence. Do not route or control sessions.
