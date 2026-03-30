import { buildMessage } from '@iteraai/inspector-protocol';
import {
  ITERATION_INSPECTOR_CHANNEL,
  isIterationInspectorRuntimeMessage,
  type IterationElementSelection,
} from '@iteraai/react-component-inspector/iterationInspector';
import { act } from 'react';
import {
  dispatchHostMessage,
  getPostedProtocolMessage,
  getPostedRuntimeMessages,
  isPreviewPathUpdatedMessage,
  resolveInspectorImportPath,
  trustedHostOrigin,
  type MessageTargetDouble,
} from './exampleConsumerTestUtils';
import { renderEmbeddedHarnessApp } from './renderEmbeddedHarnessApp';

const getSelectedElementMessage = (spy: ReturnType<typeof vi.spyOn>) => {
  const selectedElementMessage = getPostedRuntimeMessages(
    spy,
    isIterationInspectorRuntimeMessage,
  )
    .filter((message) => {
      return message.kind === 'element_selected';
    })
    .at(-1);

  expect(selectedElementMessage?.kind).toBe('element_selected');

  return (selectedElementMessage as {
    kind: 'element_selected';
    selection: IterationElementSelection;
  }).selection;
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
  const resolvedEntryPoints = [
    resolveInspectorImportPath('@iteraai/inspector-protocol'),
    resolveInspectorImportPath('@iteraai/inspector-protocol/errors'),
    resolveInspectorImportPath('@iteraai/react-component-inspector'),
    resolveInspectorImportPath('@iteraai/react-component-inspector/iterationInspector'),
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
            expect.objectContaining({ id: 'preview-image' }),
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
    expect(
      getPostedRuntimeMessages(postMessageSpy, isIterationInspectorRuntimeMessage),
    ).toEqual(
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
    expect(
      getPostedRuntimeMessages(postMessageSpy, isIterationInspectorRuntimeMessage),
    ).toEqual(
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

test('applies and clears preview edits for the selected fixture element', async () => {
  const postMessageSpy = vi
    .spyOn(window, 'postMessage')
    .mockImplementation(() => undefined);
  const harness = await mountHarness({
    allowSelfMessaging: true,
  });

  try {
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

    publishButton!.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      }),
    );

    const selection = getSelectedElementMessage(postMessageSpy);

    dispatchHostMessage(
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'sync_preview_edits',
        revision: 1,
        targets: [
          {
            locator: selection.element,
            operations: [
              {
                fieldId: 'textContent',
                value: 'Ship faster',
              },
              {
                fieldId: 'borderRadius',
                value: '24px',
              },
              {
                fieldId: 'backgroundColor',
                value: '#112233',
              },
            ],
          },
        ],
      },
      window,
    );

    expect(publishButton!.textContent).toBe('Ship faster');
    expect(publishButton!.style.borderRadius).toBe('24px');
    expect(publishButton!.style.background).toContain('rgb(17, 34, 51)');
    expect(
      getPostedRuntimeMessages(postMessageSpy, isIterationInspectorRuntimeMessage),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'preview_edits_status',
          revision: 1,
          appliedTargetCount: 1,
        }),
      ]),
    );

    dispatchHostMessage(
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'clear_preview_edits',
        revision: 2,
      },
      window,
    );

    expect(publishButton!.textContent).toBe('Publish iteration');
    expect(publishButton!.style.borderRadius).toBe('');
    expect(publishButton!.style.background).toBe('');
    expect(
      getPostedRuntimeMessages(postMessageSpy, isIterationInspectorRuntimeMessage),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'preview_edits_status',
          revision: 2,
          appliedTargetCount: 0,
        }),
      ]),
    );
  } finally {
    await harness.unmount();
    postMessageSpy.mockRestore();
  }
});

test('applies and clears asset preview edits for the fixture image', async () => {
  const postMessageSpy = vi
    .spyOn(window, 'postMessage')
    .mockImplementation(() => undefined);
  const harness = await mountHarness({
    allowSelfMessaging: true,
  });

  try {
    const image = document.querySelector<HTMLImageElement>(
      '[data-testid="preview-image"]',
    );

    expect(image).not.toBeNull();

    dispatchHostMessage(
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'enter_select_mode',
      },
      window,
    );

    image!.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      }),
    );

    const selection = getSelectedElementMessage(postMessageSpy);

    dispatchHostMessage(
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'sync_preview_edits',
        revision: 3,
        targets: [
          {
            locator: selection.element,
            operations: [
              {
                fieldId: 'assetReference',
                value: 'https://example.com/preview-replacement.png',
              },
            ],
          },
        ],
      },
      window,
    );

    expect(image!.getAttribute('src')).toBe(
      'https://example.com/preview-replacement.png',
    );
    expect(
      getPostedRuntimeMessages(postMessageSpy, isIterationInspectorRuntimeMessage),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'preview_edits_status',
          revision: 3,
          appliedTargetCount: 1,
        }),
      ]),
    );

    dispatchHostMessage(
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'clear_preview_edits',
        revision: 4,
      },
      window,
    );

    expect(image!.getAttribute('src')).toContain('images.unsplash.com');
    expect(
      getPostedRuntimeMessages(postMessageSpy, isIterationInspectorRuntimeMessage),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'preview_edits_status',
          revision: 4,
          appliedTargetCount: 0,
        }),
      ]),
    );
  } finally {
    await harness.unmount();
    postMessageSpy.mockRestore();
  }
});
