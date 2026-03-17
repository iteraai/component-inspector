import { given } from '#test/givenWhenThen';
import type { BootstrapEmbeddedInspectorBridgeOptions } from './embeddedBootstrap';
import {
  bootstrapEmbeddedInspectorBridge,
  initDevEmbeddedInspectorBridge,
} from './embeddedBootstrap';
import { installDevtoolsInlineBackendHook } from './devtoolsInlineBackendHook';
import { initEmbeddedRuntimeTelemetry } from './embeddedRuntimeTelemetry';
import { initInspectorBridge } from './bridgeRuntime';

vi.mock('./bridgeRuntime', () => {
  return {
    initInspectorBridge: vi.fn(() => ({ destroy: vi.fn() })),
  };
});

vi.mock('./embeddedRuntimeTelemetry', () => {
  return {
    initEmbeddedRuntimeTelemetry: vi.fn(() => ({ destroy: vi.fn() })),
  };
});

vi.mock('./devtoolsInlineBackendHook', () => {
  return {
    installDevtoolsInlineBackendHook: vi.fn(() => true),
  };
});

type EmbeddedBootstrapContext = {
  options: BootstrapEmbeddedInspectorBridgeOptions;
  inlineMenuReadyHookOnSpy?: ReturnType<typeof vi.fn>;
  adapterFactorySpy?: ReturnType<typeof vi.fn>;
  lifecycleTelemetrySpy?: ReturnType<typeof vi.fn>;
};

const windowRefWithDevtoolsHook = window as Window & {
  __REACT_DEVTOOLS_GLOBAL_HOOK__?: {
    on?: ReturnType<typeof vi.fn>;
  };
  __araInlineMenuReadyHandlerRegistered?: boolean;
  __iteraRegisteredInlineMenuReadyHandler?: boolean;
};

const contextCreated = (): EmbeddedBootstrapContext => {
  return {
    options: {
      enabled: true,
      hostOrigins: 'https://app.iteraapp.com, https://preview.iteraapp.com',
    },
  };
};

const inlineMenuHookPrepared = (
  context: EmbeddedBootstrapContext,
): EmbeddedBootstrapContext => {
  context.inlineMenuReadyHookOnSpy = vi.fn();
  windowRefWithDevtoolsHook.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    on: context.inlineMenuReadyHookOnSpy,
  };

  return context;
};

const bootstrapInvoked = (
  context: EmbeddedBootstrapContext,
): EmbeddedBootstrapContext => {
  bootstrapEmbeddedInspectorBridge(context.options);

  return context;
};

const initDevBootstrapInvokedWithDefaults = (
  context: EmbeddedBootstrapContext,
): EmbeddedBootstrapContext => {
  initDevEmbeddedInspectorBridge();

  return context;
};

const explicitDevBootstrapOptionsConfigured = (
  context: EmbeddedBootstrapContext,
): EmbeddedBootstrapContext => {
  context.options = {
    enabled: false,
    hostOrigins: 'https://explicit.iteraapp.com',
  };

  return context;
};

const initDevBootstrapInvokedWithExplicitOptions = (
  context: EmbeddedBootstrapContext,
): EmbeddedBootstrapContext => {
  initDevEmbeddedInspectorBridge(context.options);

  return context;
};

const killSwitchEnabled = (
  context: EmbeddedBootstrapContext,
): EmbeddedBootstrapContext => {
  context.options = {
    ...context.options,
    killSwitchActive: true,
  };

  return context;
};

const hostOriginsConfiguredAsEmptyString = (
  context: EmbeddedBootstrapContext,
): EmbeddedBootstrapContext => {
  context.options = {
    ...context.options,
    hostOrigins: '   ',
    defaultHostOrigins: ['https://default.iteraapp.com'],
  };

  return context;
};

const hostOriginsConfiguredAsArrayWithWhitespace = (
  context: EmbeddedBootstrapContext,
): EmbeddedBootstrapContext => {
  context.options = {
    ...context.options,
    hostOrigins: [
      ' https://app.iteraapp.com ',
      '   ',
      'https://preview.iteraapp.com ',
    ],
  };

  return context;
};

const customBridgeHooksConfigured = (
  context: EmbeddedBootstrapContext,
): EmbeddedBootstrapContext => {
  context.adapterFactorySpy = vi.fn();
  context.lifecycleTelemetrySpy = vi.fn();
  context.options = {
    ...context.options,
    adapterFactory: context.adapterFactorySpy,
    telemetry: {
      onLifecycleMetric: context.lifecycleTelemetrySpy,
    },
  };

  return context;
};

