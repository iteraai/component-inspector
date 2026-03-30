# @iteraai/vue-component-inspector

## 0.2.0

### Minor Changes

- 11c1499: Expose editable values on iteration `element_selected` messages and improve preview-edit background handling in the example harness.

## 0.1.0

### Minor Changes

- 8c7c020: Add the Vue inspector foundation with runtime config defaults, mounted-app registration/discovery APIs, and embedded mount bootstrap registration support.
- 128f1b1: Add Vue tree snapshot support, including shared tree adapter utilities, Vue 3 traversal through fragments, Suspense branches, and KeepAlive caches, stable node identity, and best-effort source metadata.
- 210558a: Add an optional `@iteraai/vue-component-inspector/vite` entrypoint that injects richer compile-time Vue source metadata for tree snapshots. When enabled, the plugin records project-relative `file`, `line`, and `column` details on `defineComponent(...)` definitions while preserving the existing runtime-only best-effort fallback path for apps that do not opt in.
- 848bae4: Add Vue component-path resolution for iteration element selection, including direct ancestry lookup from Vue DOM markers and a safe fallback that walks known component root elements when those markers are unavailable.
- cd72ac6: Add Vue node props inspection and DOM highlight target resolution. The Vue inspector can now resolve stable node IDs back to mounted component instances, return serialized component props, and find highlightable DOM elements for DOM-rooted, fragment-backed, and nested component trees.
- 5ee5f0c: Add the functional Vue package surface with root exports plus `bridgeRuntime`, `embeddedBootstrap`, and `iterationInspector` entrypoints. This also adds mount-aware embedded bootstrap helpers so Vue apps can register explicitly and start the inspector bridge before `app.mount()`.

### Patch Changes

- 737a739: Document and freeze the Vue package's published surface. This adds the package README to the tarball, locks the root and subpath exports with public-contract coverage, and validates the built Vue artifact through the monorepo pack smoke fixture.
- f5abf78: Expose the Vue iteration inspector preview edit contract so it matches the React package. This adds the preview edit message and status types to the Vue public surface, validates the additive runtime capability payload, and covers the shared preview patch runtime with a Vue integration test.
- 839986e: Add a customer-style Vue example consumer smoke path that validates built-package imports, handshake, tree snapshots, node props, highlighting, snapshots, and iteration selection behavior. This also wires the Vue smoke fixture into the workspace scripts and CI checks so regressions in supported Vue 3 browser consumption fail clearly.

## 0.0.0

### Minor Changes

- Add the initial Vue runtime foundation for component-inspector integration, including adapter runtime config defaults and targets.
- Add explicit mounted app registration and lifecycle-safe cleanup for dispose/unmount paths.
- Add mounted app discovery fallback for Vue roots, duplicate suppression, and bootstrap helper registration hooks.
- Add Vue adapter tree support building on existing runtime defaults, including base tree utilities and shared truncation behavior.
- Add Vue 3 tree traversal that walks `subTree`, fragment children, Suspense branches, and KeepAlive cache entries.
- Add stable node identity and source metadata extraction for traversed tree nodes to improve node consistency and diagnostics.
- Add tests covering new tree identity, source mapping, and edge-case traversal behavior.
