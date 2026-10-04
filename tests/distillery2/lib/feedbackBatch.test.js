'use strict';
// feedbackBatch.js の統合テスト: 使い捨ての git リポジトリで還流の状態遷移を通す。
// 生成物の作り直しはスタブ (--regen-cmds) に差し替える。スタブのルールの生成物は本物の basis.js で basis 行を書く。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '../../../plugins/distillery2/scripts/feedbackBatch.js');
const BASIS = path.resolve(__dirname, '../../../plugins/distillery2/scripts/lib/basis.js');
const runState = require('../../../plugins/distillery2/scripts/lib/runState');
const basis = require(BASIS);

const STUB = `'use strict';
const fs = require('node:fs');
const path = require('node:path');
const mode = process.argv[2];
const ls = (d) => (fs.existsSync(d) ? fs.readdirSync(d).sort() : []);
if (mode === 'validate') {
  const adrs = ls('docs/adr');
  if (adrs.some((f) => f.startsWith('0003-needs-0002')) && !adrs.some((f) => f.startsWith('0002-'))) { console.error('0003 は 0002 を前提にする'); process.exit(1); }
} else if (mode === 'adr-index') {
  fs.writeFileSync('docs/adr/index.md', ls('docs/adr').filter((f) => /^[0-9]/.test(f)).map((f) => '- ' + f).join('\\n') + '\\n');
} else if (mode === 'derived') {
  const { stamp, headerLine } = require(${JSON.stringify(BASIS)});
  fs.mkdirSync('docs/rules', { recursive: true });
  fs.writeFileSync('docs/rules/index.md', '<!-- ' + headerLine(stamp({ adr: 'docs/adr' }, process.cwd())) + ' -->\\n' + ls('docs/adr').join(',') + '\\n');
  fs.mkdirSync('contracts/generated', { recursive: true });
  const src = ls('contracts/openapi').map((f) => fs.readFileSync(path.join('contracts/openapi', f), 'utf8')).join('');
  fs.writeFileSync('contracts/generated/bundle.txt', src);
  if (process.env.D2_STUB_FAIL_DERIVED) process.exit(1);
}
`;

function sh(cwd, cmd, ...args) { return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function git(cwd, ...args) { return sh(cwd, 'git', ...args); }

function issueFile(fm, body = '## 事実\n\n- 課題の本文\n') {
  const lines = Object.entries(fm).map(([k, v]) => `${k}: ${typeof v === 'string' ? JSON.stringify(v) : v}`);
  return `---\n${lines.join('\n')}\n---\n\n${body}`;
}

function makeRepo({ issues = {}, origin = false } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-fb-'));
  const root = path.join(base, 'repo');
  fs.mkdirSync(root);
  const stub = path.join(base, 'stub.js');
  fs.writeFileSync(stub, STUB);
  const w = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 't@example.com');
  git(root, 'config', 'user.name', 't');
  w('.gitignore', '.distillery/logs/\n.distillery/worktrees/\n.distillery/runs/*/reports/\nnode_modules\n');
  w('docs/adr/0001-base.md', '# base\n');
  w('docs/requirements/requirements.yaml', 'r: 1\n');
  w('contracts/openapi/openapi.yaml', 'openapi: 3.1.0\n');
  w('contracts/uc-index.yaml', 'ucs: []\n');
  for (const [id, fm] of Object.entries(issues)) w(`docs/feedback/${id}.md`, issueFile({ title: `${id} の課題`, from_uc: 'register-loan', status: 'open', created: '2026-09-30T00:00:00Z', ...fm }));
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'init');
  let bare = null;
  if (origin) {
    bare = path.join(base, 'origin.git');
    git(base, 'init', '-q', '--bare', '-b', 'main', bare);
    git(root, 'remote', 'add', 'origin', bare);
    git(root, 'push', '-q', '-u', 'origin', 'main');
  }
  const regen = JSON.stringify({ validate: [[process.execPath, stub, 'validate']], 'adr-index': [[process.execPath, stub, 'adr-index']], derived: [[process.execPath, stub, 'derived']] });
  const fb = (cmd, ...args) => {
    const extra = ['finalize', 'regen', 'rebuild'].includes(cmd) ? ['--regen-cmds', regen] : [];
    const r = spawnSync(process.execPath, [SCRIPT, cmd, '--cwd', root, ...args, ...extra], { encoding: 'utf8' });
    let json = null;
    try { json = JSON.parse(r.stdout.trim().split('\n').pop()); } catch { /* 出力なし */ }
    return { code: r.status, json, stderr: r.stderr };
  };
  const wt = path.join(root, '.distillery/worktrees/feedback');
  const ww = (rel, text) => { fs.mkdirSync(path.dirname(path.join(wt, rel)), { recursive: true }); fs.writeFileSync(path.join(wt, rel), text); };
  return { base, root, wt, w, ww, fb, bare, regen };
}

