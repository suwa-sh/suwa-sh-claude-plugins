// backend-api の起動の入口。本番の composition root (src/app.ts) で app を作り、待ち受ける。
import { pathToFileURL } from 'node:url';
import { createProductionApp, productionConfigFromEnv } from './app';

/** 待ち受けの port の既定 (契約 servers の http://localhost:3000) */
const DEFAULT_PORT = 3000;

export function start(): void {
  const app = createProductionApp(productionConfigFromEnv());
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  app.listen(port);
}

// node でこのファイルを直接起動したときだけ待ち受ける (import しただけでは起動しない)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start();
