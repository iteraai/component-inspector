import { createRequire } from 'node:module';
import { ITERATION_INSPECTOR_CHANNEL } from '@iteraai/vue-component-inspector';
import * as bridgeRuntimeModule from '@iteraai/vue-component-inspector/bridgeRuntime';
import * as embeddedBootstrapModule from '@iteraai/vue-component-inspector/embeddedBootstrap';
import * as indexModule from '@iteraai/vue-component-inspector';
import * as iterationInspectorModule from '@iteraai/vue-component-inspector/iterationInspector';

type PackageExportTarget = {
  types: string;
  import: string;
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
  expect(ITERATION_INSPECTOR_CHANNEL).toBe('itera:iteration-inspector');
});
