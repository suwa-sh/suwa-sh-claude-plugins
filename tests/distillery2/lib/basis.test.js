'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const basis = require('../../../plugins/distillery2/scripts/lib/basis');

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
