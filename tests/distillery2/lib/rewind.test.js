'use strict';
// 0.2.0: 前のステップの課題の戻し方 (機能の中の巻き戻し・段を指定した開き直し・回数の上限・戻し先の写しと振り分け)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

const PLUGIN = path.resolve(__dirname, '../../../plugins/distillery2/skills');
const rs = require(path.join(PLUGIN, 'd2-common/scripts/lib/runState'));
const RS = path.join(PLUGIN, 'd2-common/scripts/lib/runState.js');
const FB = path.join(PLUGIN, 'd2-common/scripts/feedbackBatch.js');

const USE_CASES = `version: "1.0"
use_cases:
  - uc_id: aaaa0001
    business: 経費申請業務
    uc: 経費を申請する
    slug: submit-expense
    spec_ids:
      - SPEC-001-01
    spec_ids_rejected: []
    status: done
`;
const FEATURE = '@uc:submit-expense\nFeature: 経費を申請する\n  @acceptance @acceptance:SPEC-001-01-1\n  Scenario: 申請できる\n    Given 前提\n    When 操作\n    Then 結果\n';

function w(root, rel, text) { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); }

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-rewind-'));
  w(root, 'docs/requirements/use-cases.yaml', USE_CASES);
  w(root, 'docs/requirements/requirements.yaml', 'requirements:\n  - id: REQ-001\n    specifications:\n      - id: SPEC-001-01\n        acceptance_criteria:\n          - 申請できる\n');
  w(root, 'features/経費申請業務/submit-expense.feature', FEATURE);
  const dir = rs.openRun(root, 'submit-expense');
  const prev = process.cwd();
  process.chdir(root);
  try { rs.scenarioApprove(dir, 'features/経費申請業務/submit-expense.feature'); } finally { process.chdir(prev); }
  for (const s of rs.STAGES) rs.markDone(dir, s, { squash: 'x' });
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A'], { cwd: root });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init'], { cwd: root });
  return root;
}

function run(args, cwd) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', cwd });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

test('rewind: 契約へ巻き戻すと contract 以降の done を退避し、課題の下書きを consumed/ へ移して rewound を記録する', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-rewind-'));
  const dir = rs.openRun(root, 'resubmit');
  for (const s of ['scenario', 'contract', 'scaffold', 'tier']) rs.markDone(dir, s, {});
  w(dir, 'issues/20261103_010000_tier_resubmit.md', '---\nkind: contract\ntitle: 404 と 200 が区別できない\ntarget_step: contract\n---\n本文\n');
  const r = rs.rewind(dir, 'contract', { issue: 'issues/20261103_010000_tier_resubmit.md', reason: '例が区別できない' });
  assert.equal(r.stage, 'contract');
  assert.equal(rs.isDone(dir, 'scenario'), true);
  assert.equal(rs.isDone(dir, 'contract'), false);
  assert.equal(rs.isDone(dir, 'tier'), false);
  assert.equal(r.consumed, 'issues/consumed/20261103_010000_tier_resubmit.md');
  assert.deepEqual(rs.unfiledIssues(dir), [], 'consumed/ は main マージで課題ファイルにしない');
  const ev = rs.readEvents(dir).filter((e) => e.type === 'rewound');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].to, 'contract');
  assert.equal(rs.status(dir).next_stage, 'contract');
  assert.equal(rs.status(dir).rewinds, 1);
});

test('rewind implementation: attempt を 1 つ上げて tier から (契約ゲート・結合・検証・人レビューの差し戻しと同じ)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-rewind-'));
  const dir = rs.openRun(root, 'resubmit');
  for (const s of ['scenario', 'contract', 'scaffold', 'tier', 'contract-gate']) rs.markDone(dir, s, {});
  const r = rs.rewind(dir, 'implementation');
  assert.equal(r.attempt, 2);
  assert.equal(rs.currentAttempt(dir), 2);
  assert.equal(rs.isDone(dir, 'scaffold'), true);
  assert.equal(rs.isDone(dir, 'tier'), false);
  assert.throws(() => rs.rewind(dir, 'tier'), /scenario \/ contract \/ implementation/);
});

test('上限: 巻き戻しと as-built からの差し戻しを合わせて 3 回で止まり、--override-limit のときだけ越える (CLI は exit 3)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-rewind-'));
  const dir = rs.openRun(root, 'resubmit');
  rs.rewind(dir, 'implementation');
  rs.returnToIntegrate(dir, {});
  rs.rewind(dir, 'contract');
  assert.throws(() => rs.rewind(dir, 'contract'), (e) => e instanceof rs.LimitError && /上限 \(3 回\)/.test(e.message));
  assert.throws(() => rs.returnToIntegrate(dir, {}), rs.LimitError);
  const r = run([RS, 'rewind', dir, 'scenario']);
  assert.equal(r.code, 3);
  assert.equal(JSON.parse(r.out).limit_reached, true);
  const ok = run([RS, 'rewind', dir, 'scenario', '--override-limit', '--reason', '人が続けると答えた']);
  assert.equal(ok.code, 0, ok.err);
  assert.equal(rs.readEvents(dir).filter((e) => e.type === 'rewound').pop().over_limit, true);
});

