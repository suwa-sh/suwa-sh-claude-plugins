'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPTS = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-asbuilt/scripts');
const LIB = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-common/scripts/lib');
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
    title: "単一トランザクションで登録"
    assumption: "貸出は単一トランザクションで登録する"
    target: "apps/backend-api/src/usecase/registerLoan.ts:40"
    reason: "契約に境界の定義が無い"
    confidence: medium
    spec_refs: ["contracts/db/rdb-schema.yaml#loans"]
  - id: A-002
    category: data_format
    title: "due_at は日付のみ"
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
    title: "トランザクション境界は仕様に無い"
    target: "apps/backend-api/src/usecase/registerLoan.ts:40"
    claim: "トランザクション境界を実装者が決めた"
  - id: F-003
    viewpoint: uc_intent
    kind: rule_not_enforced
    severity: minor
    title: "上限チェックの位置"
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

test('推奨案を採った承認 (by: recommended) は「人が承認」と書かない', () => {
  const repo = buildRepo();
  const ev = EVENTS.replace('{"id":"A-001","decision":"confirmed"}', '{"id":"A-001","decision":"confirmed","by":"recommended"}');
  assert.notEqual(ev, EVENTS);
  W(repo.dir, '.distillery/runs/register-loan/events.jsonl', ev);
  run(opts(repo));
  const md = fs.readFileSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  assert.match(md, /推奨案で承認した前提 \(1\)/);
  assert.match(md, /推奨案で承認 1/);
  assert.doesNotMatch(md, /人が承認/);
  // 前提ごとの by が無ければ、イベントの by を使う
  const ev2 = EVENTS.replace('"type":"review_approved"', '"type":"review_approved","by":"recommended"');
  assert.notEqual(ev2, EVENTS);
  W(repo.dir, '.distillery/runs/register-loan/events.jsonl', ev2);
  run(opts(repo));
  const md2 = fs.readFileSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  assert.match(md2, /推奨案で承認した前提 \(1\)/);
  assert.match(md2, /自動承認した前提 \(1\)/);
  assert.doesNotMatch(md2, /人が承認/);
});

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
  assert.match(md, /\| 計装の範囲 \(backend-api\) \| 部品名のみ \|/);
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
  assert.match(md, /\| backend-api \| 永続化 \| 単一トランザクションで登録 \| \*\*仕様に無い \(major\)\*\* \| registerLoan\.ts:40 \|/); // 表は見出し
  assert.match(md, /- \*\*単一トランザクションで登録\*\* \(backend-api\): 貸出は単一トランザクションで登録する/); // 全文は折りたたみ
  assert.match(md, /- 上限チェックの位置 \(backend-api\)/); // 指摘は見出し
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
  assert.match(md, /\| SPEC-001-01-1 \| Given 在庫あり<br>When 貸出登録<br>Then 貸出中になる \| 在庫ありの書籍を貸し出す \(passed\) \|/);
  assert.match(md, /\| SPEC-001-01-2 \| .* \| 上限を超える貸出を拒否する \(passed\) \|/);
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
  assert.match(md, /\| 計装の範囲 \(backend-api\) \| 部品名のみ \|/);
});

