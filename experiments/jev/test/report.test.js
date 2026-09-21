'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  band,
  median,
  analyzePatterns,
  analyzeModelTypes,
  expectedFromLabel,
  combineSupport,
  combineExclude,
  resolveVerdict,
  validateThresholds,
  parseArgs,
} = require('../report.js');

test('band: hi 以上ははい、lo 以下はいいえ、それ以外は保留', () => {
  assert.equal(band(0.9, 0.8, 0.2), 'yes');
  assert.equal(band(0.8, 0.8, 0.2), 'yes');
  assert.equal(band(0.1, 0.8, 0.2), 'no');
  assert.equal(band(0.2, 0.8, 0.2), 'no');
  assert.equal(band(0.5, 0.8, 0.2), 'pending');
  assert.equal(band(undefined, 0.8, 0.2), 'pending');
});

test('band: 数値でない回答（欠落・非数値）も保留にする（レビュー指摘5）', () => {
  assert.equal(band(undefined, 0.8, 0.2), 'pending');
  assert.equal(band(null, 0.8, 0.2), 'pending');
  assert.equal(band('yes', 0.8, 0.2), 'pending');
  assert.equal(band(NaN, 0.8, 0.2), 'pending');
});

test('レビュー指摘6: 3値論理 combine=any は yes が1つでもあれば yes、全て no なら no、それ以外 pending', () => {
  assert.equal(combineSupport(['yes', 'pending'], 'any'), 'yes');
  assert.equal(combineSupport(['no', 'no'], 'any'), 'no');
  assert.equal(combineSupport(['no', 'pending'], 'any'), 'pending');
});

test('レビュー指摘6: 3値論理 combine=all は no が1つでもあれば no、全て yes なら yes、それ以外 pending', () => {
  assert.equal(combineSupport(['no', 'pending'], 'all'), 'no');
  assert.equal(combineSupport(['yes', 'yes'], 'all'), 'yes');
  assert.equal(combineSupport(['yes', 'pending'], 'all'), 'pending');
});

test('レビュー指摘6: 除外側は常に OR。除外条件が無ければ no（除外されない）で確定する', () => {
  assert.equal(combineExclude(['yes', 'no']), 'yes');
  assert.equal(combineExclude(['no', 'no']), 'no');
  assert.equal(combineExclude(['no', 'pending']), 'pending');
  assert.equal(combineExclude([]), 'no');
});

test('レビュー指摘6: resolveVerdict の結論テーブル', () => {
  // any で1つ yes + 1つ pending + 除外 no → 適用
  assert.deepEqual(resolveVerdict(combineSupport(['yes', 'pending'], 'any'), combineExclude(['no'])), {
    applied: true,
    pending: false,
  });
  // all で1つ no + 1つ pending → 非適用（除外を問わず支持側 no で決まる）
  assert.deepEqual(resolveVerdict(combineSupport(['no', 'pending'], 'all'), combineExclude([])), {
    applied: false,
    pending: false,
  });
  // 支持 yes + 除外 pending → 保留
  assert.deepEqual(resolveVerdict('yes', 'pending'), { applied: null, pending: true });
  // 支持 no は除外側の状態によらず非適用
  assert.deepEqual(resolveVerdict('no', 'pending'), { applied: false, pending: false });
});

test('レビュー指摘8: validateThresholds は有限の数・0<=lo<hi<=1 を検証する', () => {
  assert.equal(validateThresholds(0.8, 0.2).ok, true);
  assert.equal(validateThresholds(0.8, 0.8).ok, false); // lo < hi でない
  assert.equal(validateThresholds(1.5, 0.2).ok, false); // hi > 1
  assert.equal(validateThresholds(0.8, -0.1).ok, false); // lo < 0
  assert.equal(validateThresholds(NaN, 0.2).ok, false); // 欠落（Number(undefined)）
  assert.equal(validateThresholds(0.8, NaN).ok, false);
  assert.equal(validateThresholds(Infinity, 0.2).ok, false);
});

test('レビュー指摘8: --hi/--lo の値が欠落すると Number() が NaN になり検証で弾かれる', () => {
  const { hi, lo } = parseArgs(['file.json', '--hi']); // 値が無い
  assert.ok(Number.isNaN(hi));
  assert.equal(validateThresholds(hi, lo).ok, false);
});

