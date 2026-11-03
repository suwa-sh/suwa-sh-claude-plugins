'use strict';
// 0.3.0: 上流で止めた機能を、上流を直した後の main の上に写し直す (resumeAfterUpstream.js)。使い捨てのリポで衝突の組み合わせ・途中で止まる・main が進む・回数の上限を確かめる
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const PLUGIN = path.resolve(__dirname, '../../../plugins/distillery2/skills');
const SCRIPT = path.join(PLUGIN, 'd2-common/scripts/resumeAfterUpstream.js');
const R = require(SCRIPT);
const rs = require(path.join(PLUGIN, 'd2-common/scripts/lib/runState'));

const SLUG = 'book-room';

function g(root, ...args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function w(root, rel, text) { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); }
function rd(root, rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function commitAll(root, msg) { g(root, 'add', '-A'); g(root, 'commit', '-q', '-m', msg); return g(root, 'rev-parse', 'HEAD'); }
const lines = (n, tag = '') => Array.from({ length: n }, (_, i) => `line ${i + 1}${tag}`).join('\n') + '\n';

/** 作り直しのテスト用の表: docs/README.md を「README regenerated from <ファイル数>」で作り直す */
function table(tmp, { fail = false } = {}) {
  const gen = path.join(tmp, 'gen-readme.js');
  fs.writeFileSync(gen, fail
    ? "process.stderr.write('boom'); process.exit(1);\n"
    : "const fs=require('fs');const n=fs.readdirSync('apps/backend/src').length;fs.writeFileSync('docs/README.md','README regenerated from '+n+'\\n');\n");
  return [{ id: 'docs-readme', paths: [/^docs\/README\.md$/], needs: 'docs', cmds: [[gen]] }];
}

/**
 * main: 基になる commit → feature/<slug> を切って tier まで進め、決定の課題で止める → main に課題ファイルを入れ、決定の差分で消す。
 * featureEdit / mainEdit で衝突の組み合わせを作る
 */
function makeRepo({ featureEdit = () => {}, mainEdit = () => {}, resumeFrom = null, priorResumes = 0, stopStage = 'tier', target = 'decide' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-resume-'));
  g(root, 'init', '-q', '-b', 'main');
  g(root, 'config', 'user.email', 't@example.com');
  g(root, 'config', 'user.name', 't');
  w(root, '.gitignore', '.distillery/logs/\n');
  w(root, 'docs/requirements/use-cases.yaml', `use_cases:\n  - slug: ${SLUG}\n    status: planned\n`);
  w(root, 'docs/README.md', 'README v0\n');
  w(root, 'apps/backend/src/a.ts', lines(10));
  w(root, 'apps/backend/src/b.ts', lines(5, 'b'));
  const base = commitAll(root, 'base');
  g(root, 'switch', '-q', '-c', `feature/${SLUG}`);
  const run = rs.openRun(root, SLUG);
  rs.appendEvent(run, 'branch_started', { base_branch: 'main', base_head: base, feature_branch: `feature/${SLUG}` });
  for (const s of ['scenario', 'contract', 'scaffold']) rs.markDone(run, s);
  if (stopStage !== 'tier') rs.markDone(run, 'tier');
  w(root, 'features/rooms/book-room.feature', '@uc:book-room\nFeature: 予約する\n');
  fs.mkdirSync(path.join(run, 'reviews', 'contract', '1'), { recursive: true });
  w(root, `.distillery/runs/${SLUG}/reviews/contract/1/round1.md`, 'old review\n');
  w(root, 'docs/README.md', 'README feature\n');
  featureEdit(root);
  commitAll(root, `impl(${SLUG}): tier`);
  // 前の写し直しの回数 (上限の確かめ用)
  for (let i = 0; i < priorResumes; i++) {
    rs.appendEvent(run, 'blocked_on_upstream', { issues: [{ id: `old-${i}`, target }] });
    rs.appendEvent(run, 'resumed_after_upstream', { base_head: base, from_head: base, from_stage: 'tier' });
  }
  const issue = { id: '20261104_000000_tier_i1', target, ...(resumeFrom ? { resume_from: resumeFrom } : {}) };
  rs.appendEvent(run, 'blocked_on_upstream', { issues: [issue] });
  commitAll(root, `impl(${SLUG}): tier (blocked)`);
  g(root, 'switch', '-q', 'main');
  w(root, `docs/feedback/${issue.id}.md`, '---\ntarget_step: decide\n---\n課題\n');
  commitAll(root, `impl(${SLUG}): issues to feedback`);
  fs.rmSync(path.join(root, 'docs/feedback'), { recursive: true });
  w(root, 'docs/adr/0002-new.md', '# 新しい決定\n');
  mainEdit(root);
  commitAll(root, 'decide: feedback');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-resume-gen-'));
  return { root, base, run, tmp, issue };
}

const featureTip = (root) => g(root, 'rev-parse', `feature/${SLUG}`);
const eventsOf = (root) => rs.readEvents(rs.runDirOf(root, SLUG));

function assertResumedHistory(root, mainSha) {
  // main の上に non-merge の commit だけが載り、件名がすべて impl(<slug>): (main マージの件名の検査と squash が通る形)
  const log = g(root, 'log', '--format=%P%x09%s', `${mainSha}..feature/${SLUG}`).split('\n').filter(Boolean);
  assert.ok(log.length >= 2);
  for (const l of log) {
    const [parents, subject] = l.split('\t');
    assert.equal(parents.split(' ').length, 1, `merge commit が無い: ${l}`);
    assert.match(subject, new RegExp(`^impl\\(${SLUG}\\): `));
  }
  assert.ok(g(root, 'merge-base', '--is-ancestor', mainSha, `feature/${SLUG}`) === '');
  assert.equal(rs.status(rs.runDirOf(root, SLUG)).base_head, mainSha);
}

test('merge-tree の -z の出力: 衝突の記録のパスをすべて拾い、rename/delete の旧名も入る。Auto-merging は衝突に入れない', () => {
  const parts = ['T', 'addadd.txt', 'ren2.txt', '', '1', 'addadd.txt', 'Auto-merging', 'Auto-merging addadd.txt\n', '1', 'addadd.txt', 'CONFLICT (contents)', 'CONFLICT (add/add): x\n', '2', 'ren2.txt', 'ren.txt', 'CONFLICT (rename/delete)', 'y\n', ''];
  const buf = Buffer.from(parts.join(String.fromCharCode(0)));
  const m = R.parseMergeTree(buf);
  assert.equal(m.tree, 'T');
  assert.deepEqual(m.conflicts, ['addadd.txt', 'ren.txt', 'ren2.txt']);
  assert.deepEqual(m.groups.map((x) => x.paths), [['addadd.txt'], ['ren2.txt', 'ren.txt']]);
});

test('作り直せる生成物の表: 契約の分割ファイルは入らず、生成物 (bundle・slice・契約テスト・ルール・アーキテスト・README) は入る', () => {
  const t = R.REGENERABLE;
  for (const p of ['contracts/openapi/paths/rooms.yaml', 'contracts/contracts.json', 'contracts/uc-index.yaml', 'contracts/db/domains/room.yaml', 'apps/backend/src/x.ts', 'docs/adr/0001-x.md']) assert.equal(R.isRegenerable(p, t), false, p);
  for (const p of ['contracts/generated/openapi.bundle.yaml', 'contracts/generated/slices/book-room/contract-slice.json', 'apps/backend/test/contract/createBooking.test.ts', 'docs/rules/common.md', '.dependency-cruiser.cjs', 'docs/README.md', 'docs/adr/index.md']) assert.equal(R.isRegenerable(p, t), true, p);
  assert.equal(R.stageOfPath('features/rooms/book-room.feature'), 'scenario');
  assert.equal(R.stageOfPath('contracts/openapi/paths/rooms.yaml'), 'contract');
  assert.equal(R.stageOfPath('apps/backend/src/a.ts'), 'tier');
});

test('両方が別のファイルを変えた: 両方残る。衝突 0、続きは決定の課題なので tier。契約のレビューは残り、tier 以降の done が退避される', () => {
  const { root, run, tmp } = makeRepo({
    featureEdit: (r) => w(r, 'apps/backend/src/feat.ts', 'export const f = 1;\n'),
    mainEdit: (r) => w(r, 'apps/backend/src/main-only.ts', 'export const m = 1;\n'),
  });
  const mainSha = g(root, 'rev-parse', 'main');
  const out = R.resume(root, SLUG, { table: table(tmp) });
  assert.equal(out.from_stage, 'tier');
  assert.deepEqual(out.conflicts, []);
  assert.equal(g(root, 'rev-parse', '--abbrev-ref', 'HEAD'), `feature/${SLUG}`);
  assert.ok(fs.existsSync(path.join(root, 'apps/backend/src/feat.ts')));
  assert.ok(fs.existsSync(path.join(root, 'apps/backend/src/main-only.ts')));
  assert.ok(fs.existsSync(path.join(root, 'docs/adr/0002-new.md')));
  assert.equal(rd(root, 'docs/README.md'), 'README regenerated from 4\n');
  assert.ok(rs.isDone(run, 'contract'));
  assert.ok(!rs.isDone(run, 'tier'));
  assert.ok(fs.existsSync(path.join(run, 'reviews', 'contract', '1', 'round1.md')));
  const ev = eventsOf(root).filter((e) => e.type === 'resumed_after_upstream');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].base_head, mainSha);
  assert.ok(g(root, 'show-ref', '--verify', out.paused_ref.replace(/^/, '')));
  assert.equal(g(root, 'status', '--porcelain', '--untracked-files=no'), '');
  assert.ok(!fs.existsSync(R.journalPath(root, SLUG)));
  assertResumedHistory(root, mainSha);
  const st = rs.status(run);
  assert.equal(st.paused, false);
  assert.equal(st.resumes, 1);
});

