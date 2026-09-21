'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { extractFeatures } = require('../lib/features');

const patternsFile = require('../patterns/patterns.json');
const REFERENCE_DOC = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'plugins',
  'distillery',
  'skills',
  'dist-architecture',
  'references',
  'arch-design-patterns.md',
);
const SAMPLE_DOCS = path.resolve(__dirname, '..', '..', '..', 'samples', 'distillery', 'pipeline');

// arch-design-patterns.md の ### 見出しのうち、個別パターンの見出しだけを数える。
// 「パターンの組み合わせ」節配下の5見出しは複数パターンの組み合わせであり、
// 単独のRDRA/NFRシグナルを持つ個別パターンではないため除外する（patterns.json の note 参照）。
function countIndividualPatternHeadings(text) {
  const lines = text.split('\n');
  let inCombinations = false;
  let count = 0;
  for (const line of lines) {
    if (line.startsWith('## ')) {
      inCombinations = line.includes('パターンの組み合わせ') || line.includes('アンチパターン');
      continue;
    }
    if (line.startsWith('### ') && !inCombinations) count++;
  }
  return count;
}

test('patterns.json: arch-design-patterns.md の個別パターン見出しと1対1に対応する', () => {
  const text = fs.readFileSync(REFERENCE_DOC, 'utf8');
  const headingCount = countIndividualPatternHeadings(text);
  assert.equal(patternsFile.patterns.length, headingCount);
  assert.equal(patternsFile.patterns.length, 30);
});

test('patterns.json: 必須フィールドが揃う', () => {
  for (const p of patternsFile.patterns) {
    assert.equal(typeof p.id, 'string');
    assert.equal(typeof p.name, 'string');
    assert.ok(Array.isArray(p.aliases), `${p.id}: aliases`);
    assert.ok(Array.isArray(p.weakAliases), `${p.id}: weakAliases`);
    // 少なくとも1つは別名（強い別名か、弱い別名）を持つ。retry/timeout のように
    // パターン名自体が一般語で、強い別名を持てない場合は弱い別名だけでもよい
    // （その場合は labels.js 上 applied にはならず ambiguous/not_applied どまりになる。意図どおり）
    assert.ok(p.aliases.length + p.weakAliases.length > 0, `${p.id}: needs at least one alias or weakAlias`);
    assert.equal(typeof p.group, 'string');
    assert.equal(typeof p.always, 'boolean');
    assert.ok(Array.isArray(p.numericGates), `${p.id}: numericGates`);
    assert.ok(Array.isArray(p.codeSignals), `${p.id}: codeSignals`);
    assert.ok(Array.isArray(p.excludeCodeSignals), `${p.id}: excludeCodeSignals`);
    assert.ok(Array.isArray(p.questions), `${p.id}: questions`);
    assert.ok(Array.isArray(p.excludeQuestions), `${p.id}: excludeQuestions`);
    assert.ok(Array.isArray(p.slices), `${p.id}: slices`);
    assert.ok(['all', 'any'].includes(p.combine), `${p.id}: combine`);
    assert.equal(typeof p.source, 'string');
    if (!p.always) {
      assert.ok(
        p.questions.length > 0 || p.numericGates.length > 0 || p.codeSignals.length > 0,
        `${p.id}: needs questions, numericGates or codeSignals`,
      );
    }
    for (const q of [...p.questions, ...p.excludeQuestions]) {
      assert.equal(typeof q.key, 'string');
      assert.equal(typeof q.en, 'string');
      assert.equal(typeof q.ja, 'string');
    }
    for (const cs of [...p.codeSignals, ...p.excludeCodeSignals]) {
      assert.equal(typeof cs.key, 'string');
      assert.equal(typeof cs.feature, 'string');
      assert.equal(typeof cs.op, 'string');
      assert.equal(typeof cs.value, 'number');
    }
  }
});

test('レビュー指摘1（2ラウンド目の点検）: codeSignal 単独で適用/非適用を確定させてよいパターンの combine を固定する', () => {
  const byId = (id) => patternsFile.patterns.find((p) => p.id === id);
  // event-sourcing: 根拠「状態遷移が多く（8種以上）、変更履歴の完全な追跡が必要」は連言（AND）であり、
  // 「8種以上」単独では適用を確定してはいけないため combine: all にした
  assert.equal(byId('event-sourcing').combine, 'all');
  // 以下は根拠が「。」区切りの独立した並列シグナルであり、件数条件単独で確定してよいため any のまま
  assert.equal(byId('bulkhead').combine, 'any');
  assert.equal(byId('rate-limiting-throttling').combine, 'any');
  assert.equal(byId('federated-identity').combine, 'any');
  assert.equal(byId('gatekeeper-gateway-offloading').combine, 'any');
  // backends-for-frontends は「アクター種別3以上でUI要件が大きく異なる」という連言のため all（team-lead が修正済み）
  assert.equal(byId('backends-for-frontends').combine, 'all');
});

test('レビュー指摘4: valet-key のみ questions を2問に分割し combine: all にする。saga/cqrs/priority-queue は分割しない', () => {
  const byId = (id) => patternsFile.patterns.find((p) => p.id === id);
  assert.equal(byId('valet-key').questions.length, 2);
  assert.equal(byId('valet-key').combine, 'all');
  assert.equal(byId('saga').questions.length, 1);
  assert.equal(byId('cqrs').questions.length, 1);
  assert.equal(byId('priority-queue').questions.length, 1);
});

