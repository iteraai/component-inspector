import { buildMessage } from '@iteraai/inspector-protocol';
import { destroyInspectorBridge, initInspectorBridge } from './bridgeRuntime';
import type { AngularDevModeGlobalsApi } from './adapters/angular';

type SourceDouble = {
  postMessage: ReturnType<typeof vi.fn>;
};

type WindowWithAngularGlobals = Window & {
  ng?: AngularDevModeGlobalsApi;
};

const createSourceDouble = (): SourceDouble => {
  return {
    postMessage: vi.fn(),
  };
};

const windowWithAngularGlobals = window as WindowWithAngularGlobals;

afterEach(() => {
  destroyInspectorBridge();
  delete windowWithAngularGlobals.ng;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

test('bridge initialization stays safe and returns an empty snapshot when window.ng is unavailable', () => {
  const hostOrigin = 'https://app.iteradev.ai';
  const source = createSourceDouble();

  initInspectorBridge({
    hostOrigins: [hostOrigin],
    enabled: true,
    capabilities: ['tree', 'props', 'highlight'],
  });

  window.dispatchEvent(
    new MessageEvent('message', {
      origin: hostOrigin,
      source: source as unknown as MessageEventSource,
      data: buildMessage('HELLO', {
        capabilities: ['host-tree'],
      }),
    }),
  );
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

  expect(readyCall?.[0]).toMatchObject({
    type: 'READY',
    payload: {
      capabilities: ['tree', 'props', 'highlight'],
    },
  });
  expect(treeSnapshotCall?.[0]).toMatchObject({
    type: 'TREE_SNAPSHOT',
    payload: {
      nodes: [],
      rootIds: [],
    },
  });
});
