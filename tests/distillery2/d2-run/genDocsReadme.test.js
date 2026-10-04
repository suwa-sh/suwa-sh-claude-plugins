'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPT = path.resolve(__dirname, '../../../plugins/distillery2/scripts/genDocsReadme.js');
const { run, merge, BEGIN, END } = require(SCRIPT);

function W(dir, rel, content) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n');
  return p;
}

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2readme-'));
  W(dir, '.distillery/config.yaml', 'schema_version: "2.0"\ndocs_root: docs\n');
  W(dir, 'docs/input/初期要望.txt', '要望');
  W(dir, 'docs/requirements/rdra/システム概要.json', { system_name: '図書館システム', system_overview: '蔵書を管理する。' });
  W(dir, 'docs/requirements/requirements.yaml', `version: "1.0"
system_name: 図書館システム
requirements:
  - id: REQ-001
    requirement: 貸出を管理できる
    specifications:
      - id: SPEC-001-01
        specification: 司書が貸出を登録できる
        acceptance_criteria: ["Given a When b Then c"]
`);
  W(dir, 'docs/requirements/requirements.md', '# USDM\n');
  W(dir, 'docs/requirements/rdra/views/README.md', '# views\n');
  W(dir, 'docs/requirements/use-cases.yaml', `version: "2.0"
use_cases:
  - uc: 貸出を登録する
    slug: register-loan
    business: 貸出業務
    buc: 書籍を貸し出す
    spec_ids: [SPEC-001-01]
    status: planned
  - uc: 返却を登録する
    slug: return-loan
    business: 貸出業務
    buc: 書籍を返す
    spec_ids: []
    no_spec_reason: 対応する仕様が無い
    status: blocked
`);
  W(dir, 'features/貸出業務/register-loan.feature', '@uc:register-loan\n機能: 貸出を登録する\n  シナリオ: A\n  シナリオ: B\n');
  W(dir, 'contracts/contracts.json', { contracts: [{ id: 'api', type: 'openapi', source: 'openapi/openapi.yaml', provider: 'backend-api', consumers: ['frontend'] }] });
  W(dir, 'contracts/openapi/openapi.yaml', 'openapi: 3.1.0\n');
  W(dir, 'contracts/uc-index.yaml', 'ucs:\n  - slug: register-loan\n    operations: [createLoan]\n    messages: []\n    tables: [loans, books]\n');
  W(dir, 'contracts/generated/slices/register-loan/contract-slice.json', {});
  W(dir, 'docs/design/screens.yaml', 'screens:\n  - name: LoanCheckout\n    uc_slugs: [register-loan]\n');
  W(dir, 'docs/adr/0001-tiers.md', '---\nid: "0001"\ntitle: "ティアは 2 つ"\nstatus: accepted\n---\n本文\n');
  W(dir, 'docs/adr/index.md', '# ADR\n');
  W(dir, 'docs/nfr/nfr-grade.yaml', 'model_system:\n  type: model2\ncategories:\n  - id: A\n    name: 可用性\n    subcategories:\n      - id: A.1\n        items:\n          - id: A.1.1\n            metrics:\n              - id: A.1.1.1\n                important: true\n              - id: A.1.1.2\n                important: false\n');
  W(dir, 'docs/nfr/nfr-grade.md', '# NFR\n');
  W(dir, 'docs/rules/index.md', '# rules\n\n| ファイル | 対象 |\n|---|---|\n| [common.md](common.md) | 共通 |\n| `testing.md` | テスト |\n| `tier-<kind>.md` | ティア |\n');
  W(dir, 'docs/rules/common.md', '# common\n');
  W(dir, 'docs/rules/testing.md', '# testing\n');
  W(dir, 'docs/rules/tier-backend.md', '# backend\n');
  W(dir, 'docs/as-built/_system/index.md', '# as-built\n');
  W(dir, 'docs/as-built/_system/traceability-index.json', { ucs: { 'register-loan': { as_built: 'docs/as-built/貸出業務/貸出を登録する/', gates: 'pass', gates_complete: true } } });
  W(dir, 'docs/as-built/貸出業務/貸出を登録する/index.md', '# as-built\n');
  return dir;
}
const opts = (dir, extra = {}) => ({ cwd: dir, config: '.distillery/config.yaml', check: false, ...extra });