test('同じファイルの別の箇所: 両方の変更が残る', () => {
  const { root, tmp } = makeRepo({
    featureEdit: (r) => w(r, 'apps/backend/src/a.ts', rd(r, 'apps/backend/src/a.ts').replace('line 2\n', 'line 2 FEATURE\n')),
    mainEdit: (r) => w(r, 'apps/backend/src/a.ts', rd(r, 'apps/backend/src/a.ts').replace('line 9\n', 'line 9 MAIN\n')),
  });
  const out = R.resume(root, SLUG, { table: table(tmp) });
  assert.deepEqual(out.conflicts, []);
  const a = rd(root, 'apps/backend/src/a.ts');
  assert.match(a, /line 2 FEATURE/);
  assert.match(a, /line 9 MAIN/);
});

test('同じ箇所 (内容の衝突): main の側を採り、機能側の差分ファイルができ、その段 (tier) から', () => {
  const { root, tmp } = makeRepo({
    featureEdit: (r) => w(r, 'apps/backend/src/a.ts', rd(r, 'apps/backend/src/a.ts').replace('line 5\n', 'line 5 FEATURE\n')),
    mainEdit: (r) => w(r, 'apps/backend/src/a.ts', rd(r, 'apps/backend/src/a.ts').replace('line 5\n', 'line 5 MAIN\n')),
    target: 'requirements', resumeFrom: 'contract',
  });
  const out = R.resume(root, SLUG, { table: table(tmp) });
  assert.deepEqual(out.conflicts, ['apps/backend/src/a.ts']);
  assert.match(rd(root, 'apps/backend/src/a.ts'), /line 5 MAIN/);
  assert.doesNotMatch(rd(root, 'apps/backend/src/a.ts'), /FEATURE|<<<<<<</);
  assert.equal(out.diffs.length, 1);
  assert.match(rd(root, out.diffs[0]), /\+line 5 FEATURE/);
  assert.equal(out.from_stage, 'contract', '課題の resume_from (contract) が衝突の段 (tier) より早い');
  // 差分ファイルは run の中にあり、commit に入る
  assert.equal(g(root, 'ls-files', out.diffs[0]), out.diffs[0]);
});

