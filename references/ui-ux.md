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
layout at the relevant viewport sizes. Capture the rendered states; for a restyle
compare before and after. Main inspects the screenshots and fixes material visual
or usability defects. A passing style inspector alone is insufficient evidence of
the user task; missing live or visual evidence stays UNKNOWN.

Reuse existing `verify-*` skills first. Invoke `create-verification-skill` only
when the user requests a reusable project verification setup; invoke
`maintain-verification-skill` only for requested maintenance. Their manual-only
flags remain in force. Installing a skill never grants recursive delegation,
commits, publication or broader permissions.
