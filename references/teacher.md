# Sol teacher

Use only for `architecture` or `hard_fix`. GPT-5.6 Sol comes from the Codex
subscription, never Venice. It is a teacher: GLM investigates and implements;
Sol receives only prepared evidence and returns guidance.

## Contract

- Maximum five Sol responses for one question.
- Sol must not use tools, read the repo, edit, execute, spawn, or release.
- Input per turn: at most 1,200 tokens of problem, constraints, evidence,
  attempted hypotheses, and the exact decision needed.
- Sol returns exactly one of:
  - `ASK: <one discriminating question or evidence request>`
  - `FINAL: <decision>; WHY: <brief rationale>; GLM_STEPS: <ordered actions>; RISKS: <top risks>; VERIFY: <proof>`
- GLM answers `ASK` by doing the work and supplying at most 600 new tokens.
- On response five, Sol must return `FINAL`, naming assumptions and confidence
  if evidence remains incomplete.

## Codex host

Spawn one native child with `model: gpt-5.6-sol`, high reasoning, and
`fork_turns: none`. Tell it the no-tools contract. Use follow-up messages on the
same child for GLM's answers; do not restart and resend history.

## OpenCode host

Start a vanilla Codex CLI thread in an empty temporary directory:

```sh
codex exec -m gpt-5.6-sol --ignore-user-config --ignore-rules \
  --disable skill_search --disable plugins --disable apps --sandbox read-only \
  --skip-git-repo-check -C "$AW_TEACHER_DIR" --json "$PROMPT"
```

Capture the native thread ID and continue it with `codex exec resume <id> ...`.
The empty directory plus no-tools prompt ensures that only GLM-supplied evidence
reaches the teacher. Stop immediately on `FINAL` or after response five.

Start every thread with this compact prefix:

```text
AW TEACHER CONTRACT. Response 1/5. Do not use tools or outside evidence.
Reply exactly as ASK: <one request> or FINAL: <decision>; WHY: <brief>;
GLM_STEPS: <steps>; RISKS: <risks>; VERIFY: <proof>.
```