test('add/add: main の側。差分ファイルに機能側の中身', () => {
  const { root, tmp } = makeRepo({
    featureEdit: (r) => w(r, 'apps/backend/src/new.ts', 'feature version\n'),
    mainEdit: (r) => w(r, 'apps/backend/src/new.ts', 'main version\n'),
  });
  const out = R.resume(root, SLUG, { table: table(tmp) });
  assert.deepEqual(out.conflicts, ['apps/backend/src/new.ts']);
  assert.equal(rd(root, 'apps/backend/src/new.ts'), 'main version\n');
  assert.match(rd(root, out.diffs[0]), /\+feature version/);
});

test('rename/delete: 旧名・新名の両方を main の側 (どちらも無い) にし、差分ファイルに機能側の rename と変更が出る', () => {
  const { root, tmp } = makeRepo({
    featureEdit: (r) => { g(r, 'mv', 'apps/backend/src/b.ts', 'apps/backend/src/c.ts'); w(r, 'apps/backend/src/c.ts', rd(r, 'apps/backend/src/c.ts') + 'added in feature\n'); },
    mainEdit: (r) => g(r, 'rm', '-q', 'apps/backend/src/b.ts'),
  });
  const out = R.resume(root, SLUG, { table: table(tmp) });
  assert.deepEqual(out.conflicts, ['apps/backend/src/b.ts', 'apps/backend/src/c.ts']);
  assert.ok(!fs.existsSync(path.join(root, 'apps/backend/src/b.ts')));
  assert.ok(!fs.existsSync(path.join(root, 'apps/backend/src/c.ts')));
  assert.equal(out.diffs.length, 1);
  const d = rd(root, out.diffs[0]);
  assert.match(d, /rename from apps\/backend\/src\/b\.ts/);
  assert.match(d, /rename to apps\/backend\/src\/c\.ts/);
  assert.match(d, /\+added in feature/);
});

