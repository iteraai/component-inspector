import { bootstrapEmbeddedInspectorBridge } from '@iteraai/react-component-inspector';
import { bootIterationInspectorRuntime } from '@iteraai/react-component-inspector/iterationInspector';

const documentedHostOrigins = [
  'https://app.iteradev.ai',
  'https://preview.iteradev.ai',
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
