import { bootstrapEmbeddedInspectorBridge } from '@iteraai/react-component-inspector';
import { bootIterationInspectorRuntime } from '@iteraai/react-component-inspector/iterationInspector';

const documentedHostOrigins = [
  'https://app.iteraapp.com',
  'https://preview.iteraapp.com',
] as const;

export const bootstrapGenericReactInspector = () => {
  const bridge = bootstrapEmbeddedInspectorBridge({
    enabled: true,
    hostOrigins: documentedHostOrigins,
  });
  const runtime = bootIterationInspectorRuntime();

  return () => {
    runtime?.stop();
    bridge.destroy();
  };
};