test('レビュー指摘2: 独立した適用すべきでない場合を分割した箇所は excludeQuestions が2問以上ある', () => {
  const byId = (id) => patternsFile.patterns.find((p) => p.id === id);
  for (const id of ['publisher-subscriber', 'backends-for-frontends', 'sidecar', 'deployment-stamps']) {
    assert.ok(byId(id).excludeQuestions.length >= 2, `${id}: expected split excludeQuestions`);
  }
  // materialized-view はもともと2条件に分割していたが、片方（リアルタイム性が最優先の場合）は
  // NFR相当の情報でstateに無いため未モデル化として除去した（レビュー指摘A）。残りは1問
  assert.equal(byId('materialized-view').excludeQuestions.length, 1);
  // bulkhead は数値条件なので Jev に聞かず excludeCodeSignals で判定する
  assert.equal(byId('bulkhead').excludeCodeSignals.length, 1);
});

test('patterns.json: aliases と weakAliases は重複しない', () => {
  for (const p of patternsFile.patterns) {
    for (const w of p.weakAliases) {
      assert.ok(!p.aliases.includes(w), `${p.id}: ${w} is in both aliases and weakAliases`);
    }
  }
});

test('レビュー指摘3: questions/excludeQuestions の en/ja が参照するバッククォート付きキーは slices に含まれる', () => {
  const backtickRe = /`([a-zA-Z]+)`/g;
  for (const p of patternsFile.patterns) {
    const allowed = new Set(p.slices);
    for (const q of [...p.questions, ...p.excludeQuestions]) {
      for (const lang of ['en', 'ja']) {
        let m;
        const rr = new RegExp(backtickRe);
        while ((m = rr.exec(q[lang]))) {
          assert.ok(allowed.has(m[1]), `${p.id}.${q.key} (${lang}) references \`${m[1]}\` not declared in slices: ${p.slices}`);
        }
      }
    }
  }
});

test('patterns.json: id が重複しない', () => {
  const ids = patternsFile.patterns.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('patterns.json: nfr.* の ID は見本の nfr-grade.yaml に実在する（numericGates と codeSignals の両方）', () => {
  const features = extractFeatures(SAMPLE_DOCS);
  for (const p of patternsFile.patterns) {
    for (const gate of [...p.numericGates, ...p.codeSignals]) {
      if (!gate.feature.startsWith('nfr.')) continue;
      const id = gate.feature.slice('nfr.'.length);
      assert.ok(Object.hasOwn(features.nfr, id), `${p.id}: nfr id not found in sample: ${id}`);
    }
  }
});

test('レビュー指摘1: numericGates に残るのは (a) counts.externalSystems>=1 か (b) 明示NFR閾値だけ', () => {
  const ALLOWED_B_GATES = new Set(['nfr.A.2.1.1', 'nfr.B.1.1.1', 'nfr.B.1.1.2', 'nfr.A.3.1.1']);
  for (const p of patternsFile.patterns) {
    for (const gate of p.numericGates) {
      const isTypeA = gate.feature === 'counts.externalSystems' && gate.op === '>=' && gate.value === 1;
      const isTypeB = ALLOWED_B_GATES.has(gate.feature);
      assert.ok(isTypeA || isTypeB, `${p.id}: numericGate ${gate.feature} is neither type(a) nor type(b)`);
    }
  }
});

test('レビュー指摘A（3ラウンド目）: state に判断材料が無い除外質問を除去した箇所が復活していない', () => {
  const byId = (id) => patternsFile.patterns.find((p) => p.id === id);
  const removedKeys = {
    'claim-check': 'excl_always_small',
    'valet-key': 'excl_small_files_ok',
    bulkhead: 'excl_cost_not_worth',
    'gatekeeper-gateway-offloading': 'excl_single_backend',
    'external-configuration-store': 'excl_env_vars_enough',
    'materialized-view': 'excl_realtime_priority',
    'strangler-fig': 'excl_small_full_replace_ok',
  };
  for (const [id, key] of Object.entries(removedKeys)) {
    assert.ok(!byId(id).excludeQuestions.some((q) => q.key === key), `${id}: ${key} should have been removed`);
  }
});

test('レビュー指摘B（3ラウンド目）: 除外質問は否定形（不在の判定）ではなく肯定形にする', () => {
  const NEGATIVE_PATTERNS = [/\bshows? no\b/i, /\bwithout any\b/i];
  for (const p of patternsFile.patterns) {
    for (const q of p.excludeQuestions) {
      for (const re of NEGATIVE_PATTERNS) {
        assert.ok(!re.test(q.en), `${p.id}.${q.key}: negative/absence phrasing found: ${q.en}`);
      }
    }
  }
  const byId = (id) => patternsFile.patterns.find((p) => p.id === id);
  assert.match(byId('deployment-stamps').excludeQuestions[0].en, /explicitly state/);
  assert.match(byId('deployment-stamps').excludeQuestions[1].en, /explicitly state/);
  assert.match(byId('static-content-hosting').excludeQuestions[0].en, /explicitly consist/);
});

test('patterns.json: group は既知の6グループのいずれか', () => {
  const knownGroups = ['external-integration', 'data', 'messaging', 'security', 'structure', 'operations'];
  for (const p of patternsFile.patterns) {
    assert.ok(knownGroups.includes(p.group), `${p.id}: unknown group ${p.group}`);
  }
});
