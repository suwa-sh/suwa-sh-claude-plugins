'use strict';
// feedbackBatch.js の統合テスト: 使い捨ての git リポジトリで課題ファイルの扱いと、0.1.x の途中で止まったバッチの片付けを通す。
// 0.2.0 で還流のバッチを作るコマンドを外したので、途中のバッチは git で直接組む (makeBatch)。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-common/scripts/feedbackBatch.js');
const runState = require('../../../plugins/distillery2/skills/d2-common/scripts/lib/runState');

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
  const w = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 't@example.com');
  git(root, 'config', 'user.name', 't');
  w('.gitignore', '.distillery/logs/\n.distillery/worktrees/\n.distillery/runs/*/reports/\nnode_modules\n');
  w('docs/adr/0001-base.md', '# base\n');
  w('docs/requirements/requirements.yaml', 'r: 1\n');
  w('contracts/openapi/openapi.yaml', 'openapi: 3.1.0\n');
  for (const [id, fm] of Object.entries(issues)) w(`docs/feedback/${id}.md`, issueFile({ title: `${id} の課題`, from_uc: 'register-loan', status: 'open', created: '2026-09-30T00:00:00Z', ...fm }));
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'init');
  let bare = null;
  if (origin) {
    bare = path.join(base, 'origin.git');
    git(base, 'init', '-q', '--bare', '-b', 'main', bare);
    git(root, 'remote', 'add', 'origin', bare);
    git(root, 'push', '-q', '-u', 'origin', 'main');
  }
  const fb = (cmd, ...args) => {
    const r = spawnSync(process.execPath, [SCRIPT, cmd, '--cwd', root, ...args], { encoding: 'utf8' });
    let json = null;
    try { json = JSON.parse(r.stdout.trim().split('\n').pop()); } catch { /* 出力なし */ }
    return { code: r.status, json, stderr: r.stderr };
  };
  const wt = path.join(root, '.distillery/worktrees/feedback');
  return { base, root, wt, w, fb, bare };
}

/** 0.1.x の start と同じ形の途中のバッチ (worktree・branch feedback/<b>・batch.json) を組む */
function makeBatch(r, b, ids) {
  git(r.root, 'worktree', 'add', '-q', '-b', `feedback/${b}`, r.wt, 'main');
  const fbDir = path.join(r.root, '.distillery/logs/feedback', b);
  fs.mkdirSync(fbDir, { recursive: true });
  fs.writeFileSync(path.join(fbDir, 'batch.json'), JSON.stringify({ batch: b, base: git(r.root, 'rev-parse', 'main'), issues: ids.map((id) => ({ id, kind: 'contract', stopped_count: 0 })) }));
  return fbDir;
}

/** worktree で課題 1 件を取り込んだ commit (原本の変更と課題ファイルの削除) */
function consumeIssue(r, b, id) {
  fs.appendFileSync(path.join(r.wt, 'contracts/openapi/openapi.yaml'), `# ${id}\n`);
  git(r.wt, 'rm', '-q', '--', `docs/feedback/${id}.md`);
  git(r.wt, 'add', '-A');
  git(r.wt, 'commit', '-q', '-m', `feedback(${b}): contract ${id}`);
}

function exists(r, b, fbDir) {
  return { worktree: fs.existsSync(r.wt), branch: git(r.root, 'branch', '--list', `feedback/${b}`) !== '', state: fs.existsSync(fbDir) };
}

test('(p) scan: feedback_due は途中のバッチがあるときだけ。ルール・契約の課題と未起票の run では立たない (triggers・stopped は互換で残る)', () => {
  const r = makeRepo({ issues: { 's1': { kind: 'rule', stopped: true, stopped_count: 1 }, 'q1': { kind: 'requirement' }, 'c1': { kind: 'contract' } } });
  const run = runState.openRun(r.root, 'register-return');
  runState.markDone(run, 'deliver', { squash: 'x' });
  fs.writeFileSync(path.join(run, 'issues', '20260930T1000_x.md'), issueFile({ kind: 'contract', title: 'x' }));
  let s = r.fb('scan').json;
  assert.equal(s.feedback_due, false, JSON.stringify(s));
  assert.deepEqual(s.requirement, ['q1']);
  assert.deepEqual(s.requirement_all, ['q1']);
  assert.deepEqual(s.triggers, ['c1']);
  assert.deepEqual(s.stopped, [{ id: 's1', stopped_count: 1 }]);
  assert.deepEqual(s.unfiled_runs, [{ run: '.distillery/runs/register-return', unfiled: ['issues/20260930T1000_x.md'] }]);
  assert.deepEqual(s.batch, { point: 'none' });
  makeBatch(r, 'b1', ['c1']);
  s = r.fb('scan').json;
  assert.equal(s.feedback_due, true, '途中のバッチは片付けが要るので気づかせる');
  assert.equal(s.batch.point, 'issues');
  assert.equal(s.batch.batch, 'b1');
});

