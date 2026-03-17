import { spawnSync } from 'node:child_process';
import { buildMessage } from '@iteraai/inspector-protocol';
import {
  ITERATION_INSPECTOR_CHANNEL,
  isIterationInspectorRuntimeMessage,
} from '@iteraai/react-component-inspector/iterationInspector';
import { act } from 'react';
import { renderEmbeddedHarnessApp } from './renderEmbeddedHarnessApp';

const trustedHostOrigin = 'http://127.0.0.1:4173';

type MessageTargetDouble = {
  postMessage: ReturnType<typeof vi.fn>;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isPreviewPathUpdatedMessage = (
  value: unknown,
): value is {
  channel: 'itera-preview-path';
  type: 'PATH_UPDATED';
  path: string;
} => {
  return (
    isRecord(value) &&
    value.channel === 'itera-preview-path' &&
    value.type === 'PATH_UPDATED' &&
    typeof value.path === 'string'
  );
};

const getPostedProtocolMessage = (
  spy: ReturnType<typeof vi.fn>,
  type: string,
) => {
  const matchingCall = spy.mock.calls.find(([message]) => {
    return isRecord(message) && message.type === type;
  });

  return matchingCall?.[0];
};

const getPostedRuntimeMessages = (spy: ReturnType<typeof vi.spyOn>) => {
  return spy.mock.calls
    .map(([message]) => message)
    .filter(isIterationInspectorRuntimeMessage);
};

const dispatchHostMessage = (
  message: unknown,
  source: MessageEventSource | null,
) => {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: message,
      origin: trustedHostOrigin,
      source,
    }),
  );
};

const mountHarness = async (
  props: Parameters<typeof renderEmbeddedHarnessApp>[1] = {},
) => {
  const container = document.createElement('div');

  document.body.appendChild(container);

  let renderHandle: ReturnType<typeof renderEmbeddedHarnessApp> | undefined =
    undefined;

  await act(async () => {
    renderHandle = renderEmbeddedHarnessApp(container, {
      hostOrigins: [trustedHostOrigin],
      ...props,
    });
  });

  return {
    unmount: async () => {
      await act(async () => {
        renderHandle?.unmount();
      });
      container.remove();
      delete window.__ITERA_ITERATION_INSPECTOR_RUNTIME__;
    },
  };
};

beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    value: true,
  });
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/embedded.html?fixture=1');
  delete window.__ITERA_ITERATION_INSPECTOR_RUNTIME__;
});

afterEach(() => {
  delete window.__ITERA_ITERATION_INSPECTOR_RUNTIME__;
});

test('resolves public package imports to built dist entrypoints', () => {
  const resolveImportPath = (specifier: string) => {
    const resolution = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `console.log(import.meta.resolve(${JSON.stringify(specifier)}))`,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );

    if (resolution.status !== 0) {
      throw new Error(resolution.stderr || resolution.stdout);
    }

    const resolvedSpecifier = resolution.stdout.trim();

    return resolvedSpecifier.startsWith('file://')
      ? new URL(resolvedSpecifier).pathname
      : resolvedSpecifier;
  };

  const resolvedEntryPoints = [
    resolveImportPath('@iteraai/inspector-protocol'),
    resolveImportPath('@iteraai/inspector-protocol/errors'),
    resolveImportPath('@iteraai/react-component-inspector'),
    resolveImportPath('@iteraai/react-component-inspector/iterationInspector'),
  ];

  for (const resolvedEntryPoint of resolvedEntryPoints) {
    expect(resolvedEntryPoint).toContain('/dist/');
    expect(resolvedEntryPoint).not.toContain('/src/');
  }
});

test('completes the host handshake and request flow against public package imports', async () => {
  const hostSource: MessageTargetDouble = {
    postMessage: vi.fn(),
  };
  const harness = await mountHarness();

  try {
    dispatchHostMessage(
      buildMessage(
        'HELLO',
        {
          capabilities: ['tree', 'props', 'highlight'],
        },
        {
          requestId: 'request-hello',
          sessionId: 'session-1',
        },
      ),
      hostSource as unknown as MessageEventSource,
    );

    expect(getPostedProtocolMessage(hostSource.postMessage, 'READY')).toEqual(
      expect.objectContaining({
        channel: 'itera-component-inspector',
        sessionId: 'session-1',
        type: 'READY',
      }),
    );
    expect(
      hostSource.postMessage.mock.calls.some(([message, targetOrigin]) => {
        return (
          targetOrigin === trustedHostOrigin &&
          isPreviewPathUpdatedMessage(message) &&
          message.path === '/embedded.html?fixture=1'
        );
      }),
    ).toBe(true);

    dispatchHostMessage(
      buildMessage(
        'REQUEST_TREE',
        {
          includeSource: false,
        },
        {
          requestId: 'request-tree',
          sessionId: 'session-1',
        },
      ),
      hostSource as unknown as MessageEventSource,
    );

    expect(getPostedProtocolMessage(hostSource.postMessage, 'TREE_SNAPSHOT')).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          rootIds: ['root-app'],
          nodes: expect.arrayContaining([
            expect.objectContaining({ id: 'root-app' }),
            expect.objectContaining({ id: 'publish-button' }),
          ]),
        }),
        type: 'TREE_SNAPSHOT',
      }),
    );

    dispatchHostMessage(
      buildMessage(
        'REQUEST_NODE_PROPS',
        {
          nodeId: 'publish-button',
        },
        {
          requestId: 'request-node-props',
          sessionId: 'session-1',
        },
      ),
      hostSource as unknown as MessageEventSource,
    );

    expect(
      getPostedProtocolMessage(hostSource.postMessage, 'NODE_PROPS'),
    ).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          nodeId: 'publish-button',
          props: expect.objectContaining({
            label: 'Publish iteration',
            variant: 'primary',
          }),
        }),
        type: 'NODE_PROPS',
      }),
    );
  } finally {
    await harness.unmount();
  }
});

test('emits iteration selection messages for the embedded fixture button', async () => {
  const postMessageSpy = vi
    .spyOn(window, 'postMessage')
    .mockImplementation(() => undefined);
  const harness = await mountHarness({
    allowSelfMessaging: true,
  });

  try {
    expect(getPostedRuntimeMessages(postMessageSpy)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'runtime_ready',
          urlPath: '/embedded.html?fixture=1',
        }),
      ]),
    );

    dispatchHostMessage(
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'enter_select_mode',
      },
      window,
    );

    const publishButton = document.querySelector<HTMLButtonElement>(
      '[data-testid="publish-button"]',
    );

    expect(publishButton).not.toBeNull();

    const selectionClick = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    const selectionResult = publishButton!.dispatchEvent(selectionClick);

    expect(selectionResult).toBe(false);
    expect(selectionClick.defaultPrevented).toBe(true);
    expect(getPostedRuntimeMessages(postMessageSpy)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'mode_changed',
          active: true,
        }),
        expect.objectContaining({
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'element_selected',
          selection: expect.objectContaining({
            displayText: '@button "Publish iteration"',
          }),
        }),
      ]),
    );
  } finally {
    await harness.unmount();
    postMessageSpy.mockRestore();
  }
});
