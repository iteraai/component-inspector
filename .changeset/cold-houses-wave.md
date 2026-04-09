---
"@iteraai/angular-component-inspector": patch
---

Fix the Angular package's builder integration and validate it with a real Angular example consumer.

This adds an official Angular example workspace and smoke coverage for handshake, tree, source metadata, node props, highlight, snapshot, and selection flows, while also fixing Angular CLI builder resolution by exporting `./package.json` and tightening the source metadata plugin's TypeScript loading and filter handling.
