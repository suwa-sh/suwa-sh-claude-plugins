'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const reviewRoot = path.join(root, 'plugins/distillery-impl/skills/dist-impl-review');
const reviewSkill = fs.readFileSync(path.join(reviewRoot, 'SKILL.md'), 'utf8');
const reviewTemplate = fs.readFileSync(path.join(reviewRoot, 'references/review-html-template.md'), 'utf8');
const reviewStageInstructions = fs.readFileSync(
  path.join(root, 'plugins/distillery-impl/skills/dist-impl-run/references/stage-instructions/S9_review.md'),
  'utf8',
);
const runSkill = fs.readFileSync(path.join(root, 'plugins/distillery-impl/skills/dist-impl-run/SKILL.md'), 'utf8');

test('human review is organized around the UC, specification, operation, and verification', () => {
  for (const required of [
    'UCとレビュー対象仕様',
    '実装の構成',
    '処理フロー',
    'データフロー',
    '動かし方',
    'テストと確認方法',
    '現在の差分と制約',
  ]) {
    assert.match(reviewTemplate, new RegExp(required), `review template must include ${required}`);
  }
  assert.doesNotMatch(reviewTemplate, /Verifier反証と解決/);
  assert.match(reviewSkill, /主役を「UCそのもの」「レビュー対象の仕様」「完成した実装」に置く/);
  assert.match(reviewSkill, /9セクション名/);
  assert.match(reviewSkill, /成功数\/総数/);
  assert.match(reviewStageInstructions, /UCの目的・actor・trigger・入力・出力・業務ルール・受け入れ条件/);
});

test('human review requires accessible static architecture, process, and data diagrams', () => {
  for (const required of ['構成図', '処理フロー図', 'データフロー図', 'inline SVG', 'figcaption', 'テキスト代替']) {
    assert.match(reviewSkill, new RegExp(required), `review skill must require ${required}`);
  }
  assert.match(reviewTemplate, /外部runtimeなし/);
  assert.match(reviewTemplate, /1図はおおむね9 node以内/);
  assert.match(reviewTemplate, /色だけに意味を持たせない/);
});

test('reader-facing review omits attempt history and translates internal codes to names', () => {
  for (const text of [reviewSkill, reviewTemplate, reviewStageInstructions]) {
    assert.match(text, /attempt.*表示しない|attempt.*生成しない/s);
  }
  for (const expectedName of ['仕様入力の確認', '独立検証', 'UC統合テスト', '受け入れテスト', '人レビュー']) {
    assert.match(reviewTemplate, new RegExp(expectedName));
  }
  assert.match(reviewSkill, /tier仕様から責務名を作り/);
  assert.match(runSkill, /人間向け名称で提示/);
  assert.match(runSkill, /内部stage code、attempt履歴/);
});
