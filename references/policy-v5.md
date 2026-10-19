# Effective policy and host support

`scripts/effective-policy.mjs` selects a single policy for the resolver and
research selection. Start with `playbooks/current.json` defaults. An exact
model-provenance cell wins when it exists. Otherwise an explicit
`host|taskClass|complexity` cell wins. Otherwise use the defaults. A cell replaces
only the listed policy fields. The teacher threshold is frozen and cannot be
overridden by a cell. Cells cannot change models, permissions, or host
capabilities. An explicit prompt profile request must still pass registry
validation for the selected native profile. The existing schema version 4 wire
format remains supported.

The resolver returns the selected recipe, prompt components, context budget,
worker step budget and handback threshold together with `effective_policy`.
Pass observed actor model/fallback metadata as `actors` for an exact provenance
cell. Without observed actors, the resolver selects only an explicit coarse task
cell or defaults. Configured model intent never activates a provenance cell.
No runtime model discovery occurs here.

`render-agents.mjs` renders native worker limits from the same playbook defaults.
All default and GLM worker profiles now use 125 steps. A task cell can require
an earlier handback. OpenCode enforces its generated native cap, so a higher
cell budget needs a reviewed regeneration before use. Codex and Copilot worker
instructions carry the generated default cap. These limits never prove task
completion and never reset after a teacher ASK.

| Host | Dispatch | Worker | Advisory teacher | Direct teacher snapshot |
|---|---|---|---|---|
| Codex | Existing native agent | Supported | Existing tool-free profile | Unsupported |
| OpenCode | Existing native agent | Supported | Existing tool-free profile | Unsupported |
| GitHub Copilot | Existing native agent | Supported | Unsupported | Unsupported |
| T3 with Codex provider | Provider delegate | Codex binding | Codex binding | Unsupported |
| T3 with OpenCode provider | Provider delegate | OpenCode binding | OpenCode binding | Unsupported |

T3 must supply `providerHost: "codex"` or `providerHost: "opencode"`, or
`--host t3 --provider-host codex` on the resolver CLI. This selects a provider
binding. It does not claim T3 native discovery, install a T3 agent, dispatch a
live model, or prove that the delegate is available. Unknown hosts and missing
or unsupported T3 provider hosts fail closed. Every dispatch still requires
observed provider/model provenance from the execution host.

Teacher bindings explicitly name their registered prompt profile while keeping
the chosen native models. Teachers remain tool-free. An optional
`inspectionRequest` adds an eligibility assessment and the inspection reference.
An eligible request returns `UNSUPPORTED_HOST` on every current real host,
with `WORKER_EVIDENCE` as its fallback. Two proven technical no-progress
attempts alone do not grant tools. See [teacher inspection](teacher-inspection.md).

# Installing repository profiles

`node scripts/install-agents.mjs --host codex` checks only Codex. Add `--apply`
to install the selected repository profiles. `opencode` and `github-copilot`
are also supported. Omit `--host` only for a read-only check of all native hosts.
Applying requires `--host`, or an explicit `--hosts codex,opencode,github-copilot`
list; there is no implicit multi-host write.
The installer creates missing directories only for selected hosts, validates
all selected destinations before writing, and refuses unrelated files or
symlinks, including broken unrelated symlinks. Repeating a successful apply
keeps current files and its ownership manifest unchanged. Codex profiles are
regular files with mode 0600. OpenCode uses owned symlinks. Copilot uses regular
files. T3 uses its explicit provider's installation; it has no installation path.

These commands describe repository tooling. M1 validation uses temporary homes
and does not install or change production profiles.

For an existing v4 checkout, use the [v5 migration checklist](migration-v5.md).

## Explicit inputs for normal dispatch

The resolver CLI accepts `--actors /path/actors.json`. This names one regular
JSON file of at most 16 KiB. The object must contain `main`, `worker` and
`teacher` actor records. Each used actor names its `requested_model`, actual
`resolved_model`, and `model_source` of `native` or `provider`. Substitutions
also need an explicit provider, primary, or runtime fallback reason. Unused
actors use `used: false` and cannot claim a resolved model. Unknown or missing
sources are rejected. The observed worker model must match the selected worker.
These caller-supplied records are metadata, not authentication. Main must verify
them against host execution evidence before supplying them. The resolver never
reconstructs them from transcripts, sessions, or configured intent.

Use `--playbook /path/policy.json` for an explicitly selected promoted playbook,
otherwise the repository current playbook applies. This input is capped at
1 MiB. Exact cells require `--actors`, `--route`, `--task-class` and
`--complexity`; missing actor input still uses coarse cells or defaults.

Reviewed worker lessons use explicit inputs together:
`--lessons /path/lessons.json --project PROJECT --project-version REVISION --prerequisites /path/facts.json`.
The lesson array is capped at 256 KiB and prerequisite facts at 16 KiB. The
resolver uses `selectReviewedLessons` with the effective policy's exact version.
It returns only independently reviewed, unexpired entries whose project,
revision, policy version and every prerequisite match. Main appends the selected
`lessons[].instruction` and IDs to the next bounded brief. Teachers receive no
lessons, and lesson content never changes tools or permissions.

For a worker invocation, `--run-id` or the existing `AW_RUN_ID` environment value
records a prompt-free policy selection receipt. The receipt binds the actual
provider host, including the explicit Codex or OpenCode provider behind T3.
Supply `--task-class` and `--complexity` for a complete receipt. A legacy call
without either still resolves and reports `UNRECORDED` with
`MISSING_TASK_IDENTITY`; it does not invent task metadata. With no explicit or
environment run ID, the resolver records no receipt. Teacher calls do not
replace a worker selection receipt.
