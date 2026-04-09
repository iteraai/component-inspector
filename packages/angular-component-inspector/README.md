# `@iteraai/angular-component-inspector`

Browser bridge, iteration runtime, and Angular CLI builder scaffold for Angular apps embedded in the hosted Itera editor.

This package provides the Angular implementation of the component inspector SDK for browser-based embedded apps. The current integration target is Angular development mode only.

Detailed customer integration guidance lives at [iteraai.github.io/docs](https://iteraai.github.io/docs/). Use this README for install commands, public entrypoints, and the current Angular bootstrap contract.

## Installation

```bash
npm install @iteraai/angular-component-inspector @iteraai/inspector-protocol @angular/core
```

Peer dependency support:

- `@angular/core`: `^18.0.0 || ^19.0.0 || ^20.0.0 || ^21.0.0`

This package targets Angular browser DOM apps running in development mode. Production-mode builds, SSR-only entrypoints, and non-DOM renderers are out of scope for this package.

## Public Entry Points

| Import path                                               | Purpose                                                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `@iteraai/angular-component-inspector`                    | Root exports for bootstrap helpers, bridge helpers, and Angular adapter/runtime config.       |
| `@iteraai/angular-component-inspector/embeddedBootstrap`  | Embedded bootstrap helpers for client-startup bridge initialization.                           |
| `@iteraai/angular-component-inspector/bridgeRuntime`      | Low-level bridge initialization and teardown.                                                 |
| `@iteraai/angular-component-inspector/iterationInspector` | Element-selection runtime and message types for iteration mode.                               |

## Embedded Bridge Quick Start

Initialize the inspector during client startup:

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { initDevEmbeddedInspectorBridge } from '@iteraai/angular-component-inspector';
import { bootIterationInspectorRuntime } from '@iteraai/angular-component-inspector/iterationInspector';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

const bridge = initDevEmbeddedInspectorBridge();

bootIterationInspectorRuntime();
bootstrapApplication(AppComponent, appConfig);

window.addEventListener('beforeunload', () => {
  bridge.destroy();
});
```

The Angular integration path is registration-free. Apps do not need to register Angular roots manually with the inspector runtime.

## Angular CLI Builder Scaffold

The supported Angular source-metadata path is builder-based. This PR only ships the builder scaffold and safe pass-through behavior, so builder configuration is accepted and delegated to the underlying Angular CLI builders unchanged.

Representative `angular.json` target wiring:

```json
{
  "projects": {
    "app": {
      "architect": {
        "build": {
          "builder": "@iteraai/angular-component-inspector:application"
        },
        "serve": {
          "builder": "@iteraai/angular-component-inspector:dev-server"
        }
      }
    }
  }
}
```

## Package Surface Summary

- The standard embedded path uses the root export or `@iteraai/angular-component-inspector/embeddedBootstrap`.
- Use `@iteraai/angular-component-inspector/bridgeRuntime` when you need lower-level bridge lifecycle or adapter control.
- Use `@iteraai/angular-component-inspector/iterationInspector` for the separate element-selection runtime on `itera:iteration-inspector`.
- The exported adapter targets are `auto`, `angular-dev-mode-globals`, and `noop`.
- The current supported runtime scope is Angular browser DOM apps embedded in the hosted editor flow while Angular dev-mode globals are available.
