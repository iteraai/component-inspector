import { buildMessage } from '@iteraai/inspector-protocol';
import { createApp, defineComponent, h } from 'vue';
import {
  bootstrapEmbeddedInspectorBridgeOnMount,
  destroyInspectorBridge,
} from './index';
import {
  bootIterationInspectorRuntime,
  buildIterationElementSelection,
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

afterEach(() => {
  windowWithIterationRuntime.__ITERA_ITERATION_INSPECTOR_RUNTIME__?.stop();
  delete windowWithIterationRuntime.__ITERA_ITERATION_INSPECTOR_RUNTIME__;
  destroyInspectorBridge();
  document.body.innerHTML = '';
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
