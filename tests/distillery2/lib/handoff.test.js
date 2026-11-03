'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCRIPTS = path.join(__dirname, '../../../plugins/distillery2/skills/d2-common/scripts');
const H = require(path.join(SCRIPTS, 'handoff'));
const { parseYaml } = require(path.join(SCRIPTS, 'lib/yaml'));

function base() {
  return {
    schema_version: 'distillery2.handoff/v1',
    step: 'foundation',
    asks: [
      { id: 'audit-store', kind: 'choice', question: '監査ログの保存先', options: [{ label: 'DB の表', impact: '同じ取引で書ける' }, { label: 'ファイル', impact: '別に回収が要る' }], recommended: 'DB の表', reason: '取引と一緒に残せる' },
      { id: 'headcount', kind: 'unknown_fact', question: '社員数', options: [{ label: '100 人以下', impact: '今の見積もりで足りる' }, { label: '1000 人以上', impact: '性能の見直しが要る' }], recommended: '100 人以下', reason: '要望の「数十人」から' },
      { id: 'seed', kind: 'choice', question: '社員の初期データの入れ方', options: [{ label: '移行スクリプト', impact: '一度だけ' }, { label: '管理画面', impact: 'UC が増える' }], recommended: null, no_recommendation_reason: '要望に手掛かりが無い' },
    ],
    upstream_issues: [
      { id: 'list-entry', target_step: 'requirements', title: '差し戻された申請を開く入口が無い', detail: '自分の申請の一覧が要求に無い。', evidence: '画面の担当の確認', recommended_fix: '自分の申請一覧の UC を足す' },
      { id: 'resp-409', target_step: 'contract', title: '409 が契約に無い', detail: '同じキーの再利用の応答が無い。' },
    ],
  };
}

function write(dir, name, data) {
  const f = path.join(dir, name);
  fs.writeFileSync(f, JSON.stringify(data));
  return f;
}

test('validate: 正しい引き継ぎファイルは通り、推奨なしは理由があれば受理する', () => {
  assert.deepEqual(H.validate(base()), []);
  const empty = { schema_version: 'distillery2.handoff/v1', step: 'tier', asks: [], upstream_issues: [] };
  assert.deepEqual(H.validate(empty), [], '中身が空の配列はよい');
});

test('validate: 推奨が選択肢に無い・推奨なしで理由が無い・id の重複・戻し先の値の誤り・題名が長いを拒む', () => {
  const d = base();
  d.asks[0].recommended = 'クラウドの保管庫';
  delete d.asks[2].no_recommendation_reason;
  d.asks.push({ ...d.asks[1] });
  d.upstream_issues[1].target_step = 'feedback';
  d.upstream_issues[0].title = 'あ'.repeat(41);
  const errors = H.validate(d).join('\n');
  assert.match(errors, /recommended: 選択肢の label のどれでもない/);
  assert.match(errors, /no_recommendation_reason が要る/);
  assert.match(errors, /id: 重複 headcount/);
  assert.match(errors, /target_step/);
  assert.match(errors, /title/);
});

test('route: 選び方の問いは推奨で決め、事実が分からない問いは auto で人へ・recommend で仮置き、推奨なしは両モードとも人へ', () => {
  const auto = H.route(base(), 'auto');
  assert.deepEqual(auto.decide, [{ id: 'audit-store', answer: 'DB の表', provisional: false }]);
  assert.deepEqual(auto.to_human, [{ id: 'headcount', reason: 'unknown_fact' }, { id: 'seed', reason: 'no_recommendation' }]);
  const rec = H.route(base(), 'recommend');
  assert.deepEqual(rec.decide.map((x) => [x.id, x.provisional]), [['audit-store', false], ['headcount', true]]);
  assert.deepEqual(rec.to_human, [{ id: 'seed', reason: 'no_recommendation' }]);
  assert.deepEqual(auto.issues.upstream.map((x) => x.id), ['list-entry']);
  assert.deepEqual(auto.issues.in_feature.map((x) => x.id), ['resp-409']);
  assert.throws(() => H.route(base(), 'manual'), /auto か recommend/);
});

test('route: 反証で needs_info が残った指摘を返す', () => {
  const d = base();
  d.refutations = [{ finding: '指摘 1', result: 'accepted', reason: '直した', change: 'UC を足した' }, { finding: '指摘 2', result: 'needs_info', reason: '要望に無い' }];
  assert.deepEqual(H.route(d, 'auto').needs_info, ['指摘 2']);
});

test('file-drafts --run: 前のステップの課題を <run>/issues/ の下書きにし、target_step と互換の kind を書く。二度回しても増えない', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-handoff-'));
  const run = path.join(dir, '.distillery', 'runs', 'submit-expense');
  fs.mkdirSync(run, { recursive: true });
  const f = write(dir, 'contract-20261103.json', { ...base(), step: 'contract' });
  const r1 = H.fileDrafts(f, { ...base(), step: 'contract' }, { run });
  assert.equal(r1.written.length, 2);
  const names = fs.readdirSync(path.join(run, 'issues')).sort();
  assert.equal(names.length, 2);
  assert.ok(names.every((n) => /^\d{8}_\d{6}_contract_contract-20261103_/.test(n)), names.join(','));
  const text = fs.readFileSync(path.join(run, 'issues', names.find((n) => n.includes('list-entry'))), 'utf8');
  const fm = parseYaml(text.match(/^---\n([\s\S]*?)\n---/)[1]);
  assert.equal(fm.kind, 'requirement');
  assert.equal(fm.target_step, 'requirements');
  assert.equal(fm.source, 'handoff:contract');
  assert.match(text, /## 推奨の直し方\n\n自分の申請一覧の UC を足す/);
  const r2 = H.fileDrafts(f, { ...base(), step: 'contract' }, { run });
  assert.equal(r2.written.length, 0);
  assert.equal(r2.skipped.length, 2);
});

test('file-drafts --root: 上流の段は docs/feedback/ に課題ファイルを直接書く (from_uc なし)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-handoff-'));
  const f = write(dir, 'foundation-1.json', base());
  const out = JSON.parse(execFileSync(process.execPath, [path.join(SCRIPTS, 'handoff.js'), 'file-drafts', f, '--root', dir], { encoding: 'utf8' }));
  assert.equal(out.ok, true);
  assert.equal(out.written.length, 2);
  const fm = parseYaml(fs.readFileSync(out.written[0], 'utf8').match(/^---\n([\s\S]*?)\n---/)[1]);
  assert.equal(fm.status, 'open');
  assert.equal(fm.from_uc, null);
  assert.ok(out.written.every((p) => p.startsWith(path.join(dir, 'docs', 'feedback'))));
});

test('CLI: validate は不合格で exit 1、--findings は検証役の upstream_issues だけを読む', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-handoff-'));
  const bad = write(dir, 'bad.json', { schema_version: 'distillery2.handoff/v1', step: 'tier', asks: [{ id: 'x' }], upstream_issues: [] });
  let code = 0;
  try { execFileSync(process.execPath, [path.join(SCRIPTS, 'handoff.js'), 'validate', bad], { encoding: 'utf8' }); } catch (e) { code = e.status; }
  assert.equal(code, 1);
  const findings = write(dir, 'findings.backend-api.json', { findings: [{ id: 'F-1' }], upstream_issues: [base().upstream_issues[1]] });
  const out = JSON.parse(execFileSync(process.execPath, [path.join(SCRIPTS, 'handoff.js'), 'route', findings, '--findings'], { encoding: 'utf8' }));
  assert.deepEqual(out.issues.in_feature.map((x) => x.id), ['resp-409']);
});
