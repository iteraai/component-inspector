---
"@iteraai/angular-component-inspector": minor
---

Add Angular component-path resolution for iteration selection through the shared inspector bridge using public `window.ng` dev-mode globals.

This maps arbitrary DOM selections back to stable Angular component ancestry with `ng.getComponent(...)` and `ng.getOwningComponent(...)`, supports projected-content and overlay ownership cases where DOM placement differs from component ownership, and populates both `componentPath` and compatibility `reactComponentPath` in Angular iteration-selection payloads.
