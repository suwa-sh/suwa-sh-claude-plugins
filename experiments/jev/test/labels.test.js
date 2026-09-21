'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  patternLabels,
  modelTypeLabels,
  findRejectedZoneStart,
  classifyLine,
  isNameKeyLine,
  isLeadingTableCell,
} = require('../lib/labels');
const patterns = require('../patterns/patterns.json').patterns;

const SAMPLE_DOCS = path.resolve(__dirname, '..', '..', '..', 'samples', 'distillery', 'pipeline');

test('patternLabels: 見本で cache-aside が applied、cqrs が not_applied になる（レビュー指摘4）', () => {
  const labels = patternLabels(SAMPLE_DOCS, patterns);
  assert.equal(labels['cache-aside'].label, 'applied');
  assert.ok(labels['cache-aside'].occurrences.length > 0);
  assert.ok(labels['cache-aside'].occurrences.every((o) => o.classification === 'adopted'));
  assert.equal(labels['cqrs'].label, 'not_applied');
  assert.ok(labels['cqrs'].occurrences.every((o) => o.classification === 'rejected'));
});

test('patternLabels: sharding は言及自体が無く not_applied になる', () => {
  const labels = patternLabels(SAMPLE_DOCS, patterns);
  assert.equal(labels['sharding'].label, 'not_applied');
  assert.deepEqual(labels['sharding'].occurrences, []);
});

test('patternLabels: 見本で retry と timeout は applied になる（レビュー指摘7: name: キーの構造化された出現）', () => {
  const labels = patternLabels(SAMPLE_DOCS, patterns);
  // retry / timeout は強い別名を持たず一般語の別名（Retry/リトライ, Timeout/タイムアウト）のみだが、
  // 見本の arch-design.yaml には `name: "Retry + Circuit Breaker + Timeout"` という
  // 構造化された（YAML の name: キー）採用の文脈での出現があるため applied になる
  assert.equal(labels['retry'].label, 'applied');
  assert.ok(labels['retry'].occurrences.some((o) => o.structuredWeak && o.classification === 'adopted'));
  assert.equal(labels['timeout'].label, 'applied');
});

test('patternLabels: weakAliases の自由記述中の出現（構造化されていない）は ambiguous 寄与のまま', () => {
  const labels = patternLabels(SAMPLE_DOCS, patterns);
  // static-content-hosting は強い別名の出現が無く、CDN という一般語の別名が自由記述の中にしか出現しない
  assert.equal(labels['static-content-hosting'].label, 'ambiguous');
  assert.ok(labels['static-content-hosting'].occurrences.every((o) => o.classification === 'weak'));
});

test('isNameKeyLine / isLeadingTableCell: 構造化された採用の文脈を検出する', () => {
  assert.equal(isNameKeyLine('          name: "Retry + Circuit Breaker + Timeout"'), true);
  assert.equal(isNameKeyLine('          description: "Retry のことを書く"'), false);
  assert.equal(isLeadingTableCell('| Retry | 説明 | 根拠 |', 'Retry'), true);
  assert.equal(isLeadingTableCell('| SP-028 | Retry + Circuit Breaker + Timeout | 説明 | 根拠 |', 'Retry'), true);
  assert.equal(isLeadingTableCell('| ID | 名前 | 説明を含むRetryの文章 | 根拠 |', 'Retry'), false);
  assert.equal(isLeadingTableCell('|-----|------|------|', 'Retry'), false); // 見出し区切り行
});

test('patternLabels: adopted と rejected が混在すると ambiguous になる', () => {
  const labels = patternLabels(SAMPLE_DOCS, patterns);
  const mv = labels['materialized-view'];
  const hasAdopted = mv.occurrences.some((o) => o.classification === 'adopted');
  const hasRejected = mv.occurrences.some((o) => o.classification === 'rejected');
  assert.ok(hasAdopted && hasRejected, 'materialized-view の見本には採用と却下の両方の言及がある前提のテスト');
  assert.equal(mv.label, 'ambiguous');
});

test('patternLabels: 全パターンにエントリがある', () => {
  const labels = patternLabels(SAMPLE_DOCS, patterns);
  for (const pattern of patterns) {
    assert.ok(Object.hasOwn(labels, pattern.id), `missing label for ${pattern.id}`);
    assert.ok(['applied', 'not_applied', 'ambiguous'].includes(labels[pattern.id].label));
  }
});

test('findRejectedZoneStart: decision record の alternatives_considered 以降を検出する', () => {
  const text = ['schema_version: "1.0"', 'decision: |', '  foo', 'alternatives_considered:', '  - name: "x"'].join('\n');
  assert.equal(findRejectedZoneStart(text, true), 3);
  assert.equal(findRejectedZoneStart(text, false), null); // decision record でなければ判定しない
});

test('classifyLine: rejectedZone 内、またはキーワードを含む行は rejected', () => {
  assert.equal(classifyLine('  - name: "CQRS"', 5, 3), 'rejected'); // zone内
  assert.equal(classifyLine('CQRSは不採用とする', 0, null), 'rejected'); // キーワード
  assert.equal(classifyLine('Cache-Aside を採用する', 0, null), 'adopted');
});

test('modelTypeLabels: 仕様IDと種別集合が取れる', () => {
  const labels = modelTypeLabels(SAMPLE_DOCS);
  assert.ok(labels['SPEC-001-01'].has('actor'));
  assert.ok(labels['SPEC-001-01'].has('information'));
  assert.ok(labels['SPEC-001-01'].has('buc'));
  assert.ok(labels['SPEC-002-04'].has('external_system'));
  assert.ok(!labels['SPEC-002-04'].has('state'));
});
