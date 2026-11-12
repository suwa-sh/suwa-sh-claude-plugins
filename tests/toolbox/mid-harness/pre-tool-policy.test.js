'use strict';

// mid-harness が生成する pre-tool-policy.sh の fixture テストを CI でも回す。
// 本体は scripts/test_hook.sh (fixture 名の deny-/allow- 接頭辞で期待 exit を決める)。

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const runner = path.join(root, 'plugins/toolbox/skills/mid-harness/scripts/test_hook.sh');

test('pre-tool-policy.sh: 全 fixture が期待どおり deny / allow になる', () => {
  const r = spawnSync('bash', [runner], { encoding: 'utf8' });
  assert.equal(r.status, 0, `test_hook.sh failed:\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /pass {2}deny-curl-pipe-cat-sh/);
  assert.match(r.stdout, /pass {2}deny-curl-newline-pipe-sh/);
  assert.match(r.stdout, /pass {2}allow-curl-then-python-c/);
  // -c の文字列・引用符の中の改行・グループで迂回されない (2026-11-12 の指摘)
  assert.match(r.stdout, /pass {2}deny-sh-c-string-curl-pipe-sh/);
  assert.match(r.stdout, /pass {2}deny-curl-pipe-quoted-newline-arg-sh/);
  assert.match(r.stdout, /pass {2}deny-curl-pipe-brace-group-sh/);
  assert.match(r.stdout, /pass {2}allow-echo-string-with-pipe-sh/);
});
