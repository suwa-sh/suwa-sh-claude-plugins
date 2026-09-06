'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const pluginRoot = path.join(root, 'plugins/distillery-impl');
const runSkill = fs.readFileSync(path.join(pluginRoot, 'skills/dist-impl-run/SKILL.md'), 'utf8');
const stateSchema = fs.readFileSync(
  path.join(pluginRoot, 'skills/dist-impl-run/references/state-schema.md'),
  'utf8',
);
const bootstrapSkill = fs.readFileSync(
  path.join(pluginRoot, 'skills/dist-impl-bootstrap/SKILL.md'),
  'utf8',
);
const reviewTemplate = fs.readFileSync(
  path.join(pluginRoot, 'skills/dist-impl-review/references/review-html-template.md'),
  'utf8',
);

test('all implementation review HTML is ignored and legacy rules are migrated', () => {
  for (const text of [runSkill, stateSchema, reviewTemplate]) {
    assert.match(text, /docs\/impl\/\*\*\/review\/\*\.html/);
  }
  assert.match(runSkill, /旧規則`docs\/impl\/latest\/\*\/review\/\*\.html`を除去/);
  assert.match(runSkill, /exactly once/);
  assert.match(runSkill, /working tree.*残したまま.*index.*除外/s);
});

test('a UC starts on a confirmed English-name feature branch', () => {
  for (const text of [runSkill, stateSchema, bootstrapSkill]) {
    assert.match(text, /uc_english_name/);
    assert.match(text, /branch_slug/);
  }
  assert.match(runSkill, /feature\/\{branch_slug\}/);
  assert.match(runSkill, /git switch -c/);
  assert.match(runSkill, /lowercase ASCII kebab-case/);
  assert.match(runSkill, /config_confirmed/);
});

test('delivery is gated by applied decisions and a fresh human alignment', () => {
  assert.match(runSkill, /未確定事項.*0件/s);
  assert.match(runSkill, /選択結果.*仕様.*実装.*テスト/s);
  assert.match(runSkill, /再生成.*再レビュー/s);
  assert.match(runSkill, /未対応.*squash.*push.*PR.*禁止/s);
  assert.match(stateSchema, /delivery_ready/);
  assert.match(runSkill, /feedback公開許可/);
  assert.match(runSkill, /要求ありapprovalはPR許可ではない/);
  assert.match(runSkill, /要求0件の再レビュー/);
});

test('approved UC work is safely squashed, pushed, and opened as one PR', () => {
  assert.match(runSkill, /refs\/distillery-impl\/pre-squash/);
  assert.match(runSkill, /git status --porcelain=v1 --untracked-files=all/);
  assert.match(runSkill, /git reset --soft/);
  assert.match(runSkill, /feat: \{UC名\}/);
  assert.match(runSkill, /git push -u origin/);
  assert.match(runSkill, /gh pr create/);
  assert.match(runSkill, /gh pr list/);
  assert.match(runSkill, /PR作成後.*次のUC.*自動継続しない/s);
  assert.match(stateSchema, /git_delivery:/);
  assert.match(stateSchema, /base_head:/);
  assert.match(stateSchema, /feature_branch:/);
});
