import path from 'node:path';
import react from '@vitejs/plugin-react';
import { createVueInspectorSourceMetadataVitePlugin } from '@iteraai/vue-component-inspector/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [createVueInspectorSourceMetadataVitePlugin(), react()],
  build: {
    emptyOutDir: true,
    outDir: 'dist',
    rollupOptions: {
      input: {
        embedded: path.resolve(__dirname, 'embedded.html'),
        embeddedVue: path.resolve(__dirname, 'embedded-vue.html'),
        host: path.resolve(__dirname, 'host.html'),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    watch: false,
  },
});
