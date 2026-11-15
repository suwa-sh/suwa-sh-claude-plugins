'use strict';
// 進行役が毎回その場で自作していた補助 (関与ティアの書き戻し・回帰の相手・前提の複製・検証役に渡す一覧) を runState.js に持たせた
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PLUGIN = path.resolve(__dirname, '../../../plugins/distillery2/skills');
const rs = require(path.join(PLUGIN, 'd2-common/scripts/lib/runState'));
const { parseYaml } = require(path.join(PLUGIN, 'd2-common/scripts/lib/yaml'));

function g(root, ...args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function w(root, rel, text) { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); }
function commitAll(root, msg) { g(root, 'add', '-A'); g(root, 'commit', '-q', '-m', msg); return g(root, 'rev-parse', 'HEAD'); }

const UCS = `schema_version: distillery2.use-cases/v1
use_cases:
  - uc_id: UC-001
    slug: view-rooms
    tiers_hint:
      - frontend
      - backend
    tiers:
      - backend-api
    status: done
  - uc_id: UC-002
    slug: book-room
    tiers_hint:
      - frontend
      - backend
    status: planned
  - uc_id: UC-003
    slug: nightly-report
    tiers: [worker]
    status: planned
`;
const CONFIG = 'tiers:\n  - id: frontend\n  - id: backend-api\n  - id: worker\n';
const CATALOG = JSON.stringify({ contracts: [
  { id: 'api', type: 'openapi', source: 'openapi/openapi.yaml', provider: 'backend-api', consumers: ['frontend'] },
  { id: 'db', type: 'rdb-schema', source: 'db/rdb-schema.yaml', provider: 'backend-api', consumers: [] },
  { id: 'events', type: 'asyncapi', source: 'asyncapi/asyncapi.yaml', provider: 'backend-api', consumers: ['worker'] },
] });
const UC_INDEX = `ucs:
  - slug: view-rooms
    operations: []
    messages: []
    tables: [rooms]
  - slug: book-room
    operations: [reserveRoom]
    messages: []
    tables: [rooms]
  - slug: nightly-report
    operations: []
    messages: [reportRequested]
    tables: []
`;

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-helpers-'));
  g(root, 'init', '-q', '-b', 'main');
  g(root, 'config', 'user.email', 't@example.com');
  g(root, 'config', 'user.name', 't');
  w(root, '.gitignore', '.distillery/logs/\n');
  w(root, 'docs/requirements/use-cases.yaml', UCS);
  w(root, '.distillery/config.yaml', CONFIG);
  w(root, 'contracts/contracts.json', CATALOG);
  w(root, 'contracts/uc-index.yaml', UC_INDEX);
  commitAll(root, 'base');
  return root;
}
const ucs = (root) => parseYaml(fs.readFileSync(path.join(root, 'docs/requirements/use-cases.yaml'), 'utf8')).use_cases;

test('uc-tiers: 使う契約の提供側と利用側を config の順に並べ、tiers を status の前に足す', () => {
  const root = repo();
  const r = rs.ucTiers(root, 'book-room');
  assert.deepEqual(r.tiers, ['frontend', 'backend-api']);
  assert.equal(r.previous, null);
  assert.equal(r.changed, true);
  assert.deepEqual(r.contracts, ['api', 'db']);
  const all = ucs(root);
  assert.deepEqual(all[1].tiers, ['frontend', 'backend-api']);
  assert.equal(all[1].status, 'planned');
  // ほかの UC の行は変えない
  assert.deepEqual(all[0].tiers, ['backend-api']);
  assert.deepEqual(all[2].tiers, ['worker']);
});

