'use strict';
// feedbackBatch.js の統合テスト: 使い捨ての git リポジトリで還流の状態遷移を通す。
// 生成物の作り直しはスタブ (--regen-cmds) に差し替える。スタブのルールの生成物は本物の basis.js で basis 行を書く。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-common/scripts/feedbackBatch.js');
const BASIS = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-common/scripts/lib/basis.js');
const runState = require('../../../plugins/distillery2/skills/d2-common/scripts/lib/runState');
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
  assert.match(r.fb('decide', '--auto').json.error, /--auto は確認ページを出さないときだけ/, '取り込む候補があれば人の回答が要る (差分レビュー 3 ラウンド目)');
  assert.equal(r.fb('decide', '--take', 'r1,c1').code, 0);
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
  r.fb('decide', '--take', 'c2');
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
  r.fb('decide', '--take', 'c1');
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
  r.fb('decide', '--take', 'c1');
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

test('(s2) --auto は確認ページを出さないとき (取り込み済みと 1 回目の停止だけ) に限る。2 回目以上の停止があれば拒む (差分レビュー 3 ラウンド目)', () => {
  const r = makeRepo({ issues: { 'c1': { kind: 'contract' }, 's1': { kind: 'contract', created: '2026-09-30T00:00:01Z' } } });
  r.fb('start', '--batch', 'bs2');
  passIssue(r, 'c1', () => {});
  stopIssue(r, 's1', '1 回目の停止');
  r.fb('finalize');
  r.fb('record-gate', '--result', 'pass');
  assert.equal(r.fb('decide', '--auto').code, 0, '取り込み済みと 1 回目の停止だけ');
  assert.equal(r.fb('status').json.point, 'merge');
  assert.equal(r.fb('merge').code, 0);
  const r2 = makeRepo({ issues: { 's2': { kind: 'contract', stopped: true, stopped_count: 1 } } });
  r2.fb('start', '--batch', 'bs3');
  stopIssue(r2, 's2', '2 回目の停止');
  r2.fb('finalize');
  r2.fb('record-gate', '--result', 'pass');
  assert.match(r2.fb('decide', '--auto').json.error, /2 回目以上止まった課題 \(s2\)/);
  assert.equal(r2.fb('decide', '--dismiss', 's2').code, 0);
});

