#!/usr/bin/env node
// reviewStep.js のテスト用の代役 (codex-review-job.sh と同じ start / status / result / cancel の口)。
// FAKE_MODE: done (2 回目の status で done) / stuck / nostart / badresult / emptyresult (形の崩れた結果) / locked (1 回目の start を別のジョブのロックで断る)。FAKE_LOG に呼ばれた口を 1 行ずつ追記する
'use strict';
const fs = require('node:fs');
const [cmd, a1, a2] = process.argv.slice(2);
const mode = process.env.FAKE_MODE || 'done';
const log = process.env.FAKE_LOG;
if (log) fs.appendFileSync(log, `${cmd} ${process.env.CODEX_REVIEW_TIMEOUT_SECONDS || ''}\n`);
const RESULT = `| # | 観点 | 判定 | 該当指摘 | 一言根拠 |
|---|------|------|---------|---------|
| P1 | 要望との縦の整合 | FAIL | 指摘 1 | 出し直しが無い |
| P2 | UC の抜け | CONCERN | 指摘 2 | 一覧が無い |
| P3 | USDM と RDRA の横の整合 | PASS | — | 照合した |
| P4 | 受入基準の確かめやすさ | PASS | — | 照合した |

### 指摘 1
- **perspective**: P1
- **severity**: high
- **claim**: 出し直しの UC が無い

### 指摘 2
- **perspective**: P2
- **severity**: medium
- **claim**: 自分の申請の一覧が無い

(3) below-threshold
なし
`;
if (cmd === 'start') {
  if (mode === 'nostart') { console.error('codex companion not installed'); process.exit(2); }
  const starts = log ? fs.readFileSync(log, 'utf8').split('\n').filter((l) => l.startsWith('start')).length : 1;
  if (mode === 'locked' && starts <= 1) { console.error('another Codex review job is active in this workspace: task-other'); process.exit(1); }
  console.log('task-fake-1');
} else if (cmd === 'status') {
  const n = log ? fs.readFileSync(log, 'utf8').split('\n').filter((l) => l.startsWith('status')).length : 2;
  const verdict = mode === 'stuck' ? 'healthy' : (n >= 2 ? 'done' : 'healthy');
  console.log(JSON.stringify({ job_id: a1, verdict }));
} else if (cmd === 'result') {
  if (mode === 'badresult') { console.error('output contract mismatch'); process.exit(1); }
  fs.writeFileSync(a2, mode === 'emptyresult' ? 'レビューできませんでした\n' : RESULT);
  console.log(a2);
} else if (cmd === 'cancel') {
  console.log('cancelled');
}
