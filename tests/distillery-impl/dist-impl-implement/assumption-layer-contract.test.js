'use strict';

// distillery-impl の「実装者が補った前提(AssumptionRecord)」層の文書契約テスト。
// 各 SKILL / references が同じファイル名・観点数・verdict・回答規則・承認証跡を語っていることを検査する
// (review-information-design-contract.test.js と同型。実行コードは validateAssumptions.js のみで、
//  オーケストレータは SKILL.md を読む LLM なので、規則の記載有無を契約として固定する)。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const impl = path.join(root, 'plugins/distillery-impl');
const read = rel => fs.readFileSync(path.join(impl, rel), 'utf8');

const implementSkill = read('skills/dist-impl-implement/SKILL.md');
const record = read('skills/dist-impl-implement/references/assumption-record.md');
const verifySkill = read('skills/dist-impl-verify/SKILL.md');
const viewpoints = read('skills/dist-impl-verify/references/verify-viewpoints.md');
const runSkill = read('skills/dist-impl-run/SKILL.md');
const stateSchema = read('skills/dist-impl-run/references/state-schema.md');
const subagentTemplate = read('skills/dist-impl-run/references/subagent-template.md');
const s4Instructions = read('skills/dist-impl-run/references/stage-instructions/S4_tier-impl.md');
const s9Instructions = read('skills/dist-impl-run/references/stage-instructions/S9_review.md');
const reviewSkill = read('skills/dist-impl-review/SKILL.md');
const reviewTemplate = read('skills/dist-impl-review/references/review-html-template.md');
const feedbackSkill = read('skills/dist-impl-feedback/SKILL.md');
const readme = read('README.md');
const pluginJson = JSON.parse(read('.claude-plugin/plugin.json'));

const FILE = 'S4_tier-impl.{tier_id}.assumptions.yaml';

