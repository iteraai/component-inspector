import {
  initEmbeddedRuntimeTelemetry,
  type InitEmbeddedRuntimeTelemetryOptions,
} from './embeddedRuntimeTelemetry';
import {
  initInspectorBridge,
  type InitInspectorBridgeOptions,
} from './bridgeRuntime';
import { installDevtoolsInlineBackendHook } from './devtoolsInlineBackendHook';
import { resolveConfiguredHostOrigins } from './hostOrigins';

type WindowWithDevtoolsInlineMenuHook = Window & {
  __REACT_DEVTOOLS_GLOBAL_HOOK__?: {
    on?: (event: string, handler: () => void) => void;
  };
};

export type BootstrapEmbeddedInspectorBridgeOptions = {
  enabled: boolean;
  killSwitchActive?: boolean;
  hostOrigins?: readonly string[] | string;
  defaultHostOrigins?: readonly string[];
  mode?: InitInspectorBridgeOptions['mode'];
  capabilities?: InitInspectorBridgeOptions['capabilities'];
  runtimeConfig?: InitInspectorBridgeOptions['runtimeConfig'];
  installInlineBackendHook?: boolean;
  inlineBackendHookInitializedFlagKey?: string;
  inlineMenuReadyHandlerRegisteredFlagKey?: string;
  adapterFactory?: InitInspectorBridgeOptions['adapterFactory'];
  telemetry?: InitInspectorBridgeOptions['telemetry'];
  runtimeTelemetry?: Omit<
    Partial<InitEmbeddedRuntimeTelemetryOptions>,
    'enabled'
  >;
};

export type InitDevEmbeddedInspectorBridgeOptions = Omit<
  Partial<BootstrapEmbeddedInspectorBridgeOptions>,
  'mode' | 'capabilities' | 'runtimeConfig'
>;

const DEFAULT_INLINE_MENU_READY_HANDLER_REGISTERED_FLAG_KEY =
  '__araInlineMenuReadyHandlerRegistered';
const DEFAULT_BRIDGE_CAPABILITIES = ['tree', 'props', 'highlight'];
const DEFAULT_DEV_EMBEDDED_BRIDGE_ENABLED = true;
const DEFAULT_DEV_EMBEDDED_BRIDGE_KILL_SWITCH_ACTIVE = false;
const DEFAULT_DEV_ALLOWED_HOST_ORIGINS = ['https://app.iteradev.ai'] as const;
const DEFAULT_DEV_INLINE_BACKEND_HOOK_INITIALIZED_FLAG_KEY =
  '__iteraDevtoolsInlineBackendHookInitialized';
const DEFAULT_DEV_INLINE_MENU_READY_HANDLER_REGISTERED_FLAG_KEY =
  '__iteraRegisteredInlineMenuReadyHandler';

const registerInlineMenuReadyNoopHandler = (flagKey: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  const windowWithHook = window as unknown as WindowWithDevtoolsInlineMenuHook &
    Record<string, unknown>;

  if (windowWithHook[flagKey] === true) {
    return;
  }

  const devtoolsHook = windowWithHook.__REACT_DEVTOOLS_GLOBAL_HOOK__;

  if (typeof devtoolsHook?.on !== 'function') {
    return;
  }

  try {
    devtoolsHook.on('inline-menu-ready', () => undefined);
    windowWithHook[flagKey] = true;
  } catch {
    // Keep bootstrap resilient if hook event registration changes.
  }
};

export const bootstrapEmbeddedInspectorBridge = (
  options: BootstrapEmbeddedInspectorBridgeOptions,
) => {
  const killSwitchActive = options.killSwitchActive === true;
  const shouldInitializeInlineHook =
    options.installInlineBackendHook !== false &&
    options.enabled &&
    !killSwitchActive;

  if (shouldInitializeInlineHook) {
    installDevtoolsInlineBackendHook({
      enabled: true,
      initializedFlagKey: options.inlineBackendHookInitializedFlagKey,
    });

    registerInlineMenuReadyNoopHandler(
      options.inlineMenuReadyHandlerRegisteredFlagKey ??
        DEFAULT_INLINE_MENU_READY_HANDLER_REGISTERED_FLAG_KEY,
    );
  }

  const resolvedHostOrigins = resolveConfiguredHostOrigins(
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
      adapter: 'fiber',
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
    installInlineBackendHook: options.installInlineBackendHook,
    inlineBackendHookInitializedFlagKey:
      options.inlineBackendHookInitializedFlagKey ??
      DEFAULT_DEV_INLINE_BACKEND_HOOK_INITIALIZED_FLAG_KEY,
    inlineMenuReadyHandlerRegisteredFlagKey:
      options.inlineMenuReadyHandlerRegisteredFlagKey ??
      DEFAULT_DEV_INLINE_MENU_READY_HANDLER_REGISTERED_FLAG_KEY,
    adapterFactory: options.adapterFactory,
    telemetry: options.telemetry,
    runtimeTelemetry: options.runtimeTelemetry,
    mode: 'development',
    capabilities: [...DEFAULT_BRIDGE_CAPABILITIES],
    runtimeConfig: {
      adapter: 'fiber',
    },
  });
};
