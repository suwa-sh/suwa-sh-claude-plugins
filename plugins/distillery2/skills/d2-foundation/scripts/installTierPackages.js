#!/usr/bin/env node
'use strict';
/**
 * installTierPackages.js (F7) — ティア構成 ADR の tiers[].packages / dev_packages を各ティアの package.json に入れる (0.3.0)
 *
 *   node installTierPackages.js --adr docs/adr [--cwd <repo>] [--npm "npx npm@11"] [--dry-run]
 *
 * --npm: npm の代わりに使うコマンド (troubleshooting.md の npm 10 の回避策を F7 の npm install で使ったときは同じものを渡す)
 *
 * - ティア構成 ADR が決めた枠組み・DB のクライアント・認証のライブラリ (例 express / pg / jose) を、
 *   `npm install -w <tier の dir> <名前...>` (dev は `--save-dev`) で入れる。版は npm が解決する (推測で書かない)。
 * - 既に dependencies / devDependencies にある名前は入れない (冪等。手で固定した版を変えない)。
 * - lockfile の書き手は F7 だけなので、`npm install` の後 (F7 の中) に回す。
 * - 骨格がティアの依存を入れず、実装の段で毎回止まって基盤に戻っていた (会議室の予約の実地確認で実測)。
 *
 * 出力: JSON 1 行 {installed: [{tier, dir, packages, dev_packages}], skipped: [...]}。npm が失敗したら exit 1
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { loadAdrs, collectTiers } = require('./adr');

function parseArgs(argv) {
  const o = { cwd: process.cwd(), dryRun: false, npm: 'npm' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--adr') o.adr = argv[++i];
    else if (a === '--cwd') o.cwd = path.resolve(argv[++i]);
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--npm') o.npm = argv[++i];
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (!o.adr) throw new Error('--adr <dir> が要る');
  return o;
}

const names = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : []);

/** 入れる計画 (純関数に近い: package.json を読むだけ) */
function plan(cwd, tiers) {
  const out = [];
  for (const t of tiers) {
    // 骨格 (genSkeleton) と同じ解決: dir の先頭の apps/ を外して apps/<dir> (dir が無ければ id)
    const dir = `apps/${String(t.dir || t.id).replace(/^apps\//, '')}`;
    const pkgPath = path.join(cwd, dir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      if (names(t.packages).length || names(t.dev_packages).length) throw new Error(`${dir}/package.json が無い (ティア ${t.id} の packages を入れられない。骨格 F5 を先に回す)`);
      continue;
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const have = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]);
    const packages = names(t.packages).filter((n) => !have.has(n));
    const dev = names(t.dev_packages).filter((n) => !have.has(n) && !packages.includes(n));
    out.push({ tier: t.id, dir, packages, dev_packages: dev });
  }
  return out;
}

function npm(cwd, args, cmd = 'npm') {
  const [bin, ...pre] = String(cmd).trim().split(/\s+/);
  const r = spawnSync(bin, [...pre, ...args], { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`npm ${args.join(' ')} が失敗 (exit ${r.status}): ${String(r.stderr || r.stdout).trim().split('\n').slice(-5).join(' / ')}`);
}

function run(o) {
  const { tiers } = collectTiers(loadAdrs(path.resolve(o.cwd, o.adr)));
  const steps = plan(o.cwd, tiers);
  const installed = [], skipped = [];
  for (const s of steps) {
    if (!s.packages.length && !s.dev_packages.length) { skipped.push(s.tier); continue; }
    if (!o.dryRun) {
      if (s.packages.length) npm(o.cwd, ['install', '-w', s.dir, '--save', ...s.packages], o.npm);
      if (s.dev_packages.length) npm(o.cwd, ['install', '-w', s.dir, '--save-dev', ...s.dev_packages], o.npm);
    }
    installed.push(s);
  }
  return { installed, skipped, dry_run: o.dryRun };
}

function main(argv) {
  let o;
  try { o = parseArgs(argv); } catch (e) { console.error(e.message); return 2; }
  try { console.log(JSON.stringify(run(o))); return 0; } catch (e) { console.error(e.message); return 1; }
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { plan, run, parseArgs };
