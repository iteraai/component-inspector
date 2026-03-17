import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: true,
    outDir: 'dist',
    rollupOptions: {
      input: {
        embedded: path.resolve(__dirname, 'embedded.html'),
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
