import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) } },
  test: { include: ['worker/**/*.test.ts', 'shared/**/*.test.ts', 'client/src/**/*.test.ts'] },
});