test('reopen --from contract: 前の段の done と scenario の承認を引き継ぎ、next_stage は contract になる', () => {
  const root = makeRepo();
  const r = run([RS, 'reopen', root, 'submit-expense', '--from', 'contract', '--issue', 'docs/feedback/20261103_092058_frontend_submit-expense.md']);
  assert.equal(r.code, 0, r.err);
  const out = JSON.parse(r.out);
  assert.deepEqual(out.inherited, ['scenario']);
  assert.equal(out.reopens, 1);
  const dir = rs.runDirOf(root, 'submit-expense');
  assert.equal(rs.status(dir).next_stage, 'contract');
  const ev = rs.readEvents(dir);
  assert.ok(ev.some((e) => e.type === 'scenario_approved' && e.inherited_from_seq));
  assert.ok(ev.some((e) => e.type === 'inherited' && e.from === 'contract'));
  const archived = path.join(root, out.archived_to);
  const reopened = JSON.parse(fs.readFileSync(path.join(archived, 'reopened.json'), 'utf8'));
  assert.equal(reopened.from, 'contract');
  assert.deepEqual(reopened.issues, ['docs/feedback/20261103_092058_frontend_submit-expense.md']);
  assert.deepEqual(rs.reopenedSlugs(root), ['submit-expense']);
});

test('reopen --from implementation: scenario・contract・scaffold を引き継ぐ。承認の後に feature が変わっていたら何も引き継がず scenario から', () => {
  const root = makeRepo();
  const out = JSON.parse(run([RS, 'reopen', root, 'submit-expense', '--from', 'implementation']).out);
  assert.deepEqual(out.inherited, ['scenario', 'contract', 'scaffold']);
  assert.equal(rs.status(rs.runDirOf(root, 'submit-expense')).next_stage, 'tier');

  const root2 = makeRepo();
  fs.appendFileSync(path.join(root2, 'features/経費申請業務/submit-expense.feature'), '\n  Scenario: 足した\n    Given a\n');
  const out2 = JSON.parse(run([RS, 'reopen', root2, 'submit-expense', '--from', 'contract']).out);
  assert.deepEqual(out2.inherited, []);
  assert.match(out2.not_inherited_reason, /feature が変わった/);
  assert.equal(fs.existsSync(rs.runDirOf(root2, 'submit-expense')), false, '新しい run は次の ④ の開始で作る (今どおり)');
});

test('reopen: 同じ UC の開き直しは 3 回で止まる', () => {
  const root = makeRepo();
  const arch = path.join(root, '.distillery', 'archive', 'runs', 'submit-expense');
  for (const t of ['20261101T000000Z', '20261102T000000Z', '20261103T000000Z']) fs.mkdirSync(path.join(arch, t), { recursive: true });
  const r = run([RS, 'reopen', root, 'submit-expense', '--from', 'contract']);
  assert.equal(r.code, 3);
  assert.match(JSON.parse(r.out).error, /開き直しが上限/);
});

test('file-issues は target_step を写して値を検査し、target_step の無い古い下書きは kind から戻し先を決める', () => {
  const root = makeRepo();
  const dir = rs.runDirOf(root, 'submit-expense');
  w(dir, 'issues/20261103_a_tier_submit-expense.md', '---\nkind: contract\ntitle: 実装が要る\ntarget_step: implementation\n---\n本文\n');
  w(dir, 'issues/20261103_b_tier_submit-expense.md', '---\nkind: rule\ntitle: 古い形\n---\n本文\n');
  const r = run([FB, 'file-issues', dir, '--cwd', root]);
  assert.equal(r.code, 0, r.out + r.err);
  const read = (id) => fs.readFileSync(path.join(root, 'docs', 'feedback', `${id}.md`), 'utf8');
  assert.match(read('20261103_a_tier_submit-expense'), /target_step: implementation/);
  assert.match(read('20261103_b_tier_submit-expense'), /target_step: decide/);
  w(dir, 'issues/20261103_c_tier_submit-expense.md', '---\nkind: contract\ntitle: 不正\ntarget_step: feedback\n---\n本文\n');
  assert.notEqual(run([FB, 'file-issues', dir, '--cwd', root]).code, 0);
});

test('scan: 上流の課題を戻し先ごとに、main マージ済みの UC への課題を開き直す段ごとにまとめる (止まった課題も含む)', () => {
  const root = makeRepo();
  w(root, 'docs/feedback/a.md', '---\nkind: requirement\ntitle: 入口が無い\nfrom_uc: submit-expense\nstatus: open\n---\n');
  w(root, 'docs/feedback/b.md', '---\nkind: rule\ntitle: ルール\nfrom_uc: submit-expense\nstatus: open\n---\n');
  w(root, 'docs/feedback/c.md', '---\nkind: contract\ntitle: "止まった: 409"\nfrom_uc: submit-expense\nstatus: open\nstopped: true\nstopped_count: 1\n---\n');
  w(root, 'docs/feedback/d.md', '---\nkind: contract\ntitle: 実装\ntarget_step: implementation\nfrom_uc: submit-expense\nstatus: open\n---\n');
  w(root, 'docs/feedback/e.md', '---\nkind: plugin\ntitle: プラグイン\nfrom_uc: submit-expense\nstatus: open\n---\n');
  const r = run([FB, 'scan', '--cwd', root]);
  assert.equal(r.code, 0, r.err);
  const s = JSON.parse(r.out);
  assert.deepEqual(s.upstream, { requirements: ['a'], decide: ['b'], foundation: [] });
  assert.deepEqual(s.reopen_targets, [{ uc: 'submit-expense', from: 'contract', issues: ['c', 'd'] }]);
  assert.deepEqual(s.plugin, ['e']);
});
