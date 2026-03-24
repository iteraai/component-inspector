import { createRequire } from 'node:module';
import { given } from '#test/givenWhenThen';
import {
  EMBEDDED_RUNTIME_TELEMETRY_CHANNEL,
  ITERATION_INSPECTOR_CHANNEL,
  isIterationInspectorParentMessage,
  isIterationInspectorRuntimeMessage,
} from './index';
import * as bridgeRuntimeModule from './bridgeRuntime';
import * as embeddedBootstrapModule from './embeddedBootstrap';
import * as indexModule from './index';
import * as iterationInspectorModule from './iterationInspector';

type PackageExportTarget = {
  types: string;
  import: string;
};

type BridgeContractContext = {
  packageExports?: Record<string, PackageExportTarget>;
  rootExportKeys?: string[];
  embeddedBootstrapExportKeys?: string[];
  bridgeRuntimeExportKeys?: string[];
  iterationInspectorExportKeys?: string[];
};

type GuardMatrixContext = {
  messages: unknown[];
  results?: boolean[];
};

const buildRuntimeSelectionMessage = (
  locatorOverrides: Record<string, unknown> = {},
) => {
  return {
    channel: ITERATION_INSPECTOR_CHANNEL,
    kind: 'element_selected',
    selection: {
      displayText: '@button "Save"',
      element: {
        urlPath: '/projects/1',
        cssSelector: 'button#save-button',
        domPath: '/html[1]/body[1]/main[1]/button[1]',
        tagName: 'button',
        role: 'button',
        accessibleName: 'Save',
        textPreview: 'Save',
        id: 'save-button',
        dataTestId: 'save',
        bounds: {
          top: 24,
          left: 48,
          width: 120,
          height: 40,
        },
        scrollOffset: {
          x: 0,
          y: 0,
        },
        capturedAt: '2026-03-24T10:00:00.000Z',
        ...locatorOverrides,
      },
    },
  };
};

const require = createRequire(import.meta.url);

const getRuntimeExportKeys = (module: object) => Object.keys(module).sort();

const readPackageExports = (): Record<string, PackageExportTarget> => {
  const packageJson = require('../package.json') as {
    exports: Record<string, PackageExportTarget>;
  };

  return packageJson.exports;
};

const contextCreated = (): BridgeContractContext => {
  return {};
};

const contractInventoryCollected = (
  context: BridgeContractContext,
): BridgeContractContext => {
  return {
    ...context,
    packageExports: readPackageExports(),
    rootExportKeys: getRuntimeExportKeys(indexModule),
    embeddedBootstrapExportKeys: getRuntimeExportKeys(embeddedBootstrapModule),
    bridgeRuntimeExportKeys: getRuntimeExportKeys(bridgeRuntimeModule),
    iterationInspectorExportKeys: getRuntimeExportKeys(
      iterationInspectorModule,
    ),
  };
};

const expectCurrentPublicEntryPoints = (context: BridgeContractContext) => {
  expect(context.packageExports).toStrictEqual({
    '.': {
      types: './dist/index.d.ts',
      import: './dist/index.js',
    },
    './embeddedBootstrap': {
      types: './dist/embeddedBootstrap.d.ts',
      import: './dist/embeddedBootstrap.js',
    },
    './bridgeRuntime': {
      types: './dist/bridgeRuntime.d.ts',
      import: './dist/bridgeRuntime.js',
    },
    './iterationInspector': {
      types: './dist/iterationInspector/index.d.ts',
      import: './dist/iterationInspector.js',
    },
  });
  expect(context.rootExportKeys).toStrictEqual([
    'EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_FIBER_FALLBACK',
    'EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_LIFECYCLE',
    'EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_REJECTION',
    'EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION',
    'EMBEDDED_RUNTIME_TELEMETRY_CHANNEL',
    'ITERATION_INSPECTOR_CHANNEL',
    'bootIterationInspectorRuntime',
    'bootstrapEmbeddedInspectorBridge',
    'buildIterationElementSelection',
    'createIterationInspectorRuntime',
    'createReactInspectorAdapter',
    'defaultReactInspectorAdapterCapabilities',
    'defaultReactInspectorRuntimeConfig',
    'destroyInspectorBridge',
    'embeddedBridgeFiberFallbackAdapterTargets',
    'embeddedBridgeFiberFallbackReasonCodes',
    'embeddedBridgeLifecycleStages',
    'embeddedBridgeRejectionReasonCodes',
    'embeddedBridgeTelemetryMetricNames',
    'emitEmbeddedBridgeFiberFallbackMetric',
    'emitEmbeddedBridgeLifecycleMetric',
    'emitEmbeddedBridgeRejectionMetric',
    'initDevEmbeddedInspectorBridge',
    'initEmbeddedRuntimeTelemetry',
    'initInspectorBridge',
    'installDevtoolsInlineBackendHook',
    'isEmbeddedRuntimeTelemetryHostMessage',
    'isIterationInspectorParentMessage',
    'isIterationInspectorRuntimeMessage',
    'reactInspectorCraAdapterTarget',
    'reactInspectorNextAdapterTarget',
    'reactInspectorRuntimeAdapterTargets',
    'reactInspectorViteAdapterTarget',
    'resolveEmbeddedRuntimeTelemetryTargetOrigin',
    'resolveReactInspectorRuntimeConfig',
    'validateHelloSessionToken',
  ]);
  expect(context.embeddedBootstrapExportKeys).toStrictEqual([
    'bootstrapEmbeddedInspectorBridge',
    'initDevEmbeddedInspectorBridge',
  ]);
  expect(context.bridgeRuntimeExportKeys).toStrictEqual([
    'destroyInspectorBridge',
    'initInspectorBridge',
  ]);
  expect(context.iterationInspectorExportKeys).toStrictEqual([
    'ITERATION_INSPECTOR_CHANNEL',
    'bootIterationInspectorRuntime',
    'buildIterationElementSelection',
    'createIterationInspectorRuntime',
    'isIterationInspectorParentMessage',
    'isIterationInspectorRuntimeMessage',
  ]);
  expect(ITERATION_INSPECTOR_CHANNEL).toBe('itera:iteration-inspector');
  expect(EMBEDDED_RUNTIME_TELEMETRY_CHANNEL).toBe(
    'ara:embedded-runtime-telemetry',
  );
};

