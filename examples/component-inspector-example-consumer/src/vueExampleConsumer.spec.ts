import { buildMessage } from '@iteraai/inspector-protocol';
import {
  ITERATION_INSPECTOR_CHANNEL,
  isIterationInspectorRuntimeMessage,
} from '@iteraai/vue-component-inspector/iterationInspector';
import { nextTick } from 'vue';
import {
  dispatchHostMessage,
  findNodeIdByDisplayName,
  getPostedProtocolMessage,
  getPostedRuntimeMessages,
  isPreviewPathUpdatedMessage,
  resolveInspectorImportPath,
  trustedHostOrigin,
  type MessageTargetDouble,
} from './exampleConsumerTestUtils';
import { renderVueEmbeddedHarnessApp } from './renderVueEmbeddedHarnessApp';

const inspectorHighlightOverlaySelector =
  '[data-itera-inspector-highlight="true"]';

const mountHarness = async (
  props: Parameters<typeof renderVueEmbeddedHarnessApp>[1] = {},
) => {
  const container = document.createElement('div');

  document.body.appendChild(container);

  const renderHandle = renderVueEmbeddedHarnessApp(container, {
    hostOrigins: [trustedHostOrigin],
    ...props,
  });

  await nextTick();

  return {
    unmount: async () => {
      renderHandle.unmount();
      await nextTick();
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
  window.history.replaceState({}, '', '/embedded-vue.html?fixture=1');
  delete window.__ITERA_ITERATION_INSPECTOR_RUNTIME__;
});

afterEach(() => {
  delete window.__ITERA_ITERATION_INSPECTOR_RUNTIME__;
});

test('resolves Vue public package imports to built dist entrypoints', () => {
  const resolvedEntryPoints = [
    resolveInspectorImportPath('@iteraai/inspector-protocol'),
    resolveInspectorImportPath('@iteraai/vue-component-inspector'),
    resolveInspectorImportPath('@iteraai/vue-component-inspector/embeddedBootstrap'),
    resolveInspectorImportPath('@iteraai/vue-component-inspector/bridgeRuntime'),
    resolveInspectorImportPath('@iteraai/vue-component-inspector/iterationInspector'),
  ];

  for (const resolvedEntryPoint of resolvedEntryPoints) {
    expect(resolvedEntryPoint).toContain('/dist/');
    expect(resolvedEntryPoint).not.toContain('/src/');
  }
});

test('completes the Vue host handshake and request flow against public package imports', async () => {
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
          sessionId: 'session-vue-1',
        },
      ),
      hostSource as unknown as MessageEventSource,
    );

    expect(getPostedProtocolMessage(hostSource.postMessage, 'READY')).toEqual(
      expect.objectContaining({
        channel: 'itera-component-inspector',
        sessionId: 'session-vue-1',
        type: 'READY',
      }),
    );
    expect(
      hostSource.postMessage.mock.calls.some(([message, targetOrigin]) => {
        return (
          targetOrigin === trustedHostOrigin &&
          isPreviewPathUpdatedMessage(message) &&
          message.path === '/embedded-vue.html?fixture=1'
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
          sessionId: 'session-vue-1',
        },
      ),
      hostSource as unknown as MessageEventSource,
    );

    const treeSnapshotMessage = getPostedProtocolMessage(
      hostSource.postMessage,
      'TREE_SNAPSHOT',
    ) as
      | {
          payload?: {
            nodes: Array<{
              id: string;
              displayName: string;
            }>;
            rootIds: string[];
          };
        }
      | undefined;

    expect(treeSnapshotMessage).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          rootIds: expect.any(Array),
          nodes: expect.arrayContaining([
            expect.objectContaining({ displayName: 'ExampleEmbeddedHarness' }),
            expect.objectContaining({ displayName: 'HeroCard' }),
            expect.objectContaining({ displayName: 'WorkflowChecklist' }),
            expect.objectContaining({ displayName: 'PublishButton' }),
          ]),
        }),
        type: 'TREE_SNAPSHOT',
      }),
    );

    const publishButtonNodeId = findNodeIdByDisplayName(
      treeSnapshotMessage?.payload,
      'PublishButton',
    );

    expect(publishButtonNodeId).toEqual(expect.any(String));

    dispatchHostMessage(
      buildMessage(
        'REQUEST_NODE_PROPS',
        {
          nodeId: publishButtonNodeId!,
        },
        {
          requestId: 'request-node-props',
          sessionId: 'session-vue-1',
        },
      ),
      hostSource as unknown as MessageEventSource,
    );

    expect(
      getPostedProtocolMessage(hostSource.postMessage, 'NODE_PROPS'),
    ).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          nodeId: publishButtonNodeId,
          props: expect.objectContaining({
            label: 'Publish iteration',
            variant: 'primary',
          }),
        }),
        type: 'NODE_PROPS',
      }),
    );

    const publishButton = document.querySelector<HTMLButtonElement>(
      '[data-testid="publish-button"]',
    );

    expect(publishButton).not.toBeNull();

    vi.spyOn(publishButton!, 'getBoundingClientRect').mockReturnValue({
      x: 12,
      y: 24,
      left: 12,
      top: 24,
      right: 192,
      bottom: 72,
      width: 180,
      height: 48,
      toJSON: () => '',
    } as DOMRect);

    dispatchHostMessage(
      buildMessage(
        'HIGHLIGHT_NODE',
        {
          nodeId: publishButtonNodeId!,
        },
        {
          requestId: 'request-highlight',
          sessionId: 'session-vue-1',
        },
      ),
      hostSource as unknown as MessageEventSource,
    );

    const highlightOverlay = document.querySelector<HTMLDivElement>(
      inspectorHighlightOverlaySelector,
    );

    expect(highlightOverlay).not.toBeNull();
    expect(highlightOverlay?.style.display).toBe('block');
    expect(highlightOverlay?.style.left).toBe('12px');
    expect(highlightOverlay?.style.top).toBe('24px');
    expect(highlightOverlay?.style.width).toBe('180px');
    expect(highlightOverlay?.style.height).toBe('48px');

    dispatchHostMessage(
      buildMessage(
        'REQUEST_SNAPSHOT',
        {},
        {
          requestId: 'request-snapshot',
          sessionId: 'session-vue-1',
        },
      ),
      hostSource as unknown as MessageEventSource,
    );

    const snapshotMessage = getPostedProtocolMessage(
      hostSource.postMessage,
      'SNAPSHOT',
    ) as
      | {
          payload?: {
            capture?: Blob;
            captureMimeType?: string;
            html?: string;
            htmlTruncated?: boolean;
            treeSnapshot?: {
              nodes?: Array<{
                displayName: string;
              }>;
            };
          };
        }
      | undefined;

    expect(snapshotMessage).toEqual(
      expect.objectContaining({
        type: 'SNAPSHOT',
        payload: expect.objectContaining({
          captureMimeType: 'image/svg+xml',
          capturedAt: expect.any(Number),
          treeSnapshot: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({ displayName: 'PublishButton' }),
            ]),
          }),
        }),
      }),
    );
    expect(snapshotMessage?.payload?.capture).toBeInstanceOf(Blob);
    expect(snapshotMessage?.payload?.html).toContain('Embedded Vue Fixture');
    expect(snapshotMessage?.payload?.htmlTruncated).toBe(false);
  } finally {
    await harness.unmount();
  }
});

test('emits iteration selection messages for the Vue fixture button', async () => {
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
          urlPath: '/embedded-vue.html?fixture=1',
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
            element: expect.objectContaining({
              componentPath: [
                'ExampleEmbeddedHarness',
                'WorkflowChecklist',
                'PublishButton',
              ],
              reactComponentPath: [
                'ExampleEmbeddedHarness',
                'WorkflowChecklist',
                'PublishButton',
              ],
              dataTestId: 'publish-button',
            }),
          }),
        }),
      ]),
    );
  } finally {
    await harness.unmount();
    postMessageSpy.mockRestore();
  }
});
