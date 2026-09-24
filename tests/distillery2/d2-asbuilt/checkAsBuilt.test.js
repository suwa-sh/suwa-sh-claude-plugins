'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const SCRIPTS = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-asbuilt/scripts');
const { check, visibleLength } = require(path.join(SCRIPTS, 'checkAsBuilt'));

const wrap = (name, body) => `<!-- 要約:begin ${name} -->\n${body}\n<!-- 要約:end -->`;
const table = (rows) => ['| 項目 | 内容 | 根拠 |', '|---|---|---|', ...rows].join('\n');

test('visibleLength はコード位置・URL・強調記号を数えず、code の中身と句読点は数える', () => {
  assert.equal(visibleLength('貸出を記録する (apps/backend-api/src/usecase/loan/register-loan.ts:48)'), 7);
  assert.equal(visibleLength('x.ts:1, :5, :9 と https://example.com/x'), 1);
  assert.equal(visibleLength('`' + 'あ'.repeat(10) + '`'), 10); // code の中身は表示される
  assert.equal(visibleLength('あ、'.repeat(5)), 10); // 句読点も表示される
  assert.equal(visibleLength('**太字**'), 2);
  assert.equal(visibleLength('a \\| b'), 3); // エスケープした縦棒は 1 字
});

test('表で短く書かれた要約は違反なし', () => {
  const md = wrap('概要', table(['| 誰が | 司書 | apps/frontend-staff/src/x.ts:9 |', '| 完了 | 返却期限が画面に出る<br>' + 'い'.repeat(40) + ' | apps/x.ts:1 |']));
  const r = check(md);
  assert.equal(r.blocks, 1);
  assert.deepEqual(r.violations, []);
});

test('見逃さない: code 入り・読点入りの長いセル、区切り行だけの表 + 自由文', () => {
  const codeLong = wrap('概要', table(['| 内容 | `' + 'あ'.repeat(41) + '` | x.ts:1 |']));
  assert.ok(check(codeLong).violations.some((v) => v.rule.startsWith('R3')), 'code 入り 41 字');
  const punctLong = wrap('概要', table(['| 内容 | ' + 'あ、'.repeat(21) + ' | x.ts:1 |']));
  assert.ok(check(punctLong).violations.some((v) => v.rule.startsWith('R3')), '読点入り 42 字');
  const skeleton = wrap('概要', '| 項目 | 内容 | 根拠 |\n|---|---|---|\n自由文です。');
  const rules = check(skeleton).violations.map((v) => v.rule.slice(0, 2));
  assert.ok(rules.includes('R2'), '区切り行だけでは表と認めない');
  assert.ok(rules.includes('R4'), '表の外の文');
});

test('誤検知しない: 根拠列は数えない、エスケープした縦棒は 1 字、39 字 + \\| は 40 字', () => {
  const md = wrap('概要', table(['| 内容 | ' + 'あ'.repeat(39) + '\\| | ' + 'う'.repeat(100) + ' x.ts:1 |']));
  assert.deepEqual(check(md).violations, []);
});

test('見逃さない: 長い見出しセル、根拠列の無い表の最後の列、空行の後のパイプ行、行番号の無いパス', () => {
  const longHeader = wrap('概要', '| 項目 | ' + 'あ'.repeat(41) + ' | 根拠 |\n|---|---|---|\n| a | b | x.ts:1 |');
  assert.ok(check(longHeader).violations.some((v) => v.rule.startsWith('R3')), '見出し行');
  const noEvidence = wrap('概要', '| 項目 | 内容 |\n|---|---|\n| a | ' + 'あ'.repeat(41) + ' |');
  assert.ok(check(noEvidence).violations.some((v) => v.rule.startsWith('R3')), '根拠列が無ければ最後の列も数える');
  const afterBlank = wrap('概要', table(['| a | b | x.ts:1 |']) + '\n\n| これは表の外の文です |');
  assert.ok(check(afterBlank).violations.some((v) => v.rule.startsWith('R4')), '空行の後のパイプ行');
  assert.equal(visibleLength('apps/backend-api/src/repository/loan/pg-loan-registration-repository.ts'), 71, '行番号の無いパスは表示文');
  assert.equal(visibleLength('*' + 'あ'.repeat(40) + '*'), 40, '単一の * は強調記号');
});

test('自由文だけ・見出し・空を検出し、行番号はファイル内の行', () => {
  const md = [wrap('概要', 'あ'.repeat(10) + '。'), wrap('整合性', table(['| 原子性 | 短い | x.ts:1 |']) + '\n## 見出し'), wrap('課題', '')].join('\n');
  const r = check(md);
  const rules = r.violations.map((v) => `${v.block}:${v.rule.slice(0, 2)}`);
  assert.ok(rules.includes('概要:R4') && rules.includes('概要:R2'));
  assert.ok(rules.includes('整合性:R5'));
  assert.ok(rules.includes('課題:R1'));
  assert.ok(r.violations.every((v) => v.line >= 1));
});

test('旧形式の名前無しブロック (文章) も検査して違反にする', () => {
  const md = '<!-- 要約:begin -->\n' + 'う'.repeat(20) + '。\n<!-- 要約:end -->';
  const r = check(md);
  assert.equal(r.blocks, 1);
  assert.ok(r.violations.some((v) => v.rule.startsWith('R4')) && r.violations.some((v) => v.rule.startsWith('R2')));
});
