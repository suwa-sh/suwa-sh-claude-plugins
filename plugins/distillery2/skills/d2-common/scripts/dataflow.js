'use strict';

/**
 * dataflow.js — 入出力の正本 (references/dataflow.yaml) の読み込みとパス照合。
 * genDataflow.js (図の生成) と整合性テストが使う。
 *
 * パス照合の規則 (手順書の書き方に合わせた近似):
 *  - `<run>` は `.distillery/runs/<slug>` に展開する
 *  - `<...>` の置換変数は名前ごとに区別する (`<tier>` は `<tier>` にだけ合う)。`*` (1 階層内の任意文字列) は置換変数にも合う
 *  - `**` は任意階層、末尾 `/` は配下すべて
 *  - 2 つのパス A・B は、A の具体例が B のパターンに合うか、B の具体例が A に合えば「一致」とみなす
 *    (手順書は正本より粗くも細かくも書くため、包含のどちら向きも一致とする)
 */

const fs = require('node:fs');
const path = require('node:path');
const { parseYaml } = require('../../../scripts/lib/yaml');

const DATAFLOW_PATH = path.join(__dirname, '..', 'references', 'dataflow.yaml');

function load(file = DATAFLOW_PATH) {
  return parseYaml(fs.readFileSync(file, 'utf8'));
}

function normalize(p) {
  let s = String(p).trim().replace(/^\.\//, '');
  s = s.replace(/<run>/g, '.distillery/runs/<slug>');
  if (s.endsWith('/')) s += '**';
  return s;
}

function toRegex(p) {
  const s = normalize(p);
  let re = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '*' && s[i + 1] === '*') { re += '.*'; i++; if (s[i + 1] === '/') i++; continue; }
    if (c === '*') { re += '[^/]*'; continue; }
    // 置換変数は名前ごとに区別する (`<tier>` と `<slug>` を同じとみなすと、並列の書き込み先からティアが消えても一致してしまう)
    if (c === '<') { const j = s.indexOf('>', i); if (j > i) { re += '@' + s.slice(i + 1, j).replace(/[.+?^$()|[\]\\]/g, '\\$&') + '@'; i = j; continue; } }
    if (c === '{') { const j = s.indexOf('}', i); if (j > i) { re += '(?:' + s.slice(i + 1, j).split(',').map(x => x.trim().replace(/[.+?^$()|[\]\\]/g, '\\$&')).join('|') + ')'; i = j; continue; } }
    re += c.replace(/[.+?^$()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}

/** パターンの具体例 (置換変数・ワイルドカードを仮の値にしたもの) */
function sample(p) {
  return normalize(p)
    .replace(/\*\*\/?/g, 'x/y/')
    .replace(/\*/g, 'x')
    .replace(/<([^>]+)>/g, '@$1@')
    .replace(/\{([^,}]+)[^}]*\}/g, '$1')
    .replace(/\/$/, '/z');
}

/** ディレクトリ全体を指す表記か (`dir/**`・`dir/`) */
function isDirGlob(p) { return /(\*\*|\/)$/.test(String(p).trim()); }

/**
 * 正本の表記 storeSpelling と手順書の表記 token が同じものを指すか。
 * token の具体例が正本のパターンに合えば一致。token がディレクトリ全体 (`dir/**`) のときだけ逆向き (正本の具体例が token に合う) も一致とする
 * (ファイル名パターンどうしで逆向きを許すと `<ts>_<slug>.md` が `<ts>_<tier>_<slug>.md` に合ってしまう)。
 */
function pathsMatch(storeSpelling, token) {
  if (toRegex(storeSpelling).test(sample(token))) return true;
  return isDirGlob(token) && toRegex(token).test(sample(storeSpelling));
}

/** store の全表記 (path + aliases) */
function spellings(store) { return [store.path, ...(store.aliases || [])]; }

/** 手順書のパス表記 token が、store 群のどれに当たるか */
function storesFor(token, stores) {
  return stores.filter(s => spellings(s).some(sp => sp === token || pathsMatch(sp, token)));
}

/** バッククォートで囲まれた文字列を取り出す */
function backticks(text) {
  return [...String(text).matchAll(/`([^`]+)`/g)].map(m => m[1]);
}

/** パスらしい token か (スラッシュを含む、ファイルの拡張子で終わる、ドットファイル) */
function looksLikePath(tok) {
  return /\//.test(tok) || /\.(md|ya?ml|json|jsonl|ts|tsv|feature|cjs|js|sql|txt|toml)$/.test(tok) || /^\.[\w.-]+$/.test(tok);
}

module.exports = { DATAFLOW_PATH, load, normalize, toRegex, sample, isDirGlob, pathsMatch, spellings, storesFor, backticks, looksLikePath };
