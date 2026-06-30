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
    expect(typeof createIteraReactInspectorVitePlugin).toBe('function');
    expect(iteraReactInspector).toBe(createIteraReactInspectorVitePlugin);
  });
});
