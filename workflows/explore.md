# Explore

Use for read-only architecture, ownership, callers, or option mapping.

Dispatch the native `explore` subagent with one precise question and a small
initial scope. Ask for file and symbol evidence, not a broad summary. Prefer code
graph queries, then `rg` for literals and configuration. Stop when the question
is answered or one exact missing fact is identified. Return
`STATUS | EVIDENCE | RISKS | NEXT`; no edits.
