import path from 'node:path';
import react from '@vitejs/plugin-react';
import { createIteraReactInspectorVitePlugin } from '@iteraai/vite-plugin-react-inspector';
import { defineConfig } from 'vite';

const hostOrigins = [
  'http://127.0.0.1:4173',
  'http://localhost:4173',
] as const;

export default defineConfig({
  plugins: [
    createIteraReactInspectorVitePlugin({
      enabled: true,
      hostOrigins,
    }),
    react(),
  ],
  build: {
    emptyOutDir: true,
    outDir: 'dist-react-plugin',
    rollupOptions: {
      input: {
        embeddedPlugin: path.resolve(__dirname, 'embedded-plugin.html'),
      },
    },
  },
});