/** 1 件を「派遣 → 受理 → commit → static → discard」まで進める (static は通った扱い) */
function passIssue(r, id, edit) {
  edit();
  const c = r.fb('commit-issue', id);
  assert.equal(c.code, 0, JSON.stringify(c.json));
  if (c.json.result === 'committed') {
    assert.equal(r.fb('regen').code, 0);
    assert.equal(r.fb('record-static', id).code, 0);
  }
  assert.equal(r.fb('discard').code, 0);
  return c.json;
}

function stopIssue(r, id, reason, edit) {
  if (edit) edit();
  const rf = path.join(r.base, `${id}.reason.txt`);
  fs.writeFileSync(rf, reason);
  const s = r.fb('stop-issue', id, '--reason-file', rf);
  assert.equal(s.code, 0, JSON.stringify(s.json));
  return s.json;
}

function trailers(root, ref, key) {
  return git(root, 'log', '--format=%B', ref).split('\n').filter((l) => l.startsWith(`${key}:`)).map((l) => l.slice(key.length + 1).trim()).sort();
}

test('(a)(i)(j)(s) 2 件とも取り込み: 原本の commit → 索引 → 生成物、ゲート → 自動の回答 → ff merge と後始末', () => {
  const r = makeRepo({ issues: { 'r1': { kind: 'rule' }, 'c1': { kind: 'contract' } } });
  const st = r.fb('start', '--batch', '20261001-000000');
  assert.equal(st.code, 0, JSON.stringify(st.json));
  assert.deepEqual(st.json.issues.map((x) => x.id), ['r1', 'c1'], 'rule が先');
  assert.deepEqual(st.json.node_modules, ['node_modules']);
  assert.ok(fs.lstatSync(path.join(r.wt, 'node_modules')).isSymbolicLink());

  const a = passIssue(r, 'r1', () => { r.ww('docs/adr/0002-r1.md', '# r1\n'); r.ww('docs/adr/index.md', 'sub が作った索引\n'); });
  assert.deepEqual(a.sources, ['docs/adr/0002-r1.md'], '索引は原本に含めない');
  passIssue(r, 'c1', () => r.ww('contracts/openapi/openapi.yaml', 'openapi: 3.1.0\n# c1\n'));

  const f = r.fb('finalize');
  assert.equal(f.code, 0, JSON.stringify(f.json));
  assert.ok(f.json.commits.adr_index && f.json.commits.regenerate);
  assert.equal(r.fb('status').json.point, 'gate');
  assert.equal(r.fb('record-gate', '--result', 'pass').code, 0);
  assert.equal(r.fb('status').json.point, 'gate', '回答の前は gate (確認ページへ)');
  assert.equal(r.fb('decide', '--auto').code, 0);
  assert.equal(r.fb('status').json.point, 'merge', 'hold で止めた後の再開は merge から (ゲートを回し直さない)');

  const m = r.fb('merge');
  assert.equal(m.code, 0, JSON.stringify(m.json));
  const subjects = git(r.root, 'log', '--format=%s', 'main').split('\n');
  assert.deepEqual(subjects.slice(0, 4), ['feedback(20261001-000000): regenerate', 'feedback(20261001-000000): adr index', 'feedback(20261001-000000): contract c1', 'feedback(20261001-000000): rule r1']);
  assert.deepEqual(trailers(r.root, 'main', 'Feedback-Consumed'), ['docs/feedback/c1.md', 'docs/feedback/r1.md']);
  assert.equal(fs.existsSync(path.join(r.root, 'docs/feedback/r1.md')), false);
  const chk = basis.check(path.join(r.root, 'docs/rules/index.md'), { adr: 'docs/adr' }, r.root);
  assert.equal(chk.entries.find((e) => e.name === 'adr').stale, false, 'ルールの basis が取り込み後も古くない');
  assert.equal(fs.existsSync(r.wt), false);
  assert.equal(git(r.root, 'branch', '--list', 'feedback/*'), '');
  assert.equal(r.fb('status').json.point, 'none');
});

