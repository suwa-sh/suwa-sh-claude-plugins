'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { ask, resolveApiKey, MODEL } = require('../lib/jevClient');

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

test('resolveApiKey: 環境変数を優先する', () => {
  const key = resolveApiKey({ env: { TYPESAFE_API_KEY: 'from-env' } });
  assert.equal(key, 'from-env');
});

test('resolveApiKey: ~/.zshrc の export 行から読む', () => {
  const key = resolveApiKey({
    env: {},
    home: '/fake/home',
    readFile: () => 'export FOO=1\nexport TYPESAFE_API_KEY="from-zshrc"\n',
  });
  assert.equal(key, 'from-zshrc');
});

test('resolveApiKey: 見つからなければ null', () => {
  const key = resolveApiKey({ env: {}, home: '/fake/home', readFile: () => 'export FOO=1\n' });
  assert.equal(key, null);
});

test('resolveApiKey: コメント行（# export ...）は拾わない', () => {
  const key = resolveApiKey({
    env: {},
    home: '/fake/home',
    readFile: () => '# export TYPESAFE_API_KEY="commented-out"\nexport TYPESAFE_API_KEY="real-key"\n',
  });
  assert.equal(key, 'real-key');
});

test('resolveApiKey: 行頭が # のみ（コメントのみ）なら null', () => {
  const key = resolveApiKey({
    env: {},
    home: '/fake/home',
    readFile: () => '  # export TYPESAFE_API_KEY="commented-out"\n',
  });
  assert.equal(key, null);
});

test('ask: 成功時に answers/usage/latencyMs/model を返す', async () => {
  const fetchImpl = async (url, init) => {
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
    const body = JSON.parse(init.body);
    assert.equal(body.model, MODEL);
    assert.equal(init.headers.Authorization, 'Bearer test-key');
    return jsonResponse({
      model: MODEL,
      answers: { q1: { type: 'noul', noul: 0.9 } },
      usage: { input_tokens: 100, output_tokens: 10 },
    });
  };
  const result = await ask({
    state: { a: 1 },
    questions: { q1: { type: 'noul', instructions: 'x?' } },
    apiKey: 'test-key',
    fetchImpl,
  });
  assert.equal(result.model, MODEL);
  assert.equal(result.answers.q1.noul, 0.9);
  assert.equal(result.usage.input_tokens, 100);
  assert.equal(typeof result.latencyMs, 'number');
});

test('ask: 429 は指数バックオフで再試行し最終的に成功する', async () => {
  let calls = 0;
  const sleeps = [];
  const fetchImpl = async () => {
    calls += 1;
    if (calls < 3) return jsonResponse({}, { ok: false, status: 429 });
    return jsonResponse({ model: MODEL, answers: {}, usage: { input_tokens: 1, output_tokens: 1 } });
  };
  const result = await ask({
    state: {},
    questions: {},
    apiKey: 'test-key',
    fetchImpl,
    sleepImpl: async (ms) => sleeps.push(ms),
  });
  assert.equal(calls, 3);
  assert.equal(sleeps.length, 2);
  assert.ok(result.answers);
});

test('ask: 4xx は本文の先頭500文字を付けて即失敗する（再試行しない）', async () => {
  let calls = 0;
  const longBody = 'x'.repeat(600);
  const fetchImpl = async () => {
    calls += 1;
    return {
      ok: false,
      status: 400,
      json: async () => ({}),
      text: async () => longBody,
    };
  };
  await assert.rejects(
    ask({ state: {}, questions: {}, apiKey: 'test-key', fetchImpl }),
    (error) => {
      assert.match(error.message, /status 400/);
      assert.ok(error.message.includes('x'.repeat(500)));
      assert.ok(!error.message.includes('x'.repeat(501)));
      return true;
    },
  );
  assert.equal(calls, 1); // 4xx は再試行しない
});

test('ask: 5xx は再試行し、上限を超えたら失敗する', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse({}, { ok: false, status: 503 });
  };
  await assert.rejects(
    ask({ state: {}, questions: {}, apiKey: 'test-key', fetchImpl, sleepImpl: async () => {}, maxRetries: 3 }),
  );
  assert.equal(calls, 4); // 初回 + 3回再試行
});

test('ask: API キーが例外メッセージに含まれない', async () => {
  const fetchImpl = async () => jsonResponse({}, { ok: false, status: 401 });
  const secretKey = 'sk-super-secret-value';
  try {
    await ask({ state: {}, questions: {}, apiKey: secretKey, fetchImpl });
    assert.fail('should have thrown');
  } catch (error) {
    assert.ok(!error.message.includes(secretKey));
  }
});

test('ask: 本文の読み取りが止まる場合もタイムアウトが効く（clearTimeout はヘッダー受信直後に呼ばない）', async () => {
  const fetchImpl = async (url, init) =>
    new Promise((resolve, reject) => {
      // ヘッダーはすぐ返すが、本文の読み取り (json()) は abort されるまで解決しない。
      const response = {
        ok: true,
        status: 200,
        json: () =>
          new Promise((_resolveJson, rejectJson) => {
            init.signal.addEventListener('abort', () => rejectJson(new Error('aborted')));
          }),
        text: async () => '',
      };
      init.signal.addEventListener('abort', () => reject(new Error('should not reject the outer fetch')));
      resolve(response);
    });
  await assert.rejects(
    ask({ state: {}, questions: {}, apiKey: 'test-key', fetchImpl, timeoutMs: 20, sleepImpl: async () => {}, maxRetries: 0 }),
  );
});

test('ask: 不正な JSON 本文はエラーにする', async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected token in JSON');
    },
    text: async () => 'not json',
  });
  await assert.rejects(
    ask({ state: {}, questions: {}, apiKey: 'test-key', fetchImpl, maxRetries: 0 }),
    (error) => {
      assert.match(error.message, /JSON/);
      return true;
    },
  );
});
