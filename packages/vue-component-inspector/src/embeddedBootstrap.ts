import type { App } from 'vue';
import { initEmbeddedRuntimeTelemetry } from '../../react-component-inspector/src/embeddedRuntimeTelemetry';
import {
  initInspectorBridge,
  type InitInspectorBridgeOptions,
} from './bridgeRuntime';
import {
  defaultVueMountedAppRegistry,
  registerMountedVueApp,
  resolveMountedVueAppContainer,
  resolveVueMountContainer,
  type RegisterMountedVueAppOptions,
  type VueInspectorRuntimeConfig,
  type VueMountedAppContainer,
  type VueMountedAppRegistration,
  type VueMountedAppRegistry,
} from './adapters/base';

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

type VueAppWithMount = App & {
  mount: (containerOrSelector: string | VueMountedAppContainer) => unknown;
};

export type RegisterVueAppOnMountOptions = RegisterMountedVueAppOptions & {
  registry?: VueMountedAppRegistry;
  root?: ParentNode;
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

export type BootstrapEmbeddedInspectorBridgeOnMountOptions =
  BootstrapEmbeddedInspectorBridgeOptions & {
    appRegistration?: Omit<RegisterVueAppOnMountOptions, 'registry'>;
  };

export type InitDevEmbeddedInspectorBridgeOptions = Omit<
  Partial<BootstrapEmbeddedInspectorBridgeOptions>,
  'mode' | 'capabilities'
>;

export type InitDevEmbeddedInspectorBridgeOnMountOptions = Omit<
  Partial<BootstrapEmbeddedInspectorBridgeOnMountOptions>,
  'mode' | 'capabilities'
>;

type VueMountedAppHookRegistration = {
  options: RegisterVueAppOnMountOptions;
  registration?: VueMountedAppRegistration;
  registry: VueMountedAppRegistry;
};

type VueMountedAppMountHookState = {
  mountWrapper: VueAppWithMount['mount'];
  originalMount: VueAppWithMount['mount'];
  registrations: Map<symbol, VueMountedAppHookRegistration>;
};

type BootstrapEmbeddedInspectorBridge = {
  destroy: () => void;
};

const DEFAULT_BRIDGE_CAPABILITIES = ['tree', 'props', 'highlight'];
const DEFAULT_DEV_ALLOWED_HOST_ORIGINS = ['https://app.iteradev.ai'] as const;
const DEFAULT_DEV_EMBEDDED_BRIDGE_ENABLED = true;
const DEFAULT_DEV_EMBEDDED_BRIDGE_KILL_SWITCH_ACTIVE = false;

const mountHookStateByApp = new WeakMap<App, VueMountedAppMountHookState>();

const isElementContainer = (value: unknown): value is Element => {
  return typeof Element === 'function' && value instanceof Element;
};

const isShadowRootContainer = (value: unknown): value is ShadowRoot => {
  return typeof ShadowRoot === 'function' && value instanceof ShadowRoot;
};

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

const resolveBootstrapRuntimeConfig = (
  runtimeConfig?: VueInspectorRuntimeConfig,
  registry?: VueMountedAppRegistry,
): VueInspectorRuntimeConfig => {
  return {
    ...runtimeConfig,
    adapter: runtimeConfig?.adapter ?? 'vue3',
    appRegistry: registry ?? runtimeConfig?.appRegistry,
  };
};

const resolveRegistrationContainer = (
  app: App,
  options: RegisterVueAppOnMountOptions,
  mountTarget?: unknown,
) => {
  const resolvedMountTarget =
    typeof mountTarget === 'string' ||
    isElementContainer(mountTarget) ||
    isShadowRootContainer(mountTarget)
      ? resolveVueMountContainer(mountTarget, options.root)
      : null;

  return (
    resolvedMountTarget ??
    resolveMountedVueAppContainer(app) ??
    options.container ??
    null
  );
};

const registerCurrentMount = (
  app: App,
  registry: VueMountedAppRegistry,
  options: RegisterVueAppOnMountOptions,
) => {
  const mountedContainer = resolveRegistrationContainer(app, options);

  if (mountedContainer === null) {
    return undefined;
  }

  return registry.registerApp(app, {
    container: mountedContainer,
  });
};

const createMountHookState = (
  app: App,
  internalApp: VueAppWithMount,
): VueMountedAppMountHookState => {
  const state = {
    mountWrapper: (() => undefined) as unknown as VueAppWithMount['mount'],
    originalMount: internalApp.mount,
    registrations: new Map<symbol, VueMountedAppHookRegistration>(),
  } satisfies VueMountedAppMountHookState;

  const mountWrapper = ((...args: unknown[]) => {
    const mountResult = (
      state.originalMount as (...mountArgs: unknown[]) => unknown
    ).apply(internalApp, args);
    const mountTarget = args[0];

    state.registrations.forEach((registration) => {
      const resolvedContainer = resolveRegistrationContainer(
        app,
        registration.options,
        mountTarget,
      );

      registration.registration?.destroy();
      registration.registration =
        resolvedContainer === null
          ? undefined
          : registration.registry.registerApp(app, {
              container: resolvedContainer,
            });
    });

    return mountResult;
  }) as VueAppWithMount['mount'];

  state.mountWrapper = mountWrapper;
  internalApp.mount = state.mountWrapper;
  mountHookStateByApp.set(app, state);

  return state;
};

export const registerVueAppOnMount = (
  app: App,
  options: RegisterVueAppOnMountOptions = {},
): VueMountedAppRegistration => {
  const registry = options.registry ?? defaultVueMountedAppRegistry;
  const internalApp = app as VueAppWithMount;
  const state =
    mountHookStateByApp.get(app) ?? createMountHookState(app, internalApp);
  const registrationToken = Symbol('vue-mounted-app-hook-registration');

  state.registrations.set(registrationToken, {
    options,
    registration: registerCurrentMount(app, registry, options),
    registry,
  });

  return {
    destroy: () => {
      const activeState = mountHookStateByApp.get(app);

      if (activeState === undefined) {
        return;
      }

      const activeRegistration = activeState.registrations.get(registrationToken);

      if (activeRegistration === undefined) {
        return;
      }

      activeRegistration.registration?.destroy();
      activeState.registrations.delete(registrationToken);

      if (activeState.registrations.size === 0) {
        if (internalApp.mount === activeState.mountWrapper) {
          internalApp.mount = activeState.originalMount;
        }

        mountHookStateByApp.delete(app);
      }
    },
  };
};

export const bootstrapEmbeddedInspectorBridge = (
  options: BootstrapEmbeddedInspectorBridgeOptions,
): BootstrapEmbeddedInspectorBridge => {
  const killSwitchActive = options.killSwitchActive === true;
  const resolvedHostOrigins = toResolvedHostOrigins(
    options.hostOrigins,
    options.defaultHostOrigins ?? [],
  );
  const runtimeConfig = resolveBootstrapRuntimeConfig(options.runtimeConfig);
  const bridge = initInspectorBridge({
    hostOrigins: resolvedHostOrigins,
    enabled: options.enabled,
    killSwitchActive,
    mode: options.mode ?? 'development',
    capabilities: options.capabilities ?? [...DEFAULT_BRIDGE_CAPABILITIES],
    runtimeConfig,
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

export const bootstrapEmbeddedInspectorBridgeOnMount = (
  app: App,
  options: BootstrapEmbeddedInspectorBridgeOnMountOptions,
): BootstrapEmbeddedInspectorBridge => {
  const registry =
    options.runtimeConfig?.appRegistry ?? defaultVueMountedAppRegistry;
  const runtimeConfig = resolveBootstrapRuntimeConfig(
    options.runtimeConfig,
    registry,
  );
  const mountedAppRegistration = registerVueAppOnMount(app, {
    ...options.appRegistration,
    registry,
  });
  const bridgeBootstrap = bootstrapEmbeddedInspectorBridge({
    ...options,
    runtimeConfig,
  });

  return {
    destroy: () => {
      mountedAppRegistration.destroy();
      bridgeBootstrap.destroy();
    },
  };
};

export const initDevEmbeddedInspectorBridge = (
  options: InitDevEmbeddedInspectorBridgeOptions = {},
): BootstrapEmbeddedInspectorBridge => {
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
    runtimeConfig: resolveBootstrapRuntimeConfig(options.runtimeConfig),
  });
};

export const initDevEmbeddedInspectorBridgeOnMount = (
  app: App,
  options: InitDevEmbeddedInspectorBridgeOnMountOptions = {},
): BootstrapEmbeddedInspectorBridge => {
  const killSwitchActive =
    options.killSwitchActive ?? DEFAULT_DEV_EMBEDDED_BRIDGE_KILL_SWITCH_ACTIVE;

  if (killSwitchActive) {
    console.warn(
      '[component-inspector] Embedded kill switch is active. Bridge is disabled.',
    );
  }

  const registry =
    options.runtimeConfig?.appRegistry ?? defaultVueMountedAppRegistry;

  return bootstrapEmbeddedInspectorBridgeOnMount(app, {
    ...options,
    defaultHostOrigins:
      options.defaultHostOrigins ?? DEFAULT_DEV_ALLOWED_HOST_ORIGINS,
    enabled: options.enabled ?? DEFAULT_DEV_EMBEDDED_BRIDGE_ENABLED,
    killSwitchActive,
    mode: 'development',
    capabilities: [...DEFAULT_BRIDGE_CAPABILITIES],
    runtimeConfig: resolveBootstrapRuntimeConfig(options.runtimeConfig, registry),
  });
};

export { defaultVueMountedAppRegistry, registerMountedVueApp };
