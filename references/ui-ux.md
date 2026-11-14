# Scoped UI/UX work

Use for interface changes and their acceptance, including direct work. Main adds
the affected user task, visible success condition, states and relevant viewport
sizes to the existing SUCCESS criteria. Keep the project's stack, brand, working
flows and established interaction patterns.

## Design

- Distinguish a page people read from an app screen people work in. For new design
  or redesign, resolve `design-taste-frontend` from the active catalog and consult
  its matching page or app-screen reference. Its visual house rules are optional
  preferences subordinate to the requested brand, task and accessibility needs.
- For a component or small correction, match the surrounding design and inspect
  only the affected flow. Skip direction generation and alternative layouts.
- When a novel interaction has no established pattern and a material decision is
  unresolved, use the relevant `prototype` branch to answer that question before
  production implementation. Compare alternatives only when that decision needs
  them; AW retains orchestration and release authority.

## Acceptance

Use the project's existing verification skill or harness and the host's native
browser/device tools. Drive the real user path and observe its result, including
relevant persistence or side effects. Check the frequent task with realistic,
consistent data and the changed loading, empty, success and error states.

Check keyboard access, visible focus, accessible names, readable contrast and
layout at the relevant viewport sizes. Use the screenshot checkpoints below for
rendered evidence. A passing style inspector alone is insufficient evidence of
the user task; missing live or visual evidence stays UNKNOWN.

## Screenshot checkpoints

For every user-visible UI change, use screenshots during implementation and at
acceptance. Main includes the affected screens, states and viewport sizes in
SUCCESS and any worker brief. Capture through the project's existing harness or
host-supported browser/device tools, within their permissions and restrictions.

1. Before editing an existing UI, capture and inspect the affected starting state.
   For a new screen, record that no prior rendered state exists. If the baseline
   is unavailable, name the gap; never reconstruct a supposed before image.
2. After each meaningful visual change, capture and inspect the affected rendered
   state. Use the images to find clipping, overflow, spacing, hierarchy, contrast
   and interaction feedback problems, fix material defects and capture again.
   Check at semantic state changes rather than after every click or code edit.
3. At acceptance, capture the final affected screens and changed loading, empty,
   success and error states that apply to the task. Show the visible result of
   changed interactions. For responsive web UI, include a representative wide
   and narrow viewport; use the relevant target sizes for native or fixed-size UI.
   Compare before and after at matching states and sizes when a baseline exists.
4. Save screenshots with the existing task artifacts. Identify each image's
   screen/state, viewport and source revision or capture point. Workers return
   these paths with their evidence. Main opens and inspects the final images and
   checks their coverage against SUCCESS before accepting the UI work.
5. Link the most useful final screenshots in the handback, including a before/after
   pair when it explains the change. State which screens, states and sizes were
   inspected and which remain unverified. Tool output saying an image was saved
   is not evidence that anyone inspected it.

Scale captures to distinct affected states, not a screenshot quota. Reuse images
only while the rendered state, viewport and relevant implementation are unchanged;
refresh affected captures after further changes. If capture tools or the live UI
are unavailable, report the concrete blocker and keep visual acceptance UNKNOWN.

Reuse existing `verify-*` skills first. Invoke `create-verification-skill` only
when the user requests a reusable project verification setup; invoke
`maintain-verification-skill` only for requested maintenance. Their manual-only
flags remain in force. Installing a skill never grants recursive delegation,
commits, publication or broader permissions.
