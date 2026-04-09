---
"@iteraai/angular-component-inspector": minor
---

Add the Angular SDK's supported dev-only source metadata path and freeze the package as a publishable public contract.

This adds Angular CLI builder-based source metadata injection, normalizes Angular tree node `source.file` and `source.line` with additive `column`, finalizes the builder/package metadata and README guidance, and includes the Angular package in tarball validation for the release flow.
