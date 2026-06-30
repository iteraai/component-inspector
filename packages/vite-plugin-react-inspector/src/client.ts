import { INSPECTOR_CHANNEL } from '@iteraai/inspector-protocol';
import { bootstrapEmbeddedInspectorBridge } from '@iteraai/react-component-inspector/embeddedBootstrap';
import type { IterationInspectorRuntime } from '@iteraai/react-component-inspector/iterationInspector';

export type IteraReactInspectorViteRuntimeOptions = {
  enabled: boolean;
  hostOrigins: readonly string[];
  stateKey?: string;
  warningPrefix?: string;
};

type InspectorBridge = {
  destroy: () => void;
};

type BootstrapOwnerToken = symbol;

type BootstrapState =
  | {
      starting: true;
      started?: false;
      ownerToken: BootstrapOwnerToken;
      stop: () => void;
    }
  | {
      starting?: false;
      started: true;
      ownerToken: BootstrapOwnerToken;
      stop: () => void;
    };

type WindowWithInspectorRuntimeState = Window &
  Record<string, BootstrapState | undefined> & {
    __ITERA_ITERATION_INSPECTOR_RUNTIME__?: IterationInspectorRuntime;
  };

const DEFAULT_BOOTSTRAP_STATE_KEY = '__ITERA_REACT_INSPECTOR_VITE_BOOTSTRAP__';
const DEFAULT_WARNING_PREFIX = '[itera-vite-plugin-react-inspector]';

const toRuntimeWindow = (win: Window): WindowWithInspectorRuntimeState => {
  return win as WindowWithInspectorRuntimeState;
};

const resolveRuntimeOptions = (
  options: IteraReactInspectorViteRuntimeOptions,
) => {
  return {
    enabled: options.enabled,
    hostOrigins: options.hostOrigins,
    stateKey: options.stateKey ?? DEFAULT_BOOTSTRAP_STATE_KEY,
    warningPrefix: options.warningPrefix ?? DEFAULT_WARNING_PREFIX,
  };
};

const readBootstrapState = (
  win: Window,
  stateKey: string,
): BootstrapState | undefined => {
  return toRuntimeWindow(win)[stateKey];
};

const writeBootstrapState = (
  win: Window,
  stateKey: string,
  state: BootstrapState,
) => {
  toRuntimeWindow(win)[stateKey] = state;
};

const clearBootstrapState = (win: Window, stateKey: string) => {
  delete toRuntimeWindow(win)[stateKey];
};

const warn = (
  warningPrefix: string,
  message: string,
  error: unknown = undefined,
) => {
  if (error === undefined) {
    console.warn(`${warningPrefix} ${message}`);
    return;
  }

  console.warn(`${warningPrefix} ${message}`, error);
};

const stopActiveBootstrap = (
  win: Window,
  stateKey: string,
  ownerToken?: BootstrapOwnerToken,
) => {
  const state = readBootstrapState(win, stateKey);

  if (ownerToken !== undefined && state?.ownerToken !== ownerToken) {
    return;
  }

  if (typeof state?.stop === 'function') {
    state.stop();
    return;
  }

  if (state?.starting === true) {
    clearBootstrapState(win, stateKey);
  }
};

const resolveOrigin = (originOrUrl: string) => {
  try {
    return new URL(originOrUrl).origin;
  } catch {
    return undefined;
  }
};

