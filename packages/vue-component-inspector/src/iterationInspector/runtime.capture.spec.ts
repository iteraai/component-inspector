import { toBlob } from 'html-to-image';
import {
  ITERATION_INSPECTOR_CHANNEL,
  type IterationElementLocator,
  type IterationInspectorRuntimeMessage,
} from './types';
import {
  buildIterationElementSelection,
  createIterationInspectorRuntime,
} from './index';

vi.mock('html-to-image', () => ({
  toBlob: vi.fn(),
}));

type CaptureRuntimeContext = {
  postMessageSpy: ReturnType<typeof vi.spyOn>;
  runtime: ReturnType<typeof createIterationInspectorRuntime>;
  target: HTMLDivElement;
  locator: IterationElementLocator;
};

const getPostedMessages = (
  postMessageSpy: ReturnType<typeof vi.spyOn>,
): IterationInspectorRuntimeMessage[] => {
  return postMessageSpy.mock.calls.flatMap(([message]) => {
    return typeof message === 'object' && message !== null
      ? [message as IterationInspectorRuntimeMessage]
      : [];
  });
};

const getCaptureMessage = (
  postMessageSpy: ReturnType<typeof vi.spyOn>,
  requestId: string,
) => {
  return getPostedMessages(postMessageSpy).find(
    (message) =>
      message.kind === 'element_crop_captured' &&
      message.requestId === requestId,
  );
};

const getSelectedLocator = (
  postMessageSpy: ReturnType<typeof vi.spyOn>,
): IterationElementLocator => {
  const selectionMessage = getPostedMessages(postMessageSpy).find(
    (
      message,
    ): message is Extract<
      IterationInspectorRuntimeMessage,
      {
        kind: 'element_selected';
      }
    > => message.kind === 'element_selected',
  );

  expect(selectionMessage).not.toBeUndefined();
  return selectionMessage!.selection.element;
};

const flushCapture = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const mockElementRect = (element: Element) => {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    top: 12,
    left: 24,
    width: 120,
    height: 40,
    right: 144,
    bottom: 52,
    x: 24,
    y: 12,
    toJSON: () => ({}),
  });
};

const givenCaptureRuntime = (): CaptureRuntimeContext => {
  window.history.replaceState({}, '', '/capture-demo?view=inspector#target');
  document.body.innerHTML = `
    <main>
      <div id="capture-target" data-testid="capture-card">
        <strong>Selected</strong> capture target
      </div>
    </main>
  `;

  const target = document.getElementById('capture-target');
  expect(target).not.toBeNull();
  assert(target instanceof HTMLDivElement);
  mockElementRect(target);

  const postMessageSpy = vi
    .spyOn(window, 'postMessage')
    .mockImplementation(() => undefined);
  const runtime = createIterationInspectorRuntime({
    allowSelfMessaging: true,
  });
  runtime.start();

  return {
    locator: buildIterationElementSelection(target).element,
    postMessageSpy,
    runtime,
    target,
  };
};

const requestCapture = (
  locator: IterationElementLocator,
  options: {
    maxBytes?: number;
    requestId?: string;
  } = {},
) => {
  const { maxBytes = 1024 * 1024, requestId = 'capture-request' } = options;

  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'capture_element_crop',
        requestId,
        locator,
        format: 'image/png',
        maxBytes,
      },
      origin: 'https://itera.example',
      source: window,
    }),
  );
};

const selectCaptureTarget = (target: HTMLElement) => {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'enter_select_mode',
      },
      origin: 'https://itera.example',
      source: window,
    }),
  );
  target.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 32,
      clientY: 24,
    }),
  );
};

