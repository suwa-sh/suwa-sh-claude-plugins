'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { buildQuestions, buildStateForSpec, judgeModelTypes, MODEL_TYPES } = require('../lib/modelTypeJudge');

const SAMPLE_REQUIREMENT = { requirement: 'REQ text', reason: 'REQ reason' };
const SAMPLE_SPEC = {
  id: 'SPEC-001-01',
  specification: 'spec text',
  acceptance_criteria: ['Given ... When ... Then ...'],
};

test('buildStateForSpec: state は requirement/reason/specification/acceptance_criteria を持つ', () => {
  const state = buildStateForSpec(SAMPLE_REQUIREMENT, SAMPLE_SPEC);
  assert.deepEqual(Object.keys(state).sort(), ['acceptance_criteria', 'reason', 'requirement', 'specification']);
});

test('レビュー指摘2ラウンド目3: 種別判定の全質問（en/ja）は state のキーを参照し、specification を必ず参照する', () => {
  const backtickRe = /`([a-zA-Z_]+)`/g;
  const stateKeys = new Set(Object.keys(buildStateForSpec(SAMPLE_REQUIREMENT, SAMPLE_SPEC)));
  for (const lang of ['en', 'ja']) {
    const questions = buildQuestions(lang);
    for (const [type, q] of Object.entries(questions)) {
      const refs = new Set();
      let m;
      const rr = new RegExp(backtickRe);
      while ((m = rr.exec(q.instructions))) refs.add(m[1]);
      assert.ok(refs.size > 0, `${lang}.${type}: no backtick reference found (instructions: ${q.instructions})`);
      for (const ref of refs) {
        assert.ok(stateKeys.has(ref), `${lang}.${type}: references \`${ref}\` not in state keys: ${[...stateKeys]}`);
      }
      assert.ok(refs.has('specification'), `${lang}.${type}: must reference \`specification\``);
    }
  }
});

test('buildQuestions: 8種類の質問がある', () => {
  const questions = buildQuestions('en');
  assert.equal(Object.keys(questions).length, 8);
  assert.equal(MODEL_TYPES.length, 8);
});

test('judgeModelTypes: dryRun では ask を呼ばず、仕様1件につき1リクエストになる', async () => {
  const requirementsYaml = {
    requirements: [
      {
        requirement: 'r1',
        reason: 'because',
        specifications: [SAMPLE_SPEC, { ...SAMPLE_SPEC, id: 'SPEC-001-02', specification: 'spec 2' }],
      },
    ],
  };
  let askCalls = 0;
  const ask = async () => {
    askCalls += 1;
    throw new Error('should not be called in dry-run');
  };
  const { requests } = await judgeModelTypes({ requirementsYaml, lang: 'ja', ask, dryRun: true });
  assert.equal(askCalls, 0);
  assert.equal(requests.length, 2);
  assert.equal(Object.keys(requests[0].questions).length, 8);
});
