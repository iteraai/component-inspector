import { bootstrapEmbeddedInspectorBridge } from '@iteraai/react-component-inspector';
import {
  reactInspectorViteAdapterTarget,
  type ReactInspectorRuntimeConfig,
} from '@iteraai/react-component-inspector';
import { bootIterationInspectorRuntime } from '@iteraai/react-component-inspector/iterationInspector';
import { createRoot } from 'react-dom/client';

export const documentedViteRuntimeFallback: ReactInspectorRuntimeConfig = {
  adapter: reactInspectorViteAdapterTarget,
};

const documentedHostOrigins = [
  'https://app.iteraapp.com',
  'https://preview.iteraapp.com',
] as const;

export const mountViteInspectorEntrypoint = (rootElement: Element) => {
  const bridge = bootstrapEmbeddedInspectorBridge({
    enabled: true,
    hostOrigins: documentedHostOrigins,
  });

  bootIterationInspectorRuntime();

  const root = createRoot(rootElement);

  root.render(null);

  return () => {
    root.unmount();
    bridge.destroy();
  };
};
