'use strict';
// 0.1.19 で直した手順 (実走 0.1.10 / 0.1.13 / 0.1.16 の課題) が手順書から消えないように、要となる文言を固定する。
// 手順書は LLM が解釈するため、振る舞いそのものは実走でしか確かめられない。ここでは「書いてあること」だけを守る。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PLUGIN = path.resolve(__dirname, '../../../plugins/distillery2');
const read = rel => fs.readFileSync(path.join(PLUGIN, rel), 'utf8');

const SKILL = 'skills/d2-run/SKILL.md';
const TEMPLATE = 'skills/d2-run/references/subagent-template.md';
const RUN_STATE = 'skills/d2-run/references/run-state.md';
const DELIVERY = 'skills/d2-run/references/git-delivery.md';

/** 表の行 (`| **<stage>** |` や `| ④ <stage>`) を 1 行で返す */
function row(text, re) {
  const line = text.split('\n').find(l => re.test(l));
  assert.ok(line, `row not found: ${re}`);
  return line;
}

test('記録付きのゲートはオーケストレータが 1 回だけ回す (tier 実装者は runGates を使わない)', () => {
  const tierRow = row(read(SKILL), /^\| \*\*tier\*\* \|/);
  assert.match(tierRow, /自分が 1 回だけ.*runGates\.js --uc <slug> --tiers <関与ティア> --upto unit/);
  const impl = read('skills/d2-implement/references/tier-impl.md');
  assert.match(impl, /`runGates\.js` は使わない/);
  assert.match(impl, /`\{report\}` は OS の一時ファイル/);
  const tmplTier = row(read(TEMPLATE), /^\| ④ tier /);
  assert.match(tmplTier, /OS の一時ファイル/);
  assert.doesNotMatch(tmplTier.split('|')[5], /reports/, 'tier の write-set に reports を入れない (並列で記録を消し合う)');
});

test('単独の段 (scaffold / integrate) は runGates の出力先を write-set に持つ', () => {
  assert.match(row(read(TEMPLATE), /^\| ④ integrate /), /`<run>\/reports\/\*\*`、`<run>\/traces\/\*\*`/);
  assert.match(row(read(TEMPLATE), /^\| ④ scaffold /), /`<run>\/reports\/\*\*`/);
});

test('scaffold の入口スタブは新規ファイルだけ・中立の値を返す・動的 import で回避しない', () => {
  assert.match(row(read(TEMPLATE), /^\| ④ scaffold /), /新規ファイルだけ/);
  const scaffold = read('skills/d2-implement/references/scaffold.md');
  assert.match(scaffold, /型に合う中立の値/);
  assert.match(scaffold, /throw で落とさない/);
  assert.match(scaffold, /動的 import/);
  assert.match(read(TEMPLATE), /--diff-filter=MD/);
});

