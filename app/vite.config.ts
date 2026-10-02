import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // The Pages Functions API runs under `wrangler pages dev` on 8788.
    // `npm run dev` starts both; open http://localhost:5173 for HMR.
    proxy: { '/api': { target: 'http://localhost:8788', changeOrigin: true } },
  },
});
