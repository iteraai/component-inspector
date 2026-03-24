# `@iteraai/vue-component-inspector`

Browser bridge and iteration runtime for customer Vue 3 apps embedded in the hosted Itera editor.

This package provides the Vue implementation of the component inspector SDK for browser-based embedded apps.

Detailed customer integration guidance lives at [iteraai.github.io/docs](https://iteraai.github.io/docs/). Use this README for install commands, public entrypoints, and the current Vue bootstrap contract.

## Documentation

- [Docs home](https://iteraai.github.io/docs/)
- [Getting Started](https://iteraai.github.io/docs/getting-started)
- [Inspector Overview](https://iteraai.github.io/docs/inspector/)
- [Troubleshooting](https://iteraai.github.io/docs/inspector/troubleshooting)

## Installation

```bash
npm install @iteraai/vue-component-inspector @iteraai/inspector-protocol vue
```

Peer dependency support:

- `vue`: `^3.4.0`

This package targets Vue 3 browser DOM runtimes. Vue 2, SSR-only entrypoints, and non-DOM renderers are out of scope for this package.

## Public Entry Points

| Import path                                           | Purpose                                                                                                     |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `@iteraai/vue-component-inspector`                    | Root exports for bootstrap helpers, bridge helpers, mounted-app registration, and Vue adapter/runtime config. |
| `@iteraai/vue-component-inspector/embeddedBootstrap`  | Embedded bootstrap helpers that can register Vue apps around `app.mount(...)`.                             |
| `@iteraai/vue-component-inspector/bridgeRuntime`      | Low-level bridge initialization and teardown.                                                               |
| `@iteraai/vue-component-inspector/iterationInspector` | Element-selection runtime and message types for iteration mode.                                             |

## Embedded Bridge Quick Start

Use the on-mount bootstrap helper when you want the standard embedded bridge behavior and explicit app registration:

```ts
import { createApp } from 'vue';
import {
  bootstrapEmbeddedInspectorBridgeOnMount,
} from '@iteraai/vue-component-inspector';
import { bootIterationInspectorRuntime } from '@iteraai/vue-component-inspector/iterationInspector';
import App from './App.vue';

const app = createApp(App);

const bridge = bootstrapEmbeddedInspectorBridgeOnMount(app, {
  enabled: true,
  hostOrigins: ['https://app.iteradev.ai', 'https://preview.iteradev.ai'],
});

bootIterationInspectorRuntime();
app.mount('#app');

window.addEventListener('beforeunload', () => {
  bridge.destroy();
});
```

Initialize the bridge during client startup, not from inside a mounted Vue component tree. For Vue, the preferred contract is explicit app registration through `bootstrapEmbeddedInspectorBridgeOnMount(...)` or `registerVueAppOnMount(...)` before or immediately around `app.mount(...)`. Mounted-app DOM discovery remains fallback behavior when explicit registration is not used.

## Package Surface Summary

- The standard embedded path uses the root export or `@iteraai/vue-component-inspector/embeddedBootstrap`.
- Use `@iteraai/vue-component-inspector/bridgeRuntime` when you need lower-level bridge lifecycle or adapter control.
- Use `@iteraai/vue-component-inspector/iterationInspector` for the separate element-selection runtime on `itera:iteration-inspector`.
- The exported adapter targets are `auto` and `vue3`.
- The current supported runtime scope is Vue 3 browser DOM apps embedded in the hosted editor flow.
