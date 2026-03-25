import { buildMessage } from '@iteraai/inspector-protocol';
import {
  ITERATION_INSPECTOR_CHANNEL,
  isIterationInspectorRuntimeMessage,
  type IterationInspectorRuntimeMessage,
  type IterationPreviewTargetEdit,
} from '@iteraai/react-component-inspector/iterationInspector';

export const exampleHostOrigin = 'http://127.0.0.1:4173';
export const exampleEmbeddedOrigin = 'http://127.0.0.1:4174';
export const exampleSessionId = 'component-inspector-example-session';
export const exampleIterationInspectorChannel = ITERATION_INSPECTOR_CHANNEL;
export const publishButtonDisplayName = 'PublishButton';

const defaultEmbeddedHostOrigins = encodeURIComponent(
  `${exampleHostOrigin},http://localhost:4173`,
);

export const defaultReactEmbeddedUrl = `${exampleEmbeddedOrigin}/embedded.html?hostOrigins=${defaultEmbeddedHostOrigins}`;
export const defaultVueEmbeddedUrl = `${exampleEmbeddedOrigin}/embedded-vue.html?hostOrigins=${defaultEmbeddedHostOrigins}`;
export const defaultEmbeddedUrl = defaultReactEmbeddedUrl;

type PreviewPathUpdatedMessage = {
  channel: 'itera-preview-path';
  type: 'PATH_UPDATED';
  path: string;
};

export const buildHelloMessage = (requestId: string) =>
  buildMessage(
    'HELLO',
    {
      capabilities: ['tree', 'props', 'highlight'],
    },
    {
      requestId,
      sessionId: exampleSessionId,
    },
  );

export const buildTreeRequestMessage = (requestId: string) =>
  buildMessage(
    'REQUEST_TREE',
    {
      includeSource: false,
    },
    {
      requestId,
      sessionId: exampleSessionId,
    },
  );

export const buildNodePropsRequestMessage = (
  nodeId: string,
  requestId: string,
) =>
  buildMessage(
    'REQUEST_NODE_PROPS',
    {
      nodeId,
    },
    {
      requestId,
      sessionId: exampleSessionId,
    },
  );

export const buildEnterSelectModeMessage = () => {
  return {
    channel: exampleIterationInspectorChannel,
    kind: 'enter_select_mode',
  } as const;
};

export const buildClearHoverMessage = () => {
  return {
    channel: exampleIterationInspectorChannel,
    kind: 'clear_hover',
  } as const;
};

export const buildSyncPreviewEditsMessage = (
  revision: number,
  targets: ReadonlyArray<IterationPreviewTargetEdit>,
) => {
  return {
    channel: ITERATION_INSPECTOR_CHANNEL,
    kind: 'sync_preview_edits',
    revision,
    targets,
  } as const;
};

export const buildClearPreviewEditsMessage = (revision: number) => {
  return {
    channel: ITERATION_INSPECTOR_CHANNEL,
    kind: 'clear_preview_edits',
    revision,
  } as const;
};

export const isPreviewPathUpdatedMessage = (
  value: unknown,
): value is PreviewPathUpdatedMessage => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'channel' in value &&
    'type' in value &&
    'path' in value &&
    value.channel === 'itera-preview-path' &&
    value.type === 'PATH_UPDATED' &&
    typeof value.path === 'string'
  );
};

export const isExampleIterationRuntimeMessage = (
  value: unknown,
): value is IterationInspectorRuntimeMessage =>
  isIterationInspectorRuntimeMessage(value);

export const isPreviewEditsStatusMessage = (
  value: unknown,
): value is Extract<
  IterationInspectorRuntimeMessage,
  { kind: 'preview_edits_status' }
> => {
  return (
    isIterationInspectorRuntimeMessage(value) &&
    value.kind === 'preview_edits_status'
  );
};

export const prettyJson = (value: unknown) => {
  return JSON.stringify(value, null, 2);
};
