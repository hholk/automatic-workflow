---
name: aw
description: "Use when the user invokes $aw or /aw, or asks to orchestrate cheap Luna workers, parallel fan-out, or an explore-implement-verify run. Triggers: $aw, /aw, orchestrate, ultrawork, flash workers."
user-invocable: true
argument-hint: task
when-to-use: "$aw, /aw, orchestrate, ultrawork, flash workers"
---

# AW — native sessions, bounded writes

Main takes the graph snapshot, then performs a full `todowrite` handoff before
any dispatch. After the gate, long or parallel read-only exploration/review
uses `aw_spawn`: it is asynchronous and immediately returns the native child
session ID. The child/native session is the sole state source; there is no
ledger, polling, daemon, PID, or custom runner. Main only routes, orchestrates,
and verifies; it does not implement/search/diagnose post-gate.

Load `codebase-memory`. Do not load `ask-matt`, `grill-with-docs`,
`implement`, `to-prd`, or `to-issues`. You may load `grilling`. Point
the user at `/ask-matt` only when the Matt flow itself is unclear.

Playbooks in `playbooks/` are for the **subagent**, not for you. They
improve over time. Attach the file. Never copy a Matt skill into one.

| Playbook | Agent | Subagent loads |
|---|---|---|
| `fast` | `flash-explore` or `flash-worker` | matching todo row |
| `explore` | `flash-explore` | `codebase-memory` |
| `implement` | `flash-worker` | `tdd`, `codebase-design` |
| `diagnose` | `flash-worker` | `diagnosing-bugs` |
| `fix` | `flash-worker` | `tdd` if a seam exists |
| `review` | `flash-review` | none |

You pick the playbook after a cheap graph picture. `fast` when the
picture says the task is local. Heavier only when the picture (or a
failed `fast`) shows that shape. Never dispatch `explore` to learn the
map — that is your MCP before the handoff gate. Fan-out is routing, not a
playbook. Overlapping writes stay sequential. Gurus only after the 2-fail
path.

## Influence without tokens

Your leverage is a **tight brief**, not more reading.

```text
OBJECTIVE: <one sentence, done-looks-like>
NON-GOALS: <what not to touch or invent>
PLAYBOOK: <name>  (attach playbooks/<name>.md)
TODO: <exact content string of the planner row>
READ / WRITE: <paths or "discover, then stay there">
FIRST ACTION: <the first command or search>
STOP: <when to halt>
VERIFY: <one command or "cite the path">
```

If a leaf could do the wrong thing, the brief was vague. Tighten it;
do not do the leaf's job here.

## Task planner (T3 Code)

T3 Code's sidebar only renders a `todowrite` call whose input is the
**full** `{ todos: [...] }` array in **this** session. Child-session
updates are invisible. Every subagent dispatch requires the planner first,
including `fast`.

You own the list. Before every `task` dispatch, and again whenever status
changes, call `todowrite` with the complete list — never a single-row patch,
never an `id` without `content`.

```text
todowrite({
  todos: [
    { content: "<OBJECTIVE>", status: "pending"|"in_progress"|"completed", priority: "medium" }
  ]
})
```

`content` is the identity. `status` must be those three snake_case
strings (`in_progress`, not `inProgress`). After a leaf returns, rewrite
the whole array from evidence. Never leave `in_progress` on a finished
item.

Put `content` (not an invented id) in the brief as `TODO` so you can
match the row. Do not ask the leaf to `todowrite`.

## Native background sessions

Use `aw_status` and `aw_read` as explicit pull controls. A toast is notification
only; it does not inject results into the parent. On each new user turn, obey
human instruction first, then inspect relevant unread/background native jobs;
do not automatically read irrelevant jobs. `aw_control` aborts or steers the
child. Explain that the session ID is the job ID. Only `flash-explore` and
`flash-review` may run as read-only background agents.

Write-capable implementation/fix remains a native synchronous task: one bounded
checkpoint, one small write seam, one targeted verify. Do not promise an in-call
timed update; Main verifies afterward. Before `aw_spawn` and task dispatch,
refresh the full main-session `todowrite`. Todo remains main-session-owned.
Route cards say pending before spawn
and include the real returned session ID afterward; never promise a fictional
pre-dispatch host Session ID. Current UI is tool cards + toast + explicit
status/read: no T3 source patch claims and no automatic live panel.

