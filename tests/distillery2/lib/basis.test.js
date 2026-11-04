'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const basis = require('../../../plugins/distillery2/skills/d2-common/scripts/lib/basis');

function git(cwd, ...args) { return execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@x', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@x' } }).trim(); }

test('stamp / headerLine / parseHeader / check', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-basis-'));
  git(repo, 'init', '-q');
  fs.mkdirSync(path.join(repo, 'docs/requirements'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'docs/requirements/r.md'), 'a');
  git(repo, 'add', '.'); git(repo, 'commit', '-q', '-m', 'one');
  const sha1 = git(repo, 'rev-parse', 'HEAD');

  const stamped = basis.stamp({ requirements: 'docs/requirements', adr: 'docs/adr' }, repo);
  assert.equal(stamped.requirements, sha1);
  assert.equal(stamped.adr, null);
  const line = basis.headerLine(stamped);
  assert.equal(line, `basis: requirements@${sha1}`);
  assert.deepEqual(basis.parseHeader(`# generated\n# ${line}\nbody`), { requirements: sha1 });
  assert.equal(basis.parseHeader('no header'), null);
  assert.deepEqual(basis.parseHeader(`---\nbasis: "${line.slice(7)}"\n---\n`), { requirements: sha1 }, '引用符付き (ADR の front matter の形) も読む (0.1.29)');
  assert.deepEqual(basis.parseHeader(`basis: '${line.slice(7)} adr@${sha1}'`), { requirements: sha1, adr: sha1 });

  const artifact = path.join(repo, 'out.md');
  fs.writeFileSync(artifact, `---\n${line}\n---\n`);
  let r = basis.check(artifact, { requirements: 'docs/requirements' }, repo);
  assert.equal(r.entries[0].stale, false);

  fs.writeFileSync(path.join(repo, 'docs/requirements/r.md'), 'b');
  git(repo, 'commit', '-q', '-am', 'two');
  r = basis.check(artifact, { requirements: 'docs/requirements' }, repo);
  assert.equal(r.entries[0].stale, true);
  assert.equal(basis.check(path.join(repo, 'docs/requirements/r.md'), {}, repo).missing, true);
});

test('0.3.0: 要求の basis は use-cases.yaml の書き換え (main マージの status) だけでは進まない。ほかの要求の変更では進む', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-basis-'));
  git(repo, 'init', '-q');
  fs.mkdirSync(path.join(repo, 'docs/requirements'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'docs/requirements/requirements.yaml'), 'a');
  fs.writeFileSync(path.join(repo, 'docs/requirements/use-cases.yaml'), 'status: planned\n');
  git(repo, 'add', '.'); git(repo, 'commit', '-q', '-m', 'req');
  const sha1 = git(repo, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(repo, 'docs/requirements/use-cases.yaml'), 'status: done\n');
  git(repo, 'add', '.'); git(repo, 'commit', '-q', '-m', 'delivered');
  assert.equal(basis.stamp({ requirements: 'docs/requirements' }, repo).requirements, sha1);
  fs.writeFileSync(path.join(repo, 'docs/requirements/requirements.yaml'), 'b');
  git(repo, 'add', '.'); git(repo, 'commit', '-q', '-m', 'req2');
  assert.equal(basis.stamp({ requirements: 'docs/requirements' }, repo).requirements, git(repo, 'rev-parse', 'HEAD'));
  assert.equal(basis.stamp({ adr: 'docs/requirements' }, repo).adr, git(repo, 'rev-parse', 'HEAD'), '外すのは要求の basis だけ');
});

test('0.3.0: ADR の basis は architecture.md・index.md (ADR から作る生成物) の書き換えだけでは進まない', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-basis-'));
  git(repo, 'init', '-q');
  fs.mkdirSync(path.join(repo, 'docs/adr'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'docs/adr/0001-x.md'), 'a');
  git(repo, 'add', '.'); git(repo, 'commit', '-q', '-m', 'adr');
  const sha1 = git(repo, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(repo, 'docs/adr/architecture.md'), 'c4');
  fs.writeFileSync(path.join(repo, 'docs/adr/index.md'), 'idx');
  git(repo, 'add', '.'); git(repo, 'commit', '-q', '-m', 'foundation finish');
  assert.equal(basis.stamp({ adr: 'docs/adr' }, repo).adr, sha1);
  fs.writeFileSync(path.join(repo, 'docs/adr/0002-y.md'), 'b');
  git(repo, 'add', '.'); git(repo, 'commit', '-q', '-m', 'adr2');
  assert.equal(basis.stamp({ adr: 'docs/adr' }, repo).adr, git(repo, 'rev-parse', 'HEAD'));
});
