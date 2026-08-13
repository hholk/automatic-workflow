# AW Stateless Native Session Adapter

> **Implementation note:** Execute this plan task-by-task with the `implement` playbook. Each task is a vertical TDD slice: write one behavior probe, run it RED, implement the smallest change, then run it GREEN. Do not edit OpenCode/T3 source or generated bundles.

**Goal:** Replace the obsolete AW hybrid execution design with a stateless native OpenCode child-session adapter. Native OpenCode sessions are the sole lifecycle and result model; AW keeps no duplicate job ledger.

**Non-goals:** No T3 source changes; no edits to `bin.mjs` or `bin.mjs.map`; no durable AW state or duplicate lifecycle model; no new background machinery, cache, or dependency; no commit or push.

**Installed interface constraint:** The installed declarations report `@opencode-ai/plugin` and `@opencode-ai/sdk` 1.4.10 at runtime, while `/Users/henrikholkenbrink/.config/opencode/package.json` declares plugin 1.4.1. SDK 1.4.10 exposes legacy calls `session.create({ body, query })`, `session.children({ path, query })`, `session.status({ query })`, `session.messages({ path, query })`, `session.abort({ path, query })`, and `session.promptAsync({ path, body, query })`. Its `SessionCreateData` declaration omits `permission`; the implementation must use a narrowly documented runtime compatibility cast to pass the required deny-first `permission` body field, and the fake-client test must assert the actual legacy call shape. If the runtime rejects that field, record the exact error and the supported permission-admission adaptation in this plan before proceeding; do not invent a different SDK shape.

## Files and architecture

- Create `/Users/henrikholkenbrink/.config/opencode/skills/aw/plugin/aw-native.js`: one OpenCode server plugin module. Export the plugin entry point and register exactly `aw_spawn`, `aw_status`, `aw_read`, and `aw_control`.
- Create `/Users/henrikholkenbrink/.config/opencode/skills/aw/plugin/aw-native.test.mjs`: fake-client behavior tests for the public tool interface and event hook.
- Delete `/Users/henrikholkenbrink/.config/opencode/skills/aw/plugin/aw-hybrid-ledger.js` and `/Users/henrikholkenbrink/.config/opencode/skills/aw/plugin/aw-hybrid-ledger.test.mjs` during implementation if present.
- Modify `/Users/henrikholkenbrink/.config/opencode/opencode.json` only to register `file:///Users/henrikholkenbrink/.config/opencode/skills/aw/plugin/aw-native.js` directly, preserving existing plugins.
- Modify `/Users/henrikholkenbrink/.config/opencode/package.json` only if needed to align `@opencode-ai/plugin` to installed `1.4.10`; do not run an unrelated upgrade.
- Do not modify any T3 source, AW skill documentation, tests outside the plugin test named above, `bin.mjs`, or `bin.mjs.map`.

The adapter is a deep module at the plugin seam: its small four-tool interface hides native-session authorization, bounded projection, and permission construction. The native child session ID is the job ID. There is no local lifecycle, result, or restart-recovery copy. A restart can lose only an in-memory notification-deduplication `Set`; native sessions and native messages remain authoritative.

## Task 1 — Pin the installed SDK and write the first RED probe

- [ ] Read the installed declarations and record the exact shapes used by the adapter:
  ```bash
  node -p "require('/Users/henrikholkenbrink/.config/opencode/node_modules/@opencode-ai/plugin/package.json').version"
  node -p "require('/Users/henrikholkenbrink/.config/opencode/node_modules/@opencode-ai/sdk/package.json').version"
  ```
  Expected: both print `1.4.10`.
- [ ] Create `aw-native.test.mjs` with a fake client and one public-interface test importing `aw-native.js`. Assert the registered keys are exactly `aw_control`, `aw_read`, `aw_spawn`, `aw_status`.
- [ ] Run the first RED probe:
  ```bash
  node --test /Users/henrikholkenbrink/.config/opencode/skills/aw/plugin/aw-native.test.mjs
  ```
  Expected: non-zero because `aw-native.js` is not implemented.
- [ ] Add the minimal plugin factory using `tool()` and the installed legacy plugin context. Re-run the same command; expected: zero for the registration slice.

## Task 2 — Implement `aw_spawn` as a stateless child admission slice