test('abandon: main へ取り込む前のバッチは、課題ファイルが main に残っていれば worktree・branch・状態を消す', () => {
  const r = makeRepo({ issues: { 'c1': { kind: 'contract' }, 'c2': { kind: 'contract' } } });
  // c2 は main の作業ツリーにだけある (file-issues が書いて未 commit のまま切り出した)
  r.w('docs/feedback/c3.md', issueFile({ kind: 'contract', title: 'c3', from_uc: 'u', status: 'open', created: '2026-09-30T00:00:00Z' }));
  const fbDir = makeBatch(r, 'b2', ['c1', 'c2', 'c3']);
  consumeIssue(r, 'b2', 'c1');
  assert.equal(r.fb('status').json.point, 'issues');
  const a = r.fb('abandon');
  assert.equal(a.code, 0, JSON.stringify(a.json));
  assert.deepEqual(a.json, { abandoned: true, batch: 'b2', removed: { worktree: true, branch: true, state: true } });
  assert.deepEqual(exists(r, 'b2', fbDir), { worktree: false, branch: false, state: false });
  assert.equal(r.fb('status').json.point, 'none');
  for (const id of ['c1', 'c2', 'c3']) assert.ok(fs.existsSync(path.join(r.root, `docs/feedback/${id}.md`)), `${id} は main に残る`);
  assert.doesNotMatch(fs.readFileSync(path.join(r.root, 'contracts/openapi/openapi.yaml'), 'utf8'), /# c1/, 'branch 側の原本の変更は入らない');
  assert.deepEqual(r.fb('abandon').json, { abandoned: false }, '2 回目は何もしない');
});

test('abandon: 仕上げ済み (gate 以降) でも main へ取り込む前なら片付ける', () => {
  const r = makeRepo({ issues: { 'c1': { kind: 'contract' } } });
  const fbDir = makeBatch(r, 'b3', ['c1']);
  consumeIssue(r, 'b3', 'c1');
  git(r.wt, 'commit', '-q', '--allow-empty', '-m', 'feedback(b3): regenerate');
  assert.equal(r.fb('status').json.point, 'gate');
  assert.equal(r.fb('abandon').code, 0);
  assert.deepEqual(exists(r, 'b3', fbDir), { worktree: false, branch: false, state: false });
});

test('abandon: バッチの課題ファイルが main に無ければ、何も消さずに exit 1 で missing を返す', () => {
  const r = makeRepo({ issues: { 'c1': { kind: 'contract' } } });
  const fbDir = makeBatch(r, 'b4', ['c1', 'gone1', 'gone2']);
  consumeIssue(r, 'b4', 'c1');
  const a = r.fb('abandon');
  assert.equal(a.code, 1, JSON.stringify(a.json));
  assert.deepEqual(a.json.missing, ['gone1', 'gone2']);
  assert.match(a.json.error, /main に無い/);
  assert.deepEqual(exists(r, 'b4', fbDir), { worktree: true, branch: true, state: true });
});

test('abandon: 取り込み済み (cleanup) のバッチは拒み、merge で push と後始末をする。merge は cleanup 以外を拒む', () => {
  const r = makeRepo({ issues: { 'c1': { kind: 'contract' } }, origin: true });
  const fbDir = makeBatch(r, 'b5', ['c1']);
  consumeIssue(r, 'b5', 'c1');
  const m0 = r.fb('merge');
  assert.equal(m0.code, 1, JSON.stringify(m0.json));
  assert.match(m0.json.error, /abandon/, 'issues の地点では merge しない');
  git(r.wt, 'commit', '-q', '--allow-empty', '-m', 'feedback(b5): regenerate');
  assert.match(r.fb('merge').json.error, /point: gate/, 'gate でも merge しない');
  assert.equal(git(r.root, 'rev-parse', 'main'), git(r.root, 'rev-parse', 'origin/main'), 'merge は main を動かさない');
  git(r.root, 'merge', '-q', '--ff-only', 'feedback/b5');
  assert.equal(r.fb('status').json.point, 'cleanup');
  const a = r.fb('abandon');
  assert.equal(a.code, 1);
  assert.match(a.json.error, /merge/);
  const m = r.fb('merge');
  assert.equal(m.code, 0, JSON.stringify(m.json));
  assert.equal(m.json.merged, true);
  assert.equal(m.json.pushed, true);
  assert.equal(git(r.root, 'rev-parse', 'main'), git(r.root, 'rev-parse', 'origin/main'));
  assert.deepEqual(exists(r, 'b5', fbDir), { worktree: false, branch: false, state: false });
});

test('broken: branch の無い worktree は、変化も先の commit も無ければ消し、あれば消さない', () => {
  const r = makeRepo({ issues: { 'c1': { kind: 'contract' } } });
  git(r.root, 'worktree', 'add', '-q', '--detach', r.wt, 'main');
  assert.equal(r.fb('status').json.point, 'broken');
  const a = r.fb('abandon');
  assert.equal(a.code, 0, JSON.stringify(a.json));
  assert.deepEqual(a.json, { abandoned: true, batch: null, removed: { worktree: true, branch: false, state: false } });
  assert.equal(fs.existsSync(r.wt), false);
  // 未 commit の変化がある
  git(r.root, 'worktree', 'add', '-q', '--detach', r.wt, 'main');
  fs.writeFileSync(path.join(r.wt, 'docs/feedback/new.md'), 'x\n');
  const b = r.fb('abandon');
  assert.equal(b.code, 1, JSON.stringify(b.json));
  assert.ok(fs.existsSync(path.join(r.wt, 'docs/feedback/new.md')));
  // main より先の commit がある
  git(r.wt, 'add', '-A');
  git(r.wt, 'commit', '-q', '-m', 'x');
  assert.equal(r.fb('abandon').code, 1);
  assert.ok(fs.existsSync(r.wt));
});

test('broken: batch.json の無い branch は、main より先の commit が無いときだけ消す', () => {
  const r = makeRepo({ issues: { 'c1': { kind: 'contract' } } });
  const fbDir = makeBatch(r, 'b6', ['c1']);
  fs.rmSync(path.join(fbDir, 'batch.json'));
  assert.equal(r.fb('status').json.point, 'broken');
  consumeIssue(r, 'b6', 'c1');
  assert.equal(r.fb('abandon').code, 1, '先の commit があると対象が分からないので消さない');
  assert.deepEqual(exists(r, 'b6', fbDir), { worktree: true, branch: true, state: true });
  git(r.wt, 'reset', '-q', '--hard', 'main');
  const a = r.fb('abandon');
  assert.equal(a.code, 0, JSON.stringify(a.json));
  assert.deepEqual(exists(r, 'b6', fbDir), { worktree: false, branch: false, state: false });
});

test('CLI: --cwd はサブコマンドの前でも後でもよい。外したサブコマンドは使い方の誤り (exit 2)', () => {
  const r = makeRepo({ issues: { 'c1': { kind: 'contract' } } });
  const before = spawnSync(process.execPath, [SCRIPT, '--cwd', r.root, 'status'], { encoding: 'utf8' });
  assert.equal(before.status, 0, before.stdout + before.stderr);
  assert.deepEqual(JSON.parse(before.stdout), { point: 'none' });
  for (const cmd of ['start', 'commit-issue', 'regen', 'discard', 'record-static', 'stop-issue', 'finalize', 'record-gate', 'decide', 'rebuild']) {
    const x = spawnSync(process.execPath, [SCRIPT, cmd, '--cwd', r.root], { encoding: 'utf8' });
    assert.equal(x.status, 2, cmd);
    assert.match(x.stderr, /file-issues\|scan\|hold\|reclassify\|status\|merge\|abandon/);
  }
});

test('(u) reclassify: バッチ無しで main の作業ツリーの課題を kind: plugin に書き換え、その課題ファイルだけを今の branch に commit する。scan で plugin に出てきっかけにならない', () => {
  const body = '## 止まった理由\n\n1 回目: ADR で表せない\n\n## 事実\n\n- biome の設定を変えたい\n';
  const r = makeRepo();
  r.w('docs/feedback/p1.md', issueFile({ kind: 'rule', target_step: 'decide', title: '止まった: p1 の課題', from_uc: 'u', status: 'open', created: '2026-09-30T00:00:01Z', stopped: true, stopped_count: 1 }, body));
  git(r.root, 'add', '-A');
  git(r.root, 'commit', '-q', '-m', 'p1');
  // ほかの staged の変化は commit に混ぜない
  r.w('docs/other.md', 'staged\n');
  git(r.root, 'add', 'docs/other.md');
  const rf = path.join(r.base, 'p1.reason.txt');
  fs.writeFileSync(rf, 'ADR の rules では表せない (biome.json は生成器が作り直す)');
  const rc = r.fb('reclassify', 'p1', '--reason-file', rf, '--co-author', 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>');
  assert.equal(rc.code, 0, JSON.stringify(rc.json));
  assert.equal(rc.json.kind_original, 'rule');
  assert.equal(rc.json.branch, 'main');
  assert.equal(rc.json.sha, git(r.root, 'rev-parse', 'HEAD'));
  assert.equal(git(r.root, 'log', '-1', '--format=%s'), 'feedback: plugin p1');
  assert.deepEqual(git(r.root, 'show', '--name-only', '--format=', 'HEAD').split('\n'), ['docs/feedback/p1.md']);
  assert.equal(git(r.root, 'diff', '--cached', '--name-only'), 'docs/other.md', 'staged の変化はそのまま残る');
  const msg = git(r.root, 'log', '-1', '--format=%B');
  assert.match(msg, /Feedback-Reclassified: docs\/feedback\/p1\.md/);
  assert.match(msg, /Feedback-Kind-Original: rule/);
  assert.deepEqual(msg.split('\n').filter((l) => l.startsWith('Co-Authored-By:')), ['Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'], 'キーは二重にしない');
  const t = fs.readFileSync(path.join(r.root, 'docs/feedback/p1.md'), 'utf8');
  assert.match(t, /kind: plugin/);
  assert.match(t, /kind_original: rule/);
  assert.match(t, /title: p1 の課題/, '題名の「止まった: 」を外す');
  assert.doesNotMatch(t, /stopped/, '止まった印を外す');
  assert.match(t, /## プラグインへ持ち帰る理由\n\nADR の rules では表せない/);
  assert.match(t, /## 止まった理由\n\n1 回目/, '止まった理由の本文は残す');
  const sc = r.fb('scan').json;
  assert.deepEqual(sc.plugin, ['p1']);
  assert.deepEqual(sc.triggers, []);
  assert.deepEqual(sc.stopped, []);
  assert.deepEqual(sc.upstream.decide, [], '戻し先から外れる');
  assert.equal(r.fb('reclassify', 'p1', '--reason-file', rf).code, 1, 'もう plugin の課題は拒む');
  assert.equal(r.fb('reclassify', 'nope', '--reason-file', rf).code, 1);
  assert.equal(r.fb('reclassify', 'p1').code, 2);
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

test('0.1.32 N7/O7: scan の legacy_runs は旧形式 (還流 done・main マージ done 無し) と片付けの途中 (main マージ done が legacy で未起票あり) の run を拾い、通常の run は拾わない', () => {
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

test('0.1.32 J2: scan の carry_over_pending は最後の review_approved の carry_over.carry が非空で carry_over_migrated が無い run (main マージの done の有無を問わない)。carry 無し・移行済みは拾わない', () => {
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

test('0.1.36 S2: as-built の要約役の下書き (_asbuilt_) も file-issues で要求の課題ファイルになり、scan の requirement に出る (要求の差分で人が決める)', () => {
  const r = makeRepo();
  const run = runState.openRun(r.root, 'register-loan');
  fs.writeFileSync(path.join(run, 'issues', '20261103T010000Z_asbuilt_same-key-race.md'), issueFile({ kind: 'requirement', title: '同じキーの同時要求で 500', uc: 'register-loan' }, '## 背景\n\n- 冪等キーの検索は行ロックしない\n'));
  const a = r.fb('file-issues', '.distillery/runs/register-loan');
  assert.equal(a.code, 0, JSON.stringify(a.json));
  assert.deepEqual(a.json.filed, ['docs/feedback/20261103T010000Z_asbuilt_same-key-race.md']);
  assert.match(fs.readFileSync(path.join(r.root, 'docs/feedback/20261103T010000Z_asbuilt_same-key-race.md'), 'utf8'), /kind: requirement/);
  assert.ok(r.fb('scan').json.requirement.includes('20261103T010000Z_asbuilt_same-key-race'));
});
