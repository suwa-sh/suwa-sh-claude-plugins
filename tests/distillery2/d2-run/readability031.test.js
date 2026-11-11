'use strict';
// 0.3.1: 文書の読みやすさ (書き方の決まり・要点と細目の分割・ADR へのリンク・画面設計への入口・冪等性と再試行の領域)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PLUGIN = path.resolve(__dirname, '../../../plugins/distillery2');
const read = (rel) => fs.readFileSync(path.join(PLUGIN, rel), 'utf8');
function W(dir, rel, content) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n');
  return p;
}
const tmp = (name) => fs.mkdtempSync(path.join(os.tmpdir(), name));

// --- 書き方の決まり ---------------------------------------------------------

test('書き方の決まりは 1 か所 (d2-common/references/writing.md) にあり、派遣文がすべての担当に読ませる', () => {
  const w = read('skills/d2-common/references/writing.md');
  for (const rule of ['結論を先に書く', '一文に 1 つのこと', '3 文を超えたら分ける', '同じものは同じ名前で呼ぶ', '書き足すときは全体を整え直す', 'リンクでたどれるようにする']) assert.ok(w.includes(rule), rule);
  assert.match(read('skills/d2-run/references/subagent-template.md'), /人が読む文章[^\n]*<skills>\/d2-common\/references\/writing\.md の決まりで書いてください/);
  assert.match(read('skills/d2-decide/references/adr-format.md'), /\| `title` \| ✓ \| 決めたこと 1 つを 60 字までで言い切る/);
});

// --- RDRA の説明: 要点と細目 -------------------------------------------------

function rdraRepo(conditionDesc, { conditions = [], variations = [] } = {}) {
  const dir = tmp('d2rdra-');
  const H = (name, header, rows = []) => W(dir, `rdra/${name}.tsv`, [header, ...rows].join('\n') + '\n');
  H('アクター', 'アクター群\tアクター\t役割');
  H('外部システム', '外部システム群\t外部システム\t説明');
  H('BUC', '業務\tBUC\tアクティビティ\tUC\t関連モデル1\t関連オブジェクト1\t関連モデル2\t関連オブジェクト2\t説明', ['予約\t予約する\t予約\t会議室を予約する\t条件\t重なり判定\t\t\t']);
  H('情報', 'コンテキスト\t情報\t属性\t関連情報\t状態モデル\tバリエーション\t説明');
  H('状態', 'コンテキスト\t状態モデル\t状態\t遷移UC\t遷移先状態\t説明');
  H('条件', 'コンテキスト\t条件\t条件の説明\tバリエーション\t状態モデル', [`予約管理\t重なり判定\t${conditionDesc}\t\t`, '予約管理\t短い条件\t一文だけの説明\t\t', ...conditions]);
  H('バリエーション', 'コンテキスト\tバリエーション\t値\t説明', variations);
  return dir;
}
function genRdra(dir, extra = []) {
  const script = path.join(PLUGIN, 'skills/d2-requirements/scripts/generateRdraMd.js');
  try { return { code: 0, out: execFileSync(process.execPath, [script, 'rdra', ...extra], { cwd: dir, encoding: 'utf8' }) }; }
  catch (e) { return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }; }
}

