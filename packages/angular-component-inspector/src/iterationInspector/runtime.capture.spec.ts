import { toBlob, toCanvas } from 'html-to-image';
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
  toCanvas: vi.fn(),
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

const getCapturePostCall = (
  postMessageSpy: ReturnType<typeof vi.spyOn>,
  requestId: string,
) => {
  return postMessageSpy.mock.calls.find(
    ([message]) => {
      if (typeof message !== 'object' || message === null) {
        return false;
      }

      const runtimeMessage = message as IterationInspectorRuntimeMessage;

      return (
        runtimeMessage.kind === 'element_crop_captured' &&
        'requestId' in runtimeMessage &&
        runtimeMessage.requestId === requestId
      );
    },
  );
};

const getRuntimeReadyMessage = (
  postMessageSpy: ReturnType<typeof vi.spyOn>,
) => {
  return getPostedMessages(postMessageSpy).find(
    (message) => message.kind === 'runtime_ready',
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
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve();
  }
};

const mockElementRect = (
  element: Element,
  overrides: Partial<DOMRect> = {},
) => {
  const top = overrides.top ?? 12;
  const left = overrides.left ?? 24;
  const width = overrides.width ?? 120;
  const height = overrides.height ?? 40;

  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    top,
    left,
    width,
    height,
    right: overrides.right ?? left + width,
    bottom: overrides.bottom ?? top + height,
    x: overrides.x ?? left,
    y: overrides.y ?? top,
    toJSON: () => ({}),
  });
};

const givenCaptureRuntime = (
  options: {
    hostOrigins?: readonly string[];
  } = {},
): CaptureRuntimeContext => {
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
    hostOrigins: options.hostOrigins ?? ['https://itera.example'],
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
    maxHeight?: number;
    maxBytes?: number;
    maxWidth?: number;
    origin?: string;
    padding?: number;
    requestId?: string;
  } = {},
) => {
  const {
    maxBytes = 1024 * 1024,
    maxHeight,
    maxWidth,
    origin = 'https://itera.example',
    padding,
    requestId = 'capture-request',
  } = options;

  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'capture_element_crop',
        requestId,
        locator,
        format: 'image/png',
        maxBytes,
        maxHeight,
        maxWidth,
        padding,
      },
      origin,
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

