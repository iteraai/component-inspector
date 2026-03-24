# @iteraai/vue-component-inspector

## 0.1.0

### Minor Changes

- 8c7c020: Add the Vue inspector foundation with runtime config defaults, mounted-app registration/discovery APIs, and embedded mount bootstrap registration support.
- 128f1b1: Add Vue tree snapshot support, including shared tree adapter utilities, Vue 3 traversal through fragments, Suspense branches, and KeepAlive caches, stable node identity, and best-effort source metadata.
- cd72ac6: Add Vue node props inspection and DOM highlight target resolution. The Vue inspector can now resolve stable node IDs back to mounted component instances, return serialized component props, and find highlightable DOM elements for DOM-rooted, fragment-backed, and nested component trees.

## 0.0.0

### Minor Changes

- Add the initial Vue runtime foundation for component-inspector integration, including adapter runtime config defaults and targets.
- Add explicit mounted app registration and lifecycle-safe cleanup for dispose/unmount paths.
- Add mounted app discovery fallback for Vue roots, duplicate suppression, and bootstrap helper registration hooks.
- Add Vue adapter tree support building on existing runtime defaults, including base tree utilities and shared truncation behavior.
- Add Vue 3 tree traversal that walks `subTree`, fragment children, Suspense branches, and KeepAlive cache entries.
- Add stable node identity and source metadata extraction for traversed tree nodes to improve node consistency and diagnostics.
- Add tests covering new tree identity, source mapping, and edge-case traversal behavior.