test('modify/delete: main の側 (消える)。差分ファイルに機能側の変更', () => {
  const { root, tmp } = makeRepo({
    featureEdit: (r) => w(r, 'apps/backend/src/b.ts', rd(r, 'apps/backend/src/b.ts').replace('line 3b', 'line 3b FEATURE')),
    mainEdit: (r) => g(r, 'rm', '-q', 'apps/backend/src/b.ts'),
  });
  const out = R.resume(root, SLUG, { table: table(tmp) });
  assert.deepEqual(out.conflicts, ['apps/backend/src/b.ts']);
  assert.ok(!fs.existsSync(path.join(root, 'apps/backend/src/b.ts')));
  assert.match(rd(root, out.diffs[0]), /\+line 3b FEATURE/);
});

test('生成物だけが両方で変わった: 衝突に数えず、main の側を採って作り直す', () => {
  const { root, tmp } = makeRepo({ mainEdit: (r) => w(r, 'docs/README.md', 'README main\n') });
  const out = R.resume(root, SLUG, { table: table(tmp) });
  assert.deepEqual(out.conflicts, []);
  assert.deepEqual(out.regenerated, ['docs-readme']);
  assert.equal(rd(root, 'docs/README.md'), 'README regenerated from 2\n');
});

test('シナリオのファイルが衝突したら scenario から。scenario 以降の done とレビューの置き場が退避される', () => {
  const { root, run, tmp } = makeRepo({
    mainEdit: (r) => w(r, 'features/rooms/book-room.feature', '@uc:book-room\nFeature: main 側\n'),
  });
  const out = R.resume(root, SLUG, { table: table(tmp) });
  assert.equal(out.from_stage, 'scenario');
  assert.ok(!rs.isDone(run, 'scenario'));
  assert.ok(!fs.existsSync(path.join(run, 'reviews', 'contract')));
  assert.ok(fs.readdirSync(path.join(run, 'invalidated')).some((n) => /_reviews_contract$/.test(n)));
});

test('機能の run の記録が main 側と衝突したら写し直さずに止まる (run の履歴を main の側で上書きしない)', () => {
  const { root, tmp } = makeRepo({
    featureEdit: (r) => w(r, `.distillery/runs/${SLUG}/learnings/x.md`, 'feature\n'),
    mainEdit: (r) => w(r, `.distillery/runs/${SLUG}/learnings/x.md`, 'main\n'),
  });
  const tip = featureTip(root);
  assert.throws(() => R.resume(root, SLUG, { table: table(tmp) }), /run の記録が main 側と衝突/);
  assert.equal(featureTip(root), tip);
});

test('衝突の印が残る tree は作らない', () => {
  const { root, tmp } = makeRepo({ mainEdit: (r) => w(r, 'apps/backend/src/weird.ts', '<<<<<<< HEAD\nx\n') });
  const tip = featureTip(root);
  assert.throws(() => R.resume(root, SLUG, { table: table(tmp) }), /衝突の印が残っている/);
  assert.equal(featureTip(root), tip);
});

