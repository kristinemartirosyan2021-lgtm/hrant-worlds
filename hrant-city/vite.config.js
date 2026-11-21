import { defineConfig } from 'vite';
import { swPlugin } from './scripts/sw-plugin.js';

export default defineConfig({
  base: './', // relative paths so it works on GitHub Pages sub-folders and Netlify alike
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: { target: 'es2019', chunkSizeWarningLimit: 1500 },
  plugins: [swPlugin()],
});
