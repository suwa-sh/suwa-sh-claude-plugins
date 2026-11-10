'use strict';
// 変更ファイルの一覧: 日本語のパスを引用符と八進数の文字列にせず、そのまま返す
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { changedFilesFromGit } = require('../../../plugins/distillery2/skills/d2-asbuilt/scripts/buildTraceIndex');

function git(cwd, args) {
  return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8' }).trim();
}

test('changedFilesFromGit は日本語のパスをそのまま返す', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2cf-'));
  git(dir, ['init', '-q']);
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '--no-verify', '-m', 'base']);
  const base = git(dir, ['rev-parse', 'HEAD']);
  fs.mkdirSync(path.join(dir, 'features', '会議室予約'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'features', '会議室予約', '予約 する.feature'), 'Feature: x\n');
  fs.writeFileSync(path.join(dir, 'b.txt'), 'b\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '--no-verify', '-m', 'change']);
  assert.deepEqual(changedFilesFromGit(dir, base).sort(), ['b.txt', 'features/会議室予約/予約 する.feature']);
  assert.equal(changedFilesFromGit(dir, null), null);
});
