#!/usr/bin/env node
/**
 * captureStories.js — Storybook の各 Story を headless chromium で撮って目視の証跡を残す
 *
 * 段取り:
 *   1. Storybook を静的ビルドする (`npx storybook build -o <tmp>`。--build-dir 指定時はスキップ)。
 *   2. 静的ビルドの `index.json` (`{v, entries}`。旧形式は `stories.json` の `stories`) から Story 一覧を読む。
 *   3. `playwright` が対象リポで解決できれば chromium を起動し、各 Story の iframe を撮って
 *      `docs/design/screenshots/<StoryId>.png` に保存し、`index.md` に一覧を書く。
 *      解決できなければ **exit 2** で「目視未実施」を明示して終わる (テストにブラウザは要らない)。
 *
 * playwright は対象リポの devDependency として入れる (capabilities.browser や目視を行うとき)。
 * 解決順は共有の resolveDep.js に従う (env PLAYWRIGHT → 対象リポ → プラグイン)。
 *
 * Usage:
 *   node captureStories.js [--cwd <repo>] [--storybook-dir docs/design/storybook-app] \
 *     [--build-dir <static-dir>] [--out docs/design/screenshots]
 *
 * 終了コード: 0 = 撮影した / 2 = 目視未実施 (playwright 無し・index.json 無し・ビルド失敗・Story 0 件・chromium 起動/撮影失敗)
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { resolveDep } = require('../../../scripts/lib/resolveDep');

/**
 * Storybook static build の index を Story 配列に変換する (id 昇順)。
 * v7+ は `{entries: {<id>: {id,name,title,type}}}`、v6 は `{stories: {...}}`。
 * type が 'story' のものだけ (docs エントリは除く。旧形式は type 省略で story 扱い)。
 * @returns {{id:string, title:string, name:string}[]}
 */
function parseStories(indexJson) {
  const map = (indexJson && (indexJson.entries || indexJson.stories)) || {};
  const out = [];
  for (const entry of Object.values(map)) {
    if (!entry || !entry.id) continue;
    if (entry.type && entry.type !== 'story') continue; // docs 等を除く
    out.push({ id: entry.id, title: entry.title || '', name: entry.name || '' });
  }
  out.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return out;
}

/** 静的ビルドの index.json / stories.json を読む (無ければ null)。 */
function readStoryIndex(buildDir) {
  for (const f of ['index.json', 'stories.json']) {
    const p = path.join(buildDir, f);
    if (fs.existsSync(p)) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
  }
  return null;
}

function buildStorybook(storybookDir) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-static-'));
  execFileSync('npx', ['storybook', 'build', '-o', out], { cwd: storybookDir, stdio: 'inherit' });
  return out;
}

/**
 * 出力ディレクトリの PNG のうち、現行の Story ID に対応しないものを消す (このスクリプトが撮る `*.png` のみ管理)。
 * Story を削除・改名して再撮影したとき、古い画像が index.md と食い違って残るのを防ぐ。
 * @returns {string[]} 消したファイル名
 */
function prunePngs(outDir, storyIds) {
  if (!fs.existsSync(outDir)) return [];
  const keep = new Set(storyIds.map((id) => `${id}.png`));
  const removed = [];
  for (const f of fs.readdirSync(outDir)) {
    if (f.endsWith('.png') && !keep.has(f)) { fs.rmSync(path.join(outDir, f)); removed.push(f); }
  }
  removed.sort();
  return removed;
}

function writeIndexMd(outDir, captured) {
  const L = [];
  L.push('# 目視の証跡 (スクリーンショット)', '');
  L.push(`撮影した Story: ${captured.length} 件`, '');
  L.push('| Story | 画像 |', '|---|---|');
  for (const s of captured) L.push(`| ${s.title}${s.name ? ' / ' + s.name : ''} | [${s.id}.png](${s.id}.png) |`);
  L.push('');
  fs.writeFileSync(path.join(outDir, 'index.md'), L.join('\n'));
}

/**
 * @param {{cwd:string, storybookDir?:string, buildDir?:string, outDir?:string}} opts
 * @returns {Promise<{code:number, reason?:string, stories?:object[], captured?:number}>}
 */
async function run(opts) {
  const cwd = opts.cwd || process.cwd();
  const storybookDir = path.resolve(cwd, opts.storybookDir || 'docs/design/storybook-app');
  const outDir = path.resolve(cwd, opts.outDir || 'docs/design/screenshots');

  // 1. ビルド (build-dir 指定時はスキップ)
  let buildDir = opts.buildDir ? path.resolve(cwd, opts.buildDir) : null;
  if (!buildDir) {
    try { buildDir = buildStorybook(storybookDir); }
    catch (e) { console.error(`目視未実施: Storybook build に失敗した (${e.message})`); return { code: 2, reason: 'build_failed' }; }
  }

  // 2. Story 一覧
  const index = readStoryIndex(buildDir);
  if (!index) { console.error(`目視未実施: ${buildDir} に index.json / stories.json が無い`); return { code: 2, reason: 'index_missing' }; }
  const stories = parseStories(index);
  if (!stories.length) {
    console.error('目視未実施: 撮影対象の Story が 0 件 (index の entries が空、または全件が docs 等で除外された)');
    return { code: 2, reason: 'no_stories', stories };
  }

  // 3. playwright があれば撮る。無ければ目視未実施 (exit 2)。
  const pwPath = resolveDep('playwright', { env: 'PLAYWRIGHT', cwd });
  if (!pwPath) {
    console.error('目視未実施: playwright が対象リポで解決できない (devDependency に playwright を追加すると目視できる)');
    return { code: 2, reason: 'playwright_unavailable', stories };
  }
  const { chromium } = require(pwPath);
  fs.mkdirSync(outDir, { recursive: true });
  const captured = [];
  let browser;
  // chromium の起動・撮影は try で囲む。ブラウザ実体が未導入等で失敗したら「目視未実施 (exit 2)」にする。
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    for (const s of stories) {
      const url = `file://${buildDir}/iframe.html?id=${encodeURIComponent(s.id)}&viewMode=story`;
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.screenshot({ path: path.join(outDir, `${s.id}.png`), fullPage: true });
      captured.push(s);
    }
  } catch (e) {
    console.error(`目視未実施: chromium の起動または撮影に失敗した (${e && e.message ? e.message : e})`);
    return { code: 2, reason: 'capture_failed', stories };
  } finally {
    if (browser) await browser.close();
  }
  // 撮影成功後、現行の Story ID に対応しない古い PNG を除く (証跡を実行履歴に依存させない)。
  const removed = prunePngs(outDir, stories.map((s) => s.id));
  writeIndexMd(outDir, captured);
  return { code: 0, captured: captured.length, stories, removed };
}

function parseArgs(argv) {
  const o = { cwd: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--cwd') o.cwd = path.resolve(argv[++i]);
    else if (a === '--storybook-dir') o.storybookDir = argv[++i];
    else if (a === '--build-dir') o.buildDir = argv[++i];
    else if (a === '--out') o.outDir = argv[++i];
    else throw new Error(`Unknown arg: ${a}`);
  }
  return o;
}

async function main(argv) {
  let o; try { o = parseArgs(argv); } catch (e) { console.error(e.message); return 2; }
  const r = await run(o);
  if (r.code === 0) console.log(`captureStories: ${r.captured} 枚 → ${o.outDir || 'docs/design/screenshots'}`);
  return r.code;
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => { console.error(`目視未実施: ${e && e.message ? e.message : e}`); process.exit(2); });
}

module.exports = { parseStories, readStoryIndex, run, writeIndexMd, prunePngs };
