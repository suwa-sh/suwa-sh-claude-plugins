'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const rs = require('../../../plugins/distillery2/scripts/lib/runState');
const { buildTrailers, render, strictProblems } = require('../../../plugins/distillery2/scripts/prTrailers');

function git(cwd, ...args) { return execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@x', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@x' } }).trim(); }

test('trailers are built from use-cases, gates.json, basis and events', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-trailers-'));
  git(repo, 'init', '-q');
  fs.mkdirSync(path.join(repo, 'docs/requirements'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'docs/adr'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'docs/requirements/use-cases.yaml'), ['use_cases:', '  - business: 貸出業務', '    buc: 書籍を貸し出すフロー', '    uc: 貸出を登録する', '    slug: register-loan', '    spec_ids: [SPEC-002]'].join('\n'));
  fs.writeFileSync(path.join(repo, 'docs/adr/0001-x.md'), '# x');
  git(repo, 'add', '.'); git(repo, 'commit', '-q', '-m', 'init');
  const sha = git(repo, 'rev-parse', 'HEAD');

  const run = rs.openRun(repo, 'register-loan');
  fs.writeFileSync(path.join(run, 'reports/gates.json'), JSON.stringify({ gates: [{ name: 'static', status: 'pass' }, { name: 'unit', status: 'pass' }] }));
  rs.appendEvent(run, 'review_approved', { assumption_decisions: [{ id: 'A-001', decision: 'confirmed' }, { id: 'A-002', decision: 'auto_confirmed' }] });
  rs.appendEvent(run, 'feedback_filed', { kind: 'rule', url: 'https://example/pr/1' });
  // 未起票の還流 (url なし / 空) は trailer に出さない
  rs.appendEvent(run, 'feedback_filed', { kind: 'rule', url: null });
  rs.appendEvent(run, 'feedback_filed', { kind: 'contract', url: '' });

  const t = buildTrailers({ cwd: repo, runDir: run });
  const text = render(t);
  assert.doesNotMatch(text, /Feedback: rule:null/);
  assert.doesNotMatch(text, /Feedback: contract:$/m);
  assert.equal((text.match(/^Feedback:/gm) || []).length, 1, 'url ありの 1 件だけ出す');
  assert.match(text, /^UC: 貸出業務\/書籍を貸し出すフロー\/貸出を登録する$/m);
  assert.match(text, /^UC-Slug: register-loan$/m);
  assert.match(text, new RegExp(`^Basis-Requirements: ${sha}$`, 'm'));
  assert.match(text, new RegExp(`^Basis-Adr: ${sha}$`, 'm'));
  assert.doesNotMatch(text, /Basis-Contracts/);
  assert.match(text, /^Gates: static=pass unit=pass$/m);
  assert.match(text, /^Assumptions: confirmed=1 auto=1 rejected=0$/m);
  assert.match(text, /^As-Built: docs\/as-built\/貸出業務\/貸出を登録する\/index.md$/m);
  assert.match(text, /^Feedback: rule:https:\/\/example\/pr\/1$/m);

  // strict: gates.json covers only 2 gates → not deliverable
  const problems = strictProblems(t, repo);
  assert.ok(problems.some(p => /must list contract exactly once \(found 0\)/.test(p)), problems.join(';'));
  assert.ok(problems.some(p => /As-Built file not found/.test(p)));
});

test('strict mode rejects missing UC / gates / approval', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-trailers-'));
  git(repo, 'init', '-q');
  const run = rs.openRun(repo, 'unknown-uc');
  const problems = strictProblems(buildTrailers({ cwd: repo, runDir: run }));
  for (const key of ['UC', 'Basis-Requirements', 'Gates', 'Assumptions', 'As-Built']) assert.ok(problems.includes(`missing ${key}`), key);
  fs.writeFileSync(path.join(run, 'reports/gates.json'), JSON.stringify({ gates: ['static', 'unit', 'contract', 'uc-bdd', 'acceptance'].map(name => ({ name, status: name === 'unit' ? 'fail' : 'pass' })) }));
  assert.ok(strictProblems(buildTrailers({ cwd: repo, runDir: run })).some(p => /Gates not all pass: unit=fail/.test(p)));
  // five "x=pass" entries are not five gates
  const fake = strictProblems([['Gates', 'x=pass x=pass x=pass x=pass x=pass']], repo);
  assert.ok(fake.some(p => /must list static exactly once/.test(p)) && fake.some(p => /unknown gate/.test(p)), fake.join(';'));
  // As-Built must exist on disk
  assert.ok(strictProblems([['As-Built', 'docs/as-built/x/y/index.md']], repo).some(p => /As-Built file not found/.test(p)));
  fs.mkdirSync(path.join(repo, 'docs/as-built/x/y'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'docs/as-built/x/y/index.md'), '# ok');
  assert.ok(!strictProblems([['As-Built', 'docs/as-built/x/y/index.md']], repo).some(p => /As-Built/.test(p)));
});
