import { initEmbeddedRuntimeTelemetry } from '../../inspector-runtime-core/src/embeddedRuntimeTelemetry';
import {
  initInspectorBridge,
  type InitInspectorBridgeOptions,
} from './bridgeRuntime';

type RuntimeTelemetryEvent =
  | 'console.error'
  | 'window.onerror'
  | 'unhandledrejection';

type RuntimeTelemetryMessage = {
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

type EmbeddedRuntimeTelemetryHostMessage = {
  channel: 'ara:embedded-runtime-telemetry';
  payload: RuntimeTelemetryMessage;
};

type EmbeddedRuntimeTelemetryHooks = {
  onTelemetryCaptured?: (message: RuntimeTelemetryMessage) => void;
  onTelemetryPosted?: (
    message: EmbeddedRuntimeTelemetryHostMessage,
  ) => void;
};

type InitEmbeddedRuntimeTelemetryOptions = {
  enabled: boolean;
  targetOrigin?: string;
  hooks?: EmbeddedRuntimeTelemetryHooks;
};

export type BootstrapEmbeddedInspectorBridgeOptions = {
  enabled: boolean;
  killSwitchActive?: boolean;
  hostOrigins?: readonly string[] | string;
  defaultHostOrigins?: readonly string[];
  mode?: InitInspectorBridgeOptions['mode'];
  capabilities?: InitInspectorBridgeOptions['capabilities'];
  runtimeConfig?: InitInspectorBridgeOptions['runtimeConfig'];
  adapterFactory?: InitInspectorBridgeOptions['adapterFactory'];
  telemetry?: InitInspectorBridgeOptions['telemetry'];
  runtimeTelemetry?: Omit<
    Partial<InitEmbeddedRuntimeTelemetryOptions>,
    'enabled'
  >;
};

export type InitDevEmbeddedInspectorBridgeOptions = Omit<
  Partial<BootstrapEmbeddedInspectorBridgeOptions>,
  'mode' | 'capabilities'
>;

type BootstrapEmbeddedInspectorBridge = {
  destroy: () => void;
};

const DEFAULT_BRIDGE_CAPABILITIES = ['tree', 'props', 'highlight'];
const DEFAULT_DEV_ALLOWED_HOST_ORIGINS = ['https://app.iteradev.ai'] as const;
const DEFAULT_DEV_EMBEDDED_BRIDGE_ENABLED = true;
const DEFAULT_DEV_EMBEDDED_BRIDGE_KILL_SWITCH_ACTIVE = false;

const toResolvedHostOrigins = (
  hostOrigins: BootstrapEmbeddedInspectorBridgeOptions['hostOrigins'],
  defaultHostOrigins: readonly string[],
) => {
  if (Array.isArray(hostOrigins)) {
    const resolvedHostOrigins = hostOrigins
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);

    return resolvedHostOrigins.length > 0
      ? resolvedHostOrigins
      : [...defaultHostOrigins];
  }

  if (typeof hostOrigins === 'string' && hostOrigins.length > 0) {
    const resolvedHostOrigins = hostOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);

    return resolvedHostOrigins.length > 0
      ? resolvedHostOrigins
      : [...defaultHostOrigins];
  }

  return [...defaultHostOrigins];
};

export const bootstrapEmbeddedInspectorBridge = (
  options: BootstrapEmbeddedInspectorBridgeOptions,
): BootstrapEmbeddedInspectorBridge => {
  const killSwitchActive = options.killSwitchActive === true;
  const resolvedHostOrigins = toResolvedHostOrigins(
    options.hostOrigins,
    options.defaultHostOrigins ?? [],
  );
  const bridge = initInspectorBridge({
    hostOrigins: resolvedHostOrigins,
    enabled: options.enabled,
    killSwitchActive,
    mode: options.mode ?? 'development',
    capabilities: options.capabilities ?? [...DEFAULT_BRIDGE_CAPABILITIES],
    runtimeConfig: options.runtimeConfig ?? {
      adapter: 'auto',
    },
    ...(options.adapterFactory !== undefined && {
      adapterFactory: options.adapterFactory,
    }),
    ...(options.telemetry !== undefined && {
      telemetry: options.telemetry,
    }),
  });
  const runtimeTelemetry = initEmbeddedRuntimeTelemetry({
    enabled: options.enabled && !killSwitchActive,
    ...options.runtimeTelemetry,
  });

  return {
    destroy: () => {
      runtimeTelemetry.destroy();
      bridge.destroy();
    },
  };
};

export const initDevEmbeddedInspectorBridge = (
  options: InitDevEmbeddedInspectorBridgeOptions = {},
) => {
  const killSwitchActive =
    options.killSwitchActive ?? DEFAULT_DEV_EMBEDDED_BRIDGE_KILL_SWITCH_ACTIVE;

  if (killSwitchActive) {
    console.warn(
      '[component-inspector] Embedded kill switch is active. Bridge is disabled.',
    );
  }

  return bootstrapEmbeddedInspectorBridge({
    hostOrigins: options.hostOrigins,
    defaultHostOrigins:
      options.defaultHostOrigins ?? DEFAULT_DEV_ALLOWED_HOST_ORIGINS,
    enabled: options.enabled ?? DEFAULT_DEV_EMBEDDED_BRIDGE_ENABLED,
    killSwitchActive,
    adapterFactory: options.adapterFactory,
    telemetry: options.telemetry,
    runtimeTelemetry: options.runtimeTelemetry,
    mode: 'development',
    capabilities: [...DEFAULT_BRIDGE_CAPABILITIES],
    runtimeConfig: {
      adapter: 'auto',
    },
  });
};
