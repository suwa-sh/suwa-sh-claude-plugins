#!/usr/bin/env node
/**
 * validateAdr.js (distillery2)
 *
 * docs/adr/ 配下の ADR (NNNN-<slug>.md) 群を検証する。
 *
 * Usage:
 *   node validateAdr.js <adr-dir> [--json]
 *
 * 検証内容:
 *   1. front matter のスキーマ (schema-adr.json)
 *   2. id の一意性 (ディレクトリ横断)
 *   3. ファイル名の番号と front matter の id の一致
 *   4. supersedes / superseded_by の参照整合性 (双方向リンク)
 *   5. ステータス遷移 (superseded_by を持つなら status: superseded)
 *   6. rules[].scope の書式 (schema で検証)
 *   7. ティア構成の追加 front matter:
 *      - tiers[] を宣言する accepted ADR はちょうど 1 つ (0 件・2 件以上はエラー)
 *      - その ADR は tiers[].id を指す datastore_owner を持つ (他の ADR には不要)
 *      - capabilities は任意だが、あるなら { browser: boolean } (schema で検証)
 *   8. rules[] のカバレッジ (下流の rules 文書 / アーキテスト生成の入力):
 *      - scope に system/app/data/testing/ui を含む accepted ADR は rules[] を最低 1 つ持つ (infra 専用は不要)
 *      - ティア構成 ADR は arch_test を持つ rule を最低 1 つ持つ
 *      - accepted な app scope ADR があるなら、そのうち最低 1 つが arch_test (レイヤ依存規則) を持つ
 *
 * 終了コード: 0 = PASS / 1 = エラー / 2 = 読み込み失敗
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseYaml } = require('../../../scripts/lib/yaml');
const { validateWithSchema } = require('../../../scripts/lib/schemaValidate');

const ADR_FILE_RE = /^([0-9]{4})-.+\.md$/;

/** 先頭の --- で挟まれた YAML front matter を取り出してパースする */
function parseFrontMatter(text) {
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (lines[i]?.trim() !== '---') return null;
  const start = i + 1;
  let end = -1;
  for (let j = start; j < lines.length; j++) {
    if (lines[j].trim() === '---') { end = j; break; }
  }
  if (end < 0) return null;
  return parseYaml(lines.slice(start, end).join('\n'));
}

function loadAdrDir(dir) {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema-adr.json'), 'utf8'));
  const files = fs.readdirSync(dir).filter(f => ADR_FILE_RE.test(f)).sort();
  const adrs = [];
  const errors = [];
  for (const file of files) {
    const filePrefix = file.match(ADR_FILE_RE)[1];
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    const fm = parseFrontMatter(text);
    if (!fm) { errors.push({ file, message: 'front matter (--- で挟む YAML) が見つからない' }); continue; }
    for (const e of validateWithSchema(fm, schema)) errors.push({ file, message: `${e.path}: ${e.message}` });
    if (fm.id && fm.id !== filePrefix) errors.push({ file, message: `ファイル名の番号 ${filePrefix} と front matter の id ${fm.id} が一致しない` });
    adrs.push({ file, fm });
  }
  return { adrs, errors };
}

/** スキーマでは表現できない ADR 群の整合性チェック */
function crossAdrErrors(adrs) {
  const errors = [];
  const byId = new Map();
  for (const { file, fm } of adrs) {
    if (!fm.id) continue;
    if (byId.has(fm.id)) errors.push({ file, message: `id ${fm.id} が重複している (${byId.get(fm.id).file} と衝突)` });
    else byId.set(fm.id, { file, fm });
  }
  for (const { file, fm } of adrs) {
    if (!fm.id) continue;
    const sb = fm.superseded_by;
    if (sb) {
      const target = byId.get(sb);
      if (!target) errors.push({ file, message: `superseded_by ${sb} の ADR が存在しない (dangling)` });
      else if (!(target.fm.supersedes || []).includes(fm.id)) errors.push({ file, message: `superseded_by ${sb} だが、${sb} の supersedes に ${fm.id} が無い (双方向リンク不整合)` });
      if (fm.status !== 'superseded') errors.push({ file, message: `superseded_by を持つ ADR は status: superseded であるべき (現在: ${fm.status})` });
    }
    if (fm.status === 'superseded' && !sb) errors.push({ file, message: 'status: superseded だが superseded_by が無い' });
    for (const s of fm.supersedes || []) {
      const target = byId.get(s);
      if (!target) errors.push({ file, message: `supersedes ${s} の ADR が存在しない (dangling)` });
      else if (target.fm.superseded_by !== fm.id) errors.push({ file, message: `supersedes ${s} だが、${s} の superseded_by が ${fm.id} でない (双方向リンク不整合)` });
    }
  }
  return errors;
}

const isAccepted = fm => String(fm.status).toLowerCase() === 'accepted';
const hasScope = (fm, s) => (Array.isArray(fm.scope) ? fm.scope.includes(s) : fm.scope === s);
const hasAnyScope = (fm, scopes) => scopes.some(s => hasScope(fm, s));
const declaresTiers = fm => Array.isArray(fm.tiers) && fm.tiers.length > 0;
const ruleHasArchTest = r => Boolean(r && r.arch_test && typeof r.arch_test === 'object');

