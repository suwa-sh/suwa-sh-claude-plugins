'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const validator = path.join(
  root,
  'plugins/toolbox/skills/review-refute-loop/scripts/validate-review-output.sh',
);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-review-output-'));

function run(name, body) {
  const file = path.join(dir, `${name}.md`);
  fs.writeFileSync(file, body);
  return spawnSync('bash', [validator, file], { encoding: 'utf8' }).status;
}

const SUMMARY = [
  '| # | 観点 | 判定 | 該当指摘 | 一言根拠 |',
  '|---|---|---|---|---|',
  '| P1 | 手順 | PASS | - | 読んだ |',
].join('\n');

const FINDING = [
  '### 指摘 1',
  '- **perspective**: P1',
  '- **対象**: a.md:1',
  '- **severity**: high',
  '- **claim**: こわれている',
  '- **evidence**: 1 行目',
  '- **why_raised**: 全員が踏む',
].join('\n');

test('観点サマリ表と必須フィールドを備えた指摘を受理する', () => {
  assert.equal(run('ok-findings', `${SUMMARY}\n\n${FINDING}\n\n## below-threshold\n- P1 low ささい\n`), 0);
});

test('観点サマリ表を伴う No findings を受理する', () => {
  assert.equal(run('ok-nofindings', `${SUMMARY}\n\nNo findings.\n\nbelow-threshold\n- なし\n`), 0);
});

// 指摘本文に below-threshold の語が現れるだけで節が終了し、正当な出力を拒否していた
test('指摘本文に below-threshold の語があっても節終了とみなさない', () => {
  const body = [
    SUMMARY,
    '',
    '### 指摘 1',
    '- **perspective**: P1',
    '- **対象**: a.md:1',
    '- **severity**: high',
    '- **claim**: below-threshold の分類が仕様と一致しない',
    '- **evidence**: 42 行目',
    '- **why_raised**: 結果を回収できなくなる',
    '',
    '## below-threshold',
    '- なし',
    '',
  ].join('\n');
  assert.equal(run('ok-word-in-body', body), 0);
});

test('観点サマリ表が無い旧形式を拒否する', () => {
  const body = ['### 指摘 1', '- **対象**: a.md:1', '- **severity**: high', '- **claim**: x', '- **evidence**: y', ''].join('\n');
  assert.equal(run('ng-oldformat', body), 1);
});

test('perspective の欠落を拒否する', () => {
  const body = `${SUMMARY}\n\n### 指摘 1\n- **対象**: a.md:1\n- **severity**: high\n- **claim**: x\n- **evidence**: y\n- **why_raised**: z\n`;
  assert.equal(run('ng-noperspective', body), 1);
});

test('why_raised の欠落を拒否する', () => {
  const body = `${SUMMARY}\n\n### 指摘 1\n- **perspective**: P1\n- **対象**: a.md:1\n- **severity**: high\n- **claim**: x\n- **evidence**: y\n`;
  assert.equal(run('ng-nowhy', body), 1);
});

test('実行失敗の出力を拒否する', () => {
  assert.equal(run('ng-error', 'Error: command failed with exit code 1\nNo such file or directory\n'), 1);
});

// 判定語を含むだけの別表を観点サマリと誤認し、レビュー未実施の出力を受理していた
test('レビュー未実施の説明と別表だけの出力を拒否する', () => {
  const body = [
    'Error: 対象の取得に失敗し、レビューを実行できませんでした。',
    '| command | status |',
    '|---|---|',
    '| read target | FAIL |',
    '',
    'No findings.',
    '',
  ].join('\n');
  assert.equal(run('ng-failtext', body), 1);
});

// コードフェンス内のひな型を結果として数えていた
test('コードフェンス内の出力例を結果として数えない', () => {
  const body = ['レビュー未実施。以下は出力例です。', '', '```', '| P1 | 手順 | PASS | - | 例 |', '', 'No findings.', '```', ''].join('\n');
  assert.equal(run('ng-fenced-example', body), 1);
});

// No findings が指摘より後にあると混在を検出できなかった
test('No findings と指摘の混在を順序によらず拒否する', () => {
  assert.equal(run('ng-mixed-after', `${SUMMARY}\n\n${FINDING}\n\nNo findings.\n\nbelow-threshold\n- なし\n`), 1);
  assert.equal(run('ng-mixed-before', `${SUMMARY}\n\nNo findings.\n\n${FINDING}\n`), 1);
});

test('観点サマリ表だけで本体が無い出力を拒否する', () => {
  assert.equal(run('ng-summaryonly', `${SUMMARY}\n`), 1);
});

// インデントされた引用中の below-threshold を節見出しと誤認していた
test('インデントされた below-threshold の引用で節を終了しない', () => {
  const body = [
    SUMMARY,
    '',
    '### 指摘 1',
    '- **perspective**: P1',
    '- **対象**: a.md:1',
    '- **severity**: high',
    '- **claim**: x',
    '- **evidence**: y',
    '',
    '      below-threshold',
    '',
    '- **why_raised**: z',
    '',
  ].join('\n');
  assert.equal(run('ok-indented-below', body), 0);
});

// 先頭セルが数字の別表を観点サマリと誤認していた
test('番号付きの別表を観点サマリと誤認しない', () => {
  const body = [
    'Error: 対象を取得できず、レビュー未実施です。',
    '',
    '| # | command | status |',
    '|---|---|---|',
    '| 1 | read target | FAIL |',
    '',
    'No findings.',
    '',
    '## below-threshold',
    'なし',
    '',
  ].join('\n');
  assert.equal(run('ng-numeric-table', body), 1);
});

// フェンスの種類・長さを見ずに反転し、コード例の後の必須項目を読み飛ばしていた
test('入れ子のコードフェンスを含む指摘を受理する', () => {
  const body = [
    SUMMARY,
    '',
    '### 指摘 1',
    '- **perspective**: P1',
    '- **対象**: a.md:1',
    '- **severity**: high',
    '- **claim**: x',
    '- **evidence**: 次の例を参照',
    '',
    '````text',
    '```text',
    '~~~',
    'example',
    '```',
    '````',
    '',
    '- **why_raised**: z',
    '',
  ].join('\n');
  assert.equal(run('ok-nested-fence', body), 0);
});

// セル装飾を許容せず、正当な観点サマリ表を拒否していた
test('観点 ID や判定が装飾された観点サマリ表を受理する', () => {
  const decorated = SUMMARY.replace('| P1 |', '| **P1** |').replace('| PASS |', '| `PASS` |');
  assert.equal(run('ok-decorated-summary', `${decorated}\n\n${FINDING}\n`), 0);
});
