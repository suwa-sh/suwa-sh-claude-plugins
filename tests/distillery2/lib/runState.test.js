'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const rs = require('../../../plugins/distillery2/skills/d2-common/scripts/lib/runState');

test('open, events, done, status, invalidate, attempts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-run-'));
  const dir = rs.openRun(root, 'register-loan', { uc: '貸出業務/書籍を貸し出すフロー/貸出を登録する' });
  assert.equal(dir, path.join(root, '.distillery', 'runs', 'register-loan'));
  assert.equal(rs.readEvents(dir).length, 1);
  rs.openRun(root, 'register-loan');
  assert.equal(rs.readEvents(dir).length, 1, 'reopen does not duplicate run_opened');

  rs.appendEvent(dir, 'scenario_approved', { by: 'user' });
  rs.markDone(dir, 'scenario', { commit: 'abc' });
  assert.equal(rs.isDone(dir, 'scenario'), true);
  assert.equal(rs.readDone(dir, 'scenario').commit, 'abc');

  let s = rs.status(dir);
  assert.equal(s.stages.scenario, 'done');
  assert.equal(s.next_stage, 'contract');
  assert.equal(s.attempt, 1);
  assert.equal(s.events, 3);

  rs.attemptDir(dir, 2);
  assert.equal(rs.currentAttempt(dir), 2);

  const moved = rs.invalidate(dir, 'scenario', 'requirements changed');
  assert.ok(fs.existsSync(moved));
  assert.equal(rs.isDone(dir, 'scenario'), false);
  s = rs.status(dir);
  assert.equal(s.next_stage, 'scenario');
  assert.equal(s.last_event.type, 'stage_invalidated');
  assert.equal(rs.invalidate(dir, 'scenario', 'again'), null);
});

test('invalidateFrom: その段階と後ろの段階の done をまとめて退避する (as-built から integrate へ戻すとき。0.1.23)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-run-'));
  const dir = rs.openRun(root, 'register-return');
  for (const s of ['scenario', 'contract', 'scaffold', 'tier', 'contract-gate', 'integrate', 'verify', 'review', 'deliver']) rs.markDone(dir, s, {});
  const moved = rs.invalidateFrom(dir, 'integrate', 'as-built に計装なしのティア');
  assert.deepEqual(moved.map(p => path.basename(p).replace(/^\d+_\d+_/, '')), ['integrate.done.yaml', 'verify.done.yaml', 'review.done.yaml', 'deliver.done.yaml'], 'done の無い asbuilt は飛ばす');
  const s = rs.status(dir);
  assert.equal(s.next_stage, 'integrate');
  assert.equal(s.stages.tier, 'done', '前の段階は残す');
  assert.throws(() => rs.invalidateFrom(dir, 'nope', 'x'), /unknown stage/);
  // CLI
  rs.markDone(dir, 'integrate', {});
  rs.markDone(dir, 'verify', {});
  const cli = require('node:child_process').execFileSync('node', [path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-common/scripts/lib/runState.js'), 'invalidate', dir, 'integrate', 'again', '--from'], { encoding: 'utf8' });
  assert.equal(cli.trim().split('\n').length, 2);
  assert.equal(rs.status(dir).next_stage, 'integrate');
});

test('returnToIntegrate: findings の退避 → integrate 以降の done の退避 → イベントを 1 操作で行い、何度戻っても上書きしない (0.1.23)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-run-'));
  const dir = rs.openRun(root, 'register-return');
  for (const s of ['scenario', 'contract', 'scaffold', 'tier', 'contract-gate', 'integrate', 'verify', 'review']) rs.markDone(dir, s, {});
  const a1 = rs.attemptDir(dir, 1);
  fs.writeFileSync(path.join(a1, 'findings.backend-api.yaml'), 'v: 1\n');
  fs.writeFileSync(path.join(a1, 'findings.frontend.yaml'), 'v: 1\n');
  fs.writeFileSync(path.join(a1, 'assumptions.backend-api.yaml'), 'keep: true\n');
  const r = rs.returnToIntegrate(dir, { instrumentation_gaps: ['backend-api'], instrumentation_happy_gaps: [] });
  assert.equal(r.moved_findings.length, 2);
  assert.ok(r.moved_findings.every(p => /^invalidated\/\d{8}_\d{6}_attempt-1_findings\.[a-z-]+\.yaml$/.test(p)), r.moved_findings.join(','));
  assert.deepEqual(fs.readdirSync(a1), ['assumptions.backend-api.yaml'], 'findings だけ移し、assumptions は残す');
  assert.equal(r.invalidated.length, 3, 'integrate・verify・review の done');
  const s = rs.status(dir);
  assert.equal(s.next_stage, 'integrate');
  assert.equal(s.attempt, 1, 'attempt は上げない');
  const ev = rs.readEvents(dir).filter(e => e.type === 'returned_to_integrate');
  assert.equal(ev.length, 1);
  assert.deepEqual(ev[0].instrumentation_gaps, ['backend-api']);
  assert.deepEqual(ev[0].moved_findings, r.moved_findings);
  // 同じ attempt でもう一度戻る (同じ秒でも上書きしない)
  rs.markDone(dir, 'integrate', {}); rs.markDone(dir, 'verify', {});
  fs.writeFileSync(path.join(a1, 'findings.backend-api.yaml'), 'v: 2\n');
  const r2 = rs.returnToIntegrate(dir, { instrumentation_gaps: ['backend-api'] });
  assert.equal(r2.moved_findings.length, 1);
  const all = fs.readdirSync(path.join(dir, 'invalidated')).filter(n => n.includes('findings.backend-api'));
  assert.equal(all.length, 2, '1 回目の退避を上書きしない');
  // CLI
  const out = require('node:child_process').execFileSync('node', [path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-common/scripts/lib/runState.js'), 'return-to-integrate', dir, '{"instrumentation_gaps":[]}'], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(out).moved_findings, []);
});