test('RDRA の図解: 2 文以上の条件の説明は、表に 1 文目だけを出し、細目を条件ごとの箇条書きに出す (括弧の中の句点では切らない)', () => {
  const dir = rdraRepo('重なる予約は受け付けない。開始は含み終了は含まない (同じ時刻は重ならない。隣り合うだけ)。例外: 自分の送り直しは成立済みを返す');
  const r = genRdra(dir);
  assert.equal(r.code, 0, r.out);
  const md = fs.readFileSync(path.join(dir, 'rdra/views/07_条件・バリエーション.md'), 'utf8');
  assert.match(md, /\| 予約管理 \| 重なり判定 \| 重なる予約は受け付けない。<br>→ 細目: \[条件: 重なり判定\]\(#条件-重なり判定\) \|/);
  assert.match(md, /### 条件: 重なり判定\n\n重なる予約は受け付けない。\n\n- 開始は含み終了は含まない \(同じ時刻は重ならない。隣り合うだけ\)\n- 例外: 自分の送り直しは成立済みを返す\n/);
  // 1 文だけの説明はそのまま表に出し、細目の節を作らない
  assert.match(md, /\| 予約管理 \| 短い条件 \| 一文だけの説明 \|/);
  assert.doesNotMatch(md, /### 条件: 短い条件/);
});

test('RDRA の図解: 説明の 1 文目が 60 字を超えると警告する (エラーにはしない。--lint は通る)', () => {
  const long = 'あ'.repeat(61);
  const dir = rdraRepo(`${long}。細目`);
  const r = genRdra(dir, ['--lint']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /\[警告\] 説明の要点が長い: 条件「重なり判定」 — 1 文目が 61 字 \(目安 60 字\)/);
  const ok = genRdra(rdraRepo(`${'あ'.repeat(60)}。細目`), ['--lint']);
  assert.doesNotMatch(ok.out, /説明の要点が長い/);
});

test('RDRA の図解: バリエーションの説明も要点と細目に分け、1 文目が長いと警告する', () => {
  const dir = rdraRepo('一文だけ', { variations: ['予約管理\t空き状況\t空き、予約済み\t重なる予約があるかを示す区分。取消済みは数えない。空きは予約できることまでは示さない', `予約管理\t長い区分\tA\t${'あ'.repeat(61)}。細目`] });
  const r = genRdra(dir);
  assert.equal(r.code, 0, r.out);
  const md = fs.readFileSync(path.join(dir, 'rdra/views/07_条件・バリエーション.md'), 'utf8');
  assert.match(md, /\| 予約管理 \| 空き状況 \| 空き、予約済み \| 重なる予約があるかを示す区分。<br>→ 細目: \[バリエーション: 空き状況\]\(#バリエーション-空き状況\) \|/);
  assert.match(md, /### バリエーション: 空き状況\n\n重なる予約があるかを示す区分。\n\n- 取消済みは数えない\n- 空きは予約できることまでは示さない\n/);
  assert.match(r.out, /\[警告\] 説明の要点が長い: バリエーション「長い区分」 — 1 文目が 61 字/);
});

test('RDRA の図解: 別のコンテキストに同じ名前の条件があっても、細目の見出しとリンクが行ごとに一意になる', () => {
  const dir = rdraRepo('予約の重なり。細目 A', { conditions: ['備品管理\t重なり判定\t備品の重なり。細目 B\t\t', '備品管理\t重なり判定\t同じ名前の 3 つ目。細目 C\t\t'] });
  const r = genRdra(dir);
  assert.equal(r.code, 0, r.out);
  const md = fs.readFileSync(path.join(dir, 'rdra/views/07_条件・バリエーション.md'), 'utf8');
  const links = [...md.matchAll(/→ 細目: \[([^\]]+)\]\(#([^)]+)\)/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(links, [
    ['条件: 重なり判定 (予約管理)', '条件-重なり判定-予約管理'],
    ['条件: 重なり判定 (備品管理)', '条件-重なり判定-備品管理'],
    ['条件: 重なり判定 (備品管理) 2', '条件-重なり判定-備品管理-2'],
  ]);
  for (const [h] of links) assert.equal(md.split(`### ${h}\n`).length, 2, `見出しが 1 つだけある: ${h}`);
  // 記号だけ違う名前 (見出しは違うがアンカーが同じ) も、アンカーが重ならない
  const d2 = rdraRepo('一文だけ', { conditions: ['予約管理\t予約/管理\t記号あり。細目\t\t', '予約管理\t予約管理\t記号なし。細目\t\t'] });
  genRdra(d2);
  const md2 = fs.readFileSync(path.join(d2, 'rdra/views/07_条件・バリエーション.md'), 'utf8');
  assert.deepEqual([...md2.matchAll(/→ 細目: \[([^\]]+)\]\(#([^)]+)\)/g)].map((m) => [m[1], m[2]]), [['条件: 予約/管理', '条件-予約管理'], ['条件: 予約管理 2', '条件-予約管理-2']]);
  assert.match(md, /### 条件: 重なり判定 \(備品管理\)\n\n備品の重なり。\n\n- 細目 B\n/);
});

// --- ADR の題 ---------------------------------------------------------------

function adrRepo(title, status = 'accepted') {
  const dir = tmp('d2adr-');
  W(dir, '0001-x.md', `---\nid: "0001"\ntitle: "${title}"\nstatus: ${status}\ndate: 2026-11-11\nbasis: requirements@abc\nscope: [infra]\n---\n\n# x\n`);
  return dir;
}
test('validateAdr: 有効な ADR の題は 60 字までで、別の ADR の番号から始めない', () => {
  const { validateAdrDir } = require(path.join(PLUGIN, 'skills/d2-decide/scripts/validateAdr.js'));
  const msgs = (dir) => validateAdrDir(dir).errors.map((e) => e.message).filter((m) => /title/.test(m));
  assert.deepEqual(msgs(adrRepo('あ'.repeat(60))), []);
  assert.match(msgs(adrRepo('あ'.repeat(61)))[0], /title が 61 字 \(上限 60 字\)/);
  assert.match(msgs(adrRepo('ADR 0018 を引き継ぎ、値はクエリで渡す'))[0], /別の ADR の番号から始めない/);
  // 置き換えられた ADR は直さなくてよい
  assert.deepEqual(msgs(adrRepo('あ'.repeat(61), 'deprecated')), []);
});

// --- 開発ルール: 要点の表 + ADR へのリンク + 折りたたみ ------------------------

test('genRules: 決定ごとのルールは、要点と ADR へのリンクの表を先頭に置き、細目を ADR ごとの折りたたみにする', () => {
  const dir = tmp('d2rules-');
  W(dir, 'docs/adr/0003-data.md', '---\nid: "0003"\ntitle: "データは RDB 1 つに置く"\nstatus: accepted\nscope: [data]\nrules:\n  - scope: tier:backend\n    text: "migration は追加だけ"\n  - scope: tier:backend\n    text: "日時は UTC で保存する"\n  - scope: tier:backend\n    text: "domain は repository に依存しない"\n    arch_test: { from: "apps/b/src/domain/**", to: "apps/b/src/repository/**", effect: forbid, level: layer }\ntiers:\n  - { id: b, dir: apps/b, kind: backend, lang: ts }\n---\n');
  execFileSync(process.execPath, [path.join(PLUGIN, 'skills/d2-foundation/scripts/genRules.js'), '--cwd', dir, '--adr', 'docs/adr', '--out', 'docs/rules'], { encoding: 'utf8' });
  const md = fs.readFileSync(path.join(dir, 'docs/rules/tier-backend.md'), 'utf8');
  assert.match(md, /\| 決定 \| 要点 \| 細目 \|\n\|---\|---\|---\|\n\| \[ADR 0003\]\(\.\.\/adr\/0003-data\.md\) \| データは RDB 1 つに置く \| 2 件 \+ 依存の向き 1 件 \(上の表\) \|/);
  assert.match(md, /<details>\n<summary><b>ADR 0003<\/b> データは RDB 1 つに置く \(2 件\)<\/summary>\n\n- migration は追加だけ\n- 日時は UTC で保存する\n\n<\/details>/);
  // 依存の向きの表の出典もリンクにする
  assert.match(md, /\| domain は repository に依存しない \| \[ADR 0003\]\(\.\.\/adr\/0003-data\.md\) \|/);
  assert.doesNotMatch(md, /^### ADR /m);
  // 依存の向きだけを決めた ADR も要点の表に載る (折りたたみは作らず、細目は依存の向きの表を指す)
  W(dir, 'docs/adr/0004-layers.md', '---\nid: "0004"\ntitle: "依存は内側へ向ける"\nstatus: accepted\nscope: [app]\nrules:\n  - scope: tier:backend\n    text: "usecase は presentation に依存しない"\n    arch_test: { from: "apps/b/src/usecase/**", to: "apps/b/src/presentation/**", effect: forbid, level: layer }\n---\n');
  execFileSync(process.execPath, [path.join(PLUGIN, 'skills/d2-foundation/scripts/genRules.js'), '--cwd', dir, '--adr', 'docs/adr', '--out', 'docs/rules'], { encoding: 'utf8' });
  const md2 = fs.readFileSync(path.join(dir, 'docs/rules/tier-backend.md'), 'utf8');
  assert.match(md2, /\| \[ADR 0003\]\(\.\.\/adr\/0003-data\.md\) \| データは RDB 1 つに置く \| 2 件 \+ 依存の向き 1 件 \(上の表\) \|\n\| \[ADR 0004\]\(\.\.\/adr\/0004-layers\.md\) \| 依存は内側へ向ける \| 依存の向き 1 件 \(上の表\) \|/);
  assert.doesNotMatch(md2, /<summary><b>ADR 0004<\/b>/);
  // 依存の向きだけの ADR しか無いファイルでも、要点の表は出る
  fs.rmSync(path.join(dir, 'docs/adr/0003-data.md'));
  W(dir, 'docs/adr/0001-tiers.md', '---\nid: "0001"\ntitle: "ティアは 1 つ"\nstatus: accepted\nscope: [system]\ntiers:\n  - { id: b, dir: apps/b, kind: backend, lang: ts }\n---\n');
  execFileSync(process.execPath, [path.join(PLUGIN, 'skills/d2-foundation/scripts/genRules.js'), '--cwd', dir, '--adr', 'docs/adr', '--out', 'docs/rules'], { encoding: 'utf8' });
  const md3 = fs.readFileSync(path.join(dir, 'docs/rules/tier-backend.md'), 'utf8');
  assert.match(md3, /## 決定ごとのルール[\s\S]*\| \[ADR 0004\]\(\.\.\/adr\/0004-layers\.md\) \| 依存は内側へ向ける \| 依存の向き 1 件 \(上の表\) \|/);
  assert.doesNotMatch(md3, /<details>/);
  assert.ok(fs.existsSync(path.resolve(dir, 'docs/rules', '../adr/0004-layers.md')), 'リンク先が実在する');
  assert.match(read('skills/d2-foundation/references/rule-templates/index.md'), /自分が触る領域の折りたたみを必ず開いて細目を読む/);
});

// --- docs/README.md: 画面設計への入口 ----------------------------------------

test('genDocsReadme: 画面の節が、画面設計・画面ごとの道筋と UC と写真・部品の階層へ案内する', () => {
  const { run } = require(path.join(PLUGIN, 'skills/d2-common/scripts/genDocsReadme.js'));
  const dir = tmp('d2screens-');
  W(dir, '.distillery/config.yaml', 'schema_version: "2.0"\ndocs_root: docs\n');
  W(dir, 'docs/requirements/use-cases.yaml', 'version: "2.0"\nuse_cases:\n  - uc: 会議室を予約する\n    slug: reserve-room\n    business: 会議室予約\n    buc: 予約する\n    spec_ids: []\n    status: planned\n');
  W(dir, 'docs/design/_review-summary.md', '# 画面部品のレビュー要約\n');
  W(dir, 'docs/design/screens.yaml', 'screens:\n  - name: ReserveRoom\n    route: /reservations/new\n    uc_slugs: [reserve-room]\n    variants: [Default, Error]\n  - name: Other\n    route: /other\n    uc_slugs: []\n  - name: NoDefault\n    route: /nd\n    uc_slugs: []\n    variants: [Loading, NotOn30Minutes, Error]\n  - name: Unlisted\n    route: /ul\n    uc_slugs: []\n');
  // 通常の状態が無い画面: variants の順で最初に撮れているもの (Loading は撮れていない) を選ぶ。variants に無ければ名前順の最初
  for (const f of ['screens-nodefault--error.png', 'screens-nodefault--not-on-30-minutes.png', 'screens-unlisted--zeta.png', 'screens-unlisted--alpha.png', 'screens-reserveroom--error.png']) W(dir, `docs/design/screenshots/${f}`, 'png');
  W(dir, 'docs/design/screenshots/index.md', '# 写真\n');
  W(dir, 'docs/design/screenshots/screens-reserveroom--default.png', 'png');
  for (const f of ['components/ui/Button.tsx', 'components/ui/Button.stories.tsx', 'components/domain/ReservationForm.tsx', 'components/domain/helper.ts', 'components/layout/AppShell.tsx', 'stories/ReserveRoom.stories.tsx']) W(dir, `packages/ui/${f}`, '');
  const r = run({ cwd: dir, config: '.distillery/config.yaml' });
  assert.equal(r.code, 0, JSON.stringify(r));
  const md = fs.readFileSync(path.join(dir, 'docs/README.md'), 'utf8');
  assert.match(md, /\[画面設計 \(流れ・状態・部品の役割\)\]\(design\/_review-summary\.md\)/, '段階の表から画面設計へ');
  assert.match(md, /## 画面\n\n画面 4 枚。画面の流れ・状態ごとの見本・部品の役割は \[画面設計\]\(design\/_review-summary\.md\)。/);
  assert.match(md, /\| ReserveRoom \| `\/reservations\/new` \| 会議室を予約する \| 2 \| \[通常の状態\]\(design\/screenshots\/screens-reserveroom--default\.png\) \|/);
  assert.match(md, /\| Other \| `\/other` \| - \| - \| - \|/, '写真が無い画面はリンクを出さない');
  assert.match(md, /\| NoDefault \| `\/nd` \| - \| 3 \| \[状態: NotOn30Minutes\]\(design\/screenshots\/screens-nodefault--not-on-30-minutes\.png\) \|/);
  assert.match(md, /\| Unlisted \| `\/ul` \| - \| - \| \[状態: alpha\]\(design\/screenshots\/screens-unlisted--alpha\.png\) \|/);
  const order = ['| 画面の見本 (1) |', '| 業務の部品 (1) |', '| 画面の枠 (1) |', '| 土台の部品 (1) |'].map((s) => md.indexOf(s));
  assert.ok(order.every((i) => i > 0) && order.join() === [...order].sort((a, b) => a - b).join(), `部品の階層の順: ${order}`);
  assert.match(md, /\| 業務の部品 \(1\) \| \[packages\/ui\/components\/domain\/\]\(\.\.\/packages\/ui\/components\/domain\) \| ReservationForm \|/, 'stories と .ts の補助は部品に数えない');
  assert.match(md, /\| 会議室を予約する \| 未着手 \|[^\n]*\| \[ReserveRoom\]\(#画面\) \|/, 'UC の表の画面の列から画面の節へ');
  assert.match(md, /- \[写真の一覧 \(部品と画面の状態ごと\)\]\(design\/screenshots\/index\.md\)/);
  assert.doesNotMatch(md, /distillery2 以外の文書/, '写真の一覧を「distillery2 以外の文書」に出さない');
});

// --- 冪等性と再試行 ----------------------------------------------------------

test('決定の領域: 冪等性と再試行を必ず決める領域 (15) にし、エラーハンドリングとメッセージングはそこを指す', () => {
  const req = read('skills/d2-decide/references/required-decisions.md');
  assert.match(req, /次の 14 領域 \(1〜8・10〜15\) を ADR で覆う/);
  assert.match(req, /\| 14 \| 機械チェック [^\n]*\n\| 15 \| 冪等性と再試行 \| app \| \[idempotency-retry\.md\]\(decision-candidates\/idempotency-retry\.md\) \|/, '表の行が途切れない');
  const c = read('skills/d2-decide/references/decision-candidates/idempotency-retry.md');
  for (const k of ['同じ要求の見分け方', '見分けたときの返し方', '判定の順番', '最後の砦', '再試行する範囲', '時間切れ']) assert.ok(c.includes(`**${k}**`), k);
  assert.ok(read('skills/d2-decide/SKILL.md').includes('decision-candidates/idempotency-retry.md'));
  assert.match(read('skills/d2-decide/SKILL.md'), /14 領域 \(1〜8・10〜15\)/);
  assert.match(read('skills/d2-decide/references/decision-candidates/error-handling.md'), /\*\*再試行と冪等\*\*: ここでは決めない。冪等性と再試行の ADR \(idempotency-retry\.md\)/);
  const msg = read('skills/d2-decide/references/decision-candidates/messaging.md');
  assert.match(msg, /冪等性は、メッセージングの ADR には書かない。同期の API も非同期の処理も、冪等性と再試行の ADR \(idempotency-retry\.md\) の 1 本に書く/);
  assert.doesNotMatch(msg.split('## 冪等性')[1].split('\n## ')[0], /scope:/, '非同期の冪等性のルール例はメッセージングに置かない (記録先は 1 本)');
  assert.match(c, /scope: tier:worker\n  text: "同じメッセージ ID を 2 回受けても、副作用を重複させない"/);
  assert.match(msg, /^同期 \/ 非同期、outbox、Saga を決める \(冪等性はここでは決めない。冪等性と再試行の ADR に書く\)。/m);
  assert.doesNotMatch(msg, /Idempotency-Key/, 'API の冪等キーの例をメッセージングに残さない (新しい領域の選択と食い違う)');
});
