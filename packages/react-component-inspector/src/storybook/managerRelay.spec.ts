import { buildMessage } from '@iteraai/inspector-protocol';
import { ITERATION_INSPECTOR_CHANNEL } from '../iterationInspector';
import {
  DEFAULT_STORYBOOK_PREVIEW_IFRAME_SELECTOR,
  initStorybookManagerRelay,
} from './managerRelay';

type MockMessageTarget = {
  postMessage: ReturnType<typeof vi.fn>;
};

const hostOrigin = 'https://app.iteradev.ai';
const previewOrigin = 'https://storybook.iteradev.ai';

const createMockMessageTarget = (): MockMessageTarget => {
  return {
    postMessage: vi.fn(),
  };
};

const createPreviewIframe = (previewWindow: MockMessageTarget, storyId: string) => {
  const iframe = document.createElement('iframe');

  iframe.id = DEFAULT_STORYBOOK_PREVIEW_IFRAME_SELECTOR.replace('iframe#', '');
  iframe.src = `${previewOrigin}/iframe.html?id=${storyId}`;
  Object.defineProperty(iframe, 'contentWindow', {
    configurable: true,
    value: previewWindow,
  });
  document.body.append(iframe);

  return iframe;
};

const dispatchWindowMessage = (
  data: unknown,
  source: MockMessageTarget,
  origin: string,
) => {
  window.dispatchEvent(
    new MessageEvent('message', {
      data,
      origin,
      source: source as unknown as MessageEventSource,
    }),
  );
};

describe('storybook manager relay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('forwards inspector protocol messages between the trusted parent host and active preview iframe', () => {
    const hostWindow = createMockMessageTarget();
    const previewWindow = createMockMessageTarget();

    createPreviewIframe(previewWindow, 'button--primary');

    const relay = initStorybookManagerRelay({
      hostOrigins: [hostOrigin],
      parentWindow: hostWindow as unknown as Window,
      referrer: `${hostOrigin}/debugger`,
    });

    const pingMessage = buildMessage('PING', {
      sentAt: 1_742_900_000,
    });

    dispatchWindowMessage(pingMessage, hostWindow, hostOrigin);

    expect(previewWindow.postMessage).toHaveBeenCalledWith(
      pingMessage,
      previewOrigin,
    );

    const pongMessage = buildMessage('PONG', {
      sentAt: 1_742_900_001,
    });

    dispatchWindowMessage(pongMessage, previewWindow, previewOrigin);

    expect(hostWindow.postMessage).toHaveBeenCalledWith(pongMessage, hostOrigin);

    relay.destroy();
  });

  test('forwards iteration inspector messages and ignores unrelated or untrusted traffic', () => {
    const hostWindow = createMockMessageTarget();
    const previewWindow = createMockMessageTarget();

    createPreviewIframe(previewWindow, 'button--secondary');

    const relay = initStorybookManagerRelay({
      hostOrigins: [hostOrigin],
      parentWindow: hostWindow as unknown as Window,
      referrer: `${hostOrigin}/debugger`,
    });

    const enterSelectModeMessage = {
      channel: ITERATION_INSPECTOR_CHANNEL,
      kind: 'enter_select_mode',
      selectionMode: 'single',
    } as const;

    dispatchWindowMessage(enterSelectModeMessage, hostWindow, hostOrigin);

    expect(previewWindow.postMessage).toHaveBeenCalledWith(
      enterSelectModeMessage,
      previewOrigin,
    );

    dispatchWindowMessage(
      buildMessage('PING', {
        sentAt: 1_742_900_002,
      }),
      hostWindow,
      'https://evil.iteradev.ai',
    );
    dispatchWindowMessage(
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'debug_log',
        event: 'selection_emitted',
      },
      hostWindow,
      hostOrigin,
    );

    expect(previewWindow.postMessage).toHaveBeenCalledTimes(1);

    const runtimeReadyMessage = {
      channel: ITERATION_INSPECTOR_CHANNEL,
      kind: 'runtime_ready',
      urlPath: '/?path=/story/button--secondary',
    } as const;

    dispatchWindowMessage(runtimeReadyMessage, previewWindow, previewOrigin);

    expect(hostWindow.postMessage).toHaveBeenCalledWith(
      runtimeReadyMessage,
      hostOrigin,
    );

    dispatchWindowMessage(
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'enter_select_mode',
      },
      previewWindow,
      previewOrigin,
    );

    expect(hostWindow.postMessage).toHaveBeenCalledTimes(1);

    relay.destroy();
  });

  test('uses the current preview iframe after Storybook recreates it', () => {
    const hostWindow = createMockMessageTarget();
    const firstPreviewWindow = createMockMessageTarget();

    const firstPreviewIframe = createPreviewIframe(
      firstPreviewWindow,
      'button--initial',
    );

    const relay = initStorybookManagerRelay({
      hostOrigins: [hostOrigin],
      parentWindow: hostWindow as unknown as Window,
      referrer: `${hostOrigin}/debugger`,
    });

    const firstRequest = buildMessage('REQUEST_TREE', {
      includeSource: true,
    });

    dispatchWindowMessage(firstRequest, hostWindow, hostOrigin);

    expect(firstPreviewWindow.postMessage).toHaveBeenCalledWith(
      firstRequest,
      previewOrigin,
    );

    firstPreviewIframe.remove();

    const secondPreviewWindow = createMockMessageTarget();

    createPreviewIframe(secondPreviewWindow, 'button--updated');

    const secondRequest = buildMessage('REQUEST_NODE_PROPS', {
      nodeId: 'node-2',
    });

    dispatchWindowMessage(secondRequest, hostWindow, hostOrigin);

    expect(firstPreviewWindow.postMessage).toHaveBeenCalledTimes(1);
    expect(secondPreviewWindow.postMessage).toHaveBeenCalledWith(
      secondRequest,
      previewOrigin,
    );

    dispatchWindowMessage(
      buildMessage('PONG', {
        sentAt: 1_742_900_003,
      }),
      firstPreviewWindow,
      previewOrigin,
    );

    expect(hostWindow.postMessage).not.toHaveBeenCalled();

    const secondPong = buildMessage('PONG', {
      sentAt: 1_742_900_004,
    });

    dispatchWindowMessage(secondPong, secondPreviewWindow, previewOrigin);

    expect(hostWindow.postMessage).toHaveBeenCalledWith(secondPong, hostOrigin);

    relay.destroy();
  });
});