test('pendingFeedback: 保留と解消 (新形式・旧形式)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-run-'));
  const dir = rs.openRun(root, 'register-return');
  assert.deepEqual(rs.pendingFeedback(dir), [], '還流が無ければ空');

  // 新形式の保留
  rs.appendEvent(dir, 'feedback_deferred', { kind: 'contract', issue_path: 'issues/a.md', reason: 'headless' });
  // 0.1.18 以前の記録: url 空の feedback_filed (issue をパスとみなす)。絶対パスでも issues/ 以降で照合する
  rs.appendEvent(dir, 'feedback_filed', { kind: 'requirement', issue: '/repo/.distillery/runs/register-return/issues/b.md', url: null, status: 'deferred' });
  let p = rs.pendingFeedback(dir);
  assert.deepEqual(p.map(x => [x.kind, x.issue_path]), [['contract', 'issues/a.md'], ['requirement', 'issues/b.md']]);
  assert.equal(p[0].reason, 'headless');
  assert.deepEqual(rs.status(dir).pending_feedback.map(x => x.issue_path), ['issues/a.md', 'issues/b.md'], 'status に載る');

  // 起票 (url 付き filed) で解消。旧形式の issue キーでも照合する
  rs.appendEvent(dir, 'feedback_filed', { kind: 'contract', issue_path: 'issues/a.md', url: 'https://example/pr/1' });
  rs.appendEvent(dir, 'feedback_filed', { kind: 'requirement', issue: 'issues/b.md', url: 'https://example/issues/2' });
  assert.deepEqual(rs.pendingFeedback(dir), []);

  // url 付きでも別の issue は解消しない / issue パスの無い保留は残る
  rs.appendEvent(dir, 'feedback_deferred', { kind: 'rule', issue_path: 'issues/c.md', reason: 'no remote' });
  rs.appendEvent(dir, 'feedback_filed', { kind: 'rule', issue_path: 'issues/other.md', url: 'https://example/pr/3' });
  rs.appendEvent(dir, 'feedback_filed', { kind: 'contract', url: '' });
  p = rs.pendingFeedback(dir);
  assert.deepEqual(p.map(x => x.issue_path), ['issues/c.md', null]);
});

