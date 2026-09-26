'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { build } = require('../../../plugins/distillery2/skills/d2-decide/scripts/genArchitectureDoc');

function W(dir, rel, content) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n');
}

const TIERS_ADR = `---
id: "0001"
title: "ティア構成"
status: accepted
date: "2026-09-24"
basis: "requirements@abc1234"
scope: [system]
tiers:
  - id: frontend-patron
    dir: apps/frontend-patron
    kind: frontend
    lang: typescript
    provides: []
    consumes: [api]
  - id: backend-api
    dir: apps/backend-api
    kind: backend
    lang: typescript
    provides: [api]
    consumes: [db]
  - id: worker
    dir: apps/worker
    kind: worker
    lang: typescript
    provides: []
    consumes: [db]
datastore_owner: backend-api
contexts:
  - id: loan
    name: 貸出コンテキスト
    owner_tier: backend-api
    relations:
      - to: catalog
        kind: OHS
  - id: catalog
    name: 蔵書コンテキスト
    owner_tier: backend-api
rules:
  - scope: common
    text: "フロントは backend-api の内部へ依存しない"
    arch_test:
      from: "apps/frontend-patron/**"
      to: "apps/backend-api/src/**"
      effect: forbid
      level: tier
---

# 背景

本文。
`;

const CONTRACTS = {
  schema_version: 'distillery2.contracts/v1',
  basis: 'requirements@abc1234',
  contracts: [
    { id: 'api', type: 'openapi', source: 'openapi/openapi.yaml', provider: 'backend-api', consumers: ['frontend-patron'] },
    { id: 'db', type: 'rdb-schema', source: 'db/rdb-schema.yaml', provider: 'backend-api', consumers: ['worker'] },
  ],
};

const ACTORS_TSV = `アクター群\tアクター\t役割\t社内外\t立場\t主担当業務
スタッフ\t司書\t管理する\t社内\t提供者\t貸出
利用者\t利用者\t検索する\t社外\t受益者\t
`;

const EXTERNAL_TSV = `外部システム群\t外部システム\t役割
通知\tメール配信サービス\t送信する
`;

const OVERVIEW = { system_name: '図書館システム', system_overview: '...', interface_kind: 'gui' };

