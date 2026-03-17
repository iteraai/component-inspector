# Contributing

Use the Node version from `.nvmrc` and install dependencies with `npm install`.

Package-affecting pull requests must include a changeset. Add one with:

```bash
npm run changeset:add
```

Use these guidelines when choosing the release type:

- `patch`: backwards-compatible bug fixes, hardening, or packaging fixes
- `minor`: backwards-compatible SDK additions
- `major`: breaking API, export, or runtime contract changes

Changesets are not required for docs-only, examples-only, workflow-only, or package test-only changes.

Before opening a change, run:

```bash
npm run changeset:check
npm run build
npm run lint:ci
npm run type-check
npm run test
npm run test:pack
```

Keep changes scoped to the public SDK packages under `packages/`. This repository is intended to stay ready for future platform packages without changing the top-level layout.

## Release Workflow

Normal feature PRs declare semver intent with a changeset. After a package-affecting PR merges to `main`, the
release workflow updates or opens the automated release PR. Merging that release PR publishes the changed
`@iteraai/*` packages.

Steady-state publishing uses npm trusted publishing from GitHub Actions with provenance enabled. Because npm
trusted publishers are attached per package and the initial packages are not published yet, the first release
may need a one-time bootstrap step by an npm owner before trusted publishing can be enforced for future
releases.
