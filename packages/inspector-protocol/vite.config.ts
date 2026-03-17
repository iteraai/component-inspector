import path from 'node:path';
import { defineConfig } from 'vitest/config';
import dts from 'vite-plugin-dts';

const entryPoints = {
  index: path.resolve(__dirname, 'src/index.ts'),
  types: path.resolve(__dirname, 'src/types.ts'),
  errors: path.resolve(__dirname, 'src/errors.ts'),
  validators: path.resolve(__dirname, 'src/validators.ts'),
  origins: path.resolve(__dirname, 'src/origins.ts'),
};

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
    },
  },
  test: {
    globals: true,
    watch: false,
    environment: 'node',
    setupFiles: './src/tests.global.setup.ts',
  },
});
