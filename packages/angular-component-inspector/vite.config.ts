import path from 'node:path';
import { defineConfig } from 'vitest/config';
import dts from 'vite-plugin-dts';

const entryPoints = {
  index: path.resolve(__dirname, 'src/index.ts'),
  embeddedBootstrap: path.resolve(__dirname, 'src/embeddedBootstrap.ts'),
  bridgeRuntime: path.resolve(__dirname, 'src/bridgeRuntime.ts'),
  iterationInspector: path.resolve(
    __dirname,
    'src/iterationInspector/index.ts',
  ),
  'builders/application': path.resolve(__dirname, 'src/builders/application.ts'),
  'builders/devServer': path.resolve(__dirname, 'src/builders/devServer.ts'),
};

const protocolSourcePath = path.resolve(
  __dirname,
  '../inspector-protocol/src/index.ts',
);
const angularPackageBridgeRuntimeSourcePath = path.resolve(
  __dirname,
  'src/bridgeRuntime.ts',
);
const angularPackageEmbeddedBootstrapSourcePath = path.resolve(
  __dirname,
  'src/embeddedBootstrap.ts',
);
const angularPackageIterationInspectorSourcePath = path.resolve(
  __dirname,
  'src/iterationInspector/index.ts',
);
const angularPackageIndexSourcePath = path.resolve(__dirname, 'src/index.ts');

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: entryPoints,
      formats: ['es'],
    },
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      external: (id) => {
        return (
          id.startsWith('node:') ||
          id === '@angular-devkit/architect' ||
          id === '@iteraai/inspector-protocol' ||
          id.startsWith('@iteraai/inspector-protocol/')
        );
      },
      output: {
        entryFileNames: ({ name }) => `${name}.js`,
        chunkFileNames: 'chunks/[name]-[hash].js',
        format: 'es',
      },
    },
  },
  plugins: [
    dts({
      copyDtsFiles: true,
      entryRoot: 'src',
      exclude: ['src/**/*.spec.ts'],
      include: ['src'],
      outDir: 'dist',
      rollupTypes: false,
      strictOutput: true,
      tsconfigPath: './tsconfig.build.json',
    }),
  ],
  resolve: {
    alias: {
      ...(process.env.VITEST
        ? {
            '@iteraai/inspector-protocol': protocolSourcePath,
            '@iteraai/angular-component-inspector/bridgeRuntime':
              angularPackageBridgeRuntimeSourcePath,
            '@iteraai/angular-component-inspector/embeddedBootstrap':
              angularPackageEmbeddedBootstrapSourcePath,
            '@iteraai/angular-component-inspector/iterationInspector':
              angularPackageIterationInspectorSourcePath,
            '@iteraai/angular-component-inspector': angularPackageIndexSourcePath,
          }
        : {}),
    },
  },
  test: {
    globals: true,
    watch: false,
    environment: 'jsdom',
  },
});