function buildRepo({ withContracts = true, withRdra = true, withContexts = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2arch-'));
  const adr = withContexts ? TIERS_ADR : TIERS_ADR.replace(/contexts:[\s\S]*?rules:/, 'rules:');
  W(dir, 'docs/adr/0001-tiers.md', adr);
  if (withContracts) W(dir, 'contracts/contracts.json', CONTRACTS);
  if (withRdra) {
    W(dir, 'docs/requirements/rdra/アクター.tsv', ACTORS_TSV);
    W(dir, 'docs/requirements/rdra/外部システム.tsv', EXTERNAL_TSV);
    W(dir, 'docs/requirements/rdra/システム概要.json', OVERVIEW);
  }
  return dir;
}

function opts(dir, over = {}) {
  return { cwd: dir, adrDir: 'docs/adr', contracts: 'contracts/contracts.json', rdra: 'docs/requirements/rdra', docsRoot: 'docs', dirs: {}, ...over };
}

test('システムコンテキスト図は graph で、アクター (社内/社外)・システム・外部システムが出る (C4 記法は使わない)', () => {
  const dir = buildRepo();
  const md = build(opts(dir));
  assert.match(md, /## システムコンテキスト図/);
  assert.match(md, /```mermaid\ngraph LR/);
  assert.doesNotMatch(md, /C4Context|C4Container|Person\(|System_Ext\(|Rel\(/);
  // コードポイント順 (利 U+5229 < 司 U+53F8): 利用者 が先、司書 が後
  assert.match(md, /actor_1\(\["利用者<br\/>\(社外\)"\]\):::actor/);
  assert.match(md, /actor_2\(\["司書"\]\):::actor/);
  assert.match(md, /sys\["図書館システム"\]:::system/);
  assert.match(md, /ext_1\["メール配信サービス"\]:::external/);
  assert.match(md, /actor_1 -->\|利用する\| sys/);
  assert.match(md, /sys -->\|連携する\| ext_1/);
  assert.match(md, /classDef actor /);
});

test('コンテナ図は graph + subgraph で、ティア・契約辺 (consumer→provider)・datastore_owner が出る', () => {
  const dir = buildRepo();
  const md = build(opts(dir));
  assert.match(md, /## コンテナ図/);
  assert.match(md, /```mermaid\ngraph LR\n  subgraph sys\["図書館システム"\]/);
  assert.match(md, /backend_api\["backend-api<br\/>backend \/ typescript<br\/>データストア所有 \(migration\)"\]:::tier/);
  assert.match(md, /worker\["worker<br\/>worker \/ typescript"\]:::tier/);
  assert.match(md, /datastore\[\("データストア<br\/>RDB 等"\)\]:::store/);
  // 契約は consumer → provider のラベル付き辺
  assert.match(md, /frontend_patron -->\|"api \(openapi\)"\| backend_api/);
  assert.match(md, /worker -->\|"db \(rdb-schema\)"\| backend_api/);
  // datastore は所有者 → データストアの向き
  assert.match(md, /backend_api -->\|所有・migration\| datastore/);
});

test('contexts があるとコンテキストマップ (flowchart) を kind ラベル付きで描く', () => {
  const dir = buildRepo();
  const md = build(opts(dir));
  assert.match(md, /## コンテキストマップ/);
  assert.match(md, /```mermaid\nflowchart LR/);
  assert.match(md, /loan\["貸出コンテキスト<br\/>\(backend-api\)"\]/);
  assert.match(md, /catalog\["蔵書コンテキスト<br\/>\(backend-api\)"\]/);
  assert.match(md, /loan --> \|OHS\| catalog/);
});

test('contexts が無ければコンテキストマップ節を出さない', () => {
  const dir = buildRepo({ withContexts: false });
  const md = build(opts(dir));
  assert.doesNotMatch(md, /## コンテキストマップ/);
});

test('contracts.json が無ければティアのみ描き、契約の辺が無い旨を記す', () => {
  const dir = buildRepo({ withContracts: false });
  const md = build(opts(dir));
  assert.match(md, /```mermaid\ngraph LR/);
  assert.match(md, /backend_api\["backend-api/);
  assert.doesNotMatch(md, /-->\|api/);
  assert.match(md, /契約 \(contracts\.json\) が無いため/);
});

test('RDRA が無ければコンテキスト図を省略し、コンテナ図は描く', () => {
  const dir = buildRepo({ withRdra: false });
  const md = build(opts(dir));
  assert.match(md, /アクター \/ 外部システムの情報 \(RDRA\) が無いため省略/);
  assert.match(md, /```mermaid\ngraph LR\n  subgraph sys/);
});

test('Mermaid の予約語 (end 等) や数字始まりのティア ID はノード ID に接頭辞を付け、ラベルは元のまま', () => {
  const { renderContainerDiagram } = require('../../../plugins/distillery2/skills/d2-decide/scripts/genArchitectureDoc');
  const md = renderContainerDiagram('S', [{ id: 'end', kind: 'backend', lang: 'cpp' }, { id: '3d', kind: 'frontend', lang: 'ts' }], 'end', [{ id: 'api', type: 'openapi', provider: 'end', consumers: ['3d'] }], []);
  assert.match(md, /n_end\["end<br\/>backend \/ cpp<br\/>データストア所有 \(migration\)"\]:::tier/);
  assert.match(md, /a_3d\["3d<br\/>frontend \/ ts"\]:::tier/);
  assert.match(md, /a_3d -->\|"api \(openapi\)"\| n_end/);
  assert.match(md, /n_end -->\|所有・migration\| datastore/);
  assert.doesNotMatch(md, /^\s+end\[/m);
  // 別のティア名が同じ ID に潰れない (end と n_end、a-b と a_b)
  const md2 = renderContainerDiagram('S', [{ id: 'end' }, { id: 'n_end' }, { id: 'a-b' }, { id: 'a_b' }], null, [{ id: 'api', type: 'openapi', provider: 'end', consumers: ['n_end'] }], []);
  assert.match(md2, /n_end\["end</);
  assert.match(md2, /n_end_2\["n_end</);
  assert.match(md2, /n_end_2 -->\|"api \(openapi\)"\| n_end/);
  assert.match(md2, /a_b\["a-b</);
  assert.match(md2, /a_b_2\["a_b</);
  // 固定要素 (sys / datastore / ext_N) と同名のティアも別ノードになる
  const md3 = renderContainerDiagram('S', [{ id: 'datastore' }, { id: 'ext_1' }, { id: 'sys' }], 'datastore', [], ['メール']);
  assert.match(md3, /datastore_2\["datastore</);
  assert.match(md3, /datastore\[\("データストア/);
  assert.match(md3, /datastore_2 -->\|所有・migration\| datastore/);
  assert.match(md3, /ext_1_2\["ext_1</);
  assert.match(md3, /ext_1\["メール"\]:::external/);
  assert.match(md3, /sys_2\["sys</);
});

test('決定論: 同じ入力なら 2 回の生成がバイト一致する', () => {
  const dir = buildRepo();
  const a = build(opts(dir));
  const b = build(opts(dir));
  assert.equal(a, b);
});

test('実サンプル (library-loan) の ADR・RDRA・contracts から C4 図を決定論的に生成する', () => {
  // 読み取り専用の実サンプルを入力にし、build は純粋関数なのでファイルは書かない
  const sample = path.resolve(__dirname, '../../../samples/distillery2/library-loan');
  if (!fs.existsSync(sample)) return; // サンプル未同梱の環境ではスキップ
  const o = {
    cwd: sample, adrDir: 'docs/adr', contracts: 'contracts/contracts.json',
    rdra: 'docs/requirements/rdra', docsRoot: 'docs', dirs: {},
  };
  const a = build(o);
  assert.match(a, /## システムコンテキスト図\n\n```mermaid\ngraph LR/);
  assert.match(a, /## コンテナ図\n\n```mermaid\ngraph LR\n  subgraph sys/);
  assert.doesNotMatch(a, /C4Context|C4Container/);
  // 契約辺は consumer → provider
  assert.match(a, /frontend -->\|"library-api \(openapi\)"\| backend_api/); // 0.1.13 の実走: ティアは frontend / backend-api / worker、契約 id は library-api
  // 2 回の生成がバイト一致 (環境非依存の決定論)
  const b = build(o);
  assert.equal(a, b);
});
