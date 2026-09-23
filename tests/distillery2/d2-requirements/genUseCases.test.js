'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPTS = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-requirements/scripts');
const FIX = path.join(__dirname, 'fixtures');
const { ucId, generate } = require(path.join(SCRIPTS, 'genUseCases'));
const { parseYaml } = require(path.resolve(SCRIPTS, '../../../scripts/lib/yaml'));

const reqData = parseYaml(fs.readFileSync(path.join(FIX, 'requirements-pass.yaml'), 'utf8'));
const bucText = fs.readFileSync(path.join(FIX, 'BUC.tsv'), 'utf8');

const LOAN = '348d7250'; // Python 生成式で確認済み: ["貸出業務","書籍を貸し出すフロー","貸出を登録する"]

test('ucId は state-schema.md の生成式と一致する (NFC + canonical JSON)', () => {
  assert.equal(ucId(['貸出業務', '書籍を貸し出すフロー', '貸出を登録する']), LOAN);
  assert.equal(ucId(['貸出業務', '書籍を返却するフロー', '返却を登録する']), '22140691');
});

test('generate は UC を決定論的に導出する', () => {
  const a = generate(reqData, bucText, new Map());
  const b = generate(reqData, bucText, new Map());
  assert.deepEqual(a, b);
  assert.equal(a.use_cases.length, 3); // UC 空行 (システムを使わない作業) は除外
  const byUc = Object.fromEntries(a.use_cases.map(u => [u.uc, u]));
  assert.equal(byUc['貸出を登録する'].uc_id, LOAN);
});

test('slug は暫定 uc-<id> で一意', () => {
  const doc = generate(reqData, bucText, new Map());
  const slugs = doc.use_cases.map(u => u.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'slug が重複');
  assert.ok(doc.use_cases.every(u => u.slug === `uc-${u.uc_id}`));
});

test('spec_ids はフロー単位で推定される', () => {
  const byUc = Object.fromEntries(generate(reqData, bucText, new Map()).use_cases.map(u => [u.uc, u]));
  // 貸出フローの 2 SPEC が当たる (buc target "書籍を貸し出す")
  assert.deepEqual(byUc['貸出を登録する'].spec_ids, ['SPEC-001-01', 'SPEC-001-02']);
  // 対応する SPEC が無いフローは空
  assert.deepEqual(byUc['返却を登録する'].spec_ids, []);
});

test('actors と tiers_hint を導出する', () => {
  const byUc = Object.fromEntries(generate(reqData, bucText, new Map()).use_cases.map(u => [u.uc, u]));
  assert.deepEqual(byUc['貸出を登録する'].actors, ['司書']);
  assert.deepEqual(byUc['貸出を登録する'].tiers_hint, ['frontend', 'backend']); // 画面あり
  assert.deepEqual(byUc['リマインドを送信する'].actors, ['タイマー']);
  assert.deepEqual(byUc['リマインドを送信する'].tiers_hint, ['backend', 'worker']); // タイマー
});

test('既存 use-cases の slug/status/tiers_hint を uc_id で引き継ぐ', () => {
  const existing = new Map([[LOAN, { uc_id: LOAN, slug: 'register-a-loan', spec_ids: ['SPEC-001-01', 'SPEC-001-02'], status: 'in_progress' }]]);
  const byUc = Object.fromEntries(generate(reqData, bucText, existing).use_cases.map(u => [u.uc, u]));
  assert.equal(byUc['貸出を登録する'].slug, 'register-a-loan');
  assert.equal(byUc['貸出を登録する'].status, 'in_progress');
  // 既存 spec_ids が推定候補を網羅していれば追加はなく spec_ids_added は付かない
  assert.deepEqual(byUc['貸出を登録する'].spec_ids, ['SPEC-001-01', 'SPEC-001-02']);
  assert.ok(!('spec_ids_added' in byUc['貸出を登録する']));
});

test('spec_ids は既存値と新推定候補の和集合になり、追加分を spec_ids_added に記録する', () => {
  // LLM が SPEC-001-01 だけに絞った後、フローに SPEC-001-02 が新たに紐づいた状況を再現
  const existing = new Map([[LOAN, { uc_id: LOAN, slug: 'register-a-loan', spec_ids: ['SPEC-001-01'], status: 'planned' }]]);
  const byUc = Object.fromEntries(generate(reqData, bucText, existing).use_cases.map(u => [u.uc, u]));
  const uc = byUc['貸出を登録する'];
  assert.deepEqual(uc.spec_ids, ['SPEC-001-01', 'SPEC-001-02'], '和集合 (sorted/unique)');
  assert.deepEqual(uc.spec_ids_added, ['SPEC-001-02'], '新規に増えた候補だけを記録');
});

test('生成物は validateUseCases.js を通る', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2uc-'));
  const { stringifyYaml } = require(path.resolve(SCRIPTS, '../../../scripts/lib/yaml'));
  fs.copyFileSync(path.join(FIX, 'requirements-pass.yaml'), path.join(dir, 'requirements.yaml'));
  fs.writeFileSync(path.join(dir, 'use-cases.yaml'), stringifyYaml(generate(reqData, bucText, new Map())) + '\n');
  const r = spawnSync(process.execPath, [path.join(SCRIPTS, 'validateUseCases.js'), path.join(dir, 'use-cases.yaml')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
