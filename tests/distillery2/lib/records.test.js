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

test('validate --report: 報告の「決めたこと」が D<n> で引き継ぎファイルの decisions と 1 対 1。ID の無い判断の行・decisions に無い D<n>・件数の違いを拒む (欄の外の D<n> は前の段の決定を引くので照らさない)', () => {
  assert.deepEqual(H.validate(HO), []);
  const ok = '## 作ったもの\n- x\n\n## 決めたこと\n- D1 重なりは半開区間\n- D2 取り消しは 1 時間前まで\n\n## ゲート\n- pass\n';
  assert.deepEqual(H.checkReport(HO, ok), []);
  const noId = '## 決めたこと\n- D1 重なりは半開区間\n- D2 取り消しは 1 時間前まで\n- 画面の並び順は開始時刻\n';
  assert.ok(H.checkReport(HO, noId).some((e) => /D<n> で始まらない行/.test(e)));
  // 欄の外の D<n> (前の段の決定を引く) は照らさない
  const earlier = '## 作ったもの\n- 要求の段の D3 に合わせた\n\n## 決めたこと\n- D1 x\n- D2 y\n';
  assert.deepEqual(H.checkReport(HO, earlier), []);
  const extra = '## 決めたこと\n- D1 x\n- D3 y\n';
  assert.ok(H.checkReport(HO, extra).some((e) => /「決めたこと」の D3 が引き継ぎファイルの decisions に無い/.test(e)));
  const missing = '## 決めたこと\n- D1 x\n';
  assert.ok(H.checkReport(HO, missing).some((e) => /件数/.test(e)));
  assert.ok(H.validate({ ...HO, decisions: [{ id: 'X1', topic: 't', choice: 'c', reason: 'r' }] }).length > 0, 'id は D<n>');
});

