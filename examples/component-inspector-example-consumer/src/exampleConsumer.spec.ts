import { buildMessage } from '@iteraai/inspector-protocol';
import {
  ITERATION_INSPECTOR_CHANNEL,
  isIterationInspectorRuntimeMessage,
  type IterationElementSelection,
  type IterationInspectorRuntimeMessage,
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

const getCaptureMessage = (
  spy: ReturnType<typeof vi.spyOn>,
  requestId: string,
) => {
  return getPostedRuntimeMessages(spy, isIterationInspectorRuntimeMessage)
    .filter(
      (
        message,
      ): message is Extract<
        IterationInspectorRuntimeMessage,
        {
          kind: 'element_crop_captured';
        }
      > => {
        return (
          message.kind === 'element_crop_captured' &&
          message.requestId === requestId
        );
      },
    )
    .at(-1);
};

const waitForCaptureMessage = async (
  spy: ReturnType<typeof vi.spyOn>,
  requestId: string,
) => {
  for (let index = 0; index < 50; index += 1) {
    const message = getCaptureMessage(spy, requestId);

    if (message !== undefined) {
      return message;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }

  return undefined;
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
    resolveInspectorImportPath('@iteraai/vite-plugin-react-inspector'),
    resolveInspectorImportPath('@iteraai/vite-plugin-react-inspector/client'),
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

test('captures the complex Airbnb-style category banner target with padding', async () => {
  const postMessageSpy = vi
    .spyOn(window, 'postMessage')
    .mockImplementation(() => undefined);
  const drawImage = vi.fn();
  const originalImage = window.Image;
  const getComputedStyle = window.getComputedStyle.bind(window);
  const getComputedStyleSpy = vi
    .spyOn(window, 'getComputedStyle')
    .mockImplementation((element) => getComputedStyle(element));
  const getContextSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
  const toBlobSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'toBlob')
    .mockImplementation(function toBlob(callback: BlobCallback) {
      callback(new Blob(['complex-banner'], { type: 'image/png' }));
    });
  class ImmediateImage {
    crossOrigin = '';
    decoding = '';
    onerror: OnErrorEventHandler = null;
    onload: ((event: Event) => void) | null = null;

    decode = vi.fn().mockResolvedValue(undefined);

    set src(_value: string) {
      queueMicrotask(() => {
        this.onload?.(new Event('load'));
      });
    }
  }
  class TestSvgImageElement extends window.SVGElement {}
  vi.stubGlobal('Image', ImmediateImage);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal('SVGImageElement', TestSvgImageElement);
  Object.defineProperty(window, 'Image', {
    configurable: true,
    value: ImmediateImage,
  });
  Object.defineProperty(window, 'SVGImageElement', {
    configurable: true,
    value: TestSvgImageElement,
  });
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

    const categoryButton = document.querySelector<HTMLButtonElement>(
      '[data-testid="complex-category-amazing-pools"]',
    );

    expect(categoryButton).not.toBeNull();
    vi.spyOn(categoryButton!, 'getBoundingClientRect').mockReturnValue({
      top: 104,
      left: 36,
      width: 82,
      height: 68,
      right: 118,
      bottom: 172,
      x: 36,
      y: 104,
      toJSON: () => ({}),
    });

    const selectionClick = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 48,
      clientY: 132,
    });

    expect(categoryButton!.dispatchEvent(selectionClick)).toBe(false);
    const selectedElement = getSelectedElementMessage(postMessageSpy);

    expect(selectedElement.displayText).toBe('@button "Amazing pools"');

    dispatchHostMessage(
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'capture_element_crop',
        requestId: 'complex-banner-capture',
        locator: selectedElement.element,
        format: 'image/png',
        padding: 8,
        maxBytes: 2_000_000,
        maxHeight: 1200,
        maxWidth: 1200,
      },
      window,
    );
    const captureMessage = await waitForCaptureMessage(
      postMessageSpy,
      'complex-banner-capture',
    );

    expect(captureMessage).toEqual(
      expect.objectContaining({
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'element_crop_captured',
        requestId: 'complex-banner-capture',
        result: expect.objectContaining({
          status: 'captured',
        }),
      }),
    );
    expect(drawImage).toHaveBeenCalled();
    expect(captureMessage).toEqual(
      expect.objectContaining({
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'element_crop_captured',
        requestId: 'complex-banner-capture',
        result: expect.objectContaining({
          status: 'captured',
          blob: expect.any(Blob),
          method: 'dom-rasterizer',
          mimeType: 'image/png',
        }),
      }),
    );
  } finally {
    await harness.unmount();
    Object.defineProperty(window, 'Image', {
      configurable: true,
      value: originalImage,
    });
    vi.unstubAllGlobals();
    getComputedStyleSpy.mockRestore();
    getContextSpy.mockRestore();
    toBlobSpy.mockRestore();
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
