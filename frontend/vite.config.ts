import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * The immutable legacy modules import each other with explicit `.js` extensions
 * (`import { game_start } from "./game.js"`) while the files on disk are `.ts`.
 * Vite's resolver maps `.js` -> `.ts` for TypeScript importers, so this works
 * without a custom plugin. Verified by `npm run build`; if it ever regresses the
 * fix is a `resolve.extensions` shim, not edits to the legacy files.
 */
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    port: 5173,
    // Mirrors nginx.conf so `npm run dev` talks to the same service topology
    // as production without any code-level branching.
    proxy: {
      '/api': { target: 'http://localhost:3010', changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
      '/avatar': { target: 'http://localhost:3010', changeOrigin: true },
      '/chat': { target: 'http://localhost:3011', changeOrigin: true, ws: true },
      '/tournaments': { target: 'http://localhost:3012', changeOrigin: true, rewrite: (p) => p.replace(/^\/tournaments/, '') },
      '/ws': { target: 'ws://localhost:3012', ws: true },
    },
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2020',
    // No manualChunks: the immutable nginx.conf sends `Cache-Control: no-store`
    // on every .js response, so vendor/app chunk splitting buys nothing in
    // production here — the browser re-downloads all of it on every load
    // regardless. Vite's default splitting keeps the graph honest.
  },
});
