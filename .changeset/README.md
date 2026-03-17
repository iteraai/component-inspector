# Changesets

This repository uses Changesets to capture semver intent for the published `@iteraai/*` packages.

When a pull request changes shipped package code, exports, package metadata, or build configuration under
`packages/`, add a changeset before opening or merging the PR:

```bash
npm run changeset:add
```

Choose the release type that matches the customer impact:

- `patch` for bug fixes, packaging fixes, or behavior changes that preserve the public contract
- `minor` for backwards-compatible additions to the supported SDK surface
- `major` for breaking changes to package APIs, exports, or preserved runtime/protocol contract

Changesets are not required for docs-only, examples-only, workflow-only, or package test-only changes.

Merging a normal PR with a changeset into `main` updates or creates the automated release PR. Merging the
release PR publishes the changed packages through GitHub Actions.
