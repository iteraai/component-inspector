export type RuntimeTelemetryEvent =
  | 'console.error'
  | 'window.onerror'
  | 'unhandledrejection';

export type RuntimeTelemetryMessage = {
  type: 'runtime_telemetry';
  event: RuntimeTelemetryEvent;
  message: string;
  page_url?: string;
  source_url?: string;
  line_number?: number;
  column_number?: number;
  stack?: string;
  details?: string[];
  client_timestamp_ms: number;
};

export const EMBEDDED_RUNTIME_TELEMETRY_CHANNEL =
  'ara:embedded-runtime-telemetry';

export type EmbeddedRuntimeTelemetryHostMessage = {
  channel: typeof EMBEDDED_RUNTIME_TELEMETRY_CHANNEL;
  payload: RuntimeTelemetryMessage;
};

export type EmbeddedRuntimeTelemetryHooks = {
  onTelemetryCaptured?: (message: RuntimeTelemetryMessage) => void;
  onTelemetryPosted?: (message: EmbeddedRuntimeTelemetryHostMessage) => void;
};

export type InitEmbeddedRuntimeTelemetryOptions = {
  enabled: boolean;
  targetOrigin?: string;
  hooks?: EmbeddedRuntimeTelemetryHooks;
};

type EmbeddedRuntimeTelemetry = {
  destroy: () => void;
};

type ErrorLike = {
  name?: unknown;
  message?: unknown;
  stack?: unknown;
};

const MAX_URL_LENGTH = 2_000;
const MAX_MESSAGE_LENGTH = 500;
const MAX_STACK_LENGTH = 4_000;
const MAX_DETAIL_COUNT = 5;
const MAX_DETAIL_LENGTH = 500;

let activeEmbeddedRuntimeTelemetry: EmbeddedRuntimeTelemetry | undefined;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const truncateText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 3) {
    return value.slice(0, maxLength);
  }

  return `${value.slice(0, maxLength - 3)}...`;
};

const toBoundedInlineText = (value: string | undefined, maxLength: number) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim().replaceAll(/\s+/g, ' ');

  if (normalizedValue.length === 0) {
    return undefined;
  }

  return truncateText(normalizedValue, maxLength);
};

const toBoundedMultilineText = (
  value: string | undefined,
  maxLength: number,
) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    return undefined;
  }

  return truncateText(normalizedValue, maxLength);
};

const isErrorLike = (value: unknown): value is ErrorLike => {
  return typeof value === 'object' && value !== null;
};

const toErrorLikeMessage = (value: ErrorLike | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const message = typeof value.message === 'string' ? value.message.trim() : '';

  if (name.length > 0 && message.length > 0) {
    return message.startsWith(`${name}:`) ? message : `${name}: ${message}`;
  }

  if (message.length > 0) {
    return message;
  }

  return name.length > 0 ? name : undefined;
};

const toErrorLikeStack = (value: ErrorLike | undefined) => {
  if (value === undefined || typeof value.stack !== 'string') {
    return undefined;
  }

  return toBoundedMultilineText(value.stack, MAX_STACK_LENGTH);
};

const createCircularReplacer = () => {
  const seen = new WeakSet<object>();

  return (_key: string, value: unknown) => {
    if (typeof value === 'bigint') {
      return `${value}n`;
    }

    if (typeof value === 'function') {
      return `[Function ${value.name || 'anonymous'}]`;
    }

    if (typeof value === 'symbol') {
      return value.toString();
    }

    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }

      seen.add(value);
    }

    return value;
  };
};

const serializeRuntimeValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  const errorLikeMessage = isErrorLike(value)
    ? toErrorLikeMessage(value)
    : undefined;

  if (errorLikeMessage !== undefined) {
    return errorLikeMessage;
  }

  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'undefined';
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }

  if (typeof value === 'symbol') {
    return value.toString();
  }

  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }

  try {
    const serializedValue = JSON.stringify(value, createCircularReplacer());

    if (typeof serializedValue === 'string') {
      return serializedValue;
    }
  } catch {
    // Fall through to String() so telemetry capture stays non-throwing.
  }

  try {
    return String(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
};

const toNonNegativeInteger = (value: unknown) => {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    return undefined;
  }

  return value;
};

const readCurrentPageUrl = () => {
  try {
    return window.location.href;
  } catch {
    return undefined;
  }
};

const readDocumentReferrer = () => {
  if (typeof document === 'undefined') {
    return undefined;
  }

  return document.referrer;
};

