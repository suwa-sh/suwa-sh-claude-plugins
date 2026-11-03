'use strict';
// 0.3.0: 課題の resume_from (写し直した後に続ける段) と chain / chain_depth (上流の直しの連鎖) が、引き継ぎ → 下書き → 課題ファイル → scan まで運ばれる
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PLUGIN = path.resolve(__dirname, '../../../plugins/distillery2/skills');
const H = require(path.join(PLUGIN, 'd2-common/scripts/handoff'));
const FB = require(path.join(PLUGIN, 'd2-common/scripts/feedbackBatch'));
const rs = require(path.join(PLUGIN, 'd2-common/scripts/lib/runState'));

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-fields-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  return root;
}

const handoff = {
  schema_version: 'distillery2.handoff/v1', step: 'tier', asks: [],
  upstream_issues: [{ id: 'U1', target_step: 'decide', title: '予約の重なりの扱い', detail: 'd', evidence: 'e', recommended_fix: 'f', resume_from: 'contract' }],
};

test('引き継ぎの resume_from は schema を通り、下書き → 課題ファイル → scan の resume_from まで運ばれる', () => {
  assert.deepEqual(H.validate(handoff), []);
  assert.ok(H.validate({ ...handoff, upstream_issues: [{ ...handoff.upstream_issues[0], resume_from: 'verify' }] }).length > 0, '続ける段は scenario / contract / implementation だけ');
  const root = repo();
  const run = rs.openRun(root, 'book-room');
  const hf = path.join(run, 'handoff', 'tier-backend-1.json');
  fs.mkdirSync(path.dirname(hf), { recursive: true });
  fs.writeFileSync(hf, JSON.stringify(handoff));
  const { written } = H.fileDrafts(hf, handoff, { run });
  assert.match(fs.readFileSync(written[0], 'utf8'), /^resume_from: contract$/m);
  const { spawnSync } = require('node:child_process');
  const r = spawnSync(process.execPath, [path.join(PLUGIN, 'd2-common/scripts/feedbackBatch.js'), 'file-issues', run, '--cwd', root], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const id = path.basename(written[0], '.md');
  assert.match(fs.readFileSync(path.join(root, 'docs/feedback', `${id}.md`), 'utf8'), /^resume_from: contract$/m);
  const scan = FB.cmdScan(root);
  assert.equal(scan.resume_from[id], 'contract');
  assert.deepEqual(scan.upstream.decide, [id]);
  assert.deepEqual(scan.limit_reached, []);
});

test('上流の直しの連鎖: chain_depth が上限 (3) を超えた課題は upstream に入れず limit_reached に出す。chain が無い課題は自分の id が chain', () => {
  const root = repo();
  const w = (id, fm) => { fs.mkdirSync(path.join(root, 'docs/feedback'), { recursive: true }); fs.writeFileSync(path.join(root, 'docs/feedback', `${id}.md`), `---\n${fm}\n---\n本文\n`); };
  w('a', 'target_step: decide\nchain: a0\nchain_depth: 3');
  w('b', 'target_step: foundation\nchain: a0\nchain_depth: 4');
  w('c', 'target_step: decide');
  const scan = FB.cmdScan(root);
  assert.deepEqual(scan.limit_reached, [{ chain: 'a0', depth: 4, issues: ['b'] }]);
  assert.deepEqual(scan.upstream.decide, ['c'], '上限を超えた連鎖の課題 (同じ連鎖の a も) は選ばない');
  assert.deepEqual(scan.upstream.foundation, []);
  assert.equal(scan.chain_limit, 3);
});
