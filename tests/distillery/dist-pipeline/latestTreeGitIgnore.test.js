'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const { loadCatalog, snapshotDomainEventRoots } = require('../../../plugins/distillery/skills/dist-pipeline/scripts/planFeedbackRequest');

// latest tree の hash から worktree 内 .gitignore 該当 entry（ビルド成果物）を除外する。
// clean checkout と実行時 workspace で basis が一致しないと verifier が
// 「observed domain root changed without an appended event directory」で fail するため（1.9.4）。

function git(cwd, ...args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function seedDesignLatest(artifactRoot, { withIgnored }) {
  const latest = path.join(artifactRoot, 'design', 'latest');
  fs.mkdirSync(path.join(artifactRoot, 'design', 'events', '20260101_000000_design_system'), { recursive: true });
  fs.writeFileSync(path.join(artifactRoot, 'design', 'events', '20260101_000000_design_system', 'design-event.yaml'), 'event: 1\n');
  fs.mkdirSync(path.join(latest, 'storybook-app', 'src'), { recursive: true });
  fs.writeFileSync(path.join(latest, 'design-event.yaml'), 'event: 1\n');
  fs.writeFileSync(path.join(latest, 'storybook-app', 'src', 'index.ts'), 'export {};\n');
  if (withIgnored) {
    fs.mkdirSync(path.join(latest, 'storybook-app', 'storybook-static'), { recursive: true });
    fs.writeFileSync(path.join(latest, 'storybook-app', 'storybook-static', 'iframe.html'), '<html></html>\n');
    fs.mkdirSync(path.join(latest, 'storybook-app', 'node_modules', '.bin'), { recursive: true });
    fs.writeFileSync(path.join(latest, 'storybook-app', 'node_modules', 'pkg.js'), 'module.exports = 1;\n');
    fs.symlinkSync('../pkg.js', path.join(latest, 'storybook-app', 'node_modules', '.bin', 'pkg'));
    fs.writeFileSync(path.join(latest, 'storybook-app', 'debug-storybook.log'), 'log\n');
    // 先頭が ".." でも親ディレクトリ脱出ではない正当な名前（指摘 3 の回帰）
    fs.mkdirSync(path.join(latest, 'storybook-app', '..cache'), { recursive: true });
    fs.writeFileSync(path.join(latest, 'storybook-app', '..cache', 'entry'), 'cache\n');
  }
  return latest;
}

function makeGitWorktree() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'latest-tree-gitignore-'));
  git(repo, 'init', '-q');
  git(repo, 'config', 'user.email', 'test@example.com');
  git(repo, 'config', 'user.name', 'test');
  fs.writeFileSync(path.join(repo, '.gitignore'), 'node_modules/\nstorybook-static\n*storybook.log\n..cache/\n');
  // artifact root は repo の subdirectory（samples/distillery/pipeline のような配置）
  const artifactRoot = path.join(repo, 'samples', 'pipeline');
  fs.mkdirSync(artifactRoot, { recursive: true });
  return { repo, artifactRoot };
}

function commitAll(repo) {
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'seed');
}

test('latest tree hash ignores worktree .gitignore entries (including symlinks inside ignored directories)', () => {
  const clean = makeGitWorktree();
  const dirty = makeGitWorktree();
  try {
    seedDesignLatest(clean.artifactRoot, { withIgnored: false });
    seedDesignLatest(dirty.artifactRoot, { withIgnored: true });
    commitAll(clean.repo);
    commitAll(dirty.repo);
    const catalog = loadCatalog().value;
    const cleanSnapshot = snapshotDomainEventRoots(clean.artifactRoot, catalog)['design/events'];
    const dirtySnapshot = snapshotDomainEventRoots(dirty.artifactRoot, catalog)['design/events'];
    assert.match(cleanSnapshot.latest_tree_sha256, /^[0-9a-f]{64}$/);
    assert.equal(dirtySnapshot.latest_tree_sha256, cleanSnapshot.latest_tree_sha256);
    assert.equal(dirtySnapshot.head_event_sha256, cleanSnapshot.head_event_sha256);
  } finally {
    fs.rmSync(clean.repo, { recursive: true, force: true });
    fs.rmSync(dirty.repo, { recursive: true, force: true });
  }
});