const parentGuardMatrixCreated = (): GuardMatrixContext => {
  return {
    messages: [
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'enter_select_mode',
      },
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'exit_select_mode',
      },
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'clear_hover',
      },
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'debug_log',
      },
      {
        channel: 'other-channel',
        kind: 'enter_select_mode',
      },
    ],
  };
};

const runtimeGuardMatrixCreated = (): GuardMatrixContext => {
  return {
    messages: [
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'runtime_ready',
        urlPath: '/projects/1',
      },
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'mode_changed',
        active: true,
      },
      buildRuntimeSelectionMessage({
        componentPath: ['AppShell', 'ToolbarButton'],
        reactComponentPath: ['AppShell', 'ToolbarButton'],
      }),
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'selection_invalidated',
        reason: 'route_change',
      },
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'debug_log',
        event: 'selection_emitted',
      },
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'enter_select_mode',
      },
      {
        channel: 'other-channel',
        kind: 'runtime_ready',
      },
    ],
  };
};

const runtimeSelectionContractMatrixCreated = (): GuardMatrixContext => {
  return {
    messages: [
      buildRuntimeSelectionMessage({
        componentPath: ['AppShell', 'ToolbarButton'],
        reactComponentPath: ['AppShell', 'ToolbarButton'],
      }),
      buildRuntimeSelectionMessage({
        reactComponentPath: ['AppShell', 'ToolbarButton'],
      }),
      buildRuntimeSelectionMessage({
        componentPath: ['AppShell', 'ToolbarButton'],
      }),
      buildRuntimeSelectionMessage({
        componentPath: ['AppShell', ''],
      }),
      buildRuntimeSelectionMessage({
        reactComponentPath: [],
      }),
    ],
  };
};

const parentMessageGuardEvaluated = (
  context: GuardMatrixContext,
): GuardMatrixContext => {
  return {
    ...context,
    results: context.messages.map((message) =>
      isIterationInspectorParentMessage(message),
    ),
  };
};

const runtimeMessageGuardEvaluated = (
  context: GuardMatrixContext,
): GuardMatrixContext => {
  return {
    ...context,
    results: context.messages.map((message) =>
      isIterationInspectorRuntimeMessage(message),
    ),
  };
};

const expectCurrentParentGuardKinds = (context: GuardMatrixContext) => {
  expect(context.results).toStrictEqual([true, true, true, false, false]);
};

const expectCurrentRuntimeGuardKinds = (context: GuardMatrixContext) => {
  expect(context.results).toStrictEqual([
    true,
    true,
    true,
    true,
    true,
    false,
    false,
  ]);
};

const expectRuntimeSelectionContractCompatibility = (
  context: GuardMatrixContext,
) => {
  expect(context.results).toStrictEqual([true, true, true, false, false]);
};

describe('publicContract', () => {
  test('should preserve the current bridge entrypoints', () => {
    return given(contextCreated)
      .when(contractInventoryCollected)
      .then(expectCurrentPublicEntryPoints);
  });

  test('should recognize the current iteration inspector parent message kinds', () => {
    return given(parentGuardMatrixCreated)
      .when(parentMessageGuardEvaluated)
      .then(expectCurrentParentGuardKinds);
  });

  test('should recognize the current iteration inspector runtime message kinds', () => {
    return given(runtimeGuardMatrixCreated)
      .when(runtimeMessageGuardEvaluated)
      .then(expectCurrentRuntimeGuardKinds);
  });

  test('should keep iteration selection runtime guards compatible with additive component path fields', () => {
    return given(runtimeSelectionContractMatrixCreated)
      .when(runtimeMessageGuardEvaluated)
      .then(expectRuntimeSelectionContractCompatibility);
  });
});
