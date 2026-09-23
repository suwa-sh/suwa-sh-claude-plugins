#!/usr/bin/env node
'use strict';
/**
 * genTestSupport.js (F3) — テスト基盤テンプレートを対象リポへ展開する
 *
 *   node genTestSupport.js [--templates <dir>] [--cwd <repo>]
 *
 * 展開先:
 *   templates/test-support/**     → packages/test-support/**
 *   templates/features-support/** → features/support/**
 *   templates/cucumber.js         → cucumber.js (リポルート)
 *   templates/tsx-register.js     → tsx-register.js (リポルート、cucumber.js の ESM ローダ登録)
 *
 * 既存ファイルは上書きしない (skip として報告)。ディレクトリ構造はそのまま複製する。
 */
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_TEMPLATES = path.join(__dirname, '..', 'templates');

function parseArgs(argv) {
  const o = { templates: DEFAULT_TEMPLATES, cwd: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => argv[++i];
    if (a === '--templates') o.templates = next();
    else if (a === '--cwd') o.cwd = path.resolve(next());
    else throw new Error(`Unknown arg: ${a}`);
  }
  return o;
}

/** src ツリーを dst へ複製 (既存は skip)。相対パスを created/skipped に記録する。 */
function copyTree(srcDir, dstDir, reportBase, created, skipped) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dst = path.join(dstDir, entry.name);
    const rel = path.posix.join(reportBase, entry.name);
    if (entry.isDirectory()) { fs.mkdirSync(dst, { recursive: true }); copyTree(src, dst, rel, created, skipped); }
    else if (fs.existsSync(dst)) skipped.push(rel);
    else { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); created.push(rel); }
  }
}

function copyFile(src, dst, rel, created, skipped) {
  if (fs.existsSync(dst)) { skipped.push(rel); return; }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  created.push(rel);
}

function run(o) {
  const created = [], skipped = [];
  copyTree(path.join(o.templates, 'test-support'), path.resolve(o.cwd, 'packages/test-support'), 'packages/test-support', created, skipped);
  copyTree(path.join(o.templates, 'features-support'), path.resolve(o.cwd, 'features/support'), 'features/support', created, skipped);
  copyFile(path.join(o.templates, 'cucumber.js'), path.resolve(o.cwd, 'cucumber.js'), 'cucumber.js', created, skipped);
  copyFile(path.join(o.templates, 'tsx-register.js'), path.resolve(o.cwd, 'tsx-register.js'), 'tsx-register.js', created, skipped);
  return { code: 0, created, skipped };
}

function main(argv) {
  let o; try { o = parseArgs(argv); } catch (e) { console.error(e.message); return 2; }
  const r = run(o);
  console.log(`genTestSupport: created ${r.created.length}, skipped ${r.skipped.length}`);
  return r.code;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { parseArgs, run };
