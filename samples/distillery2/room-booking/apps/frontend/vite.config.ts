// distillery2 genSkeleton.js が置いた画面のビルドの設定 (React と Tailwind)。手で変えてよい (再実行で上書きしない)
// view-room-availability: 開発時の中継 (ADR 0021) を足した
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** 開発時に /api を中継する先の既定 (契約の servers と同じ)。環境変数 API_PROXY_TARGET で上書きする */
const DEFAULT_API_PROXY_TARGET = 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? DEFAULT_API_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
});
