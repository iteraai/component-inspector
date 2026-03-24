import { createRequire } from 'node:module';
import * as bridgeRuntimeModule from '@iteraai/vue-component-inspector/bridgeRuntime';
import * as embeddedBootstrapModule from '@iteraai/vue-component-inspector/embeddedBootstrap';
import * as indexModule from '@iteraai/vue-component-inspector';
import * as iterationInspectorModule from '@iteraai/vue-component-inspector/iterationInspector';

type PackageExportTarget = {
  types: string;
  import: string;
};

const require = createRequire(import.meta.url);

const readPackageExports = (): Record<string, PackageExportTarget> => {
  const packageJson = require('../package.json') as {
    exports: Record<string, PackageExportTarget>;
  };

  return packageJson.exports;
};

test('workspace source aliases resolve the root and subpath entrypoints', () => {
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

  expect(indexModule).toMatchObject({
    createVueInspectorAdapter: expect.any(Function),
    initInspectorBridge: expect.any(Function),
    registerVueAppOnMount: expect.any(Function),
    bootIterationInspectorRuntime: expect.any(Function),
  });
  expect(bridgeRuntimeModule).toMatchObject({
    destroyInspectorBridge: expect.any(Function),
    initInspectorBridge: expect.any(Function),
  });
  expect(embeddedBootstrapModule).toMatchObject({
    registerVueAppOnMount: expect.any(Function),
  });
  expect(iterationInspectorModule).toMatchObject({
    ITERATION_INSPECTOR_CHANNEL: 'itera:iteration-inspector',
    bootIterationInspectorRuntime: expect.any(Function),
    buildIterationElementSelection: expect.any(Function),
    createIterationInspectorRuntime: expect.any(Function),
    isIterationInspectorParentMessage: expect.any(Function),
    isIterationInspectorRuntimeMessage: expect.any(Function),
  });
});
