# @iteraai/angular-component-inspector

## 0.1.0

### Minor Changes

- 71287bb: Add the initial Angular component inspector package scaffold with runtime config defaults, `window.ng` dev-mode globals detection, a safe no-op adapter fallback, embedded bridge bootstrap helpers, and shared iteration runtime entrypoints.

  This also adds Angular CLI builder pass-through scaffolding and schemas for the supported dev-mode integration path, so Angular apps can wire the inspector through one startup bootstrap call plus builder configuration without explicit app registration hooks.

- 5da1a77: Add the Angular SDK's supported dev-only source metadata path and freeze the package as a publishable public contract.

  This adds Angular CLI builder-based source metadata injection, normalizes Angular tree node `source.file` and `source.line` with additive `column`, finalizes the builder/package metadata and README guidance, and includes the Angular package in tarball validation for the release flow.

- c07974e: Add deterministic Angular component tree snapshots through the existing inspector protocol using public `window.ng` dev-mode globals.

  This adds DOM and open shadow-root discovery for Angular component hosts, maps ownership through `ng.getOwningComponent(...)`, and allocates stable node IDs from component instances so repeated reads preserve node identity and root ordering across nested apps and projected content.

- 36429f3: Add Angular node props and highlight resolution through the existing inspector bridge using public `window.ng` dev-mode globals.

  This resolves component host elements with `ng.getHostElement(...)`, derives stable serialized props from `ng.getDirectiveMetadata(...)` plus current component instance values, and preserves the shared missing-node bridge error behavior for Angular `REQUEST_NODE_PROPS` and `HIGHLIGHT_NODE` requests.

- cddcac7: Add Angular component-path resolution for iteration selection through the shared inspector bridge using public `window.ng` dev-mode globals.

  This maps arbitrary DOM selections back to stable Angular component ancestry with `ng.getComponent(...)` and `ng.getOwningComponent(...)`, supports projected-content and overlay ownership cases where DOM placement differs from component ownership, and populates both `componentPath` and compatibility `reactComponentPath` in Angular iteration-selection payloads.

### Patch Changes

- fb1ae65: Fix the Angular package's builder integration and validate it with a real Angular example consumer.

  This adds an official Angular example workspace and smoke coverage for handshake, tree, source metadata, node props, highlight, snapshot, and selection flows, while also fixing Angular CLI builder resolution by exporting `./package.json` and tightening the source metadata plugin's TypeScript loading and filter handling.

## 0.0.0

### Minor Changes

- Add the initial Angular package scaffold with runtime config defaults, `window.ng` capability detection, a safe no-op adapter fallback, embedded bridge bootstrap helpers, iteration runtime entrypoints, and Angular CLI builder pass-through scaffolding.
