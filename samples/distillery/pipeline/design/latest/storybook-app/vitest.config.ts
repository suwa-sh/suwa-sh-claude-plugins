import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

import { playwright } from '@vitest/browser-playwright';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({ configDir: path.join(dirname, '.storybook') }),
          {
            name: 'storybook-unicode-test-path',
            enforce: 'post',
            transform(code: string, id: string) {
              if (!id.endsWith('.stories.tsx')) return;
              // Storybook 10.5 convertToFilePath decodes spaces only; Chromium encodes Japanese filenames.
              const normalized = code.replace(/(\b[\w$]*convertToFilePath[\w$]*\(import\.meta\.url\))/g, 'decodeURI($1)');
              if (normalized !== code) return { code: normalized, map: null };
            },
          },
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
