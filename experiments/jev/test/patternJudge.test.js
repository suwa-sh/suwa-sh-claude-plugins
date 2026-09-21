'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { extractFeatures } = require('../lib/features');
const { judgePatterns, classifyPatterns, resolveMainVerdict } = require('../lib/patternJudge');
const patterns = require('../patterns/patterns.json').patterns;

const SAMPLE_DOCS = path.resolve(__dirname, '..', '..', '..', 'samples', 'distillery', 'pipeline');

test('classifyPatterns: always と numericGates（NFR明示閾値）で fetch を呼ばずに決まる項目がある', () => {
  const features = extractFeatures(SAMPLE_DOCS);
  const { codeDecided, needsJudgement } = classifyPatterns(patterns, features);
  assert.equal(codeDecided['health-endpoint-monitoring'].decidedBy, 'always');
  assert.equal(codeDecided['health-endpoint-monitoring'].applied, true);
  // cqrs は nfr.B.1.1.1 >= 3 の明示閾値 gate。見本は grade=1 のため非適用確定
  assert.equal(codeDecided['cqrs'].decidedBy, 'gate');
  assert.equal(codeDecided['cqrs'].applied, false);
  assert.equal(codeDecided['circuit-breaker'], undefined); // 質問が必要なので needsJudgement 側
  assert.ok(needsJudgement.some((n) => n.pattern.id === 'circuit-breaker'));
});

test('classifyPatterns: excludeCodeSignal が真なら支持側を問わず非適用に確定する（bulkhead）', () => {
  const features = extractFeatures(SAMPLE_DOCS);
  const { codeDecided } = classifyPatterns(patterns, features);
  // 見本は externalSystems=1 のため bulkhead.excludeCodeSignals(single_external_system: <=1) が真になる
  assert.equal(codeDecided['bulkhead'].decidedBy, 'excludeCodeSignal');
  assert.equal(codeDecided['bulkhead'].applied, false);
});

test('classifyPatterns: combine=all で codeSignal が偽なら questions を待たずに非適用確定する（event-sourcing、レビュー指摘1の再点検で修正）', () => {
  const features = extractFeatures(SAMPLE_DOCS);
  const { codeDecided } = classifyPatterns(patterns, features);
  // 見本は maxStateTransitions=7 < 8 のため codeSignal が偽になり、combine=all なので即非適用
  assert.equal(codeDecided['event-sourcing'].decidedBy, 'codeSignal');
  assert.equal(codeDecided['event-sourcing'].applied, false);
});

test('classifyPatterns: 支持側が真で確定しても excludeQuestions が残っていれば Jev を呼ぶ（レビュー指摘5）', () => {
  const features = extractFeatures(SAMPLE_DOCS);
  const { codeDecided, needsJudgement } = classifyPatterns(patterns, features);
  // federated-identity, rate-limiting-throttling は見本で codeSignal (externalActors>=1) が真になるが、
  // excludeQuestions を持つため code-decided にはならず、除外質問だけが Jev に送られる
  assert.equal(codeDecided['federated-identity'], undefined);
  assert.equal(codeDecided['rate-limiting-throttling'], undefined);
  const fi = needsJudgement.find((n) => n.pattern.id === 'federated-identity');
  const rl = needsJudgement.find((n) => n.pattern.id === 'rate-limiting-throttling');
  assert.ok(fi);
  assert.ok(rl);
  assert.equal(fi.onlyExcludes, true);
  assert.equal(rl.onlyExcludes, true);
});

test('resolveMainVerdict: combine=any で codeSignal が1つでも真なら true、questionsが残る場合は真でも onlyExcludes 経由になる', () => {
  const pattern = { combine: 'any', questions: [{ key: 'q1' }] };
  assert.equal(resolveMainVerdict(pattern, [{ pass: true }]), true);
  assert.equal(resolveMainVerdict(pattern, [{ pass: false }]), null); // questionsが残るため未確定
});

test('resolveMainVerdict: combine=all で codeSignal が1つでも偽なら false（questionsの有無によらず）', () => {
  const pattern = { combine: 'all', questions: [{ key: 'q1' }] };
  assert.equal(resolveMainVerdict(pattern, [{ pass: false }]), false);
  assert.equal(resolveMainVerdict(pattern, [{ pass: true }]), null); // questionsが残るため未確定
});

test('judgePatterns: always/gate/codeSignal/excludeCodeSignal だけで確定する項目は ask を呼ばない', async () => {
  const features = extractFeatures(SAMPLE_DOCS);
  const { codeDecided } = classifyPatterns(patterns, features);
  const codeDecidedIds = new Set(Object.keys(codeDecided));
  assert.ok(codeDecidedIds.has('health-endpoint-monitoring'));
  assert.ok(codeDecidedIds.has('cqrs'));
  assert.ok(codeDecidedIds.has('bulkhead'));
  assert.ok(codeDecidedIds.has('event-sourcing'));

  let askCalls = 0;
  const ask = async () => {
    askCalls += 1;
    return { answers: {}, usage: { input_tokens: 1, output_tokens: 1 }, latencyMs: 1 };
  };
  const onlyCodeDecidable = patterns.filter((p) => codeDecidedIds.has(p.id));
  const { codeDecided: result } = await judgePatterns({ features, patterns: onlyCodeDecidable, lang: 'en', ask, dryRun: false });
  assert.equal(askCalls, 0);
  assert.equal(Object.keys(result).length, onlyCodeDecidable.length);
});

