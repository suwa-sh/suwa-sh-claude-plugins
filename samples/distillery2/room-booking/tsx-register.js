/**
 * tsx-register.js — Cucumber の ESM ローダ登録 (d2-foundation テンプレート → リポルートに置く)
 *
 * cucumber.js の import[] 先頭でこのファイルを読み込み、tsx を ESM ローダとして登録する。
 * 以降に import される TypeScript の support / step_definitions が変換なしで読める。
 *
 * 参照 (Context7 /cucumber/cucumber-js transpiling): ESM は tsx/esm/api の register() を使う。
 */
import { register } from 'tsx/esm/api';

register();
