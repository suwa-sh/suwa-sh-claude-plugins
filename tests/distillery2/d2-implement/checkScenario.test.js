'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { check } = require('../../../plugins/distillery2/skills/d2-implement/scripts/checkScenario');

function setup(featureText) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-scn-'));
  const useCases = path.join(dir, 'use-cases.yaml');
  const requirements = path.join(dir, 'requirements.yaml');
  const feature = path.join(dir, 'register-loan.feature');
  fs.writeFileSync(useCases, ['use_cases:', '  - business: 貸出業務', '    uc: 貸出を登録する', '    slug: register-loan', '    spec_ids: [SPEC-002-01]'].join('\n'));
  fs.writeFileSync(requirements, ['requirements:', '  - id: REQ-002', '    specifications:', '      - id: SPEC-002-01', '        acceptance_criteria:', '          - "Given 在庫あり When 貸し出す Then 記録される"', '          - "Given 上限到達 When 貸し出す Then 拒否される"'].join('\n'));
  fs.writeFileSync(feature, featureText);
  return { dir, useCases, requirements, feature };
}

const FULL = `# language: ja
@uc:register-loan
機能: 貸出を登録する
  @acceptance @acceptance:SPEC-002-01-1
  シナリオ: 在庫のある書籍を貸し出す
    もし 司書が貸し出す
    ならば 記録される
  @acceptance @acceptance:SPEC-002-01-2 @browser
  シナリオ: 上限に達している
    もし 司書が貸し出す
    ならば 拒否される
`;

test('fully covered feature passes and reports browser count', () => {
  const s = setup(FULL);
  const r = check({ files: [s.feature], useCases: s.useCases, requirements: s.requirements });
  assert.equal(r.ok, true);
  assert.equal(r.slug, 'register-loan');
  assert.equal(r.scenarios, 2);
  assert.equal(r.browser, 1);
  assert.deepEqual(r.covered, ['SPEC-002-01-1', 'SPEC-002-01-2']);
});

test('missing acceptance mapping, unknown tag and missing uc tag are reported', () => {
  const s = setup(FULL.replace('@acceptance @acceptance:SPEC-002-01-2 @browser', '@acceptance @acceptance:SPEC-999-01-1').replace('@uc:register-loan\n', ''));
  const r = check({ files: [s.feature], useCases: s.useCases, requirements: s.requirements, uc: 'register-loan' });
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing.map(m => m.tag), ['@acceptance:SPEC-002-01-2']);
  assert.deepEqual(r.unknown_tags, ['@acceptance:SPEC-999-01-1']);
  assert.ok(r.errors.some(e => e.includes('@uc:')));
});

test('cross-UC acceptance feature in --acceptance-dir counts as coverage', () => {
  const s = setup(FULL.replace('  @acceptance @acceptance:SPEC-002-01-2 @browser\n', ''));
  const accDir = path.join(s.dir, 'acceptance');
  fs.mkdirSync(accDir);
  fs.writeFileSync(path.join(accDir, 'SPEC-002-01.feature'), '@uc:register-loan\nFeature: cross\n  @acceptance @acceptance:SPEC-002-01-2\n  Scenario: limit\n    Then rejected\n');
  const r = check({ files: [s.feature], useCases: s.useCases, requirements: s.requirements, acceptanceDir: accDir });
  assert.equal(r.ok, true);
});

test('acceptance scenarios of another UC do not count as coverage', () => {
  const s = setup(FULL.replace('  @acceptance @acceptance:SPEC-002-01-2 @browser\n', ''));
  const accDir = path.join(s.dir, 'acceptance');
  fs.mkdirSync(accDir);
  fs.writeFileSync(path.join(accDir, 'SPEC-002-01.feature'), '@uc:return-book\nFeature: other\n  @acceptance @acceptance:SPEC-002-01-2\n  Scenario: limit\n    Then rejected\n');
  const r = check({ files: [s.feature], useCases: s.useCases, requirements: s.requirements, acceptanceDir: accDir });
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing.map(m => m.tag), ['@acceptance:SPEC-002-01-2']);
});