describe('iteration inspector runtime element capture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(toBlob).mockResolvedValue(
      new Blob(['mock-png'], { type: 'image/png' }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
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
    expect(getCapturePostCall(context.postMessageSpy, 'dom-capture')?.[1]).toBe(
      'https://itera.example',
    );

    context.runtime.stop();
  });

  test('uses text selection bounds when capturing a text locator', async () => {
    window.history.replaceState({}, '', '/capture-demo');
    document.body.innerHTML =
      '<p id="capture-text">Selected text inside a larger paragraph.</p>';
    const target = document.getElementById('capture-text');
    expect(target).not.toBeNull();
    assert(target instanceof HTMLParagraphElement);
    mockElementRect(target, {
      height: 80,
      left: 20,
      top: 10,
      width: 200,
    });
    const staleTextBounds = {
      height: 12,
      left: 72,
      top: 46,
      width: 40,
    };
    const currentTextBounds = {
      height: 16,
      left: 32,
      top: 18,
      width: 64,
    };
    vi.spyOn(document, 'createRange').mockReturnValue({
      getBoundingClientRect: vi.fn(() => ({
        ...currentTextBounds,
        bottom: currentTextBounds.top + currentTextBounds.height,
        right: currentTextBounds.left + currentTextBounds.width,
        x: currentTextBounds.left,
        y: currentTextBounds.top,
        toJSON: () => ({}),
      })),
      selectNodeContents: vi.fn(),
    } as unknown as Range);
    const sourceCanvas = document.createElement('canvas');
    const drawImage = vi.fn();
    vi.mocked(toCanvas).mockResolvedValue(sourceCanvas);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      function toBlob(callback: BlobCallback) {
        callback(new Blob(['text-crop'], { type: 'image/png' }));
      },
    );
    const locator: IterationElementLocator = {
      ...buildIterationElementSelection(target).element,
      bounds: staleTextBounds,
      role: 'text',
    };
    const postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);
    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
      hostOrigins: ['https://itera.example'],
    });
    runtime.start();

    requestCapture(locator, { requestId: 'text-capture' });
    await flushCapture();

    expect(toBlob).not.toHaveBeenCalled();
    expect(toCanvas).toHaveBeenCalledWith(
      target,
      expect.objectContaining({
        height: 80,
        pixelRatio: 1,
        width: 200,
      }),
    );
    expect(drawImage).toHaveBeenCalledWith(
      sourceCanvas,
      12,
      8,
      64,
      16,
      0,
      0,
      64,
      16,
    );
    expect(getCaptureMessage(postMessageSpy, 'text-capture')).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'text-capture',
        result: expect.objectContaining({
          height: 16,
          method: 'dom-rasterizer',
          rect: currentTextBounds,
          status: 'captured',
          width: 64,
        }),
      }),
    );

    runtime.stop();
  });

  test('returns oversize for text captures inside oversized parents', async () => {
    window.history.replaceState({}, '', '/capture-demo');
    document.body.innerHTML =
      '<p id="capture-text">Selected text inside a very large parent.</p>';
    const target = document.getElementById('capture-text');
    expect(target).not.toBeNull();
    assert(target instanceof HTMLParagraphElement);
    mockElementRect(target, {
      height: 5000,
      left: 20,
      top: 10,
      width: 5000,
    });
    const currentTextBounds = {
      height: 16,
      left: 32,
      top: 18,
      width: 64,
    };
    vi.spyOn(document, 'createRange').mockReturnValue({
      getBoundingClientRect: vi.fn(() => ({
        ...currentTextBounds,
        bottom: currentTextBounds.top + currentTextBounds.height,
        right: currentTextBounds.left + currentTextBounds.width,
        x: currentTextBounds.left,
        y: currentTextBounds.top,
        toJSON: () => ({}),
      })),
      selectNodeContents: vi.fn(),
    } as unknown as Range);
    const locator: IterationElementLocator = {
      ...buildIterationElementSelection(target).element,
      bounds: currentTextBounds,
      role: 'text',
    };
    const postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);
    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
      hostOrigins: ['https://itera.example'],
    });
    runtime.start();

    requestCapture(locator, { requestId: 'text-source-oversize' });
    await flushCapture();

    expect(toCanvas).not.toHaveBeenCalled();
    expect(toBlob).not.toHaveBeenCalled();
    expect(getCaptureMessage(postMessageSpy, 'text-source-oversize')).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'text-source-oversize',
        result: expect.objectContaining({
          reason: 'oversize',
          status: 'failed',
        }),
      }),
    );

    runtime.stop();
  });

  test('suppresses async capture responses after the runtime stops', async () => {
    const context = givenCaptureRuntime();
    let resolveBlob: ((blob: Blob) => void) | undefined;
    vi.mocked(toBlob).mockReturnValue(
      new Promise((resolve) => {
        resolveBlob = resolve;
      }),
    );

    requestCapture(context.locator, { requestId: 'stopped-capture' });
    await flushCapture();

    expect(toBlob).toHaveBeenCalledTimes(1);

    context.runtime.stop();
    resolveBlob?.(new Blob(['late-png'], { type: 'image/png' }));
    await flushCapture();

    expect(
      getCaptureMessage(context.postMessageSpy, 'stopped-capture'),
    ).toBeUndefined();

    context.runtime.stop();
  });

  test('suppresses async capture responses after route changes', async () => {
    const context = givenCaptureRuntime();
    let resolveBlob: ((blob: Blob) => void) | undefined;
    vi.mocked(toBlob).mockReturnValue(
      new Promise((resolve) => {
        resolveBlob = resolve;
      }),
    );

    requestCapture(context.locator, { requestId: 'route-change-capture' });
    await flushCapture();

    expect(toBlob).toHaveBeenCalledTimes(1);

    window.history.pushState({}, '', '/after-capture-route');
    resolveBlob?.(new Blob(['late-png'], { type: 'image/png' }));
    await flushCapture();

    expect(
      getCaptureMessage(context.postMessageSpy, 'route-change-capture'),
    ).toBeUndefined();

    context.runtime.stop();
  });

  test('suppresses async capture responses after pagehide', async () => {
    const context = givenCaptureRuntime();
    let resolveBlob: ((blob: Blob) => void) | undefined;
    vi.mocked(toBlob).mockReturnValue(
      new Promise((resolve) => {
        resolveBlob = resolve;
      }),
    );

    requestCapture(context.locator, { requestId: 'pagehide-capture' });
    await flushCapture();

    expect(toBlob).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('pagehide'));
    resolveBlob?.(new Blob(['late-png'], { type: 'image/png' }));
    await flushCapture();

    expect(
      getCaptureMessage(context.postMessageSpy, 'pagehide-capture'),
    ).toBeUndefined();

    context.runtime.stop();
  });

  test('does not rasterize element captures for opaque parent origins', async () => {
    const context = givenCaptureRuntime();

    requestCapture(context.locator, {
      origin: 'null',
      requestId: 'opaque-origin-capture',
    });
    await flushCapture();

    expect(toBlob).not.toHaveBeenCalled();
    expect(
      getCaptureMessage(context.postMessageSpy, 'opaque-origin-capture'),
    ).toBeUndefined();

    context.runtime.stop();
  });

  test('does not rasterize element captures for untrusted parent origins', async () => {
    const context = givenCaptureRuntime({
      hostOrigins: ['https://itera.example'],
    });

    requestCapture(context.locator, {
      origin: 'https://attacker.example',
      requestId: 'untrusted-origin-capture',
    });
    await flushCapture();

    expect(toBlob).not.toHaveBeenCalled();
    expect(
      getCaptureMessage(context.postMessageSpy, 'untrusted-origin-capture'),
    ).toBeUndefined();

    requestCapture(context.locator, {
      origin: 'https://itera.example',
      requestId: 'trusted-origin-capture',
    });
    await flushCapture();

    expect(toBlob).toHaveBeenCalledTimes(1);
    expect(getCaptureMessage(context.postMessageSpy, 'trusted-origin-capture')).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'trusted-origin-capture',
        result: expect.objectContaining({
          status: 'captured',
        }),
      }),
    );

    context.runtime.stop();
  });

  test('does not advertise or rasterize element captures without trusted host origins', async () => {
    const context = givenCaptureRuntime({
      hostOrigins: [],
    });

    expect(getRuntimeReadyMessage(context.postMessageSpy)).toEqual(
      expect.objectContaining({
        kind: 'runtime_ready',
        capabilities: ['preview_edits_v1'],
      }),
    );

    requestCapture(context.locator, {
      requestId: 'missing-allowlist-capture',
    });
    await flushCapture();

    expect(toBlob).not.toHaveBeenCalled();
    expect(getCaptureMessage(
      context.postMessageSpy,
      'missing-allowlist-capture',
    )).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'missing-allowlist-capture',
        result: expect.objectContaining({
          status: 'unavailable',
          reason: 'unsupported_target',
          detail: 'Element capture requires configured trusted host origins.',
        }),
      }),
    );

    context.runtime.stop();
  });

  test('does not advertise element capture for unnormalizable host origins', async () => {
    const context = givenCaptureRuntime({
      hostOrigins: ['localhost:4173', 'not a url'],
    });

    expect(getRuntimeReadyMessage(context.postMessageSpy)).toEqual(
      expect.objectContaining({
        kind: 'runtime_ready',
        capabilities: ['preview_edits_v1'],
      }),
    );

    requestCapture(context.locator, {
      requestId: 'invalid-allowlist-capture',
    });
    await flushCapture();

    expect(toBlob).not.toHaveBeenCalled();
    expect(getCaptureMessage(
      context.postMessageSpy,
      'invalid-allowlist-capture',
    )).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'invalid-allowlist-capture',
        result: expect.objectContaining({
          status: 'unavailable',
          reason: 'unsupported_target',
          detail: 'Element capture requires configured trusted host origins.',
        }),
      }),
    );

    context.runtime.stop();
  });

  test('strictly enforces max capture dimensions', async () => {
    const context = givenCaptureRuntime();
    vi.mocked(context.target.getBoundingClientRect).mockReturnValue({
      top: 12,
      left: 24,
      width: 10_000,
      height: 5_000,
      right: 10_024,
      bottom: 5_012,
      x: 24,
      y: 12,
      toJSON: () => ({}),
    });

    requestCapture(context.locator, {
      maxHeight: 3,
      maxWidth: 4,
      requestId: 'clamped-capture',
    });
    await flushCapture();

    expect(toBlob).toHaveBeenCalledWith(
      context.target,
      expect.objectContaining({
        pixelRatio: 0.0004,
      }),
    );
    expect(getCaptureMessage(context.postMessageSpy, 'clamped-capture')).toEqual(
      expect.objectContaining({
        result: expect.objectContaining({
          status: 'captured',
          width: 4,
          height: 2,
        }),
      }),
    );

    context.runtime.stop();
  });

  test('returns unsupported_target for padded DOM rasterizer captures', async () => {
    const context = givenCaptureRuntime();

    requestCapture(context.locator, {
      padding: 8,
      requestId: 'padded-dom-capture',
    });
    await flushCapture();

    expect(toBlob).not.toHaveBeenCalled();
    expect(getCaptureMessage(context.postMessageSpy, 'padded-dom-capture')).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'padded-dom-capture',
        result: expect.objectContaining({
          status: 'failed',
          reason: 'unsupported_target',
          detail: 'Padding is not supported for DOM rasterizer captures in this POC.',
        }),
      }),
    );

    context.runtime.stop();
  });

  test('returns dom_rasterization_failed when DOM rasterization times out', async () => {
    vi.useFakeTimers();
    vi.mocked(toBlob).mockReturnValue(new Promise(() => {}));
    const context = givenCaptureRuntime();

    requestCapture(context.locator, { requestId: 'timeout-capture' });
    await vi.advanceTimersByTimeAsync(10_000);
    await flushCapture();

    expect(getCaptureMessage(context.postMessageSpy, 'timeout-capture')).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'timeout-capture',
        result: expect.objectContaining({
          status: 'failed',
          reason: 'dom_rasterization_failed',
          detail: 'DOM rasterization timed out after 10000ms.',
        }),
      }),
    );

    context.runtime.stop();
    vi.useRealTimers();
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

  test('returns oversize before rasterizing captures above the default pixel cap', async () => {
    const context = givenCaptureRuntime();
    mockElementRect(context.target, {
      width: 5_000,
      height: 5_000,
    });

    requestCapture(context.locator, {
      requestId: 'pixel-cap-capture',
    });
    await flushCapture();

    expect(toBlob).not.toHaveBeenCalled();
    expect(getCaptureMessage(context.postMessageSpy, 'pixel-cap-capture')).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'pixel-cap-capture',
        result: expect.objectContaining({
          status: 'failed',
          reason: 'oversize',
          urlPath: '/capture-demo?view=inspector#target',
        }),
      }),
    );

    context.runtime.stop();
  });

  test('preserves object-fit cover cropping for image captures', async () => {
    window.history.replaceState({}, '', '/capture-demo');
    document.body.innerHTML =
      '<img id="capture-image" style="object-fit: cover; object-position: 25% 75%;" />';
    const image = document.getElementById('capture-image');
    expect(image).not.toBeNull();
    assert(image instanceof HTMLImageElement);
    mockElementRect(image);
    Object.defineProperty(image, 'complete', {
      configurable: true,
      value: true,
    });
    Object.defineProperty(image, 'naturalWidth', {
      configurable: true,
      value: 300,
    });
    Object.defineProperty(image, 'naturalHeight', {
      configurable: true,
      value: 300,
    });
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      function toBlob(callback: BlobCallback) {
        callback(new Blob(['image-crop'], { type: 'image/png' }));
      },
    );
    const postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);
    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
      hostOrigins: ['https://itera.example'],
    });
    runtime.start();
    const locator = buildIterationElementSelection(image).element;

    requestCapture(locator, { requestId: 'styled-image-capture' });
    await flushCapture();

    expect(drawImage).toHaveBeenCalledWith(
      image,
      0,
      150,
      300,
      100,
      0,
      0,
      120,
      40,
    );
    expect(getCaptureMessage(postMessageSpy, 'styled-image-capture')).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'styled-image-capture',
        result: expect.objectContaining({
          status: 'captured',
          method: 'image',
        }),
      }),
    );

    runtime.stop();
  });

  test('preserves vertical-first object-position values for image captures', async () => {
    window.history.replaceState({}, '', '/capture-demo');
    document.body.innerHTML =
      '<img id="capture-image" style="object-fit: cover; object-position: top 25%;" />';
    const image = document.getElementById('capture-image');
    expect(image).not.toBeNull();
    assert(image instanceof HTMLImageElement);
    mockElementRect(image);
    Object.defineProperty(image, 'complete', {
      configurable: true,
      value: true,
    });
    Object.defineProperty(image, 'naturalWidth', {
      configurable: true,
      value: 300,
    });
    Object.defineProperty(image, 'naturalHeight', {
      configurable: true,
      value: 300,
    });
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      function toBlob(callback: BlobCallback) {
        callback(new Blob(['image-crop'], { type: 'image/png' }));
      },
    );
    const postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);
    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
      hostOrigins: ['https://itera.example'],
    });
    runtime.start();
    const locator = buildIterationElementSelection(image).element;

    requestCapture(locator, { requestId: 'vertical-first-image-capture' });
    await flushCapture();

    expect(drawImage).toHaveBeenCalledWith(
      image,
      0,
      0,
      300,
      100,
      0,
      0,
      120,
      40,
    );
    expect(getCaptureMessage(postMessageSpy, 'vertical-first-image-capture')).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'vertical-first-image-capture',
        result: expect.objectContaining({
          status: 'captured',
          method: 'image',
        }),
      }),
    );

    runtime.stop();
  });

  test('uses DOM rasterization for edge-offset object-position image captures', async () => {
    window.history.replaceState({}, '', '/capture-demo');
    document.body.innerHTML =
      '<img id="capture-image" style="object-fit: cover; object-position: right 10px bottom 20px;" />';
    const image = document.getElementById('capture-image');
    expect(image).not.toBeNull();
    assert(image instanceof HTMLImageElement);
    mockElementRect(image);
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D);
    const postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);
    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
      hostOrigins: ['https://itera.example'],
    });
    runtime.start();
    const locator = buildIterationElementSelection(image).element;

    requestCapture(locator, { requestId: 'edge-offset-image-capture' });
    await flushCapture();

    expect(getContext).not.toHaveBeenCalled();
    expect(toBlob).toHaveBeenCalledWith(
      image,
      expect.objectContaining({
        cacheBust: true,
        pixelRatio: 1,
        type: 'image/png',
      }),
    );
    expect(getCaptureMessage(postMessageSpy, 'edge-offset-image-capture')).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'edge-offset-image-capture',
        result: expect.objectContaining({
          status: 'captured',
          method: 'dom-rasterizer',
        }),
      }),
    );

    runtime.stop();
  });

  test('uses DOM rasterization for clipped image captures', async () => {
    window.history.replaceState({}, '', '/capture-demo');
    document.body.innerHTML =
      '<img id="capture-image" style="border-radius: 12px; object-fit: cover; object-position: 25% 75%;" />';
    const image = document.getElementById('capture-image');
    expect(image).not.toBeNull();
    assert(image instanceof HTMLImageElement);
    mockElementRect(image);
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D);
    const postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);
    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
      hostOrigins: ['https://itera.example'],
    });
    runtime.start();
    const locator = buildIterationElementSelection(image).element;

    requestCapture(locator, { requestId: 'clipped-image-capture' });
    await flushCapture();

    expect(getContext).not.toHaveBeenCalled();
    expect(toBlob).toHaveBeenCalledWith(
      image,
      expect.objectContaining({
        cacheBust: true,
        pixelRatio: 1,
        type: 'image/png',
      }),
    );
    expect(getCaptureMessage(postMessageSpy, 'clipped-image-capture')).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'clipped-image-capture',
        result: expect.objectContaining({
          status: 'captured',
          method: 'dom-rasterizer',
        }),
      }),
    );

    runtime.stop();
  });

  test('uses DOM rasterization for bordered and padded image captures', async () => {
    window.history.replaceState({}, '', '/capture-demo');
    document.body.innerHTML =
      '<img id="capture-image" style="border: 4px solid red; padding: 6px; object-fit: cover;" />';
    const image = document.getElementById('capture-image');
    expect(image).not.toBeNull();
    assert(image instanceof HTMLImageElement);
    mockElementRect(image);
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D);
    const postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);
    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
      hostOrigins: ['https://itera.example'],
    });
    runtime.start();
    const locator = buildIterationElementSelection(image).element;

    requestCapture(locator, { requestId: 'box-styled-image-capture' });
    await flushCapture();

    expect(getContext).not.toHaveBeenCalled();
    expect(toBlob).toHaveBeenCalledWith(
      image,
      expect.objectContaining({
        cacheBust: true,
        pixelRatio: 1,
        type: 'image/png',
      }),
    );
    expect(getCaptureMessage(postMessageSpy, 'box-styled-image-capture')).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'box-styled-image-capture',
        result: expect.objectContaining({
          status: 'captured',
          method: 'dom-rasterizer',
        }),
      }),
    );

    runtime.stop();
  });

  test('uses DOM rasterization for transformed image captures', async () => {
    window.history.replaceState({}, '', '/capture-demo');
    document.body.innerHTML =
      '<img id="capture-image" style="object-fit: cover; transform: rotate(15deg);" />';
    const image = document.getElementById('capture-image');
    expect(image).not.toBeNull();
    assert(image instanceof HTMLImageElement);
    mockElementRect(image);
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D);
    const postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);
    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
      hostOrigins: ['https://itera.example'],
    });
    runtime.start();
    const locator = buildIterationElementSelection(image).element;

    requestCapture(locator, { requestId: 'transformed-image-capture' });
    await flushCapture();

    expect(getContext).not.toHaveBeenCalled();
    expect(toBlob).toHaveBeenCalledWith(
      image,
      expect.objectContaining({
        cacheBust: true,
        pixelRatio: 1,
        type: 'image/png',
      }),
    );
    expect(getCaptureMessage(postMessageSpy, 'transformed-image-capture')).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'transformed-image-capture',
        result: expect.objectContaining({
          status: 'captured',
          method: 'dom-rasterizer',
        }),
      }),
    );

    runtime.stop();
  });

  test('uses DOM rasterization for background-styled image captures', async () => {
    window.history.replaceState({}, '', '/capture-demo');
    document.body.innerHTML =
      '<img id="capture-image" style="object-fit: contain; background-color: red;" />';
    const image = document.getElementById('capture-image');
    expect(image).not.toBeNull();
    assert(image instanceof HTMLImageElement);
    mockElementRect(image);
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D);
    const postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);
    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
      hostOrigins: ['https://itera.example'],
    });
    runtime.start();
    const locator = buildIterationElementSelection(image).element;

    requestCapture(locator, { requestId: 'background-image-capture' });
    await flushCapture();

    expect(getContext).not.toHaveBeenCalled();
    expect(toBlob).toHaveBeenCalledWith(
      image,
      expect.objectContaining({
        cacheBust: true,
        pixelRatio: 1,
        type: 'image/png',
      }),
    );
    expect(getCaptureMessage(postMessageSpy, 'background-image-capture')).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'background-image-capture',
        result: expect.objectContaining({
          status: 'captured',
          method: 'dom-rasterizer',
        }),
      }),
    );

    runtime.stop();
  });

  test('uses DOM rasterization for box-shadow image captures', async () => {
    window.history.replaceState({}, '', '/capture-demo');
    document.body.innerHTML =
      '<img id="capture-image" style="object-fit: contain; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);" />';
    const image = document.getElementById('capture-image');
    expect(image).not.toBeNull();
    assert(image instanceof HTMLImageElement);
    mockElementRect(image);
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D);
    const postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);
    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
      hostOrigins: ['https://itera.example'],
    });
    runtime.start();
    const locator = buildIterationElementSelection(image).element;

    requestCapture(locator, { requestId: 'shadow-image-capture' });
    await flushCapture();

    expect(getContext).not.toHaveBeenCalled();
    expect(toBlob).toHaveBeenCalledWith(
      image,
      expect.objectContaining({
        cacheBust: true,
        pixelRatio: 1,
        type: 'image/png',
      }),
    );
    expect(getCaptureMessage(postMessageSpy, 'shadow-image-capture')).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'shadow-image-capture',
        result: expect.objectContaining({
          status: 'captured',
          method: 'dom-rasterizer',
        }),
      }),
    );

    runtime.stop();
  });

  test('uses DOM rasterization for styled canvas captures', async () => {
    window.history.replaceState({}, '', '/capture-demo');
    document.body.innerHTML =
      '<canvas id="capture-canvas" style="border: 4px solid red; border-radius: 12px; transform: rotate(15deg);"></canvas>';
    const canvas = document.getElementById('capture-canvas');
    expect(canvas).not.toBeNull();
    assert(canvas instanceof HTMLCanvasElement);
    mockElementRect(canvas);
    canvas.toBlob = vi.fn((callback: BlobCallback) => {
      callback(new Blob(['native-canvas'], { type: 'image/png' }));
    });
    const postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);
    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
      hostOrigins: ['https://itera.example'],
    });
    runtime.start();
    const locator = buildIterationElementSelection(canvas).element;

    requestCapture(locator, { requestId: 'styled-canvas-capture' });
    await flushCapture();

    expect(canvas.toBlob).not.toHaveBeenCalled();
    expect(toBlob).toHaveBeenCalledWith(
      canvas,
      expect.objectContaining({
        cacheBust: true,
        pixelRatio: 1,
        type: 'image/png',
      }),
    );
    expect(getCaptureMessage(postMessageSpy, 'styled-canvas-capture')).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'styled-canvas-capture',
        result: expect.objectContaining({
          status: 'captured',
          method: 'dom-rasterizer',
        }),
      }),
    );

    runtime.stop();
  });

  test('uses DOM rasterization for object-fit canvas captures', async () => {
    window.history.replaceState({}, '', '/capture-demo');
    document.body.innerHTML =
      '<canvas id="capture-canvas" style="width: 120px; height: 120px; object-fit: contain; object-position: right bottom;"></canvas>';
    const canvas = document.getElementById('capture-canvas');
    expect(canvas).not.toBeNull();
    assert(canvas instanceof HTMLCanvasElement);
    mockElementRect(canvas);
    canvas.toBlob = vi.fn((callback: BlobCallback) => {
      callback(new Blob(['native-canvas'], { type: 'image/png' }));
    });
    const postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);
    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
      hostOrigins: ['https://itera.example'],
    });
    runtime.start();
    const locator = buildIterationElementSelection(canvas).element;

    requestCapture(locator, { requestId: 'object-fit-canvas-capture' });
    await flushCapture();

    expect(canvas.toBlob).not.toHaveBeenCalled();
    expect(toBlob).toHaveBeenCalledWith(
      canvas,
      expect.objectContaining({
        cacheBust: true,
        pixelRatio: 1,
        type: 'image/png',
      }),
    );
    expect(
      getCaptureMessage(postMessageSpy, 'object-fit-canvas-capture'),
    ).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'object-fit-canvas-capture',
        result: expect.objectContaining({
          status: 'captured',
          method: 'dom-rasterizer',
        }),
      }),
    );

    runtime.stop();
  });

  test('uses DOM rasterization for background-styled canvas captures', async () => {
    window.history.replaceState({}, '', '/capture-demo');
    document.body.innerHTML =
      '<canvas id="capture-canvas" style="background-color: red;"></canvas>';
    const canvas = document.getElementById('capture-canvas');
    expect(canvas).not.toBeNull();
    assert(canvas instanceof HTMLCanvasElement);
    mockElementRect(canvas);
    canvas.toBlob = vi.fn((callback: BlobCallback) => {
      callback(new Blob(['native-canvas'], { type: 'image/png' }));
    });
    const postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);
    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
      hostOrigins: ['https://itera.example'],
    });
    runtime.start();
    const locator = buildIterationElementSelection(canvas).element;

    requestCapture(locator, { requestId: 'background-canvas-capture' });
    await flushCapture();

    expect(canvas.toBlob).not.toHaveBeenCalled();
    expect(toBlob).toHaveBeenCalledWith(
      canvas,
      expect.objectContaining({
        cacheBust: true,
        pixelRatio: 1,
        type: 'image/png',
      }),
    );
    expect(getCaptureMessage(postMessageSpy, 'background-canvas-capture')).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'background-canvas-capture',
        result: expect.objectContaining({
          status: 'captured',
          method: 'dom-rasterizer',
        }),
      }),
    );

    runtime.stop();
  });

  test('uses DOM rasterization for box-shadow canvas captures', async () => {
    window.history.replaceState({}, '', '/capture-demo');
    document.body.innerHTML =
      '<canvas id="capture-canvas" style="box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);"></canvas>';
    const canvas = document.getElementById('capture-canvas');
    expect(canvas).not.toBeNull();
    assert(canvas instanceof HTMLCanvasElement);
    mockElementRect(canvas);
    canvas.toBlob = vi.fn((callback: BlobCallback) => {
      callback(new Blob(['native-canvas'], { type: 'image/png' }));
    });
    const postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);
    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
      hostOrigins: ['https://itera.example'],
    });
    runtime.start();
    const locator = buildIterationElementSelection(canvas).element;

    requestCapture(locator, { requestId: 'shadow-canvas-capture' });
    await flushCapture();

    expect(canvas.toBlob).not.toHaveBeenCalled();
    expect(toBlob).toHaveBeenCalledWith(
      canvas,
      expect.objectContaining({
        cacheBust: true,
        pixelRatio: 1,
        type: 'image/png',
      }),
    );
    expect(getCaptureMessage(postMessageSpy, 'shadow-canvas-capture')).toEqual(
      expect.objectContaining({
        kind: 'element_crop_captured',
        requestId: 'shadow-canvas-capture',
        result: expect.objectContaining({
          status: 'captured',
          method: 'dom-rasterizer',
        }),
      }),
    );

    runtime.stop();
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
      hostOrigins: ['https://itera.example'],
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
