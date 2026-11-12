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
  // 起動役・プロセス置換・ヒアドキュメントで迂回されない (2026-11-12 の push 後の指摘)
  assert.match(r.stdout, /pass {2}deny-busybox-wget-pipe-sh/);
  assert.match(r.stdout, /pass {2}deny-bash-stdin-procsub-curl/);
  assert.match(r.stdout, /pass {2}deny-curl-to-output-procsub-sh/);
  assert.match(r.stdout, /pass {2}deny-bash-heredoc-cmdsubst-curl/);
  assert.match(r.stdout, /pass {2}allow-cat-stdin-procsub-curl/);
  assert.match(r.stdout, /pass {2}allow-bash-heredoc-curl-to-file/);
  assert.match(r.stdout, /pass {2}deny-two-heredocs-pipe-bash-cmdsubst-curl/);
  assert.match(r.stdout, /pass {2}deny-bash-option-value-procsub-curl/);
  assert.match(r.stdout, /pass {2}deny-exec-fd-output-procsub-sh-then-curl/);
  assert.match(r.stdout, /pass {2}allow-exec-fd-output-procsub-tee-then-curl/);
  assert.match(r.stdout, /pass {2}deny-heredoc-trailing-pipe-next-line-bash/);
  assert.match(r.stdout, /pass {2}deny-source-procsub-curl/);
  assert.match(r.stdout, /pass {2}deny-bash-procsub-with-semicolon-then-procsub-curl/);
  assert.match(r.stdout, /pass {2}allow-find-dot-stdin-procsub-curl/);
  assert.match(r.stdout, /pass {2}deny-builtin-source-procsub-curl/);
  assert.match(r.stdout, /pass {2}deny-curl-pipe-source-dev-stdin/);
  assert.match(r.stdout, /pass {2}deny-source-dev-stdin-herestring-curl/);
  assert.match(r.stdout, /pass {2}allow-curl-pipe-grep-dot/);
});
