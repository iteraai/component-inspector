# @iteraai/react-component-inspector

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