## Visibility (T3 Code)

Main performs graph snapshot then full Todo handoff before dispatch. A turn
that starts with a dispatch is a skill violation.
Before the handoff gate: graph snapshot, then the complete planner list, then
route card or grilling. After the gate, every `aw_spawn` or task dispatch is
preceded by a fresh complete `todowrite`.

```text
Phase: intake | fast | explore | implement | diagnose | fix | review | integrate
Playbook: <name>
Todo: <id or none>
Agent: <leaf or main> via task|bash|main
Doing: <one line>
Verify: <command or none>
Job ID: <stable id>
Session ID: <host session id>
Started: <absolute ISO timestamp>
Deadline: <absolute ISO timestamp; planned check-in, not a stop condition when visibility is fresh>
Check-in: <absolute ISO timestamp>
Window: informational only; never the sole user-facing timing promise
Progress evidence: <observable command/output or BLOCKED error>
Intervention: continue (new absolute check-in + reason) | reroute | cancel | main takeover
Result: DONE | BLOCKED | TIMEOUT | INTERRUPTED | (omit before dispatch)
Next: <one line>
```

## Graph (your cheap map)

Before the Todo handoff gate and before the route card, when a repo is in scope:

1. `list_projects` — missing worktree: say so, do not reindex here.
2. `get_architecture` — packages, clusters, seams.
3. ≤2 `search_graph` / `trace_path` for names in the task.

Summarize into the brief. Never paste the dump. After the Todo handoff gate,
the main does not search, inspect, diagnose, or redraw write boundaries;
subagents do that work.

## Loop

1. **Intake (pre-gate)** — Snapshot. If still unclear, big, or irreversible:
  `grilling` (≤8 questions, each with a recommended answer). Then:

   ```text
   Task: <objective>
   Playbook: fast | explore | implement | diagnose | fix | review
   Why: <one sentence from the snapshot>
   Next: <leaf, window>
   ```

2. **Handoff** — Write the complete Todo list. This is the prompt hook:
  only after it succeeds may any subagent be dispatched. Attach playbook +
  brief. On every playbook, including `fast`, the matching todo exists first.
   Background reads may run in parallel; writes remain bounded and sequential.

3. **Dispatch / Decide (post-gate)** — Route subagents and make directional
  choices as A/B/C + recommendation. User may pick. Silence = recommended.
  The main does not perform exploration, implementation, fixes, review, or
  diagnosis here.

4. **Validate (post-gate)** — Reports are not proof. The main runs the one
  verify or confirms the cited path. Medium+ risk writes or red after a
  worker → route `review`.

5. **Two-fail** — After exactly two failed fix iterations, if the behavior
  still fails, the main takes over with one surgical fix. Do not dispatch a
  third fix iteration. The main then routes or verifies as usual.

6. **Close** — One integration verify. User language: Intent / Change /
  Outcome / Verification.

## Self-improve

Before close, record a structured Forecast Mismatch lesson whenever the
orchestrator must do substantive work after a worker return, actual runtime
clearly exceeds the initial check-in forecast, more than one continue or
extended check-in is needed, a worker stops because the path/brief/playbook was
avoidably wrong, or the user intervenes due to perceived hanging. Include:
Date, Todo/Playbook, forecast vs actual/check-in count, symptom/evidence, root
cause, orchestrator intervention, proposed skill/playbook change, and status.
The status lifecycle is `pending` → `promoted` after the rule/playbook change
→ `validated` after a later successful run; only then may the lesson be
optionally archived. Lessons are not deleted immediately after promotion.
Leaf reports include `workflow_delta`; promote only when it would have
prevented a fail, timeout, or scope leak.

## Safety

- Leaves write only inside allowed paths (+ one adjacent test file).
- `flash-explore` and `flash-review` are read-only.
- Gurus are read-only and do not get Context7 or codebase-memory; you
  pass exhausted MCP evidence if you escalate.
- Human gate: secrets, destructive/irreversible work, product
  contradictions, terminal failure after your takeover.
- Brief ≤6000 chars, report ≤2500 chars, one outcome per dispatch.

Restart the session after editing this skill, a playbook, or an agent file.
