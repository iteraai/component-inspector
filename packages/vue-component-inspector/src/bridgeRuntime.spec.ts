import { buildMessage } from '@iteraai/inspector-protocol';
import { createApp, defineComponent, h } from 'vue';
import {
  ITERATION_INSPECTOR_CHANNEL,
  bootstrapEmbeddedInspectorBridgeOnMount,
  destroyInspectorBridge,
} from './index';
import {
  bootIterationInspectorRuntime,
  buildIterationElementSelection,
  type IterationInspectorRuntimeMessage,
} from './iterationInspector';

type SourceDouble = {
  postMessage: ReturnType<typeof vi.fn>;
};

const windowWithIterationRuntime = window as Window & {
  __ITERA_ITERATION_INSPECTOR_RUNTIME__?: {
    stop: () => void;
  };
};

const createSourceDouble = (): SourceDouble => {
  return {
    postMessage: vi.fn(),
  };
};

const getPostedIterationMessages = (
  postMessageSpy: ReturnType<typeof vi.spyOn>,
): IterationInspectorRuntimeMessage[] => {
  return postMessageSpy.mock.calls.flatMap(([message]) => {
    return typeof message === 'object' && message !== null
      ? [message as IterationInspectorRuntimeMessage]
      : [];
  });
};

afterEach(() => {
  windowWithIterationRuntime.__ITERA_ITERATION_INSPECTOR_RUNTIME__?.stop();
  delete windowWithIterationRuntime.__ITERA_ITERATION_INSPECTOR_RUNTIME__;
  destroyInspectorBridge();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

test('boots the bridge before mount and exposes iteration selections for a mounted Vue app', () => {
  const ToolbarButton = defineComponent({
    name: 'ToolbarButton',
    setup: () =>
      () =>
        h(
          'button',
          {
            id: 'toolbar-button',
            'data-testid': 'toolbar-button',
          },
          'Publish',
        ),
  });
  const Toolbar = defineComponent({
    name: 'Toolbar',
    setup: () => () => h('section', [h(ToolbarButton)]),
  });
  const AppShell = defineComponent({
    name: 'AppShell',
    setup: () => () => h('main', [h(Toolbar)]),
  });
  const app = createApp(AppShell);
  const container = document.createElement('div');
  const source = createSourceDouble();
  const hostOrigin = 'https://app.iteradev.ai';
  const bridgeBootstrap = bootstrapEmbeddedInspectorBridgeOnMount(app, {
    enabled: true,
    hostOrigins: [hostOrigin],
  });
  const runtime = bootIterationInspectorRuntime({
    allowSelfMessaging: true,
  });

  document.body.append(container);

  window.dispatchEvent(
    new MessageEvent('message', {
      origin: hostOrigin,
      source: source as unknown as MessageEventSource,
      data: buildMessage('HELLO', {
        capabilities: ['host-tree'],
      }),
    }),
  );

  app.mount(container);

  window.dispatchEvent(
    new MessageEvent('message', {
      origin: hostOrigin,
      source: source as unknown as MessageEventSource,
      data: buildMessage('REQUEST_TREE', {}),
    }),
  );

  const readyCall = source.postMessage.mock.calls.find(
    ([message]) => (message as { type?: string }).type === 'READY',
  );
  const treeSnapshotCall = source.postMessage.mock.calls.find(
    ([message]) => (message as { type?: string }).type === 'TREE_SNAPSHOT',
  );
  const treeSnapshotPayload = treeSnapshotCall?.[0] as {
    payload?: {
      nodes?: Array<{
        displayName: string;
      }>;
    };
  };
  const buttonElement = document.getElementById('toolbar-button');

  expect(runtime).not.toBeNull();
  expect(windowWithIterationRuntime.__ITERA_ITERATION_INSPECTOR_RUNTIME__).toBe(
    runtime,
  );
  expect(readyCall?.[0]).toMatchObject({
    type: 'READY',
    payload: {
      capabilities: ['tree', 'props', 'highlight'],
    },
  });
  expect(treeSnapshotPayload.payload?.nodes?.map((node) => node.displayName)).toEqual(
    expect.arrayContaining(['AppShell', 'Toolbar', 'ToolbarButton']),
  );
  expect(buttonElement).not.toBeNull();
  expect(
    buildIterationElementSelection(buttonElement as HTMLButtonElement).element,
  ).toMatchObject({
    componentPath: ['AppShell', 'Toolbar', 'ToolbarButton'],
    reactComponentPath: ['AppShell', 'Toolbar', 'ToolbarButton'],
  });

  app.unmount();
  bridgeBootstrap.destroy();
});

test('applies and clears iteration preview edits for a mounted Vue app', () => {
  const PreviewCard = defineComponent({
    name: 'PreviewCard',
    setup: () =>
      () =>
        h(
          'div',
          {
            id: 'preview-card',
            'data-testid': 'preview-card',
          },
          'Original copy',
        ),
  });
  const PreviewImage = defineComponent({
    name: 'PreviewImage',
    setup: () =>
      () =>
        h('img', {
          id: 'preview-image',
          alt: 'Preview',
          src: '/initial.png',
          srcset: '/initial-small.png 1x, /initial-large.png 2x',
        }),
  });
  const AppShell = defineComponent({
    name: 'AppShell',
    setup: () => () => h('main', [h(PreviewCard), h(PreviewImage)]),
  });
  const app = createApp(AppShell);
  const container = document.createElement('div');
  const bridgeBootstrap = bootstrapEmbeddedInspectorBridgeOnMount(app, {
    enabled: true,
    hostOrigins: ['https://app.iteradev.ai'],
  });
  const postMessageSpy = vi
    .spyOn(window, 'postMessage')
    .mockImplementation(() => undefined);
  const runtime = bootIterationInspectorRuntime({
    allowSelfMessaging: true,
  });

  document.body.append(container);
  app.mount(container);

  const previewCard = document.getElementById('preview-card');
  const previewImage = document.getElementById('preview-image');

  expect(runtime).not.toBeNull();
  expect(previewCard).not.toBeNull();
  expect(previewImage).not.toBeNull();
  assert(previewCard instanceof HTMLDivElement);
  assert(previewImage instanceof HTMLImageElement);

  vi.spyOn(previewCard, 'getBoundingClientRect').mockReturnValue({
    top: 12,
    left: 24,
    width: 120,
    height: 40,
    right: 144,
    bottom: 52,
    x: 24,
    y: 12,
    toJSON: () => ({}),
  });
  vi.spyOn(previewImage, 'getBoundingClientRect').mockReturnValue({
    top: 72,
    left: 24,
    width: 96,
    height: 96,
    right: 120,
    bottom: 168,
    x: 24,
    y: 72,
    toJSON: () => ({}),
  });

  const previewCardLocator = buildIterationElementSelection(previewCard).element;
  const previewImageLocator = buildIterationElementSelection(previewImage).element;

  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'sync_preview_edits',
        revision: 1,
        targets: [
          {
            locator: previewCardLocator,
            operations: [
              {
                fieldId: 'textContent',
                value: 'Updated copy',
                valueType: 'string',
              },
              {
                fieldId: 'width',
                value: '240',
                valueType: 'number',
              },
            ],
          },
          {
            locator: previewImageLocator,
            operations: [
              {
                fieldId: 'assetReference',
                value: 'https://example.com/preview.png',
                valueType: 'asset_reference',
              },
            ],
          },
        ],
      },
      origin: 'https://app.iteradev.ai',
      source: window,
    }),
  );

  expect(previewCard.textContent).toBe('Updated copy');
  expect(previewCard.style.width).toBe('240px');
  expect(previewImage.getAttribute('src')).toBe(
    'https://example.com/preview.png',
  );
  expect(previewImage.getAttribute('srcset')).toBe(
    'https://example.com/preview.png',
  );
  expect(getPostedIterationMessages(postMessageSpy)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'runtime_ready',
        capabilities: ['preview_edits_v1'],
      }),
      expect.objectContaining({
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'preview_edits_status',
        revision: 1,
        appliedTargetCount: 2,
      }),
    ]),
  );

  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'clear_preview_edits',
        revision: 2,
      },
      origin: 'https://app.iteradev.ai',
      source: window,
    }),
  );

  expect(previewCard.textContent).toBe('Original copy');
  expect(previewCard.style.width).toBe('');
  expect(previewImage.getAttribute('src')).toBe('/initial.png');
  expect(previewImage.getAttribute('srcset')).toBe(
    '/initial-small.png 1x, /initial-large.png 2x',
  );
  expect(getPostedIterationMessages(postMessageSpy)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'preview_edits_status',
        revision: 2,
        appliedTargetCount: 0,
      }),
    ]),
  );

  app.unmount();
  bridgeBootstrap.destroy();
});
