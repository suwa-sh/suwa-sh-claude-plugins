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
 * - 前回の `.imported.yaml` の一覧にあって取り込み元から消えたファイルは packages/ui からも消す (要求の差分の再取り込みで Story を消したとき。0.1.32 J2)。
 *
 * v1 dist-impl-bootstrap P5 の実ファイル列挙方式を踏襲する (design-event.yaml には依存しない)。
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { stamp, headerLine } = require('../../d2-common/scripts/lib/basis');
const { stringifyYaml, parseYaml } = require('../../d2-common/scripts/lib/yaml');

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
  const manifestPath = path.join(uiDir, '.imported.yaml');
  let prev = null;
  if (fs.existsSync(manifestPath)) {
    try { prev = parseYaml(fs.readFileSync(manifestPath, 'utf8').split('\n').filter(l => !l.startsWith('#')).join('\n')); } catch { prev = null; /* 壊れた manifest は無視して作り直す */ }
  }

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
  // 前回取り込んだのに今回の取り込み元に無いファイルを消す (空になったディレクトリも)。一覧に無いファイル (手で置いたもの) は触らない
  const now = new Set(files.map(f => f.path));
  const removed = [];
  // 一覧は追跡ファイルなので、消すのは packages/ui の中の実ファイルに限る (`..`・絶対パス・symlink で外に出る項目は消さない)
  const base = fs.realpathSync(uiDir);
  for (const f of (prev && Array.isArray(prev.files)) ? prev.files : []) {
    const rel = f && typeof f.path === 'string' ? f.path : null;
    if (!rel || now.has(rel) || path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) continue;
    const dst = path.resolve(uiDir, rel);
    let real;
    try { real = fs.realpathSync(dst); } catch { continue; }
    if (!real.startsWith(base + path.sep) || !fs.lstatSync(dst).isFile()) continue;
    fs.rmSync(real, { force: true });
    removed.push(rel);
    let d = path.dirname(real);
    while (d.startsWith(base + path.sep) && fs.existsSync(d) && fs.readdirSync(d).length === 0) { fs.rmdirSync(d); d = path.dirname(d); }
  }
  // npm workspace として解決できるよう packages/ui/package.json を書く (@repo/ui)。
  // main はエントリを推定する (index.ts(x) があればそれ、無ければ最初の components 実体)。
  const relPaths = files.map(f => f.path);
  const entry = ['index.ts', 'index.tsx', 'index.js'].find(e => relPaths.includes(e))
    || relPaths.find(p => /^components\/.*\.(t|j)sx?$/.test(p))
    || relPaths.find(p => /\.(t|j)sx?$/.test(p))
    || 'index.ts';
  // 既存の package.json は管理キー (name/type/main) だけ更新し、手編集した設定 (exports 等) を保持する (指摘 6)。
  const uiPkgPath = path.join(uiDir, 'package.json');
  const managed = { name: '@repo/ui', type: 'module', main: entry };
  let uiPkg = null;
  if (fs.existsSync(uiPkgPath)) {
    try { uiPkg = JSON.parse(fs.readFileSync(uiPkgPath, 'utf8')); } catch { uiPkg = null; }
  }
  if (uiPkg && typeof uiPkg === 'object' && !Array.isArray(uiPkg)) {
    Object.assign(uiPkg, managed);
  } else {
    uiPkg = { name: '@repo/ui', version: '0.0.0', private: true, type: 'module', main: entry, module: entry, types: entry };
  }
  fs.writeFileSync(uiPkgPath, JSON.stringify(uiPkg, null, 2) + '\n');

  // 取り込み内容のハッシュ (ファイル一覧 path+sha256 から導出)。内容が同じなら imported_at を据え置き、
  // 同じ入力での再実行が .imported.yaml をバイト一致させる (指摘 7)。
  const contentSha256 = crypto.createHash('sha256')
    .update(files.map(f => `${f.path}:${f.sha256}`).join('\n')).digest('hex');
  let importedAt = new Date().toISOString();
  if (prev && prev.content_sha256 === contentSha256 && typeof prev.imported_at === 'string') importedAt = prev.imported_at;
  const basisLine = headerLine(stamp({ design: o.from }, o.cwd));
  const manifest = { basis: basisLine.replace(/^basis:\s*/, ''), from: o.from, imported_at: importedAt, entry, content_sha256: contentSha256, files };
  fs.writeFileSync(manifestPath, `# ${basisLine}\n` + stringifyYaml(manifest));
  const css = writeEntryCss(uiDir, relPaths);
  const styles = switchAppStyles(o.cwd, css.ok);
  return { code: 0, count: files.length, entry, removed, css: css.msg, styles, format: formatUi(o.cwd) };
}

