// 契約テスト専用 (test:contract)。単体は vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/contract/**/*.{test,spec}.{ts,tsx}'],
  },
  esbuild: { jsx: 'automatic' },
});
