'use strict';
// 0.2.0: 縦・横レビュー (reviewStep.js)。本物の Codex の代わりに同じ口を持つ代役で確かめる
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPTS = path.join(__dirname, '../../../plugins/distillery2/skills/d2-common/scripts');
const R = require(path.join(SCRIPTS, 'reviewStep'));
const FAKE = path.join(__dirname, 'fixtures', 'fake-review-runner.js');
fs.chmodSync(FAKE, 0o755);

function run(args, env = {}) {
  const r = spawnSync(process.execPath, [path.join(SCRIPTS, 'reviewStep.js'), ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
  return { code: r.status, out: JSON.parse(r.stdout.trim().split('\n').pop()), err: r.stderr };
}

function repo() { return fs.mkdtempSync(path.join(os.tmpdir(), 'd2-review-')); }

test('観点の定義: 7 か所あり、どの場所も 1〜5 観点で P1 から順に番号が付く', () => {
  const p = R.loadPoints();
  assert.deepEqual(Object.keys(p), ['requirements', 'decide', 'foundation', 'scenario', 'contract', 'implementation', 'asbuilt']);
  for (const [k, list] of Object.entries(p)) {
    assert.ok(list.length >= 1 && list.length <= 5, k);
    list.forEach((x, i) => { assert.equal(x.id, `P${i + 1}`, k); assert.ok(x.name && x.look, k); });
  }
});

test('run: 起動 → 待ち → 回収を 1 回で行い、観点の判定・指摘の数・high 以上の指摘を返す。締め切りを runner に渡す', () => {
  const cwd = repo();
  const log = path.join(cwd, 'calls.log');
  const r = run(['run', '--point', 'requirements', '--target', 'docs/requirements/', '--out', 'reviews/requirements', '--cwd', cwd, '--runner', FAKE, '--poll', '0.01'], { FAKE_LOG: log });
  assert.equal(r.code, 0, r.err);
  assert.equal(r.out.status, 'reviewed');
  assert.deepEqual(r.out.perspectives, { P1: 'FAIL', P2: 'CONCERN', P3: 'PASS', P4: 'PASS' });
  assert.equal(r.out.findings, 2);
  assert.deepEqual(r.out.high_or_critical, ['指摘 1']);
  assert.equal(r.out.has_fail, true);
  assert.equal(r.out.result, 'reviews/requirements/round1.md');
  const prompt = fs.readFileSync(path.join(cwd, 'reviews/requirements/prompt-round1.md'), 'utf8');
  assert.match(prompt, /\| P2 \| UC の抜け \|/);
  assert.match(prompt, /- docs\/requirements\//);
  assert.deepEqual(fs.readFileSync(log, 'utf8').trim().split('\n'), ['start 540', 'status 540', 'status 540', 'result 540']);
});

test('run: runner が無い・起動できない・時間切れ・回収できないときは未レビュー (exit 4)。時間切れは cancel する', () => {
  const cwd = repo();
  const none = run(['run', '--point', 'contract', '--target', 'contracts/', '--out', 'r', '--cwd', cwd, '--runner', path.join(cwd, 'missing.sh')]);
  assert.equal(none.code, 4);
  assert.equal(none.out.status, 'unavailable');
  assert.ok(fs.existsSync(path.join(cwd, 'r', 'prompt-round1.md')), '依頼文は残す (同じモデルで代わりにレビューするとき使う)');
  const nostart = run(['run', '--point', 'contract', '--target', 'contracts/', '--out', 'r', '--cwd', cwd, '--runner', FAKE], { FAKE_MODE: 'nostart' });
  assert.equal(nostart.out.status, 'unavailable');
  assert.match(nostart.out.reason, /companion not installed/);
  const log = path.join(cwd, 'stuck.log');
  const stuck = run(['run', '--point', 'contract', '--target', 'contracts/', '--out', 'r', '--cwd', cwd, '--runner', FAKE, '--poll', '0.01', '--deadline', '0.05'], { FAKE_MODE: 'stuck', FAKE_LOG: log });
  assert.equal(stuck.out.status, 'timed_out');
  assert.match(fs.readFileSync(log, 'utf8'), /^cancel /m);
  const bad = run(['run', '--point', 'contract', '--target', 'contracts/', '--out', 'r', '--cwd', cwd, '--runner', FAKE, '--poll', '0.01'], { FAKE_MODE: 'badresult', FAKE_LOG: path.join(cwd, 'bad.log') });
  assert.equal(bad.out.status, 'failed');
});

test('2 ラウンド目は前回の結果を添えた依頼文になり、--previous が無ければ拒む。prompt は依頼文だけを書く', () => {
  const cwd = repo();
  const r = run(['prompt', '--point', 'scenario', '--target', 'features/x.feature', '--out', 'r', '--cwd', cwd, '--round', '2', '--previous', 'r/round1.md']);
  assert.equal(r.code, 0, r.err);
  const text = fs.readFileSync(path.join(cwd, 'r', 'prompt-round2.md'), 'utf8');
  assert.match(text, /前回 \(1 ラウンド目\) の結果は r\/round1\.md/);
  const bad = run(['prompt', '--point', 'scenario', '--target', 'x', '--out', 'r', '--cwd', cwd, '--round', '2']);
  assert.equal(bad.code, 2);
  const unknown = run(['prompt', '--point', 'feedback', '--target', 'x', '--out', 'r', '--cwd', cwd]);
  assert.equal(unknown.code, 2);
  assert.match(unknown.out.error, /場所の定義が無い/);
});

test('run: 回収した結果に観点の判定か指摘の節が無ければ failed (形の崩れた結果を指摘なしとして先へ進めない。差分レビュー)', () => {
  const cwd = repo();
  const r = run(['run', '--point', 'requirements', '--target', 'docs/', '--out', 'r', '--cwd', cwd, '--runner', FAKE, '--poll', '0.01'], { FAKE_MODE: 'emptyresult', FAKE_LOG: path.join(cwd, 'e.log') });
  assert.equal(r.code, 4);
  assert.equal(r.out.status, 'failed');
  assert.match(r.out.reason, /判定の無い観点: P1, P2, P3, P4/);
});