describe('vue iteration inspector runtime element capture', () => {
  beforeEach(() => {
    vi.mocked(toBlob).mockResolvedValue(
      new Blob(['mock-png'], { type: 'image/png' }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('advertises element capture capability when the runtime starts', () => {
    const context = givenCaptureRuntime();

    expect(getPostedMessages(context.postMessageSpy)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'runtime_ready',
          capabilities: expect.arrayContaining(['element_capture_v1']),
        }),
      ]),
    );

    context.runtime.stop();
  });

  test('captures a selected DOM element through the runtime and returns a Blob response', async () => {
    const context = givenCaptureRuntime();
    selectCaptureTarget(context.target);
    const selectedLocator = getSelectedLocator(context.postMessageSpy);

    requestCapture(selectedLocator, { requestId: 'dom-capture' });
    await flushCapture();

    expect(toBlob).toHaveBeenCalledWith(
      context.target,
      expect.objectContaining({
        cacheBust: true,
        pixelRatio: 1,
      }),
    );

    expect(getCaptureMessage(context.postMessageSpy, 'dom-capture')).toEqual(
      expect.objectContaining({
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'element_crop_captured',
        requestId: 'dom-capture',
        result: expect.objectContaining({
          status: 'captured',
          blob: expect.any(Blob),
          mimeType: 'image/png',
          width: 120,
          height: 40,
          method: 'dom-rasterizer',
          rect: {
            top: 12,
            left: 24,
            width: 120,
            height: 40,
          },
          scrollOffset: {
            x: 0,
            y: 0,
          },
          devicePixelRatio: 1,
          urlPath: '/capture-demo?view=inspector#target',
        }),
      }),
    );

    context.runtime.stop();
  });

  test('returns locator_not_found when the selected element cannot be re-resolved', async () => {
    const context = givenCaptureRuntime();
    context.target.remove();

    requestCapture(context.locator, { requestId: 'missing-target' });
    await flushCapture();

    expect(getCaptureMessage(context.postMessageSpy, 'missing-target')).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'missing-target',
        result: expect.objectContaining({
          status: 'failed',
          reason: 'locator_not_found',
          urlPath: '/capture-demo?view=inspector#target',
        }),
      }),
    );

    context.runtime.stop();
  });

  test('returns url_mismatch when the locator belongs to another page', async () => {
    const context = givenCaptureRuntime();

    requestCapture(
      {
        ...context.locator,
        urlPath: '/other-route',
      },
      { requestId: 'wrong-url' },
    );
    await flushCapture();

    expect(getCaptureMessage(context.postMessageSpy, 'wrong-url')).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'wrong-url',
        result: expect.objectContaining({
          status: 'failed',
          reason: 'url_mismatch',
          urlPath: '/capture-demo?view=inspector#target',
        }),
      }),
    );

    context.runtime.stop();
  });

  test('returns oversize when the captured Blob exceeds maxBytes', async () => {
    vi.mocked(toBlob).mockResolvedValue(
      new Blob(['larger-than-limit'], { type: 'image/png' }),
    );
    const context = givenCaptureRuntime();

    requestCapture(context.locator, {
      maxBytes: 4,
      requestId: 'oversize-capture',
    });
    await flushCapture();

    expect(getCaptureMessage(context.postMessageSpy, 'oversize-capture')).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'oversize-capture',
        result: expect.objectContaining({
          status: 'failed',
          reason: 'oversize',
          urlPath: '/capture-demo?view=inspector#target',
        }),
      }),
    );

    context.runtime.stop();
  });

  test('returns canvas_tainted when canvas export cannot produce a Blob', async () => {
    window.history.replaceState({}, '', '/capture-demo');
    document.body.innerHTML = '<canvas id="capture-canvas"></canvas>';
    const canvas = document.getElementById('capture-canvas');
    expect(canvas).not.toBeNull();
    assert(canvas instanceof HTMLCanvasElement);
    mockElementRect(canvas);
    Object.defineProperty(canvas, 'width', {
      configurable: true,
      value: 120,
    });
    Object.defineProperty(canvas, 'height', {
      configurable: true,
      value: 40,
    });
    canvas.toBlob = vi.fn((callback: BlobCallback) => {
      callback(null);
    });

    const postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);
    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
    });
    runtime.start();
    const locator = buildIterationElementSelection(canvas).element;

    requestCapture(locator, { requestId: 'tainted-canvas' });
    await flushCapture();

    expect(getCaptureMessage(postMessageSpy, 'tainted-canvas')).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'tainted-canvas',
        result: expect.objectContaining({
          status: 'failed',
          reason: 'canvas_tainted',
          urlPath: '/capture-demo',
        }),
      }),
    );

    runtime.stop();
  });
});
