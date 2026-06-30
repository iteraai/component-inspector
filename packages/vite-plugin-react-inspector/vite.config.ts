import path from 'node:path';
import { defineConfig } from 'vitest/config';
import dts from 'vite-plugin-dts';

const entryPoints = {
  client: path.resolve(__dirname, 'src/client.ts'),
  index: path.resolve(__dirname, 'src/index.ts'),
};

const protocolSourcePath = path.resolve(
  __dirname,
  '../inspector-protocol/src/index.ts',
);
const reactPackageEmbeddedBootstrapSourcePath = path.resolve(
  __dirname,
  '../react-component-inspector/src/embeddedBootstrap.ts',
);
const reactPackageIterationInspectorSourcePath = path.resolve(
  __dirname,
  '../react-component-inspector/src/iterationInspector/index.ts',
);
const vitePluginPackageClientSourcePath = path.resolve(
  __dirname,
  'src/client.ts',
);
const vitePluginPackageIndexSourcePath = path.resolve(
  __dirname,
  'src/index.ts',
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
          id === '@iteraai/react-component-inspector' ||
          id.startsWith('@iteraai/react-component-inspector/') ||
          id === '@iteraai/vite-plugin-react-inspector/client' ||
          id === 'vite'
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
            '@iteraai/react-component-inspector/embeddedBootstrap':
              reactPackageEmbeddedBootstrapSourcePath,
            '@iteraai/react-component-inspector/iterationInspector':
              reactPackageIterationInspectorSourcePath,
            '@iteraai/vite-plugin-react-inspector':
              vitePluginPackageIndexSourcePath,
            '@iteraai/vite-plugin-react-inspector/client':
              vitePluginPackageClientSourcePath,
          }
        : {}),
    },
  },
  test: {
    globals: true,
    watch: false,
    environment: 'node',
  },
});
