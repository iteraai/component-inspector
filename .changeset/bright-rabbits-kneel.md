---
"@iteraai/react-component-inspector": patch
---

Introduce a framework-neutral internal inspector adapter/tree contract used by the React adapter and runtimes, while keeping the existing React public contract intact. This is a refactor-only change that preserves external API surface and is intended to support future multi-framework adapter integrations.
