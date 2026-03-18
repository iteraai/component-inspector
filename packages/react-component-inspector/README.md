# `@iteraai/react-component-inspector`

Browser bridge and iteration runtime for customer React apps embedded in the hosted Itera editor.

This package provides the React implementation of the component inspector SDK for browser-based embedded apps.

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

## Embedded Bridge Quick Start

Use the bootstrap helper when you want the standard embedded bridge behavior:

```ts
import { bootstrapEmbeddedInspectorBridge } from "@iteraai/react-component-inspector";
import { bootIterationInspectorRuntime } from "@iteraai/react-component-inspector/iterationInspector";

const bridge = bootstrapEmbeddedInspectorBridge({
  enabled: true,
  hostOrigins: ["https://app.iteraapp.com", "https://preview.iteraapp.com"],
});

bootIterationInspectorRuntime();

window.addEventListener("beforeunload", () => {
  bridge.destroy();
});
```

What `bootstrapEmbeddedInspectorBridge` does by default:

- Initializes the bridge in `development` mode
- Enables the `tree`, `props`, and `highlight` capabilities
- Uses `runtimeConfig: { adapter: 'fiber' }`
- Installs the React DevTools inline backend hook unless you opt out
- Starts optional embedded runtime telemetry when configured

For local development defaults, `initDevEmbeddedInspectorBridge()` is a thinner shortcut that defaults to:

- `enabled: true`
- `killSwitchActive: false`
- `hostOrigins: ['https://app.iteraapp.com']`
- `runtimeConfig: { adapter: 'fiber' }`

## When To Use The Low-Level Bridge API

Use `initInspectorBridge` when you need lower-level control over runtime configuration, security, or adapter wiring.

```ts
import { initInspectorBridge } from "@iteraai/react-component-inspector/bridgeRuntime";

const bridge = initInspectorBridge({
  enabled: true,
  hostOrigins: ["https://app.iteraapp.com"],
  mode: "development",
  runtimeConfig: {
    adapter: "fiber",
  },
  security: {
    enabled: true,
  },
});

window.addEventListener("beforeunload", () => {
  bridge.destroy();
});
```

Use the low-level API if you need any of the following:

- Secure `HELLO` handshakes with session-token validation
- A custom `treeAdapter`
- A custom `adapterFactory`
- Direct control over bridge handlers or telemetry hooks

If you call `initInspectorBridge` without `treeAdapter`, `adapterFactory`, or `runtimeConfig`, the bridge can still handshake, but tree/props/snapshot requests do not have an adapter behind them.

## Origin And Session-Token Requirements

Embedded bridge requirements:

- `hostOrigins` must contain at least one trusted hosted-editor origin or the bridge stays disabled.
- Messages from untrusted origins are ignored before protocol parsing.
- `bootstrapEmbeddedInspectorBridge` accepts `hostOrigins` as either an array or a comma-separated string and trims empty entries.
- `mode: 'production'`, `enabled: false`, or `killSwitchActive: true` disables the bridge.

Secure session-token behavior:

- Bridge security is only available through `initInspectorBridge`, not the higher-level bootstrap helper.
- When `security.enabled` is `true`, the host `HELLO` payload must include `auth.sessionToken`.
- The default validator rejects missing tokens, blank tokens, and expired `auth.metadata.expiresAt` values.
- Provide `security.tokenValidator` if you need stronger token validation than the built-in non-empty/not-expired checks.

## Supported React Runtime Targets

The exported runtime adapter targets are:

- `auto`
- `vite`
- `next`
- `cra`
- `fiber`

Current guidance:

- The customer-facing bootstrap helpers use `fiber` today.
- Prefer `fiber` for the standard embedded bootstrap path unless you are intentionally wiring a custom adapter path.
- `vite`, `next`, and `cra` remain exported adapter targets for direct runtime configuration and future expansion.

## Current Runtime Behavior

The current implementation is intentionally documented as-is rather than generalized.

- Trusted `HELLO` messages receive `READY`; `PING` receives `PONG`.
- `REQUEST_TREE` returns a capped tree snapshot. Tree responses can include truncation metadata when the node count exceeds the current limit.
- `REQUEST_NODE_PROPS` serializes props into JSON-safe values and uses `__iteraType` placeholders for unsupported values.
- Sensitive prop keys matching names such as `token`, `password`, `secret`, or `authorization` are redacted.
- `REQUEST_SNAPSHOT` currently returns a placeholder SVG capture plus the DOM HTML snapshot when it fits the response size budget.
- If the HTML portion would make the snapshot too large, the bridge omits the HTML and sets `htmlTruncated: true`.
- After the host handshake, the bridge posts `PATH_UPDATED` messages on `itera-preview-path` for the initial location and subsequent history/hash navigation.

## Iteration Inspector Runtime

The iteration runtime uses the separate `itera:iteration-inspector` channel.

```ts
import { bootIterationInspectorRuntime } from "@iteraai/react-component-inspector/iterationInspector";

bootIterationInspectorRuntime();
```

Current runtime behavior:

- `bootIterationInspectorRuntime()` returns `null` when the page is not embedded in an iframe unless `allowSelfMessaging: true` is passed.
- The runtime emits `runtime_ready`, `mode_changed`, `element_selected`, `selection_invalidated`, and optional `debug_log` messages.
- It listens for `enter_select_mode`, `exit_select_mode`, and `clear_hover` parent messages.
- The first accepted parent origin is pinned for the lifetime of the started runtime; messages from a different origin are ignored until the runtime stops.
- `enter_select_mode` supports `single` and `persistent` selection modes.
- Selected elements can be invalidated on reloads, route changes, or DOM node detachment.

## Runtime Telemetry

If you opt in through `runtimeTelemetry`, the embedded runtime can post telemetry messages on `ara:embedded-runtime-telemetry` for:

- `console.error`
- `window.onerror`
- `unhandledrejection`

Those messages are forwarded separately from the main inspector protocol and are intended for host/editor-side debugging and observability.
Telemetry is only posted cross-window when a concrete `targetOrigin` can be resolved from `runtimeTelemetry.targetOrigin` or `document.referrer`; otherwise capture stays local and no parent `postMessage` is sent.
