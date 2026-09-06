'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const reviewRoot = path.join(root, 'plugins/distillery-impl/skills/dist-impl-review');
const reviewSkill = fs.readFileSync(path.join(reviewRoot, 'SKILL.md'), 'utf8');
const reviewTemplate = fs.readFileSync(path.join(reviewRoot, 'references/review-html-template.md'), 'utf8');
const reviewStageInstructions = fs.readFileSync(
  path.join(root, 'plugins/distillery-impl/skills/dist-impl-run/references/stage-instructions/S9_review.md'),
  'utf8',
);
const runSkill = fs.readFileSync(path.join(root, 'plugins/distillery-impl/skills/dist-impl-run/SKILL.md'), 'utf8');
const validatorPath = path.join(reviewRoot, 'scripts/validateReviewHtml.js');
const { validateReviewHtml } = require(validatorPath);

test('human review starts with the actions and decisions requested from the user', () => {
  for (const required of [
    'ユーザーにお願いしたいこと',
    '判断サマリ',
    'UCとレビュー対象仕様',
    '決めてほしいことの詳細',
    '実装の構成',
    '処理フロー',
    'データフロー',
    '動かし方',
    'テストと確認方法',
    '判断後に起きること',
    '根拠と現在の制約',
  ]) {
    assert.match(reviewTemplate, new RegExp(required), `review template must include ${required}`);
  }
  assert.doesNotMatch(reviewTemplate, /Verifier反証と解決/);
  assert.match(reviewSkill, /主役をUC、対象仕様、完成した実装、現在必要な人間判断に置く/);
  assert.match(reviewSkill, /推奨案/);
  assert.match(reviewSkill, /相互排他的/);
  assert.match(reviewSkill, /回答template|回答テンプレート/);
  assert.match(reviewSkill, /成功数\/総数/);
  assert.match(reviewStageInstructions, /UCの目的・actor・trigger・入出力・rule・受け入れ条件/);
});

test('human review requires accessible static architecture, process, and data diagrams', () => {
  for (const required of ['実装の構成', '処理フロー', 'データフロー']) {
    assert.match(reviewTemplate, new RegExp(required), `review template must require ${required}`);
  }
  assert.match(reviewSkill, /inline CSS\/SVG/);
  assert.match(reviewSkill, /figcaption/);
  assert.match(reviewSkill, /テキスト代替/);
  assert.match(reviewTemplate, /Mermaid runtimeを使わない/);
  assert.match(reviewTemplate, /9node\/12arrow以内/);
  assert.match(reviewTemplate, /色だけで意味を示さない/);
  for (const connectorRule of ['connectorを先', 'rounded orthogonal', '12px以上', '背面']) {
    assert.match(reviewTemplate, new RegExp(connectorRule));
  }
});

test('dist-impl-run requires diagram-design and gives an auditable install prompt', () => {
  assert.match(runSkill, /dependencies:[\s\S]*diagram-design/);
  for (const required of [
    'https://github.com/cathrynlavery/diagram-design',
    'https://skills.sh/cathrynlavery/diagram-design',
    'npx skills add cathrynlavery/diagram-design',
  ]) {
    assert.match(runSkill, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(reviewStageInstructions, /taste gate/);
});

test('review validator rejects broken connector geometry and layer order', () => {
  const headings = ['ユーザーにお願いしたいこと', '決めてほしいことの詳細', '実装の構成', '処理フロー', 'データフロー', '動かし方', 'テストと確認方法', '判断後に起きること'].map(value => `<h2>${value}</h2>`).join('');
  const figure = (type, nodes = '') => `<figure><div class="legend">x</div><svg role="img" data-diagram-type="${type}"><title>x</title><desc>x</desc><g data-layer="connectors"><path d="M0 0H8Q12 0 12 4V8" marker-end="url(#a)"></path></g><g data-layer="nodes">${nodes}</g></svg><figcaption>x</figcaption><p class="text-alt">x</p></figure>`;
  const valid = `${headings}<p>推奨</p><pre>機能=A\n相互運用=A\n監査=A</pre>${figure('architecture')}${figure('flowchart', '<path data-node-shape="decision"></path>')}${figure('data-flow')}`;
  assert.deepEqual(validateReviewHtml(valid), []);

  const broken = valid.replace('<g data-layer="connectors"><path d="M0 0H8Q12 0 12 4V8"', '<g data-layer="connectors"><path d="M0 0L8 8"');
  assert.ok(validateReviewHtml(broken).some(error => error.includes('L command')));
  assert.match(reviewSkill, /validateReviewHtml\.js/);
  assert.equal(fs.existsSync(validatorPath), true);
});

test('generated review HTML is an ignored aid, not approval evidence', () => {
  assert.match(runSkill, /gitignore/);
  assert.match(runSkill, /indexから除外/);
  assert.match(reviewSkill, /承認証跡へ結ばない/);
  assert.match(reviewTemplate, /HTML.*再生成.*done\/event\/status.*整合性を取り直さない/s);
});

test('reader-facing review omits attempt history and translates internal codes to names', () => {
  for (const text of [reviewSkill, reviewTemplate, reviewStageInstructions]) {
    assert.match(text, /attempt.*表示しない|attempt.*生成しない|attempt.*出さない/s);
  }
  for (const expectedName of ['書式確認', '静的解析', '実装層テスト', 'UC統合テスト', '受け入れテスト']) {
    assert.match(reviewTemplate, new RegExp(expectedName));
  }
  assert.match(reviewTemplate, /内部stage codeへ置換しない/);
  assert.match(runSkill, /内部stage code、attempt履歴/);
});
