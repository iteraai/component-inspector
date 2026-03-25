# @iteraai/react-component-inspector

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
