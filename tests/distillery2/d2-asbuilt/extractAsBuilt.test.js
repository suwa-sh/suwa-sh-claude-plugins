'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPTS = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-asbuilt/scripts');
const LIB = path.resolve(__dirname, '../../../plugins/distillery2/scripts/lib');
const { run, buildIndexMd, collect, extractPreserved, latestDecisions, decisionFor, buildDependencyGraph } = require(path.join(SCRIPTS, 'extractAsBuilt'));
const { writeCanonicalJson, readCanonicalJson } = require(path.join(LIB, 'canonicalJson'));

// --- フェイクリポジトリを組み立てる -----------------------------------------

function W(dir, rel, content) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n');
  return p;
}

const CONFIG = `schema_version: "2.0"
docs_root: docs
tiers:
  - id: backend-api
    dir: apps/backend-api
    kind: backend
    lang: typescript
contracts:
  - id: api
    type: openapi
    source: contracts/openapi/openapi.yaml
    provider: backend-api
`;

const USE_CASES = `version: "2.0"
system_name: "図書館システム"
use_cases:
  - uc_id: "348d7250"
    business: "貸出業務"
    buc: "書籍を貸し出す"
    uc: "貸出を登録する"
    slug: "register-loan"
    spec_ids: ["SPEC-001-01"]
    actors: ["司書"]
    status: "in_progress"
`;

const REQUIREMENTS = `version: "1.0"
system_name: "図書館システム"
requirements:
  - id: "REQ-001"
    requirement: "貸出を管理できる"
    specifications:
      - id: "SPEC-001-01"
        specification: "司書が貸出を登録できる"
        acceptance_criteria:
          - "Given 在庫あり When 貸出登録 Then 貸出中になる"
          - "Given 上限到達 When 貸出登録 Then 拒否する"
`;

const SCREENS = `screens:
  - name: 貸出登録画面
    uc: register-loan
    components: [LoanForm, BookPicker]
    variants: [default, error]
`;

const SC1 = 'register-loan#在庫ありの書籍を貸し出す';
const SC2 = 'register-loan#上限を超える貸出を拒否する';

function traceLine(scenario, kind, name, meta) { return JSON.stringify({ ts: '2026-09-23T10:00:00.000Z', scenario, kind, name, meta }); }

const TRACE1 = [
  traceLine(SC1, 'http.in', 'backend-api', { method: 'POST', path: '/loans', status: 201, operationId: 'createLoan', tier: 'backend-api' }),
  traceLine(SC1, 'call', null, { component: 'LoanService', fn: 'register', tier: 'backend-api' }),
  traceLine(SC1, 'db.query', null, { sql: 'SELECT * FROM books WHERE id=$1', tables: ['books'], component: 'LoanRepo' }),
  traceLine(SC1, 'db.query', null, { sql: 'SELECT * FROM books WHERE id=$1', tables: ['books'], component: 'LoanRepo' }),
  traceLine(SC1, 'db.query', null, { sql: 'INSERT INTO loans (id) VALUES ($1)', tables: ['loans'], component: 'LoanRepo' }),
  traceLine(SC1, 'publish', null, { message: 'loan.registered', channel: 'loans', component: 'LoanService' }),
].join('\n') + '\n';

const TRACE2 = [
  traceLine(SC2, 'http.in', 'backend-api', { method: 'POST', path: '/loans', status: 422, operationId: 'createLoan', tier: 'backend-api' }),
  traceLine(SC2, 'db.query', null, { sql: 'SELECT count(*) FROM loans', tables: ['loans'], component: 'LoanRepo' }),
].join('\n') + '\n';

const UC_BDD = [
  {
    name: '貸出を登録する',
    elements: [
      { type: 'scenario', name: '在庫ありの書籍を貸し出す', tags: [{ name: '@uc:register-loan' }, { name: '@acceptance:SPEC-001-01-1' }], steps: [{ result: { status: 'passed', duration: 1000000 } }, { result: { status: 'passed', duration: 2000000 } }] },
      { type: 'scenario', name: '上限を超える貸出を拒否する', tags: [{ name: '@uc:register-loan' }, { name: '@acceptance:SPEC-001-01-2' }], steps: [{ result: { status: 'passed', duration: 500000 } }] },
    ],
  },
];