const isTrustedOrigin = (
  origin: string,
  trustedOrigins: readonly string[],
) => {
  const resolvedOrigin = resolveOrigin(origin);

  return (
    resolvedOrigin !== undefined &&
    trustedOrigins.some((trustedOrigin) => {
      return resolveOrigin(trustedOrigin) === resolvedOrigin;
    })
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const toRawMessageObject = (
  rawMessage: unknown,
): Record<string, unknown> | undefined => {
  if (typeof rawMessage === 'string') {
    try {
      const parsedMessage = JSON.parse(rawMessage) as unknown;

      return isRecord(parsedMessage) ? parsedMessage : undefined;
    } catch {
      return undefined;
    }
  }

  return isRecord(rawMessage) ? rawMessage : undefined;
};

const isInspectorChannelMessage = (data: unknown) => {
  const messageObject = toRawMessageObject(data);

  return messageObject?.channel === INSPECTOR_CHANNEL;
};

const cloneMessageEvent = (event: MessageEvent) => {
  return new MessageEvent('message', {
    data: event.data,
    origin: event.origin,
    lastEventId: event.lastEventId,
    source: event.source,
    ports: [...event.ports],
  });
};

const createEarlyInspectorMessageQueue = (
  win: Window,
  trustedOrigins: readonly string[],
) => {
  const queuedEvents: MessageEvent[] = [];

  const onMessage = (event: MessageEvent) => {
    if (
      !isTrustedOrigin(event.origin, trustedOrigins) ||
      !isInspectorChannelMessage(event.data)
    ) {
      return;
    }

    queuedEvents.push(event);
  };

  win.addEventListener('message', onMessage);

  return {
    dispose: () => {
      win.removeEventListener('message', onMessage);
    },
    replay: () => {
      win.removeEventListener('message', onMessage);

      queuedEvents.forEach((event) => {
        win.dispatchEvent(cloneMessageEvent(event));
      });
      queuedEvents.length = 0;
    },
  };
};

const startRuntime = async (
  win: Window,
  options: ReturnType<typeof resolveRuntimeOptions>,
  ownerToken: BootstrapOwnerToken,
  isDisposed: () => boolean,
) => {
  const existingState = readBootstrapState(win, options.stateKey);

  if (existingState?.started === true || existingState?.starting === true) {
    return;
  }

  if (!options.enabled) {
    return;
  }

  if (options.hostOrigins.length === 0) {
    warn(
      options.warningPrefix,
      'Inspector is enabled but no trusted host origins are configured.',
    );
    return;
  }

  const earlyInspectorMessages = createEarlyInspectorMessageQueue(
    win,
    options.hostOrigins,
  );
  let bridge: InspectorBridge | undefined;
  let runtime: IterationInspectorRuntime | null | undefined;
  let ownsIterationRuntime = false;
  let stopped = false;

  const stop = () => {
    if (stopped) {
      return;
    }

    stopped = true;
    earlyInspectorMessages.dispose();
    win.removeEventListener('beforeunload', stop);
    if (ownsIterationRuntime) {
      runtime?.stop();
    }

    if (
      ownsIterationRuntime &&
      runtime !== null &&
      runtime !== undefined &&
      toRuntimeWindow(win).__ITERA_ITERATION_INSPECTOR_RUNTIME__ === runtime
    ) {
      delete toRuntimeWindow(win).__ITERA_ITERATION_INSPECTOR_RUNTIME__;
    }

    bridge?.destroy();

    if (readBootstrapState(win, options.stateKey)?.stop === stop) {
      clearBootstrapState(win, options.stateKey);
    }
  };

  writeBootstrapState(win, options.stateKey, {
    starting: true,
    ownerToken,
    stop,
  });
  win.addEventListener('beforeunload', stop);

  try {
    bridge = bootstrapEmbeddedInspectorBridge({
      enabled: true,
      hostOrigins: options.hostOrigins,
    });
    earlyInspectorMessages.replay();

    const iterationModule = await import(
      '@iteraai/react-component-inspector/iterationInspector'
    );

    if (isDisposed() || stopped) {
      stop();
      return;
    }

    const existingIterationRuntime =
      toRuntimeWindow(win).__ITERA_ITERATION_INSPECTOR_RUNTIME__;

    runtime = iterationModule.bootIterationInspectorRuntime();
    ownsIterationRuntime =
      runtime !== null &&
      runtime !== undefined &&
      runtime !== existingIterationRuntime;

    writeBootstrapState(win, options.stateKey, {
      started: true,
      ownerToken,
      stop,
    });
  } catch (error) {
    stop();

    warn(
      options.warningPrefix,
      'Failed to start the React inspector runtime.',
      error,
    );
  }
};

export const bootIteraReactInspectorViteRuntime = (
  options: IteraReactInspectorViteRuntimeOptions,
) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const resolvedOptions = resolveRuntimeOptions(options);
  const ownerToken = Symbol('iteraReactInspectorViteBootstrap');
  let disposed = false;

  void startRuntime(window, resolvedOptions, ownerToken, () => disposed);

  return () => {
    disposed = true;
    stopActiveBootstrap(window, resolvedOptions.stateKey, ownerToken);
  };
};

export const stopIteraReactInspectorViteRuntime = (
  options: Pick<IteraReactInspectorViteRuntimeOptions, 'stateKey'> = {},
) => {
  if (typeof window === 'undefined') {
    return;
  }

  stopActiveBootstrap(
    window,
    options.stateKey ?? DEFAULT_BOOTSTRAP_STATE_KEY,
  );
};
