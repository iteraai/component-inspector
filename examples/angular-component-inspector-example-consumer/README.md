# Angular Component Inspector Example Consumer

This workspace is the Angular customer-style fixture for the public SDK packages
in this repo. It imports `@iteraai/inspector-protocol` and
`@iteraai/angular-component-inspector` by their published names, bootstraps a
real Angular app, and wires `angular.json` to the package-provided builders.

Customer-facing integration guidance lives at
[iteraai.github.io/docs](https://iteraai.github.io/docs/). This README stays
focused on how to run and verify the fixture locally.

## What It Covers

- Embedded bridge bootstrap against public package imports
- Angular CLI `application` and `dev-server` targets through
  `@iteraai/angular-component-inspector`
- Host/editor handshake over `itera-component-inspector`
- Preview-path updates on `itera-preview-path`
- Angular tree, source metadata, node props, highlight, and snapshot requests
- Iteration selection flow over `itera:iteration-inspector`

The Vitest smoke files assert that the resolved package entrypoints come from
`dist/`, not `src/`, and that the CLI builder injects `__iteraSource` metadata
into the emitted Angular development bundle.

## Local Launch

Build the SDK packages first from the repo root:

```bash
npm run build
```

Then start the Angular example workspace:

```bash
npm run dev --workspace angular-component-inspector-example-consumer
```

Open:

- Angular embedded app: `http://127.0.0.1:4175/`

To point the app at the existing host harness, include host origins in the URL:

```text
http://127.0.0.1:4175/?hostOrigins=http%3A%2F%2F127.0.0.1%3A4173%2Chttp%3A%2F%2Flocalhost%3A4173
```

## Verification

Run the Angular example checks directly when you want to focus on this fixture:

```bash
npm run lint:ci --workspace angular-component-inspector-example-consumer
npm run type-check --workspace angular-component-inspector-example-consumer
npm run test --workspace angular-component-inspector-example-consumer
npm run test:angular --workspace angular-component-inspector-example-consumer
npm run build --workspace angular-component-inspector-example-consumer
```
