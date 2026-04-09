---
"@iteraai/angular-component-inspector": minor
---

Add deterministic Angular component tree snapshots through the existing inspector protocol using public `window.ng` dev-mode globals.

This adds DOM and open shadow-root discovery for Angular component hosts, maps ownership through `ng.getOwningComponent(...)`, and allocates stable node IDs from component instances so repeated reads preserve node identity and root ordering across nested apps and projected content.
