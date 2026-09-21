#!/usr/bin/env node
'use strict';

// Jev (TypeSafe System One) API 呼び出しクライアント。
// 仕様は experiments/jev/DESIGN.md の「Jev の事実」を根拠にする。推測で変えない。
//
// エンドポイント: POST https://api.typesafe.ai/v1/systemone
// 認証: Authorization: Bearer <TYPESAFE_API_KEY>
// モデル: jev-1.13.0 を固定指定する（jev-latest は使わない）

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-1.13.0';
const MAX_RETRIES = 3;
const TIMEOUT_MS = 30000;
const RETRYABLE_STATUS = new Set([429]);

// TYPESAFE_API_KEY を環境変数、無ければ ~/.zshrc の export 行から読む。
// キーをログ・例外・戻り値に出さない。
// コメント行（行頭が # のもの。前後の空白は無視する）は拾わない。行頭が export で
// 始まる行だけを対象にする。
function resolveApiKey({ env = process.env, home = os.homedir(), readFile = (p) => fs.readFileSync(p, 'utf8') } = {}) {
  if (env.TYPESAFE_API_KEY) return env.TYPESAFE_API_KEY;
  const zshrc = path.join(home, '.zshrc');
  let text;
  try {
    text = readFile(zshrc);
  } catch {
    return null;
  }
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('#')) continue;
    if (!line.startsWith('export ')) continue;
    const match = line.match(/^export\s+TYPESAFE_API_KEY=(?:"([^"]*)"|'([^']*)'|(\S+))\s*$/);
    if (!match) continue;
    return match[1] ?? match[2] ?? match[3] ?? null;
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// { state, questions } を 1 リクエストとして送り { answers, usage, latencyMs, model } を返す。
// questions: { <id>: { type: "noul", instructions } }
// fetchImpl を注入できる（テストではネットワークを使わない）。
async function ask({
  state,
  questions,
  apiKey = resolveApiKey(),
  fetchImpl = typeof fetch === 'function' ? fetch : undefined,
  sleepImpl = sleep,
  timeoutMs = TIMEOUT_MS,
  maxRetries = MAX_RETRIES,
}) {
  if (!apiKey) throw new Error('jevClient.ask: TYPESAFE_API_KEY not resolved (env or ~/.zshrc)');
  if (typeof fetchImpl !== 'function') throw new Error('jevClient.ask: no fetch implementation available');

  const body = JSON.stringify({ model: MODEL, state, questions });
  const startedAt = Date.now();

  let attempt = 0;
  for (;;) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let response;
      try {
        response = await fetchImpl(ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body,
          signal: controller.signal,
        });
      } catch (error) {
        if (attempt < maxRetries) {
          attempt += 1;
          await sleepImpl(backoffMs(attempt));
          continue;
        }
        throw new Error(`jevClient.ask: network error after ${attempt} retries: ${error.message}`);
      }

      if (response.ok) {
        // タイムアウトは本文の読み取り中もタイマーが効いている必要があるため、
        // clearTimeout は finally（本文読み取り完了後）でのみ行う。
        let json;
        try {
          json = await response.json();
        } catch (error) {
          throw new Error(`jevClient.ask: failed to parse response body as JSON: ${error.message}`);
        }
        const latencyMs = Date.now() - startedAt;
        return {
          answers: json.answers,
          usage: json.usage,
          latencyMs,
          model: json.model ?? MODEL,
        };
      }

      const status = response.status;
      const isRetryable = RETRYABLE_STATUS.has(status) || status >= 500;
      if (isRetryable && attempt < maxRetries) {
        attempt += 1;
        await sleepImpl(backoffMs(attempt));
        continue;
      }

      const text = await response.text().catch(() => '');
      const snippet = text.slice(0, 500);
      throw new Error(`jevClient.ask: request failed with status ${status}: ${snippet}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

function backoffMs(attempt) {
  // 指数バックオフ: 1回目 500ms, 2回目 1000ms, 3回目 2000ms
  return 500 * 2 ** (attempt - 1);
}

module.exports = { ask, resolveApiKey, ENDPOINT, MODEL };
