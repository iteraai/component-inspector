import { bootIterationInspectorRuntime } from '@iteraai/react-component-inspector/iterationInspector';
import {
  bootstrapStorybookPreviewInspectorBridge,
  initStorybookManagerRelay,
} from '@iteraai/react-component-inspector/storybook';

const documentedHostOrigins = ['https://app.iteradev.ai'] as const;

export const bootstrapStorybookInspectorExample = () => {
  initStorybookManagerRelay({
    hostOrigins: documentedHostOrigins,
  });

  const bridge = bootstrapStorybookPreviewInspectorBridge({
    enabled: true,
    hostOrigins: documentedHostOrigins,
  });

  bootIterationInspectorRuntime();

  return bridge;
};
