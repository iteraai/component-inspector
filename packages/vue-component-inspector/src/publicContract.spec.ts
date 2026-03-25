import { createRequire } from 'node:module';
import {
  ITERATION_INSPECTOR_CHANNEL,
  isIterationInspectorParentMessage,
  isIterationInspectorRuntimeMessage,
} from '@iteraai/vue-component-inspector';
import * as bridgeRuntimeModule from '@iteraai/vue-component-inspector/bridgeRuntime';
import * as embeddedBootstrapModule from '@iteraai/vue-component-inspector/embeddedBootstrap';
import * as indexModule from '@iteraai/vue-component-inspector';
import * as iterationInspectorModule from '@iteraai/vue-component-inspector/iterationInspector';
import * as viteModule from '@iteraai/vue-component-inspector/vite';

type PackageExportTarget = {
  types: string;
  import: string;
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

const buildPreviewSyncMessage = () => {
  return {
    channel: ITERATION_INSPECTOR_CHANNEL,
    kind: 'sync_preview_edits',
    revision: 1,
    targets: [
      {
        locator: buildRuntimeSelectionMessage().selection.element,
        operations: [
          {
            fieldId: 'textContent',
            value: 'Updated',
            valueType: 'string',
          },
        ],
      },
    ],
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

test('package exports and runtime entrypoints stay stable', () => {
  expect(readPackageExports()).toStrictEqual({
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
    './vite': {
      types: './dist/vite.d.ts',
      import: './dist/vite.js',
    },
  });
  expect(getRuntimeExportKeys(indexModule)).toStrictEqual([
    'ITERATION_INSPECTOR_CHANNEL',
    'bootIterationInspectorRuntime',
    'bootstrapEmbeddedInspectorBridge',
    'bootstrapEmbeddedInspectorBridgeOnMount',
    'buildIterationElementSelection',
    'createIterationInspectorRuntime',
    'createVueInspectorAdapter',
    'createVueMountedAppRegistry',
    'defaultVueInspectorAdapterCapabilities',
    'defaultVueInspectorRuntimeConfig',
    'defaultVueMountedAppDiscovery',
    'defaultVueMountedAppRegistry',
    'destroyInspectorBridge',
    'discoverMountedVueApps',
    'getMountedVueApps',
    'initDevEmbeddedInspectorBridge',
    'initDevEmbeddedInspectorBridgeOnMount',
    'initInspectorBridge',
    'isIterationInspectorParentMessage',
    'isIterationInspectorRuntimeMessage',
    'registerMountedVueApp',
    'registerVueAppOnMount',
    'resolveMountedVueAppContainer',
    'resolveVueInspectorRuntimeConfig',
    'resolveVueMountContainer',
    'vueInspectorMountedAppDiscoveryStrategies',
    'vueInspectorRuntimeAdapterTargets',
  ]);
  expect(getRuntimeExportKeys(embeddedBootstrapModule)).toStrictEqual([
    'bootstrapEmbeddedInspectorBridge',
    'bootstrapEmbeddedInspectorBridgeOnMount',
    'defaultVueMountedAppRegistry',
    'initDevEmbeddedInspectorBridge',
    'initDevEmbeddedInspectorBridgeOnMount',
    'registerMountedVueApp',
    'registerVueAppOnMount',
  ]);
  expect(getRuntimeExportKeys(bridgeRuntimeModule)).toStrictEqual([
    'EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION',
    'destroyInspectorBridge',
    'embeddedBridgeFiberFallbackAdapterTargets',
    'embeddedBridgeFiberFallbackReasonCodes',
    'embeddedBridgeLifecycleStages',
    'embeddedBridgeRejectionReasonCodes',
    'initInspectorBridge',
  ]);
  expect(getRuntimeExportKeys(iterationInspectorModule)).toStrictEqual([
    'ITERATION_INSPECTOR_CHANNEL',
    'bootIterationInspectorRuntime',
    'buildIterationElementSelection',
    'createIterationInspectorRuntime',
    'isIterationInspectorParentMessage',
    'isIterationInspectorRuntimeMessage',
  ]);
  expect(getRuntimeExportKeys(viteModule)).toStrictEqual([
    'createVueInspectorSourceMetadataVitePlugin',
  ]);
  expect(ITERATION_INSPECTOR_CHANNEL).toBe('itera:iteration-inspector');
});

test('iteration inspector parent message guards accept preview edit commands', () => {
  expect(
    [
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
      buildPreviewSyncMessage(),
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'clear_preview_edits',
        revision: 2,
      },
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'debug_log',
      },
      {
        channel: 'other-channel',
        kind: 'enter_select_mode',
      },
    ].map((message) => isIterationInspectorParentMessage(message)),
  ).toStrictEqual([true, true, true, true, true, false, false]);
});

test('iteration inspector runtime guards accept preview edit capability and status payloads', () => {
  expect(
    [
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'runtime_ready',
        urlPath: '/projects/1',
        capabilities: ['preview_edits_v1'],
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
        kind: 'preview_edits_status',
        revision: 2,
        appliedTargetCount: 1,
        errors: [
          {
            code: 'locator_not_found',
            message: 'Preview target could not be resolved in the current DOM.',
            targetIndex: 0,
            fieldId: 'textContent',
          },
        ],
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
    ].map((message) => isIterationInspectorRuntimeMessage(message)),
  ).toStrictEqual([true, true, true, true, true, true, false, false]);
});

test('iteration selection runtime guards remain compatible with additive component path fields', () => {
  expect(
    [
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
    ].map((message) => isIterationInspectorRuntimeMessage(message)),
  ).toStrictEqual([true, true, true, false, false]);
});
