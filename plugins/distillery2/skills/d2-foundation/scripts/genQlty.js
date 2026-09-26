#!/usr/bin/env node
'use strict';
/**
 * genQlty.js — `.qlty/qlty.toml` を生成する (F5 の最後。genSkeleton / genCi の後)。
 *
 * 方針: プラグインの選定は qlty 自身の提案 (`qlty init` の自動検出) を優先し、distillery2 は上乗せだけする。
 *   1. `qlty init --yes --dry-run` の出力を土台にする (ファイルは書かず stdout に出る)。
 *      qlty init は git で追跡済み (index にある) ファイルしか見ないので、未追跡ファイルを `git add -N` (intent-to-add) で
 *      一時的に index へ載せ、終わったら保存しておいた index ファイルをそのまま書き戻す (実測: 未追跡のままだと trufflehog しか提案されない)。
 *   2. qlty CLI が無い / git 外 / 出力が取れないときは固定リスト (フォールバック) を土台にする。
 *   3. 土台に distillery2 の上乗せをする (overlay。同じ入力に 2 回当てても同じ結果):
 *      - biome の版を lockfile / package.json の版に固定 (qlty の既定 1.9.4 は biome 2 系の設定を読めない)
 *      - 生成物・vendored (packages/ui、packages/contracts、contracts/generated、Storybook、契約テスト、.distillery) を exclude_patterns に追加
 *      - qlty の既定除外のうち `**\/db/**` と `**\/config/**` は外す (実装のレイヤ名になりやすく、検査の穴になる)
 *      - lockfile は除外しない (osv-scanner の入力)
 *      - test_patterns に `features/**`
 *      - radarlint-* (コードスメル) は [[triage]] で low に降格
 *      - [smells] mode = "comment"
 *
 * 使い方: node genQlty.js --cwd <repo> [--fallback] [--force]
 *   --fallback  qlty init を使わず固定リストを土台にする
 *   --force     既存の .qlty/qlty.toml を作り直す (既定は既存があればスキップ)
 *   --refresh   既存の .qlty/qlty.toml に、いまの提案で増えたプラグインだけを足す (減らさない。上乗せと手編集は保持)。
 *               提案はリポにあるファイル種別で変わる (lockfile → osv-scanner、python → ruff 等) ので、npm install の後と UC の実装後に回す。
 *               無ければ新規生成と同じ
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { BIOME_VERSION, existingBiomeVersion } = require('./genSkeleton');

function parseArgs(argv) {
  const o = { cwd: process.cwd(), fallback: false, force: false, refresh: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--cwd') o.cwd = argv[++i];
    else if (a === '--fallback') o.fallback = true;
    else if (a === '--force') o.force = true;
    else if (a === '--refresh') o.refresh = true;
  }
  return o;
}

/** distillery2 が足す除外 (生成物・vendored)。 */
const D2_EXCLUDES = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/*.d.ts',
  '**/*.min.*',
  '.distillery/**',
  'packages/ui/**',
  'packages/contracts/**',
  'contracts/generated/**',
  'docs/design/storybook-app/**',
  'docs/design/screenshots/**',
  '**/test/contract/**',
];
/** qlty init の既定除外のうち外すもの (実装のレイヤ名になりやすい)。 */
const PRUNE_EXCLUDES = ['**/db/**', '**/config/**'];
const D2_TEST_PATTERNS = ['features/**'];
const LOCKFILES = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'];

/** qlty CLI が使えないときの土台 (0.1.11 までの固定リスト)。 */
const FALLBACK_TOML = `config_version = "0"

exclude_patterns = [
]

test_patterns = [
  "**/test/**",
  "**/*.test.*",
  "**/*.spec.*",
]

[[source]]
name = "default"
default = true

[[plugin]]
name = "biome"

[[plugin]]
name = "radarlint-js"

[[plugin]]
name = "actionlint"

[[plugin]]
name = "zizmor"

[[plugin]]
name = "trufflehog"

[[plugin]]
name = "osv-scanner"
`;

