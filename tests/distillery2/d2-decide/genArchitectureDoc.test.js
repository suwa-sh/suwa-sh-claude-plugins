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

test('システムコンテキスト図に C4Context・アクター (社内/社外)・外部システムが出る', () => {
  const dir = buildRepo();
  const md = build(opts(dir));
  assert.match(md, /## システムコンテキスト図/);
  assert.match(md, /```mermaid\nC4Context/);
  assert.match(md, /Person\(actor_1, "司書"\)/);
  assert.match(md, /Person_Ext\(actor_2, "利用者"\)/); // 社外 → Person_Ext
  assert.match(md, /System\(sys, "図書館システム", ""\)/);
  assert.match(md, /System_Ext\(ext_1, "メール配信サービス", ""\)/);
  assert.match(md, /Rel\(sys, ext_1, "連携する"\)/);
});

test('コンテナ図に C4Container・ティア・契約辺 (provider→consumer)・datastore_owner が出る', () => {
  const dir = buildRepo();
  const md = build(opts(dir));
  assert.match(md, /## コンテナ図/);
  assert.match(md, /```mermaid\nC4Container/);
  assert.match(md, /Container\(backend_api, "backend-api", "backend\/typescript", "データストア所有 \(migration\)"\)/);
  assert.match(md, /Container\(worker, "worker", "worker\/typescript", ""\)/);
  assert.match(md, /ContainerDb\(datastore, "データストア"/);
  // 契約は provider → consumer のラベル付き辺
  assert.match(md, /Rel\(backend_api, frontend_patron, "api \(openapi\)"\)/);
  assert.match(md, /Rel\(backend_api, worker, "db \(rdb-schema\)"\)/);
  assert.match(md, /Rel\(backend_api, datastore, "所有・migration"\)/);
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
  assert.match(md, /```mermaid\nC4Container/);
  assert.match(md, /Container\(backend_api,/);
  assert.doesNotMatch(md, /Rel\(backend_api, frontend_patron/);
  assert.match(md, /契約 \(contracts\.json\) が無いため/);
});

test('RDRA が無ければコンテキスト図を省略し、コンテナ図は描く', () => {
  const dir = buildRepo({ withRdra: false });
  const md = build(opts(dir));
  assert.match(md, /アクター \/ 外部システムの情報 \(RDRA\) が無いため省略/);
  assert.match(md, /```mermaid\nC4Container/);
});

test('決定論: 同じ入力なら 2 回の生成がバイト一致する', () => {
  const dir = buildRepo();
  const a = build(opts(dir));
  const b = build(opts(dir));
  assert.equal(a, b);
});