test('(k2) ゲートが落ちたとき: 止まった課題の取り下げを添えても全部の取り込みは拒む。取り込む候補が 0 件なら回答を記録せず止まる (差分レビュー 2 ラウンド目)', () => {
  const r = makeRepo({ issues: { 'c1': { kind: 'contract' }, 's1': { kind: 'contract', created: '2026-09-30T00:00:01Z', stopped: true, stopped_count: 1 } } });
  r.fb('start', '--batch', 'bk2');
  passIssue(r, 'c1', () => r.ww('contracts/openapi/openapi.yaml', 'openapi: 3.1.0\n# c1\n'));
  stopIssue(r, 's1', 'また直せない');
  r.fb('finalize');
  r.fb('record-gate', '--result', 'fail');
  assert.match(r.fb('decide', '--take', 'c1', '--dismiss', 's1').json.error, /すべて取り込む回答はできない/);
  assert.equal(r.fb('decide', '--drop', 'c1', '--dismiss', 's1').code, 0);
  // 取り込む候補が 0 件 (全部止まった) なのにゲートが落ちた
  const r2 = makeRepo({ issues: { 's2': { kind: 'contract' } } });
  r2.fb('start', '--batch', 'bk3');
  stopIssue(r2, 's2', '直せない');
  r2.fb('finalize');
  r2.fb('record-gate', '--result', 'fail');
  for (const args of [['--abandon'], ['--auto'], ['--dismiss', 's2']]) assert.match(r2.fb('decide', ...args).json.error, /原因は課題ではなく main か生成物の作り直し/, args.join(' '));
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
  r.fb('decide', '--take', 'c1');
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

test('decide: 取り込む候補を take と drop で漏れなく覆う。転記漏れ・重なり・候補でない課題・止まっていない課題の取り下げは拒む。組み直しは take を正にする (差分レビュー 1 ラウンド目)', () => {
  const r = makeRepo({ issues: { 'c1': { kind: 'contract' }, 'c2': { kind: 'contract', created: '2026-09-30T00:00:01Z' }, 'c3': { kind: 'contract', created: '2026-09-30T00:00:02Z' }, 's1': { kind: 'contract', created: '2026-09-30T00:00:03Z' } } });
  r.fb('start', '--batch', 'bd');
  passIssue(r, 'c1', () => r.ww('contracts/openapi/openapi.yaml', 'openapi: 3.1.0\n# c1\n'));
  passIssue(r, 'c2', () => r.ww('contracts/openapi/b.yaml', 'b: 1\n'));
  passIssue(r, 'c3', () => {});
  stopIssue(r, 's1', '直せない');
  r.fb('finalize');
  r.fb('record-gate', '--result', 'pass');
  assert.match(r.fb('decide', '--take', 'c1').json.error, /取り込むか外すか取り下げるかが決まっていない課題: c2/, 'c2 の転記漏れ');
  assert.match(r.fb('decide', '--take', 'c1,c2', '--drop', 'c2').json.error, /複数にある課題: c2/);
  assert.match(r.fb('decide', '--take', 'c1', '--drop', 'c2', '--dismiss', 'c2').json.error, /複数にある課題: c2/, '(y) 外すと取り下げるの両方');
  assert.match(r.fb('decide', '--take', 'c1,c2,c3').json.error, /取り込む候補でない課題/, '取り込み済みの c3 は聞かない');
  assert.match(r.fb('decide', '--take', 'c1', '--drop', 'c2', '--dismiss', 'c3').json.error, /取り下げられるのは止まった課題と取り込む候補だけ: c3/, '(y) 取り込み済みは取り下げられない');
  assert.equal(r.fb('decide', '--take', 'c1', '--drop', 'c2').code, 0);
  assert.equal(r.fb('rebuild').code, 0);
  r.fb('record-gate', '--result', 'pass');
  assert.equal(r.fb('merge').code, 0);
  assert.deepEqual(trailers(r.root, 'main', 'Feedback-Consumed'), ['docs/feedback/c1.md', 'docs/feedback/c3.md'], 'c2 は入らず、取り込み済みの c3 は入る');
  assert.equal(fs.existsSync(path.join(r.root, 'contracts/openapi/b.yaml')), false);
});

test('(u)(u2) reclassify: 直す場所がプラグイン側の課題は kind: plugin になり、候補にも止まった課題にもならず、組み直しで残り、取り込み後の main に残る (0.1.28)', () => {
  const body = '## 止まった理由\n\n1 回目: ADR で表せない\n\n## 事実\n\n- biome の設定を変えたい\n';
  const r = makeRepo({ issues: { 'c1': { kind: 'contract' } } });
  r.w('docs/feedback/p1.md', issueFile({ kind: 'rule', title: '止まった: p1 の課題', from_uc: 'u', status: 'open', created: '2026-09-30T00:00:01Z', stopped: true, stopped_count: 1 }, body));
  git(r.root, 'add', '-A');
  git(r.root, 'commit', '-q', '-m', 'p1');
  r.fb('start', '--batch', 'bu');
  assert.deepEqual(r.fb('status').json.pending, ['p1', 'c1'], 'rule が先');
  // 派遣が書き込み範囲の中に残したもの (ADR の下書き) は commit に混ぜない
  r.ww('docs/adr/0002-draft.md', '# 書きかけ\n');
  const rf = path.join(r.base, 'p1.reason.txt');
  fs.writeFileSync(rf, 'ADR の rules では表せない (biome.json は生成器が作り直す)');
  const rc = r.fb('reclassify', 'p1', '--reason-file', rf);
  assert.equal(rc.code, 0, JSON.stringify(rc.json));
  assert.equal(rc.json.kind_original, 'rule');
  assert.equal(git(r.wt, 'status', '--porcelain'), '', 'worktree は clean');
  assert.equal(fs.existsSync(path.join(r.wt, 'docs/adr/0002-draft.md')), false, '下書きは捨てた');
  assert.equal(git(r.wt, 'log', '-1', '--format=%s'), 'feedback(bu): plugin p1');
  assert.deepEqual(trailers(r.wt, 'HEAD', 'Feedback-Reclassified'), ['docs/feedback/p1.md']);
  assert.deepEqual(trailers(r.wt, 'HEAD', 'Feedback-Kind-Original'), ['rule']);
  const t = fs.readFileSync(path.join(r.wt, 'docs/feedback/p1.md'), 'utf8');
  assert.match(t, /kind: plugin/);
  assert.match(t, /kind_original: rule/);
  assert.match(t, /title: p1 の課題/, '題名の「止まった: 」を外す');
  assert.doesNotMatch(t, /stopped/, '止まった印を外す');
  assert.match(t, /## プラグインへ持ち帰る理由\n\nADR の rules では表せない/);
  assert.match(t, /## 止まった理由\n\n1 回目/, '止まった理由の本文は残す');
  let s = r.fb('status').json;
  assert.deepEqual(s.done, ['p1']);
  assert.deepEqual(s.pending, ['c1']);
  // (u2) commit と state の間で止まっても、commit があれば済み (state を復元)
  fs.rmSync(path.join(r.root, '.distillery/logs/feedback/bu/p1.state'));
  s = r.fb('status').json;
  assert.deepEqual(s.done, ['p1'], 'state が無くても plugin の commit で done');
  assert.deepEqual(s.needs_static, []);
  assert.equal(JSON.parse(fs.readFileSync(path.join(r.root, '.distillery/logs/feedback/bu/p1.state'), 'utf8')).status, 'reclassified', 'state を復元した');
  passIssue(r, 'c1', () => r.ww('contracts/openapi/openapi.yaml', 'openapi: 3.1.0\n# c1\n'));
  r.fb('finalize');
  r.fb('record-gate', '--result', 'pass');
  assert.match(r.fb('decide', '--take', 'c1,p1').json.error, /取り込む候補でない課題/, 'プラグインへ持ち帰る課題は聞かない');
  // 組み直し (c1 を外す) でも plugin の commit は残る
  assert.equal(r.fb('decide', '--drop', 'c1').code, 0);
  assert.equal(r.fb('rebuild').code, 0);
  assert.deepEqual(git(r.root, 'log', '--format=%s', 'main..feedback/bu').split('\n').filter((l) => l.includes(' plugin ')), ['feedback(bu): plugin p1']);
  r.fb('record-gate', '--result', 'pass');
  assert.equal(r.fb('merge').code, 0);
  const m = fs.readFileSync(path.join(r.root, 'docs/feedback/p1.md'), 'utf8');
  assert.match(m, /kind: plugin/);
  assert.doesNotMatch(fs.readFileSync(path.join(r.root, 'docs/feedback/p1.md'), 'utf8'), /stopped: true/);
  const sc = r.fb('scan').json;
  assert.deepEqual(sc.plugin, ['p1']);
  assert.deepEqual(sc.triggers, [], 'きっかけにしない');
  assert.deepEqual(sc.stopped, [{ id: 'c1', stopped_count: 1 }], '止まった課題にも数えない (外した c1 だけ)');
  assert.equal(sc.feedback_due, false, JSON.stringify(sc));
  // plugin は切り出しの対象外 (外して止まった c1 だけが対象になる)
  assert.deepEqual(r.fb('start', '--batch', 'bu2').json.issues.map((x) => x.id), ['c1']);
});

test('(v)(w) 取り込む候補の取り下げ: 原本の commit が branch に無く、課題ファイルが消え、trailer Feedback-Dismissed。ゲートが落ちても候補の取り下げだけで回答できる (0.1.28)', () => {
  const r = makeRepo({ issues: { 'r1': { kind: 'rule' }, 'c1': { kind: 'contract' } } });
  r.fb('start', '--batch', 'bv');
  passIssue(r, 'r1', () => r.ww('docs/adr/0002-r1.md', '# r1\n'));
  passIssue(r, 'c1', () => r.ww('contracts/openapi/openapi.yaml', 'openapi: 3.1.0\n# c1\n'));
  r.fb('finalize');
  r.fb('record-gate', '--result', 'fail');
  assert.match(r.fb('decide', '--take', 'r1,c1').json.error, /すべて取り込む回答はできない/);
  assert.equal(r.fb('decide', '--take', 'c1', '--dismiss', 'r1').code, 0, '(w) 候補の取り下げだけでも外したことになる');
  assert.equal(r.fb('status').json.point, 'rebuild');
  const rb = r.fb('rebuild');
  assert.equal(rb.code, 0, JSON.stringify(rb.json));
  assert.deepEqual(rb.json.picked.map((p) => p.id), ['c1']);
  assert.deepEqual(rb.json.dismissed, ['r1']);
  r.fb('record-gate', '--result', 'pass');
  assert.equal(r.fb('merge').code, 0);
  assert.equal(fs.existsSync(path.join(r.root, 'docs/adr/0002-r1.md')), false, '原本は入らない');
  assert.equal(fs.existsSync(path.join(r.root, 'docs/feedback/r1.md')), false, '課題ファイルは消える (止まった課題にならない)');
  assert.deepEqual(trailers(r.root, 'main', 'Feedback-Dismissed'), ['docs/feedback/r1.md']);
  assert.deepEqual(trailers(r.root, 'main', 'Feedback-Consumed'), ['docs/feedback/c1.md']);
});

test('(x) 取り込み済みの契約の課題: commit-issue が worktree の残り (生成物) を捨て、次の課題が clean で始まる (0.1.27 実走 K14)', () => {
  const r = makeRepo({ issues: { 'c1': { kind: 'contract' }, 'c2': { kind: 'contract', created: '2026-09-30T00:00:01Z' } } });
  r.fb('start', '--batch', 'bx');
  r.ww('contracts/generated/bundle.txt', 'sub が作り直した生成物\n');
  const c = r.fb('commit-issue', 'c1');
  assert.equal(c.json.result, 'already-applied');
  assert.equal(c.json.discarded, true);
  assert.equal(fs.existsSync(path.join(r.wt, 'contracts/generated/bundle.txt')), false);
  assert.equal(git(r.wt, 'status', '--porcelain'), '');
  assert.equal(r.fb('status').json.worktree_dirty, false);
  passIssue(r, 'c2', () => r.ww('contracts/openapi/openapi.yaml', 'openapi: 3.1.0\n# c2\n'));
});

test('(z) push の拒否の後の status (cleanup) にもゲートの記録と回答が入る (0.1.27 実走 K19)', () => {
  const r = makeRepo({ issues: { 'c1': { kind: 'contract' } }, origin: true });
  r.fb('start', '--batch', 'bz');
  passIssue(r, 'c1', () => r.ww('contracts/openapi/openapi.yaml', 'openapi: 3.1.0\n# c1\n'));
  r.fb('finalize');
  r.fb('record-gate', '--result', 'pass');
  r.fb('decide', '--take', 'c1');
  const hook = path.join(r.bare, 'hooks', 'pre-receive');
  fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n');
  fs.chmodSync(hook, 0o755);
  assert.equal(r.fb('merge').code, 4);
  const s = r.fb('status').json;
  assert.equal(s.point, 'cleanup');
  assert.equal(s.gate.result, 'pass');
  assert.deepEqual(s.decision.take, ['c1']);
});

test('CLI: --cwd はサブコマンドの前でも後でもよい。branch だけ残り worktree が無ければ broken (差分レビュー 1 ラウンド目)', () => {
  const r = makeRepo({ issues: { 'c1': { kind: 'contract' } } });
  const before = spawnSync(process.execPath, [SCRIPT, '--cwd', r.root, 'status'], { encoding: 'utf8' });
  assert.equal(before.status, 0, before.stdout + before.stderr);
  assert.deepEqual(JSON.parse(before.stdout), { point: 'none' });
  r.fb('start', '--batch', 'bc');
  fs.rmSync(r.wt, { recursive: true, force: true });
  git(r.root, 'worktree', 'prune');
  assert.equal(r.fb('status').json.point, 'broken');
  // 取り込んだ後、worktree だけ消えて止まった: cleanup から後始末が済む
  const r2 = makeRepo({ issues: { 'c1': { kind: 'contract' } } });
  r2.fb('start', '--batch', 'bc2');
  passIssue(r2, 'c1', () => r2.ww('contracts/openapi/openapi.yaml', 'openapi: 3.1.0\n# c1\n'));
  r2.fb('finalize');
  git(r2.root, 'merge', '-q', '--ff-only', 'feedback/bc2');
  fs.rmSync(r2.wt, { recursive: true, force: true });
  assert.equal(r2.fb('status').json.point, 'cleanup');
  const m = r2.fb('merge');
  assert.equal(m.code, 0, JSON.stringify(m.json));
  assert.equal(r2.fb('status').json.point, 'none');
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

test('0.1.30 L14: start --co-author の値を batch.json に残し、全部の commit (課題・索引・生成物・取り下げ・止まった印・plugin) に Co-Authored-By の trailer を 1 つ付ける。値にキーが付いていても二重にしない', () => {
  const r = makeRepo({ issues: { 'r1': { kind: 'rule' }, 'c1': { kind: 'contract' }, 'c2': { kind: 'contract' }, 'r2': { kind: 'rule' }, 'r3': { kind: 'rule', stopped: true, stopped_count: 1 } } });
  const st = r.fb('start', '--batch', 'b30', '--co-author', 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>');
  assert.equal(st.code, 0, JSON.stringify(st.json));
  assert.equal(st.json.co_author, 'Claude Opus 5.5 <noreply@anthropic.com>', 'キーは剥がして値だけ残す');
  passIssue(r, 'r1', () => r.ww('docs/adr/0002-r1.md', '# r1\n'));
  passIssue(r, 'c1', () => r.ww('contracts/openapi/openapi.yaml', 'openapi: 3.1.0\n# c1\n'));
  passIssue(r, 'c2', () => {});  // already-applied
  const rf = path.join(r.base, 'r2.reason.txt');
  fs.writeFileSync(rf, '生成器の問題');
  assert.equal(r.fb('reclassify', 'r2', '--reason-file', rf).code, 0);
  stopIssue(r, 'r3', '止まった', () => r.ww('docs/adr/0003-r3.md', '# r3\n'));
  assert.equal(r.fb('finalize').code, 0);
  r.fb('record-gate', '--result', 'pass');
  assert.equal(r.fb('decide', '--take', 'r1', '--dismiss', 'c1').code, 0);
  assert.equal(r.fb('rebuild').code, 0);
  for (const sha of git(r.root, 'log', '--format=%H', 'main..feedback/b30').split('\n')) {
    const body = git(r.root, 'log', '-1', '--format=%B', sha);
    const subject = git(r.root, 'log', '-1', '--format=%s', sha);
    const lines = body.split('\n').filter((l) => l.startsWith('Co-Authored-By:'));
    assert.deepEqual(lines, ['Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'], `${subject}: ${body}`);
    const parsed = execFileSync('git', ['interpret-trailers', '--parse'], { cwd: r.root, input: body, encoding: 'utf8' });
    assert.match(parsed, /Co-Authored-By: Claude Opus 5\.5/, `${subject}: trailer として読める`);
  }
  const subjects = git(r.root, 'log', '--format=%s', 'main..feedback/b30').split('\n');
  assert.ok(subjects.includes('feedback(b30): dismiss') && subjects.includes('feedback(b30): stopped') && subjects.includes('feedback(b30): plugin r2') && subjects.includes('feedback(b30): adr index'), subjects.join(','));
  // co_author 無しの batch はそのまま (0.1.29 以前に始めたもの)
  const r0 = makeRepo({ issues: { 'r1': { kind: 'rule' } } });
  r0.fb('start', '--batch', 'b31');
  passIssue(r0, 'r1', () => r0.ww('docs/adr/0002-r1.md', '# r1\n'));
  assert.doesNotMatch(git(r0.root, 'log', '-1', '--format=%B', 'feedback/b31'), /Co-Authored-By/);
});

test('0.1.30 L7: finalize と status (gate 以降) が slices_changed (main との差分で slice が作り直された UC) を返す。契約を変えなければ空', () => {
  const r = makeRepo({ issues: { 'c1': { kind: 'contract' }, 'r1': { kind: 'rule' } } });
  // 契約の slice は本物の生成器ではなくスタブの代わりに、派遣が作り直した体で worktree に置き、finalize の derived で作り直されたものとして commit に入れる
  const regen = JSON.parse(r.regen);
  const slices = path.join(r.base, 'slices.js');
  fs.writeFileSync(slices, `'use strict';\nconst fs = require('node:fs');\nfor (const s of ['register-loan', 'register-return']) { fs.mkdirSync('contracts/generated/slices/' + s, { recursive: true }); fs.writeFileSync('contracts/generated/slices/' + s + '/openapi.yaml', fs.readFileSync('contracts/openapi/openapi.yaml', 'utf8')); }\n`);
  regen.derived.push([process.execPath, slices]);
  // main 側にも slice がある状態から始める (差分が無ければ空になることを見る)
  r.w('contracts/generated/slices/register-loan/openapi.yaml', 'openapi: 3.1.0\n');
  r.w('contracts/generated/slices/register-return/openapi.yaml', 'openapi: 3.1.0\n');
  git(r.root, 'add', '-A'); git(r.root, 'commit', '-q', '-m', 'slices');
  r.fb('start', '--batch', 'b32');
  passIssue(r, 'r1', () => r.ww('docs/adr/0002-r1.md', '# r1\n'));
  // 契約を変えずに仕上げる → slice は変わらない
  const f0 = spawnSync(process.execPath, [SCRIPT, 'finalize', '--cwd', r.root, '--regen-cmds', JSON.stringify(regen)], { encoding: 'utf8' });
  const j0 = JSON.parse(f0.stdout.trim());
  assert.deepEqual(j0.slices_changed, [], JSON.stringify(j0));
  assert.deepEqual(r.fb('status').json.slices_changed, []);
  // 共通部分を変える (全 UC の slice が変わる)
  const r2 = makeRepo({ issues: { 'c1': { kind: 'contract' } } });
  r2.w('contracts/generated/slices/register-loan/openapi.yaml', 'openapi: 3.1.0\n');
  r2.w('contracts/generated/slices/register-return/openapi.yaml', 'openapi: 3.1.0\n');
  git(r2.root, 'add', '-A'); git(r2.root, 'commit', '-q', '-m', 'slices');
  r2.fb('start', '--batch', 'b33');
  passIssue(r2, 'c1', () => r2.ww('contracts/openapi/openapi.yaml', 'openapi: 3.1.0\ninfo: {description: 共通の説明}\n'));
  const regen2 = JSON.parse(r2.regen); regen2.derived.push([process.execPath, slices]);
  const f2 = spawnSync(process.execPath, [SCRIPT, 'finalize', '--cwd', r2.root, '--regen-cmds', JSON.stringify(regen2)], { encoding: 'utf8' });
  const j2 = JSON.parse(f2.stdout.trim());
  assert.deepEqual(j2.slices_changed, ['register-loan', 'register-return'], JSON.stringify(j2));
  assert.deepEqual(r2.fb('status').json.slices_changed, ['register-loan', 'register-return'], 'status (gate) でも同じ一覧');
  // 仕上げ済みで finalize を再び呼んでも一覧は返る (再開)
  const f3 = spawnSync(process.execPath, [SCRIPT, 'finalize', '--cwd', r2.root, '--regen-cmds', JSON.stringify(regen2)], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(f3.stdout.trim()).slices_changed, ['register-loan', 'register-return']);
});

test('0.1.30 M5/M6: record-gate --detail は runGates の gates.json (複数) を要約し、--retried を記録する。pass でも detail を読む', () => {
  const r = makeRepo({ issues: { 'c1': { kind: 'contract' } } });
  r.fb('start', '--batch', 'b34');
  passIssue(r, 'c1', () => r.ww('contracts/openapi/openapi.yaml', 'openapi: 3.1.0\n# c1\n'));
  r.fb('finalize');
  const g1 = path.join(r.base, 'gates-loan.json');
  const g2 = path.join(r.base, 'gates-return.json');
  fs.writeFileSync(g1, JSON.stringify({ uc: 'register-loan', result: 'fail', gates: [
    { name: 'static', status: 'pass', jobs: [] },
    { name: 'unit', status: 'fail', jobs: [{ name: 'unit', tier: 'backend-api', status: 'fail', exit: 1, failed_tests: ['returns 409 when already returned'], output_tail: 'a\nb\nc' }, { name: 'unit', tier: 'frontend', status: 'pass', exit: 0 }] },
    { name: 'contract', status: 'missing' },
  ] }));
  fs.writeFileSync(g2, JSON.stringify({ uc: 'register-return', result: 'fail', gates: [{ name: 'unit', status: 'fail', note: 'required job(s) skipped (no command in config): worker:unit', jobs: [{ name: 'unit', tier: 'worker', status: 'skipped', required: true }] }] }));
  const rec = r.fb('record-gate', '--result', 'fail', '--detail', `${g1},${g2}`);
  assert.equal(rec.code, 0, JSON.stringify(rec.json));
  assert.match(rec.json.detail, /\[register-loan\] result=fail/);
  assert.match(rec.json.detail, /unit backend-api:unit exit=1\n  failed_tests: returns 409 when already returned\n  a\n  b\n  c/);
  assert.doesNotMatch(rec.json.detail, /frontend/, '通った job は載せない');
  assert.match(rec.json.detail, /\[register-return\] result=fail \(gates-return\.json\)\nunit: required job\(s\) skipped/);
  assert.ok(!('retried' in rec.json));
  assert.equal(r.fb('status').json.confirm, true);
  // 回し直して通った: pass + retried + 1 回目の写し
  const rec2 = r.fb('record-gate', '--result', 'pass', '--retried', '--detail', g1);
  assert.equal(rec2.code, 0, JSON.stringify(rec2.json));
  assert.equal(rec2.json.retried, true);
  assert.match(rec2.json.detail, /failed_tests: returns 409/);
  const st = r.fb('status').json;
  assert.equal(st.point, 'gate');
  assert.equal(st.gate.retried, true, 'status の gate に回し直しの印が出る (取り込みの前に控える報告に載る)');
  assert.equal(r.fb('decide', '--take', 'c1').code, 0, '通った記録なので取り込める');
  // JSON でないファイルは末尾 40 行のまま。無いファイルは exit 2
  const txt = path.join(r.base, 'out.txt');
  fs.writeFileSync(txt, Array.from({ length: 50 }, (_, i) => `line ${i}`).join('\n'));
  const rec3 = r.fb('record-gate', '--result', 'fail', '--detail', txt);
  assert.equal(rec3.json.detail.split('\n').length, 40);
  assert.equal(rec3.json.detail.split('\n')[0], 'line 10');
  assert.equal(r.fb('record-gate', '--result', 'fail', '--detail', path.join(r.base, 'nope.json')).code, 2);
});

test('0.1.32 N7/O7: scan の legacy_runs は旧形式 (還流 done・配送 done 無し) と片付けの途中 (配送 done が legacy で未起票あり) の run を拾い、通常の run は拾わない', () => {
  const r = makeRepo();
  const legacy = runState.openRun(r.root, 'legacy-uc');
  for (const st of [...runState.STAGES, 'feedback']) if (st !== 'deliver') runState.markDone(legacy, st);
  const half = runState.openRun(r.root, 'half-uc');
  for (const st of [...runState.STAGES, 'feedback']) if (st !== 'deliver') runState.markDone(half, st);
  runState.markDone(half, 'deliver', { legacy: true });
  fs.writeFileSync(path.join(half, 'issues', '20260930T1000_x.md'), issueFile({ kind: 'contract', title: 'x' }));
  const normal = runState.openRun(r.root, 'normal-uc');
  for (const st of runState.STAGES) runState.markDone(normal, st);
  const s = r.fb('scan').json;
  assert.deepEqual(s.legacy_runs.map(x => x.slug), ['half-uc', 'legacy-uc']);
  assert.deepEqual(s.legacy_runs[1], { run: '.distillery/runs/legacy-uc', slug: 'legacy-uc' });
  assert.deepEqual(s.carry_over_pending, []);
});

test('0.1.32 J2: scan の carry_over_pending は最後の review_approved の carry_over.carry が非空で carry_over_migrated が無い run (配送の done の有無を問わない)。carry 無し・移行済みは拾わない', () => {
  const r = makeRepo();
  const pending = runState.openRun(r.root, 'pending-uc');
  runState.appendEvent(pending, 'review_approved', { carry_over: { done: ['a'], carry: ['画面の見本 stories を直す', '前提 A-004 を閉じる'], ignore: [] } });
  const migrated = runState.openRun(r.root, 'migrated-uc');
  runState.appendEvent(migrated, 'review_approved', { carry_over: { done: [], carry: ['x'], ignore: [] } });
  runState.appendEvent(migrated, 'carry_over_migrated', { items: ['x'], to: 'req: feedback' });
  runState.markDone(migrated, 'deliver', { squash: 'x' });
  const none = runState.openRun(r.root, 'none-uc');
  runState.appendEvent(none, 'review_approved', { carry_over: { done: ['a'], carry: [], ignore: ['b'] } });
  const old = runState.openRun(r.root, 'old-uc');
  runState.appendEvent(old, 'review_approved', { assumption_decisions: [] });
  const s = r.fb('scan').json;
  assert.deepEqual(s.carry_over_pending, [{ run: '.distillery/runs/pending-uc', slug: 'pending-uc', items: ['画面の見本 stories を直す', '前提 A-004 を閉じる'] }]);
  assert.equal(s.feedback_due, false, '持ち越しの移行は還流のきっかけではない (要求の差分)');
  // use-cases.yaml の carry_over の行 (0.1.30〜0.1.31 形式) は carry_over_rows に出る (再生成で消える前に控える材料)
  assert.deepEqual(s.carry_over_rows, []);
  r.w('docs/requirements/use-cases.yaml', ['use_cases:', '  - uc: 書籍を登録する', '    slug: register-book', '    spec_ids: [SPEC-001-01]', '    status: planned', '    carry_over:', '      - "packages/ui/stories/LoanRegister.stories.tsx: 文言を直す"', '      - "frontend の AssumptionRecord A-004 を閉じる"', '  - uc: 書籍を編集する', '    slug: edit-book', '    spec_ids: [SPEC-001-02]', '    status: planned', ''].join('\n'));
  assert.deepEqual(r.fb('scan').json.carry_over_rows, [{ slug: 'register-book', items: ['packages/ui/stories/LoanRegister.stories.tsx: 文言を直す', 'frontend の AssumptionRecord A-004 を閉じる'] }]);
});