test('implementer writes an AssumptionRecord per tier×attempt and validates it', () => {
  assert.match(implementSkill, /references\/assumption-record\.md/);
  assert.match(implementSkill, /S4_tier-impl\.\{tier_id\}\.assumptions\.yaml/);
  assert.match(implementSkill, /assumptions: \[\]/, '0 件でも必ず書く');
  assert.match(implementSkill, /validateAssumptions\.js record/);
  assert.match(implementSkill, /自分が補った判断だけ/);
  assert.doesNotMatch(implementSkill, /未定義リストとして抽出/, '旧「未定義リスト」機構は AssumptionRecord に統合済み');
  assert.match(s4Instructions, /前提の記録/);
  assert.match(s4Instructions, /spec_refs/);
  assert.match(subagentTemplate, new RegExp(FILE.replace(/[{}]/g, m => `\\${m}`)));
  assert.match(subagentTemplate, /assumptions=\{attempt-\{n\}\/S4_tier-impl\.\{tier_id\}\.assumptions\.yaml/);
  assert.match(subagentTemplate, /AssumptionRecord の id/, 'S6/S7 ハーネス注入の根拠に AssumptionRecord を許可');
});

test('assumption-record.md is the schema authority: 6 categories, extraction counters, canonical hash', () => {
  for (const c of ['input_validation', 'data_format', 'error_handling', 'persistence', 'performance', 'security']) {
    assert.match(record, new RegExp(`\`${c}\``));
  }
  for (const key of ['candidate_count', 'excluded_as_explicit', 'recorded_count', 'spec_refs', 'confidence']) {
    assert.match(record, new RegExp(key));
  }
  assert.match(record, /S4 固定指示/, '除外集合は仕様・契約・dev-rules・S4 固定指示');
  assert.match(record, /可変プロンプト[^\n]*除外集合に含めない/);
  assert.match(record, /assumptions_sha256/);
  assert.match(record, /assumption_verdicts_sha256/);
  assert.match(record, /category: null/, 'V-nnn は category null');
});

test('verifier has 8 viewpoints, blind join, verdict table with contradicts=blocker and unlisted', () => {
  assert.match(viewpoints, /^# Verifier 8 観点チェックリスト/m);
  assert.match(viewpoints, /## 8\. assumption_conformance/);
  assert.match(viewpoints, /blind join/);
  for (const v of ['consistent', 'spec_absent', 'contradicts', 'unlisted']) assert.match(viewpoints, new RegExp(`\`${v}\``));
  assert.match(viewpoints, /blocker\(カテゴリにかかわらず\)/);
  assert.match(viewpoints, /restatement/);
  assert.match(viewpoints, /category_mismatch/);
  assert.match(viewpoints, /S4_tier-impl\.md/, '復唱判定の照合先に S4 固定指示を含める');
  assert.match(verifySkill, /8 観点/);
  assert.match(verifySkill, /1〜7 観点[^\n]*完走/);
  assert.match(verifySkill, /assumption_verdicts:/);
  assert.match(verifySkill, /assumption_verdicts_summary/);
  assert.match(verifySkill, /finding_id/);
  assert.match(verifySkill, /verified_category/);
  const plugin = fs.readdirSync(impl, { recursive: true })
    .filter(f => /\.(md|html|json)$/.test(f))
    .map(f => [f, fs.readFileSync(path.join(impl, f), 'utf8')]);
  for (const [f, text] of plugin) {
    const stale = text.match(/(?<!1〜)7 観点/g);
    assert.equal(stale, null, `${f} still says "7 観点"`);
  }
});

test('state schema places the file, write-set, done fields, events, completeness, legacy rule', () => {
  assert.match(stateSchema, /S4_tier-impl\.\{tier_id\}\.assumptions\.yaml/);
  assert.match(stateSchema, /`attempt-\{n\}\/S4_tier-impl\.\{自tier\}\.assumptions\.yaml`/, 'S4 write-set');
  assert.match(stateSchema, /assumptions:\s+# S4 のみ/);
  assert.match(stateSchema, /assumption_verdicts_sha256/);
  assert.match(stateSchema, /assumption_evidence_sha256/);
  assert.match(stateSchema, /canonical 4 field/);
  assert.match(stateSchema, /stage_carried_forward[^\n]*assumptions_sha256/, 'carry-forward が前提ファイルを複製');
  assert.match(stateSchema, /byte copy ではない/, 'carry-forward は attempt を更新する');
  assert.match(runSkill, /byte copy ではなく `attempt` を新値に更新/);
  assert.doesNotMatch(reviewTemplate, /A-002 失敗時 status=FAILED/, 'contradicts の例を S9 回答例に載せない');
  assert.match(stateSchema, /assumptions ファイルも退避対象/, 'invalidate が前提ファイルを退避');
  assert.match(stateSchema, /rejected_assumptions/);
  assert.match(stateSchema, /assumption_decisions/);
  assert.match(stateSchema, /completeness|完全性条件/);
  assert.match(stateSchema, /auto_confirmed/);
  assert.match(stateSchema, /resolution: spec_change \(rejected のとき必須\)/);
  assert.match(stateSchema, /`implementation_change` の却下は approval に含めない/);
  assert.match(stateSchema, /assumption_evidence_drift/, '承認直前・publish 直前・再開で current hash を再計算');
  assert.match(runSkill, /assumption_evidence_drift/);
  assert.match(feedbackSkill, /latest valid approval/);
  assert.match(stateSchema, /assumptions_missing_legacy/, 'v0.12 からの再開の legacy 規則');
  assert.doesNotMatch(stateSchema, /type: [^\n]*assumption_recorded/, '新 event 種別は足さない');
});

test('orchestrator accepts S4/S5 through the validator and routes S9 assumption decisions', () => {
  assert.match(runSkill, /validateAssumptions\.js record/);
  assert.match(runSkill, /validateAssumptions\.js verdicts\n\s*attempt-\{n\}\/S5_verify\.\{tier\}\.findings\.yaml --assumptions attempt-\{n\}\/S4_tier-impl\.\{tier\}\.assumptions\.yaml --uc \{uc_id\} --tier \{tier\} --attempt \{n\}/, 'S5 受理コマンドは 4 option 全部を渡す');
  assert.match(runSkill, /validateAssumptions\.js record\n\s*attempt-\{n\}\/S4_tier-impl\.\{tier\}\.assumptions\.yaml --uc \{uc_id\} --tier \{tier\} --attempt \{n\}/);
  assert.match(reviewSkill, /validateAssumptions\.js evidence/);
  assert.match(stateSchema, /validateAssumptions\.js evidence/);
  assert.match(reviewSkill, /全tierのS5 `assumption_verdicts` も空/);
  assert.match(runSkill, /assumptions=attempt-\{n\}\/S4_tier-impl\.\{tier\}\.assumptions\.yaml/);
  assert.match(runSkill, /前提\(AssumptionRecord\)の回答規則/);
  assert.match(runSkill, /security \/ persistence/);
  assert.match(runSkill, /auto_confirmed/);
  assert.match(runSkill, /implementation_change/);
  assert.match(runSkill, /spec_change/);
  assert.match(runSkill, /rejected_assumptions/);
  assert.match(runSkill, /assumption_decisions/);
  assert.match(runSkill, /4 field/);
  assert.doesNotMatch(runSkill, /の3 fieldだけを照合/);
});

test('human review shows assumptions with answer template; feedback publishes only spec_change rejections', () => {
  assert.match(reviewTemplate, /実装者が補った前提/);
  assert.match(reviewTemplate, /前提=A-001:承認/);
  assert.match(reviewTemplate, /実装修正/);
  assert.match(reviewTemplate, /仕様変更/);
  assert.match(reviewSkill, /前提の承認・却下/);
  assert.match(reviewSkill, /assumption_evidence_sha256/);
  assert.match(reviewSkill, /assumption_questions/);
  assert.match(s9Instructions, /実装者が補った前提/);
  assert.match(s9Instructions, /assumption_evidence_sha256/);
  assert.match(feedbackSkill, /canonical 4 field/);
  assert.match(feedbackSkill, /旧3 field/);
  assert.match(feedbackSkill, /`spec_change` で却下した前提だけ/);
  assert.match(feedbackSkill, /assumption_verdicts/);
});

test('readme and version advertise the feature', () => {
  assert.match(readme, /暗黙前提の可視化/);
  assert.match(readme, /8項目|8 観点/);
  assert.match(pluginJson.version, /^0\.13\.\d+$/);
});