/**
 * 画面の土台 (genSkeleton が置く apps/<frontend>/src/styles.css) が読む CSS の入口を packages/ui/entry.css に書く (0.3.0)。
 * d2-design の Tailwind の CSS の置き場は版や構成で変わる (src/app/globals.css・src/styles/globals.css) ので、
 * 取り込んだ CSS のうち `@import "tailwindcss"` を持つ 1 本を探して指す。0 本・2 本以上なら書かずに報告する
 */
const { UI_ENTRY_CSS: ENTRY_CSS, STYLES_PLAIN, STYLES_UI } = require('./spaStyles');
function writeEntryCss(uiDir, relPaths) {
  // 取り込み元が同じ名前のファイルを持つと入口を書けない (中身が Tailwind の入口になっている保証も無い)。使わずに報告し、画面は Tailwind を直接読む形にする
  if (relPaths.includes(ENTRY_CSS)) return { ok: false, msg: `none (取り込み元に ${ENTRY_CSS} がある。名前がぶつかるので d2-design 側で名前を変える)` };
  // コメントの中の @import は数えない
  const found = relPaths.filter((p) => p.endsWith('.css') && /@import\s+["']tailwindcss["']/.test(fs.readFileSync(path.join(uiDir, p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')));
  const dst = path.join(uiDir, ENTRY_CSS);
  if (found.length !== 1) {
    if (fs.existsSync(dst)) fs.rmSync(dst);
    return { ok: false, msg: found.length ? `none (Tailwind の CSS が ${found.length} 本: ${found.join(', ')})` : 'none (Tailwind の CSS が無い)' };
  }
  const rel = found[0].split(path.sep).join('/');
  // @source で packages/ui を Tailwind に走査させる。画面の build は apps/<frontend> で回り、Tailwind が自動で見るのはその中だけなので、
  // 部品にだけ書いたクラスが出ない (d2-design の CSS が @source を持たないとき。0.3.0 の確認で実測)。
  // Tailwind 固有の at-rule だが、ここ (packages/ui) はティアの biome lint の外で、リポ全体のゲート (biome format・qlty) は通る (実測)
  fs.writeFileSync(dst, `/* distillery2 importUi.js が書いた画面部品の CSS の入口 (取り込みのたびに書き直す)。画面 (apps/<frontend>/src/styles.css) はここを読む */\n@import "./${rel}";\n@source "./";\n`);
  return { ok: true, msg: `entry.css → ${rel}` };
}

/**
 * 画面の土台の styles.css (apps の各ティアの src/styles.css) を、入口が書けたら packages/ui を読む形に、書けなければ Tailwind を直接読む形にする。
 * genSkeleton が置いた 2 つの形のどちらかと完全に一致するものだけ替える (手で変えたものは触らない)
 */
function switchAppStyles(cwd, useUi) {
  const apps = path.join(cwd, 'apps');
  if (!fs.existsSync(apps)) return [];
  const want = useUi ? STYLES_UI : STYLES_PLAIN;
  const changed = [];
  for (const d of fs.readdirSync(apps, { withFileTypes: true })) {
    const p = path.join(apps, d.name, 'src', 'styles.css');
    if (!d.isDirectory() || !fs.existsSync(p)) continue;
    const cur = fs.readFileSync(p, 'utf8');
    if (cur === want || (cur !== STYLES_PLAIN && cur !== STYLES_UI)) continue;
    fs.writeFileSync(p, want);
    changed.push(`apps/${d.name}/src/styles.css`);
  }
  return changed;
}

/**
 * 取り込んだ部品をリポの biome で整形する (0.3.0)。d2-design の出力は biome の書式にそろっておらず、
 * リポ全体の format (`npx biome format .`) で落ちる (会議室の予約の実地確認で実測)。
 * 取り込み元が正なので、取り込みのたびに整形し直す (.imported.yaml の sha256 は取り込み元の値のまま)。
 * biome が入っていなければ (npm install の前) 飛ばす。整形できない (構文の誤り) ときは報告だけしてゲートに任せる
 */
function formatUi(cwd) {
  const bin = path.join(cwd, 'node_modules', '.bin', process.platform === 'win32' ? 'biome.cmd' : 'biome');
  if (!fs.existsSync(bin)) return 'skipped (biome が無い)';
  const r = require('node:child_process').spawnSync(bin, ['format', '--write', '--no-errors-on-unmatched', 'packages/ui'], { cwd, encoding: 'utf8' });
  return r.status === 0 ? 'formatted' : `failed (exit ${r.status}): ${String(r.stderr || r.stdout).trim().split('\n').slice(-3).join(' / ')}`;
}

function main(argv) {
  let o; try { o = parseArgs(argv); } catch (e) { console.error(e.message); return 2; }
  const r = run(o);
  if (r.code === 0) console.log(`importUi: ${r.count} files → packages/ui${r.removed.length ? ` (removed ${r.removed.length}: ${r.removed.join(', ')})` : ''} css: ${r.css}${r.styles.length ? ` (styles: ${r.styles.join(', ')})` : ''} format: ${r.format}`);
  return r.code;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { parseArgs, run, ENTRY_CSS };
