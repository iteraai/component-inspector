const inspectorRuntimeMocks = vi.hoisted(() => {
  return {
    bridgeDestroySpy: vi.fn(),
    runtimeStopSpy: vi.fn(),
    bootstrapEmbeddedInspectorBridge: vi.fn(),
    bootIterationInspectorRuntime: vi.fn(),
  };
});

vi.mock('@iteraai/react-component-inspector/embeddedBootstrap', () => {
  return {
    bootstrapEmbeddedInspectorBridge:
      inspectorRuntimeMocks.bootstrapEmbeddedInspectorBridge,
  };
});

vi.mock('@iteraai/react-component-inspector/iterationInspector', () => {
  return {
    bootIterationInspectorRuntime:
      inspectorRuntimeMocks.bootIterationInspectorRuntime,
  };
});

import {
  bootIteraReactInspectorViteRuntime,
  stopIteraReactInspectorViteRuntime,
} from './client';

type FakeWindow = Window & {
  __ITERA_ITERATION_INSPECTOR_RUNTIME__?: {
    start: () => void;
    stop: () => void;
    isActive: () => boolean;
  };
  __dispatchEvent: (eventName: string) => void;
  __dispatchMessage: (
    data: unknown,
    options: {
      origin: string;
      source?: MessageEventSource | null;
    },
  ) => void;
  __dispatchedEvents: Event[];
  __listenerCount: (eventName: string) => number;
};

const createFakeWindow = (): FakeWindow => {
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  const dispatchedEvents: Event[] = [];

  const fakeWindow = {
    __dispatchedEvents: dispatchedEvents,
    addEventListener: vi.fn(
      (eventName: string, listener: EventListenerOrEventListenerObject) => {
        const eventListeners = listeners.get(eventName) ?? new Set();

        eventListeners.add(listener);
        listeners.set(eventName, eventListeners);
      },
    ),
    removeEventListener: vi.fn(
      (eventName: string, listener: EventListenerOrEventListenerObject) => {
        listeners.get(eventName)?.delete(listener);
      },
    ),
    __dispatchEvent: (eventName: string) => {
      listeners.get(eventName)?.forEach((listener) => {
        if (typeof listener === 'function') {
          listener(new Event(eventName));
          return;
        }

        listener.handleEvent(new Event(eventName));
      });
    },
    __dispatchMessage: (
      data: unknown,
      options: {
        origin: string;
        source?: MessageEventSource | null;
      },
    ) => {
      const event = new MessageEvent('message', {
        data,
        origin: options.origin,
        source: options.source ?? null,
      });

      listeners.get('message')?.forEach((listener) => {
        if (typeof listener === 'function') {
          listener(event);
          return;
        }

        listener.handleEvent(event);
      });
    },
    dispatchEvent: vi.fn((event: Event) => {
      dispatchedEvents.push(event);
      return true;
    }),
    __listenerCount: (eventName: string) => {
      return listeners.get(eventName)?.size ?? 0;
    },
  };

  return fakeWindow as unknown as FakeWindow;
};

const installFakeWindow = () => {
  const fakeWindow = createFakeWindow();

  vi.stubGlobal('window', fakeWindow);

  return fakeWindow;
};

