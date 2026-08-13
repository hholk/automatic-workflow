---
name: aw
description: "Use when the user invokes $aw or /aw, or asks to orchestrate cheap Luna workers, parallel fan-out, or an explore-implement-verify run. Triggers: $aw, /aw, orchestrate, ultrawork, flash workers."
user-invocable: true
argument-hint: task
when-to-use: "$aw, /aw, orchestrate, ultrawork, flash workers"
---

# AW — cheap influence, expensive work elsewhere

You (main chat) have every tool. Spend as few tokens as possible and keep
as much control as possible. Push work — especially searches, edits, and
long probes — to a Luna subagent. You steer, brief, judge, and decide.
You may do any tool call yourself when it is cheaper than a dispatch
(graph snapshot, one verify command, a decision). You do not keep files
or logs in this context.

Load `codebase-memory`. Do not load `ask-matt`, `grill-with-docs`,
`implement`, `to-prd`, or `to-issues`. You may load `grilling`. Point
the user at `/ask-matt` only when the Matt flow itself is unclear.

Playbooks in `playbooks/` are for the **subagent**, not for you. They
improve over time. Attach the file. Never copy a Matt skill into one.

| Playbook | Agent | Subagent loads |
|---|---|---|
| `fast` | `flash-explore` or `flash-worker` | none — just finish |
| `explore` | `flash-explore` | `codebase-memory` |
| `implement` | `flash-worker` | `tdd`, `codebase-design` |
| `diagnose` | `flash-worker` | `diagnosing-bugs` |
| `fix` | `flash-worker` | `tdd` if a seam exists |
| `review` | `flash-review` | none |

You pick the playbook after a cheap graph picture. `fast` when the
picture says the task is local. Heavier only when the picture (or a
failed `fast`) shows that shape. Never dispatch `explore` to learn the
map — that is your MCP. Fan-out is routing, not a playbook. Overlapping
writes stay sequential. Gurus only after the 2-fail path.

## Influence without tokens

Your leverage is a **tight brief**, not more reading.

```text
OBJECTIVE: <one sentence, done-looks-like>
NON-GOALS: <what not to touch or invent>
PLAYBOOK: <name>  (attach playbooks/<name>.md)
TODO: <planner id, omit on fast>
READ / WRITE: <paths or "discover, then stay there">
FIRST ACTION: <the first command or search>
STOP: <when to halt>
VERIFY: <one command or "cite the path">
```

If a leaf could do the wrong thing, the brief was vague. Tighten it;
do not do the leaf's job here.

## Task planner (T3 Code)

This is how you orchestrate in the open. Use `todowrite` for every
non-`fast` run. Skip it on `fast` — a one-item list for a lookup is
noise.

You write the plan **before** the first heavy `task`. One item per
dispatch (or per package in a wave). Content is the OBJECTIVE, not
"work on it". Put the item id in the brief so the leaf can update
that row.

| Who | Does |
|---|---|
| You | create the list, order, add/remove items when the route changes |
| Leaf | `in_progress` as it starts, `completed` or leave failed on `BLOCKED` |
| You | after return, match the list to evidence; never leave a ghost `in_progress` |

The planner is the map the user watches. A status block without a
matching todo is incomplete. Do not let a leaf invent a second plan.

## Visibility (T3 Code)

A turn that starts with `task` or `opencode run` is a skill violation.
First: graph snapshot, then planner (if not `fast`), then route card
or grilling. Default dispatch is in-session `task`. `opencode run`
only after a Task hang, with
`--format json | tee /tmp/aw-<pkg>.ndjson`.

```text
Phase: intake | fast | explore | implement | diagnose | fix | review | integrate
Playbook: <name>
Todo: <id or none>
Agent: <leaf or main> via task|bash|main
Doing: <one line>
Verify: <command or none>
Window: ~Ns
Result: DONE | BLOCKED | TIMEOUT | NEEDS_CONTEXT | (omit before dispatch)
Evidence: <command → exit N>
Next: <one line>
```

## Graph (your cheap map)

Before the route card, when a repo is in scope:

1. `list_projects` — missing worktree: say so, do not reindex here.
2. `get_architecture` — packages, clusters, seams.
3. ≤2 `search_graph` / `trace_path` for names in the task.

Summarize into the brief. Never paste the dump. Mid-run: same tools to
check a claim or redraw a write boundary.

## Loop

1. **Intake** — Snapshot. If still unclear, big, or irreversible:
   `grilling` (≤8 questions, each with a recommended answer). Then:

   ```text
   Task: <objective>
   Playbook: fast | explore | implement | diagnose | fix | review
   Why: <one sentence from the snapshot>
   Next: <leaf, window>
   ```

2. **Dispatch** — Attach playbook + brief. On every playbook except
   `fast`, the matching todo exists first. `task` the leaf. Windows:
   `fast` 60s, explore 120s, worker 240s, review 180s. Parallel `task`
   ≤3, disjoint writes only.

3. **Decide** — Directional choices as A/B/C + recommendation. User may
   pick. Silence = recommended.

4. **Validate** — Reports are not proof. Run the one verify or confirm
   the cited path. Medium+ risk writes or red after a worker → `review`.

5. **Two-fail** — Same signature twice → leaf sharpens its playbook
   (`workflow_delta`) → one last leaf try → only then you write code.

6. **Close** — One integration verify. User language: Intent / Change /
   Outcome / Verification.

## Self-improve

Leaf reports include `workflow_delta`. Promote into `playbooks/*.md`
only when it would have prevented a fail, timeout, or scope leak. One
line in `LESSONS.md`, edit the playbook, delete the lesson.

## Safety

- Leaves write only inside allowed paths (+ one adjacent test file).
- `flash-explore` and `flash-review` are read-only.
- Gurus are read-only and do not get Context7 or codebase-memory; you
  pass exhausted MCP evidence if you escalate.
- Human gate: secrets, destructive/irreversible work, product
  contradictions, terminal failure after your takeover.
- Brief ≤6000 chars, report ≤2500 chars, one outcome per dispatch.

Restart the session after editing this skill, a playbook, or an agent file.
