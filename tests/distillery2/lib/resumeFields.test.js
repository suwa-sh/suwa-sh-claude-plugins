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

test('file-drafts は戻し先と題名が同じ既存の下書き・その場で直した下書き・課題ファイルがあれば書かない (二重起票を防ぐ)', () => {
  const root = repo();
  const run = rs.openRun(root, 'book-room');
  fs.mkdirSync(path.join(root, 'docs/feedback'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/feedback/old.md'), '---\ntarget_step: decide\ntitle: 予約の重なり の扱い\n---\n');
  const h = { ...handoff, upstream_issues: [
    { ...handoff.upstream_issues[0], id: 'D1', title: '予約の重なりの扱い' },
    { ...handoff.upstream_issues[0], id: 'D2', title: '取り消しの期限' },
    { ...handoff.upstream_issues[0], id: 'D3', title: '取り消しの期限' },
    { ...handoff.upstream_issues[0], id: 'D4', title: '取り消しの期限', target_step: 'contract' },
  ] };
  const hf = path.join(run, 'handoff', 'tier-1.json');
  const r = H.fileDrafts(hf, h, { run });
  assert.deepEqual(r.duplicates.map((d) => d.id), ['D1', 'D3']);
  assert.equal(r.written.length, 2, '戻し先が違えば別の課題');
  const again = H.fileDrafts(path.join(run, 'handoff', 'tier-2.json'), { ...h, upstream_issues: [h.upstream_issues[1]] }, { run });
  assert.deepEqual(again.duplicates.map((d) => d.id), ['D2'], '同じ run の既存の下書きとも重ねない');
});

test('file-drafts --chain-from: 直している課題の chain を引き継ぎ chain_depth を 1 上げる。chain が無い課題は自分の名前が chain', () => {
  const root = repo();
  fs.mkdirSync(path.join(root, 'docs/feedback'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/feedback/parent.md'), '---\ntarget_step: decide\ntitle: 親\n---\n');
  const h = { ...handoff, step: 'decide', upstream_issues: [{ ...handoff.upstream_issues[0], title: '子' }] };
  const r1 = H.fileDrafts(path.join(root, '.distillery/handoff/decide-1.json'), h, { root, chainFrom: path.join(root, 'docs/feedback/parent.md') });
  const child = fs.readFileSync(r1.written[0], 'utf8');
  assert.match(child, /^chain: parent$/m);
  assert.match(child, /^chain_depth: 1$/m);
  const r2 = H.fileDrafts(path.join(root, '.distillery/handoff/decide-2.json'), { ...h, upstream_issues: [{ ...h.upstream_issues[0], title: '孫' }] }, { root, chainFrom: r1.written[0] });
  const grand = fs.readFileSync(r2.written[0], 'utf8');
  assert.match(grand, /^chain: parent$/m);
  assert.match(grand, /^chain_depth: 2$/m);
});

test('引き継ぎファイルに同じ問いが 2 つあれば不合格 (推奨で決める問いと人に返す問いの両方に同じ論点を出さない)', () => {
  const ask = { id: 'a1', kind: 'choice', question: '取り消しの期限', options: [{ label: '前日', impact: 'x' }, { label: '当日', impact: 'y' }], recommended: '前日', reason: 'r' };
  const errs = H.validate({ ...handoff, asks: [ask, { ...ask, id: 'a2', kind: 'unknown_fact', recommended: null, no_recommendation_reason: 'n', reason: undefined }] });
  assert.ok(errs.some((e) => /同じ問いが既にある/.test(e)), errs.join('\n'));
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
