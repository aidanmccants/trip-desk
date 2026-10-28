import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// The Worker (wrangler dev, port 8787) owns /api, /auth and /oauth. In `npm run dev`
// Vite serves the client with HMR on 5173 and proxies those paths to the Worker.
const worker = 'http://localhost:8787';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) },
  },
  build: { outDir: '../dist/client', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { '/api': worker, '/auth': worker, '/oauth': worker },
  },
});
