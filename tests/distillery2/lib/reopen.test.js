'use strict';
// 0.1.35: main マージ済みの UC のやり直し (R3)・status の書き換え (R21)・契約の生成物の basis 行 (R10)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

const PLUGIN = path.resolve(__dirname, '../../../plugins/distillery2/skills');
const rs = require(path.join(PLUGIN, 'd2-common/scripts/lib/runState'));
const U = require(path.join(PLUGIN, 'd2-contract/scripts/lib/genUtil'));
const FB = path.join(PLUGIN, 'd2-common/scripts/feedbackBatch.js');

const USE_CASES = `version: "1.0"
use_cases:
  - uc_id: aaaa0001
    business: 貸出業務
    uc: 貸出を登録する
    slug: register-loan
    spec_ids:
      - SPEC-003-01
      - SPEC-003-03
    spec_ids_rejected: []
    status: done
  - uc_id: aaaa0002
    business: 貸出業務
    uc: 返却を登録する
    slug: register-return
    spec_ids:
      - SPEC-003-02
    spec_ids_rejected: []
    status: "done"
`;

function requirements(extra = {}) {
  const c1 = extra.c1 || ['貸出できる'];
  return `requirements:
  - id: REQ-003
    specifications:
      - id: SPEC-003-01
        acceptance_criteria:
${c1.map((c) => `          - ${c}`).join('\n')}
      - id: SPEC-003-02
        acceptance_criteria:
          - 返却できる
      - id: SPEC-003-03
        acceptance_criteria:
          - 5 冊まで
          - 6 冊目は断る
`;
}

function feature(slug, name, tags) {
  return `@uc:${slug}\nFeature: ${name}\n${tags.map((t, i) => `  @acceptance @acceptance:${t}\n  Scenario: シナリオ ${i + 1}\n    Given 前提\n    When 操作\n    Then 結果\n`).join('\n')}`;
}

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-reopen-'));
  const w = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  w('docs/requirements/use-cases.yaml', USE_CASES);
  w('docs/requirements/requirements.yaml', requirements());
  w('features/貸出業務/register-loan.feature', feature('register-loan', '貸出を登録する', ['SPEC-003-01-1']));
  w('features/貸出業務/register-return.feature', feature('register-return', '返却を登録する', ['SPEC-003-02-1']));
  for (const slug of ['register-loan', 'register-return']) {
    const dir = rs.openRun(root, slug);
    rs.markDone(dir, 'deliver', { squash: 'x' });
    w(`.distillery/runs/${slug}/reports/gates.json`, '{}');
    w(`.distillery/runs/${slug}/traces/a.jsonl`, '{}');
  }
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A'], { cwd: root });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init'], { cwd: root });
  return root;
}

function scan(root) {
  const r = spawnSync(process.execPath, [FB, 'scan', '--cwd', root], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test('0.1.35 R3: scan の uncovered_done は main マージ済みでシナリオが受入基準を網羅しない UC を missing 付きで出す (網羅していれば出さない)', () => {
  const root = makeRepo();
  const s = scan(root);
  assert.deepEqual(s.uncovered_done.map((u) => u.slug), ['register-loan']);
  const u = s.uncovered_done[0];
  assert.equal(u.feature, 'features/貸出業務/register-loan.feature');
  assert.deepEqual(u.missing.map((m) => m.tag), ['@acceptance:SPEC-003-03-1', '@acceptance:SPEC-003-03-2']);
  assert.equal(u.error, undefined);
  assert.deepEqual(s.reopened, []);
});

test('0.1.35 R3: main マージの done は受入基準の指紋を持ち、文面だけが変わった UC も uncovered_done に acceptance_changed で出る', () => {
  const root = makeRepo();
  const done = rs.readDone(rs.runDirOf(root, 'register-loan'), 'deliver');
  assert.match(done.acceptance_sha256, /^[0-9a-f]{64}$/);
  assert.equal(done.acceptance_sha256, rs.acceptanceSha256(root, 'register-loan'));
  // 返却は網羅している。文面だけを変える
  fs.writeFileSync(path.join(root, 'docs/requirements/requirements.yaml'), requirements().replace('返却できる', '返却日を記録して返却できる'));
  const s = scan(root);
  const ret = s.uncovered_done.find((u) => u.slug === 'register-return');
  assert.ok(ret, JSON.stringify(s.uncovered_done));
  assert.equal(ret.acceptance_changed, true);
  assert.deepEqual(ret.missing, []);
  assert.equal(ret.error, undefined);
});

test('0.1.35 R3: feature が無い main マージ済みの UC は error 付きで出す (黙って落とさない)', () => {
  const root = makeRepo();
  fs.rmSync(path.join(root, 'features/貸出業務/register-return.feature'));
  const ret = scan(root).uncovered_done.find((u) => u.slug === 'register-return');
  assert.equal(ret.error, 'feature が無い');
});

test('0.1.35 R3: reopen は run を archive へ移し (reports / traces は消す)、status を planned にし、reopened に出る。進行中の UC は拒む', () => {
  const root = makeRepo();
  execFileSync('git', ['branch', 'feature/register-return'], { cwd: root });
  assert.throws(() => rs.reopen(root, 'register-return'), /feature\/register-return がある/);
  const r = rs.reopen(root, 'register-loan', [{ spec: 'SPEC-003-03', n: 1 }]);
  assert.equal(r.previous_status, 'done');
  assert.equal(r.status, 'planned');
  assert.equal(fs.existsSync(rs.runDirOf(root, 'register-loan')), false);
  const dest = path.join(root, r.archived_to);
  assert.match(r.archived_to, /^\.distillery\/archive\/runs\/register-loan\/\d{8}_\d{6}$/);
  assert.ok(fs.existsSync(path.join(dest, 'events.jsonl')));
  assert.ok(fs.existsSync(path.join(dest, 'stages', 'deliver.done.yaml')));
  assert.equal(fs.existsSync(path.join(dest, 'reports')), false);
  assert.equal(fs.existsSync(path.join(dest, 'traces')), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dest, 'reopened.json'), 'utf8')).missing, [{ spec: 'SPEC-003-03', n: 1 }]);
  assert.deepEqual(rs.reopenedSlugs(root), ['register-loan']);
  const s = scan(root);
  assert.deepEqual(s.reopened, ['register-loan']);
  assert.deepEqual(s.uncovered_done, [], 'やり直し中は done でないので uncovered_done に出ない');
  assert.throws(() => rs.reopen(root, 'register-loan'), /run が無い/);
  // やり直しが main マージまで進めば、やり直し中ではない
  rs.markDone(rs.openRun(root, 'register-loan'), 'deliver', {});
  assert.deepEqual(rs.reopenedSlugs(root), []);
});

