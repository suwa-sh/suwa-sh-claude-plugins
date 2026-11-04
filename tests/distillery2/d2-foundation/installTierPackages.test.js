'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { plan, run } = require('../../../plugins/distillery2/skills/d2-foundation/scripts/installTierPackages');
const { tierStructureErrors } = require('../../../plugins/distillery2/skills/d2-decide/scripts/validateAdr');

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-tierpkg-'));
  fs.mkdirSync(path.join(root, 'docs/adr'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/adr/0001-tiers.md'), [
    '---', 'id: "0001"', 'status: accepted', 'scope: [system]', 'datastore_owner: backend-api', 'tiers:',
    '  - { id: backend-api, dir: apps/backend-api, kind: backend, lang: typescript, packages: [express, pg, jose], dev_packages: ["@types/express"] }',
    '  - { id: frontend, dir: apps/frontend, kind: frontend, lang: typescript, packages: [] }',
    '---', '', '# ティア構成', '',
  ].join('\n'));
  for (const d of ['apps/backend-api', 'apps/frontend']) {
    fs.mkdirSync(path.join(root, d), { recursive: true });
    fs.writeFileSync(path.join(root, d, 'package.json'), JSON.stringify({ name: d, dependencies: d.endsWith('api') ? { pg: '^8.0.0' } : {} }));
  }
  return root;
}

test('installTierPackages: ADR の tiers[].packages のうち、まだ無いものだけを入れる計画にする (版は npm が解決する)', () => {
  const root = repo();
  const r = run({ cwd: root, adr: 'docs/adr', dryRun: true, npm: 'npm' });
  assert.deepEqual(r.installed, [{ tier: 'backend-api', dir: 'apps/backend-api', packages: ['express', 'jose'], dev_packages: ['@types/express'] }], '既にある pg は入れない');
  assert.deepEqual(r.skipped, ['frontend']);

});

test('validateAdr: tiers[].packages / dev_packages は npm のパッケージ名の配列 (版の指定は誤り)', () => {
  const fm = (packages) => ({ id: '0001', status: 'accepted', scope: ['system'], datastore_owner: 'b', tiers: [{ id: 'b', dir: 'apps/b', kind: 'backend', lang: 'ts', packages }] });
  assert.deepEqual(tierStructureErrors([{ file: 'a.md', fm: fm(['express', '@types/express']) }]), []);
  assert.deepEqual(tierStructureErrors([{ file: 'a.md', fm: fm(undefined) }]), [], '無いのは検証で落とさない (手順書で必須にする)');
  assert.ok(tierStructureErrors([{ file: 'a.md', fm: fm(['express@5']) }]).some((e) => /express@5/.test(e.message)));
  assert.ok(tierStructureErrors([{ file: 'a.md', fm: fm('express') }]).some((e) => /配列/.test(e.message)));
});

test('installTierPackages: dir は骨格と同じく apps/ を外して apps/<dir> に解決し、入れるものがあるのに package.json が無ければ失敗する', () => {
  const root = repo();
  assert.deepEqual(plan(root, [{ id: 'b', dir: 'backend-api', packages: ['hono'] }]).map((s) => s.dir), ['apps/backend-api']);
  assert.deepEqual(plan(root, [{ id: 'backend-api', packages: ['hono'] }]).map((s) => s.dir), ['apps/backend-api'], 'dir が無ければ id');
  assert.throws(() => plan(root, [{ id: 'x', dir: 'apps/none', packages: ['a'] }]), /apps\/none\/package\.json が無い/);
  assert.deepEqual(plan(root, [{ id: 'x', dir: 'apps/none', packages: [] }]), [], '入れるものが無ければ飛ばす');
});
