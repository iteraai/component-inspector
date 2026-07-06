import { createRequire } from 'node:module';
import * as clientModule from './client';
import {
  createIteraReactInspectorVitePlugin,
  iteraReactInspector,
} from './index';

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

const readPackageDependencies = (): Record<string, string> => {
  const packageJson = require('../package.json') as {
    dependencies: Record<string, string>;
  };

  return packageJson.dependencies;
};

describe('public contract', () => {
  test('exports the React Vite plugin factory and alias', () => {
    expect(readPackageExports()).toStrictEqual({
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js',
      },
      './client': {
        types: './dist/client.d.ts',
        import: './dist/client.js',
      },
    });
    expect(Object.keys(clientModule).sort()).toStrictEqual([
      'bootIteraReactInspectorViteRuntime',
      'stopIteraReactInspectorViteRuntime',
    ]);
    expect(
      readPackageDependencies()['@iteraai/react-component-inspector'],
    ).toBe('0.5.1');
    expect(typeof createIteraReactInspectorVitePlugin).toBe('function');
    expect(iteraReactInspector).toBe(createIteraReactInspectorVitePlugin);
  });
});