test('0.1.35 R21: uc-status はその UC の status の 1 行だけを書き換え、他の行と引用符を変えない', () => {
  const root = makeRepo();
  const f = path.join(root, 'docs/requirements/use-cases.yaml');
  const r = rs.setUcStatus(root, 'register-return', 'planned');
  assert.deepEqual(r, { slug: 'register-return', previous: '"done"', status: 'planned' });
  assert.equal(fs.readFileSync(f, 'utf8'), USE_CASES.replace('    status: "done"\n', '    status: planned\n'));
  assert.throws(() => rs.setUcStatus(root, 'no-such', 'done'), /0 件/);
  assert.throws(() => rs.setUcStatus(root, 'register-loan', 'Done!'), /不正/);
  const cli = spawnSync(process.execPath, [path.join(PLUGIN, 'd2-common/scripts/lib/runState.js'), 'uc-status', root, 'register-return', 'done'], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(fs.readFileSync(f, 'utf8'), /slug: register-return\n {4}spec_ids:\n {6}- SPEC-003-02\n {4}spec_ids_rejected: \[\]\n {4}status: done\n/);
});

test('0.1.35 R10: writeFileDet は basis 行だけの違いを同じとみなす (--check で古いと出さず、生成でも書き換えない)。中身の違いは今までどおり', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-basis-'));
  const f = path.join(dir, 'a.test.ts');
  const head = (sha) => `// generated by distillery2 — do not edit\n// basis: contracts@${sha}\n`;
  fs.writeFileSync(f, head('1111111') + 'body\n');
  let stale = []; let written = [];
  U.writeFileDet(f, head('2222222') + 'body\n', true, stale, written, 'a.test.ts');
  assert.deepEqual(stale, []);
  U.writeFileDet(f, head('2222222') + 'body\n', false, stale, written, 'a.test.ts');
  assert.deepEqual(written, []);
  assert.match(fs.readFileSync(f, 'utf8'), /contracts@1111111/);
  U.writeFileDet(f, head('2222222') + 'body2\n', true, stale, written, 'a.test.ts');
  assert.deepEqual(stale, ['a.test.ts']);
  U.writeFileDet(f, head('2222222') + 'body2\n', false, stale, written, 'a.test.ts');
  assert.deepEqual(written, ['a.test.ts']);
  assert.match(fs.readFileSync(f, 'utf8'), /contracts@2222222[\s\S]*body2/);
});

test('0.1.35 R3 (差分レビュー 1 ラウンド目): 文面だけが変わった UC は scan の記録を reopen に渡すと acceptance_changed が reopened.json に残る。git でない・status 行が無いときは run を移す前に拒む', () => {
  const root = makeRepo();
  fs.writeFileSync(path.join(root, 'docs/requirements/requirements.yaml'), requirements().replace('返却できる', '返却日を記録して返却できる'));
  const rec = scan(root).uncovered_done.find((u) => u.slug === 'register-return');
  const r = rs.reopen(root, 'register-return', rec);
  const saved = JSON.parse(fs.readFileSync(path.join(root, r.archived_to, 'reopened.json'), 'utf8'));
  assert.equal(saved.acceptance_changed, true);
  assert.deepEqual(saved.missing, []);
  // status 行の無い UC は run を移す前に拒む
  const f = path.join(root, 'docs/requirements/use-cases.yaml');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('    status: done\n', ''));
  assert.throws(() => rs.reopen(root, 'register-loan'), /status の行が 0 件/);
  assert.ok(fs.existsSync(path.join(rs.runDirOf(root, 'register-loan'), 'events.jsonl')), 'run は移していない');
  // git でないリポは拒む
  const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-nogit-'));
  rs.openRun(plain, 'x');
  assert.throws(() => rs.reopen(plain, 'x'), /git のリポジトリでない/);
});
