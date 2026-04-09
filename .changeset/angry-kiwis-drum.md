---
"@iteraai/angular-component-inspector": minor
---

Add the initial Angular component inspector package scaffold with runtime config defaults, `window.ng` dev-mode globals detection, a safe no-op adapter fallback, embedded bridge bootstrap helpers, and shared iteration runtime entrypoints.

This also adds Angular CLI builder pass-through scaffolding and schemas for the supported dev-mode integration path, so Angular apps can wire the inspector through one startup bootstrap call plus builder configuration without explicit app registration hooks.
