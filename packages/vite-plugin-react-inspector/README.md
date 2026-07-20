# `@iteraai/vite-plugin-react-inspector`

Vite plugin for injecting the Itera React component inspector runtime into React-Vite apps.

This package is the React-Vite integration surface for the Itera inspector. It reuses `@iteraai/react-component-inspector` and `@iteraai/inspector-protocol`; it does not replace the existing bridge or iteration runtime.

## Installation

```bash
npm install @iteraai/vite-plugin-react-inspector @vitejs/plugin-react
```

Your app should already provide React and React DOM:

- `react`: `^18.3.0 || ^19.0.0`
- `react-dom`: `^18.3.0 || ^19.0.0`
- `vite`: `>=5.0.0` (validated with Vite 5, 6, 7, and 8)

## Manual React-Vite Usage

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { createIteraReactInspectorVitePlugin } from '@iteraai/vite-plugin-react-inspector';

export default defineConfig({
  plugins: [createIteraReactInspectorVitePlugin(), react()],
});
```

Enable it for local testing with Vite environment variables:

```bash
VITE_ITERA_COMPONENT_INSPECTOR_ENABLED=true \
VITE_ITERA_COMPONENT_INSPECTOR_HOST_ORIGINS=https://app.iteradev.ai \
npm run dev
```

You can also configure it directly:

```ts
createIteraReactInspectorVitePlugin({
  enabled: true,
  hostOrigins: ['https://app.iteradev.ai'],
});
```

By default, the plugin only injects the runtime for Vite serve/dev mode. For an explicit local preview build, opt in to build HTML injection:

```ts
createIteraReactInspectorVitePlugin({
  enabled: true,
  hostOrigins: ['https://app.iteradev.ai'],
  includeInBuild: true,
});
```

Do not enable `includeInBuild` for normal production builds unless the build output is specifically intended to carry the inspector runtime.

## API

```ts
createIteraReactInspectorVitePlugin(options?: {
  enabled?: boolean;
  hostOrigins?: readonly string[] | string;
  includeInBuild?: boolean;
})
```

The package also exports `iteraReactInspector` as a shorter alias for the same factory.

The plugin-generated virtual module imports `@iteraai/vite-plugin-react-inspector/client` as a small browser runtime support entry. Application code should normally use the plugin factory instead of importing the client entry directly.

When `enabled` is omitted, the plugin enables only when `VITE_ITERA_COMPONENT_INSPECTOR_ENABLED` is exactly `true`. Host origins can come from `hostOrigins` or the comma-separated `VITE_ITERA_COMPONENT_INSPECTOR_HOST_ORIGINS` value.

If the inspector is enabled but no trusted host origins are available, the plugin warns and does not inject or start the bridge.
