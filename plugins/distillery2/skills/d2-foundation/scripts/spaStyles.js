'use strict';
/**
 * 画面の土台 (genSkeleton が frontend に置く src/styles.css) の 2 つの形 (0.3.0)。genSkeleton と importUi が共有する。
 *
 * - F5 (genSkeleton) は常に PLAIN (Tailwind を直接読む) を置く。画面部品の段 (d2-design) が画面なしで飛ばされても、build は通る
 * - F6 (importUi) が packages/ui/entry.css を書けたら UI (画面部品の Tailwind とデザイントークンを読む) に替え、書けなければ PLAIN に戻す
 * - どちらとも完全に一致しないファイル (手で変えたもの) は触らない
 *
 * Tailwind 固有の書き方 (@source・@theme) は書かない: biome 2.2.5 の lint が未知の at-rule として落とす (0.3.0 の確認で実測)。
 * 画面のソースは vite の root として Tailwind が自動で走査する
 */
const UI_ENTRY_CSS = 'entry.css';
const HEAD = '/* distillery2 genSkeleton.js が置いた画面のスタイルの入口。手で変えてよい (変えたら上書きしない)';

const STYLES_PLAIN = `${HEAD}。
 * 画面部品を取り込むと (基盤の仕上げ) packages/ui の入口を読む形に替わる */
@import "tailwindcss";
`;

const STYLES_UI = `${HEAD}。
 * 画面部品 (packages/ui) の Tailwind とデザイントークンを読む */
@import "../../../packages/ui/${UI_ENTRY_CSS}";
`;

module.exports = { UI_ENTRY_CSS, STYLES_PLAIN, STYLES_UI };