test('段階の順 (0.1.27): UC は配送 (deliver) で終わる。還流は UC の段階に無い。課題ファイルにしていない課題を status に出す', () => {
  assert.deepEqual(rs.STAGES.slice(-2), ['asbuilt', 'deliver']);
  assert.equal(rs.STAGES.includes('feedback'), false);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-run-'));
  const dir = rs.openRun(root, 'uc');
  for (const s of rs.STAGES.slice(0, rs.STAGES.indexOf('asbuilt') + 1)) rs.markDone(dir, s);
  assert.equal(rs.status(dir).next_stage, 'deliver');
  fs.writeFileSync(path.join(dir, 'issues', 'a.md'), '---\nkind: contract\n---\n');
  assert.deepEqual(rs.status(dir).unfiled_issues, ['issues/a.md']);
  const text = require('node:child_process').execFileSync('node', [path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-common/scripts/lib/runState.js'), 'status', dir], { encoding: 'utf8' });
  assert.match(text, /unfiled issues \(課題ファイルにしていない課題\): 1\n {2}- issues\/a\.md/);
  rs.appendEvent(dir, 'feedback_filed', { kind: 'contract', ref: 'docs/feedback/a.md', issue_path: 'issues/a.md' });
  rs.markDone(dir, 'deliver', { squash: 'abc' });
  const st = rs.status(dir);
  assert.equal(st.next_stage, null, '配送で全段 done');
  assert.deepEqual(st.unfiled_issues, []);
  assert.equal(st.legacy_order, false);
  // 0.1.26 の run が持つ feedback の done は旧形式と判定しない (配送の done がある)
  rs.markDone(dir, 'feedback');
  assert.equal(rs.status(dir).legacy_order, false);
});

test('feedback_filed の ref (0.1.26) でも起票済み。filedIssues は ref / url 付きだけ', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-run-'));
  const dir = rs.openRun(root, 'uc');
  rs.appendEvent(dir, 'feedback_deferred', { kind: 'rule', issue_path: 'issues/a.md', reason: 'old' });
  rs.appendEvent(dir, 'feedback_filed', { kind: 'rule', ref: '0123abc', issue_path: 'issues/a.md' });
  rs.appendEvent(dir, 'feedback_filed', { kind: 'requirement', ref: 'docs/feedback/b.md', issue_path: 'issues/b.md' });
  rs.appendEvent(dir, 'feedback_filed', { kind: 'contract', url: 'https://example/pr/1', issue_path: 'issues/c.md' });
  rs.appendEvent(dir, 'feedback_filed', { kind: 'contract', ref: '', issue_path: 'issues/d.md' });
  assert.deepEqual(rs.pendingFeedback(dir).map(x => x.issue_path), ['issues/d.md']);
  assert.deepEqual(rs.filedIssues(dir), ['issues/a.md', 'issues/b.md', 'issues/c.md']);
});

test('旧形式の順 (還流 done・配送 done 無し) は次の段階を出さず、mark-legacy-delivered で配送済みにする', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-run-'));
  const dir = rs.openRun(root, 'uc');
  for (const s of [...rs.STAGES, 'feedback']) if (s !== 'deliver') rs.markDone(dir, s);
  let st = rs.status(dir);
  assert.equal(st.legacy_order, true);
  assert.equal(st.next_stage, null);
  const out = require('node:child_process').execFileSync('node', [path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-common/scripts/lib/runState.js'), 'mark-legacy-delivered', dir], { encoding: 'utf8' });
  assert.equal(JSON.parse(out).legacy, true);
  assert.equal(JSON.parse(out).feedback_reopened, false, '課題が無ければ還流の done はそのまま');
  st = rs.status(dir);
  assert.equal(st.legacy_order, false);
  assert.equal(st.next_stage, null, '全段 done');
  assert.equal(rs.readDone(dir, 'deliver').legacy, true);
  // 旧形式でない run には使えない
  const dir2 = rs.openRun(root, 'uc2');
  assert.throws(() => rs.markLegacyDelivered(dir2), /旧形式/);
});

test('旧形式の run に配送済みの印を付けるとき、起票されていない課題があれば還流の done を退避する (差分レビュー 2 ラウンド目)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-run-'));
  const dir = rs.openRun(root, 'uc');
  for (const f of ['a.md', 'b.md', 'c.md']) fs.writeFileSync(path.join(dir, 'issues', f), '---\nkind: rule\n---\n');
  // a は旧形式で起票済み (url)、b は旧形式の url 空 (保留)、c は記録なし
  rs.appendEvent(dir, 'feedback_filed', { kind: 'rule', url: 'https://example/pr/1', issue_path: 'issues/a.md' });
  rs.appendEvent(dir, 'feedback_filed', { kind: 'rule', url: null, issue: 'issues/b.md' });
  for (const s of [...rs.STAGES, 'feedback']) if (s !== 'deliver') rs.markDone(dir, s);
  assert.deepEqual(rs.unfiledIssues(dir), ['issues/b.md', 'issues/c.md']);
  const r = rs.markLegacyDelivered(dir);
  assert.equal(r.feedback_reopened, true);
  assert.deepEqual(r.unfiled_issues, ['issues/b.md', 'issues/c.md']);
  const st = rs.status(dir);
  assert.equal(st.stages.deliver, 'done');
  assert.equal(st.next_stage, null, 'UC の段階は配送で終わり');
  assert.deepEqual(st.unfiled_issues, ['issues/b.md', 'issues/c.md'], '起票されていない課題は還流の段階 (feedbackBatch の移行) が課題ファイルにする');
  assert.deepEqual(st.filed_issues, ['issues/a.md'], '起票済みの旧記録はそのまま数える');
});

