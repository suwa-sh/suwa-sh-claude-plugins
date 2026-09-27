'use strict';
// 0.1.19 で直した手順 (実走 0.1.10 / 0.1.13 / 0.1.16 の課題) が手順書から消えないように、要となる文言を固定する。
// 手順書は LLM が解釈するため、振る舞いそのものは実走でしか確かめられない。ここでは「書いてあること」だけを守る。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PLUGIN = path.resolve(__dirname, '../../../plugins/distillery2');
const read = rel => fs.readFileSync(path.join(PLUGIN, rel), 'utf8');

const SKILL = 'skills/d2-run/SKILL.md';
const TEMPLATE = 'skills/d2-run/references/subagent-template.md';
const RUN_STATE = 'skills/d2-run/references/run-state.md';
const DELIVERY = 'skills/d2-run/references/git-delivery.md';

/** 表の行 (`| **<stage>** |` や `| ④ <stage>`) を 1 行で返す */
function row(text, re) {
  const line = text.split('\n').find(l => re.test(l));
  assert.ok(line, `row not found: ${re}`);
  return line;
}

test('記録付きのゲートはオーケストレータが 1 回だけ回す (tier 実装者は runGates を使わない)', () => {
  const tierRow = row(read(SKILL), /^\| \*\*tier\*\* \|/);
  assert.match(tierRow, /自分が 1 回だけ.*runGates\.js --uc <slug> --tiers <関与ティア> --upto unit/);
  const impl = read('skills/d2-implement/references/tier-impl.md');
  assert.match(impl, /`runGates\.js` は使わない/);
  assert.match(impl, /`\{report\}` は OS の一時ファイル/);
  const tmplTier = row(read(TEMPLATE), /^\| ④ tier /);
  assert.match(tmplTier, /OS の一時ファイル/);
  assert.doesNotMatch(tmplTier.split('|')[5], /reports/, 'tier の write-set に reports を入れない (並列で記録を消し合う)');
});

test('単独の段 (scaffold / integrate) は runGates の出力先を write-set に持つ', () => {
  assert.match(row(read(TEMPLATE), /^\| ④ integrate /), /`<run>\/reports\/\*\*`、`<run>\/traces\/\*\*`/);
  assert.match(row(read(TEMPLATE), /^\| ④ scaffold /), /`<run>\/reports\/\*\*`/);
});

test('scaffold の入口スタブは新規ファイルだけ・中立の値を返す・動的 import で回避しない', () => {
  assert.match(row(read(TEMPLATE), /^\| ④ scaffold /), /新規ファイルだけ/);
  const scaffold = read('skills/d2-implement/references/scaffold.md');
  assert.match(scaffold, /型に合う中立の値/);
  assert.match(scaffold, /throw で落とさない/);
  assert.match(scaffold, /動的 import/);
  assert.match(read(TEMPLATE), /--diff-filter=MD/);
});

