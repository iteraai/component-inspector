# Component Inspector Example Consumer

This workspace is the customer-style fixture for the public SDK packages in this
repo. It imports `@iteraai/inspector-protocol` and
`@iteraai/react-component-inspector` and
`@iteraai/vue-component-inspector` by their published names and expects those
imports to resolve to built `dist/` entrypoints from the workspace packages.

Customer-facing integration guidance lives at [iteraai.github.io/docs](https://iteraai.github.io/docs/), especially the [Inspector Overview](https://iteraai.github.io/docs/inspector/), [React Integration](https://iteraai.github.io/docs/inspector/react), and [Troubleshooting](https://iteraai.github.io/docs/inspector/troubleshooting) pages. This README stays focused on how to run and verify the fixture locally.

## What It Covers

- Embedded bridge bootstrap against public package imports
- Host/editor handshake over `itera-component-inspector`
- Preview-path updates on `itera-preview-path`
- React tree and node-props requests against a deterministic embedded adapter
- Vue tree, node props, highlight, and snapshot requests against the built Vue package
- Iteration selection flow over `itera:iteration-inspector`

The Vitest smoke files assert that the resolved package entrypoints come from
`dist/`, not `src/`.

## Local Launch

Build the SDK packages first from the repo root:

```bash
npm run build
```

Then run the two example surfaces in separate terminals:

```bash
npm run dev:host --workspace component-inspector-example-consumer
npm run dev:embedded:react --workspace component-inspector-example-consumer
```

Open:

- host: `http://127.0.0.1:4173/host.html`
- React embedded: `http://127.0.0.1:4174/embedded.html`

To inspect the Vue fixture instead of the React one:

```bash
npm run dev:embedded:vue --workspace component-inspector-example-consumer
```

Open:

- Vue embedded: `http://127.0.0.1:4174/embedded-vue.html`

The host page defaults its iframe to:

```text
http://127.0.0.1:4174/embedded.html?hostOrigins=http%3A%2F%2F127.0.0.1%3A4173%2Chttp%3A%2F%2Flocalhost%3A4173
```

## Verification

Run the example package checks directly when you want to focus on this fixture:

```bash
npm run lint:ci --workspace component-inspector-example-consumer
npm run type-check --workspace component-inspector-example-consumer
npm run test --workspace component-inspector-example-consumer
npm run test:react --workspace component-inspector-example-consumer
npm run test:vue --workspace component-inspector-example-consumer
```