test('median: 偶数・奇数の両方で正しい', () => {
  assert.equal(median([1, 2, 3]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
});

test('expectedFromLabel: applied/not_applied/ambiguous を変換する', () => {
  assert.equal(expectedFromLabel({ label: 'applied' }), true);
  assert.equal(expectedFromLabel({ label: 'not_applied' }), false);
  assert.equal(expectedFromLabel({ label: 'ambiguous' }), null);
  assert.equal(expectedFromLabel(undefined), false);
});

test('analyzePatterns: 固定の結果から一致率・保留率が手計算と一致する（ambiguous を除外する。レビュー指摘4）', () => {
  const patternsList = [
    {
      id: 'p-always',
      always: true,
      numericGates: [],
      codeSignals: [],
      questions: [],
      excludeQuestions: [],
      combine: 'all',
    },
    {
      id: 'p-gate-fail',
      always: false,
      numericGates: [{ feature: 'counts.x', op: '>=', value: 99 }],
      codeSignals: [],
      questions: [{ key: 'q1', en: 'q1?', ja: 'q1?' }],
      excludeQuestions: [],
      combine: 'all',
    },
    {
      id: 'p-jev-match',
      always: false,
      numericGates: [],
      codeSignals: [],
      questions: [{ key: 'q1', en: 'q1?', ja: 'q1?' }],
      excludeQuestions: [],
      combine: 'all',
    },
    {
      id: 'p-jev-mismatch',
      always: false,
      numericGates: [],
      codeSignals: [],
      questions: [{ key: 'q1', en: 'q1?', ja: 'q1?' }],
      excludeQuestions: [],
      combine: 'all',
    },
    {
      id: 'p-jev-pending',
      always: false,
      numericGates: [],
      codeSignals: [],
      questions: [{ key: 'q1', en: 'q1?', ja: 'q1?' }],
      excludeQuestions: [],
      combine: 'all',
    },
    {
      id: 'p-jev-ambiguous',
      always: false,
      numericGates: [],
      codeSignals: [],
      questions: [{ key: 'q1', en: 'q1?', ja: 'q1?' }],
      excludeQuestions: [],
      combine: 'all',
    },
  ];

  const result = {
    codeDecided: {
      'p-always': { decidedBy: 'always', applied: true },
      'p-gate-fail': { decidedBy: 'gate', applied: false },
    },
    rawAnswers: {
      'p-jev-match.q1': { type: 'noul', noul: 0.9 }, // yes, label expects applied=true -> match
      'p-jev-mismatch.q1': { type: 'noul', noul: 0.9 }, // yes, label expects applied=false -> mismatch
      'p-jev-pending.q1': { type: 'noul', noul: 0.5 }, // pending
      'p-jev-ambiguous.q1': { type: 'noul', noul: 0.9 }, // yes, but label is ambiguous -> excluded from denominator
    },
    labels: {
      'p-always': { label: 'applied', occurrences: [] },
      'p-gate-fail': { label: 'not_applied', occurrences: [] },
      'p-jev-match': { label: 'applied', occurrences: [{ file: 'x', line: 1, classification: 'adopted' }] },
      'p-jev-mismatch': { label: 'not_applied', occurrences: [] },
      'p-jev-pending': { label: 'not_applied', occurrences: [] },
      'p-jev-ambiguous': { label: 'ambiguous', occurrences: [{ file: 'x', line: 2, classification: 'weak' }] },
    },
    requests: [
      { group: 'g1', usage: { input_tokens: 100 }, latencyMs: 10 },
      { group: 'g2', usage: { input_tokens: 200 }, latencyMs: 20 },
    ],
  };

  const analysis = analyzePatterns(result, 0.8, 0.2, patternsList);

  // コードで決めた項目: 2件、両方一致（ambiguous なし）
  assert.equal(analysis.codeRows.length, 2);
  assert.equal(analysis.codeComparable.length, 2);
  assert.equal(analysis.codeMatches.length, 2);

  // Jev 判定の項目: 4件（match, mismatch, pending, ambiguous）
  assert.equal(analysis.jevRows.length, 4);
  // ambiguous を除いた分母は 3 件（match, mismatch, pending）
  assert.equal(analysis.jevComparableTotal, 3);
  assert.equal(analysis.pendingCount, 1);
  // 保留率 = 1 / 3（ambiguous を分母から除く）
  assert.equal(analysis.pendingCount / analysis.jevComparableTotal, 1 / 3);

  // 確信帯かつ ambiguous を除いた一致率 = 1 match / 2 decided(match+mismatch)
  assert.equal(analysis.jevDecided.length, 2);
  assert.equal(analysis.jevMatches.length, 1);
  assert.equal(analysis.jevMatches.length / analysis.jevDecided.length, 0.5);
});

test('analyzeModelTypes: 送った質問（仕様ID×8種）を分母にし、欠落は保留に数える（レビュー指摘5）', () => {
  const result = {
    rawAnswers: {
      'SPEC-1.actor': { type: 'noul', noul: 0.9 }, // yes, expected true -> match
      'SPEC-1.buc': { type: 'noul', noul: 0.9 }, // yes, expected true -> match
      'SPEC-1.condition': { type: 'noul', noul: 0.1 }, // no, expected false (not in list) -> match
      'SPEC-1.state': { type: 'noul', noul: 0.9 }, // yes, expected false -> mismatch
      'SPEC-1.variation': { type: 'noul', noul: 0.5 }, // pending
      // external_system, business_policy は回答が欠落（rawAnswers に無い）
    },
    labels: {
      'SPEC-1': ['actor', 'buc'],
    },
    requests: [
      {
        specId: 'SPEC-1',
        usage: { input_tokens: 50 },
        latencyMs: 8,
        questions: {
          'SPEC-1.actor': {},
          'SPEC-1.buc': {},
          'SPEC-1.condition': {},
          'SPEC-1.state': {},
          'SPEC-1.variation': {},
          'SPEC-1.external_system': {},
          'SPEC-1.business_policy': {},
        },
      },
    ],
  };

  const analysis = analyzeModelTypes(result, 0.8, 0.2);
  // 送った質問は7件（この固定データでは8種のうち7種分を用意した）
  assert.equal(analysis.totalItems, 7);
  // 欠落は external_system, business_policy の2件
  assert.equal(analysis.missingCount, 2);
  // 保留 = variation(pending) + 欠落2件 = 3件
  assert.equal(analysis.pendingCount, 3);
  assert.equal(analysis.decided.length, 4);
  assert.equal(analysis.matches.length, 3);
  assert.equal(analysis.matches.length / analysis.decided.length, 3 / 4);
});
