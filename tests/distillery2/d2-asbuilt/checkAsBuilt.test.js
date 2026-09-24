'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const SCRIPTS = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-asbuilt/scripts');
const { check, visibleLength } = require(path.join(SCRIPTS, 'checkAsBuilt'));

const wrap = (name, body) => `<!-- 要約:begin ${name} -->\n${body}\n<!-- 要約:end -->`;

test('visibleLength はコード位置・URL・記号を数えない', () => {
  assert.equal(visibleLength('貸出を記録する (apps/backend-api/src/usecase/loan/register-loan.ts:48)'), visibleLength('貸出を記録する'));
  assert.equal(visibleLength('`code` と https://example.com/x'), 1);
});

test('表で短く書かれた要約は違反なし', () => {
  const md = wrap('概要', '| 項目 | 内容 | 根拠 |\n|---|---|---|\n| 誰が | 司書 | apps/frontend-staff/src/x.ts:9 |\n| 完了 | 返却期限が画面に出る | apps/x.ts:1 |');
  const r = check(md);
  assert.equal(r.blocks, 1);
  assert.deepEqual(r.violations, []);
});

test('自由文だけのブロック・長い文・長いセル・見出し・空を検出する', () => {
  const long = 'あ'.repeat(51) + '。';
  const md = [
    wrap('概要', long),
    wrap('整合性', '| 守ること | 手段 | 根拠 |\n|---|---|---|\n| 原子性 | ' + 'い'.repeat(41) + '<br>短い手段 | x.ts:1 |\n## 見出し'),
    wrap('課題', ''),
  ].join('\n');
  const r = check(md);
  const rules = r.violations.map((v) => `${v.block}:${v.rule.slice(0, 2)}`);
  assert.ok(rules.includes('概要:R4'), 'R4 長い文');
  assert.ok(rules.includes('概要:R2'), 'R2 表なし');
  assert.ok(rules.includes('整合性:R3'), 'R3 長いセル');
  assert.ok(rules.includes('整合性:R5'), 'R5 見出し');
  assert.ok(rules.includes('課題:R1'), 'R1 空');
  // 根拠列 (最後の列) と <br> の後の短い行は数えない
  assert.equal(r.violations.filter((v) => v.block === '整合性' && v.rule.startsWith('R3')).length, 1);
  // 行番号はファイル内の行
  assert.ok(r.violations.every((v) => v.line >= 1));
});

test('旧形式の名前無しブロックも検査する', () => {
  const md = '<!-- 要約:begin -->\n' + 'う'.repeat(60) + '。\n<!-- 要約:end -->';
  const r = check(md);
  assert.equal(r.blocks, 1);
  assert.ok(r.violations.some((v) => v.rule.startsWith('R4')));
});
