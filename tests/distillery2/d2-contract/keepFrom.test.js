'use strict';
// 0.3.0: 骨格の回し直しで既存の UC の契約を消さない・変えない (validateUcIndex.js --keep-from)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const V = require(path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-contract/scripts/validateUcIndex.js'));

function g(root, ...args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function w(root, rel, text) { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); }

const UC_INDEX = (ucs) => `schema_version: distillery2.uc-index/v1\nucs:\n${ucs.map((u) => `  - slug: ${u}\n    operations: [list${u.replace(/-/g, '')}]\n    messages: []\n    tables: []\n`).join('')}`;
const BUNDLE = (desc) => `openapi: 3.1.0\ninfo: {title: t, version: "1"}\npaths:\n  /rooms:\n    get:\n      operationId: listviewrooms\n      description: ${desc}\n      responses:\n        "200": {description: ok}\n`;

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-keep-'));
  g(root, 'init', '-q', '-b', 'main');
  g(root, 'config', 'user.email', 't@example.com');
  g(root, 'config', 'user.name', 't');
  w(root, 'contracts/uc-index.yaml', UC_INDEX(['view-rooms']));
  w(root, 'contracts/generated/openapi.bundle.yaml', BUNDLE('一覧'));
  g(root, 'add', '-A');
  g(root, 'commit', '-q', '-m', 'base');
  return root;
}

test('--keep-from: 既存の UC のエントリと operation が同じなら空。UC が消えた・operation の定義が変わったら誤りを返す', () => {
  const root = repo();
  const dir = path.join(root, 'contracts');
  assert.deepEqual(V.keepFrom(dir, 'HEAD'), []);
  w(root, 'contracts/generated/openapi.bundle.yaml', BUNDLE('一覧 (変えた)'));
  assert.match(V.keepFrom(dir, 'HEAD').join('\n'), /view-rooms: operation listviewrooms の定義が HEAD から変わった/);
  w(root, 'contracts/generated/openapi.bundle.yaml', BUNDLE('一覧'));
  w(root, 'contracts/uc-index.yaml', 'schema_version: distillery2.uc-index/v1\nucs: []\n');
  assert.match(V.keepFrom(dir, 'HEAD').join('\n'), /view-rooms: HEAD の uc-index にあった UC が消えた/, '骨格が空の uc-index を書き直したら止める');
});