test('旧形式の印付けが途中で止まっても (配送の done だけ作って還流の done を退避していない)、旧形式と判定され、もう一度 mark すれば完了する (差分レビュー 3 ラウンド目)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-run-'));
  const dir = rs.openRun(root, 'uc');
  fs.writeFileSync(path.join(dir, 'issues', 'x.md'), '---\nkind: contract\n---\n');
  for (const s of [...rs.STAGES, 'feedback']) if (s !== 'deliver') rs.markDone(dir, s);
  // 途中で止まった状態: 配送の done (legacy) だけあり、還流の done は残っている
  rs.markDone(dir, 'deliver', { legacy: true });
  let st = rs.status(dir);
  assert.equal(st.legacy_order, true, '中間状態も旧形式');
  assert.equal(st.next_stage, null);
  const r = rs.markLegacyDelivered(dir);
  assert.equal(r.feedback_reopened, true);
  st = rs.status(dir);
  assert.equal(st.legacy_order, false);
  assert.equal(st.next_stage, null);
  assert.deepEqual(st.unfiled_issues, ['issues/x.md']);
  // 新しい順で還流まで済んだ run (課題がすべて起票済み) は旧形式ではない
  rs.appendEvent(dir, 'feedback_filed', { kind: 'contract', ref: 'docs/feedback/x.md', issue_path: 'issues/x.md' });
  rs.markDone(dir, 'feedback');
  assert.equal(rs.status(dir).legacy_order, false);
});

test('0.1.32 O18: event / done は --data-file で JSON を受ける (argv の JSON と排他)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-run-'));
  const dir = rs.openRun(root, 'uc');
  const cli = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-common/scripts/lib/runState.js');
  const f = path.join(root, 'data.json');
  fs.writeFileSync(f, JSON.stringify({ note: '長い日本語の JSON をファイルで渡す', items: ['画面の見本 stories の文言'] }));
  const { execFileSync, spawnSync } = require('node:child_process');
  const ev = JSON.parse(execFileSync('node', [cli, 'event', dir, 'carry_over_migrated', '--data-file', f], { encoding: 'utf8' }));
  assert.equal(ev.type, 'carry_over_migrated');
  assert.deepEqual(ev.items, ['画面の見本 stories の文言']);
  const done = JSON.parse(execFileSync('node', [cli, 'done', dir, 'scenario', '--data-file', f], { encoding: 'utf8' }));
  assert.equal(done.note, '長い日本語の JSON をファイルで渡す');
  assert.equal(rs.readDone(dir, 'scenario').note, '長い日本語の JSON をファイルで渡す');
  const both = spawnSync('node', [cli, 'event', dir, 'x', '{"a":1}', '--data-file', f], { encoding: 'utf8' });
  assert.notEqual(both.status, 0, 'argv の JSON と --data-file の両方は拒む');
});

test('0.1.32 J2: assumption_resolved は targets の {tier, attempt, id} を attempt-<n>/assumptions.<tier>.yaml で確かめる (最新でない attempt も可。同じ id が 2 ティアにあっても tier で区別。無い組は拒む)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-run-'));
  const dir = rs.openRun(root, 'register-loan');
  const w = (n, tier, ids) => { fs.mkdirSync(path.join(dir, `attempt-${n}`), { recursive: true }); fs.writeFileSync(path.join(dir, `attempt-${n}`, `assumptions.${tier}.yaml`), ['tier: ' + tier, 'assumptions:', ...ids.map(id => `  - id: ${id}\n    assumption: x`)].join('\n') + '\n'); };
  w(1, 'frontend', ['A-004', 'A-005']);
  w(2, 'frontend', ['A-004', 'A-006']);
  w(2, 'backend-api', ['A-004']);
  const ok = rs.appendEvent(dir, 'assumption_resolved', { targets: [{ tier: 'frontend', attempt: 1, id: 'A-005' }, { tier: 'frontend', attempt: 2, id: 'A-006' }, { tier: 'backend-api', attempt: 2, id: 'A-004' }], decision: '貸出日は登録時に決まる', by: 'req: feedback' });
  assert.equal(ok.type, 'assumption_resolved');
  assert.equal(ok.targets.length, 3);
  assert.throws(() => rs.appendEvent(dir, 'assumption_resolved', { targets: [{ tier: 'frontend', attempt: 2, id: 'A-005' }], decision: 'x' }), /frontend\/attempt-2\/A-005/, '最新の attempt に無い id は拒む');
  assert.throws(() => rs.appendEvent(dir, 'assumption_resolved', { targets: [{ tier: 'backend-api', attempt: 2, id: 'A-006' }], decision: 'x' }), /backend-api\/attempt-2\/A-006/, '別ティアの id では閉じられない');
  assert.throws(() => rs.appendEvent(dir, 'assumption_resolved', { targets: [], decision: 'x' }), /targets/);
  assert.throws(() => rs.appendEvent(dir, 'assumption_resolved', { targets: [{ tier: 'frontend', attempt: 1, id: 'A-004' }] }), /decision/);
  assert.throws(() => rs.appendEvent(dir, 'assumption_resolved', { targets: [{ tier: 'frontend', id: 'A-004' }], decision: 'x' }), /attempt/);
  assert.equal(rs.readEvents(dir).filter(e => e.type === 'assumption_resolved').length, 1, '拒んだものは記録されない');
});

