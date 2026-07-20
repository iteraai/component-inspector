# `@iteraai/react-component-inspector`

Browser bridge and iteration runtime for customer React apps embedded in the hosted Itera editor.

This package provides the React implementation of the component inspector SDK for browser-based embedded apps.

Detailed customer integration guidance lives at [iteraai.github.io/docs](https://iteraai.github.io/docs/). Use this README for install commands, public entrypoints, and a minimal embedded bootstrap example.

## Documentation

- [Docs home](https://iteraai.github.io/docs/)
- [Getting Started](https://iteraai.github.io/docs/getting-started)
- [Inspector Overview](https://iteraai.github.io/docs/inspector/)
- [React Integration](https://iteraai.github.io/docs/inspector/react)
- [Next.js](https://iteraai.github.io/docs/inspector/nextjs)
- [Vite-Style Apps](https://iteraai.github.io/docs/inspector/vite)
- [Troubleshooting](https://iteraai.github.io/docs/inspector/troubleshooting)

## Installation

```bash
npm install @iteraai/react-component-inspector @iteraai/inspector-protocol react react-dom
```

Peer dependency support:

- `react`: `^18.3.0 || ^19.0.0`
- `react-dom`: `^18.3.0 || ^19.0.0`

This package targets browser DOM runtimes. It is meant to run inside the customer app iframe or preview surface that the hosted editor embeds.

## Public Entry Points

| Import path                                             | Purpose                                                                                                              |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `@iteraai/react-component-inspector`                    | Root exports for bootstrap helpers, bridge helpers, adapter/runtime config, telemetry helpers, and token validation. |
| `@iteraai/react-component-inspector/embeddedBootstrap`  | Embedded bootstrap helpers.                                                                                          |
| `@iteraai/react-component-inspector/bridgeRuntime`      | Low-level bridge initialization and teardown.                                                                        |
| `@iteraai/react-component-inspector/iterationInspector` | Element-selection runtime and message types for iteration mode.                                                      |
| `@iteraai/react-component-inspector/storybook`          | Storybook manager relay plus preview-origin/bootstrap helpers for manager-URL debugging.                             |

## Embedded Bridge Quick Start

Use the bootstrap helper when you want the standard embedded bridge behavior:

```ts
import { bootstrapEmbeddedInspectorBridge } from "@iteraai/react-component-inspector";
import { bootIterationInspectorRuntime } from "@iteraai/react-component-inspector/iterationInspector";

const hostOrigins = ["https://app.iteradev.ai", "https://preview.iteradev.ai"];

const bridge = bootstrapEmbeddedInspectorBridge({
  enabled: true,
  hostOrigins,
});

bootIterationInspectorRuntime();

window.addEventListener("beforeunload", () => {
  bridge.destroy();
});
```

Initialize the bridge and iteration runtime during client startup, not from inside the mounted React tree. Keep the bootstrap as early as possible so the default `fiber` path can install the inline backend hook before React hydration or `ReactDOM.createRoot(...)` makes the app interactive. Configure trusted host origins once on the bridge bootstrap; the iteration runtime consumes that resolved configuration when it boots. Without trusted bridge origins, `element_capture_v1` is not advertised.

## Package Surface Summary

- The standard embedded path uses the root export or `@iteraai/react-component-inspector/embeddedBootstrap`.
- Use `@iteraai/react-component-inspector/bridgeRuntime` when you need lower-level bridge lifecycle, security, or adapter control.
- Use `@iteraai/react-component-inspector/iterationInspector` for the separate element-selection runtime on `itera:iteration-inspector`.
- Use `@iteraai/react-component-inspector/storybook` when a Storybook manager window needs to relay inspector traffic into the active preview iframe while the preview explicitly trusts the manager origin.
- The exported adapter targets are `auto`, `vite`, `next`, `cra`, and `fiber`. The standard embedded bootstrap path prefers `fiber`.

## Iteration Element Capture

The iteration inspector runtime advertises `element_capture_v1` in its `runtime_ready` message only when configured with trusted `hostOrigins`. A trusted parent can request a selected element image without reading the iframe DOM by posting a `capture_element_crop` message on `itera:iteration-inspector` with a `requestId`, an `IterationElementLocator`, optional `padding`, `maxWidth`, `maxHeight`, and `maxBytes`. The runtime re-resolves the locator inside the iframe, validates `locator.urlPath` against the current path, captures a PNG `Blob`, and replies with `element_crop_captured` for the same `requestId`.

Canvas and image targets use native canvas export when possible. Other `HTMLElement` targets use `html-to-image` as a small DOM rasterization dependency, including padded captures. CSS fidelity depends on browser support for SVG `foreignObject`, web fonts, pseudo-elements, filters, media state, and resource loading. Cross-origin images or canvases can taint the export path and return `canvas_tainted` or `dom_rasterization_failed`. Oversized blobs return `oversize` when they exceed `maxBytes` or the default runtime limit.

## Storybook Manager Relay

Use the dedicated Storybook entrypoint when the debugger loads a Storybook manager URL instead of a direct `iframe.html` story URL:

```ts
import { bootIterationInspectorRuntime } from "@iteraai/react-component-inspector/iterationInspector";
import {
  bootstrapStorybookPreviewInspectorBridge,
  initStorybookManagerRelay,
} from "@iteraai/react-component-inspector/storybook";

initStorybookManagerRelay({
  hostOrigins: ["https://app.iteradev.ai"],
});

const bridge = bootstrapStorybookPreviewInspectorBridge({
  enabled: true,
  hostOrigins: ["https://app.iteradev.ai"],
});

bootIterationInspectorRuntime();

window.addEventListener("beforeunload", () => {
  bridge.destroy();
});
```

`initStorybookManagerRelay(...)` assumes the Storybook 10 manager preview iframe selector `iframe#storybook-preview-iframe` by default. The preview bootstrap keeps direct `iframe.html` debugging working by combining explicit `hostOrigins` with the manager origin derived from the preview referrer, or an explicit `managerOrigin` when you need to override it.
For detailed startup timing, exact `hostOrigins` behavior, Next.js `instrumentation-client.ts`, Vite and CRA entrypoints, secure session-token validation, telemetry, and troubleshooting, use the docs pages linked above.
