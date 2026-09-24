/**
 * world.ts — Cucumber の World (d2-foundation テンプレート)
 *
 * タグ @browser が付いたシナリオはブラウザドライバ、それ以外は api ドライバを選ぶ。
 * ドライバは step 定義から `this.driver` で使う。
 *
 * integrate で追加: シナリオ隔離 DB (`this.scenario`) と、UC の step が共有する観測値 (`this.uc`)。
 *
 * 参照 (Context7 /cucumber/cucumber-js v13.2.1): setWorldConstructor(CustomWorld); World を継承。
 */
import { World, setWorldConstructor, type IWorldOptions } from '@cucumber/cucumber';
import type { Driver } from './drivers/types';
import { ApiDriver } from './drivers/api';
import { BrowserDriver } from './drivers/browser';
import type { ScenarioContext } from './scenario-db';

export interface ApiResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

/** UC の step が共有する状態。シナリオごとに作り直される。 */
export interface UcState {
  /** もし (When) を実行したか。前提と事後確認で同じ文言を使う step の切り替えに使う */
  acted: boolean;
  /** 直近の API 応答 */
  lastResponse?: ApiResponse;
  /** もし の直前の貸出件数 (「貸出は記録されない」の確認用) */
  loanCountBeforeAct?: number;
  /** 「その貸出」が指す貸出ID */
  subjectLoanId?: string;
  /** 書籍タイトル → 書籍ID */
  bookIds: Map<string, string>;
}

export class D2World extends World {
  driver!: Driver;
  scenarioId = '';
  scenario!: ScenarioContext;
  uc: UcState = { acted: false, bookIds: new Map() };

  constructor(options: IWorldOptions) {
    super(options);
  }

  /** タグからドライバを選ぶ。hooks.ts の Before から呼ぶ。 */
  selectDriver(tags: readonly string[]): void {
    this.driver = tags.includes('@browser') ? new BrowserDriver() : new ApiDriver(this.scenario.listener, this.scenarioId);
  }

  /** api ドライバ (非 @browser) を取り出す。 */
  get api(): ApiDriver {
    if (!(this.driver instanceof ApiDriver)) throw new Error('この step は api ドライバ (非 @browser) でのみ実行できます');
    return this.driver;
  }
}

setWorldConstructor(D2World);
