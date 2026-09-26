// 単体テスト専用 (test)。契約テストは vitest.contract.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  esbuild: { jsx: 'automatic' },
});