test('段階の表・UC 一覧 (背骨)・決めたこと・契約を、実在する正本から生成する', () => {
  const dir = repo();
  const r = run(opts(dir));
  assert.equal(r.code, 0, JSON.stringify(r));
  const md = fs.readFileSync(path.join(dir, 'docs/README.md'), 'utf8');
  assert.ok(md.startsWith(BEGIN) && md.trimEnd().endsWith(END));
  assert.match(md, /^# 図書館システム$/m);
  assert.match(md, /> 蔵書を管理する。/);
  assert.match(md, /\| ① 要求 \| .* \| \[要求仕様書 \(USDM\)\]\(requirements\/requirements\.md\)<br>\[RDRA の図解\]/);
  // 背骨: 要求 → シナリオ → 契約 → 画面 → as-built
  assert.match(md, /UC 2 件 \(実装済み 1、要求待ち 1\)/);
  assert.match(md, /要求の列の SPEC は \[要求仕様書\]\(requirements\/requirements\.md\) の行/);
  assert.match(md, /\| 貸出業務 \| 貸出を登録する \| 実装済み \| SPEC-001-01 \| \[register-loan\.feature\]\(\.\.\/features\/%E8%B2%B8%E5%87%BA%E6%A5%AD%E5%8B%99\/register-loan\.feature\) \(2 本\) \| \[createLoan \/ テーブル 2\]\(\.\.\/contracts\/generated\/slices\/register-loan\/contract-slice\.json\) \| LoanCheckout \| \[index\.md\]\(as-built\/%E8%B2%B8%E5%87%BA%E6%A5%AD%E5%8B%99\/%E8%B2%B8%E5%87%BA%E3%82%92%E7%99%BB%E9%8C%B2%E3%81%99%E3%82%8B\/index\.md\) \|/);
  assert.match(md, /\| {2}\| 返却を登録する \| 要求待ち \| なし \| - \| - \| - \| - \|/);
  assert.match(md, /<summary>要求待ちの理由 \(1\)<\/summary>\n\n- 返却を登録する: 対応する仕様が無い/);
  assert.match(md, /\| \[0001\]\(adr\/0001-tiers\.md\) \| ティアは 2 つ \| accepted \|/);
  assert.match(md, /C4 図: 未生成 \(d2-decide の/); // ADR はあるが architecture.md が無い
  W(dir, 'docs/adr/architecture.md', '# C4\n');
  run(opts(dir));
  assert.match(fs.readFileSync(path.join(dir, 'docs/README.md'), 'utf8'), /\[C4 図\]\(adr\/architecture\.md\)/);
  assert.match(md, /モデルシステム model2、重要項目 1 \/ 2/);
  assert.match(md, /\| api \| openapi \| backend-api \| frontend \| \[openapi\/openapi\.yaml\]\(\.\.\/contracts\/openapi\/openapi\.yaml\) \|/);
  assert.doesNotMatch(md, /distillery2 以外の文書/);
  // 決定論: 2 回目は変更なし
  const r2 = run(opts(dir));
  assert.equal(r2.changed, false);
  assert.equal(run(opts(dir, { check: true })).code, 0);
});

test('人が書いた README の外側は触らず、印の無い README には末尾に足す', () => {
  const dir = repo();
  const p = path.join(dir, 'docs/README.md');
  fs.writeFileSync(p, '# 手書きの見出し\n\n手書きの本文。\n');
  run(opts(dir));
  let md = fs.readFileSync(p, 'utf8');
  assert.ok(md.startsWith('# 手書きの見出し\n\n手書きの本文。\n'));
  assert.ok(md.includes(BEGIN) && md.trimEnd().endsWith(END));
  // 2 回目: ブロックだけ差し替わり、外側とブロック数は同じ
  fs.writeFileSync(p, md.replace(END, END + '\n\n末尾の手書き。\n'));
  run(opts(dir));
  md = fs.readFileSync(p, 'utf8');
  assert.equal((md.match(/distillery2:begin/g) || []).length, 1);
  assert.ok(md.startsWith('# 手書きの見出し') && md.trimEnd().endsWith('末尾の手書き。'));
  // merge: 管理ブロックの中を手で変えても次で戻る
  const merged = merge('前\n' + BEGIN + '\n手で変えた\n' + END + '\n後\n', BEGIN + '\n生成\n' + END);
  assert.equal(merged, '前\n' + BEGIN + '\n生成\n' + END + '\n後\n');
  // ブロック内のドリフトは --check で検出する
  fs.writeFileSync(p, md.replace('<!-- この間は distillery2', '<!-- 手で変えた'));
  assert.equal(run(opts(dir, { check: true })).code, 1);
  // 壊れた印 (begin だけ / 逆順 / 複数) は書き換えず exit 1。外側の手書きは残る
  for (const broken of ['前\n' + BEGIN + '\n手書き\n', '前\n' + END + '\n中\n' + BEGIN + '\n後\n', BEGIN + '\nA\n' + END + '\n' + BEGIN + '\nB\n' + END + '\n']) {
    fs.writeFileSync(p, broken);
    const r = run(opts(dir));
    assert.equal(r.code, 1, broken);
    assert.match(r.error, /管理ブロックの印が壊れている/);
    assert.equal(fs.readFileSync(p, 'utf8'), broken, '書き換えない');
  }
  assert.throws(() => merge('x\n' + BEGIN + '\n', 'block'), /印が壊れている/);
});

test('distillery2 以外の文書は名前と入口だけ列挙し、知っているディレクトリの未参照 md も列挙する', () => {
  const dir = repo();
  W(dir, 'docs/ops/README.md', '# 運用\n');
  W(dir, 'docs/ops/runbook.md', '# runbook\n');
  W(dir, 'docs/deep/guide/runbook.md', '# 下位だけ\n');
  W(dir, 'docs/glossary.md', '# 用語\n');
  W(dir, 'docs/requirements/memo.md', 'メモ\n');
  W(dir, 'docs/requirements/rdra/private/memo2.md', '下位のメモ\n');
  W(dir, 'docs/rules/sub/README.md', '# sub\n\n[detail.md](detail.md)\n');
  W(dir, 'docs/rules/sub/detail.md', '# detail\n');
  run(opts(dir));
  const md = fs.readFileSync(path.join(dir, 'docs/README.md'), 'utf8');
  assert.match(md, /## distillery2 以外の文書/);
  assert.match(md, /\| ops\/ \| \[README\.md\]\(ops\/README\.md\) \| 2 \|/);
  assert.match(md, /\| deep\/ \| \[guide\/runbook\.md\]\(deep\/guide\/runbook\.md\) \| 1 \|/);
  assert.match(md, /\| \[glossary\.md\]\(glossary\.md\) \| - \| 1 \|/);
  assert.match(md, /- \[requirements\/memo\.md\]\(requirements\/memo\.md\)/);
  assert.match(md, /- \[requirements\/rdra\/private\/memo2\.md\]\(requirements\/rdra\/private\/memo2\.md\)/, '下位の未参照 md');
  assert.match(md, /- \[rules\/sub\/README\.md\]/, '下位の README 自身は未参照');
  assert.doesNotMatch(md, /rules\/sub\/detail\.md/, '下位の README が参照する md は載せない');
  assert.doesNotMatch(md, /ops\/runbook/); // 中身は要約しない (入口だけ)
});

test('git が無視するパス (gitignore・node_modules) の文書は README に載せない (commit するとリンク切れになる。0.1.23)', () => {
  const dir = repo();
  const { execFileSync } = require('node:child_process');
  execFileSync('git', ['init', '-q'], { cwd: dir });
  W(dir, '.gitignore', 'docs/design/storybook-app/dist/\ndocs/manual/README.md\ndocs/cache/*.md\ndocs/adr/architecture.md\n');
  // 中身がすべて無視されているディレクトリは載せない (commit すると消える)
  W(dir, 'docs/cache/README.md', '# 生成物\n');
  W(dir, 'docs/adr/architecture.md', '# C4\n');
  // 入口 (README.md) が無視されていれば、無視されていない文書を入口にする
  W(dir, 'docs/manual/README.md', '# 生成された入口\n');
  W(dir, 'docs/manual/guide.md', '# 手引き\n');
  W(dir, 'docs/design/storybook-app/node_modules/pkg/README.md', '# pkg\n');
  W(dir, 'docs/design/storybook-app/dist/README.md', '# build\n');
  W(dir, 'docs/design/storybook-app/README.md', '# storybook\n');
  W(dir, 'docs/ops/node_modules/x/README.md', '# x\n');
  W(dir, 'docs/ops/README.md', '# 運用\n');
  run(opts(dir));
  const md = fs.readFileSync(path.join(dir, 'docs/README.md'), 'utf8');
  assert.doesNotMatch(md, /node_modules/);
  assert.doesNotMatch(md, /storybook-app\/dist/);
  assert.match(md, /storybook-app\/README\.md/, '無視されていない文書は載る');
  assert.match(md, /\| ops\/ \| \[README\.md\]\(ops\/README\.md\) \| 1 \|/, 'ファイル数も無視されたものを数えない');
  assert.match(md, /\| manual\/ \| \[guide\.md\]\(manual\/guide\.md\) \| 1 \|/, '無視された README を入口に選ばない');
  assert.doesNotMatch(md, /cache\//, '中身がすべて無視されたディレクトリは載せない');
  assert.ok(fs.existsSync(path.join(dir, 'docs/adr/architecture.md')), '前提: 手元には C4 図がある');
  assert.doesNotMatch(md, /\]\(adr\/architecture\.md\)/, '既知の文書でも git に無視されていればリンクしない');
});

test('段階が未着手なら「未着手」と書き、空の節を出さない。リンク切れは exit 1 で書き換えない', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2readme-min-'));
  W(dir, 'docs/input/初期要望.txt', 'x');
  const r = run(opts(dir));
  assert.equal(r.code, 0);
  const md = fs.readFileSync(path.join(dir, 'docs/README.md'), 'utf8');
  assert.match(md, /\| ① 要求 \| .* \| 未着手 \| - \|/);
  assert.match(md, /未着手 \(要求の段階で `use-cases\.yaml` が作られる\)/);
  assert.doesNotMatch(md, /## 横断して見る/);
  // リンク切れ: 追跡表が指す as-built が無い → 正本が指す文書は必須なので exit 1、README は書かない
  const dir2 = repo();
  fs.rmSync(path.join(dir2, 'docs/as-built/貸出業務'), { recursive: true });
  const r2 = run(opts(dir2));
  assert.equal(r2.code, 1);
  assert.ok(r2.broken.some((b) => /index\.md$/.test(b)), JSON.stringify(r2.broken));
  assert.ok(!fs.existsSync(path.join(dir2, 'docs/README.md')));
  // uc-index にある UC の slice が無いのも同じ
  const dir3 = repo();
  fs.rmSync(path.join(dir3, 'contracts/generated'), { recursive: true });
  assert.ok(run(opts(dir3)).broken.some((b) => /contract-slice\.json$/.test(b)));
});

test('空の README と末尾改行の無い README にも壊さず足す。追跡表の無い done は状態と件数が一致する', () => {
  const dir = repo();
  const p = path.join(dir, 'docs/README.md');
  fs.writeFileSync(p, '');
  assert.equal(run(opts(dir)).code, 0);
  assert.ok(fs.readFileSync(p, 'utf8').startsWith(BEGIN));
  fs.writeFileSync(p, '# 手書き');
  assert.equal(run(opts(dir)).code, 0);
  assert.ok(fs.readFileSync(p, 'utf8').startsWith('# 手書き\n\n' + BEGIN));
  fs.rmSync(path.join(dir, 'docs/as-built/_system/traceability-index.json'));
  fs.writeFileSync(path.join(dir, 'docs/requirements/use-cases.yaml'), fs.readFileSync(path.join(dir, 'docs/requirements/use-cases.yaml'), 'utf8').replace('status: planned', 'status: done'));
  assert.equal(run(opts(dir)).code, 0);
  const md = fs.readFileSync(p, 'utf8');
  assert.match(md, /UC 2 件 \(実装済み 1、要求待ち 1\)/);
  assert.match(md, /貸出を登録する \| 実装済み \|/);
});

test('共有 feature はシナリオごとの @uc タグで数え、# を含むファイル名もリンクできる、実装済みの件数は状態と同じ条件', () => {
  const dir = repo();
  W(dir, 'features/shared.feature', '機能: 共有\n  @uc:register-loan\n  シナリオ: A\n  @uc:return-loan\n  シナリオ: B\n  @uc:register-loan @uc:return-loan\n  シナリオ: C\n');
  W(dir, 'docs/input/proposal#1.md', 'x');
  W(dir, 'docs/as-built/_system/traceability-index.json', { ucs: { 'register-loan': { as_built: 'docs/as-built/貸出業務/貸出を登録する/', gates: 'fail', gates_complete: false } } });
  assert.equal(run(opts(dir)).code, 0);
  const md = fs.readFileSync(path.join(dir, 'docs/README.md'), 'utf8');
  assert.match(md, /\[shared\.feature\]\(\.\.\/features\/shared\.feature\) \(2 本\)<br>\[register-loan\.feature\]\([^)]*\) \(2 本\)/);
  assert.match(md, /返却を登録する \| 要求待ち \| なし \| \[shared\.feature\]\(\.\.\/features\/shared\.feature\) \(2 本\)/);
  assert.match(md, /\[proposal#1\.md\]\(input\/proposal%231\.md\)/);
  assert.match(md, /UC 2 件 \(実装済み 0、要求待ち 1\)/);
  assert.match(md, /貸出を登録する \| 実装中 \(ゲート fail\)/);
});

test('未処理の課題は段階的に開く: README は件数と内訳と一覧へのリンクだけ → 一覧 (生成) → 課題ファイル。0 件なら一覧を消す (0.1.27)', () => {
  const dir = repo();
  let r = run(opts(dir));
  assert.equal(r.code, 0);
  let md = fs.readFileSync(path.join(dir, 'docs/README.md'), 'utf8');
  assert.match(md, /## 未処理の課題\n\n未処理の課題なし。/);
  assert.ok(!fs.existsSync(path.join(dir, 'docs/feedback/README.md')));

  W(dir, 'docs/feedback/20260930T1000_auth.md', '---\nkind: contract\ntitle: "認証の応答 | 401"\nfrom_uc: register-loan\nstatus: open\n---\n\n本文\n');
  W(dir, 'docs/feedback/20260930T1100_rule.md', '---\nkind: rule\ntitle: "止まった: 層の向き"\nfrom_uc: register-loan\nstatus: open\nstopped: true\nstopped_count: 2\n---\n\n本文\n');
  W(dir, 'docs/feedback/20260930T0900_req.md', '---\nkind: requirement\ntitle: 返却の扱い\nfrom_uc: return-loan\nstatus: open\n---\n\n本文\n');
  assert.equal(run(opts(dir, { check: true })).code, 1, '一覧が無い・古いのは --check でドリフト (壊れたリンクではない)');
  r = run(opts(dir));
  assert.equal(r.code, 0, JSON.stringify(r));
  md = fs.readFileSync(path.join(dir, 'docs/README.md'), 'utf8');
  assert.match(md, /3 件 \(要求 1 \/ ルール 1 \/ 契約 1。うち止まった課題 1\)。一覧: \[feedback\/README\.md\]\(feedback\/README\.md\)/);
  assert.doesNotMatch(md, /20260930T1000_auth/, 'README には課題ファイルを並べない');
  assert.doesNotMatch(md, /## distillery2 以外の文書/, 'feedback は distillery2 のディレクトリ');
  const idx = fs.readFileSync(path.join(dir, 'docs/feedback/README.md'), 'utf8');
  const rows = idx.split('\n').filter((l) => /^\| (要求|ルール|契約) \|/.test(l));
  assert.deepEqual(rows, [
    '| 要求 | [返却の扱い](20260930T0900_req.md) | return-loan | - |',
    '| ルール | [止まった: 層の向き](20260930T1100_rule.md) | register-loan | 2 |',
    '| 契約 | [認証の応答 \\| 401](20260930T1000_auth.md) | register-loan | - |',
  ]);
  assert.equal(run(opts(dir, { check: true })).code, 0, '生成後は最新');

  for (const f of fs.readdirSync(path.join(dir, 'docs/feedback'))) if (f !== 'README.md') fs.rmSync(path.join(dir, 'docs/feedback', f));
  r = run(opts(dir));
  assert.equal(r.code, 0);
  assert.ok(!fs.existsSync(path.join(dir, 'docs/feedback/README.md')), '0 件なら一覧を消す');
  assert.match(fs.readFileSync(path.join(dir, 'docs/README.md'), 'utf8'), /未処理の課題なし。/);

  // リンク切れで README を書かないときは、一覧も書き換えない
  W(dir, 'docs/feedback/a.md', '---\nkind: rule\ntitle: a\n---\n');
  fs.rmSync(path.join(dir, 'docs/as-built/貸出業務'), { recursive: true });
  assert.equal(run(opts(dir)).code, 1);
  assert.ok(!fs.existsSync(path.join(dir, 'docs/feedback/README.md')));
});