const explicitDevCustomBridgeHooksConfigured = (
  context: EmbeddedBootstrapContext,
): EmbeddedBootstrapContext => {
  context.adapterFactorySpy = vi.fn();
  context.lifecycleTelemetrySpy = vi.fn();
  context.options = {
    enabled: true,
    hostOrigins: 'https://explicit.iteraapp.com',
    adapterFactory: context.adapterFactorySpy,
    telemetry: {
      onLifecycleMetric: context.lifecycleTelemetrySpy,
    },
  };

  return context;
};

const expectInlineHookAndBridgeInitialization = (
  context: EmbeddedBootstrapContext,
) => {
  expect(installDevtoolsInlineBackendHook).toHaveBeenCalledWith({
    enabled: true,
    initializedFlagKey: undefined,
  });
  expect(context.inlineMenuReadyHookOnSpy).toHaveBeenCalledWith(
    'inline-menu-ready',
    expect.any(Function),
  );
  expect(initInspectorBridge).toHaveBeenCalledWith({
    hostOrigins: ['https://app.iteraapp.com', 'https://preview.iteraapp.com'],
    enabled: true,
    killSwitchActive: false,
    mode: 'development',
    capabilities: ['tree', 'props', 'highlight'],
    runtimeConfig: {
      adapter: 'fiber',
    },
  });
  expect(initEmbeddedRuntimeTelemetry).toHaveBeenCalledWith({
    enabled: true,
  });

  return context;
};

const expectInlineHookSkippedWhenKillSwitchActive = (
  context: EmbeddedBootstrapContext,
) => {
  expect(installDevtoolsInlineBackendHook).not.toHaveBeenCalled();
  expect(context.inlineMenuReadyHookOnSpy).not.toHaveBeenCalled();
  expect(initInspectorBridge).toHaveBeenCalledWith({
    hostOrigins: ['https://app.iteraapp.com', 'https://preview.iteraapp.com'],
    enabled: true,
    killSwitchActive: true,
    mode: 'development',
    capabilities: ['tree', 'props', 'highlight'],
    runtimeConfig: {
      adapter: 'fiber',
    },
  });
  expect(initEmbeddedRuntimeTelemetry).toHaveBeenCalledWith({
    enabled: false,
  });

  return context;
};

const expectDefaultHostOriginsUsed = (context: EmbeddedBootstrapContext) => {
  expect(initInspectorBridge).toHaveBeenCalledWith({
    hostOrigins: ['https://default.iteraapp.com'],
    enabled: true,
    killSwitchActive: false,
    mode: 'development',
    capabilities: ['tree', 'props', 'highlight'],
    runtimeConfig: {
      adapter: 'fiber',
    },
  });
  expect(initEmbeddedRuntimeTelemetry).toHaveBeenCalledWith({
    enabled: true,
  });

  return context;
};

const expectInitDevDefaultsApplied = (context: EmbeddedBootstrapContext) => {
  expect(installDevtoolsInlineBackendHook).toHaveBeenCalledWith({
    enabled: true,
    initializedFlagKey: '__iteraDevtoolsInlineBackendHookInitialized',
  });
  expect(context.inlineMenuReadyHookOnSpy).toHaveBeenCalledWith(
    'inline-menu-ready',
    expect.any(Function),
  );
  expect(initInspectorBridge).toHaveBeenCalledWith({
    hostOrigins: ['https://app.iteraapp.com'],
    enabled: true,
    killSwitchActive: false,
    mode: 'development',
    capabilities: ['tree', 'props', 'highlight'],
    runtimeConfig: {
      adapter: 'fiber',
    },
  });
  expect(initEmbeddedRuntimeTelemetry).toHaveBeenCalledWith({
    enabled: true,
  });

  return context;
};

const expectInitDevExplicitOptionsApplied = (
  context: EmbeddedBootstrapContext,
) => {
  expect(installDevtoolsInlineBackendHook).not.toHaveBeenCalled();
  expect(context.inlineMenuReadyHookOnSpy).not.toHaveBeenCalled();
  expect(initInspectorBridge).toHaveBeenCalledWith({
    hostOrigins: ['https://explicit.iteraapp.com'],
    enabled: false,
    killSwitchActive: false,
    mode: 'development',
    capabilities: ['tree', 'props', 'highlight'],
    runtimeConfig: {
      adapter: 'fiber',
    },
  });
  expect(initEmbeddedRuntimeTelemetry).toHaveBeenCalledWith({
    enabled: false,
  });

  return context;
};