// ---- 土台の取得 -------------------------------------------------------------

function git(cwd, args, input) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', input });
}

function qltyAvailable() {
  const r = spawnSync('qlty', ['--version'], { encoding: 'utf8' });
  return !r.error && r.status === 0;  // 起動できない CLI は「無い」扱い
}

/**
 * `qlty init --yes --dry-run` で提案される設定を取る。未追跡ファイルは intent-to-add で一時的に index に載せ、必ず戻す。
 * 取れなければ null (呼び出し側がフォールバックする)。
 */
function suggestToml(cwd) {
  if (git(cwd, ['rev-parse', '--is-inside-work-tree']).status !== 0) return { toml: null, reason: 'git リポジトリではない' };
  const ls = git(cwd, ['ls-files', '--others', '--exclude-standard', '-z']);
  const untracked = ls.status === 0 ? ls.stdout.split('\0').filter(Boolean) : [];
  // index の復元は「index ファイルをそのまま戻す」で行う (Codex 0.1.12 ラウンド 2 指摘 1:
  // pathspec で git reset すると、同名の staged 削除や `*` 入りの名前で利用者の staged 変更まで解除した)。
  // worktree ごとの index は `git rev-parse --git-path index`。無ければ (初回 add 前) 終わったら消す。
  const indexPath = path.resolve(cwd, git(cwd, ['rev-parse', '--git-path', 'index']).stdout.trim());
  const saved = fs.existsSync(indexPath) ? fs.readFileSync(indexPath) : null;
  // 名前は glob として解釈しない (--literal-pathspecs)
  if (untracked.length) {
    const a = git(cwd, ['--literal-pathspecs', 'add', '-N', '--pathspec-from-file=-', '--pathspec-file-nul'], untracked.join('\0'));
    if (a.status !== 0) {  // index.lock 等で見せられなければ、検出不足の提案を採用しない (Codex 0.1.12 ラウンド 3 指摘 1)
      if (saved) fs.writeFileSync(indexPath, saved); else fs.rmSync(indexPath, { force: true });
      return { toml: null, reason: `未追跡ファイルを index に載せられない (git add -N: ${(a.stderr || '').trim().split('\n')[0]})` };
    }
  }
  let out;
  try {
    const r = spawnSync('qlty', ['init', '--yes', '--dry-run', '--no-upgrade-check'], { cwd, encoding: 'utf8' });
    out = (r.error || r.status !== 0) ? '' : (r.stdout || '');  // 失敗 (exit≠0) の部分出力は採用しない (Codex 0.1.12 指摘 1)
  } finally {
    if (untracked.length) {
      if (saved) fs.writeFileSync(indexPath, saved);
      else fs.rmSync(indexPath, { force: true });
    }
  }
  if (!/^config_version\s*=/m.test(out)) return { toml: null, reason: 'qlty init --dry-run が失敗したか、出力に設定が無い' };
  return { toml: out, reason: null };
}

// ---- 上乗せ (overlay) -------------------------------------------------------

/** `key = [ ... ]` の複数行配列を読む。無ければ null。 */
function readArray(lines, key) {
  const start = lines.findIndex((l) => new RegExp(`^${key}\\s*=\\s*\\[`).test(l));
  if (start < 0) return null;
  if (/\]\s*$/.test(lines[start])) {
    const inner = lines[start].replace(/^[^[]*\[/, '').replace(/\]\s*$/, '');
    const items = inner.split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
    return { start, end: start, items };
  }
  let end = start + 1;
  const items = [];
  while (end < lines.length && !/^\s*\]/.test(lines[end])) {
    const m = lines[end].match(/^\s*"([^"]*)"/);
    if (m) items.push(m[1]);
    end++;
  }
  return { start, end, items };
}

function renderArray(key, items) {
  return [`${key} = [`, ...items.map((s) => `  "${s}",`), ']'];
}