const UNIT = { numTotalTests: 5, numPassedTests: 5, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0, testResults: [] };
const CONTRACT = { numTotalTests: 2, numPassedTests: 2, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0, testResults: [] };

const GATES = { uc: 'register-loan', started_at: 'x', finished_at: 'y', result: 'pass', gates: [{ name: 'static', status: 'pass' }, { name: 'unit', status: 'pass' }, { name: 'contract', status: 'pass' }, { name: 'uc-bdd', status: 'pass' }, { name: 'acceptance', status: 'skipped' }] };

const ASSUMPTIONS = `schema_version: "2.0"
uc: "register-loan"
tier: "backend-api"
attempt: 1
extraction:
  candidate_count: 2
  excluded_as_explicit: 0
  recorded_count: 2
assumptions:
  - id: A-001
    category: persistence
    assumption: "貸出は単一トランザクションで登録する"
    target: "apps/backend-api/src/usecase/registerLoan.ts:40"
    reason: "契約に境界の定義が無い"
    confidence: medium
    spec_refs: ["contracts/db/rdb-schema.yaml#loans"]
  - id: A-002
    category: data_format
    assumption: "due_at は日付のみで記録する"
    target: "apps/backend-api/src/domain/loan.ts:28"
    reason: "精度の定義が無い"
    confidence: medium
    spec_refs: ["contracts/db/rdb-schema.yaml#loans"]
`;

const FINDINGS = `schema_version: "2.0"
uc: "register-loan"
tier: "backend-api"
attempt: 1
assumption_verdicts:
  - id: A-001
    tier: backend-api
    verdict: spec_absent
    finding_id: F-001
  - id: A-002
    tier: backend-api
    verdict: consistent
    finding_id: F-002
findings:
  - id: F-001
    viewpoint: assumption_conformance
    kind: spec_absent
    severity: major
    target: "apps/backend-api/src/usecase/registerLoan.ts:40"
    claim: "トランザクション境界を実装者が決めた"
  - id: F-003
    viewpoint: uc_intent
    kind: rule_not_enforced
    severity: minor
    claim: "上限チェックの位置が読み取りにくい"
summary: {blocker: 0, major: 1, minor: 1}
`;

const EVENTS = [
  { seq: 1, ts: '2026-09-23T09:00:00.000Z', type: 'run_opened', slug: 'register-loan' },
  { seq: 2, ts: '2026-09-23T09:30:00.000Z', type: 'stage_completed', stage: 'verify', attempt: 1 },
  { seq: 3, ts: '2026-09-23T10:00:00.000Z', type: 'review_approved', assumption_decisions: [{ id: 'A-001', decision: 'confirmed' }, { id: 'A-002', decision: 'auto_confirmed' }] },
].map((e) => JSON.stringify(e)).join('\n') + '\n';

const ISSUE = `---
kind: rule
title: "貸出上限のルールが契約に無い"
---
本文。
`;

const SLICE = { schema_version: '1.0', uc: 'register-loan', openapi: { paths: { '/loans': { post: { operationId: 'createLoan' } } } }, asyncapi: null };

const OPENAPI_BUNDLE = `openapi: "3.1.0"
paths:
  /loans:
    post:
      operationId: createLoan
  /loans/{id}/return:
    post:
      operationId: returnLoan
`;

const CHANGED = 'apps/backend-api/src/usecase/registerLoan.ts\napps/backend-api/src/domain/loan.ts\nREADME.md\n';

function buildRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2ab-'));
  W(dir, '.distillery/config.yaml', CONFIG);
  W(dir, 'docs/requirements/use-cases.yaml', USE_CASES);
  W(dir, 'docs/requirements/requirements.yaml', REQUIREMENTS);
  W(dir, 'docs/design/screens.yaml', SCREENS);
  const runDir = path.join(dir, '.distillery/runs/register-loan');
  W(dir, '.distillery/runs/register-loan/events.jsonl', EVENTS);
  W(dir, '.distillery/runs/register-loan/reports/gates.json', GATES);
  W(dir, '.distillery/runs/register-loan/reports/uc-bdd.json', UC_BDD);
  W(dir, '.distillery/runs/register-loan/reports/unit.backend-api.json', UNIT);
  W(dir, '.distillery/runs/register-loan/reports/contract.backend-api.json', CONTRACT);
  W(dir, '.distillery/runs/register-loan/traces/sc1.jsonl', TRACE1);
  W(dir, '.distillery/runs/register-loan/traces/sc2.jsonl', TRACE2);
  W(dir, '.distillery/runs/register-loan/attempt-1/assumptions.backend-api.yaml', ASSUMPTIONS);
  W(dir, '.distillery/runs/register-loan/attempt-1/findings.backend-api.yaml', FINDINGS);
  W(dir, '.distillery/runs/register-loan/issues/001_limit.md', ISSUE);
  W(dir, 'contracts/generated/slices/register-loan/contract-slice.json', SLICE);
  W(dir, 'contracts/generated/openapi.bundle.yaml', OPENAPI_BUNDLE);
  W(dir, 'changed.txt', CHANGED);
  return { dir, runDir, changed: path.join(dir, 'changed.txt') };
}

function opts(repo) { return { cwd: repo.dir, run: repo.runDir, config: '.distillery/config.yaml', changed: repo.changed }; }

// --- テスト ------------------------------------------------------------------

