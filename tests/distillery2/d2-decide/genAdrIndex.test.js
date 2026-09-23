'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { renderIndex } = require('../../../plugins/distillery2/skills/d2-decide/scripts/genAdrIndex');
const { loadAdrDir } = require('../../../plugins/distillery2/skills/d2-decide/scripts/validateAdr');

const FIX = path.resolve(__dirname, '../../fixtures/distillery2/adr-pass');

const EXPECTED = `# アーキテクチャ決定記録 (ADR) 一覧

| 番号 | タイトル | ステータス | supersedes | superseded_by |
|------|---------|-----------|-----------|---------------|
| [0001](0001-api-express.md) | API ティアは Express で実装する | superseded | - | 0003 |
| [0002](0002-tier-structure.md) | ティアは frontend / backend-api / worker の 3 構成とする | accepted | - | - |
| [0003](0003-api-fastify.md) | API ティアは Fastify で実装する | accepted | 0001 | - |
`;

test('renderIndex は id 昇順で決定論的なスナップショットを出す', () => {
  const { adrs } = loadAdrDir(FIX);
  const out = renderIndex(adrs, null);
  assert.equal(out, EXPECTED);
});

test('renderIndex は入力順に依存せず同一出力 (決定論)', () => {
  const { adrs } = loadAdrDir(FIX);
  const a = renderIndex(adrs, null);
  const b = renderIndex([...adrs].reverse(), null);
  assert.equal(a, b);
});

test('basisLine を渡すと front matter が付く', () => {
  const { adrs } = loadAdrDir(FIX);
  const out = renderIndex(adrs, 'basis: requirements@abc1234');
  assert.ok(out.startsWith('---\nbasis: requirements@abc1234\n---\n'));
});