test('4 回目の写し直し: 何も変えずに上限 (exit 3)。--override-limit なら進む', () => {
  const { root, tmp } = makeRepo({ priorResumes: 3 });
  const tip = featureTip(root);
  const evBefore = g(root, 'show', `feature/${SLUG}:.distillery/runs/${SLUG}/events.jsonl`);
  const r = spawnSync(process.execPath, [SCRIPT, 'run', root, SLUG], { encoding: 'utf8' });
  assert.equal(r.status, 3);
  assert.equal(JSON.parse(r.stdout).limit_reached, true);
  assert.equal(featureTip(root), tip);
  assert.equal(g(root, 'show', `feature/${SLUG}:.distillery/runs/${SLUG}/events.jsonl`), evBefore);
  assert.ok(!fs.existsSync(R.journalPath(root, SLUG)));
  const out = R.resume(root, SLUG, { table: table(tmp), overrideLimit: true });
  assert.equal(out.resumes, 4);
});

test('止めた課題が main に残っていれば写し直さない', () => {
  const { root, tmp, issue } = makeRepo();
  w(root, `docs/feedback/${issue.id}.md`, '---\n---\n');
  commitAll(root, 'back');
  assert.throws(() => R.resume(root, SLUG, { table: table(tmp) }), /まだ main に残っている/);
});

for (const step of [2, 3, 4, 5, 6, 7, 8, 9]) {
  test(`写し直しの途中で止まる (${step} の後): 次の起動が続きから行い、写し直しは 1 回だけ記録される`, () => {
    const { root, tmp } = makeRepo({
      featureEdit: (r) => w(r, 'apps/backend/src/a.ts', rd(r, 'apps/backend/src/a.ts').replace('line 5\n', 'line 5 FEATURE\n')),
      mainEdit: (r) => w(r, 'apps/backend/src/a.ts', rd(r, 'apps/backend/src/a.ts').replace('line 5\n', 'line 5 MAIN\n')),
    });
    const mainSha = g(root, 'rev-parse', 'main');
    assert.throws(() => R.resume(root, SLUG, { table: table(tmp), stopAfter: step }), /で止めた/);
    assert.ok(fs.existsSync(R.journalPath(root, SLUG)));
    const out = R.resume(root, SLUG, { table: table(tmp) });
    assert.equal(out.resumes, 1);
    assert.equal(eventsOf(root).filter((e) => e.type === 'resumed_after_upstream').length, 1);
    assert.equal(g(root, 'log', '--format=%s', `${mainSha}..feature/${SLUG}`).split('\n').length, 2);
    assert.ok(!fs.existsSync(R.journalPath(root, SLUG)));
    assert.match(rd(root, 'apps/backend/src/a.ts'), /line 5 MAIN/);
    assertResumedHistory(root, mainSha);
  });
}

test('3 回目の写し直しの途中で止まっても、続きは回数の判定で止まらない', () => {
  const { root, tmp } = makeRepo({ priorResumes: 2 });
  assert.throws(() => R.resume(root, SLUG, { table: table(tmp), stopAfter: 7 }), /で止めた/);
  // 7 の後の記録には 3 回目の写し直しが入っていない (9 で記録する) ので、回数の判定を先にすると止まらない。記録があれば判定しない
  const out = R.resume(root, SLUG, { table: table(tmp) });
  assert.equal(out.resumes, 3);
});

test('生成物の作り直しが落ちたら止まり、直した後の起動で続きから終わる', () => {
  const { root, tmp } = makeRepo();
  assert.throws(() => R.resume(root, SLUG, { table: table(tmp, { fail: true }) }), /作り直しが失敗/);
  const j = JSON.parse(rd(root, '.distillery/logs/resume-book-room.json'));
  assert.deepEqual(j.done_steps, [2, 3, 4, 5, 6]);
  const out = R.resume(root, SLUG, { table: table(tmp) });
  assert.equal(out.from_stage, 'tier');
});

test('付け替えの前に main が進んだ: 新しい main で作り直し、新しい main の変更が tree に入る', () => {
  const { root, tmp } = makeRepo();
  assert.throws(() => R.resume(root, SLUG, { table: table(tmp), stopAfter: 4 }), /で止めた/);
  w(root, 'apps/backend/src/late.ts', 'late\n');
  const late = commitAll(root, 'human commit on main');
  const out = R.resume(root, SLUG, { table: table(tmp) });
  assert.equal(out.base_head, late);
  assert.ok(fs.existsSync(path.join(root, 'apps/backend/src/late.ts')));
  assertResumedHistory(root, late);
});

