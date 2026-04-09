# @iteraai/react-component-inspector

## 0.4.1

### Patch Changes

- 3ad2dc4: Extract the shared embedded bridge runtime, embedded runtime telemetry, and iteration inspector runtime into a private framework-neutral internal runtime core used by both React and Vue.

  This preserves the existing public React and Vue exports and runtime behavior while replacing the internal selection bridge globals with `ITERA`-prefixed names and keeping backward-compatible aliases for existing `ARA`-prefixed consumers.

## 0.4.0

### Minor Changes

- 11c1499: Expose editable values on iteration `element_selected` messages and improve preview-edit background handling in the example harness.

## 0.3.1

### Patch Changes

- 814b0e1: Fix preview edit application for text targets that should preserve the selected node,
  and expand the example harness so preview edits can be exercised against both text and image targets.

## 0.3.0

### Minor Changes

- 497bc56: Add Storybook manager relay and preview bootstrap foundations to support component inspector integration via the new `@iteraai/react-component-inspector/storybook` entrypoint. The new flow enables manager-side message forwarding and origin-trusted preview initialization for Storybook-based workflows.

## 0.2.0

### Minor Changes

- 365ef0c: Extend iteration selection payloads with a new optional, framework-neutral `componentPath` field.
  Keep backward compatibility by still emitting `reactComponentPath` from the React inspector.

### Patch Changes

- ef2642d: Introduce a framework-neutral internal inspector adapter/tree contract used by the React adapter and runtimes, while keeping the existing React public contract intact. This is a refactor-only change that preserves external API surface and is intended to support future multi-framework adapter integrations.
- 5e6de95: Add iteration preview patch runtime support so hosts can sync and clear transient text, style, size, and asset overrides, and harden the inline devtools backend hook to fail soft when the backend module shape differs across environments.

## 0.1.2

### Patch Changes

- 8f0fe7a: Add docs-drift guard fixtures and CI validation for the documented React, Next.js, Vite, and fiber-preferred inspector integration shapes.
- 98c9c61: Update the embedded inspector host-origin defaults and published integration examples from `iteraapp.com` to `iteradev.ai`.

## 0.1.1

### Patch Changes

- 0eaf903: Hardened embedded runtime telemetry target-origin resolution to fail closed. `'*'` and `'null'` targets are now rejected, relative targets are only accepted when a concrete parent referrer can be resolved, and telemetry capture remains local while cross-window forwarding is skipped when no concrete parent origin is available.
- cbfafbf: Require an authorized `HELLO` before secure bridge sessions handle inspector commands, bind secure sessions to the authorized sender and origin, and fail closed when `HELLO` payloads omit auth details.

## 0.1.0

### Minor Changes

- 00aa149: Prepare the first public npm release of the component inspector SDK packages.

### Patch Changes

- Updated dependencies [00aa149]
  - @iteraai/inspector-protocol@0.1.0
