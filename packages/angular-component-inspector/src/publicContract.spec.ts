import { createRequire } from 'node:module';
import {
  ITERATION_INSPECTOR_CHANNEL,
  isIterationInspectorParentMessage,
  isIterationInspectorRuntimeMessage,
} from '@iteraai/angular-component-inspector';
import * as bridgeRuntimeModule from '@iteraai/angular-component-inspector/bridgeRuntime';
import * as embeddedBootstrapModule from '@iteraai/angular-component-inspector/embeddedBootstrap';
import * as indexModule from '@iteraai/angular-component-inspector';
import * as iterationInspectorModule from '@iteraai/angular-component-inspector/iterationInspector';

type PackageExportTarget = {
  types: string;
  import: string;
};

type PackageJsonShape = {
  builders: string;
  exports: Record<string, PackageExportTarget>;
};

type BuildersManifestShape = {
  builders: Record<
    string,
    {
      implementation: string;
      schema: string;
      description: string;
    }
  >;
};

const buildRuntimeSelectionMessage = (
  options: {
    editableValues?: Record<string, string>;
    locatorOverrides?: Record<string, unknown>;
  } = {},
) => {
  const { editableValues, locatorOverrides = {} } = options;

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
      ...(editableValues !== undefined && {
        editableValues,
      }),
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

const readPackageJson = (): PackageJsonShape => {
  return require('../package.json') as PackageJsonShape;
};

const readBuildersManifest = (): BuildersManifestShape => {
  return require('../builders.json') as BuildersManifestShape;
};

test('package exports and runtime entrypoints stay stable', () => {
  expect(readPackageJson().exports).toStrictEqual({
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
  expect(readPackageJson().builders).toBe('./builders.json');
  expect(readBuildersManifest().builders.application).toMatchObject({
    implementation: './dist/builders/application.js',
    schema: './schemas/application.schema.json',
  });
  expect(readBuildersManifest().builders['dev-server']).toMatchObject({
    implementation: './dist/builders/devServer.js',
    schema: './schemas/dev-server.schema.json',
  });
  expect(getRuntimeExportKeys(indexModule)).toStrictEqual([
    'ITERATION_INSPECTOR_CHANNEL',
    'angularInspectorRequiredDevModeGlobalNames',
    'angularInspectorRuntimeAdapterTargets',
    'bootIterationInspectorRuntime',
    'bootstrapEmbeddedInspectorBridge',
    'buildIterationElementSelection',
    'createAngularDevModeGlobalsInspectorAdapter',
    'createAngularInspectorAdapter',
    'createIterationInspectorRuntime',
    'defaultAngularInspectorAdapterCapabilities',
    'defaultAngularInspectorRuntimeConfig',
    'destroyInspectorBridge',
    'hasRequiredAngularDevModeGlobals',
    'initDevEmbeddedInspectorBridge',
    'initInspectorBridge',
    'isIterationInspectorParentMessage',
    'isIterationInspectorRuntimeMessage',
    'resolveAngularDevModeGlobals',
    'resolveAngularInspectorRuntimeConfig',
  ]);
  expect(getRuntimeExportKeys(embeddedBootstrapModule)).toStrictEqual([
    'bootstrapEmbeddedInspectorBridge',
    'initDevEmbeddedInspectorBridge',
  ]);
  expect(getRuntimeExportKeys(bridgeRuntimeModule)).toStrictEqual([
    'destroyInspectorBridge',
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
        channel: 'other-channel',
        kind: 'enter_select_mode',
      },
    ].map((message) => isIterationInspectorParentMessage(message)),
  ).toStrictEqual([true, true, true, true, true, false]);
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
        editableValues: {
          display: 'flex',
          flexDirection: 'row',
        },
        locatorOverrides: {
          componentPath: ['AppShell', 'ToolbarButton'],
          reactComponentPath: ['AppShell', 'ToolbarButton'],
        },
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
        kind: 'runtime_ready',
        urlPath: '/projects/1',
        capabilities: ['unknown'],
      },
    ].map((message) => isIterationInspectorRuntimeMessage(message)),
  ).toStrictEqual([true, true, true, true, true, true, true]);
});