test('uc-tiers: 既存の tiers (ブロックの並び・1 行の並び) を置き換える。同じなら書かない', () => {
  const root = repo();
  // 表だけを使う UC は、DB の契約の提供側だけ
  const same = rs.ucTiers(root, 'view-rooms');
  assert.deepEqual(same.tiers, ['backend-api']);
  assert.equal(same.changed, false);
  const inline = rs.ucTiers(root, 'nightly-report');
  assert.deepEqual(inline.previous, ['worker']);
  assert.deepEqual(inline.tiers, ['backend-api', 'worker']);
  assert.deepEqual(ucs(root)[2].tiers, ['backend-api', 'worker']);
  assert.equal(ucs(root)[2].status, 'planned');
});

test('uc-tiers: uc-index に無い UC・使う契約が無い UC・config に無いティアは拒む。同じ種別の契約が複数なら ambiguous を返す', () => {
  const root = repo();
  assert.throws(() => rs.ucTiers(root, 'no-such'), /uc-index\.yaml に slug: no-such が無い/);
  w(root, 'contracts/uc-index.yaml', 'ucs:\n  - slug: book-room\n    operations: []\n    messages: []\n    tables: []\n');
  assert.throws(() => rs.ucTiers(root, 'book-room'), /使う契約が無い/);
  w(root, 'contracts/uc-index.yaml', UC_INDEX);
  w(root, '.distillery/config.yaml', 'tiers:\n  - id: frontend\n');
  assert.throws(() => rs.ucTiers(root, 'book-room'), /config\.yaml の tiers に無い: backend-api/);
  w(root, '.distillery/config.yaml', CONFIG);
  const two = JSON.parse(CATALOG);
  two.contracts.push({ id: 'admin-api', type: 'openapi', source: 'openapi/admin.yaml', provider: 'backend-api', consumers: [] });
  w(root, 'contracts/contracts.json', JSON.stringify(two));
  assert.deepEqual(rs.ucTiers(root, 'book-room', { dryRun: true }).ambiguous, ['openapi']);
});

test('regression-targets: status が done の UC と、開き直した UC (status は planned) を返す。今の UC は除く', () => {
  const root = repo();
  assert.deepEqual(rs.regressionTargets(root).map((t) => t.slug), ['view-rooms']);
  // book-room を main マージ済みにしてから開き直す
  rs.markDone(rs.openRun(root, 'book-room'), 'deliver');
  rs.setUcStatus(root, 'book-room', 'done');
  commitAll(root, 'delivered');
  rs.reopen(root, 'book-room');
  assert.equal(ucs(root)[1].status, 'planned');
  assert.deepEqual(rs.regressionTargets(root), [
    { slug: 'view-rooms', reopened: false, tiers: ['backend-api'] },
    { slug: 'book-room', reopened: true, tiers: [] },
  ]);
  assert.deepEqual(rs.regressionTargets(root, 'book-room').map((t) => t.slug), ['view-rooms']);
});

test('carry-assumptions: 戻さないティアの前提を新しい attempt に複製し、attempt の値だけを書き換える', () => {
  const root = repo();
  const run = rs.openRun(root, 'book-room');
  rs.attemptDir(run, 1);
  w(run, 'attempt-1/assumptions.frontend.yaml', 'schema_version: "1"\nuc: book-room\ntier: frontend\nattempt: 1\nassumptions:\n  - id: A-001\n    note: "attempt: 1 の文字を含む"\n');
  rs.attemptDir(run, 2);
  const r = rs.carryAssumptions(run, ['frontend']);
  assert.deepEqual(r, { from: 1, to: 2, copied: ['attempt-2/assumptions.frontend.yaml'] });
  const text = fs.readFileSync(path.join(run, 'attempt-2/assumptions.frontend.yaml'), 'utf8');
  assert.match(text, /^attempt: 2$/m);
  assert.match(text, /note: "attempt: 1 の文字を含む"/);
  // 複製先があれば拒む (戻すティアの新しい前提を上書きしない)。複製元が無いティアも拒み、何も書かない
  assert.throws(() => rs.carryAssumptions(run, ['frontend']), /複製先が既にある/);
  assert.throws(() => rs.carryAssumptions(run, ['backend-api']), /複製元が無い/);
  assert.throws(() => rs.carryAssumptions(run, []), /--tiers/);
});

