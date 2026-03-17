# component-inspector

Public monorepo for the Itera component inspector SDK packages. The current public implementation is the React client SDK packaged as `@iteraai/react-component-inspector`, alongside the shared protocol package `@iteraai/inspector-protocol`.

The package names and import paths in this repo are the intended public contract. Releases are managed with
Changesets and an automated GitHub Actions release PR flow so package changes land with explicit semver intent.

## Packages

| Package                              | Path                                                                         | Role                                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `@iteraai/inspector-protocol`        | [`packages/inspector-protocol`](./packages/inspector-protocol)               | Shared protocol constants, message builders, validators, origin helpers, and inspector security event constants.  |
| `@iteraai/react-component-inspector` | [`packages/react-component-inspector`](./packages/react-component-inspector) | Embedded React bridge, iteration inspector runtime, runtime telemetry helpers, and adapter/runtime configuration. |

The repo is intentionally a monorepo so future packages such as `@iteraai/vue-component-inspector` can live beside the current React package without changing the release layout.

## Release Workflow

This repo uses a merge-driven release flow for the published `@iteraai/*` packages.

1. Package-affecting PRs add a changeset with `npm run changeset:add`.
2. Merging those PRs into `main` updates or opens an automated release PR with version and changelog changes.
3. Merging the release PR publishes the changed packages from GitHub Actions with npm provenance enabled.

Changesets are expected for shipped package code, exports, package metadata, and build configuration changes
under `packages/`. They are not required for docs-only, examples-only, workflow-only, or package test-only
changes.

### First Publish Bootstrap

The steady-state release path uses npm trusted publishing from GitHub Actions and does not depend on a
long-lived publish token. There is one initial bootstrap caveat for this repository: npm trusted publishers are
configured per existing package, and these package names do not exist on npm yet.

For the first publish only, maintainers should either:

- provide a short-lived `NPM_TOKEN` repository secret so the release workflow can create the package pages, then remove the secret immediately after the first release
- or publish the first release manually from the release PR commit and configure trusted publishers before the next release

After the package pages exist, configure npm trusted publishers for `@iteraai/inspector-protocol` and
`@iteraai/react-component-inspector` to point at `iteraai/component-inspector` and
`.github/workflows/release.yml`, then remove any bootstrap token path. Future releases should rely on trusted
publishing only.

## Example Consumer

The repo also carries a focused customer-style fixture workspace:

| Workspace                              | Path                                                                                               | Role                                                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `component-inspector-example-consumer` | [`examples/component-inspector-example-consumer`](./examples/component-inspector-example-consumer) | Host/embed harness that imports the public package names and smoke-tests handshake, tree, props, and iteration selection. |

This example workspace exists to prove customer-style consumption against the built package entrypoints. Its Vitest smoke coverage asserts that imports resolve to `dist/`, not `src/`.

## Hosted Editor Architecture

Customer apps integrate with the hosted Itera editor through browser `postMessage` channels. This repo contains the SDK used by the embedded app side of that flow; it does not publish the first-party editor application itself.

```mermaid
flowchart LR
  Host["Hosted Itera editor"] -->|"HELLO / REQUEST_* on \"itera-component-inspector\""| Embedded["Customer app iframe"]
  Embedded -->|"READY / TREE_SNAPSHOT / NODE_PROPS / SNAPSHOT"| Host
  Embedded -->|"PATH_UPDATED on \"itera-preview-path\""| Host
  Host -->|"enter_select_mode / exit_select_mode on \"itera:iteration-inspector\""| Iteration["Iteration inspector runtime"]
  Iteration -->|"runtime_ready / mode_changed / element_selected / selection_invalidated"| Host
```

At a high level:

- The embedded React app boots the inspector bridge and allowlists the hosted editor origins that may talk to it.
- The host sends protocol messages on `itera-component-inspector`; the embedded bridge responds with `READY`, tree data, props, snapshots, highlights, and errors.
- After the initial handshake, the embedded bridge also posts preview-path updates on `itera-preview-path` when the iframe navigates.
- The optional `iterationInspector` runtime handles element-picking UX over the separate `itera:iteration-inspector` channel.

