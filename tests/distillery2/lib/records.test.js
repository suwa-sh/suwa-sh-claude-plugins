'use strict';
// 0.3.0: 記録が消えない (止める前のレビューの指摘を下書きに・決めたことを D<n> で報告 → 引き継ぎ → 記録 → 一覧・止めた feature の記録も一覧に) と、
// 推奨で進めるモードの振り分け (推奨の無い問いは進行役が推奨を作る・プラグインの不具合)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const PLUGIN = path.resolve(__dirname, '../../../plugins/distillery2/skills');
const H = require(path.join(PLUGIN, 'd2-common/scripts/handoff'));
const DL = require(path.join(PLUGIN, 'd2-common/scripts/decisionLog'));
const rs = require(path.join(PLUGIN, 'd2-common/scripts/lib/runState'));
const HANDOFF = path.join(PLUGIN, 'd2-common/scripts/handoff.js');

function g(root, ...args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function w(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-records-'));
  g(root, 'init', '-q', '-b', 'main');
  g(root, 'config', 'user.email', 't@example.com');
  g(root, 'config', 'user.name', 't');
  w(path.join(root, 'README.md'), 'x\n');
  g(root, 'add', '-A');
  g(root, 'commit', '-q', '-m', 'base');
  return root;
}

const ROUND = `| # | 観点 | 判定 |
|---|---|---|
| P1 | 正確性 | FAIL |

### 指摘 1
- **perspective**: P1
- **対象**: apps/backend/src/booking.ts:42
- **severity**: high
- **claim**: 同じ時間帯の予約を二重に受け付ける
- **evidence**: 重なりの検査が無い
- **why_raised**: 二重予約になる
- **suggested_fix**: 重なりを検査して 409 を返す

### 指摘 2
- **perspective**: P1
- **対象**: apps/backend/src/cancel.ts
- **severity**: medium
- **claim**: 取り消しの期限を見ていない
- **evidence**: 期限の検査が無い
- **why_raised**: 期限後に取り消せる
`;

test('処理していないレビューの指摘を、止める前に下書きにする (file-drafts --review --target)。題名・本文・根拠・直し方が指摘から写る', () => {
  const root = repo();
  const run = rs.openRun(root, 'book-room');
  const md = path.join(run, 'reviews', 'implementation-backend', '1', 'round1.md');
  w(md, ROUND);
  const r = spawnSync(process.execPath, [HANDOFF, 'file-drafts', md, '--review', '--target', 'implementation', '--run', run], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.written.length, 2);
  const first = fs.readFileSync(out.written.find((f) => f.includes('_R1')), 'utf8');
  assert.match(first, /^title: 同じ時間帯の予約を二重に受け付ける$/m);
  assert.match(first, /^target_step: implementation$/m);
  assert.match(first, /対象: apps\/backend\/src\/booking\.ts:42/);
  assert.match(first, /## 推奨の直し方\n\n重なりを検査して 409 を返す/);
  const second = fs.readFileSync(out.written.find((f) => f.includes('_R2')), 'utf8');
  assert.match(second, /\(レビューの案なし\)/);
  // 上流で止めるときに課題ファイルになる (run の未処理の下書き)
  assert.equal(rs.unfiledIssues(run).length, 2);
  const again = spawnSync(process.execPath, [HANDOFF, 'file-drafts', md, '--review', '--target', 'implementation', '--run', run], { encoding: 'utf8' });
  assert.equal(JSON.parse(again.stdout).written.length, 0, '2 回回しても重ねない');
});

const HO = {
  schema_version: 'distillery2.handoff/v1', step: 'tier', asks: [], upstream_issues: [],
  decisions: [{ id: 'D1', topic: '予約の重なりの判定', choice: '開始と終了の半開区間で比べる', reason: '連続した予約を許す' }, { id: 'D2', topic: '取り消しの期限', choice: '開始の 1 時間前まで', reason: '要求の受入基準' }],
};

test('validate --report: 報告の「決めたこと」が D<n> で引き継ぎファイルの decisions と 1 対 1。ID の無い判断の行・欄に無い D<n>・件数の違いを拒む', () => {
  assert.deepEqual(H.validate(HO), []);
  const ok = '## 作ったもの\n- x\n\n## 決めたこと\n- D1 重なりは半開区間\n- D2 取り消しは 1 時間前まで\n\n## ゲート\n- pass\n';
  assert.deepEqual(H.checkReport(HO, ok), []);
  const noId = '## 決めたこと\n- D1 重なりは半開区間\n- D2 取り消しは 1 時間前まで\n- 画面の並び順は開始時刻\n';
  assert.ok(H.checkReport(HO, noId).some((e) => /D<n> で始まらない行/.test(e)));
  const extra = '## 決めたこと\n- D1 x\n- D2 y\n\n## メモ\nD3 も考えた\n';
  assert.ok(H.checkReport(HO, extra).some((e) => /D3 が引き継ぎファイルの decisions に無い/.test(e)));
  const missing = '## 決めたこと\n- D1 x\n';
  assert.ok(H.checkReport(HO, missing).some((e) => /件数/.test(e)));
  assert.ok(H.validate({ ...HO, decisions: [{ id: 'X1', topic: 't', choice: 'c', reason: 'r' }] }).length > 0, 'id は D<n>');
});

test('decisionLog add --decision: 決めたことを同じ D<n> で記録し、list と md の一覧に残る (担当が決めた)', () => {
  const root = repo();
  const run = rs.openRun(root, 'book-room');
  const hf = path.join(run, 'handoff', 'tier-backend-1.json');
  w(hf, JSON.stringify(HO));
  for (const d of ['D1', 'D2']) DL.add({ run, handoff: hf, decision: d, answer: 'x', by: 'recommended' });
  const ids = DL.list({ root }).map((e) => e.id);
  assert.deepEqual(ids, ['book-room:tier:D1', 'book-room:tier:D2']);
  const md = DL.toMarkdown(DL.list({ root }));
  assert.match(md, /予約の重なりの判定 \| 開始と終了の半開区間で比べる \| 担当が決めた/);
  assert.throws(() => DL.add({ run, handoff: hf, decision: 'D9', answer: 'x', by: 'recommended' }), /決めたことが無い/);
});

test('decisionLog: 推奨の無い問いは、進行役が作った推奨を --provisional のときだけ推奨として記録できる', () => {
  const root = repo();
  const hf = path.join(root, '.distillery/handoff/decide-1.json');
  w(hf, JSON.stringify({ schema_version: 'distillery2.handoff/v1', step: 'decide', upstream_issues: [], asks: [{ id: 'seed', kind: 'choice', question: '初期データ', options: [{ label: '移行', impact: 'a' }, { label: '画面', impact: 'b' }], recommended: null, no_recommendation_reason: '手掛かりが無い' }] }));
  assert.throws(() => DL.add({ root, handoff: hf, ask: 'seed', answer: '移行', by: 'recommended' }), /--provisional/);
  DL.add({ root, handoff: hf, ask: 'seed', answer: '移行', by: 'recommended', provisional: true });
  const e = DL.list({ root })[0];
  assert.equal(e.recommended_by, 'orchestrator');
  assert.equal(e.provisional, true);
  assert.match(DL.toMarkdown([e]), /進行役が作った推奨 \(仮置き\)/);
});

test('decisionLog list: 上流で止めた feature の run の記録を git show で読んで混ぜる (main にいても消えない)。その feature にいるときは作業ツリーから 1 回だけ', () => {
  const root = repo();
  g(root, 'switch', '-q', '-c', 'feature/book-room');
  const run = rs.openRun(root, 'book-room');
  DL.add({ run, page: 'page:scenario:approve', question: 'この振る舞いで合っているか', answer: '承認', by: 'recommended' });
  rs.appendEvent(run, 'blocked_on_upstream', { issues: [{ id: 'x', target: 'decide' }] });
  g(root, 'add', '-A');
  g(root, 'commit', '-q', '-m', 'blocked');
  g(root, 'switch', '-q', 'main');
  const all = DL.list({ root });
  assert.deepEqual(all.map((e) => [e.id, e.where]), [['page:scenario:approve', 'paused:feature/book-room']]);
  g(root, 'switch', '-q', 'feature/book-room');
  assert.deepEqual(DL.list({ root }).map((e) => e.where), ['.distillery/runs/book-room'], 'その feature にいるときは作業ツリーから 1 回だけ読む');
});

test('route: プラグインの不具合 (反証の結果・課題の戻し先 plugin) を分けて返し、課題ファイルは kind: plugin (戻し先なし) で書く', () => {
  const root = repo();
  const d = { schema_version: 'distillery2.handoff/v1', step: 'refute', asks: [], upstream_issues: [{ id: 'P1', target_step: 'plugin', title: 'runGates が壊れる', detail: 'd', evidence: 'e', recommended_fix: 'f' }],
    refutations: [{ finding: '指摘 1', result: 'plugin', reason: '検査の仕組みの誤り' }] };
  assert.deepEqual(H.validate(d), []);
  const r = H.route(d, 'recommend');
  assert.deepEqual(r.issues.plugin.map((x) => x.id), ['P1']);
  assert.deepEqual(r.plugin_findings, ['指摘 1']);
  const run = rs.openRun(root, 'book-room');
  const out = H.fileDrafts(path.join(run, 'handoff', 'refute-1.json'), d, { run });
  const text = fs.readFileSync(out.written[0], 'utf8');
  assert.match(text, /^kind: plugin$/m);
  assert.doesNotMatch(text, /^target_step:/m);
});
