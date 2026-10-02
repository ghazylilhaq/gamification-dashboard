import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/test/**/*.test.ts', 'src/test/**/*.test.tsx'],
    // Pure metric and parsing tests run in node; component tests opt into
    // jsdom with a `@vitest-environment jsdom` docblock, so the fast majority
    // is not slowed down by building a DOM.
    environment: 'node',
  },
});
