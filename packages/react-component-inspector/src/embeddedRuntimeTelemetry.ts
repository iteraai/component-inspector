import {
  EMBEDDED_RUNTIME_TELEMETRY_CHANNEL as SHARED_EMBEDDED_RUNTIME_TELEMETRY_CHANNEL,
  initEmbeddedRuntimeTelemetry as initSharedEmbeddedRuntimeTelemetry,
  isEmbeddedRuntimeTelemetryHostMessage as isSharedEmbeddedRuntimeTelemetryHostMessage,
  resolveEmbeddedRuntimeTelemetryTargetOrigin as resolveSharedEmbeddedRuntimeTelemetryTargetOrigin,
} from '../../inspector-runtime-core/src/embeddedRuntimeTelemetry';

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
  SHARED_EMBEDDED_RUNTIME_TELEMETRY_CHANNEL;

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

export const resolveEmbeddedRuntimeTelemetryTargetOrigin = (
  targetOrigin?: string,
  referrer?: string,
): string | undefined => {
  return resolveSharedEmbeddedRuntimeTelemetryTargetOrigin(
    targetOrigin,
    referrer,
  );
};

export const isEmbeddedRuntimeTelemetryHostMessage = (
  value: unknown,
): value is EmbeddedRuntimeTelemetryHostMessage => {
  return isSharedEmbeddedRuntimeTelemetryHostMessage(value);
};

export const initEmbeddedRuntimeTelemetry = (
  options: InitEmbeddedRuntimeTelemetryOptions,
): EmbeddedRuntimeTelemetry => {
  return initSharedEmbeddedRuntimeTelemetry(options);
};