test('user-global excludes do not affect the hash (only worktree .gitignore files are honored)', () => {
  const base = makeGitWorktree();
  const excludesFile = path.join(base.repo, 'global-excludes');
  try {
    seedDesignLatest(base.artifactRoot, { withIgnored: false });
    commitAll(base.repo);
    fs.writeFileSync(path.join(base.artifactRoot, 'design', 'latest', 'untracked.yaml'), 'untracked: true\n');
    const catalog = loadCatalog().value;
    const before = snapshotDomainEventRoots(base.artifactRoot, catalog)['design/events'].latest_tree_sha256;
    fs.writeFileSync(excludesFile, '*.yaml\n');
    git(base.repo, 'config', 'core.excludesFile', excludesFile);
    const after = snapshotDomainEventRoots(base.artifactRoot, catalog)['design/events'].latest_tree_sha256;
    assert.equal(after, before);
  } finally {
    fs.rmSync(base.repo, { recursive: true, force: true });
  }
});

test('tracked file changes and untracked non-ignored files both change the hash', () => {
  const base = makeGitWorktree();
  const tracked = makeGitWorktree();
  const untracked = makeGitWorktree();
  try {
    for (const w of [base, tracked, untracked]) {
      seedDesignLatest(w.artifactRoot, { withIgnored: true });
      commitAll(w.repo);
      assert.equal(git(w.repo, 'ls-files', '--error-unmatch', 'samples/pipeline/design/latest/storybook-app/src/index.ts').trim().length > 0, true);
    }
    fs.writeFileSync(path.join(tracked.artifactRoot, 'design', 'latest', 'storybook-app', 'src', 'index.ts'), 'export const changed = true;\n');
    fs.writeFileSync(path.join(untracked.artifactRoot, 'design', 'latest', 'storybook-app', 'src', 'extra.ts'), 'export {};\n');
    const catalog = loadCatalog().value;
    const baseHash = snapshotDomainEventRoots(base.artifactRoot, catalog)['design/events'].latest_tree_sha256;
    const trackedHash = snapshotDomainEventRoots(tracked.artifactRoot, catalog)['design/events'].latest_tree_sha256;
    const untrackedHash = snapshotDomainEventRoots(untracked.artifactRoot, catalog)['design/events'].latest_tree_sha256;
    assert.notEqual(trackedHash, baseHash);
    assert.notEqual(untrackedHash, baseHash);
    assert.notEqual(untrackedHash, trackedHash);
  } finally {
    for (const w of [base, tracked, untracked]) fs.rmSync(w.repo, { recursive: true, force: true });
  }
});

test('outside a Git worktree every entry is hashed and symlinks are still rejected', () => {
  const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'latest-tree-nogit-'));
  try {
    seedDesignLatest(artifactRoot, { withIgnored: true });
    const catalog = loadCatalog().value;
    assert.throws(
      () => snapshotDomainEventRoots(artifactRoot, catalog),
      /domain latest tree must not contain symlinks: design\/events\/storybook-app\/node_modules\/\.bin\/pkg/,
    );
    fs.rmSync(path.join(artifactRoot, 'design', 'latest', 'storybook-app', 'node_modules'), { recursive: true, force: true });
    const withArtifacts = snapshotDomainEventRoots(artifactRoot, catalog)['design/events'].latest_tree_sha256;
    fs.rmSync(path.join(artifactRoot, 'design', 'latest', 'storybook-app', 'storybook-static'), { recursive: true, force: true });
    const withoutArtifacts = snapshotDomainEventRoots(artifactRoot, catalog)['design/events'].latest_tree_sha256;
    assert.notEqual(withArtifacts, withoutArtifacts);
  } finally {
    fs.rmSync(artifactRoot, { recursive: true, force: true });
  }
});
