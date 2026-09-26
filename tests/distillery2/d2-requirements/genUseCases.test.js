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

test('既存 use-cases の no_spec_reason (blocked の理由) を引き継ぐ (再生成で消えて validate が落ちていた。0.1.16)', () => {
  const existing = new Map([[LOAN, { uc_id: LOAN, slug: 'register-a-loan', spec_ids: [], status: 'blocked', no_spec_reason: '要求に無い (テスト)' }]]);
  const byUc = Object.fromEntries(generate(reqData, bucText, existing).use_cases.map(u => [u.uc, u]));
  assert.equal(byUc['貸出を登録する'].no_spec_reason, '要求に無い (テスト)');
  assert.equal(byUc['貸出を登録する'].status, 'blocked');
  // 既存に無ければキーごと出さない
  const other = Object.values(byUc).find(u => u.uc !== '貸出を登録する');
  assert.ok(other && !('no_spec_reason' in other), '既存に無ければキーごと出さない');
  // blocked の UC に新しい候補が付いても spec_ids には入れない (理由と両立しない)。候補は spec_ids_added にだけ出て validate を通る (Codex 0.1.16 指摘 2)
  const loan = byUc['貸出を登録する'];
  assert.deepEqual(loan.spec_ids, [], 'spec_ids は空のまま');
  assert.ok(Array.isArray(loan.spec_ids_added) && loan.spec_ids_added.length > 0, '候補は spec_ids_added に出る');
  assert.equal(loan.status, 'blocked'); assert.equal(loan.no_spec_reason, '要求に無い (テスト)');
});

test('spec_ids は既存値と新推定候補の和集合になり、追加分を spec_ids_added に記録する', () => {
  // LLM が SPEC-001-01 だけに絞った後、フローに SPEC-001-02 が新たに紐づいた状況を再現
  const existing = new Map([[LOAN, { uc_id: LOAN, slug: 'register-a-loan', spec_ids: ['SPEC-001-01'], status: 'planned' }]]);
  const byUc = Object.fromEntries(generate(reqData, bucText, existing).use_cases.map(u => [u.uc, u]));
  const uc = byUc['貸出を登録する'];
  assert.deepEqual(uc.spec_ids, ['SPEC-001-01', 'SPEC-001-02'], '和集合 (sorted/unique)');
  assert.deepEqual(uc.spec_ids_added, ['SPEC-001-02'], '新規に増えた候補だけを記録');
});

test('spec_ids_rejected の SPEC は再生成で spec_ids へ戻らない', () => {
  // LLM が SPEC-001-02 を却下 (spec_ids から外し spec_ids_rejected へ移動) した状況を再現
  const existing = new Map([[LOAN, { uc_id: LOAN, slug: 'register-a-loan', spec_ids: ['SPEC-001-01'], spec_ids_rejected: ['SPEC-001-02'], status: 'planned' }]]);
  const byUc = Object.fromEntries(generate(reqData, bucText, existing).use_cases.map(u => [u.uc, u]));
  const uc = byUc['貸出を登録する'];
  assert.deepEqual(uc.spec_ids, ['SPEC-001-01'], '却下済み候補は spec_ids へ戻らない');
  assert.deepEqual(uc.spec_ids_rejected, ['SPEC-001-02'], 'spec_ids_rejected は uc_id で引き継ぐ');
  assert.ok(!('spec_ids_added' in uc), '却下済みは新規候補にならない');
});

test('新規 UC は空の spec_ids_rejected を持つ (LLM が却下 id を移す置き場)', () => {
  const byUc = Object.fromEntries(generate(reqData, bucText, new Map()).use_cases.map(u => [u.uc, u]));
  assert.deepEqual(byUc['貸出を登録する'].spec_ids_rejected, []);
});

const { stringifyYaml } = require(path.resolve(SCRIPTS, '../../../scripts/lib/yaml'));

/** spec_ids が空の UC は no_spec_reason + status: blocked にして validate を通す (指摘2 の逃げ道)。 */
function fillEmpties(doc) {
  for (const uc of doc.use_cases) {
    if (!uc.spec_ids.length) { uc.no_spec_reason = '対応 SPEC が未確定 (テスト)'; uc.status = 'blocked'; }
  }
  return doc;
}

test('spec_ids を埋めた (または no_spec_reason を書いた) 生成物は validateUseCases.js を通る', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2uc-'));
  fs.copyFileSync(path.join(FIX, 'requirements-pass.yaml'), path.join(dir, 'requirements.yaml'));
  fs.writeFileSync(path.join(dir, 'use-cases.yaml'), stringifyYaml(fillEmpties(generate(reqData, bucText, new Map()))) + '\n');
  const r = spawnSync(process.execPath, [path.join(SCRIPTS, 'validateUseCases.js'), path.join(dir, 'use-cases.yaml')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('spec_ids が空のままの生成物は validateUseCases.js で FAIL する (指摘2)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2uc-'));
  fs.copyFileSync(path.join(FIX, 'requirements-pass.yaml'), path.join(dir, 'requirements.yaml'));
  fs.writeFileSync(path.join(dir, 'use-cases.yaml'), stringifyYaml(generate(reqData, bucText, new Map())) + '\n');
  const r = spawnSync(process.execPath, [path.join(SCRIPTS, 'validateUseCases.js'), path.join(dir, 'use-cases.yaml')], { encoding: 'utf8' });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /spec_ids が空/);
});

test('genUseCases は spec_ids が空の UC を警告に列挙する (指摘2)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2uc-'));
  fs.copyFileSync(path.join(FIX, 'requirements-pass.yaml'), path.join(dir, 'requirements.yaml'));
  fs.copyFileSync(path.join(FIX, 'BUC.tsv'), path.join(dir, 'BUC.tsv'));
  const r = spawnSync(process.execPath, [path.join(SCRIPTS, 'genUseCases.js'), path.join(dir, 'requirements.yaml'), path.join(dir, 'BUC.tsv'), path.join(dir, 'use-cases.yaml')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stderr, /spec_ids が空の UC/);
});

test('壊れた既存 use-cases.yaml があると genUseCases は上書きせず exit 2 / --force-rebuild で作り直す (指摘7)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2uc-'));
  fs.copyFileSync(path.join(FIX, 'requirements-pass.yaml'), path.join(dir, 'requirements.yaml'));
  fs.copyFileSync(path.join(FIX, 'BUC.tsv'), path.join(dir, 'BUC.tsv'));
  const out = path.join(dir, 'use-cases.yaml');
  const broken = 'version: "1.0"\nuse_cases: broken-not-a-list\n'; // use_cases が配列にならない構文誤り
  fs.writeFileSync(out, broken);
  const args = [path.join(SCRIPTS, 'genUseCases.js'), path.join(dir, 'requirements.yaml'), path.join(dir, 'BUC.tsv'), out];
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /解析に失敗/);
  assert.equal(fs.readFileSync(out, 'utf8'), broken, '壊れたファイルを上書きしない');
  const r2 = spawnSync(process.execPath, [...args, '--force-rebuild'], { encoding: 'utf8' });
  assert.equal(r2.status, 0, r2.stdout + r2.stderr);
  assert.notEqual(fs.readFileSync(out, 'utf8'), broken, '--force-rebuild で作り直す');
});