test('還流の保留: feedback_deferred → deliver 前に起票して commit', () => {
  const skill = read(SKILL);
  assert.match(row(skill, /^\| \*\*feedback\*\* \|/), /feedback_deferred/);
  const deliver = row(skill, /^\| \*\*deliver\*\* \|/);
  assert.match(deliver, /pending_feedback/);
  assert.match(deliver, /impl\(<slug>\): feedback filed/);
  assert.match(skill, /feedback_deferred \{kind, issue_path, reason\}/);
  assert.match(read(RUN_STATE), /^\| feedback_deferred \|/m);
  assert.match(read(RUN_STATE), /^\| blocked_on_requirement \|/m);
  assert.match(read(DELIVERY), /pending_feedback` が空/);
});

test('人レビューの「要求を直す」は下書き → その場で起票か保留 → 停止', () => {
  const skill = read(SKILL);
  assert.match(skill, /「要求を直す」があれば `issues\/` に下書き/);
  assert.match(skill, /起票できない実行 \(push 禁止・`gh` 未認証・リモート無し\) では `feedback_deferred` を記録する/);
});

test('upstream が無いリポでは upstream 一致の条件を飛ばす', () => {
  assert.match(read(DELIVERY), /upstream が設定されていなければ/);
});

test('契約の変更の分類 (own / other_uc / shared) を contract 段で記録し、人レビューに載せる', () => {
  const skill = read(SKILL);
  assert.match(row(skill, /^\| \*\*contract\*\* \|/), /classifyContractChanges\.js --uc <slug> --json/);
  assert.match(skill, /contract_changes/);
  assert.ok(fs.existsSync(path.join(PLUGIN, 'skills/d2-contract/scripts/classifyContractChanges.js')));
});

test('他 UC への波及: 初期候補を渡し、Verifier が import 元を辿る (read-set の例外つき)', () => {
  assert.match(row(read(SKILL), /^\| \*\*verify\*\* \|/), /他 UC と共有する変更ファイル/);
  assert.match(row(read(TEMPLATE), /^\| ④ verify /), /他 UC と共有する変更ファイル/);
  const vp = read('skills/d2-verify/references/viewpoints.md');
  assert.match(vp, /cross_uc_change/);
  assert.match(vp, /import している側を辿る/);
  assert.match(read('skills/d2-verify/SKILL.md'), /^\| 他 UC への波及 \(例外\) \|/m);
});

test('asbuilt: 抽出から検査まで要約役が通しで行い、d2-run は集計ファイルで受理と差し戻しを判断する (0.1.22)', () => {
  const tmpl = row(read(TEMPLATE), /^\| ④ asbuilt /);
  assert.match(tmpl, /依存グラフの実態 → 抽出 → 要約 → 検査までこのスキルが行う/);
  assert.match(tmpl, /抽出の標準出力 1 行を報告に転記する/);
  const asbuilt = row(read(SKILL), /^\| \*\*asbuilt\*\* \|/);
  assert.match(asbuilt, /`<run>\/reports\/asbuilt\.json` があれば消してから/, '前回の集計で受理しない');
  assert.match(asbuilt, /`slug` が今回の UC、`attempt` が `runState\.js status` の attempt と一致/);
  assert.match(asbuilt, /instrumentation_gaps/);
  assert.match(asbuilt, /asbuilt を done にせず integrate へ戻して/, '差し戻しの判断は d2-run に残す');
  assert.doesNotMatch(asbuilt, /npx depcruise/, 'depcruise は d2-asbuilt が回す');
  // integrate への戻し方 (0.1.22 の試し運転で手順に無いイベントを自作した。0.1.23)
  assert.match(asbuilt, /`node runState\.js return-to-integrate <run> /, 'findings の退避・done の退避・記録を 1 操作で (途中で止まっても古い findings を残さない)');
  assert.match(asbuilt, /`returned_to_integrate \{from, instrumentation_gaps, instrumentation_happy_gaps, moved_findings\}`/);
  assert.match(asbuilt, /attempt は上げない/);
  assert.match(asbuilt, /`<run>\/invalidated\/<ts>_attempt-<n>_findings\.<tier>\.yaml` へ移し/, '再検証の前の findings で受理しない');
  assert.match(asbuilt, /moved_findings/);
  assert.match(read(RUN_STATE), /^\| returned_to_integrate \|/m);
  assert.match(row(read(TEMPLATE), /^\| ④ integrate /), /returned_to_integrate/);
  // 抽出は前回の要約を残すので、成果物だけでは今回の要約を区別できない。as-built は完了報告も要る
  assert.match(asbuilt, /要約役の完了報告/);
  assert.match(read(TEMPLATE), /例外: asbuilt は要約役の完了報告/);
  const skill = read('skills/d2-asbuilt/SKILL.md');
  assert.match(skill, /npx depcruise/);
  assert.match(skill, /extractAsBuilt\.js/);
  assert.match(skill, /checkAsBuilt\.js/);
});