test('index.md は読者の問いの順の節と、名前付きの要約ブロック 3 つを持つ', () => {
  const repo = buildRepo();
  run(opts(repo));
  const md = fs.readFileSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  const headings = ['## 結果 (抽出)', '## 入口 (抽出)', '## どう動くか (抽出)', '### データの流れ', '## 何を守るか (要約)', '## 決めたこと (転記)', '## 課題 (抽出 + 要約)', '## 証跡 (抽出)', '## 付録 (抽出)'];
  let last = -1;
  for (const h of headings) { const i = md.indexOf(h); assert.ok(i >= 0, `missing: ${h}`); assert.ok(i > last, `順序が違う: ${h}`); last = i; }
  for (const n of ['概要', '整合性', '課題']) assert.ok(md.includes(`<!-- 要約:begin ${n} -->`), `要約ブロック ${n}`);
  // 旧 9 節の見出しは出ない
  assert.doesNotMatch(md, /## 1\. 見出し/);
  // 内部 ID は読める言葉に置き換わる
  assert.doesNotMatch(md, /spec_absent|auto_confirmed/);
  assert.match(md, /仕様に無い/);
  assert.match(md, /自動承認した前提 \(1\)/);
  assert.match(md, /人が承認した前提 \(1\)/);
  // 結果の表
  assert.match(md, /\| ゲート \| 5 段すべて pass \|/);
  assert.match(md, /\| 受入基準 \| 2 \/ 2 をシナリオが覆う \|/);
  assert.match(md, /\| 計装の範囲 \| backend-api \|/);
  // 変更ファイルは付録の折りたたみ
  assert.match(md, /<summary>変更ファイル \(3\)<\/summary>/);
});

test('front matter に basis / generated_at / code / uc / slug がある', () => {
  const repo = buildRepo();
  run(opts(repo));
  const md = fs.readFileSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  const fm = md.split('---')[1];
  assert.match(fm, /basis:/);
  assert.match(fm, /generated_at: 2026-09-23T10:00:00\.000Z/); // 最新イベント ts
  assert.match(fm, /code:/);
  assert.match(fm, /uc: 貸出を登録する/);
  assert.match(fm, /slug: register-loan/);
});

test('抽出節にトレース由来の operation / table / message / 前提が出る', () => {
  const repo = buildRepo();
  run(opts(repo));
  const md = fs.readFileSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  assert.match(md, /\| API \| createLoan \(POST \/loans\) \|/); // slice からパス
  assert.match(md, /loan\.registered/);
  assert.match(md, /\[\(books\)\]/); // データフロー図のテーブル
  assert.match(md, /\| 画面 \| 貸出登録画面 \|/);
  assert.match(md, /\| backend-api \| 永続化 \| 貸出は単一トランザクションで登録する \| \*\*仕様に無い \(major\)\*\* \| registerLoan\.ts:40 \|/);
  assert.match(md, /\| ルール \| 貸出上限のルールが契約に無い \|/); // issues
  assert.match(md, /apps\/backend-api\/src\/usecase\/registerLoan\.ts/); // 付録の変更ファイル
  assert.match(md, /主要な部品 .*\n\n- backend-api: LoanService/);
});

test('sequence.md はトレースごとに 1 つの sequenceDiagram を持ち、index には正常系 1 本と分岐表が出る', () => {
  const repo = buildRepo();
  run(opts(repo));
  const md = fs.readFileSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/sequence.md'), 'utf8');
  const diagrams = md.match(/sequenceDiagram/g) || [];
  assert.equal(diagrams.length, 2);
  assert.match(md, /SELECT books \(x2\)/); // db collapse
  // 見出しは slug# を外したシナリオ名、アクターは use-cases.yaml の actors
  assert.match(md, /## 在庫ありの書籍を貸し出す/);
  assert.doesNotMatch(md, /## register-loan#/);
  assert.match(md, /actor p0 as 司書/);
  const index = fs.readFileSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  assert.match(index, /正常系: 在庫ありの書籍を貸し出す/);
  assert.equal((index.match(/sequenceDiagram/g) || []).length, 1);
  assert.match(index, /\| 上限を超える貸出を拒否する \| 422 \| なし \| なし \|/);
});

test('受入基準 → シナリオの対応は index.md の証跡に出る (coverage.md は作らない・古いものは消す)', () => {
  const repo = buildRepo();
  W(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/coverage.md', 'old\n');
  run(opts(repo));
  const md = fs.readFileSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  assert.match(md, /\| SPEC-001-01-1 Given 在庫あり When 貸出登録 Then 貸出中になる \| 在庫ありの書籍を貸し出す \(passed\) \|/);
  assert.match(md, /\| SPEC-001-01-2 .* \| 上限を超える貸出を拒否する \(passed\) \|/);
  assert.ok(!fs.existsSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/coverage.md')));
});

test('traceability-index.json は canonical で、他 UC のエントリとマージする', () => {
  const repo = buildRepo();
  // 既存の別 UC エントリ (canonical) を先に置く
  const idxPath = path.join(repo.dir, 'docs/as-built/_system/traceability-index.json');
  fs.mkdirSync(path.dirname(idxPath), { recursive: true });
  writeCanonicalJson(idxPath, sortDeep({
    acceptance: {}, operations: {}, tables: {},
    ucs: { 'return-loan': { as_built: 'docs/as-built/貸出業務/返却を登録する/', business: '貸出業務', files: [], gates: 'pass', generated_at: '2026-09-20T00:00:00.000Z', messages: [], operations: ['returnLoan'], scenarios: [], spec_ids: ['SPEC-001-02'], tables: ['loans'], uc: '返却を登録する' } },
  }));
  run(opts(repo));
  const idx = readCanonicalJson(idxPath); // canonical でなければ throw
  assert.ok(idx.ucs['register-loan']);
  assert.ok(idx.ucs['return-loan'], '既存 UC が消えた');
  assert.deepEqual(idx.operations.createLoan, { provider_tier: 'backend-api', ucs: ['register-loan'] });
  assert.deepEqual(idx.operations.returnLoan.ucs, ['return-loan']);
  assert.deepEqual(idx.tables.loans.ucs, ['register-loan', 'return-loan']); // マージして昇順
  assert.deepEqual(idx.acceptance['SPEC-001-01-1'], { scenarios: ['在庫ありの書籍を貸し出す'], ucs: ['register-loan'] });
});

test('部分実行 (missing ゲート) は総合を pass とせず部分実行と明示し、index に gates_complete:false を持つ', () => {
  const repo = buildRepo();
  // 未実行段 (acceptance) を missing にした部分実行。result は pass だが all_recorded は false。
  const partial = { uc: 'register-loan', result: 'pass', all_recorded: false, gates: [
    { name: 'static', status: 'pass' }, { name: 'unit', status: 'pass' }, { name: 'contract', status: 'pass' },
    { name: 'uc-bdd', status: 'pass' }, { name: 'acceptance', status: 'missing' },
  ] };
  W(repo.dir, '.distillery/runs/register-loan/reports/gates.json', JSON.stringify(partial, null, 2) + '\n');
  run(opts(repo));
  const md = fs.readFileSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  assert.match(md, /\| ゲート \| 部分実行 \(未実行: acceptance\) \|/, '総合を部分実行と明示する');
  assert.doesNotMatch(md, /\| ゲート \| 5 段すべて pass \|/, '未完了なのに総合 pass と書かない');
  assert.match(md, /ゲート: static pass \/ unit pass \/ contract pass \/ uc-bdd pass \/ acceptance missing/);
  const idx = readCanonicalJson(path.join(repo.dir, 'docs/as-built/_system/traceability-index.json'));
  assert.equal(idx.ucs['register-loan'].gates_complete, false);
});

test('api-inventory は未使用・未実装を印付けする', () => {
  const repo = buildRepo();
  run(opts(repo));
  const md = fs.readFileSync(path.join(repo.dir, 'docs/as-built/_system/api-inventory.md'), 'utf8');
  assert.match(md, /createLoan \| POST \/loans \| backend-api \| register-loan \| 実装済み/);
  assert.match(md, /returnLoan \| POST \/loans\/\{id\}\/return \| backend-api \| - \| 未実装, 未使用/);
});

test('2 回目の実行はバイト一致する (generated_at は最新イベント ts で固定)', () => {
  const repo = buildRepo();
  run(opts(repo));
  const files = [
    'docs/as-built/貸出業務/貸出を登録する/index.md',
    'docs/as-built/貸出業務/貸出を登録する/sequence.md',
    'docs/as-built/_system/traceability-index.json',
    'docs/as-built/_system/data-flow.md',
    'docs/as-built/_system/api-inventory.md',
  ];
  const before = files.map((f) => fs.readFileSync(path.join(repo.dir, f)));
  run(opts(repo));
  const after = files.map((f) => fs.readFileSync(path.join(repo.dir, f)));
  for (let i = 0; i < files.length; i++) assert.ok(before[i].equals(after[i]), `changed on re-run: ${files[i]}`);
});

test('手書きの 要約 ブロックは名前で再実行に持ち越され、旧形式 (名前無し) は順序で対応づける', () => {
  const repo = buildRepo();
  run(opts(repo));
  const p = path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md');
  let md = fs.readFileSync(p, 'utf8');
  md = md.replace('<!-- 要約:begin 整合性 -->\n<!-- 要約:end -->', '<!-- 要約:begin 整合性 -->\n貸出は registerLoan.ts:40 で単一トランザクションにまとめている。\n<!-- 要約:end -->');
  md = md.replace('<!-- 要約:begin 概要 -->\n<!-- 要約:end -->', '<!-- 要約:begin 概要 -->\n司書が貸出を登録する。\n<!-- 要約:end -->');
  fs.writeFileSync(p, md);
  run(opts(repo));
  const after = fs.readFileSync(p, 'utf8');
  assert.match(after, /<!-- 要約:begin 概要 -->\n司書が貸出を登録する。\n<!-- 要約:end -->/);
  assert.match(after, /<!-- 要約:begin 整合性 -->\n貸出は registerLoan\.ts:40 で単一トランザクションにまとめている。\n<!-- 要約:end -->/);
  assert.deepEqual(Object.keys(extractPreserved(after)).sort(), ['整合性', '概要']);
  // 旧形式: 名前無しブロック 2 つは 整合性 / 課題 の順
  const legacy = '<!-- 要約:begin -->\nA\n<!-- 要約:end -->\nx\n<!-- 要約:begin -->\nB\n<!-- 要約:end -->';
  assert.deepEqual(extractPreserved(legacy), { '整合性': 'A', '課題': 'B' });
});

test('入力が欠けても落ちない (トレース・レポートなし)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2ab-min-'));
  W(dir, '.distillery/config.yaml', CONFIG);
  W(dir, 'docs/requirements/use-cases.yaml', USE_CASES);
  const runDir = path.join(dir, '.distillery/runs/register-loan');
  W(dir, '.distillery/runs/register-loan/events.jsonl', '{"seq":1,"ts":"2026-09-23T09:00:00.000Z","type":"run_opened","slug":"register-loan"}\n');
  const r = run({ cwd: dir, run: runDir, config: '.distillery/config.yaml' });
  assert.equal(r.slug, 'register-loan');
  const md = fs.readFileSync(path.join(dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  assert.match(md, /トレースなし/);
});

test('acceptance-browser.json のシナリオを証跡・追跡表に取り込む (Finding 7)', () => {
  const repo = buildRepo();
  const BROWSER = [{
    name: 'ブラウザ受入',
    elements: [
      { type: 'scenario', name: 'ブラウザで貸出する', tags: [{ name: '@acceptance:SPEC-001-01-1' }, { name: '@browser' }], steps: [{ result: { status: 'failed', duration: 3000000 } }] },
    ],
  }];
  W(repo.dir, '.distillery/runs/register-loan/reports/acceptance-browser.json', JSON.stringify(BROWSER, null, 2) + '\n');
  run(opts(repo));
  const md = fs.readFileSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  // 付録のシナリオ表にブラウザシナリオが失敗として出る (種別は 受入・ブラウザ)
  assert.match(md, /\| ブラウザで貸出する \| 受入・ブラウザ \| failed \| 3 \|/);
  assert.match(md, /\| シナリオ \| 3 本中 2 本 pass \(受入 3、ブラウザ 1\) \|/);
  // 追跡表 (traceability-index) にもマージされる
  const idx = readCanonicalJson(path.join(repo.dir, 'docs/as-built/_system/traceability-index.json'));
  const names = idx.ucs['register-loan'].scenarios.map((s) => s.name);
  assert.ok(names.includes('ブラウザで貸出する'), 'browser scenario merged into traceability');
});

test('計装の範囲: 全トレースに無いティアは「計装なし」、正常系に call が無いティアは「正常系に部品なし」', () => {
  const { instrumentationCoverage } = require(path.join(SCRIPTS, 'extractAsBuilt'));
  const ev = (kind, meta, status) => ({ ts: 't', seq: 1, scenario: 's', kind, name: 'n', meta: { status, ...meta } });
  const uc = { tiers: ['backend-api', 'frontend-staff', 'worker'] };
  const traces = [
    { scenario: 'ok', lines: [ev('http.in', { tier: 'backend-api', path: '/x', method: 'POST' }, 201)] },
    { scenario: 'ng', lines: [ev('http.out', { tier: 'frontend-staff', url: '/x', method: 'POST' }, 409), ev('call', { tier: 'frontend-staff', component: 'S', fn: 'f' })] },
  ];
  const r = instrumentationCoverage(uc, { byTier: {} }, traces, {});
  assert.deepEqual(r.gaps, ['worker']);
  // 正常系 (201 の ok) に call が無い backend-api / frontend-staff は正常系の不備
  assert.deepEqual(r.happy_gaps, ['backend-api', 'frontend-staff']);
  const repo = buildRepo();
  run(opts(repo));
  const md = fs.readFileSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  assert.match(md, /\| 計装の範囲 \| backend-api \|/);
});

test('scenarioStatus は hook の結果を数えない (本体が全部 skipped なら skipped)', () => {
  const { scenarioStatus } = require(path.join(SCRIPTS, 'extractAsBuilt'));
  const skippedWithHook = [
    { keyword: 'Before', name: '', result: { status: 'skipped' } },
    { keyword: '前提', name: 'x', result: { status: 'skipped' } },
    { keyword: 'After', name: '', result: { status: 'passed' } },
  ];
  assert.equal(scenarioStatus(skippedWithHook), 'skipped');
  // hook の失敗はシナリオの失敗
  assert.equal(scenarioStatus([{ keyword: 'Before', name: '', result: { status: 'failed' } }, { keyword: 'もし', name: 'y', result: { status: 'skipped' } }]), 'failed');
  assert.equal(scenarioStatus([{ keyword: 'もし', name: 'y', result: { status: 'passed' } }, { keyword: 'After', name: '', result: { status: 'failed' } }]), 'failed');
  assert.equal(scenarioStatus([{ keyword: 'After', name: '', result: { status: 'passed' } }]), 'passed'); // 本体が無ければ全 step で判定
});

test('前提の処遇は tier + id で引く (別ティアの同 id が上書きしない)', () => {
  const events = [{
    type: 'review_approved',
    assumption_decisions: [
      { tier: 'backend-api', id: 'A-005', decision: '採用(バックエンド)' },
      { tier: 'frontend-staff', id: 'A-005', decision: '却下(フロント)' },
    ],
  }];
  const decisions = latestDecisions(events);
  assert.equal(decisionFor(decisions, 'backend-api', 'A-005').decision, '採用(バックエンド)');
  assert.equal(decisionFor(decisions, 'frontend-staff', 'A-005').decision, '却下(フロント)');
});

test('dependency-graph は depcruise JSON があれば実態を描き違反を出す', () => {
  const depcruise = {
    modules: [
      { source: 'apps/frontend-patron/src/a.ts', dependencies: [{ resolved: 'apps/backend-api/src/x.ts', module: '../backend' }] },
    ],
    summary: { violations: [{ from: 'apps/frontend-patron/src/a.ts', to: 'apps/backend-api/src/x.ts', rule: { name: 'no-cross-tier', severity: 'error' } }] },
  };
  const config = { tiers: [], contracts: [] };
  const md = buildDependencyGraph({ depcruise, config });
  assert.match(md, /## 実態 \(dependency-cruiser\)/);
  // ノード宣言 + プレーンな辺 (ラベルはノード宣言側だけに書く)
  assert.match(md, /n_apps_frontend_patron\["apps\/frontend-patron"\]/);
  assert.match(md, /n_apps_backend_api\["apps\/backend-api"\]/);
  assert.match(md, /n_apps_frontend_patron --> n_apps_backend_api/);
  assert.match(md, /no-cross-tier \| error/);
  assert.doesNotMatch(md, /決定からの図/);
});

test('dependency-graph は実態でティア間の辺が無くても modules[].source からティアをノードに出す', () => {
  const depcruise = {
    // apps/backend-api 内で完結する import だけ (ティア間の依存が無い)
    modules: [
      { source: 'apps/backend-api/src/a.ts', dependencies: [{ resolved: 'apps/backend-api/src/b.ts', module: './b' }] },
      { source: 'apps/backend-api/src/b.ts', dependencies: [] },
    ],
    summary: { violations: [] },
  };
  const md = buildDependencyGraph({ depcruise, config: { tiers: [], contracts: [] } });
  assert.match(md, /## 実態 \(dependency-cruiser\)/);
  // 辺が無くてもティアはノードとして描かれる
  assert.match(md, /n_apps_backend_api\["apps\/backend-api"\]/);
  assert.doesNotMatch(md, /-->/); // ティア間の辺は無い
  assert.match(md, /違反なし。/);
});

test('dependency-graph は depcruise JSON が無ければ config から決定の図を描き実態未取得を明示する', () => {
  const config = {
    tiers: [
      { id: 'frontend-patron', dir: 'apps/frontend-patron' },
      { id: 'backend-api', dir: 'apps/backend-api' },
      { id: 'worker', dir: 'apps/worker' },
    ],
    contracts: [
      { id: 'api', provider: 'backend-api', consumers: ['frontend-patron'] },
      { id: 'db', provider: 'backend-api', consumers: ['worker'] },
    ],
  };
  const md = buildDependencyGraph({ depcruise: null, config });
  assert.match(md, /## 決定からの図 \(dependency-cruiser 未実行\)/);
  assert.match(md, /実態 .* は未取得/);
  // consumer → provider のラベル付き辺
  assert.match(md, /n_apps_frontend_patron -->\|api\| n_apps_backend_api/);
  assert.match(md, /n_apps_worker -->\|db\| n_apps_backend_api/);
  // 全ティアがノードとして出る
  assert.match(md, /n_apps_frontend_patron\["apps\/frontend-patron"\]/);
});

function sortDeep(v) {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v).sort()) o[k] = sortDeep(v[k]); return o; }
  return v;
}
