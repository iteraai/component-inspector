---
"@iteraai/vue-component-inspector": minor
---

Add an optional `@iteraai/vue-component-inspector/vite` entrypoint that injects richer compile-time Vue source metadata for tree snapshots. When enabled, the plugin records project-relative `file`, `line`, and `column` details on `defineComponent(...)` definitions while preserving the existing runtime-only best-effort fallback path for apps that do not opt in.
