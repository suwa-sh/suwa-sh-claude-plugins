'use strict';
// テスト基盤の雛形の結線の約束 (0.3.0 の実地確認)。雛形は TypeScript で、このリポでは型検査も実行もしないため、
// 実地確認のリポの写しで型検査と動き (非同期の createTestApp・DB の所有ティア・テスト用ヘッダ) を確かめた形を、文面で固定する
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const T = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-foundation/templates');
const read = (rel) => fs.readFileSync(path.join(T, rel), 'utf8');

test('API ドライバ: createTestApp({ db, clock }) の戻り (app か Promise<app>) を待ってから叩き、契約の test-headers.json を既定のヘッダにする', () => {
  const api = read('features-support/drivers/api.ts');
  assert.match(api, /this\.app = Promise\.resolve\(createTestApp\(deps\)\)/);
  assert.match(api, /request\(await this\.app\)/);
  assert.match(api, /test-headers\.json/);
  assert.match(api, /mergeHeaders\(\s*contractTestHeaders\(this\.testHeaders, method, path\),\s*scenarioHeaders\(\),\s*headers,\s*\)/, '契約 → トレース → 呼び出し元の順');
  assert.match(api, /out\[k\.toLowerCase\(\)\] = v/, 'ヘッダ名の大文字小文字をそろえて重ねる');
  assert.match(api, /replace\(\/\\\{uuid\\\}\/g, \(\) => randomUUID\(\)\)/, '{uuid} は送るたびに新しい UUID');
  assert.match(api, /op\.method === method\.toUpperCase\(\) && matchesPath\(op\.path, reqPath\)/, 'operation ごとのヘッダ');
  assert.match(api, /if \(v !== ''\) req = req\.set\(k, v\)/, '空文字のヘッダは送らない');
});

test('World と hooks: シナリオごとの DB (migration があるときだけ) と固定の時計を api ドライバに渡す', () => {
  const world = read('features-support/world.ts');
  assert.match(world, /new ApiDriver\(\{ db: this\.harness\?\.pg, clock: this\.clock \}\)/);
  assert.match(world, /setNow\(at: string\)/);
  const hooks = read('features-support/hooks.ts');
  assert.match(hooks, /if \(PgHarness\.hasMigrations\(\)\) this\.harness = await PgHarness\.fresh\(\);/);
  assert.ok(hooks.indexOf('PgHarness.fresh()') < hooks.indexOf('this.selectDriver(tags)'), 'DB を用意してからドライバを作る');
  assert.match(hooks, /if \(this\.harness\) await this\.harness\.stop\(\);/);
});

test('DB のハーネス: 所有ティアは D2_DATASTORE_OWNER → .distillery/config.yaml の datastore_owner → backend-api', () => {
  const h = read('test-support/src/pglite-harness.ts');
  assert.match(h, /process\.env\.D2_DATASTORE_OWNER/);
  assert.match(h, /'\.distillery', 'config\.yaml'/);
  assert.match(h, /datastore_owner/);
  assert.equal((h.match(/opts\.datastoreOwner \|\| datastoreOwner\(opts\.repoRoot\)/g) || []).length, 2, 'constructor と hasMigrations の両方');
  const pkg = JSON.parse(read('test-support/package.json'));
  assert.equal(pkg.exports['./clock'], './src/clock.ts');
});