const expectArrayHostOriginsTrimmedAndFiltered = (
  context: EmbeddedBootstrapContext,
) => {
  expect(initInspectorBridge).toHaveBeenCalledWith({
    hostOrigins: ['https://app.iteraapp.com', 'https://preview.iteraapp.com'],
    enabled: true,
    killSwitchActive: false,
    mode: 'development',
    capabilities: ['tree', 'props', 'highlight'],
    runtimeConfig: {
      adapter: 'fiber',
    },
  });
  expect(initEmbeddedRuntimeTelemetry).toHaveBeenCalledWith({
    enabled: true,
  });

  return context;
};

const expectCustomBridgeHooksPassedThrough = (
  context: EmbeddedBootstrapContext,
) => {
  expect(initInspectorBridge).toHaveBeenCalledWith({
    hostOrigins: ['https://app.iteraapp.com', 'https://preview.iteraapp.com'],
    enabled: true,
    killSwitchActive: false,
    mode: 'development',
    capabilities: ['tree', 'props', 'highlight'],
    runtimeConfig: {
      adapter: 'fiber',
    },
    adapterFactory: context.adapterFactorySpy,
    telemetry: {
      onLifecycleMetric: context.lifecycleTelemetrySpy,
    },
  });

  return context;
};

const expectInitDevCustomBridgeHooksPassedThrough = (
  context: EmbeddedBootstrapContext,
) => {
  expect(initInspectorBridge).toHaveBeenCalledWith({
    hostOrigins: ['https://explicit.iteraapp.com'],
    enabled: true,
    killSwitchActive: false,
    mode: 'development',
    capabilities: ['tree', 'props', 'highlight'],
    runtimeConfig: {
      adapter: 'fiber',
    },
    adapterFactory: context.adapterFactorySpy,
    telemetry: {
      onLifecycleMetric: context.lifecycleTelemetrySpy,
    },
  });

  return context;
};

const resetEmbeddedBootstrapMocks = () => {
  vi.clearAllMocks();
  delete windowRefWithDevtoolsHook.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  delete windowRefWithDevtoolsHook.__araInlineMenuReadyHandlerRegistered;
  delete windowRefWithDevtoolsHook.__iteraRegisteredInlineMenuReadyHandler;
};

describe('embeddedBootstrap', () => {
  beforeEach(resetEmbeddedBootstrapMocks);

  test('should initialize inline hook and bridge when enabled and kill switch is inactive', () => {
    return given(contextCreated)
      .when(inlineMenuHookPrepared)
      .when(bootstrapInvoked)
      .then(expectInlineHookAndBridgeInitialization);
  });

  test('should skip inline hook installation when kill switch is active', () => {
    return given(contextCreated)
      .when(inlineMenuHookPrepared)
      .when(killSwitchEnabled)
      .when(bootstrapInvoked)
      .then(expectInlineHookSkippedWhenKillSwitchActive);
  });

  test('should fall back to default host origins when configured host origins are empty', () => {
    return given(contextCreated)
      .when(hostOriginsConfiguredAsEmptyString)
      .when(bootstrapInvoked)
      .then(expectDefaultHostOriginsUsed);
  });

  test('should trim and filter array host origins before initializing the bridge', () => {
    return given(contextCreated)
      .when(hostOriginsConfiguredAsArrayWithWhitespace)
      .when(bootstrapInvoked)
      .then(expectArrayHostOriginsTrimmedAndFiltered);
  });

  test('should apply dev embedded bridge defaults when called without options', () => {
    return given(contextCreated)
      .when(inlineMenuHookPrepared)
      .when(initDevBootstrapInvokedWithDefaults)
      .then(expectInitDevDefaultsApplied);
  });

  test('should use explicit dev bootstrap options without environment coupling', () => {
    return given(contextCreated)
      .when(inlineMenuHookPrepared)
      .when(explicitDevBootstrapOptionsConfigured)
      .when(initDevBootstrapInvokedWithExplicitOptions)
      .then(expectInitDevExplicitOptionsApplied);
  });

  test('should pass custom bridge hooks through to the inspector runtime', () => {
    return given(contextCreated)
      .when(customBridgeHooksConfigured)
      .when(bootstrapInvoked)
      .then(expectCustomBridgeHooksPassedThrough);
  });

  test('should pass custom bridge hooks through when using the dev bootstrap helper', () => {
    return given(contextCreated)
      .when(explicitDevCustomBridgeHooksConfigured)
      .when(initDevBootstrapInvokedWithExplicitOptions)
      .then(expectInitDevCustomBridgeHooksPassedThrough);
  });
});