test('③ の後始末は d2-foundation phase=finish。d2-run は gates.json を読んで受理する (0.1.22)', () => {
  const skill = read(SKILL);
  const s3 = skill.slice(skill.indexOf('## ③ 基盤'), skill.indexOf('## ④'));
  assert.match(s3, /sub `d2-foundation phase=all`/);
  assert.match(s3, /sub `d2-foundation phase=finish ui=/);
  assert.ok(s3.indexOf('sub `d2-design`') < s3.indexOf('sub `d2-foundation phase=finish ui='), 'design は仕上げの前');
  // 手順 (番号付きの行と、その続きの字下げ行) に、移したスクリプトを直接回す記述が無い
  const steps = s3.split('\n').filter(l => /^(\d+\.|   )/.test(l)).join('\n');
  for (const s of ['npm install', 'genConfig.js', 'genCi.js', 'genArchitectureDoc.js', 'importUi.js', 'runGates.js']) {
    assert.ok(!steps.includes(s), `d2-run の ③ の手順が ${s} を直接回していない`);
  }
  // genContractTests.js は受理時の読むだけの検査 (--check) としてだけ出てよい
  for (const m of steps.matchAll(/genContractTests\.js[^\n]*/g)) assert.match(m[0], /--check/, 'd2-run は契約テストを生成しない');
  assert.match(s3, /`\.distillery\/runs\/bootstrap\/reports\/gates\.json` があれば消してから/);
  // gates.json の gates は {name, status} の配列 (runGates.js が書く形)。キー参照で書かない
  assert.match(s3, /`gates` \(`\{name, status\}` の配列\) のうち `name` が `static` の要素の `status` が `pass`/);
  // F6 は d2-run が design を派遣したかで決める (古い docs/design の有無で決めない)
  assert.match(s3, /sub `d2-foundation phase=finish ui=<true\|false>`/);
  assert.match(s3, /design が「画面を持たないプロダクトのため skip」と報告したら `ui=false`/);
  assert.match(s3, /design の完了報告が届くまで仕上げに進まない/);
  // 仕上げの前に契約と画面部品を commit する (未 commit だと仕上げの生成物の basis が空になる。0.1.23)
  assert.match(s3, /`git add contracts docs\/design && git commit -m "foundation: contracts and design"`/);
  assert.ok(s3.indexOf('foundation: contracts and design') < s3.indexOf('sub `d2-foundation phase=finish ui='), 'commit は仕上げの派遣の前');
  // 先に commit した契約を、仕上げの C4 図が basis に記録する (config と画面部品の取り込み記録は生成器が自分で契約・design を記録する)
  assert.match(read('skills/d2-foundation/SKILL.md'), /genArchitectureDoc\.js .*requirements=docs\/requirements contracts=contracts .*# F8/);
  assert.match(read(TEMPLATE), /例外: ③ の画面部品 \(d2-design\) は完了報告/);
  // static のゲートは契約テストの生成を見ないので、F4 の生成物の鮮度を受理時に確かめる
  assert.match(s3, /genContractTests\.js contracts --config \.distillery\/config\.yaml --out-root \. --check` が exit 0/);
  const fnd = read('skills/d2-foundation/SKILL.md');
  assert.match(fnd, /`ui=false` なら F6 と次の F7 を飛ばす/);
  assert.match(fnd, /前の実行の `docs\/design\/` が残っていても取り込まない/);
  assert.match(row(read(TEMPLATE), /^\| ③ 基盤 \(仕上げ\) /), /`node_modules\/\*\*`/);
  assert.match(read(TEMPLATE), /例外: 手順書が回すスクリプトの内部の git/);
});

test('差し戻し後の integrate: 必ず派遣し、結線変更なしなら wiring_changed: false', () => {
  const integrate = row(read(SKILL), /^\| \*\*integrate\*\* \|/);
  assert.match(integrate, /必ず派遣/);
  assert.match(integrate, /wiring_changed: false/);
});

// 0.1.24: 還流の書き換えを持ち主のスキルへ寄せた (todo ⓪ 0-3)。外部レビュー (計画 3 ラウンド) で決めた順序を固定する
function feedbackSection() {
  const t = read(SKILL);
  const i = t.indexOf('## 還流 (feedback 段階)');
  const j = t.indexOf('\n## ', i + 1);
  assert.ok(i >= 0 && j > i, '還流節がある');
  return t.slice(i, j);
}

test('還流: d2-run は ADR・契約を自分で書き換えず、持ち主のスキルを派遣する', () => {
  const fb = feedbackSection();
  assert.match(fb, /上流の文書 \(ADR・開発ルール・契約\) は自分で書き換えない/);
  assert.doesNotMatch(fb, /\| rule \| 自分/);
  assert.doesNotMatch(fb, /\| contract \| 自分/);
  assert.doesNotMatch(fb, /ADR を追記 \(`docs\/adr\/`\) → `genRules\.js`/, '旧手順 (d2-run が ADR を追記して genRules) が残っていない');
  assert.match(fb, /d2-decide `mode=feedback`/);
  assert.match(fb, /d2-foundation `phase=rules`/);
  assert.match(fb, /d2-contract `mode=feedback`/);
});

test('還流: ADR の commit が rules の再生成より前、--check は生成物の commit より前', () => {
  const fb = feedbackSection();
  const adrCommit = fb.indexOf('commit -m "feedback(<slug>): adr"');
  const rulesDispatch = fb.indexOf('sub d2-foundation `phase=rules`');
  const rulesCheck = fb.indexOf('genRules.js --adr docs/adr --out docs/rules --check');
  const rulesCommit = fb.indexOf('commit -m "feedback(<slug>): rules"');
  assert.ok(adrCommit > 0 && rulesDispatch > adrCommit, 'ADR を commit してからルールを作り直す (basis が新しい ADR を指す)');
  assert.ok(rulesCheck > rulesDispatch && rulesCommit > rulesCheck, 'ルールの --check は commit の前');
  assert.match(fb, /受理の `--check` は\*\*生成物を commit する前に\*\*回す/);
  const contractCheck = fb.indexOf('genRdbDdl.js contracts --config .distillery/config.yaml --out-root . --check');
  const contractCommit = fb.indexOf('commit -m "feedback(<slug>): contracts"');
  assert.ok(contractCheck > 0 && contractCommit > contractCheck, '契約の --check (genRdbDdl を含む) は commit の前');
});

test('還流: 課題は logs に写し、記録は feature に戻ってから書く', () => {
  const fb = feedbackSection();
  assert.match(fb, /`\.distillery\/logs\/feedback\/<slug>`/);
  assert.match(fb, /課題を `<fb>\/<issue>\.md` に写す/);
  const back = fb.indexOf('`git switch feature/<slug>` (還流 branch が clean');
  const filed = fb.indexOf('`feedback_filed {kind, url, issue_path}` を記録し、`impl(<slug>): feedback filed` で commit');
  assert.ok(back > 0 && filed > back, 'feedback_filed は feature に戻った後');
  assert.match(fb, /記録は feature に戻ってから書く/);
});

test('還流: 分岐は結果ファイル、absent は開始点の契約と照合して理由を書き分ける', () => {
  const fb = feedbackSection();
  assert.match(fb, /`<fb>\/<issue>\.result\.json` も消す/);
  assert.match(fb, /git grep -q <名前> <base_head> -- contracts\//);
  assert.match(fb, /いま実装中の UC 自身の契約の穴/);
  assert.match(fb, /対象は開始点の契約にあるが、派遣の結果は absent だった/);
  assert.match(fb, /派遣の直前に控えた一覧 \(`<fb>\/<issue>\.untracked\.txt`\) に無かった未追跡ファイルだけ/);
  assert.match(fb, /force push はしない/);
  assert.match(fb, /還流 branch = `feedback\/<slug>\/<issue>`/);
});

test('還流: 派遣表に 3 行あり、結果ファイルを write-set に持つのは ADR と契約の行だけ', () => {
  const t = read(TEMPLATE);
  const adr = row(t, /^\| ④ 還流 \(ADR\) /);
  const rules = row(t, /^\| ④ 還流 \(ルールの再生成\) /);
  const contract = row(t, /^\| ④ 還流 \(契約\) /);
  assert.match(adr, /mode=feedback/);
  assert.match(contract, /mode=feedback/);
  assert.match(rules, /phase=rules/);
  const RESULT = '`.distillery/logs/feedback/<slug>/<issue>.result.json`';
  assert.ok(adr.split('|')[5].includes(RESULT));
  assert.ok(contract.split('|')[5].includes(RESULT));
  assert.ok(!rules.split('|')[5].includes(RESULT));
});

test('還流: 結果ファイルを消す・見るのは d2-decide / d2-contract の派遣だけ。ルールの再生成は --check と write-set で受理する (差分レビュー 1 ラウンド目)', () => {
  const fb = feedbackSection();
  // 消すのは 2 つの派遣の直前だけ (「各派遣の直前に結果ファイルを消す」と書くと、基盤の派遣の後に結果ファイルが無くて止まる)
  assert.match(fb, /d2-decide と d2-contract の派遣の直前には、`<fb>\/<issue>\.result\.json` も消す/);
  assert.doesNotMatch(fb, /各派遣の直前[^。]*結果ファイル[^。]*を消す/);
  // 止まる条件の結果ファイルは 2 つの派遣に限る
  assert.match(fb, /d2-decide \/ d2-contract の結果ファイルが `applied` 以外/);
  // ルールの再生成の受理
  const i = fb.indexOf('sub d2-foundation `phase=rules`');
  const j = fb.indexOf('   - contract:', i);
  const rulesStep = fb.slice(i, j);
  assert.match(rulesStep, /結果ファイルは使わない/);
  assert.match(rulesStep, /genRules\.js [^`]*--check/);
  assert.match(rulesStep, /genArchTests\.js [^`]*--check/);
  assert.match(rulesStep, /write-set の外が変わっていなければ受理/);
});

test('還流: 還流 branch の上で再開したら clean 判定より先に後始末する。派遣前の未追跡ファイルの一覧はファイルに残す (差分レビュー 1 ラウンド目)', () => {
  const t = read(SKILL);
  const startup = t.slice(t.indexOf('## 起動シーケンス'), t.indexOf('## ① 要求'));
  const resume = startup.indexOf('現在の branch が還流 branch');
  const clean = startup.indexOf('作業ツリーの clean 判定');
  assert.ok(resume > 0 && clean > resume, '還流 branch の後始末は clean 判定より前');
  assert.match(read(DELIVERY), /現在 branch が還流 branch \(`feedback\/<slug>\/<issue>`\) なら、clean でなくても/);
  const fb = feedbackSection();
  assert.match(fb, /`<fb>\/<issue>\.untracked\.txt` に書く/);
  assert.match(fb, /派遣の直前に控えた一覧 \(`<fb>\/<issue>\.untracked\.txt`\) に無かった未追跡ファイルだけ/);
  assert.match(fb, /一覧のファイルが無い \(控える前に止まった\) なら、未追跡ファイルは消さずに/);
});

test('還流: 派遣表の受理の説明も、結果ファイルを使うのは ADR と契約の 2 行だけ (差分レビュー 2 ラウンド目)', () => {
  const t = read(TEMPLATE);
  const line = t.split('\n').find(l => l.startsWith('- 還流の 3 行'));
  assert.ok(line, '派遣表に還流の受理の説明がある');
  const rest = t.slice(t.indexOf(line)).split('\n').slice(0, 2).join('\n');
  assert.match(rest, /結果ファイルはこの 2 つの派遣の前にだけ消す/);
  assert.match(rest, /「④ 還流 \(ルールの再生成\)」は結果ファイルを書かないので使わず/);
  assert.doesNotMatch(t, /還流の 3 行も同じ: 分岐は結果ファイル/);
});

test('還流: push の後に中断しても branch を消さず、PR 作成から続ける (差分レビュー 2 ラウンド目)', () => {
  const fb = feedbackSection();
  assert.match(fb, /ローカルに無い \(push の後に中断\) → 7 の PR 作成だけへ/);
  assert.match(fb, /リモートに同じ名前の branch が\*\*無いときだけ\*\* `git branch -D/);
  const t = read(SKILL);
  const startup = t.slice(t.indexOf('## 起動シーケンス'), t.indexOf('## ① 要求'));
  assert.match(startup, /リモートに同じ branch があれば c は branch を消さない/);
});

test("還流: 還流 branch を切る前に最初の一覧を書き、git-delivery も push 済みの branch を消さない (差分レビュー 3 ラウンド目)", () => {
  const fb = feedbackSection();
  const list = fb.indexOf("未追跡ファイルの一覧を `<fb>/<issue>.untracked.txt` に書いてから");
  const sw = fb.indexOf("`git switch -c <還流 branch> <base_head>`");
  assert.ok(list > 0 && sw > list, "最初の一覧は branch を切る前");
  const d = read(DELIVERY);
  assert.match(d, /還流 branch は\*\*リモートに同じ名前の branch が無いときだけ\*\*消す/);
  assert.doesNotMatch(d, /feature に戻って還流 branch を消す/);
});

// 0.1.25: 止まった還流を理由つきで issue にする (0.1.24 の試し運転の G1。保留が配送を止め続けた)
function stoppedSection() {
  const fb = feedbackSection();
  const i = fb.indexOf('### 止まったとき');
  const j = fb.indexOf('### PR / issue を作れない実行');
  assert.ok(i >= 0 && j > i);
  return fb.slice(i, j);
}

test('還流 (0.1.25): 止まった課題は種類を問わず理由つきの issue にして feedback_filed。保留は照合・起票の失敗だけ', () => {
  const st = stoppedSection();
  assert.match(st, /止まった課題は、種類を問わず\*\*理由を添えて issue にする\*\*/);
  assert.match(st, /`feedback_filed \{kind, url, issue_path\}` を記録する \(`kind` は元の課題のまま/);
  assert.match(st, /2 の照合か 3 の起票が失敗したら、issue を作らず `feedback_deferred \{kind, issue_path, reason\}`/);
  // 保留が出てくるのは失敗時の 1 か所だけ
  assert.equal((st.match(/feedback_deferred/g) || []).length, 1, '止まったときの保留は照合・起票の失敗だけ');
  // 理由の表: 6 つの止まり方と、併発はすべて並べる
  for (const re of [/結果ファイルが `blocked`/, /`absent` で、`targets` の名前がどれも開始点の契約に無い/, /`absent` だが、開始点の契約に名前が 1 つでもある/, /受理の検査で落ちた/, /write-set の外が変わった/, /結果ファイルが無い/]) assert.match(st, re);
  assert.match(st, /成り立った理由は\*\*すべて\*\*並べ/);
  // 還流節の冒頭の表にも行き先が出ている
  const fb = feedbackSection();
  assert.equal((fb.match(/派遣が止まったら理由つきの issue/g) || []).length, 2, 'rule と contract の行');
});

test('還流 (0.1.25): 重複を防ぐ印と照合、issue にしない 2 場面', () => {
  const st = stoppedSection();
  const search = st.indexOf('gh issue list --state all --search "distillery2-feedback: <slug>/<issue>"');
  const create = st.indexOf('無ければ `gh issue create`');
  assert.ok(search > 0 && create > search, '起票の前に印で照合する');
  assert.match(st, /印の行 `distillery2-feedback: <slug>\/<issue>`/);
  assert.match(st, /issue にしない場面は 2 つ/);
  assert.match(st, /リモートの還流 branch とローカルの commit が違う/);
  assert.match(st, /「一覧が無い \/ 消せないものがある」/);
});

test('還流 (0.1.25): run-state と git-delivery も同じ条件', () => {
  const rs = read(RUN_STATE);
  assert.match(rs, /還流の派遣が止まった課題を理由つきの issue にしたときも同じイベント/);
  assert.match(rs, /issue の照合 \(`gh issue list`\) か起票 \(`gh issue create`\) が失敗した/);
  assert.doesNotMatch(rs, /還流の派遣が止まった \(ADR で表せない・検査で落ちた/);
  const d = read(DELIVERY);
  assert.match(d, /rule \/ contract は別 branch の PR か、派遣が止まったなら理由つきの issue/);
  assert.match(d, /還流の派遣が止まった rule \/ contract は `rule:<issue_url>` \/ `contract:<issue_url>`/);
  assert.match(d, /^- 派遣が止まった課題 .*は、止まった理由を添えて issue にする/m);
});