test('(b)(j) 1 件を外し 1 件を取り下げて組み直す: 外した課題は止まった課題に、取り下げは削除', () => {
  const r = makeRepo({ issues: { 'r1': { kind: 'rule' }, 'c1': { kind: 'contract' }, 's1': { kind: 'contract', stopped: true, stopped_count: 1, title: '止まった: s1 の課題' } } });
  r.fb('start', '--batch', 'b1');
  passIssue(r, 'r1', () => r.ww('docs/adr/0002-r1.md', '# r1\n'));
  passIssue(r, 'c1', () => r.ww('contracts/openapi/openapi.yaml', 'openapi: 3.1.0\n# c1\n'));
  stopIssue(r, 's1', 'また直せなかった');
  r.fb('finalize');
  r.fb('record-gate', '--result', 'pass');
  assert.equal(r.fb('decide', '--take', 'c1', '--drop', 'r1', '--dismiss', 's1').code, 0);
  assert.equal(r.fb('status').json.point, 'rebuild');
  const rb = r.fb('rebuild');
  assert.equal(rb.code, 0, JSON.stringify(rb.json));
  assert.deepEqual(rb.json.picked.map((p) => p.id), ['c1']);
  assert.equal(r.fb('status').json.point, 'gate', '(l) 組み直した後の再開は rebuild ではなく gate');
  r.fb('record-gate', '--result', 'pass');
  assert.equal(r.fb('merge').code, 0);
  assert.deepEqual(trailers(r.root, 'main', 'Feedback-Consumed'), ['docs/feedback/c1.md']);
  assert.deepEqual(trailers(r.root, 'main', 'Feedback-Dismissed'), ['docs/feedback/s1.md']);
  assert.equal(fs.existsSync(path.join(r.root, 'docs/adr/0002-r1.md')), false);
  const r1 = fs.readFileSync(path.join(r.root, 'docs/feedback/r1.md'), 'utf8');
  assert.match(r1, /stopped: true/);
  assert.match(r1, /stopped_count: 1/);
  assert.match(r1, /title: "止まった: r1 の課題"/);
  assert.match(r1, /確認ページで外した/);
});