- [ ] Extend the fake-client test for `aw_spawn({ prompt, title, agent? })` with context `{ sessionID: 'parent-session', directory: '/repo' }`. Assert `client.session.create` receives `{ body: { parentID: 'parent-session', title: '[aw] ...', permission: [...] }, query: { directory: '/repo' } }`, with deny-first `{ permission: '*', pattern: '*', action: 'deny' }` followed only by read-only allowances required by the installed host (`read`, `glob`, `grep`, `list`, and codebase-memory tools if supported).
- [ ] Assert the returned session ID is also the returned job ID, the result says `running`, and `promptAsync` receives the child path, supplied agent/prompt, and a system instruction prohibiting edits, writes, commits, pushes, nested tasks, and destructive commands.
- [ ] Assert `promptAsync` is invoked without awaiting completion, returns immediately, and no parent `prompt`, `promptAsync`, message, or synthetic completion call occurs.
- [ ] Implement only this slice: create the child with current context directory and `parentID: context.sessionID`, call native `promptAsync`, return a bounded native-session projection, and keep no map, file, database, timer, or result variable across calls.
- [ ] Run:
  ```bash
  node --test /Users/henrikholkenbrink/.config/opencode/skills/aw/plugin/aw-native.test.mjs
  ```
  Expected: zero; the exact legacy request shape and permission order are asserted.

## Task 3 — Add direct-child authorization and native status/read projections

- [ ] Add RED tests proving every lookup first calls `client.session.children({ path: { id: context.sessionID }, query: { directory: context.directory } })`, accepts only a matching child ID whose title starts with `[aw] `, and rejects an arbitrary session, sibling, grandchild, or unprefixed child without calling its status/messages.
- [ ] Add tests for `aw_status({})` returning at most 20 authorized direct AW children with native status values; `aw_status({ id })` returning one authorized child; and bounded fields only (ID, title, native status, timestamps where native data provides them).
- [ ] Add tests for `aw_read({ id })` fetching native messages with a bounded `limit`, selecting the latest assistant text, truncating it to the declared bound, and returning the native status. It must not sleep, loop, or manufacture stale/completed state.
- [ ] Implement authorization as a fresh native children lookup on every status/read/control request. Use the installed legacy paths and query directory. Use explicit constants for maximum children, message count, and text length; never return prompts, environment data, or full message histories.
- [ ] Run the plugin test; expected: zero, including unauthorized and output-bound cases.

## Task 4 — Add `aw_control` and event-only toast behavior

- [ ] Add RED tests for `aw_control({ id, action: 'abort' })` and `{ id, action: 'steer', message }`. Assert abort calls only native child `session.abort({ path: { id }, query: { directory } })`; steer calls only child `session.promptAsync({ path: { id }, body: { parts: [{ type: 'text', text: message }] }, query: { directory } })`; neither injects into the parent. Reject unsupported actions, unauthorized IDs, and terminal children when native status makes that detectable. Do not alter permissions or add parent context to the steer prompt.
- [ ] Implement the control slice and run the plugin test; expected: zero.
- [ ] Add fake events for `session.idle` and `session.error`. The event hook must re-query native session children/get data, filter to `[aw] ` direct children, and show a bounded success/error toast only for a newly observed terminal child. Use an in-memory `Set` solely to deduplicate notifications; restart loss of that set must be stated as harmless because native session/result state is not copied.
- [ ] Add tests proving unrelated sessions, unprefixed sessions, unauthorized descendants, and duplicate events produce no toast; assert no filesystem persistence import or call exists.
- [ ] Run:
  ```bash
  node --test /Users/henrikholkenbrink/.config/opencode/skills/aw/plugin/aw-native.test.mjs
  ```
  Expected: zero.

## Task 5 — Register the adapter and remove obsolete artifacts

- [ ] Delete the obsolete ledger module and test paths listed in **Files and architecture** if they exist. Confirm `aw-native.js` and `aw-native.test.mjs` are the only plugin implementation/test files in the AW plugin directory.
- [ ] Change the global plugin array to include exactly:
  `file:///Users/henrikholkenbrink/.config/opencode/skills/aw/plugin/aw-native.js`.
