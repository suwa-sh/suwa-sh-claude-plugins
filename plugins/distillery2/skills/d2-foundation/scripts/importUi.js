#!/usr/bin/env node
'use strict';
/**
 * importUi.js (F6) — d2-design の Storybook 出力を packages/ui へ取り込む
 *
 *   node importUi.js --from <design-out-dir> [--cwd <repo>]
 *
 * - `--from` の src/ (components / tokens / stories と依存モジュール) を packages/ui/ へ実ファイル複製する。
 * - `packages/ui/.imported.yaml` に取り込み元とファイル一覧 (path + sha256) と basis を書く。
 * - 冪等: 再実行は取り込み直し。取り込み元が正なので packages/ui は上書きする (手編集は design 側に戻す)。
 *
 * v1 dist-impl-bootstrap P5 の実ファイル列挙方式を踏襲する (design-event.yaml には依存しない)。
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { stamp, headerLine } = require('../../../scripts/lib/basis');
const { stringifyYaml } = require('../../../scripts/lib/yaml');

function parseArgs(argv) {
  const o = { cwd: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => argv[++i];
    if (a === '--from') o.from = next();
    else if (a === '--cwd') o.cwd = path.resolve(next());
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (!o.from) throw new Error('--from <design-out-dir> is required');
  return o;
}

function walk(dir, base, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, base, files);
    else files.push(path.relative(base, p));
  }
  return files;
}

function run(o) {
  const fromRoot = path.resolve(o.cwd, o.from);
  const hasSrc = fs.existsSync(path.join(fromRoot, 'src'));
  const srcDir = hasSrc ? path.join(fromRoot, 'src') : fromRoot;
  if (!fs.existsSync(srcDir)) { console.error(`source not found: ${srcDir}`); return { code: 1 }; }
  const uiDir = path.resolve(o.cwd, 'packages/ui');
  fs.mkdirSync(uiDir, { recursive: true });

  // 取り込む (絶対パス, packages/ui 内の相対パス) の一覧を作る。src/ を基本に取り込む。
  const tasks = walk(srcDir, srcDir, []).sort().map((rel) => ({ abs: path.join(srcDir, rel), rel }));

  // 防御的措置: src/ レイアウトで、トークンが src/ の外 (storybook-app 直下の tokens/) に
  // 置かれた場合も取りこぼさないよう、ルート直下の tokens/ を tokens/ 配下として取り込む。
  // (正は src/tokens/。src/tokens/ が既にあればそちらを優先し、重複はスキップする。)
  if (hasSrc) {
    const rootTokens = path.join(fromRoot, 'tokens');
    if (fs.existsSync(rootTokens) && fs.statSync(rootTokens).isDirectory()) {
      const seen = new Set(tasks.map((t) => t.rel));
      for (const sub of walk(rootTokens, rootTokens, []).sort()) {
        const rel = path.join('tokens', sub);
        if (!seen.has(rel)) tasks.push({ abs: path.join(rootTokens, sub), rel });
      }
    }
  }

  const files = [];
  for (const { abs, rel } of tasks) {
    const buf = fs.readFileSync(abs);
    const dst = path.join(uiDir, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, buf);
    files.push({ path: rel, sha256: crypto.createHash('sha256').update(buf).digest('hex') });
  }
  const basisLine = headerLine(stamp({ design: o.from }, o.cwd));
  const manifest = { basis: basisLine.replace(/^basis:\s*/, ''), from: o.from, imported_at: new Date().toISOString(), files };
  fs.writeFileSync(path.join(uiDir, '.imported.yaml'), `# ${basisLine}\n` + stringifyYaml(manifest));
  return { code: 0, count: files.length };
}

function main(argv) {
  let o; try { o = parseArgs(argv); } catch (e) { console.error(e.message); return 2; }
  const r = run(o);
  if (r.code === 0) console.log(`importUi: ${r.count} files → packages/ui`);
  return r.code;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { parseArgs, run };