describe('React inspector Vite client runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inspectorRuntimeMocks.bootstrapEmbeddedInspectorBridge.mockReturnValue({
      destroy: inspectorRuntimeMocks.bridgeDestroySpy,
    });
    inspectorRuntimeMocks.bootIterationInspectorRuntime.mockReturnValue({
      stop: inspectorRuntimeMocks.runtimeStopSpy,
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('does not start the inspector runtime when disabled', async () => {
    installFakeWindow();

    const stop = bootIteraReactInspectorViteRuntime({
      enabled: false,
      hostOrigins: ['https://app.iteradev.ai'],
      stateKey: '__TEST_DISABLED_BOOTSTRAP__',
    });

    await Promise.resolve();

    expect(
      inspectorRuntimeMocks.bootstrapEmbeddedInspectorBridge,
    ).not.toHaveBeenCalled();
    expect(
      inspectorRuntimeMocks.bootIterationInspectorRuntime,
    ).not.toHaveBeenCalled();

    stop();
  });

  test('warns and skips startup when no trusted host origins are configured', async () => {
    installFakeWindow();

    bootIteraReactInspectorViteRuntime({
      enabled: true,
      hostOrigins: [],
      stateKey: '__TEST_NO_ORIGINS_BOOTSTRAP__',
      warningPrefix: '[test-runtime]',
    });

    await Promise.resolve();

    expect(console.warn).toHaveBeenCalledWith(
      '[test-runtime] Inspector is enabled but no trusted host origins are configured.',
    );
    expect(
      inspectorRuntimeMocks.bootstrapEmbeddedInspectorBridge,
    ).not.toHaveBeenCalled();
  });

  test('starts the bridge and cleans up on dispose', async () => {
    const fakeWindow = installFakeWindow();
    const stop = bootIteraReactInspectorViteRuntime({
      enabled: true,
      hostOrigins: ['https://app.iteradev.ai'],
      stateKey: '__TEST_STARTED_BOOTSTRAP__',
    });

    expect(
      inspectorRuntimeMocks.bootstrapEmbeddedInspectorBridge,
    ).toHaveBeenCalledTimes(1);
    expect(
      inspectorRuntimeMocks.bootIterationInspectorRuntime,
    ).not.toHaveBeenCalled();
    expect(
      inspectorRuntimeMocks.bootstrapEmbeddedInspectorBridge,
    ).toHaveBeenCalledWith({
      enabled: true,
      hostOrigins: ['https://app.iteradev.ai'],
    });

    await vi.waitFor(() => {
      expect(
        inspectorRuntimeMocks.bootIterationInspectorRuntime,
      ).toHaveBeenCalledTimes(1);
    });

    expect(
      inspectorRuntimeMocks.bootIterationInspectorRuntime,
    ).toHaveBeenCalledTimes(1);
    expect(fakeWindow.__listenerCount('beforeunload')).toBe(1);

    stop();

    expect(inspectorRuntimeMocks.runtimeStopSpy).toHaveBeenCalledTimes(1);
    expect(inspectorRuntimeMocks.bridgeDestroySpy).toHaveBeenCalledTimes(1);
    expect(fakeWindow.__listenerCount('beforeunload')).toBe(0);
  });

  test('replays early inspector host messages after the bridge starts', async () => {
    const fakeWindow = installFakeWindow();

    inspectorRuntimeMocks.bootstrapEmbeddedInspectorBridge.mockImplementation(
      () => {
        fakeWindow.__dispatchMessage(
          {
            channel: 'itera-component-inspector',
            type: 'HELLO',
          },
          {
            origin: 'https://app.iteradev.ai/editor',
          },
        );

        return {
          destroy: inspectorRuntimeMocks.bridgeDestroySpy,
        };
      },
    );

    bootIteraReactInspectorViteRuntime({
      enabled: true,
      hostOrigins: ['https://app.iteradev.ai'],
      stateKey: '__TEST_EARLY_MESSAGE_BOOTSTRAP__',
    });

    await vi.waitFor(() => {
      expect(fakeWindow.__dispatchedEvents).toHaveLength(1);
    });

    const [replayedEvent] = fakeWindow.__dispatchedEvents;

    expect(replayedEvent).toBeInstanceOf(MessageEvent);
    expect((replayedEvent as MessageEvent).data).toStrictEqual({
      channel: 'itera-component-inspector',
      type: 'HELLO',
    });
    expect((replayedEvent as MessageEvent).origin).toBe(
      'https://app.iteradev.ai/editor',
    );
  });

  test('replays early JSON-string inspector host messages after the bridge starts', async () => {
    const fakeWindow = installFakeWindow();
    const serializedMessage = JSON.stringify({
      channel: 'itera-component-inspector',
      version: 1,
      type: 'HELLO',
      requestId: 'early-json-message',
    });

    inspectorRuntimeMocks.bootstrapEmbeddedInspectorBridge.mockImplementation(
      () => {
        fakeWindow.__dispatchMessage(serializedMessage, {
          origin: 'https://app.iteradev.ai/editor',
        });
        fakeWindow.__dispatchMessage('not json', {
          origin: 'https://app.iteradev.ai/editor',
        });
        fakeWindow.__dispatchMessage(
          JSON.stringify({
            channel: 'other-channel',
            type: 'HELLO',
          }),
          {
            origin: 'https://app.iteradev.ai/editor',
          },
        );

        return {
          destroy: inspectorRuntimeMocks.bridgeDestroySpy,
        };
      },
    );

    bootIteraReactInspectorViteRuntime({
      enabled: true,
      hostOrigins: ['https://app.iteradev.ai'],
      stateKey: '__TEST_EARLY_JSON_MESSAGE_BOOTSTRAP__',
    });

    await vi.waitFor(() => {
      expect(fakeWindow.__dispatchedEvents).toHaveLength(1);
    });

    const [replayedEvent] = fakeWindow.__dispatchedEvents;

    expect(replayedEvent).toBeInstanceOf(MessageEvent);
    expect((replayedEvent as MessageEvent).data).toBe(serializedMessage);
    expect((replayedEvent as MessageEvent).origin).toBe(
      'https://app.iteradev.ai/editor',
    );
  });

  test('keeps duplicate cleanup from stopping the active runtime', async () => {
    const fakeWindow = installFakeWindow();
    const stateKey = '__TEST_DOUBLE_BOOTSTRAP__';

    const firstStop = bootIteraReactInspectorViteRuntime({
      enabled: true,
      hostOrigins: ['https://app.iteradev.ai'],
      stateKey,
    });

    await vi.waitFor(() => {
      expect(
        inspectorRuntimeMocks.bootstrapEmbeddedInspectorBridge,
      ).toHaveBeenCalledTimes(1);
    });

    const secondStop = bootIteraReactInspectorViteRuntime({
      enabled: true,
      hostOrigins: ['https://app.iteradev.ai'],
      stateKey,
    });

    await vi.waitFor(() => {
      expect(
        inspectorRuntimeMocks.bootIterationInspectorRuntime,
      ).toHaveBeenCalledTimes(1);
    });

    expect(
      inspectorRuntimeMocks.bootstrapEmbeddedInspectorBridge,
    ).toHaveBeenCalledTimes(1);

    secondStop();

    expect(inspectorRuntimeMocks.runtimeStopSpy).not.toHaveBeenCalled();
    expect(inspectorRuntimeMocks.bridgeDestroySpy).not.toHaveBeenCalled();
    expect(fakeWindow.__listenerCount('beforeunload')).toBe(1);
    expect((fakeWindow as unknown as Record<string, unknown>)[stateKey]).toEqual(
      expect.objectContaining({
        started: true,
      }),
    );

    firstStop();

    expect(inspectorRuntimeMocks.runtimeStopSpy).toHaveBeenCalledTimes(1);
    expect(inspectorRuntimeMocks.bridgeDestroySpy).toHaveBeenCalledTimes(1);
    expect(fakeWindow.__listenerCount('beforeunload')).toBe(0);
  });

  test('keeps disabled and no-origin cleanup from stopping an active runtime', async () => {
    const fakeWindow = installFakeWindow();
    const stateKey = '__TEST_NOOP_CLEANUP_BOOTSTRAP__';
    const activeStop = bootIteraReactInspectorViteRuntime({
      enabled: true,
      hostOrigins: ['https://app.iteradev.ai'],
      stateKey,
    });

    await vi.waitFor(() => {
      expect(
        inspectorRuntimeMocks.bootIterationInspectorRuntime,
      ).toHaveBeenCalledTimes(1);
    });

    const disabledStop = bootIteraReactInspectorViteRuntime({
      enabled: false,
      hostOrigins: ['https://app.iteradev.ai'],
      stateKey,
    });
    const noOriginStop = bootIteraReactInspectorViteRuntime({
      enabled: true,
      hostOrigins: [],
      stateKey,
    });

    await Promise.resolve();
    disabledStop();
    noOriginStop();

    expect(inspectorRuntimeMocks.runtimeStopSpy).not.toHaveBeenCalled();
    expect(inspectorRuntimeMocks.bridgeDestroySpy).not.toHaveBeenCalled();
    expect(fakeWindow.__listenerCount('beforeunload')).toBe(1);
    expect((fakeWindow as unknown as Record<string, unknown>)[stateKey]).toEqual(
      expect.objectContaining({
        started: true,
      }),
    );

    activeStop();

    expect(inspectorRuntimeMocks.runtimeStopSpy).toHaveBeenCalledTimes(1);
    expect(inspectorRuntimeMocks.bridgeDestroySpy).toHaveBeenCalledTimes(1);
    expect(fakeWindow.__listenerCount('beforeunload')).toBe(0);
  });

  test('does not stop a manually owned iteration runtime on cleanup', async () => {
    const fakeWindow = installFakeWindow();
    const manualRuntime = {
      start: vi.fn(),
      stop: vi.fn(),
      isActive: vi.fn(() => true),
    };

    fakeWindow.__ITERA_ITERATION_INSPECTOR_RUNTIME__ = manualRuntime;
    inspectorRuntimeMocks.bootIterationInspectorRuntime.mockReturnValue(
      manualRuntime,
    );

    const stop = bootIteraReactInspectorViteRuntime({
      enabled: true,
      hostOrigins: ['https://app.iteradev.ai'],
      stateKey: '__TEST_MANUAL_RUNTIME_BOOTSTRAP__',
    });

    await vi.waitFor(() => {
      expect(
        inspectorRuntimeMocks.bootIterationInspectorRuntime,
      ).toHaveBeenCalledTimes(1);
    });

    stop();

    expect(manualRuntime.stop).not.toHaveBeenCalled();
    expect(inspectorRuntimeMocks.runtimeStopSpy).not.toHaveBeenCalled();
    expect(inspectorRuntimeMocks.bridgeDestroySpy).toHaveBeenCalledTimes(1);
    expect(fakeWindow.__ITERA_ITERATION_INSPECTOR_RUNTIME__).toBe(
      manualRuntime,
    );
    expect(fakeWindow.__listenerCount('beforeunload')).toBe(0);
  });

  test('allows external cleanup by state key', async () => {
    const fakeWindow = installFakeWindow();

    bootIteraReactInspectorViteRuntime({
      enabled: true,
      hostOrigins: ['https://app.iteradev.ai'],
      stateKey: '__TEST_EXTERNAL_STOP__',
    });

    await vi.waitFor(() => {
      expect(fakeWindow.__listenerCount('beforeunload')).toBe(1);
      expect(
        inspectorRuntimeMocks.bootIterationInspectorRuntime,
      ).toHaveBeenCalledTimes(1);
    });

    stopIteraReactInspectorViteRuntime({
      stateKey: '__TEST_EXTERNAL_STOP__',
    });

    expect(inspectorRuntimeMocks.runtimeStopSpy).toHaveBeenCalledTimes(1);
    expect(inspectorRuntimeMocks.bridgeDestroySpy).toHaveBeenCalledTimes(1);
    expect(fakeWindow.__listenerCount('beforeunload')).toBe(0);
  });
});