- [ ] If the installed/runtime check showed the declaration mismatch is material, change only `/Users/henrikholkenbrink/.config/opencode/package.json` from `1.4.1` to `1.4.10`; otherwise leave it unchanged and document why in the implementation diff.
- [ ] Validate configuration:
  ```bash
  jq empty /Users/henrikholkenbrink/.config/opencode/opencode.json
  node -e "const p=require('/Users/henrikholkenbrink/.config/opencode/opencode.json'); if (!p.plugin.includes('file:///Users/henrikholkenbrink/.config/opencode/skills/aw/plugin/aw-native.js')) process.exit(1)"
  ```
  Expected: both exit 0.

## Task 6 — Specify routing and fresh-session smoke without changing AW/T3 source

- [ ] Keep routing changes in this implementation plan only: long or parallel read-only work uses `aw_spawn`; bounded write work uses synchronous native `task`; user messages outrank background reads; the parent explicitly calls `aw_status`/`aw_read`; no timed update is promised while a synchronous call is active.
- [ ] Do not add AW skill-doc, command, playbook, `bin.mjs`, or T3 changes. The implementation acceptance check must fail if those paths change.
- [ ] After restarting OpenCode in a fresh session, run a harmless read-only smoke that asks the child to inspect `package.json` and report only its package name. Verify the parent accepts another user message, `aw_status` finds the child, `aw_read` returns bounded native assistant text, and no parent message was created.
- [ ] In the fresh session, run one steer and one abort smoke against separate children. Verify native child-only calls and detectable terminal rejection.
- [ ] Record any installed-interface incompatibility discovered during smoke here with the exact command, error, and minimal compatibility adaptation; no speculative fallback is allowed.

## Final gauntlet and acceptance criteria

- [ ] Run the artifact probe:
  ```bash
  test -f /Users/henrikholkenbrink/.config/opencode/skills/aw/plugin/aw-native.js && test -f /Users/henrikholkenbrink/.config/opencode/skills/aw/plugin/aw-native.test.mjs && test ! -e /Users/henrikholkenbrink/.config/opencode/skills/aw/plugin/aw-hybrid-ledger.js && test ! -e /Users/henrikholkenbrink/.config/opencode/skills/aw/plugin/aw-hybrid-ledger.test.mjs
  ```
  Expected: exit 0.
- [ ] Run the verification command:
  ```bash
  node --test /Users/henrikholkenbrink/.config/opencode/skills/aw/plugin/aw-native.test.mjs && jq empty /Users/henrikholkenbrink/.config/opencode/opencode.json && git -C /Users/henrikholkenbrink/.config/opencode/skills/aw diff --check
  ```
  Expected: exit 0.
- [ ] Run the targeted architecture grep and require no positive obsolete-architecture requirements:
  ```bash
  ! grep -nE 'createLedger|jobs\.json|PID file|background daemon|polling loop|result store|stale detection|aw_delegate|aw_cancel|aw_steer' /Users/henrikholkenbrink/.config/opencode/skills/aw/docs/superpowers/plans/2026-08-13-aw-hybrid-execution.md | grep -v 'grep -nE'
  ```
  Expected: exit 0. (The plan may describe the replacement's absence, but must not prescribe those designs.)
- [ ] Self-review this plan for exact paths, checkbox steps, no placeholders (`TBD`, `TODO`, `TBA`), consistent tool names, exact commands/expected outcomes, TDD order, no T3-source changes, and no commit/push step. `git diff --check` must remain zero.

**Acceptance criteria:**

- **AC-1:** The four tool names are exactly `aw_spawn`, `aw_status`, `aw_read`, and `aw_control`; session ID equals job ID; no local lifecycle/result model exists.
- **AC-2:** Spawn creates a direct child with `parentID`, `[aw] ` title, current directory, deny-first read-only permission, native `promptAsync`, immediate return, and untouched parent.
- **AC-3:** Every status/read/control request authorizes through fresh direct-child enumeration plus ID and title-prefix matching; arbitrary session access is rejected.
- **AC-4:** Status/read/control use native status/messages/abort/promptAsync, bounded outputs, no polling, no parent injection, and terminal/unauthorized rejection where detectable.
- **AC-5:** Toast filtering is native-identity based and uses only an in-memory dedupe set; restart may lose dedupe but cannot lose native session or result state.
- **AC-6:** Registration points directly to the required `aw-native.js` file URL, package alignment is only to installed 1.4.10 if needed, and no forbidden source paths change.
- **AC-7:** Routing and smoke evidence covers read-only spawn, synchronous bounded writes, explicit status/read, user-message priority, steer, abort, and honest no-timed-update behavior.

**No commit or push is authorized by this plan.**
