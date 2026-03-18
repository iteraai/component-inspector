---
'@iteraai/react-component-inspector': patch
---

Hardened embedded runtime telemetry target-origin resolution to fail closed. `'*'` and `'null'` targets are now rejected, relative targets are only accepted when a concrete parent referrer can be resolved, and telemetry capture remains local while cross-window forwarding is skipped when no concrete parent origin is available.