test('decisionLog add --decision: 決めたことを同じ D<n> で記録し、list と md の一覧に残る (担当が決めた)', () => {
  const root = repo();
  const run = rs.openRun(root, 'book-room');
  const hf = path.join(run, 'handoff', 'tier-backend-1.json');
  w(hf, JSON.stringify(HO));
  for (const d of ['D1', 'D2']) DL.add({ run, handoff: hf, decision: d, by: 'recommended' });
  const ids = DL.list({ root }).map((e) => e.id);
  assert.deepEqual(ids, ['book-room:tier-backend-1:D1', 'book-room:tier-backend-1:D2']);
  const hf2 = path.join(run, 'handoff', 'tier-frontend-1.json');
  w(hf2, JSON.stringify(HO));
  DL.add({ run, handoff: hf2, decision: 'D1', by: 'recommended' });
  assert.ok(DL.list({ root }).map((e) => e.id).includes('book-room:tier-frontend-1:D1'), '別のティアの D1 と区別する');
  const md = DL.toMarkdown(DL.list({ root }));
  assert.match(md, /\| book-room:tier-backend-1:D1 \| 予約の重なりの判定 \| 開始と終了の半開区間で比べる \| 担当が決めた/, '一覧に D<n> の ID が残る');
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

test('レビューの指摘は、切り詰めた題名が同じでも別の課題として下書きにする', () => {
  const root = repo();
  const run = rs.openRun(root, 'book-room');
  const long = '予約の重なりの検査が開始時刻と終了時刻の境界で同じ時刻の予約を受け付けてしまうため';
  const md = path.join(run, 'reviews', 'implementation-backend', '1', 'round1.md');
  w(md, ROUND.replace('同じ時間帯の予約を二重に受け付ける', long + ' A').replace('取り消しの期限を見ていない', long + ' B'));
  const r = spawnSync(process.execPath, [HANDOFF, 'file-drafts', md, '--review', '--target', 'implementation', '--run', run], { encoding: 'utf8' });
  assert.equal(JSON.parse(r.stdout).written.length, 2, r.stdout);
});

test('巻き戻さずに先送りした課題は、その段が done になるまで status の deferred_issues に出る', () => {
  const root = repo();
  const run = rs.openRun(root, 'book-room');
  for (const st of ['scenario', 'contract', 'scaffold']) rs.markDone(run, st);
  w(path.join(run, 'issues', 'a.md'), '---\ntarget_step: implementation\n---\n');
  rs.rewind(run, 'implementation', { issues: ['issues/a.md'] });
  assert.deepEqual(rs.status(run).deferred_issues, [{ stage: 'tier', to: 'implementation', issues: ['issues/consumed/a.md'] }]);
  rs.markDone(run, 'tier');
  assert.deepEqual(rs.status(run).deferred_issues, []);
});

test('同じ場所の 2 回目のレビュー (別の <n>) の「指摘 1」も、1 回目の下書きと取り違えずに下書きにする', () => {
  const root = repo();
  const run = rs.openRun(root, 'book-room');
  const m1 = path.join(run, 'reviews', 'implementation-backend', '1', 'round1.md');
  const m2 = path.join(run, 'reviews', 'implementation-backend', '2', 'round1.md');
  w(m1, ROUND);
  w(m2, ROUND.replace('同じ時間帯の予約を二重に受け付ける', '会議室の定員を超える予約を受け付ける'));
  const run1 = spawnSync(process.execPath, [HANDOFF, 'file-drafts', m1, '--review', '--target', 'implementation', '--run', run], { encoding: 'utf8' });
  const run2 = spawnSync(process.execPath, [HANDOFF, 'file-drafts', m2, '--review', '--target', 'implementation', '--run', run], { encoding: 'utf8' });
  assert.equal(JSON.parse(run1.stdout).written.length, 2);
  assert.equal(JSON.parse(run2.stdout).written.length, 2, run2.stdout);
  const again = spawnSync(process.execPath, [HANDOFF, 'file-drafts', m2, '--review', '--target', 'implementation', '--run', run], { encoding: 'utf8' });
  assert.equal(JSON.parse(again.stdout).written.length, 0, '同じ結果を 2 回回したときだけ重ねる');
});

test('写し直しでレビューの置き場を退避して回の番号が 1 に戻っても、新しいレビューの指摘を古い下書きと取り違えずに下書きにする (0.3.0)', () => {
  const root = repo();
  const run = rs.openRun(root, 'book-room');
  const md = path.join(run, 'reviews', 'implementation-backend', '1', 'round1.md');
  const file = () => JSON.parse(spawnSync(process.execPath, [HANDOFF, 'file-drafts', md, '--review', '--target', 'implementation', '--run', run], { encoding: 'utf8' }).stdout);
  w(md, ROUND);
  assert.equal(file().written.length, 2);
  // 写し直し: 置き場を退避する (古い下書きは issues/ に残る)
  rs.invalidateFrom(run, 'verify', '写し直し', { reviews: true });
  assert.ok(!fs.existsSync(md), '置き場は退避された');
  // 写し直した後のレビューも 1/round1.md に書かれる。指摘 1・2 の番号も同じ
  w(md, ROUND.replace('同じ時間帯の予約を二重に受け付ける', '会議室の定員を超える予約を受け付ける'));
  const after = file();
  assert.equal(after.written.length, 2, `新しいレビューの指摘が捨てられた: ${JSON.stringify(after)}`);
  assert.equal(after.skipped.length, 0);
  assert.equal(rs.unfiledIssues(run).length, 4);
  const again = file();
  assert.equal(again.written.length, 0, '同じ結果を 2 回回したときだけ重ねる');
  assert.equal(again.skipped.length, 2);
});

test('レビューの結果の先頭の BOM と改行の形 (CRLF) は、指摘の読み取りと重ねの判定に効かない', () => {
  const root = repo();
  const run = rs.openRun(root, 'book-room');
  const md = path.join(run, 'reviews', 'implementation-backend', '1', 'round1.md');
  const file = () => JSON.parse(spawnSync(process.execPath, [HANDOFF, 'file-drafts', md, '--review', '--target', 'implementation', '--run', run], { encoding: 'utf8' }).stdout);
  // BOM の直後が「### 指摘 1」(BOM を除かないと行頭に見えず 0 件になる形)
  w(md, `\uFEFF${ROUND.slice(ROUND.indexOf('### 指摘 1'))}`);
  assert.equal(file().written.length, 2, 'BOM 付きでも指摘を読む');
  w(md, ROUND.slice(ROUND.indexOf('### 指摘 1')).replace(/\n/g, '\r\n'));
  assert.equal(file().written.length, 0, '改行の形だけが違う同じ結果は重ねる');
});

test('同じ秒に同じ名前のレビューの置き場を 2 度退避しても、run の invalidated/ の中に別の名前で移す', () => {
  const root = repo();
  const run = rs.openRun(root, 'book-room');
  const md = path.join(run, 'reviews', 'implementation-backend', '1', 'round1.md');
  w(md, ROUND);
  const a = rs.setAsideReviews(run, ['verify'], '1 度目');
  w(md, ROUND);
  const b = rs.setAsideReviews(run, ['verify'], '2 度目');
  const inv = path.join(run, 'invalidated');
  for (const p of [...a, ...b]) assert.equal(path.dirname(p), inv, `invalidated/ の外へ移した: ${p}`);
  assert.notEqual(a[0], b[0]);
});