test('marker tag @acceptance and criteria tags must appear together', () => {
  const s = setup(FULL.replace('  @acceptance @acceptance:SPEC-002-01-1\n', '  @acceptance:SPEC-002-01-1\n'));
  const r = check({ files: [s.feature], useCases: s.useCases, requirements: s.requirements });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => /印の @acceptance がありません/.test(e)), r.errors.join(';'));
  const s2 = setup(FULL.replace('  @acceptance @acceptance:SPEC-002-01-1\n', '  @acceptance\n'));
  const r2 = check({ files: [s2.feature], useCases: s2.useCases, requirements: s2.requirements });
  assert.ok(r2.errors.some(e => /@acceptance だけで/.test(e)), r2.errors.join(';'));
});

test('a UC without spec_ids is rejected instead of passing on an empty set', () => {
  const s = setup(FULL);
  fs.writeFileSync(s.useCases, ['use_cases:', '  - business: 貸出業務', '    uc: 貸出を登録する', '    slug: register-loan', '    spec_ids: []'].join('\n'));
  const r = check({ files: [s.feature], useCases: s.useCases, requirements: s.requirements });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => /spec_ids がありません/.test(e)), r.errors.join(';'));
});

test('0.1.32 J1: 共有の SPEC (他 UC の振る舞いを含む) は自分のシナリオで覆えず missing になる。SPEC を UC 単位に分けて spec_ids / spec_ids_rejected を整えると missing が空になる', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-scn-'));
  const useCases = path.join(dir, 'use-cases.yaml');
  const requirements = path.join(dir, 'requirements.yaml');
  const feature = path.join(dir, 'register-book.feature');
  // 共有の SPEC-001-01 に 登録・編集・削除 の受入基準が混ざっている (0.1.30 N13・0.1.31 O6 の形)
  fs.writeFileSync(requirements, ['requirements:', '  - id: REQ-001', '    specifications:', '      - id: SPEC-001-01', '        acceptance_criteria:', '          - "Given 書籍情報 When 登録する Then 一覧に出る"', '          - "Given 登録済み When 編集する Then 更新される"', '          - "Given 登録済み When 削除する Then 一覧から消える"'].join('\n'));
  fs.writeFileSync(useCases, ['use_cases:', '  - business: 蔵書管理', '    uc: 書籍を登録する', '    slug: register-book', '    spec_ids: [SPEC-001-01]', '  - business: 蔵書管理', '    uc: 書籍を編集する', '    slug: edit-book', '    spec_ids: [SPEC-001-01]'].join('\n'));
  fs.writeFileSync(feature, ['# language: ja', '@uc:register-book', '機能: 書籍を登録する', '  @acceptance @acceptance:SPEC-001-01-1', '  シナリオ: 登録する', '    もし 登録する', '    ならば 一覧に出る', ''].join('\n'));
  let r = check({ files: [feature], useCases, requirements });
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing.map(m => m.tag), ['@acceptance:SPEC-001-01-2', '@acceptance:SPEC-001-01-3'], '他 UC の振る舞いの受入基準が残る');
  // 要求の差分で SPEC を UC 単位に分け、spec_ids を整える (元の共有 SPEC は spec_ids_rejected へ)
  fs.writeFileSync(requirements, ['requirements:', '  - id: REQ-001', '    specifications:', '      - id: SPEC-001-01', '        acceptance_criteria:', '          - "Given 書籍情報 When 登録する Then 一覧に出る"', '      - id: SPEC-001-02', '        acceptance_criteria:', '          - "Given 登録済み When 編集する Then 更新される"', '      - id: SPEC-001-03', '        acceptance_criteria:', '          - "Given 登録済み When 削除する Then 一覧から消える"'].join('\n'));
  fs.writeFileSync(useCases, ['use_cases:', '  - business: 蔵書管理', '    uc: 書籍を登録する', '    slug: register-book', '    spec_ids: [SPEC-001-01]', '    spec_ids_rejected: [SPEC-001-02, SPEC-001-03]', '  - business: 蔵書管理', '    uc: 書籍を編集する', '    slug: edit-book', '    spec_ids: [SPEC-001-02]', '    spec_ids_rejected: [SPEC-001-01]'].join('\n'));
  r = check({ files: [feature], useCases, requirements });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.missing, []);
});
