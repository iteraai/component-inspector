import { buildMessage } from '@iteraai/inspector-protocol';
import {
  bootstrapEmbeddedInspectorBridge,
  initDevEmbeddedInspectorBridge,
} from './embeddedBootstrap';
import { destroyInspectorBridge } from './bridgeRuntime';
import type { AngularInspectorRuntimeConfig } from './adapters/base';

type SourceDouble = {
  postMessage: ReturnType<typeof vi.fn>;
};

const createSourceDouble = (): SourceDouble => {
  return {
    postMessage: vi.fn(),
  };
};

afterEach(() => {
  destroyInspectorBridge();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

test('bootstrap helper can be called during client startup without app registration hooks', () => {
  const hostOrigin = 'https://app.iteradev.ai';
  const source = createSourceDouble();
  const bootstrap = bootstrapEmbeddedInspectorBridge({
    enabled: true,
    hostOrigins: [hostOrigin],
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

  const readyCall = source.postMessage.mock.calls.find(
    ([message]) => (message as { type?: string }).type === 'READY',
  );

  expect(readyCall?.[0]).toMatchObject({
    type: 'READY',
  });

  bootstrap.destroy();
});

test('dev bootstrap helper uses the default host-origin path safely', () => {
  const hostOrigin = 'https://app.iteradev.ai';
  const source = createSourceDouble();
  const bootstrap = initDevEmbeddedInspectorBridge();

  window.dispatchEvent(
    new MessageEvent('message', {
      origin: hostOrigin,
      source: source as unknown as MessageEventSource,
      data: buildMessage('HELLO', {
        capabilities: ['host-tree'],
      }),
    }),
  );

  const readyCall = source.postMessage.mock.calls.find(
    ([message]) => (message as { type?: string }).type === 'READY',
  );

  expect(readyCall?.[0]).toMatchObject({
    type: 'READY',
  });

  bootstrap.destroy();
});

test('dev bootstrap forwards caller runtimeConfig to the adapter factory', () => {
  const hostOrigin = 'https://app.iteradev.ai';
  const source = createSourceDouble();
  const runtimeConfig: AngularInspectorRuntimeConfig = {
    adapter: 'angular-dev-mode-globals',
    angularGlobals: {
      getComponent: vi.fn(),
      getDirectiveMetadata: vi.fn(),
      getHostElement: vi.fn(),
      getOwningComponent: vi.fn(),
    },
  };
  const adapterFactory = vi.fn(() => {
    return {
      adapterTarget: 'noop' as const,
      isAngularDevModeGlobalsAvailable: false,
      getTreeSnapshot: () => ({
        nodes: [],
        rootIds: [],
      }),
      getNodeProps: () => undefined,
      getDomElement: () => null,
    };
  });
  const bootstrap = initDevEmbeddedInspectorBridge({
    adapterFactory,
    runtimeConfig,
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

  expect(adapterFactory).toHaveBeenCalledWith(runtimeConfig);

  bootstrap.destroy();
});
