/**
 * world.ts — Cucumber の World (d2-foundation テンプレート)
 *
 * タグ @browser が付いたシナリオはブラウザドライバ、それ以外は api ドライバを選ぶ。
 * ドライバは step 定義から `this.driver` で使う。
 * 現在時刻は `this.setNow('2026-11-05T12:00:00+09:00')` で決める (固定の時計。アプリには createTestApp({ clock }) で渡る)。
 * 前提のデータは `this.db` (シナリオごとの pglite。migration 済み) に step から入れる。usecase を経由しない。
 *
 * 参照 (Context7 /cucumber/cucumber-js v13.2.1): setWorldConstructor(CustomWorld); World を継承。
 */
import { World, setWorldConstructor } from '@cucumber/cucumber';
import { FixedClock, type PgHarness } from '@repo/test-support';
import type { Driver } from './drivers/types';
import { ApiDriver } from './drivers/api';
import { BrowserDriver } from './drivers/browser';

export class D2World extends World {
  driver!: Driver;
  scenarioId = '';
  /** 固定の時計。既定はシナリオを始めた時刻で止まる */
  clock = new FixedClock();
  /** シナリオごとの DB (hooks.ts の Before が用意する。RDB が無いプロダクトでは undefined) */
  harness?: PgHarness;

  /** 前提のデータを入れる DB (migration 済み)。RDB が無いプロダクトで呼ぶと失敗する */
  get db() {
    if (!this.harness) throw new Error('このプロダクトには DB のハーネスが無い (migration のディレクトリが無い)');
    return this.harness.pg;
  }

  /** 現在時刻を決める (タイムゾーン付きの ISO 8601) */
  setNow(at: string): void {
    this.clock.set(at);
  }

  /** タグからドライバを選ぶ。hooks.ts の Before から、DB を用意した後に呼ぶ。 */
  selectDriver(tags: readonly string[]): void {
    this.driver = tags.includes('@browser')
      ? new BrowserDriver()
      : new ApiDriver({ db: this.harness?.pg, clock: this.clock });
  }

  /** api ドライバ (非 @browser) を取り出す。画面ロジックに `this.api.asFetch(placement)` を渡すときに使う。 */
  get api(): ApiDriver {
    if (!(this.driver instanceof ApiDriver))
      throw new Error('この step は api ドライバ (非 @browser) でのみ実行できます');
    return this.driver;
  }
}

setWorldConstructor(D2World);