// rules[] を最低 1 つ要求する scope。infra 専用の ADR は rules を持たなくてよい。
const SCOPES_REQUIRING_RULES = ['system', 'app', 'data', 'testing', 'ui'];

/**
 * ティア構成 ADR (tiers[] を宣言する accepted ADR) の存在と datastore_owner を検証する。
 * - tiers[] を宣言する accepted ADR はちょうど 1 つ (0 件・2 件以上はエラー)。
 * - その ADR だけが datastore_owner を持てばよく、値は自分の tiers[].id と一致する。
 * scope に system を含む一般の ADR には tiers[] を要求しない (決定領域ごとに ADR を分けられる)。
 */
function tierStructureErrors(adrs) {
  const errors = [];
  const declaring = adrs.filter(a => isAccepted(a.fm) && declaresTiers(a.fm));
  if (declaring.length === 0) {
    errors.push({ file: '(なし)', message: 'ティア構成の ADR が無い (tiers[] を宣言する accepted ADR がちょうど 1 つ必要)' });
    return errors;
  }
  if (declaring.length > 1) {
    errors.push({ file: declaring.map(d => d.file).join(', '), message: `tiers[] を宣言する accepted ADR は 1 つだけにする (${declaring.length} 件が宣言している)` });
  }
  for (const { file, fm } of declaring) {
    const ids = new Set(fm.tiers.map(t => t && t.id).filter(Boolean));
    if (!fm.datastore_owner) {
      errors.push({ file, message: 'ティア構成 ADR (tiers[] を宣言する) は datastore_owner を持つ必要がある' });
    } else if (!ids.has(fm.datastore_owner)) {
      errors.push({ file, message: `datastore_owner "${fm.datastore_owner}" が tiers[].id のいずれにも一致しない` });
    }
  }
  return errors;
}

/**
 * rules[] のカバレッジを検証する (下流 genRules / genArchTests の入力を担保する)。
 * - scope に system/app/data/testing/ui を含む accepted ADR は rules[] を最低 1 つ持つ (infra 専用は不要)。
 * - ティア構成 ADR (tiers[] を宣言) は arch_test を持つ rule を最低 1 つ持つ (依存方向の機械検証)。
 * - accepted な app scope ADR があるなら、そのうち最低 1 つが arch_test (レイヤ依存規則) を持つ。
 */
function ruleCoverageErrors(adrs) {
  const errors = [];
  const accepted = adrs.filter(a => isAccepted(a.fm));
  for (const { file, fm } of accepted) {
    if (!hasAnyScope(fm, SCOPES_REQUIRING_RULES)) continue; // infra 専用など
    if (!Array.isArray(fm.rules) || fm.rules.length === 0) {
      errors.push({ file, message: 'scope に system/app/data/testing/ui を含む accepted ADR は rules[] を最低 1 つ持つ必要がある' });
    }
  }
  for (const { file, fm } of accepted.filter(a => declaresTiers(a.fm))) {
    const rules = Array.isArray(fm.rules) ? fm.rules : [];
    if (!rules.some(ruleHasArchTest)) {
      errors.push({ file, message: 'ティア構成 ADR は arch_test を持つ rule を最低 1 つ持つ必要がある (依存方向の機械検証)' });
    }
  }
  const appAdrs = accepted.filter(a => hasScope(a.fm, 'app'));
  if (appAdrs.length && !appAdrs.some(a => (Array.isArray(a.fm.rules) ? a.fm.rules : []).some(ruleHasArchTest))) {
    errors.push({ file: appAdrs.map(a => a.file).join(', '), message: 'scope に app を含む accepted ADR のうち最低 1 つは arch_test (レイヤ依存規則) を持つ必要がある' });
  }
  return errors;
}

function validateAdrDir(dir) {
  const { adrs, errors } = loadAdrDir(dir);
  errors.push(...crossAdrErrors(adrs));
  errors.push(...tierStructureErrors(adrs));
  errors.push(...ruleCoverageErrors(adrs));
  return { adrs, errors };
}

function main(argv) {
  const args = argv.filter(a => !a.startsWith('--'));
  const flags = new Set(argv.filter(a => a.startsWith('--')));
  if (!args.length) { console.error('Usage: node validateAdr.js <adr-dir> [--json]'); return 2; }
  const dir = path.resolve(args[0]);
  if (!fs.existsSync(dir)) { console.error(`Directory not found: ${dir}`); return 2; }
  const { adrs, errors } = validateAdrDir(dir);
  if (!errors.length) {
    console.log(`PASS: ${dir}`);
    console.log(`  ADRs: ${adrs.length}`);
    if (flags.has('--json')) console.log(JSON.stringify({ status: 'pass', count: adrs.length }, null, 2));
    return 0;
  }
  console.log(`FAIL: ${dir}`);
  console.log(`  ${errors.length} error(s):`);
  for (const e of errors) console.log(`  - ${e.file}: ${e.message}`);
  if (flags.has('--json')) console.log(JSON.stringify({ status: 'fail', errors }, null, 2));
  return 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { parseFrontMatter, loadAdrDir, crossAdrErrors, tierStructureErrors, ruleCoverageErrors, validateAdrDir };