## Supported Runtimes

The current supported customer runtime is a browser-based React app embedded in the hosted editor flow.

- `@iteraai/react-component-inspector` is the current public implementation. This rollout does not genericize the SDK beyond that.
- React peer dependency support is `^18.3.0 || ^19.0.0`.
- Exported adapter targets are `auto`, `vite`, `next`, `cra`, and `fiber`.
- The documented embedded bootstrap helpers currently initialize the bridge with `runtimeConfig: { adapter: 'fiber' }`.
- Future platform packages should be added under `packages/` instead of split into separate repositories.

## Preserved Contract Identifiers

These branded identifiers are documented intentionally and should be treated as part of the supported SDK contract for this rollout:

- Inspector channel: `itera-component-inspector`
- Iteration runtime channel: `itera:iteration-inspector`
- Preview-path channel: `itera-preview-path`
- Serializable placeholder discriminator: `__iteraType`

Those strings are not accidental internal details. They are the preserved contract carried forward from the existing `Web` implementation.

## Monorepo Layout

```text
examples/
  component-inspector-example-consumer/
packages/
  inspector-protocol/
  react-component-inspector/
scripts/
  validate-inspector-sdk-packages.mjs
```

Package-specific integration details live in:

- [`packages/inspector-protocol/README.md`](./packages/inspector-protocol/README.md)
- [`packages/react-component-inspector/README.md`](./packages/react-component-inspector/README.md)

## Migration From `Web`

Internal `Web` consumers should migrate from workspace source imports to the built package entrypoints below.

| Old workspace import                                     | Published package import                                |
| -------------------------------------------------------- | ------------------------------------------------------- |
| `Web/libs/inspector-protocol/src`                        | `@iteraai/inspector-protocol`                           |
| `Web/libs/inspector-protocol/src/types`                  | `@iteraai/inspector-protocol/types`                     |
| `Web/libs/inspector-protocol/src/errors`                 | `@iteraai/inspector-protocol/errors`                    |
| `Web/libs/inspector-protocol/src/validators`             | `@iteraai/inspector-protocol/validators`                |
| `Web/libs/inspector-protocol/src/origins`                | `@iteraai/inspector-protocol/origins`                   |
| `Web/libs/react-inspector-bridge/src`                    | `@iteraai/react-component-inspector`                    |
| `Web/libs/react-inspector-bridge/src/embeddedBootstrap`  | `@iteraai/react-component-inspector/embeddedBootstrap`  |
| `Web/libs/react-inspector-bridge/src/bridgeRuntime`      | `@iteraai/react-component-inspector/bridgeRuntime`      |
| `Web/libs/react-inspector-bridge/src/iterationInspector` | `@iteraai/react-component-inspector/iterationInspector` |

Migration notes:

- Stop importing raw `src/*.ts` files from workspace packages. The supported consumer contract is the built package entrypoints above.
- Keep the preserved channel/runtime identifiers exactly as they are today. Do not rename `itera-component-inspector`, `itera:iteration-inspector`, `itera-preview-path`, or `__iteraType` during the cutover.
- The current `Web/libs/react-inspector-bridge` implementation maps directly to `@iteraai/react-component-inspector`.

## Local Development

Use the Node version in `.nvmrc` and install dependencies from the repo root:

```bash
nvm use
npm install
```

Run the full repo checks:

```bash
npm run build
npm run lint:ci
npm run type-check
npm run test
npm run test:pack
```

Useful package-scoped commands:

```bash
npm run test --workspace @iteraai/inspector-protocol
npm run test --workspace @iteraai/react-component-inspector
npm run lint:ci --workspace @iteraai/react-component-inspector
npm run test:examples
```

`npm run test:pack` validates the built package shape in a clean smoke fixture so the documented import paths stay aligned with the tarballs customers will eventually install.

To inspect the example host/embed flow manually after building the SDK packages:

```bash
npm run example:host
npm run example:embedded
```
