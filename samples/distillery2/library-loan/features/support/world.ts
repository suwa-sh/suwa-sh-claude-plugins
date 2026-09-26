/**
 * world.ts — Cucumber の World (d2-foundation テンプレート)
 *
 * タグ @browser が付いたシナリオはブラウザドライバ、それ以外は api ドライバを選ぶ。
 * ドライバは step 定義から `this.driver` で使う。
 *
 * 参照 (Context7 /cucumber/cucumber-js v13.2.1): setWorldConstructor(CustomWorld); World を継承。
 */
import { World, setWorldConstructor } from '@cucumber/cucumber';
import type { Driver } from './drivers/types';
import { ApiDriver } from './drivers/api';
import { BrowserDriver } from './drivers/browser';

export class D2World extends World {
  driver!: Driver;
  scenarioId = '';

  /** タグからドライバを選ぶ。hooks.ts の Before から呼ぶ。 */
  selectDriver(tags: readonly string[]): void {
    this.driver = tags.includes('@browser') ? new BrowserDriver() : new ApiDriver();
  }

  /** api ドライバ (非 @browser) を取り出す。画面ロジックに `this.api.asFetch(placement)` を渡すときに使う。 */
  get api(): ApiDriver {
    if (!(this.driver instanceof ApiDriver)) throw new Error('この step は api ドライバ (非 @browser) でのみ実行できます');
    return this.driver;
  }
}

setWorldConstructor(D2World);
