'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFeature, allTags, scenariosWithTag, parseAcceptanceTag } = require('../../../plugins/distillery2/scripts/lib/gherkin');

const en = `# basis: requirements@abc1234
@uc:register-loan
Feature: Register a loan

  Background:
    Given a member "m1" exists

  @acceptance:SPEC-002-1 @browser
  Scenario: happy path
    When the librarian lends "b1" to "m1"
    Then the loan is recorded with due date
    And the response is
      """
      { "status": "lent" }
      """

  Scenario Outline: limits
    Given the member has <n> loans
    Then lending is <result>
    Examples:
      | n | result   |
      | 5 | rejected |
`;

const ja = `# language: ja
@uc:register-loan
機能: 貸出を登録する
  @acceptance:SPEC-002-2
  シナリオ: 在庫が無い
    前提 書籍 "b1" は貸出中である
    もし 司書が "b1" を "m1" に貸し出す
    ならば 貸出は拒否される
    かつ 次の表の通り
      | code | 409 |
`;

test('parses english feature with background, doc string, outline and examples', () => {
  const f = parseFeature(en);
  assert.equal(f.name, 'Register a loan');
  assert.deepEqual(f.tags, ['@uc:register-loan']);
  assert.equal(f.background.steps.length, 1);
  assert.equal(f.scenarios.length, 2);
  const happy = f.scenarios[0];
  assert.deepEqual(happy.tags, ['@acceptance:SPEC-002-1', '@browser']);
  assert.equal(happy.steps.length, 3);
  assert.equal(happy.steps[2].docString, '{ "status": "lent" }');
  assert.equal(f.scenarios[1].outline, true);
  assert.deepEqual(f.scenarios[1].examples[0].rows, [['n', 'result'], ['5', 'rejected']]);
});

test('parses japanese keywords and step tables', () => {
  const f = parseFeature(ja);
  assert.equal(f.language, 'ja');
  assert.equal(f.name, '貸出を登録する');
  const s = f.scenarios[0];
  assert.deepEqual(s.steps.map(x => x.keyword), ['前提', 'もし', 'ならば', 'かつ']);
  assert.deepEqual(s.steps[3].table, [['code', '409']]);
});

test('tag helpers', () => {
  const f = parseFeature(en);
  assert.deepEqual(allTags(f).sort(), ['@acceptance:SPEC-002-1', '@browser', '@uc:register-loan']);
  assert.equal(scenariosWithTag(f, '@acceptance:').length, 1);
  assert.equal(scenariosWithTag(f, '@uc:register-loan').length, 2);
  assert.deepEqual(parseAcceptanceTag('@acceptance:SPEC-002-1'), { spec: 'SPEC-002', n: 1 });
  assert.equal(parseAcceptanceTag('@browser'), null);
});