test('還流の保留: feedback_deferred → deliver 前に起票して commit', () => {
  const skill = read(SKILL);
  assert.match(row(skill, /^\| \*\*feedback\*\* \|/), /feedback_deferred/);
  const deliver = row(skill, /^\| \*\*deliver\*\* \|/);
  assert.match(deliver, /pending_feedback/);
  assert.match(deliver, /impl\(<slug>\): feedback filed/);
  assert.match(skill, /feedback_deferred \{kind, issue_path, reason\}/);
  assert.match(read(RUN_STATE), /^\| feedback_deferred \|/m);
  assert.match(read(RUN_STATE), /^\| blocked_on_requirement \|/m);
  assert.match(read(DELIVERY), /pending_feedback` が空/);
});

test('人レビューの「要求を直す」は下書き → その場で起票か保留 → 停止', () => {
  const skill = read(SKILL);
  assert.match(skill, /「要求を直す」があれば `issues\/` に下書き/);
  assert.match(skill, /起票できない実行 \(push 禁止・`gh` 未認証・リモート無し\) では `feedback_deferred` を記録する/);
});

test('upstream が無いリポでは upstream 一致の条件を飛ばす', () => {
  assert.match(read(DELIVERY), /upstream が設定されていなければ/);
});

test('契約の変更の分類 (own / other_uc / shared) を contract 段で記録し、人レビューに載せる', () => {
  const skill = read(SKILL);
  assert.match(row(skill, /^\| \*\*contract\*\* \|/), /classifyContractChanges\.js --uc <slug> --json/);
  assert.match(skill, /contract_changes/);
  assert.ok(fs.existsSync(path.join(PLUGIN, 'skills/d2-contract/scripts/classifyContractChanges.js')));
});

test('他 UC への波及: 初期候補を渡し、Verifier が import 元を辿る (read-set の例外つき)', () => {
  assert.match(row(read(SKILL), /^\| \*\*verify\*\* \|/), /他 UC と共有する変更ファイル/);
  assert.match(row(read(TEMPLATE), /^\| ④ verify /), /他 UC と共有する変更ファイル/);
  const vp = read('skills/d2-verify/references/viewpoints.md');
  assert.match(vp, /cross_uc_change/);
  assert.match(vp, /import している側を辿る/);
  assert.match(read('skills/d2-verify/SKILL.md'), /^\| 他 UC への波及 \(例外\) \|/m);
});

test('asbuilt: 抽出から検査まで要約役が通しで行い、d2-run は集計ファイルで受理と差し戻しを判断する (0.1.22)', () => {
  const tmpl = row(read(TEMPLATE), /^\| ④ asbuilt /);
  assert.match(tmpl, /依存グラフの実態 → 抽出 → 要約 → 検査までこのスキルが行う/);
  assert.match(tmpl, /抽出の標準出力 1 行を報告に転記する/);
  const asbuilt = row(read(SKILL), /^\| \*\*asbuilt\*\* \|/);
  assert.match(asbuilt, /`<run>\/reports\/asbuilt\.json` があれば消してから/, '前回の集計で受理しない');
  assert.match(asbuilt, /`slug` が今回の UC、`attempt` が `runState\.js status` の attempt と一致/);
  assert.match(asbuilt, /instrumentation_gaps/);
  assert.match(asbuilt, /asbuilt を done にせず integrate へ戻して/, '差し戻しの判断は d2-run に残す');
  assert.doesNotMatch(asbuilt, /npx depcruise/, 'depcruise は d2-asbuilt が回す');
  // 抽出は前回の要約を残すので、成果物だけでは今回の要約を区別できない。as-built は完了報告も要る
  assert.match(asbuilt, /要約役の完了報告/);
  assert.match(read(TEMPLATE), /例外: asbuilt は要約役の完了報告/);
  const skill = read('skills/d2-asbuilt/SKILL.md');
  assert.match(skill, /npx depcruise/);
  assert.match(skill, /extractAsBuilt\.js/);
  assert.match(skill, /checkAsBuilt\.js/);
});

test('③ の後始末は d2-foundation phase=finish。d2-run は gates.json を読んで受理する (0.1.22)', () => {
  const skill = read(SKILL);
  const s3 = skill.slice(skill.indexOf('## ③ 基盤'), skill.indexOf('## ④'));
  assert.match(s3, /sub `d2-foundation phase=all`/);
  assert.match(s3, /sub `d2-foundation phase=finish ui=/);
  assert.ok(s3.indexOf('sub `d2-design`') < s3.indexOf('sub `d2-foundation phase=finish ui='), 'design は仕上げの前');
  // 手順 (番号付きの行と、その続きの字下げ行) に、移したスクリプトを直接回す記述が無い
  const steps = s3.split('\n').filter(l => /^(\d+\.|   )/.test(l)).join('\n');
  for (const s of ['npm install', 'genConfig.js', 'genCi.js', 'genArchitectureDoc.js', 'importUi.js', 'genContractTests.js', 'runGates.js']) {
    assert.ok(!steps.includes(s), `d2-run の ③ の手順が ${s} を直接回していない`);
  }
  assert.match(s3, /`\.distillery\/runs\/bootstrap\/reports\/gates\.json` があれば消してから/);
  // gates.json の gates は {name, status} の配列 (runGates.js が書く形)。キー参照で書かない
  assert.match(s3, /`gates` \(`\{name, status\}` の配列\) のうち `name` が `static` の要素の `status` が `pass`/);
  // F6 は d2-run が design を派遣したかで決める (古い docs/design の有無で決めない)
  assert.match(s3, /sub `d2-foundation phase=finish ui=<true\|false>`/);
  assert.match(s3, /design が「画面を持たないプロダクトのため skip」と報告したら `ui=false`/);
  const fnd = read('skills/d2-foundation/SKILL.md');
  assert.match(fnd, /`ui=false` なら F6 と次の F7 を飛ばす/);
  assert.match(fnd, /前の実行の `docs\/design\/` が残っていても取り込まない/);
  assert.match(row(read(TEMPLATE), /^\| ③ 基盤 \(仕上げ\) /), /`node_modules\/\*\*`/);
  assert.match(read(TEMPLATE), /例外: 手順書が回すスクリプトの内部の git/);
});

test('差し戻し後の integrate: 必ず派遣し、結線変更なしなら wiring_changed: false', () => {
  const integrate = row(read(SKILL), /^\| \*\*integrate\*\* \|/);
  assert.match(integrate, /必ず派遣/);
  assert.match(integrate, /wiring_changed: false/);
});
