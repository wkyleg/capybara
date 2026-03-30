import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import topLevelAwait from 'vite-plugin-top-level-await';
import wasm from 'vite-plugin-wasm';

/** GitHub project pages live at https://<user>.github.io/<repo>/ — base must match. */
function appBase(): string {
  if (process.env.GITHUB_PAGES !== 'true') return '/';
  const raw = process.env.GITHUB_PAGES_BASE?.trim();
  if (raw) {
    const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
    return withSlash.endsWith('/') ? withSlash : `${withSlash}/`;
  }
  return '/capybara/';
}

export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait(), tailwindcss()],
  base: appBase(),
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    target: 'esnext',
  },
  optimizeDeps: {
    exclude: ['@elata-biosciences/eeg-web', '@elata-biosciences/eeg-web-ble', '@elata-biosciences/rppg-web'],
  },
  server: {
    port: 3010,
    open: true,
  },
});