test('judgePatterns: 支持側確定・除外側のみ残る場合は questions を送らず excludeQuestions だけ送る（レビュー指摘5）', async () => {
  const features = extractFeatures(SAMPLE_DOCS);
  const ask = async ({ questions }) => {
    const answers = {};
    for (const key of Object.keys(questions)) answers[key] = { type: 'noul', noul: 0.1 };
    return { answers, usage: { input_tokens: 1, output_tokens: 1 }, latencyMs: 1 };
  };
  const { requests } = await judgePatterns({ features, patterns, lang: 'en', ask, dryRun: false });
  const securityRequest = requests.find((r) => r.patternIds.includes('federated-identity'));
  const sentKeys = Object.keys(securityRequest.questions);
  // federated-identity の主質問 (sso_across_apps) は送られていないが、exclude は送られている
  assert.ok(!sentKeys.some((k) => k === 'federated-identity.sso_across_apps'));
  assert.ok(sentKeys.some((k) => k === 'federated-identity.exclude.excl_internal_simple_auth'));
  const rlKeys = sentKeys.filter((k) => k.startsWith('rate-limiting-throttling.'));
  assert.deepEqual(rlKeys, ['rate-limiting-throttling.exclude.excl_internal_only']);
});

test('judgePatterns: グループごとに1リクエストにまとまる', async () => {
  const features = extractFeatures(SAMPLE_DOCS);
  const ask = async ({ questions }) => {
    const answers = {};
    for (const key of Object.keys(questions)) answers[key] = { type: 'noul', noul: 0.5 };
    return { answers, usage: { input_tokens: 10, output_tokens: 1 }, latencyMs: 5 };
  };
  const { requests, codeDecided } = await judgePatterns({ features, patterns, lang: 'en', ask, dryRun: false });
  const groups = new Set(requests.map((r) => r.group));
  assert.equal(requests.length, groups.size); // グループの数だけリクエストがある
  assert.equal(Object.keys(codeDecided).length + requests.reduce((s, r) => s + r.patternIds.length, 0), patterns.length);
});

test('judgePatterns: dryRun では ask を呼ばない', async () => {
  const features = extractFeatures(SAMPLE_DOCS);
  let askCalls = 0;
  const ask = async () => {
    askCalls += 1;
    throw new Error('should not be called in dry-run');
  };
  const { requests } = await judgePatterns({ features, patterns, lang: 'en', ask, dryRun: true });
  assert.equal(askCalls, 0);
  assert.ok(requests.length > 0);
  assert.ok(requests[0].state);
  assert.ok(requests[0].questions);
});

test('judgePatterns: dryRun でも codeSignal は擬似回答として rawAnswers に注入される（ネットワーク不使用）', async () => {
  const features = extractFeatures(SAMPLE_DOCS);
  const ask = async () => {
    throw new Error('should not be called in dry-run');
  };
  const { rawAnswers } = await judgePatterns({ features, patterns, lang: 'en', ask, dryRun: true });
  // gatekeeper-gateway-offloading は見本で codeSignal が偽（externalActors=1 < 2）だが、
  // まだ questions が残るため needsJudgement 側になり、擬似回答が注入される
  assert.equal(rawAnswers['gatekeeper-gateway-offloading.codesignal.two_or_more_external_actors'].noul, 0);
});

test('レビュー指摘3: 全パターンの questions/excludeQuestions が参照するバッククォート付きキーは、そのリクエストの state に含まれる', async () => {
  const features = extractFeatures(SAMPLE_DOCS);
  const ask = async ({ questions }) => {
    const answers = {};
    for (const key of Object.keys(questions)) answers[key] = { type: 'noul', noul: 0.5 };
    return { answers, usage: { input_tokens: 1, output_tokens: 1 }, latencyMs: 1 };
  };
  const { requests } = await judgePatterns({ features, patterns, lang: 'en', ask, dryRun: false });
  const backtickRe = /`([a-zA-Z]+)`/g;
  for (const request of requests) {
    const stateKeys = new Set(Object.keys(request.state));
    for (const [qid, q] of Object.entries(request.questions)) {
      let m;
      const rr = new RegExp(backtickRe);
      while ((m = rr.exec(q.instructions))) {
        assert.ok(stateKeys.has(m[1]), `${qid} references \`${m[1]}\` but state only has: ${[...stateKeys]}`);
      }
    }
  }
});
