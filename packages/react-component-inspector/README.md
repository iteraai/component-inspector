# `@iteraai/react-component-inspector`

Browser bridge and iteration runtime for the Itera hosted component inspector.

## Installation

```bash
npm install @iteraai/react-component-inspector @iteraai/inspector-protocol react react-dom
```

## Usage

```ts
import { initDevEmbeddedInspectorBridge } from '@iteraai/react-component-inspector';
import { bootIterationInspectorRuntime } from '@iteraai/react-component-inspector/iterationInspector';

initDevEmbeddedInspectorBridge({
  enabled: true,
  hostOrigins: ['https://app.iteraapp.com'],
});

bootIterationInspectorRuntime();
```

Subpath exports:

- `@iteraai/react-component-inspector/embeddedBootstrap`
- `@iteraai/react-component-inspector/bridgeRuntime`
- `@iteraai/react-component-inspector/iterationInspector`
