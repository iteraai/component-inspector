---
"@iteraai/angular-component-inspector": minor
---

Add Angular node props and highlight resolution through the existing inspector bridge using public `window.ng` dev-mode globals.

This resolves component host elements with `ng.getHostElement(...)`, derives stable serialized props from `ng.getDirectiveMetadata(...)` plus current component instance values, and preserves the shared missing-node bridge error behavior for Angular `REQUEST_NODE_PROPS` and `HIGHLIGHT_NODE` requests.
