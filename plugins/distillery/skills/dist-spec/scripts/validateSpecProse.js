#!/usr/bin/env node
'use strict';
// A narrow prose lint, not a semantic or implementation-readiness validator.
const fs = require('node:fs');
const path = require('node:path');
const rules = [
  ['workflow-status', /needs-spec-change|@blocked|生成結果は|生成時判定/u, '生成状態はレビュー記録へ移す'],
  ['request-id', /\bCR-?[0-9a-f]{8}-\d{3}\b|\bCR\d{3}\b/u, '提案との対応はproposal-baselineへ移す'],
  ['editorial-direction', /ここ(?:に|へ|では).*(?:書かない|記載しない|再掲しない)|(?:本文|状態表|型表).*(?:転記しない|複写しない|再掲しない)/u, '参照先を示し、編集方針は本文外へ移す'],
  ['skill-operation', /スキルの(?:手順|指示|規約)|latestへ(?:は)?昇格|Step\s*\d+(?:で|の).*生成/u, 'スキルの運用情報は本文外へ移す'],
];
function inspect(text, file = '') {
  const findings = [];
  text.split(/\r?\n/).forEach((line, i) => {
    for (const [rule, pattern, message] of rules) if (pattern.test(line)) findings.push({ file, line: i + 1, rule, message });
  });
  return findings;
}
function run(ucDir) {
  const root = path.resolve(ucDir);
  const names = fs.readdirSync(root).filter(n => n === 'spec.md' || /^tier-[^/]+\.md$/.test(n));
  if (!names.includes('spec.md')) throw new Error('UC directory must contain spec.md');
  return names.sort().flatMap(n => inspect(fs.readFileSync(path.join(root, n), 'utf8'), n));
}
module.exports = { inspect, run };
if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node validateSpecProse.js <UC-directory>');
    const findings = run(process.argv[2]);
    console.log(JSON.stringify({ status: findings.length ? 'fail' : 'pass', findings }, null, 2));
    process.exitCode = findings.length ? 1 : 0;
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