/** 配列 key を items に置き換える (無ければ config_version の後に挿入)。 */
function writeArray(lines, key, items) {
  const cur = readArray(lines, key);
  const block = renderArray(key, items);
  if (cur) return [...lines.slice(0, cur.start), ...block, ...lines.slice(cur.end + 1)];
  const at = lines.findIndex((l) => /^config_version\s*=/.test(l));
  return [...lines.slice(0, at + 1), '', ...block, ...lines.slice(at + 1)];
}

function pluginNames(lines) {
  const names = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\[\[plugin\]\]/.test(lines[i])) {
      const m = (lines[i + 1] || '').match(/^name\s*=\s*"([^"]+)"/);
      if (m) names.push(m[1]);
    }
  }
  return names;
}

/** [[plugin]] name = "biome" のブロック内の version を置き換える (無ければ name の直後に置く。ブロックは次のセクション見出しまで)。 */
function pinBiome(lines, version) {
  const i = lines.findIndex((l, k) => /^\[\[plugin\]\]/.test(l) && /^name\s*=\s*"biome"/.test(lines[k + 1] || ''));
  if (i < 0) return [...lines, '', '[[plugin]]', 'name = "biome"', `version = "${version}"`];
  const out = lines.slice();
  let end = i + 1;
  while (end + 1 < out.length && !/^\[/.test(out[end + 1])) end++;
  const v = out.findIndex((l, k) => k > i && k <= end && /^version\s*=/.test(l));
  if (v >= 0) out[v] = `version = "${version}"`;
  else out.splice(i + 2, 0, `version = "${version}"`);
  return out;
}

function hasTriageFor(lines, plugin) {
  return lines.some((l, i) => /^\[\[triage\]\]/.test(l) && (lines[i + 1] || '').includes(`"${plugin}"`));
}

/** 先頭のコメント塊を剥がす。ただし剥がすのは distillery2 自身のヘッダと `qlty init` が付けるヘッダだけ (手書きの先頭コメントは保持。Codex 0.1.14 指摘 1)。 */
// `qlty init` が付けるヘッダ (0.618.0 の実測)。既知の行だけを剥がし、未知のコメント行 (手書き) は保持する (Codex 0.1.14 ラウンド 2 指摘 1)
const QLTY_INIT_HEADER_LINES = new Set([
  '# This file was automatically generated by `qlty init`.',
  '# You can modify it to suit your needs.',
  '# We recommend you to commit this file to your repository.',
  '# This configuration is used by both Qlty CLI and Qlty Cloud.',
  '#     Qlty CLI -- Code quality toolkit for developers',
  '#     Qlty Cloud -- Fully automated Code Health Platform',
  '# Try Qlty Cloud: https://qlty.sh',
  '# For a guide to configuration, visit https://qlty.sh/d/config',
  '# Or for a full reference, visit https://qlty.sh/d/qlty-toml',
]);
// distillery2 自身のヘッダ 4 行 (overlay が付ける)。先頭のコメント塊の中にあれば位置に関係なく剥がす
const OWN_HEADER_PREFIXES = ['# distillery2 genQlty.js が生成した', '# 上乗せ: ', '# ゲートは commands.quality', '# 無視は [[ignore]]'];
function stripHeader(lines) {
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  // 先頭のコメント塊 (コメント行と空行の連続) の範囲
  let end = i;
  while (end < lines.length && (/^#/.test(lines[end]) || lines[end].trim() === '')) end++;
  const head = lines.slice(i, end);
  const kept = [];
  for (const l of head) {
    const t = l.replace(/\s+$/, '');
    if (QLTY_INIT_HEADER_LINES.has(t)) continue;                             // qlty init の既知のヘッダ行
    if (t === '#' ) continue;                                                // 区切りの空コメント行 (qlty init のヘッダの一部)
    if (OWN_HEADER_PREFIXES.some((pfx) => t.startsWith(pfx))) continue;     // 自分のヘッダは付け直すので捨てる
    kept.push(l);                                                            // 手書きのコメントは保持
  }
  while (kept.length && kept[0].trim() === '') kept.shift();
  return [...kept, ...lines.slice(end)];
}

/**
 * 土台の TOML に distillery2 の上乗せをする。同じ入力に 2 回当てても同じ結果。
 * @param {string} toml 土台
 * @param {{biomeVersion: string, source: 'suggest'|'fallback', hasBiomeDep: boolean}} opt
 */
function overlay(toml, opt) {
  let lines = stripHeader(toml.replace(/\r\n/g, '\n').split('\n'));
  // exclude_patterns: 既定の穴になりやすい 2 つと lockfile を外し、生成物を足す
  const ex = (readArray(lines, 'exclude_patterns')?.items || [])
    .filter((p) => !PRUNE_EXCLUDES.includes(p))
    .filter((p) => !LOCKFILES.some((lf) => p.includes(lf)));
  for (const p of D2_EXCLUDES) if (!ex.includes(p)) ex.push(p);
  lines = writeArray(lines, 'exclude_patterns', ex);
  // test_patterns: features/** を足す
  const tp = readArray(lines, 'test_patterns')?.items || [];
  for (const p of D2_TEST_PATTERNS) if (!tp.includes(p)) tp.push(p);
  lines = writeArray(lines, 'test_patterns', tp);
  // [smells] mode = "comment"
  if (!lines.some((l) => /^\[smells\]/.test(l))) lines.push('', '[smells]', 'mode = "comment"');
  // biome: 版を固定 (提案に無くても package.json に biome があれば足す)
  const plugins = pluginNames(lines);
  if (plugins.includes('biome') || opt.hasBiomeDep) lines = pinBiome(lines, opt.biomeVersion);
  // radarlint-* (コードスメル) は助言扱い
  const radar = pluginNames(lines).filter((n) => n.startsWith('radarlint-')).filter((n) => !hasTriageFor(lines, n));
  if (radar.length) lines.push('', '# コードスメルは助言 (ゲートを止めない)', '[[triage]]', `match.plugins = [${radar.map((n) => `"${n}"`).join(', ')}]`, 'set.level = "low"');
  const header = [
    `# distillery2 genQlty.js が生成した qlty の設定 (土台: ${opt.source === 'suggest' ? '`qlty init` の提案' : '固定リスト (qlty CLI が無いときのフォールバック)'})。`,
    '# 上乗せ: biome の版固定 / 生成物・vendored の除外 / `**/db/**` `**/config/**` は除外しない / lockfile は除外しない / features は test / radarlint は low。',
    '# ゲートは commands.quality (.distillery/config.yaml)。整形は `qlty fmt --all`。`qlty check --fix` は使わない。',
    '# 無視は [[ignore]] / [[triage]] で書く ([[exclude]] に rules は書けない)。仕様: https://docs.qlty.sh/cli/qlty-toml',
  ];
  return [...header, ...lines].join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n*$/, '\n');
}

/** [[plugin]] ブロックを name ごとに切り出す (ブロックは次のセクション見出しまで)。 */
function pluginBlocks(lines) {
  const blocks = new Map();
  for (let i = 0; i < lines.length; i++) {
    if (!/^\[\[plugin\]\]/.test(lines[i])) continue;
    const m = (lines[i + 1] || '').match(/^name\s*=\s*"([^"]+)"/);
    if (!m) continue;
    let end = i + 1;
    while (end + 1 < lines.length && !/^\[/.test(lines[end + 1])) end++;
    blocks.set(m[1], lines.slice(i, end + 1).filter((l, k, arr) => !(k === arr.length - 1 && l.trim() === '')));
  }
  return blocks;
}

/**
 * --refresh: 既存の qlty.toml に、いまの提案で増えたプラグインだけを足す。減らさない。
 * 足した後に overlay を当て直す (radarlint の降格や biome の版固定は新しいプラグインにも効く。overlay は冪等)。
 */
function refresh(cwd, target, opt) {
  const cur = fs.readFileSync(target, 'utf8');
  if (!qltyAvailable()) return { code: 0, refreshed: false, added: [], reason: 'qlty CLI が無い' };
  // qlty init は (dry-run でも) 既存の qlty.toml があると「already initialized」で拒否する (実測)。提案を取る間だけ退避する
  const bak = `${target}.refresh-bak`;
  fs.renameSync(target, bak);
  let suggested, reason;
  try { ({ toml: suggested, reason } = suggestToml(cwd)); } finally { fs.renameSync(bak, target); }
  if (!suggested) return { code: 0, refreshed: false, added: [], reason };
  const curLines = cur.replace(/\r\n/g, '\n').split('\n');
  const have = new Set(pluginNames(curLines));
  const blocks = pluginBlocks(suggested.replace(/\r\n/g, '\n').split('\n'));
  const added = [...blocks.keys()].filter((n) => !have.has(n));
  if (!added.length) return { code: 0, refreshed: false, added: [], reason: null, plugins: [...have] };
  const merged = [...curLines.join('\n').replace(/\n*$/, '').split('\n')];
  for (const n of added) merged.push('', ...blocks.get(n));
  const toml = overlay(merged.join('\n'), { ...opt, source: 'suggest' });
  fs.writeFileSync(target, toml);
  return { code: 0, refreshed: true, added, reason: null, plugins: pluginNames(toml.split('\n')) };
}

// ---- 実行 -------------------------------------------------------------------

function biomeOpt(cwd) {
  const pkg = (() => { try { return JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')); } catch { return null; } })();
  const hasBiomeDep = Boolean(pkg?.devDependencies?.['@biomejs/biome'] || pkg?.dependencies?.['@biomejs/biome']);
  return { hasBiomeDep, biomeVersion: existingBiomeVersion(cwd) ?? BIOME_VERSION };
}

function run(o) {
  const cwd = path.resolve(o.cwd);
  const target = path.join(cwd, '.qlty/qlty.toml');
  if (fs.existsSync(target) && o.refresh && !o.force) return { ...refresh(cwd, target, biomeOpt(cwd)), mode: 'refresh' };
  if (fs.existsSync(target) && !o.force) return { code: 0, skipped: true, source: null, plugins: [], reason: '既存 (--force で作り直す、--refresh で提案の差分だけ足す)' };
  let base = null, source = 'fallback', reason = null;
  if (!o.fallback) {
    if (!qltyAvailable()) reason = 'qlty CLI が無い';
    else ({ toml: base, reason } = suggestToml(cwd));
    if (base) source = 'suggest';
  } else reason = '--fallback';
  if (!base) base = FALLBACK_TOML;
  const { hasBiomeDep, biomeVersion } = biomeOpt(cwd);
  const toml = overlay(base, { biomeVersion, source, hasBiomeDep });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, toml);
  return { code: 0, skipped: false, source, reason, biomeVersion, plugins: pluginNames(toml.split('\n')) };
}

function main(argv) {
  const o = parseArgs(argv);
  const r = run(o);
  if (r.mode === 'refresh') {
    if (r.refreshed) console.log(`genQlty --refresh: 提案で増えた plugins を追加: ${r.added.join(', ')} (合計: ${r.plugins.join(', ')})`);
    else console.log(`genQlty --refresh: 追加なし${r.reason ? ` (${r.reason})` : ''}`);
    return r.code;
  }
  if (r.skipped) { console.log(`genQlty: skip (${r.reason}): .qlty/qlty.toml`); return 0; }
  console.log(`genQlty: .qlty/qlty.toml (土台: ${r.source}${r.reason ? `, ${r.reason}` : ''}, biome ${r.biomeVersion})`);
  console.log(`  plugins: ${r.plugins.join(', ')}`);
  return r.code;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { parseArgs, run, overlay, suggestToml, refresh, FALLBACK_TOML, D2_EXCLUDES, PRUNE_EXCLUDES };