test('(c)(t) static が落ちた課題: commit と生成された未追跡ファイルが消え、次の課題は clean で始まる。差分の中身が課題ファイルに残る', () => {
  const r = makeRepo({ issues: { 'c1': { kind: 'contract' }, 'c2': { kind: 'contract' } } });
  r.fb('start', '--batch', 'b2');
  r.ww('contracts/openapi/openapi.yaml', 'openapi: 3.1.0\n# c1 broken\n');
  assert.equal(r.fb('commit-issue', 'c1').json.result, 'committed');
  r.fb('regen');
  assert.ok(fs.existsSync(path.join(r.wt, 'contracts/generated/bundle.txt')), '生成物 (未追跡) ができた');
  const s = stopIssue(r, 'c1', 'static が落ちた: 型が合わない');
  assert.equal(s.dropped_commit, true);
  assert.equal(fs.existsSync(path.join(r.wt, 'contracts/generated/bundle.txt')), false, '未追跡の生成物も消えた');
  assert.equal(git(r.wt, 'status', '--porcelain'), '');
  assert.equal(git(r.wt, 'log', '-1', '--format=%s'), 'init', '課題の commit が落ちた');
  passIssue(r, 'c2', () => r.ww('contracts/openapi/openapi.yaml', 'openapi: 3.1.0\n# c2\n'));
  r.fb('finalize');
  r.fb('record-gate', '--result', 'pass');
  r.fb('decide', '--auto');
  assert.equal(r.fb('merge').code, 0);
  const c1 = fs.readFileSync(path.join(r.root, 'docs/feedback/c1.md'), 'utf8');
  assert.match(c1, /## 止まった理由/);
  assert.match(c1, /static が落ちた: 型が合わない/);
  assert.match(c1, /```diff[\s\S]*# c1 broken/, '差分の中身 (置き場所ではなく) が残る');
});

test('(d)(q)(r) 各所で止めたときの再開地点', () => {
  const r = makeRepo({ issues: { 'c1': { kind: 'contract' }, 'c2': { kind: 'contract' } } });
  assert.equal(r.fb('status').json.point, 'none');
  r.fb('start', '--batch', 'b3');
  let s = r.fb('status').json;
  assert.equal(s.point, 'issues', '(q) 切り出した直後は cleanup ではなく issues');
  assert.deepEqual(s.pending, ['c1', 'c2']);
  r.ww('contracts/openapi/openapi.yaml', 'openapi: 3.1.0\n# c1\n');
  r.fb('commit-issue', 'c1');
  s = r.fb('status').json;
  assert.deepEqual(s.needs_static, ['c1'], '(r) commit の後・static の前は作り直しと static から');
  assert.deepEqual(s.pending, ['c2']);
  r.fb('regen');
  assert.equal(r.fb('status').json.worktree_dirty, true);
  r.fb('record-static', 'c1');
  r.fb('discard');
  s = r.fb('status').json;
  assert.deepEqual(s.done, ['c1']);
  assert.equal(s.worktree_dirty, false);
});

test('(e) main が進んでいたら exit 3 → 組み直し → ゲート → 取り込み', () => {
  const r = makeRepo({ issues: { 'c1': { kind: 'contract' } } });
  r.fb('start', '--batch', 'b4');
  passIssue(r, 'c1', () => r.ww('contracts/openapi/openapi.yaml', 'openapi: 3.1.0\n# c1\n'));
  r.fb('finalize');
  r.fb('record-gate', '--result', 'pass');
  r.fb('decide', '--auto');
  r.w('docs/other.md', 'other\n');
  git(r.root, 'add', '-A');
  git(r.root, 'commit', '-q', '-m', 'other work');
  const m = r.fb('merge');
  assert.equal(m.code, 3, JSON.stringify(m.json));
  assert.equal(r.fb('rebuild').code, 0);
  assert.equal(r.fb('status').json.point, 'gate');
  r.fb('record-gate', '--result', 'pass');
  assert.equal(r.fb('status').json.point, 'merge', '記録した土台ではなく祖先関係で見るので組み直しを繰り返さない');
  assert.equal(r.fb('merge').code, 0);
  assert.ok(fs.existsSync(path.join(r.root, 'docs/other.md')));
  assert.match(fs.readFileSync(path.join(r.root, 'contracts/openapi/openapi.yaml'), 'utf8'), /# c1/);
});

test('(f) origin/main だけが進んでいても拾って組み直しへ', () => {
  const r = makeRepo({ issues: { 'c1': { kind: 'contract' } }, origin: true });
  r.fb('start', '--batch', 'b5');
  passIssue(r, 'c1', () => r.ww('contracts/openapi/openapi.yaml', 'openapi: 3.1.0\n# c1\n'));
  r.fb('finalize');
  r.fb('record-gate', '--result', 'pass');
  r.fb('decide', '--auto');
  const other = path.join(r.base, 'other');
  git(r.base, 'clone', '-q', r.bare, other);
  git(other, 'config', 'user.email', 'o@example.com');
  git(other, 'config', 'user.name', 'o');
  fs.writeFileSync(path.join(other, 'remote.md'), 'remote\n');
  git(other, 'add', '-A');
  git(other, 'commit', '-q', '-m', 'remote work');
  git(other, 'push', '-q', 'origin', 'main');
  assert.equal(r.fb('merge').code, 3);
  assert.ok(fs.existsSync(path.join(r.root, 'remote.md')), 'main を origin/main へ ff した');
  r.fb('rebuild');
  r.fb('record-gate', '--result', 'pass');
  assert.equal(r.fb('merge').code, 0);
  assert.equal(git(r.root, 'rev-parse', 'main'), git(r.root, 'rev-parse', 'origin/main'), 'push 済み');
});

test('(g) 契約の原本に差分が無ければ取り込み済み (課題ファイルの削除だけ)', () => {
  const r = makeRepo({ issues: { 'c1': { kind: 'contract' } } });
  r.fb('start', '--batch', 'b6');
  r.ww('contracts/generated/bundle.txt', 'sub が作り直した生成物だけ\n');
  const c = passIssue(r, 'c1', () => {});
  assert.equal(c.result, 'already-applied');
  assert.deepEqual(trailers(r.wt, 'HEAD', 'Feedback-Result'), ['already-applied']);
  assert.equal(r.fb('status').json.done.includes('c1'), true);
});

test('(h) 2 回目の停止: stopped_count が 2、題名の接頭辞は 1 つ、前回の理由は残る', () => {
  const body = '## 止まった理由\n\n1 回目の理由\n\n## 事実\n\n- 本文\n';
  const r = makeRepo();
  r.w('docs/feedback/s1.md', issueFile({ kind: 'rule', title: '止まった: s1', from_uc: 'u', status: 'open', created: '2026-09-30T00:00:00Z', stopped: true, stopped_count: 1 }, body));
  git(r.root, 'add', '-A');
  git(r.root, 'commit', '-q', '-m', 's1');
  r.fb('start', '--batch', 'b7');
  stopIssue(r, 's1', '2 回目も ADR で表せない');
  r.fb('finalize');
  const t = fs.readFileSync(path.join(r.wt, 'docs/feedback/s1.md'), 'utf8');
  assert.match(t, /stopped_count: 2/);
  assert.match(t, /title: "止まった: s1"/);
  assert.match(t, /2 回目の還流で止まった/);
  assert.match(t, /## 前回までの止まった理由\n\n1 回目の理由/);
});

test('(k) ゲートが落ちたら全部の取り込みは選べず、merge も拒む', () => {
  const r = makeRepo({ issues: { 'c1': { kind: 'contract' } } });
  r.fb('start', '--batch', 'b8');
  passIssue(r, 'c1', () => r.ww('contracts/openapi/openapi.yaml', 'openapi: 3.1.0\n# c1\n'));
  r.fb('finalize');
  r.fb('record-gate', '--result', 'fail');
  assert.equal(r.fb('status').json.confirm, true, '落ちたら確認ページから');
  assert.equal(r.fb('decide', '--take', 'c1').code, 1);
  assert.equal(r.fb('decide', '--auto').code, 1);
  assert.equal(r.fb('merge').code, 1);
  assert.equal(r.fb('decide', '--abandon').code, 0);
  assert.equal(r.fb('status').json.point, 'rebuild');
  r.fb('rebuild');
  r.fb('record-gate', '--result', 'pass');
  assert.equal(r.fb('merge').code, 0);
  assert.match(fs.readFileSync(path.join(r.root, 'docs/feedback/c1.md'), 'utf8'), /確認ページで外した/);
  assert.doesNotMatch(fs.readFileSync(path.join(r.root, 'contracts/openapi/openapi.yaml'), 'utf8'), /# c1/);
});

test('(m) 課題を外した組み直しで残った ADR が検査に落ちると止まる', () => {
  const r = makeRepo({ issues: { 'r1': { kind: 'rule' }, 'r2': { kind: 'rule', created: '2026-09-30T00:00:01Z' } } });
  r.fb('start', '--batch', 'b9');
  passIssue(r, 'r1', () => r.ww('docs/adr/0002-r1.md', '# r1\n'));
  passIssue(r, 'r2', () => r.ww('docs/adr/0003-needs-0002.md', '# r2\n'));
  r.fb('finalize');
  r.fb('record-gate', '--result', 'pass');
  r.fb('decide', '--take', 'r2', '--drop', 'r1');
  const rb = r.fb('rebuild');
  assert.equal(rb.code, 1);
  assert.match(rb.json.error, /原本全体の検査/);
  assert.match(rb.json.output_tail, /0003 は 0002 を前提にする/);
});

test('(n)(o) push の拒否は exit 4 で main はそのまま。再開すると cleanup から push と後始末', () => {
  const r = makeRepo({ issues: { 'c1': { kind: 'contract' } }, origin: true });
  r.fb('start', '--batch', 'b10');
  passIssue(r, 'c1', () => r.ww('contracts/openapi/openapi.yaml', 'openapi: 3.1.0\n# c1\n'));
  r.fb('finalize');
  r.fb('record-gate', '--result', 'pass');
  r.fb('decide', '--auto');
  const hook = path.join(r.bare, 'hooks', 'pre-receive');
  fs.writeFileSync(hook, '#!/bin/sh\necho rejected >&2\nexit 1\n');
  fs.chmodSync(hook, 0o755);
  const m = r.fb('merge');
  assert.equal(m.code, 4, JSON.stringify(m.json));
  assert.equal(m.json.merged, true);
  assert.equal(git(r.root, 'log', '-1', '--format=%s', 'main'), 'feedback(b10): regenerate', 'main は取り込み済み');
  assert.equal(r.fb('status').json.point, 'cleanup');
  fs.rmSync(hook);
  const m2 = r.fb('merge');
  assert.equal(m2.code, 0, JSON.stringify(m2.json));
  assert.equal(m2.json.already, true);
  assert.equal(git(r.root, 'rev-parse', 'main'), git(r.root, 'rev-parse', 'origin/main'));
  assert.equal(fs.existsSync(r.wt), false);
});

test('(p) scan: 止まった課題だけでは還流のきっかけにならない。要求の課題と配送済みの未起票の run を拾う', () => {
  const r = makeRepo({ issues: { 's1': { kind: 'rule', stopped: true, stopped_count: 1 }, 'q1': { kind: 'requirement' } } });
  let s = r.fb('scan').json;
  assert.equal(s.feedback_due, false);
  assert.deepEqual(s.requirement, ['q1']);
  assert.deepEqual(s.requirement_all, ['q1']);
  assert.deepEqual(s.stopped, [{ id: 's1', stopped_count: 1 }]);
  r.w('docs/feedback/c1.md', issueFile({ kind: 'contract', title: 'c1', from_uc: 'u', status: 'open', created: '2026-09-30T00:00:00Z' }));
  s = r.fb('scan').json;
  assert.equal(s.feedback_due, true);
  assert.deepEqual(s.triggers, ['c1']);
  fs.rmSync(path.join(r.root, 'docs/feedback/c1.md'));
  const run = runState.openRun(r.root, 'register-return');
  runState.markDone(run, 'deliver', { squash: 'x' });
  fs.writeFileSync(path.join(run, 'issues', '20260930T1000_x.md'), issueFile({ kind: 'contract', title: 'x' }));
  s = r.fb('scan').json;
  assert.equal(s.feedback_due, true);
  assert.deepEqual(s.unfiled_runs, [{ run: '.distillery/runs/register-return', unfiled: ['issues/20260930T1000_x.md'] }]);
});

test('file-issues: UC の課題を課題ファイルにして feedback_filed を記録する (2 回目は何もしない)', () => {
  const r = makeRepo();
  const run = runState.openRun(r.root, 'register-loan');
  fs.writeFileSync(path.join(run, 'issues', '20260930T1000_auth.md'), issueFile({ kind: 'contract', title: '認証の応答', uc: 'register-loan', tier: 'backend-api' }, '## 事実\n\n- 401 が無い\n'));
  const a = r.fb('file-issues', '.distillery/runs/register-loan');
  assert.equal(a.code, 0, JSON.stringify(a.json));
  assert.deepEqual(a.json.filed, ['docs/feedback/20260930T1000_auth.md']);
  const t = fs.readFileSync(path.join(r.root, 'docs/feedback/20260930T1000_auth.md'), 'utf8');
  assert.match(t, /kind: contract/);
  assert.match(t, /from_uc: register-loan/);
  assert.match(t, /status: open/);
  assert.match(t, /tier: backend-api/);
  assert.match(t, /- 401 が無い/);
  assert.deepEqual(runState.unfiledIssues(run), []);
  assert.deepEqual(r.fb('file-issues', '.distillery/runs/register-loan').json.filed, []);
});

test('start: 対象が無ければ切り出さない。途中のバッチがあれば始めない。.gitignore が worktree を無視しなければ止まる', () => {
  const r = makeRepo({ issues: { 'q1': { kind: 'requirement' } } });
  assert.deepEqual(r.fb('start').json, { started: false, reason: '対象の課題が無い' });
  const r2 = makeRepo({ issues: { 'c1': { kind: 'contract' } } });
  r2.fb('start', '--batch', 'x1');
  assert.equal(r2.fb('start', '--batch', 'x2').code, 1);
  const r3 = makeRepo({ issues: { 'c1': { kind: 'contract' } } });
  r3.w('.gitignore', 'node_modules/\n');
  git(r3.root, 'commit', '-qam', 'old ignore');
  const s3 = r3.fb('start');
  assert.equal(s3.code, 1);
  assert.match(s3.json.error, /genSkeleton\.js --migrate/);
});

test('hold: 要求の差分で外して残す課題に止まった印を付ける。止まった要求の課題は要求の差分のきっかけにならない', () => {
  const r = makeRepo({ issues: { 'q1': { kind: 'requirement' }, 'q2': { kind: 'requirement' } } });
  const rf = path.join(r.base, 'reason.txt');
  fs.writeFileSync(rf, '確認ページで外した (要求の差分)');
  const h = r.fb('hold', 'q2', '--reason-file', rf);
  assert.equal(h.code, 0, JSON.stringify(h.json));
  assert.equal(h.json.stopped_count, 1);
  const q2 = fs.readFileSync(path.join(r.root, 'docs/feedback/q2.md'), 'utf8');
  assert.match(q2, /stopped: true/);
  assert.match(q2, /title: "止まった: q2 の課題"/);
  assert.match(q2, /確認ページで外した \(要求の差分\)/);
  const s = r.fb('scan').json;
  assert.deepEqual(s.requirement, ['q1'], '止まった q2 はきっかけにしない');
  assert.deepEqual(s.requirement_all, ['q1', 'q2'], '要求の差分を回すときは一緒に渡す');
  assert.equal(r.fb('hold', 'nope', '--reason-file', rf).code, 1);
});