const createRuntimeTelemetryMessage = (
  event: RuntimeTelemetryEvent,
  message: string,
): RuntimeTelemetryMessage => {
  const pageUrl = toBoundedMultilineText(readCurrentPageUrl(), MAX_URL_LENGTH);

  return {
    type: 'runtime_telemetry',
    event,
    message,
    ...(pageUrl !== undefined && {
      page_url: pageUrl,
    }),
    client_timestamp_ms: Date.now(),
  };
};

const toConsoleErrorTelemetryMessage = (
  args: unknown[],
): RuntimeTelemetryMessage | undefined => {
  const errorLikeArgument = args.find((entry) => isErrorLike(entry));
  const primaryArgument = args[0];
  const fallbackMessage = args
    .map((entry) => serializeRuntimeValue(entry))
    .find((entry) => entry.trim().length > 0);
  const primaryMessage = toBoundedInlineText(
    typeof primaryArgument === 'string'
      ? primaryArgument
      : (toErrorLikeMessage(
          isErrorLike(primaryArgument) ? primaryArgument : undefined,
        ) ??
          toErrorLikeMessage(errorLikeArgument) ??
          fallbackMessage),
    MAX_MESSAGE_LENGTH,
  );

  if (primaryMessage === undefined) {
    return undefined;
  }

  const details = args
    .map((entry) =>
      toBoundedInlineText(serializeRuntimeValue(entry), MAX_DETAIL_LENGTH),
    )
    .filter((entry): entry is string => entry !== undefined)
    .filter((entry, index) => {
      return !(index === 0 && entry === primaryMessage);
    })
    .slice(0, MAX_DETAIL_COUNT);

  const stack = toErrorLikeStack(errorLikeArgument);

  return {
    ...createRuntimeTelemetryMessage('console.error', primaryMessage),
    ...(stack !== undefined && {
      stack,
    }),
    ...(details.length > 0 && {
      details,
    }),
  };
};

const toWindowErrorTelemetryMessage = (
  event: Event,
): RuntimeTelemetryMessage | undefined => {
  const errorEvent = event as ErrorEvent & {
    error?: unknown;
  };
  const errorLikeValue = isErrorLike(errorEvent.error)
    ? errorEvent.error
    : undefined;
  const message = toBoundedInlineText(
    typeof errorEvent.message === 'string'
      ? errorEvent.message
      : toErrorLikeMessage(errorLikeValue),
    MAX_MESSAGE_LENGTH,
  );

  if (message === undefined) {
    return undefined;
  }

  const sourceUrl = toBoundedMultilineText(
    typeof errorEvent.filename === 'string' ? errorEvent.filename : undefined,
    MAX_URL_LENGTH,
  );
  const stack = toErrorLikeStack(errorLikeValue);
  const lineNumber = toNonNegativeInteger(errorEvent.lineno);
  const columnNumber = toNonNegativeInteger(errorEvent.colno);

  return {
    ...createRuntimeTelemetryMessage('window.onerror', message),
    ...(sourceUrl !== undefined && {
      source_url: sourceUrl,
    }),
    ...(lineNumber !== undefined && {
      line_number: lineNumber,
    }),
    ...(columnNumber !== undefined && {
      column_number: columnNumber,
    }),
    ...(stack !== undefined && {
      stack,
    }),
  };
};

const toUnhandledRejectionTelemetryMessage = (
  event: PromiseRejectionEvent | (Event & { reason?: unknown }),
): RuntimeTelemetryMessage | undefined => {
  const reason = event.reason;
  const errorLikeReason = isErrorLike(reason) ? reason : undefined;
  const message = toBoundedInlineText(
    typeof reason === 'string'
      ? reason
      : (toErrorLikeMessage(errorLikeReason) ?? serializeRuntimeValue(reason)),
    MAX_MESSAGE_LENGTH,
  );

  if (message === undefined) {
    return undefined;
  }

  const stack = toErrorLikeStack(errorLikeReason);

  return {
    ...createRuntimeTelemetryMessage('unhandledrejection', message),
    ...(stack !== undefined && {
      stack,
    }),
  };
};

const invokeHook = <T>(
  callback: ((value: T) => void) | undefined,
  value: T,
) => {
  if (callback === undefined) {
    return;
  }

  try {
    callback(value);
  } catch {
    // Keep runtime telemetry side effects isolated from hook consumers.
  }
};

const isConcreteTargetOrigin = (origin: string | undefined): origin is string => {
  return (
    typeof origin === 'string' &&
    origin.length > 0 &&
    origin !== '*' &&
    origin !== 'null'
  );
};

