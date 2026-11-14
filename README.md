# AW v6 · Operating learning

The native skill picker displays this version through `agents/openai.yaml`;
`$aw` and `/aw` retain the `aw` identity. UI changes use the shared
[UI/UX acceptance reference](references/ui-ux.md), with design guidance loaded only
for the affected surface and Main-owned visual evidence.

AW is a native subagent supervision skill for Codex and OpenCode, including T3
provider delegation backed by either host. The main agent keeps ownership of the
task, routes the work to a bounded worker, and verifies the final artifact.
Delegation is used when it reduces the total cost to an accepted result, not as
a reflex.

## Requirements

- A supported host: Codex, OpenCode, or a T3 provider built on either.
- Node.js with ES module support.
- The host's native agent and subagent capabilities.
- Network access only when the selected model provider requires it.

Copilot is present in the repository, but its DeepSeek 1017 binding is currently
unsupported. AW stops with `BLOCKED_ENVIRONMENT` instead of substituting another
model.

## Install

From this directory, check the profiles for one host:

```sh
node scripts/install-agents.mjs --host opencode
node scripts/install-agents.mjs --host codex
```

The check reports drift without changing files. After reviewing the exact
targets, install with:

```sh
node scripts/install-agents.mjs --host opencode --apply
node scripts/install-agents.mjs --host codex --apply
```

The installer refuses implicit multi-host writes and never silently overwrites
user-edited profiles. Reload or restart the host after installation, then probe
one child and confirm the native provider and model metadata.

See [references/setup.md](references/setup.md) for installation details and
[references/smoke-v5.md](references/smoke-v5.md) for smoke checks.

## Use

Invoke the skill by name or through the bundled command:

```text
$aw implement the requested change and verify it
/aw review the current branch
```

AW freezes a brief before dispatch:

```text
OBJECTIVE | SUCCESS | CONTEXT | PATHS | NON_GOALS | VERIFY
```

`SUCCESS` contains numbered, falsifiable criteria. `VERIFY` names the command
used to prove the result. The main agent integrates the worker's output and
checks every criterion against the final artifact; a worker's `DONE` is not
acceptance by itself.

Useful explicit modes:

```text
$aw research
$aw learn
```

Controlled research is opt-in. Operating learning runs at task-end when enabled;
`$aw learn` invokes the same bounded, reversible loop explicitly.
See [operating learning](references/operating-learning.md).

## Routing

The first matching route wins:

| Situation | Route |
| --- | --- |
| Authorization or a material user choice is missing | `human` |
| Live GUI or device interaction is required | `computer-use` |
| Main can finish and verify safely without a handoff | `direct` |
| A decisive technical question remains after a useful probe | `teacher` |
| A completed change needs independent evidence | `review` |
| Root cause is proven | `fix` |
| Desired state and verification are known | `implement` |
| A bug's cause is still unknown | `diagnose` |
| Read-only structure, ownership, or caller question | `explore` |

The authoritative table and load paths are in
[references/routing.md](references/routing.md).

## Roles

| Role | Purpose | Model |
| --- | --- | --- |
| Main agent | Owns the objective, integration, and acceptance | Host default |
| Worker / Reviewer on Codex | Bounded implementation or read-only investigation | Native Terra (low) |
| Worker / Reviewer on OpenCode | Bounded implementation or read-only investigation | Terra (low) |
| Computer-use on Codex / OpenCode | Bounded GUI operation | Terra (low) / DeepSeek 1017 |
| Teacher | Advisory decision support, no tools | Opus 5.5 |

Poteto supplies the default compatible style. Relevant Hstack skills are selected
through [Hstack compatibility rules](references/hstack.md). Cheap-model token
share is measured, never a quota.

Exact host bindings and confirmed-failure fallback rules are defined in
`prompts/profiles.json` and the corresponding runtime reference.

Workers have unique write ownership. Parallel writers need isolated worktrees
and a separate integration check. Only the main agent may dispatch or resume
agents.

Resolve a profile from the absolute skill directory:

```sh
node scripts/resolve-profile.mjs \
  --host codex \
  --role worker \
  --route implement \
  --task-class known-change \
  --complexity small
```

Use `--host opencode` for OpenCode. The resolver returns the prompt components,
model binding, budgets, and effective policy for the exact task cell.

## Verification

Run the repository test suite:

```sh
npm test
```

For a task handled by AW, the narrowest useful acceptance command is the
`VERIFY` command in the frozen brief. Missing or inconclusive evidence stays
`UNKNOWN`; it is never reported as `PASS`.

## Repository layout

| Path | Contents |
| --- | --- |
| `SKILL.md` | Skill entry point and execution rules |
| `references/` | Routing, host runtimes, policy, telemetry, and setup |
| `workflows/` | Route-specific procedures |
| `agents/` | Generated native profiles for each host |
| `contracts/` | Worker and teacher response formats |
| `prompts/` | Prompt profiles and model-specific instructions |
| `scripts/` | Resolver, installer, gates, telemetry, and tests |
| `playbooks/` | Versioned execution policy recipes |
| `integrations/` | OpenCode lifecycle and usage adapters |
| `LESSONS.md` | Historical operating lessons |

## Documentation

- [Routing](references/routing.md)
- [Codex runtime](references/runtimes-codex.md)
- [OpenCode runtime](references/runtimes-opencode.md)
- [Effective policy](references/policy-v5.md)
- [Execution gates](references/execution-v5.md)
- [Run context](references/run-context.md)
- [Teacher loop](references/teacher.md)
- [Learning rules](references/learning-v5.md)
- [Autoresearch](references/autoresearch.md)