test('付け替えの後に main が進んだ: 止まって報告する (main の変更を黙って捨てない)', () => {
  const { root, tmp } = makeRepo();
  assert.throws(() => R.resume(root, SLUG, { table: table(tmp), stopAfter: 6 }), /で止めた/);
  const mainSha = g(root, 'rev-parse', 'main');
  // feature にいるので main は worktree なしで進める
  const tree = g(root, 'rev-parse', 'main^{tree}');
  const late = execFileSync('git', ['commit-tree', tree, '-p', mainSha, '-m', 'human'], { cwd: root, encoding: 'utf8' }).trim();
  g(root, 'update-ref', 'refs/heads/main', late);
  assert.throws(() => R.resume(root, SLUG, { table: table(tmp) }), /main が進んだ/);
  assert.ok(fs.existsSync(R.journalPath(root, SLUG)));
});

test('check-diffs: applied は追加行がファイルにあれば通り、無ければ差し戻す。dropped は理由が要る。全件が要る', () => {
  const { root, run, tmp } = makeRepo({
    featureEdit: (r) => w(r, 'apps/backend/src/a.ts', rd(r, 'apps/backend/src/a.ts').replace('line 5\n', 'line 5 FEATURE\n')),
    mainEdit: (r) => w(r, 'apps/backend/src/a.ts', rd(r, 'apps/backend/src/a.ts').replace('line 5\n', 'line 5 MAIN\n')),
  });
  const out = R.resume(root, SLUG, { table: table(tmp) });
  const h = path.join(run, 'handoff', 'tier-backend.json');
  w(root, path.relative(root, h), JSON.stringify({ resume_diffs: [{ diff: out.diffs[0], result: 'applied', where: 'apps/backend/src/a.ts', reason: '反映した' }] }));
  let r = R.checkDiffs(run, h);
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /追加行が apps\/backend\/src\/a\.ts に無い/);
  w(root, 'apps/backend/src/a.ts', rd(root, 'apps/backend/src/a.ts').replace('line 5 MAIN\n', 'line 5 MAIN\n  line   5 FEATURE\n'));
  r = R.checkDiffs(run, h);
  assert.equal(r.ok, true, r.errors.join('\n'));
  w(root, path.relative(root, h), JSON.stringify({ resume_diffs: [{ diff: out.diffs[0], result: 'dropped', reason: '' }] }));
  assert.match(R.checkDiffs(run, h).errors[0], /理由が要る/);
  w(root, path.relative(root, h), JSON.stringify({ resume_diffs: [] }));
  assert.match(R.checkDiffs(run, h).errors[0], /resume_diffs に無い/);
});

test('中身の無い attempt-<n> (branch を切り替えた後に残る空のディレクトリ) は currentAttempt が数えない。rewind が開いた attempt は数える', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-attempt-'));
  g(root, 'init', '-q', '-b', 'main');
  g(root, 'config', 'user.email', 't@example.com');
  g(root, 'config', 'user.name', 't');
  const run = rs.openRun(root, 'x');
  commitAll(root, 'base');
  g(root, 'switch', '-q', '-c', 'feature/x');
  rs.appendEvent(run, 'rewound', {});
  rs.attemptDir(run, 2);
  w(root, '.distillery/runs/x/attempt-3/.gitkeep-not', '');
  fs.rmSync(path.join(run, 'attempt-3'), { recursive: true });
  fs.mkdirSync(path.join(run, 'attempt-3'));
  commitAll(root, 'feature');
  assert.equal(rs.currentAttempt(run), 2, '空の attempt-3 は数えない');
  g(root, 'switch', '-q', 'main');
  // main に戻ると attempt-2 は消えるが、空の attempt-3 は作業ツリーに残る
  assert.ok(fs.existsSync(path.join(run, 'attempt-3')));
  assert.equal(rs.currentAttempt(run), 1);
  g(root, 'switch', '-q', 'feature/x');
  assert.equal(rs.currentAttempt(run), 2);
});