test('verify-list: commit 済み・未 commit・未追跡の変更を一覧にし、簿記のファイルを除き、共有の候補と差分を書く', () => {
  const root = repo();
  const base = g(root, 'rev-parse', 'main');
  g(root, 'switch', '-q', '-c', 'feature/book-room');
  const run = rs.openRun(root, 'book-room');
  rs.appendEvent(run, 'branch_started', { base_head: base });
  w(root, 'apps/backend-api/src/shared.ts', 'export const a = 1;\n');
  w(root, 'apps/backend-api/src/reserve.ts', 'export const r = 1;\n');
  w(root, 'docs/README.md', '# x\n');
  w(root, 'docs/feedback/i1.md', '---\n---\n');
  w(root, 'docs/as-built/_system/traceability-index.json', JSON.stringify({ ucs: { 'view-rooms': { files: ['apps/backend-api/src/shared.ts'] }, 'book-room': { files: ['apps/backend-api/src/reserve.ts'] } } }));
  commitAll(root, 'impl');
  // commit 前の直し (追跡済みの変更と未追跡のファイル)
  w(root, 'apps/backend-api/src/reserve.ts', 'export const r = 2;\n');
  w(root, 'apps/frontend/src/new.ts', 'export const n = 1;\n');
  w(root, 'docs/requirements/use-cases.yaml', UCS + '# x\n');
  const r = rs.verifyList(run);
  assert.equal(r.list, '.distillery/logs/verify-book-room-attempt-1.txt');
  assert.equal(r.diff, '.distillery/logs/verify-book-room-attempt-1.diff');
  const lines = fs.readFileSync(path.join(root, r.list), 'utf8').split('\n');
  const files = lines.slice(0, lines.indexOf(''));
  assert.ok(files.includes('apps/backend-api/src/shared.ts'));
  assert.ok(files.includes('apps/backend-api/src/reserve.ts'));
  assert.ok(files.includes('apps/frontend/src/new.ts'), '未追跡のファイルも載る');
  for (const f of ['docs/README.md', 'docs/requirements/use-cases.yaml', 'docs/feedback/i1.md']) assert.ok(!files.includes(f), `簿記のファイルは除く: ${f}`);
  assert.deepEqual(lines.slice(lines.indexOf('') + 1).filter(Boolean), ['共有の候補:', 'apps/backend-api/src/shared.ts — view-rooms']);
  assert.equal(r.shared, 1);
  assert.ok(r.uncommitted >= 2, '未 commit の変更の数を返す');
  const diff = fs.readFileSync(path.join(root, r.diff), 'utf8');
  assert.match(diff, /\+export const r = 2;/, 'commit 前の直しが差分に出る');
  assert.doesNotMatch(diff, /use-cases\.yaml/);
});

test('verify-list: 追跡表が無ければ共有の候補は「なし」', () => {
  const root = repo();
  const base = g(root, 'rev-parse', 'main');
  g(root, 'switch', '-q', '-c', 'feature/book-room');
  const run = rs.openRun(root, 'book-room');
  rs.appendEvent(run, 'branch_started', { base_head: base });
  w(root, 'apps/backend-api/src/reserve.ts', 'export const r = 1;\n');
  commitAll(root, 'impl');
  const r = rs.verifyList(run);
  const text = fs.readFileSync(path.join(root, r.list), 'utf8');
  assert.match(text, /共有の候補:\nなし\n$/);
  assert.equal(r.uncommitted, 0);
});

test('verify-list: base_head が commit の ID の形でなければ拒む (git のオプションとして渡さない)', () => {
  const root = repo();
  g(root, 'switch', '-q', '-c', 'feature/book-room');
  const run = rs.openRun(root, 'book-room');
  rs.appendEvent(run, 'branch_started', { base_head: '--output=/tmp/x' });
  assert.throws(() => rs.verifyList(run), /commit の ID の形でない/);
});
