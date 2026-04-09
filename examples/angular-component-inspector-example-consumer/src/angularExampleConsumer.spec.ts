import { buildMessage } from '@iteraai/inspector-protocol';
import { createAngularDevModeGlobalsInspectorAdapter } from '@iteraai/angular-component-inspector';
import {
  ITERATION_INSPECTOR_CHANNEL,
  isIterationInspectorRuntimeMessage,
} from '@iteraai/angular-component-inspector/iterationInspector';
import {
  bootstrapAngularExampleConsumer,
  trustedHostOrigin,
} from './app/bootstrapAngularExampleConsumer';
import {
  dispatchHostMessage,
  findNodeIdByDisplayName,
  getPostedProtocolMessage,
  getPostedRuntimeMessages,
  isPreviewPathUpdatedMessage,
  resolveInspectorImportPath,
  type MessageTargetDouble,
} from './angularExampleConsumerTestUtils';

const inspectorHighlightOverlaySelector =
  '[data-itera-inspector-highlight="true"]';

const runtimeTestSourceMetadataBySelector = new Map([
  [
    'example-embedded-harness',
    {
      file: 'src/app/app.component.ts',
      line: 5,
      column: 1,
    },
  ],
  [
    'hero-card',
    {
      file: 'src/app/heroCard.component.ts',
      line: 3,
      column: 1,
    },
  ],
  [
    'workflow-checklist',
    {
      file: 'src/app/workflowChecklist.component.ts',
      line: 4,
      column: 1,
    },
  ],
  [
    'publish-button',
    {
      file: 'src/app/publishButton.component.ts',
      line: 3,
      column: 1,
    },
  ],
] as const);

type WindowWithAngularGlobals = Window & {
  ng?: {
    getComponent?: (target: Element) => object | null | undefined;
  };
  __ITERA_ITERATION_INSPECTOR_RUNTIME__?: unknown;
};

const attachRuntimeTestSourceMetadata = () => {
  const angularGlobals = (window as WindowWithAngularGlobals).ng;
  let attachedCount = 0;

  runtimeTestSourceMetadataBySelector.forEach((source, selector) => {
    const hostElement = document.querySelector(selector);
    const component = hostElement
      ? angularGlobals?.getComponent?.(hostElement)
      : undefined;

    if (
      component === undefined ||
      component === null ||
      (typeof component !== 'object' && typeof component !== 'function')
    ) {
      return;
    }

    Object.defineProperty(component, '__iteraSource', {
      configurable: true,
      value: source,
    });
    attachedCount += 1;

    const constructorValue = (component as { constructor?: unknown }).constructor;

    if (
      constructorValue !== undefined &&
      (typeof constructorValue === 'object' ||
        typeof constructorValue === 'function')
    ) {
      Object.defineProperty(constructorValue, '__iteraSource', {
        configurable: true,
        value: source,
      });
    }
  });

  return attachedCount;
};

const mountHarness = async (
  props: Parameters<typeof bootstrapAngularExampleConsumer>[0] = {},
) => {
  const harness = await bootstrapAngularExampleConsumer({
    hostOrigins: [trustedHostOrigin],
    ...props,
  });
  const expectedMetadataTargetCount = runtimeTestSourceMetadataBySelector.size;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (attachRuntimeTestSourceMetadata() === expectedMetadataTargetCount) {
      break;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }

  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

  return {
    unmount: () => {
      harness.destroy();
      document.body.innerHTML = '';
      delete (window as WindowWithAngularGlobals)
        .__ITERA_ITERATION_INSPECTOR_RUNTIME__;
    },
  };
};

test('resolves Angular public package imports to built dist entrypoints', () => {
  const resolvedEntryPoints = [
    resolveInspectorImportPath('@iteraai/inspector-protocol'),
    resolveInspectorImportPath('@iteraai/angular-component-inspector'),
    resolveInspectorImportPath(
      '@iteraai/angular-component-inspector/embeddedBootstrap',
    ),
    resolveInspectorImportPath(
      '@iteraai/angular-component-inspector/bridgeRuntime',
    ),
    resolveInspectorImportPath(
      '@iteraai/angular-component-inspector/iterationInspector',
    ),
  ];

  for (const resolvedEntryPoint of resolvedEntryPoints) {
    expect(resolvedEntryPoint).toContain('/dist/');
    expect(resolvedEntryPoint).not.toContain('/src/');
  }
});

test('surfaces Angular tree source metadata when the supported source path is enabled', async () => {
  const harness = await mountHarness();

  try {
    const angularGlobals = (window as WindowWithAngularGlobals).ng;
    const snapshot =
      angularGlobals === undefined
        ? undefined
        : createAngularDevModeGlobalsInspectorAdapter({
            angularGlobals,
          }).getTreeSnapshot();
    const publishButtonNode = snapshot?.nodes.find(
      (node) => node.displayName === 'PublishButton',
    );

    expect(publishButtonNode?.source).toEqual(
      expect.objectContaining({
        file: 'src/app/publishButton.component.ts',
        line: expect.any(Number),
        column: expect.any(Number),
      }),
    );
    expect(publishButtonNode?.source?.line).toBeGreaterThan(1);
    expect(publishButtonNode?.source?.column).toBeGreaterThan(0);
  } finally {
    harness.unmount();
  }
});

test('completes Angular handshake, tree, props, highlight, and snapshot requests', async () => {
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
          sessionId: 'session-angular-1',
        },
      ),
      hostSource as unknown as MessageEventSource,
    );

    expect(getPostedProtocolMessage(hostSource.postMessage, 'READY')).toEqual(
      expect.objectContaining({
        channel: 'itera-component-inspector',
        sessionId: 'session-angular-1',
        type: 'READY',
      }),
    );
    expect(
      hostSource.postMessage.mock.calls.some(([message, targetOrigin]) => {
        return (
          targetOrigin === trustedHostOrigin &&
          isPreviewPathUpdatedMessage(message) &&
          message.path === '/?fixture=1'
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
          sessionId: 'session-angular-1',
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
          sessionId: 'session-angular-1',
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

    const publishButtonHost = document.querySelector<HTMLElement>(
      '[data-testid="publish-button-host"]',
    );

    expect(publishButtonHost).not.toBeNull();

    vi.spyOn(publishButtonHost!, 'getBoundingClientRect').mockReturnValue({
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
          sessionId: 'session-angular-1',
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
          sessionId: 'session-angular-1',
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
    expect(snapshotMessage?.payload?.html).toContain('Embedded Angular Fixture');
    expect(snapshotMessage?.payload?.htmlTruncated).toBe(false);
  } finally {
    harness.unmount();
  }
});

test('emits iteration selection messages for the Angular fixture button', async () => {
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
          urlPath: '/?fixture=1',
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
    harness.unmount();
    postMessageSpy.mockRestore();
  }
});
