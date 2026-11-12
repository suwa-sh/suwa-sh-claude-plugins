'use strict';

// mid-harness が生成する pre-tool-policy.sh の fixture テストを CI でも回す。
// 本体は scripts/test_hook.sh (fixture 名の deny-/allow- 接頭辞で期待 exit を決める)。
// サンプル hook は既定で素通りし、受け入れテスト用の番兵 (MID_HARNESS_HOOK_LOG があるときだけ) だけが拒否する。

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const runner = path.join(root, 'plugins/toolbox/skills/mid-harness/scripts/test_hook.sh');

test('pre-tool-policy.sh: 全 fixture が期待どおり deny / allow になる', () => {
  const r = spawnSync('bash', [runner], { encoding: 'utf8' });
  assert.equal(r.status, 0, `test_hook.sh failed:\n${r.stdout}\n${r.stderr}`);
  // 既定は素通り (取得即実行も、解釈できない入力も止めない)
  for (const p of ['claude', 'grok', 'copilot', 'copilot-string-args', 'cursor', 'agy']) {
    assert.match(r.stdout, new RegExp(`pass {2}allow-${p}-fetch-pipe-sh-passthrough `));
    // 番兵は 6 製品の入力形すべてで拒否され、拒否 JSON が出る
    assert.match(r.stdout, new RegExp(`pass {2}deny-${p}-sentinel-with-log `));
  }
  assert.match(r.stdout, /pass {2}allow-unparseable-passthrough /);
  assert.match(r.stdout, /pass {2}allow-sentinel-without-log /);
  assert.match(r.stdout, /pass {2}allow-edit-tool-sentinel-with-log /);
});
