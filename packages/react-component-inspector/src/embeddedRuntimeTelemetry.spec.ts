import {
  EMBEDDED_RUNTIME_TELEMETRY_CHANNEL,
  initEmbeddedRuntimeTelemetry,
  resolveEmbeddedRuntimeTelemetryTargetOrigin,
} from './embeddedRuntimeTelemetry';

type ActiveTelemetryHandle = ReturnType<typeof initEmbeddedRuntimeTelemetry>;

let activeTelemetry: ActiveTelemetryHandle | undefined;

const setDocumentReferrer = (value: string) => {
  vi.spyOn(document, 'referrer', 'get').mockReturnValue(value);
};

const expectTelemetryPostedTo = (
  targetOrigin: string,
  postMessageSpy: ReturnType<typeof vi.spyOn>,
) => {
  expect(postMessageSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      channel: EMBEDDED_RUNTIME_TELEMETRY_CHANNEL,
      payload: expect.objectContaining({
        type: 'runtime_telemetry',
        event: 'console.error',
        message: 'boom',
      }),
    }),
    targetOrigin,
  );
};

describe('embeddedRuntimeTelemetry', () => {
  afterEach(() => {
    activeTelemetry?.destroy();
    activeTelemetry = undefined;
    vi.restoreAllMocks();
  });

  test('resolves explicit concrete target origins without a referrer', () => {
    expect(
      resolveEmbeddedRuntimeTelemetryTargetOrigin(
        'https://editor.iteradev.ai/embed',
      ),
    ).toBe('https://editor.iteradev.ai');
  });

  test('resolves relative target origins against a concrete referrer origin', () => {
    expect(
      resolveEmbeddedRuntimeTelemetryTargetOrigin(
        '/telemetry',
        'https://editor.iteradev.ai/preview/frame',
      ),
    ).toBe('https://editor.iteradev.ai');
  });

  test('returns undefined when an explicit target origin is not concrete', () => {
    expect(
      resolveEmbeddedRuntimeTelemetryTargetOrigin(
        '*',
        'https://editor.iteradev.ai/preview/frame',
      ),
    ).toBeUndefined();
    expect(
      resolveEmbeddedRuntimeTelemetryTargetOrigin('/telemetry'),
    ).toBeUndefined();
  });

  test('returns undefined when a referrer-derived origin cannot be resolved', () => {
    expect(resolveEmbeddedRuntimeTelemetryTargetOrigin()).toBeUndefined();
    expect(
      resolveEmbeddedRuntimeTelemetryTargetOrigin(undefined, 'not a url'),
    ).toBeUndefined();
    expect(
      resolveEmbeddedRuntimeTelemetryTargetOrigin(undefined, 'about:blank'),
    ).toBeUndefined();
  });

  test('skips cross-window telemetry posting when no concrete target origin can be resolved', () => {
    setDocumentReferrer('');

    const originalConsoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const postMessageSpy = vi
      .spyOn(window.parent, 'postMessage')
      .mockImplementation(() => {});
    const onTelemetryCaptured = vi.fn();
    const onTelemetryPosted = vi.fn();

    activeTelemetry = initEmbeddedRuntimeTelemetry({
      enabled: true,
      hooks: {
        onTelemetryCaptured,
        onTelemetryPosted,
      },
    });

    console.error('boom');

    expect(originalConsoleErrorSpy).toHaveBeenCalledWith('boom');
    expect(onTelemetryCaptured).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'runtime_telemetry',
        event: 'console.error',
        message: 'boom',
      }),
    );
    expect(postMessageSpy).not.toHaveBeenCalled();
    expect(onTelemetryPosted).not.toHaveBeenCalled();
  });

  test('posts telemetry when an explicit concrete target origin is configured', () => {
    const postMessageSpy = vi
      .spyOn(window.parent, 'postMessage')
      .mockImplementation(() => {});
    const onTelemetryPosted = vi.fn();

    vi.spyOn(console, 'error').mockImplementation(() => {});

    activeTelemetry = initEmbeddedRuntimeTelemetry({
      enabled: true,
      targetOrigin: 'https://editor.iteradev.ai/embed',
      hooks: {
        onTelemetryPosted,
      },
    });

    console.error('boom');

    expectTelemetryPostedTo('https://editor.iteradev.ai', postMessageSpy);
    expect(onTelemetryPosted).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: EMBEDDED_RUNTIME_TELEMETRY_CHANNEL,
      }),
    );
  });

  test('posts telemetry when a concrete referrer-derived origin exists', () => {
    setDocumentReferrer('https://preview.iteradev.ai/editor/frame');

    const postMessageSpy = vi
      .spyOn(window.parent, 'postMessage')
      .mockImplementation(() => {});

    vi.spyOn(console, 'error').mockImplementation(() => {});

    activeTelemetry = initEmbeddedRuntimeTelemetry({
      enabled: true,
    });

    console.error('boom');

    expectTelemetryPostedTo('https://preview.iteradev.ai', postMessageSpy);
  });
});
