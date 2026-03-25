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
  storybook: path.resolve(__dirname, 'src/storybook/index.ts'),
};

const protocolSourcePath = path.resolve(
  __dirname,
  '../inspector-protocol/src/index.ts',
);

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
          id === '@iteraai/inspector-protocol' ||
          id.startsWith('@iteraai/inspector-protocol/') ||
          id === 'react-devtools-inline/backend.js'
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
      exclude: ['src/**/*.spec.ts', 'src/tests.global.setup.ts'],
      include: ['src'],
      outDir: 'dist',
      rollupTypes: false,
      strictOutput: true,
      tsconfigPath: './tsconfig.build.json',
    }),
  ],
  resolve: {
    alias: {
      '#test': path.resolve(__dirname, 'testing'),
      ...(process.env.VITEST
        ? {
            '@iteraai/inspector-protocol': protocolSourcePath,
          }
        : {}),
    },
  },
  test: {
    globals: true,
    watch: false,
    environment: 'jsdom',
    setupFiles: './src/tests.global.setup.ts',
  },
});
