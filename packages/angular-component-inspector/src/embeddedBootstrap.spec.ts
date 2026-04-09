import { buildMessage } from '@iteraai/inspector-protocol';
import {
  bootstrapEmbeddedInspectorBridge,
  initDevEmbeddedInspectorBridge,
} from './embeddedBootstrap';
import { destroyInspectorBridge } from './bridgeRuntime';

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
