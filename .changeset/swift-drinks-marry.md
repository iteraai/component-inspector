---
"@iteraai/react-component-inspector": patch
"@iteraai/vue-component-inspector": patch
---

Extract the shared embedded bridge runtime, embedded runtime telemetry, and iteration inspector runtime into a private framework-neutral internal runtime core used by both React and Vue.

This preserves the existing public React and Vue exports and runtime behavior while replacing the internal selection bridge globals with `ITERA`-prefixed names and keeping backward-compatible aliases for existing `ARA`-prefixed consumers.
