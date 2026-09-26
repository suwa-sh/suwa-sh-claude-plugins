#!/usr/bin/env node
'use strict';

/**
 * classifyContractChanges.js --uc <slug> [--contracts <dir>] [--cwd <dir>] [--files-from <file>] [--json]
 *
 * 段階④ contract の受理時に、変わった契約の生成物を「この UC の分 / 他 UC の分 / 共有」に分ける。
 * 契約は UC 間で共有するので、enum の追加などで他 UC のテストや共有の型も書き換わる (0.1.16 実走)。
 * その変化を UC の差分に紛れさせず、人レビューの材料に載せるための分類。
 *
 * 対象 (契約の生成物): `apps/<tier>/test/contract/**`、`apps/<tier>/migrations/**`、`packages/contracts/**`、`contracts/generated/**`
 *  - own:      この UC の operation の `<operationId>.test.ts`、この UC の slice (`contracts/generated/slices/<slug>/**`)。
 *              同じ operation を使う他 UC を `also_used_by` に併記する (共有 operation の変更は他 UC にも効く)
 *  - other_uc: 他 UC の operation の `<operationId>.test.ts`、他 UC の slice。使う UC を `used_by` に併記
 *              (uc-index に無い operation は used_by が空)
 *  - shared:   それ以外の生成物 (`messages.test.ts`、`db-schema.test.ts`、DDL、`packages/contracts/**`、bundle)
 * 生成物でないファイル (分割ファイルの `contracts/openapi/**` など) は数だけ `ignored` に出す。
 *
 * 変更ファイルは既定で `git status --porcelain --untracked-files=all` から取る。`--files-from` は 1 行 1 パス (テスト用)。
 * 終了コード: 0 = 分類できた / 2 = 引数・読み込みの誤り。
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const C = require('./lib/contractsDir');

const GENERATED = [
  /^apps\/[^/]+\/test\/contract\//,
  /^apps\/[^/]+\/migrations\//,
  /^packages\/contracts\//,
  /^contracts\/generated\//,
];

/**
 * `git status --porcelain` の 1 行からパスを取る。rename / copy は旧・新の両方を返す
 * (他 UC のテストの改名で「旧テストが消えた」ことも分類に残すため)。quotepath=off 前提で引用符だけ外す
 */
function pathsOfPorcelain(line) {
  if (line.length < 4) return [];
  const unquote = p => (p.startsWith('"') && p.endsWith('"') ? p.slice(1, -1) : p);
  const rest = line.slice(3);
  const arrow = rest.indexOf(' -> ');
  return arrow >= 0 ? [unquote(rest.slice(0, arrow)), unquote(rest.slice(arrow + 4))] : [unquote(rest)];
}

function classify({ slug, ucIndex, files }) {
  const usedBy = new Map(); // operationId -> [slug]
  for (const uc of ucIndex.ucs || []) {
    for (const op of uc.operations || []) {
      if (!usedBy.has(op)) usedBy.set(op, []);
      usedBy.get(op).push(uc.slug);
    }
  }
  const slugs = new Set((ucIndex.ucs || []).map(u => u.slug));
  const out = { uc: slug, own: [], other_uc: [], shared: [], ignored: 0 };
  for (const raw of files) {
    const file = String(raw).replace(/\\/g, '/').replace(/^\.\//, '');
    if (!file) continue;
    if (!GENERATED.some(re => re.test(file))) { out.ignored++; continue; }
    const slice = file.match(/^contracts\/generated\/slices\/([^/]+)\//);
    if (slice && slugs.has(slice[1])) {
      if (slice[1] === slug) out.own.push({ file, slice: slug, also_used_by: [] });
      else out.other_uc.push({ file, slice: slice[1], used_by: [slice[1]] });
      continue;
    }
    const test = file.match(/^apps\/[^/]+\/test\/contract\/([^/]+)\.test\.ts$/);
    if (test && usedBy.has(test[1])) {
      const users = usedBy.get(test[1]);
      if (users.includes(slug)) out.own.push({ file, operation: test[1], also_used_by: users.filter(s => s !== slug) });
      else out.other_uc.push({ file, operation: test[1], used_by: users });
      continue;
    }
    // uc-index に無い operation のテスト (改名・未登録) は他 UC 扱い。使う UC は分からない
    if (test && !['messages', 'db-schema'].includes(test[1])) { out.other_uc.push({ file, operation: test[1], used_by: [] }); continue; }
    out.shared.push(file);
  }
  return out;
}

function changedFiles(cwd) {
  const text = execFileSync('git', ['-c', 'core.quotepath=off', 'status', '--porcelain', '--untracked-files=all'], { cwd, encoding: 'utf8' });
  return text.split('\n').flatMap(pathsOfPorcelain).filter(Boolean);
}

function argVal(args, name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; }

function main(argv) {
  const slug = argVal(argv, '--uc');
  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) { console.error('Usage: classifyContractChanges.js --uc <slug> [--contracts <dir>] [--cwd <dir>] [--files-from <file>] [--json]'); return 2; }
  const cwd = path.resolve(argVal(argv, '--cwd') || '.');
  const contractsDir = path.resolve(cwd, argVal(argv, '--contracts') || 'contracts');
  let ucIndex;
  try { ucIndex = C.readUcIndex(contractsDir); } catch (e) { console.error(e.message); return 2; }
  const from = argVal(argv, '--files-from');
  let files;
  try { files = from ? fs.readFileSync(path.resolve(cwd, from), 'utf8').split('\n') : changedFiles(cwd); } catch (e) { console.error(e.message); return 2; }
  const r = classify({ slug, ucIndex, files });
  if (argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); return 0; }
  const also = r.own.filter(o => o.also_used_by.length);
  console.log(`contract changes (${slug}): own=${r.own.length} (他 UC と共有 ${also.length}) other_uc=${r.other_uc.length} shared=${r.shared.length} ignored=${r.ignored}`);
  for (const o of also) console.log(`  own+shared-op  ${o.file}  (also used by: ${o.also_used_by.join(', ')})`);
  for (const o of r.other_uc) console.log(`  other_uc       ${o.file}  (used by: ${o.used_by.join(', ') || '不明'})`);
  for (const f of r.shared) console.log(`  shared         ${f}`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { classify, pathsOfPorcelain };