test('入口の上流リンク (要求 / シナリオ / 契約) は as-built から見た相対パスで、セグメントごとに URL エンコードする', () => {
  const repo = buildRepo();
  W(repo.dir, 'features/貸出業務/flow#1.feature', '@uc:register-loan\n機能: x\n');
  W(repo.dir, 'docs/requirements/requirements.md', '# USDM\n');
  run(opts(repo));
  const md = fs.readFileSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  assert.match(md, /\| 要求 \| SPEC-001-01 \(\[要求仕様書\]\(\.\.\/\.\.\/\.\.\/requirements\/requirements\.md\)\) \|/); // docs/as-built/<業務>/<UC>/ から docs/ は 3 つ上
  assert.match(md, /\| シナリオ \| \[flow#1\.feature\]\(\.\.\/\.\.\/\.\.\/\.\.\/features\/%E8%B2%B8%E5%87%BA%E6%A5%AD%E5%8B%99\/flow%231\.feature\) \|/);
  assert.match(md, /\| 契約 \| \[contract-slice\.json\]\(\.\.\/\.\.\/\.\.\/\.\.\/contracts\/generated\/slices\/register-loan\/contract-slice\.json\) \|/);
});

test('_system/index.md は「実装の記録 (UC ごと)」で、UC 名のリンクが実在する index.md を指す (docs_root を変えても)', () => {
  for (const docsRoot of ['docs', 'documents/spec']) {
    const repo = buildRepo();
    if (docsRoot !== 'docs') {
      fs.renameSync(path.join(repo.dir, 'docs'), path.join(repo.dir, 'docs.tmp'));
      fs.mkdirSync(path.join(repo.dir, 'documents'), { recursive: true });
      fs.renameSync(path.join(repo.dir, 'docs.tmp'), path.join(repo.dir, docsRoot));
      W(repo.dir, '.distillery/config.yaml', CONFIG.replace('docs_root: docs', `docs_root: ${docsRoot}`));
    }
    run(opts(repo));
    const sysDir = path.join(repo.dir, docsRoot, 'as-built/_system');
    const md = fs.readFileSync(path.join(sysDir, 'index.md'), 'utf8');
    assert.match(md, /^# 実装の記録 \(UC ごと\)/m);
    assert.match(md, /\| 業務 \| UC \(記録へ\) \| ゲート \| 生成日時 \|/);
    assert.doesNotMatch(md, /\| slug \||\[index\]/);
    const m = md.match(/\| 貸出業務 \| \[貸出を登録する\]\(([^)]+)\) \| pass \|/);
    assert.ok(m, `UC 名のリンク (docs_root=${docsRoot}): ${md}`);
    const target = path.resolve(sysDir, decodeURIComponent(m[1]));
    assert.ok(fs.existsSync(target), `リンク先が実在する: ${target}`);
    assert.equal(path.basename(path.dirname(target)), '貸出を登録する');
  }
});

test('生成情報に実行したモデルを出す (events の models_resolved。無ければ config の設定値と明示)', () => {
  const repo = buildRepo();
  run(opts(repo));
  let md = fs.readFileSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  assert.match(md, /- モデル: 実装 セッション既定 \(未解決\) \/ 検証 不明 \(config の設定値。実行時の解決名は未記録\)/);
  fs.appendFileSync(path.join(repo.runDir, 'events.jsonl'), JSON.stringify({ seq: 4, ts: '2026-09-23T10:00:00.000Z', type: 'models_resolved', session: 'claude-opus-5-5', implementer: 'claude-opus-5-5', verifier: 'claude-opus-4-7' }) + '\n');
  run(opts(repo));
  md = fs.readFileSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  assert.match(md, /- モデル: 実装 claude-opus-5-5 \/ 検証 claude-opus-4-7 \/ オーケストレータ claude-opus-5-5/);
  // 欠けたキーは「不明」と明示する (項目を消さない)
  fs.appendFileSync(path.join(repo.runDir, 'events.jsonl'), JSON.stringify({ seq: 5, ts: '2026-09-23T10:00:01.000Z', type: 'models_resolved', implementer: 'x' }) + '\n');
  run(opts(repo));
  md = fs.readFileSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  assert.match(md, /- モデル: 実装 x \/ 検証 不明 \/ オーケストレータ 不明/);
  // 別名と注記の長い文字列が入っても最初の語だけ使う (0.1.10 実走 ④-12)
  fs.appendFileSync(path.join(repo.runDir, 'events.jsonl'), JSON.stringify({ seq: 6, ts: '2026-09-23T10:00:02.000Z', type: 'models_resolved', session: 'claude-opus-5-5', implementer: 'claude-opus-5-5', verifier: 'opus (Agent model alias; resolves to claude-opus-4-7)' }) + '\n');
  run(opts(repo));
  md = fs.readFileSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  assert.match(md, /- モデル: 実装 claude-opus-5-5 \/ 検証 opus \/ オーケストレータ claude-opus-5-5/);
  assert.ok(!md.includes('Agent model alias'));
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

test('--dry-run は何も書かずに計装の集計だけ返す (integrate 担当が docs/as-built を書かないため。0.1.16)', () => {
  const repo = buildRepo();
  const before = fs.existsSync(path.join(repo.dir, 'docs/as-built'));
  const r = run({ ...opts(repo), dryRun: true });
  assert.equal(r.dry_run, true);
  assert.equal(typeof r.scenarios, 'number');
  assert.ok(Array.isArray(r.instrumentation_gaps));
  assert.equal(fs.existsSync(path.join(repo.dir, 'docs/as-built')), before, 'dry-run で docs/as-built を作らない');
  assert.ok(!fs.existsSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md')));
  assert.ok(!fs.existsSync(path.join(repo.runDir, 'reports/asbuilt.json')), 'dry-run で集計ファイルを書かない');
  // 本番実行は書く
  run(opts(repo));
  assert.ok(fs.existsSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md')));
});

test('集計ファイル reports/asbuilt.json に、どの実行の結果かと計装の集計を書く (d2-run が受理時に読む。0.1.22)', () => {
  const repo = buildRepo();
  const r = run(opts(repo));
  const file = path.join(repo.runDir, 'reports/asbuilt.json');
  assert.equal(r.report, file);
  const rep = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(rep.slug, path.basename(repo.runDir));
  assert.equal(rep.attempt, require(path.join(LIB, 'runState')).currentAttempt(repo.runDir), 'attempt は runState と同じ数え方');
  assert.equal(typeof rep.generated_at, 'string');
  assert.deepEqual(rep.instrumentation_gaps, r.instrumentation_gaps);
  assert.deepEqual(rep.instrumentation_happy_gaps, r.instrumentation_happy_gaps);
  assert.equal(rep.summary_violations, r.summary_violations);
  assert.deepEqual(fs.readdirSync(path.dirname(file)).filter(n => n.includes('.tmp-')), [], '一時ファイルを残さない');
});

test('0.1.32 J2: 要求の差分で閉じた前提 (assumption_resolved) は処遇 resolved になり、最新の attempt の target だけ読む。review_approved の決定より勝つ', () => {
  const { resolvedDecisions } = require(path.join(SCRIPTS, 'extractAsBuilt'));
  const events = [
    { type: 'review_approved', assumption_decisions: [{ tier: 'frontend', id: 'A-004', decision: 'auto_confirmed' }, { tier: 'frontend', id: 'A-006', decision: 'confirmed' }] },
    { type: 'assumption_resolved', targets: [{ tier: 'frontend', attempt: 1, id: 'A-005' }, { tier: 'frontend', attempt: 2, id: 'A-004' }, { tier: 'backend-api', attempt: 2, id: 'A-004' }], decision: '貸出日は登録時に決まる', by: 'req: feedback' },
  ];
  const resolved = resolvedDecisions(events, 2);
  assert.equal(decisionFor(resolved, 'frontend', 'A-004').decision, 'resolved');
  assert.equal(decisionFor(resolved, 'frontend', 'A-004').note, '貸出日は登録時に決まる');
  assert.equal(decisionFor(resolved, 'backend-api', 'A-004').decision, 'resolved');
  assert.equal(decisionFor(resolved, 'frontend', 'A-005'), undefined, '最新でない attempt の target は as-built に出ないので読まない');
  const merged = { ...latestDecisions(events), ...resolved };
  assert.equal(decisionFor(merged, 'frontend', 'A-004').decision, 'resolved', '閉じた印が review の決定より勝つ');
  assert.equal(decisionFor(merged, 'frontend', 'A-006').decision, 'confirmed');
});

test('片付いた課題は未決に数えない: 上流の差分が反映か取り下げをした課題と、この UC の段に渡した課題 (実地確認: 閉じた課題が未決の件数に残った)', () => {
  const repo = buildRepo();
  const issue = (kind, title) => `---\nkind: ${kind}\ntitle: "${title}"\n---\n本文。\n`;
  W(repo.dir, '.distillery/runs/register-loan/issues/002_upstream.md', issue('foundation', '部品が理由を出せない'));
  W(repo.dir, '.distillery/runs/register-loan/issues/003_carried.md', issue('implementation', '画面の入力の検査が抜けている'));
  W(repo.dir, '.distillery/runs/register-loan/issues/004_blocked.md', issue('requirement', '上限の数が決まっていない'));
  W(repo.dir, '.distillery/runs/register-loan/issues/consumed/005_rewound.md', issue('contract', 'その場で直した契約の穴'));
  const extra = [
    { seq: 4, ts: '2026-09-23T10:10:00.000Z', type: 'blocked_on_upstream', issues: [{ id: '002_upstream', target: 'foundation' }] },
    { seq: 5, ts: '2026-09-23T10:20:00.000Z', type: 'resumed_after_upstream', issues: [{ id: '002_upstream', target: 'foundation', resume_from: null }] },
    { seq: 6, ts: '2026-09-23T10:21:00.000Z', type: 'carried_issues', issues: [{ issue: '003_carried', target_step: 'implementation', resume_from: null }, { issue: 'other-uc-issue', target_step: 'contract' }] },
    // 今も上流で止まっている課題 (写し直していない) は未決のまま
    { seq: 7, ts: '2026-09-23T10:30:00.000Z', type: 'blocked_on_upstream', issues: [{ id: '004_blocked', target: 'requirements' }] },
  ].map((e) => JSON.stringify(e)).join('\n') + '\n';
  W(repo.dir, '.distillery/runs/register-loan/events.jsonl', EVENTS + extra);
  run(opts(repo));
  const md = fs.readFileSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  assert.match(md, /\| 未決の課題 \| 2 件 \(要求 1、ルール 1\) \|/);
  assert.match(md, /\| ルール \| 貸出上限のルールが契約に無い \|/);
  assert.match(md, /\| 要求 \| 上限の数が決まっていない \|/);
  assert.doesNotMatch(md, /部品が理由を出せない/);
  assert.doesNotMatch(md, /画面の入力の検査が抜けている/);
  assert.doesNotMatch(md, /その場で直した契約の穴/);
  assert.match(md, /片付いた課題 2 件は数えない \(上流の差分で反映か取り下げ 1、この UC の段で扱った 1\)。/);
  // 片付いた課題が無ければ、その行を出さない
  const plain = buildRepo();
  run(opts(plain));
  const md2 = fs.readFileSync(path.join(plain.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  assert.match(md2, /\| 未決の課題 \| 1 件 \(ルール 1\) \|/);
  assert.doesNotMatch(md2, /片付いた課題/);
  // 未決が 0 件になったときは「未決の課題なし」
  const allSettled = buildRepo();
  W(allSettled.dir, '.distillery/runs/register-loan/events.jsonl', EVENTS + JSON.stringify({ seq: 4, ts: '2026-09-23T10:20:00.000Z', type: 'resumed_after_upstream', issues: [{ id: '001_limit', target: 'decide' }] }) + '\n');
  run(opts(allSettled));
  const md3 = fs.readFileSync(path.join(allSettled.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  assert.match(md3, /\| 未決の課題 \| なし \|/);
  assert.match(md3, /未決の課題なし。\n\n片付いた課題 1 件は数えない \(上流の差分で反映か取り下げ 1\)。/);
});

test('取り消された書き込み (result が error の db.query) は、分岐の表・データの流れ・traceability-index の tables_rw に数えない (実地確認)', () => {
  const repo = buildRepo();
  const SC3 = 'register-loan#同じ書籍の貸出が重なると拒否する';
  const trace3 = [
    traceLine(SC3, 'http.in', 'backend-api', { method: 'POST', path: '/loans', status: 409, operationId: 'createLoan', tier: 'backend-api' }),
    traceLine(SC3, 'db.query', null, { sql: 'SELECT * FROM books WHERE id=$1', tables: ['books'], component: 'LoanRepo', result: 'ok' }),
    traceLine(SC3, 'db.query', null, { sql: 'INSERT INTO loan_slots (id) VALUES ($1)', tables: ['loan_slots'], component: 'LoanRepo', result: 'error' }),
  ].join('\n') + '\n';
  W(repo.dir, '.distillery/runs/register-loan/traces/sc3.jsonl', trace3);
  run(opts(repo));
  const md = fs.readFileSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  assert.match(md, /\| 同じ書籍の貸出が重なると拒否する \| 409 \| なし \| なし \|/, '分岐の表の書き込みは「なし」');
  assert.ok(!md.includes('[(loan_slots)]'), 'データの流れに取り消された書き込みの表を描かない');
  const index = readCanonicalJson(path.join(repo.dir, 'docs/as-built/_system/traceability-index.json'));
  assert.deepEqual(index.ucs['register-loan'].tables_rw, { books: ['read'], loans: ['read', 'write'] });
  assert.ok(!index.ucs['register-loan'].tables.includes('loan_slots'));
  assert.ok(!('loan_slots' in index.tables));
  const seqMd = fs.readFileSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/sequence.md'), 'utf8');
  assert.match(seqMd, /INSERT loan_slots \(失敗\)/, '全シナリオの図では、失敗した文と分かる');
});

// --- 警告扱いで通った検査・前準備で呼んだ他の UC の操作 (実地確認の課題) ---------------------------

test('警告扱い (advisory) で通った検査を、結果のゲートの行と証跡に名前と終了コードで出す (実地確認: generate が exit 1 でも「すべて pass」と出た)', () => {
  const { gateAdvisories, gatesSummary } = require(path.join(SCRIPTS, 'extractAsBuilt'));
  const withAdvisory = JSON.parse(JSON.stringify(GATES));
  withAdvisory.gates[0].jobs = [
    { name: 'lint', tier: 'backend-api', exit: 0, status: 'pass' },
    { name: 'generate', advisory_on_fail: 'generate', exit: 1, status: 'pass', advisory: { kind: 'generate', exit: 1 } },
    { name: 'security', tier: 'backend-api', advisory_on_fail: 'security', exit: 2, status: 'pass', advisory: { kind: 'security', exit: 2 } },
    { name: 'quality', exit: 1, status: 'pass', advisory: { plugin: 'osv-scanner', count: 3, rules: ['osv-scanner:GHSA-x'], files: ['package-lock.json'] } },
  ];
  assert.deepEqual(gateAdvisories(withAdvisory).map((a) => a.text), ['generate exit 1', 'backend-api:security exit 2', 'quality 依存の脆弱性 3 件']);
  const repo = buildRepo();
  W(repo.dir, '.distillery/runs/register-loan/reports/gates.json', withAdvisory);
  run(opts(repo));
  const md = fs.readFileSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  assert.match(md, /\| ゲート \| 5 段 pass \(警告 3: generate exit 1、backend-api:security exit 2、quality 依存の脆弱性 3 件\) \|/);
  assert.doesNotMatch(md, /すべて pass/, '落ちた検査があるのに「すべて pass」と書かない');
  assert.match(md, /ゲート: static pass \/ unit pass[^\n]*\n\n警告扱いで通った検査 \(落ちたが、段は止めない決まりの検査\):\n\n- generate exit 1 \(static の段\)\n- backend-api:security exit 2 \(static の段\)\n- quality 依存の脆弱性 3 件 \(static の段\)\n/);
  // 警告が無ければ今までどおり
  const plain = buildRepo();
  run(opts(plain));
  const md2 = fs.readFileSync(path.join(plain.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  assert.match(md2, /\| ゲート \| 5 段すべて pass \|/);
  assert.doesNotMatch(md2, /警告/);
  // 落ちた段や部分実行にも警告を添える
  const failed = JSON.parse(JSON.stringify(withAdvisory));
  failed.gates[1].status = 'fail'; failed.result = 'fail';
  assert.equal(gatesSummary(failed), '**fail** (落ちた段: unit) (警告 3: generate exit 1、backend-api:security exit 2、quality 依存の脆弱性 3 件)');
  // 要約ブロックの書式の検査は、抽出節の警告の行を違反にしない
  const { check } = require(path.join(SCRIPTS, 'checkAsBuilt'));
  assert.deepEqual(check(md).violations.filter((v) => !/R1/.test(v.rule)), []);
});

function spanLine(scenario, seq, parent, kind, name, meta) {
  return JSON.stringify({ ts: '2026-11-15T00:00:00.000Z', ts_end: '2026-11-15T00:00:00.001Z', seq, seq_end: seq + 1, parent, scenario, kind, name, meta });
}

/** 一覧の UC の体: 自分の操作は createLoan だけ。シナリオは前準備で他の UC の操作 returnLoan を呼ぶ */
function setupOpsRepo() {
  const repo = buildRepo();
  W(repo.dir, 'contracts/uc-index.yaml', 'schema_version: distillery2.uc-index/v1\nucs:\n  - slug: other-uc\n    operations: [returnLoan]\n  - slug: register-loan\n    operations:\n      - createLoan\n    messages: []\n    tables: [books, loans]\n');
  const B = { tier: 'backend-api' };
  const SC = 'register-loan#返却した書籍をもう一度貸し出す';
  const trace = [
    // 前準備: 他の UC の操作 (returnLoan)。loans を書き、returns を書き、発行する
    spanLine(SC, 1, undefined, 'http.in', '/loans/1/return', { method: 'POST', path: '/loans/1/return', status: 200, operationId: 'returnLoan', ...B }),
    spanLine(SC, 2, 1, 'call', 'ReturnLoan.execute', { component: 'ReturnLoan', fn: 'execute', result: 'ok', ...B }),
    spanLine(SC, 3, 2, 'db.query', 'query', { sql: 'UPDATE loans SET returned_at = now()', tables: ['loans'], component: 'LoanRepo', result: 'ok', ...B }),
    spanLine(SC, 4, 2, 'db.query', 'query', { sql: 'INSERT INTO returns (id) VALUES ($1)', tables: ['returns'], component: 'LoanRepo', result: 'ok', ...B }),
    spanLine(SC, 5, 2, 'publish', 'loan.returned', { message: 'loan.returned', channel: 'loans', component: 'ReturnLoan', ...B }),
    // UC 自身の操作 (createLoan)
    spanLine(SC, 6, undefined, 'http.in', '/loans', { method: 'POST', path: '/loans', status: 201, operationId: 'createLoan', ...B }),
    spanLine(SC, 7, 6, 'call', 'RegisterLoan.execute', { component: 'RegisterLoan', fn: 'execute', result: 'ok', ...B }),
    spanLine(SC, 8, 7, 'db.query', 'query', { sql: 'SELECT * FROM books', tables: ['books'], component: 'LoanRepo', result: 'ok', ...B }),
    spanLine(SC, 9, 7, 'db.query', 'query', { sql: 'INSERT INTO loans (id) VALUES ($1)', tables: ['loans'], component: 'LoanRepo', result: 'ok', ...B }),
    // 操作を特定できない出来事: http.in の外の db.query と、operationId の無い http.in の下の db.query は UC 自身の分
    spanLine(SC, 10, undefined, 'db.query', 'query', { sql: 'UPDATE outbox SET sent = true', tables: ['outbox'], component: 'Worker', result: 'ok', ...B }),
    spanLine(SC, 11, undefined, 'http.in', '/health-data', { method: 'GET', path: '/health-data', status: 200, ...B }),
    spanLine(SC, 12, 11, 'db.query', 'query', { sql: 'SELECT * FROM settings', tables: ['settings'], component: 'LoanRepo', result: 'ok', ...B }),
  ].join('\n') + '\n';
  fs.rmSync(path.join(repo.runDir, 'traces'), { recursive: true, force: true });
  W(repo.dir, '.distillery/runs/register-loan/traces/sc1.jsonl', TRACE1);
  W(repo.dir, '.distillery/runs/register-loan/traces/sc9.jsonl', trace);
  return repo;
}

test('前準備で呼んだ他の UC の操作の読み書きは、UC の読み書きに数えない: 全体の表と tables_rw は UC 自身の操作の分だけ (実地確認: 一覧の UC に取消の書き込みが載った)', () => {
  const repo = setupOpsRepo();
  run(opts(repo));
  const index = readCanonicalJson(path.join(repo.dir, 'docs/as-built/_system/traceability-index.json'));
  const e = index.ucs['register-loan'];
  // returns は前準備だけが書くので UC の表に出ない。loans は自身の操作が書くので write
  assert.deepEqual(e.tables_rw, { books: ['read'], loans: ['write'], outbox: ['write'], settings: ['read'] });
  assert.deepEqual(e.tables, ['books', 'loans', 'outbox', 'settings']);
  assert.deepEqual(e.setup_tables_rw, { loans: ['write'], returns: ['write'] });
  assert.deepEqual(e.setup_operations, ['returnLoan']);
  assert.deepEqual(e.messages, ['loan.registered'], '前準備の操作の発行は UC の発行に数えない');
  assert.ok(!('returns' in index.tables), '表ごとの UC の一覧にも、前準備だけの表は出ない');
  const system = fs.readFileSync(path.join(repo.dir, 'docs/as-built/_system/data-flow.md'), 'utf8');
  assert.doesNotMatch(system, /returns/);
  assert.match(system, /\| loans \| W \|/);
  const md = fs.readFileSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  // 入口: 前準備の操作は区別する
  assert.match(md, /\| API \| createLoan \(POST \/loans\)、returnLoan \(前準備\) \|/);
  assert.match(md, /\| 発行イベント \| loan\.registered \|/);
  // 分岐の表: 書き込みと発行は UC 自身の分と前準備の分を分ける
  const { summarizeScenario, parseTraceLines } = require(path.join(SCRIPTS, 'renderSequence'));
  const sc9 = parseTraceLines(fs.readFileSync(path.join(repo.runDir, 'traces/sc9.jsonl'), 'utf8'));
  assert.deepEqual(summarizeScenario(sc9, { ownOps: ['createLoan'] }), { status: '200 → 201 → 200', reads: ['books', 'settings'], writes: ['loans', 'outbox'], messages: [], setupWrites: ['loans', 'returns'], setupMessages: ['loan.returned'] });
  // このシナリオが正常系 (図) に選ばれるので、分岐の表にはもう 1 本が載る。前準備の無いシナリオには (前準備: …) を付けない
  assert.match(md, /\| 在庫ありの書籍を貸し出す \| 201 \| loans \| loan\.registered \|/);
  // 分岐の表に載る側にしたときは、前準備の分を括弧で分ける
  const repo2 = setupOpsRepo();
  const big = TRACE1 + Array.from({ length: 30 }, () => traceLine(SC1, 'db.query', null, { sql: 'SELECT * FROM books WHERE id=$1', tables: ['books'], component: 'LoanRepo' })).join('\n') + '\n';
  W(repo2.dir, '.distillery/runs/register-loan/traces/sc1.jsonl', big);
  run(opts(repo2));
  const md2 = fs.readFileSync(path.join(repo2.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  assert.match(md2, /\| 返却した書籍をもう一度貸し出す \| 200 → 201 → 200 \| loans, outbox \(前準備: loans, returns\) \| なし \(前準備: loan\.returned\) \|/);
  // UC の図: 前準備の読み書きは別の線。注記を出す
  assert.match(md, /「前準備」の線は、シナリオが前準備で呼んだ他の UC の操作の読み書きである。この UC の読み書きには数えない。/);
  const id = (label) => md.match(new RegExp(`(n\\d+)\\[\\(${label}\\)\\]`))[1];
  const comp = (label) => md.match(new RegExp(`(n\\d+)\\[${label}\\]`))[1];
  assert.match(md, /\[returnLoan （POST \/loans\/1\/return） （前準備）\]/);
  assert.ok(md.includes(`${comp('ReturnLoan')} -. 前準備 Write .-> ${id('returns')}\n`));
  assert.ok(md.includes(`${comp('ReturnLoan')} -. 前準備 Write .-> ${id('loans')}\n`));
  assert.ok(md.includes(`${comp('RegisterLoan')} == Write ==> ${id('loans')}\n`), 'UC 自身の操作の書き込みは今までどおりの線');
  assert.match(md, new RegExp(`${comp('ReturnLoan')} -\\. 前準備 Publish \\.-> n\\d+`));
  assert.ok(!md.includes(`== Write ==> ${id('returns')}`));
});

test('UC 自身の操作が分からないとき (uc-index が無い・その UC が無い) は前準備を分けず、今までどおりすべて UC の読み書きに数える', () => {
  const { ownOperations } = require(path.join(SCRIPTS, 'extractAsBuilt'));
  assert.equal(ownOperations(null, 'register-loan'), null);
  assert.equal(ownOperations({ ucs: [{ slug: 'other', operations: ['x'] }] }, 'register-loan'), null);
  assert.deepEqual(ownOperations({ ucs: [{ slug: 'register-loan', operations: ['createLoan'] }] }, 'register-loan'), ['createLoan']);
  const repo = setupOpsRepo();
  fs.rmSync(path.join(repo.dir, 'contracts/uc-index.yaml'));
  run(opts(repo));
  const e = readCanonicalJson(path.join(repo.dir, 'docs/as-built/_system/traceability-index.json')).ucs['register-loan'];
  assert.deepEqual(e.tables_rw, { books: ['read'], loans: ['write'], outbox: ['write'], returns: ['write'], settings: ['read'] });
  assert.deepEqual(e.setup_tables_rw, {});
  const md = fs.readFileSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  assert.doesNotMatch(md, /前準備/);
});

test('operationScope: いちばん外側の http.in の操作で決める (自身の操作が中で呼ぶ別の操作は、自身の処理)', () => {
  const { buildTree, operationScope } = require(path.join(SCRIPTS, 'traceTree'));
  const J = (seq, parent, kind, meta) => ({ ts: 't', seq, parent, scenario: 's', kind, name: 'n', meta });
  const tree = buildTree([
    J(1, undefined, 'http.in', { operationId: 'own' }),
    J(2, 1, 'http.out', { url: 'http://other/x' }),
    J(3, 2, 'http.in', { operationId: 'inner' }),
    J(4, 3, 'db.query', { sql: 'INSERT INTO t (a) VALUES (1)', tables: ['t'] }),
    J(5, undefined, 'http.in', { operationId: 'someoneElse' }),
    J(6, 5, 'db.query', { sql: 'INSERT INTO u (a) VALUES (1)', tables: ['u'] }),
  ]);
  const own = new Set(['own']);
  const by = (seq) => tree.nodes.find((n) => n.seq === seq);
  assert.equal(operationScope(by(4), own), 'own');
  assert.equal(operationScope(by(3), own), 'own');
  assert.equal(operationScope(by(6), own), 'setup');
  assert.equal(operationScope(by(5), own), 'setup');
  assert.equal(operationScope(by(6), null), 'own', 'UC 自身の操作が分からなければ分けない');
  // 同じ部品が UC 自身の操作と前準備の操作の両方から同じ表を触るときは、線を 2 本に分ける
  const { buildFlows, renderFlowchart } = require(path.join(SCRIPTS, 'renderDataFlow'));
  const shared = [
    J(1, undefined, 'http.in', { operationId: 'own', tier: 'b' }), J(2, 1, 'call', { component: 'Repo', tier: 'b' }), J(3, 2, 'db.query', { sql: 'SELECT * FROM t', tables: ['t'] }),
    J(4, undefined, 'http.in', { operationId: 'someoneElse', tier: 'b' }), J(5, 4, 'call', { component: 'Repo', tier: 'b' }), J(6, 5, 'db.query', { sql: 'UPDATE t SET a = 1', tables: ['t'] }),
  ];
  const text = renderFlowchart(buildFlows([{ scenario: 's', lines: shared }], { ownOps: ['own'] }));
  const repoId = text.match(/(n\d+)\[Repo\]/)[1]; const tId = text.match(/(n\d+)\[\(t\)\]/)[1];
  assert.ok(text.includes(`${repoId} -. Read .-> ${tId}\n    ${repoId} -. 前準備 Write .-> ${tId}`), text);
  assert.doesNotMatch(renderFlowchart(buildFlows([{ scenario: 's', lines: shared }], {})), /前準備/);
});

test('前準備で呼んだ他の UC の操作は、横断索引と API インベントリで「その UC が使う操作」にしない (外部レビュー)。分けられないときは今までどおり', () => {
  const repo = setupOpsRepo();
  run(opts(repo));
  const index = readCanonicalJson(path.join(repo.dir, 'docs/as-built/_system/traceability-index.json'));
  assert.deepEqual(index.ucs['register-loan'].operations, ['createLoan']);
  assert.deepEqual(index.ucs['register-loan'].setup_operations, ['returnLoan']);
  assert.deepEqual(Object.keys(index.operations), ['createLoan'], '操作 → 使う UC に、前準備の操作を載せない');
  const inv = fs.readFileSync(path.join(repo.dir, 'docs/as-built/_system/api-inventory.md'), 'utf8');
  assert.match(inv, /\| createLoan \| POST \/loans \| backend-api \| register-loan \| 実装済み \|/);
  assert.match(inv, /\| returnLoan \| POST \/loans\/\{id\}\/return \| backend-api \| - \| 未実装, 未使用 \|/, '前準備で呼んだだけの操作は、この UC が使う操作に数えない');
  // 入口には、前準備の操作も区別して出す
  const md = fs.readFileSync(path.join(repo.dir, 'docs/as-built/貸出業務/貸出を登録する/index.md'), 'utf8');
  assert.match(md, /\| API \| createLoan \(POST \/loans\)、returnLoan \(前準備\) \|/);
  // uc-index にその UC が無ければ分けられないので、今までどおりすべて UC の操作
  const noIndex = setupOpsRepo();
  fs.rmSync(path.join(noIndex.dir, 'contracts/uc-index.yaml'));
  run(opts(noIndex));
  const index2 = readCanonicalJson(path.join(noIndex.dir, 'docs/as-built/_system/traceability-index.json'));
  assert.deepEqual(index2.ucs['register-loan'].operations, ['createLoan', 'returnLoan']);
  assert.deepEqual(index2.ucs['register-loan'].setup_operations, []);
  assert.deepEqual(Object.keys(index2.operations), ['createLoan', 'returnLoan']);
});

test('同じ操作が UC 自身の処理の中と前準備の両方に現れるときは、データの流れで別のノードに描く (外部レビュー: 前準備のラベルが消えた)', () => {
  const { buildFlows, renderFlowchart } = require(path.join(SCRIPTS, 'renderDataFlow'));
  const { deriveFromTraces } = require(path.join(SCRIPTS, 'buildTraceIndex'));
  const J = (seq, parent, kind, meta) => ({ ts: 't', seq, parent, scenario: 's', kind, name: 'n', meta });
  const B = { tier: 'b' };
  const lines = [
    // UC 自身の操作 own が、処理の中で操作 lookup を呼ぶ (自身の処理)
    J(1, undefined, 'http.in', { operationId: 'own', method: 'POST', path: '/own', ...B }),
    J(2, 1, 'http.out', { url: 'http://b/lookup', ...B }),
    J(3, 2, 'http.in', { operationId: 'lookup', method: 'GET', path: '/lookup', ...B }),
    J(4, 3, 'db.query', { sql: 'SELECT * FROM t', tables: ['t'] }),
    // シナリオが前準備で、同じ操作 lookup を独立に呼ぶ
    J(5, undefined, 'http.in', { operationId: 'lookup', method: 'GET', path: '/lookup', ...B }),
    J(6, 5, 'db.query', { sql: 'SELECT * FROM u', tables: ['u'] }),
  ];
  for (const order of [lines, [...lines.slice(4), ...lines.slice(0, 4)]]) {
    const text = renderFlowchart(buildFlows([{ scenario: 's', lines: order }], { ownOps: ['own'] }));
    const plain = text.match(/(n\d+)\[lookup （GET \/lookup）\]/);
    const setup = text.match(/(n\d+)\[lookup （GET \/lookup） （前準備）\]/);
    assert.ok(plain && setup, `自身の処理の中の lookup と、前準備の lookup の両方を描く\n${text}`);
    assert.notEqual(plain[1], setup[1]);
    const id = (t) => text.match(new RegExp(`(n\\d+)\\[\\(${t}\\)\\]`))[1];
    assert.ok(text.includes(`${plain[1]} -. Read .-> ${id('t')}`), text);
    assert.ok(text.includes(`${setup[1]} -. 前準備 Read .-> ${id('u')}`), text);
  }
  // 索引でも、自身の処理の中で呼んだ分は UC の操作、前準備で呼んだ分は setup に入る
  const d = deriveFromTraces([{ scenario: 's', lines }], { ownOps: ['own'] });
  assert.deepEqual(d.operations, ['lookup', 'own']);
  assert.deepEqual(d.setup.operations, ['lookup']);
  assert.deepEqual(d.tables, [{ name: 't', modes: ['read'] }]);
  assert.deepEqual(d.setup.tables, [{ name: 'u', modes: ['read'] }]);
});
