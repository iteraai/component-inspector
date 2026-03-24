# @iteraai/vue-component-inspector

## 0.0.0

### Minor Changes

- Add the initial Vue runtime foundation for component-inspector integration, including adapter runtime config defaults and targets.
- Add explicit mounted app registration and lifecycle-safe cleanup for dispose/unmount paths.
- Add mounted app discovery fallback for Vue roots, duplicate suppression, and bootstrap helper registration hooks.
- Add Vue adapter tree support building on existing runtime defaults, including base tree utilities and shared truncation behavior.
- Add Vue 3 tree traversal that walks `subTree`, fragment children, Suspense branches, and KeepAlive cache entries.
- Add stable node identity and source metadata extraction for traversed tree nodes to improve node consistency and diagnostics.
- Add tests covering new tree identity, source mapping, and edge-case traversal behavior.
