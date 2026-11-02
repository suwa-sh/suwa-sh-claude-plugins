#!/usr/bin/env node
'use strict';
// 偽の qlty (runGates の quality の判定のテスト用)。qlty 0.618.0 の実測の振る舞いを再現する:
//   指摘で落ちると exit 1、検査器そのものの失敗は exit 3 (SARIF には印が出ない)。--sarif のときは stdout に SARIF を出す。
//   --level <L> が --fail-level <L> と同じときだけ、L 以上に絞った SARIF (--sarif-file) を出す。
//   --level が無い・違うときは絞っていない SARIF (--sarif-unfiltered。osv と ripgrep の note) を出す (実測: --level を付けないと note も入る)
// 使い方: node fake-qlty.js --first <exit> --second <exit> --sarif-file <path> --sarif-unfiltered <path> [--fail-level medium] [--level medium] [--sarif]
//   --first は --sarif なしの呼び出しの終了コード、--second は --sarif ありの呼び出しの終了コード
const fs = require('node:fs');
const args = process.argv.slice(2);
const val = (k) => {
  const i = args.indexOf(k);
  if (i >= 0) return args[i + 1];
  const eq = args.find((a) => a.startsWith(`${k}=`));
  return eq ? eq.slice(k.length + 1) : null;
};
if (args.includes('--sarif')) {
  const filtered = val('--level') !== null && val('--level') === val('--fail-level');
  const f = filtered ? val('--sarif-file') : val('--sarif-unfiltered');
  process.stdout.write(f === 'broken' ? '{not json' : fs.readFileSync(f, 'utf8'));
  process.stderr.write('✖ issues\n');
  process.exit(Number(val('--second')));
}
process.stderr.write('✖ issues\n');
process.exit(Number(val('--first')));
