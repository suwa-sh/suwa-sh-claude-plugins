/**
 * browser.ts — @browser 受入シナリオ用のブラウザドライバ (スタブ)。
 *
 * ブラウザ実行は opt-in (capabilities.browser: true のときだけ)。イテレーション 1 のサンプルは off。
 * Playwright を **ライブラリとして** 使う (別ディレクトリの e2e spec は作らない)。
 * 有効化するときは下記 TODO を実装する。
 *
 * 参照: @playwright/test v1.63.0 の chromium.launch()。
 */
import type { Driver } from './types';

export class BrowserDriver implements Driver {
  // TODO(browser opt-in): capabilities.browser を有効にするとき、
  //   import { chromium, type Browser, type Page } from 'playwright';
  //   launch() で Browser/Page を持ち、request() を実 UI 操作に写像する。
  //   x-scenario-id は page.setExtraHTTPHeaders({ 'x-scenario-id': currentScenarioId() }) で伝える。

  async request(_method: string, _path: string, _body?: unknown): Promise<{ status: number; body: unknown }> {
    throw new Error(
      'BrowserDriver は未実装です。capabilities.browser を有効にする UC で d2-implement mode=integrate が結線します。',
    );
  }

  async teardown() {
    // TODO: await this.browser?.close();
  }
}