test('0.1.33 P16: scenario-approve は feature の bytes の sha256 と、@uc:<slug> を持つシナリオがある受入 feature の sha256 を scenario_approved に書く (他 UC だけの受入 feature は入れない。dir 無しは {}。feature 無し・@uc 無しは拒む)', () => {
  const crypto = require('node:crypto');
  const { execFileSync, spawnSync } = require('node:child_process');
  const cli = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-common/scripts/lib/runState.js');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-run-'));
  const dir = rs.openRun(root, 'register-book');
  const W = (rel, text) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); return p; };
  const sha = (rel) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
  W('features/書籍/register-book.feature', '# language: ja\n@uc:register-book\n機能: 書籍を登録する\n  @acceptance @acceptance:SPEC-001-01-1\n  シナリオ: 登録\n    前提 x\r\n');
  W('features/acceptance/SPEC-001-01.feature', '機能: 共有\n  @uc:register-book @acceptance @acceptance:SPEC-001-01-2\n  シナリオ: A\n  @uc:edit-book\n  シナリオ: B\n');
  W('features/acceptance/SPEC-009-01.feature', '@uc:delete-book\n機能: 他 UC だけ\n  シナリオ: C\n');
  W('features/acceptance/README.md', 'not a feature');
  const ev = JSON.parse(execFileSync('node', [cli, 'scenario-approve', dir, '--feature', 'features/書籍/register-book.feature', '--acceptance-dir', 'features/acceptance'], { cwd: root, encoding: 'utf8' }));
  assert.equal(ev.type, 'scenario_approved');
  assert.equal(ev.feature, 'features/書籍/register-book.feature');
  assert.equal(ev.feature_sha256, sha('features/書籍/register-book.feature'), 'bytes そのまま (CRLF を正規化しない)');
  assert.deepEqual(ev.acceptance, { 'features/acceptance/SPEC-001-01.feature': sha('features/acceptance/SPEC-001-01.feature') }, 'この UC のタグを持つシナリオがあるファイルだけ');
  const last = rs.readEvents(dir).at(-1);
  assert.equal(last.type, 'scenario_approved');
  assert.deepEqual(Object.keys(last.acceptance), ['features/acceptance/SPEC-001-01.feature']);
  // 受入 dir が無ければ {}。Feature タグで @uc を持つファイルも対象
  const ev2 = rs.scenarioApprove(dir, path.join(root, 'features/書籍/register-book.feature'), path.join(root, 'no-such-dir'));
  assert.deepEqual(ev2.acceptance, {});
  W('features/acceptance/SPEC-001-09.feature', '@uc:register-book\n機能: Feature タグ\n  @acceptance @acceptance:SPEC-001-01-1\n  シナリオ: D\n');
  const ev3 = rs.scenarioApprove(dir, path.join(root, 'features/書籍/register-book.feature'), path.join(root, 'features/acceptance'));
  assert.deepEqual(Object.keys(ev3.acceptance).map(p => path.basename(p)), ['SPEC-001-01.feature', 'SPEC-001-09.feature'], 'path 昇順');
  // 異常系
  assert.throws(() => rs.scenarioApprove(dir, path.join(root, 'features/none.feature'), null), /feature が無い/);
  W('features/書籍/no-tag.feature', '機能: タグ無し\n  シナリオ: E\n');
  assert.throws(() => rs.scenarioApprove(dir, path.join(root, 'features/書籍/no-tag.feature'), null), /@uc:<slug> タグが無い/);
  const r = spawnSync('node', [cli, 'scenario-approve', dir], { cwd: root, encoding: 'utf8' });
  assert.notEqual(r.status, 0, '--feature は必須');
  assert.equal(rs.readEvents(dir).filter(e => e.type === 'scenario_approved').length, 3, '拒んだものは記録されない');
});