const toResolvedTargetOrigin = (
  rawTargetOrigin: string,
  referrer: string | undefined,
) => {
  const normalizedReferrer = referrer?.trim();
  const normalizedTargetOrigin = rawTargetOrigin.trim();

  if (!isConcreteTargetOrigin(normalizedTargetOrigin)) {
    return undefined;
  }

  try {
    const resolvedOrigin =
      normalizedReferrer !== undefined && normalizedReferrer.length > 0
        ? new URL(normalizedTargetOrigin, normalizedReferrer).origin
        : new URL(normalizedTargetOrigin).origin;

    return isConcreteTargetOrigin(resolvedOrigin)
      ? resolvedOrigin
      : undefined;
  } catch {
    return undefined;
  }
};

export const resolveEmbeddedRuntimeTelemetryTargetOrigin = (
  targetOrigin?: string,
  referrer = readDocumentReferrer(),
): string | undefined => {
  const normalizedTargetOrigin = targetOrigin?.trim();
  const normalizedReferrer = referrer?.trim();

  if (
    normalizedTargetOrigin !== undefined &&
    normalizedTargetOrigin.length > 0
  ) {
    return toResolvedTargetOrigin(normalizedTargetOrigin, normalizedReferrer);
  }

  if (normalizedReferrer === undefined || normalizedReferrer.length === 0) {
    return undefined;
  }

  return toResolvedTargetOrigin(normalizedReferrer, undefined);
};

const toEmbeddedRuntimeTelemetryHostMessage = (
  payload: RuntimeTelemetryMessage,
): EmbeddedRuntimeTelemetryHostMessage => {
  return {
    channel: EMBEDDED_RUNTIME_TELEMETRY_CHANNEL,
    payload,
  };
};

export const isEmbeddedRuntimeTelemetryHostMessage = (
  value: unknown,
): value is EmbeddedRuntimeTelemetryHostMessage => {
  if (!isRecord(value)) {
    return false;
  }

  if (value.channel !== EMBEDDED_RUNTIME_TELEMETRY_CHANNEL) {
    return false;
  }

  const payload = value.payload;

  if (!isRecord(payload)) {
    return false;
  }

  return payload.type === 'runtime_telemetry';
};

export const initEmbeddedRuntimeTelemetry = (
  options: InitEmbeddedRuntimeTelemetryOptions,
): EmbeddedRuntimeTelemetry => {
  if (activeEmbeddedRuntimeTelemetry !== undefined) {
    activeEmbeddedRuntimeTelemetry.destroy();
  }

  if (typeof window === 'undefined' || !options.enabled) {
    activeEmbeddedRuntimeTelemetry = {
      destroy: () => {
        activeEmbeddedRuntimeTelemetry = undefined;
      },
    };

    return activeEmbeddedRuntimeTelemetry;
  }

  const resolvedTargetOrigin = resolveEmbeddedRuntimeTelemetryTargetOrigin(
    options.targetOrigin,
  );
  const originalConsoleError = console.error;

  const postTelemetryToParent = (message: RuntimeTelemetryMessage) => {
    if (resolvedTargetOrigin === undefined) {
      return;
    }

    const parentMessage = toEmbeddedRuntimeTelemetryHostMessage(message);

    try {
      window.parent.postMessage(parentMessage, resolvedTargetOrigin);
      invokeHook(options.hooks?.onTelemetryPosted, parentMessage);
    } catch {
      // Keep telemetry capture best-effort and non-throwing.
    }
  };

  const captureMessage = (message: RuntimeTelemetryMessage | undefined) => {
    if (message === undefined) {
      return;
    }

    invokeHook(options.hooks?.onTelemetryCaptured, message);
    postTelemetryToParent(message);
  };

  const wrappedConsoleError: typeof console.error = (...args) => {
    try {
      originalConsoleError.apply(console, args);
    } finally {
      captureMessage(toConsoleErrorTelemetryMessage(args));
    }
  };

  const handleWindowError = (event: Event) => {
    captureMessage(toWindowErrorTelemetryMessage(event));
  };

  const handleUnhandledRejection = (
    event: PromiseRejectionEvent | (Event & { reason?: unknown }),
  ) => {
    captureMessage(toUnhandledRejectionTelemetryMessage(event));
  };

  console.error = wrappedConsoleError;
  window.addEventListener('error', handleWindowError);
  window.addEventListener(
    'unhandledrejection',
    handleUnhandledRejection as EventListener,
  );

  activeEmbeddedRuntimeTelemetry = {
    destroy: () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener(
        'unhandledrejection',
        handleUnhandledRejection as EventListener,
      );

      if (console.error === wrappedConsoleError) {
        console.error = originalConsoleError;
      }

      activeEmbeddedRuntimeTelemetry = undefined;
    },
  };

  return activeEmbeddedRuntimeTelemetry;
};
