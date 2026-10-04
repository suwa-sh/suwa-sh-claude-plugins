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

// 0.1.27: 還流は UC の外の独立した段階。溜まった課題ファイルを worktree 1 つでまとめて直し、git の状態遷移は feedbackBatch.js が行う。
// 外部レビュー (計画 3 ラウンド) で決めた要点を固定する。状態遷移そのものは tests/distillery2/lib/feedbackBatch.test.js が使い捨てリポジトリで確かめる
function section(rel, start, end) {
  const t = read(rel);
  const i = t.indexOf(start);
  assert.ok(i >= 0, `${rel}: ${start}`);
  const j = end ? t.indexOf(end, i + 1) : -1;
  return t.slice(i, j < 0 ? undefined : j);
}
const feedbackSection = () => section(SKILL, '## 還流 (独立した段階)', '## 完了報告');
const deliverSection = () => section(SKILL, '## 配送 (deliver 段階)', '## 還流 (独立した段階)');
const autoSelect = () => section(SKILL, '自動選択の順', '## 原則');

test('0.1.26: 手順書に gh (PR / issue) が出てこない', () => {
  for (const rel of [SKILL, DELIVERY, RUN_STATE, TEMPLATE, 'skills/d2-decide/SKILL.md', 'skills/d2-contract/SKILL.md', 'skills/d2-foundation/SKILL.md']) {
    assert.doesNotMatch(read(rel), /\bgh (pr|issue|auth)\b/, `${rel} に gh のコマンドがある`);
  }
  assert.match(read(SKILL), /PR \/ issue は作らない/);
});

test('0.1.27: UC は配送で終わる。配送の squash の前に UC の課題を課題ファイルにする', () => {
  assert.match(read(RUN_STATE), /`scenario → contract → scaffold → tier → contract-gate → integrate → verify → review → asbuilt → deliver`\n/);
  const t = read(SKILL);
  assert.ok(!t.includes('| **feedback** |'), '④ の表に feedback の段階が無い');
  assert.match(row(t, /^\| \*\*deliver\*\* \|/), /`unfiled_issues` が空/);
  const d = deliverSection();
  const order = ['feedbackBatch.js file-issues <run>', '`impl(<slug>): issues to feedback` で commit', 'git reset --soft <base_head>', '引数が `merge=hold` なら、ここで止めて報告する', '`git merge --ff-only feature/<slug>`', '`impl(<slug>): delivered` で commit', '`git push origin main`', '`git branch -d feature/<slug>`'];
  let last = -1;
  for (const o of order) { const i = d.indexOf(o); assert.ok(i > last, `配送の順: ${o}`); last = i; }
  assert.match(d, /force push はしない/);
  assert.match(read(DELIVERY), /UC の課題がすべて課題ファイルになっている \(`runState\.js status` の `unfiled_issues` が空/);
});

test('0.1.26: 旧形式の run は確認ページで聞き、d2-run が mark-legacy-delivered で印を付けて commit する', () => {
  const d = deliverSection();
  assert.match(d, /`legacy_order: true`/);
  assert.match(d, /確認ページで人に聞く/);
  assert.match(d, /`node runState\.js mark-legacy-delivered <run>`/);
  assert.match(d, /`impl\(<slug>\): legacy delivered` で main に commit/);
  assert.match(d, /\*\*main に切り替えて\*\* \(`git switch main`/);
  assert.match(d, /`node runState\.js invalidate <run> feedback <理由>`/);
});

test('0.1.27: 自動選択: 進行中の UC が先。無ければ main に切り替えて、未 push の push → 途中の還流 → 要求の差分 → 還流 → 次の UC', () => {
  const a = autoSelect();
  assert.match(a, /\*\*進行中の UC\*\* があれば、その UC の ④ を続ける/);
  assert.match(a, /`blocked_on_requirement` でない UC/);
  assert.match(a, /\*\*clean な main に切り替えてから\*\*/);
  const order = ['`git rev-list --count origin/main..main` が 0 でなければ', '`batch.point` が `none` 以外', '`requirement` が空でない', '`feedback_due` が true', '`status` が `done` でない最初の UC'];
  let last = -1;
  for (const o of order) { const i = a.indexOf(o); assert.ok(i > last, `自動選択の順: ${o}`); last = i; }
  assert.match(a, /止まった課題 \(課題ファイルの `stopped: true`\) は 3・4 のきっかけにしない/);
  assert.match(a, /進行中の UC があれば止まって報告する/);
  assert.match(a, /force push はしない/);
});

test('0.1.27: 要求の差分: 一括承認、外す課題はやり直し、残す課題は hold、trailer で記録、要求で止まった UC の feature を退避', () => {
  const r = section(SKILL, '### 要求の差分', '## ② 決定');
  assert.match(r, /\*\*承認は一括\*\*/);
  assert.match(r, /`git checkout -- docs\/requirements` と `git clean -fd -- docs\/requirements`/);
  assert.match(r, /`feedbackBatch\.js hold <issue> --reason-file <ファイル>`/);
  assert.match(r, /`Feedback-Consumed: docs\/feedback\/<issue>\.md`/);
  assert.match(r, /`Feedback-Dismissed: docs\/feedback\/<issue>\.md`/);
  assert.match(r, /`git update-ref refs\/distillery2\/abandoned\/<slug>\/<ts> feature\/<slug>` で退避してから `git branch -D feature\/<slug>`/);
  assert.match(r, /requirement_all/);
  assert.match(row(read(TEMPLATE), /^\| ① 要求 /), /未処理の要求の課題ファイルのパス/);
  assert.match(read('skills/d2-requirements/SKILL.md'), /課題ファイルは読むだけで、消さない/);
});

test('0.1.27: 還流: 上流は持ち主のスキルが直し、git の状態遷移は feedbackBatch.js。自分で worktree・cherry-pick・merge を組まない', () => {
  const fb = feedbackSection();
  assert.match(fb, /\*\*上流の文書 \(ADR・契約\) は自分で書き換えない\*\*/);
  assert.match(fb, /git の状態遷移は `feedbackBatch\.js` に任せる/);
  assert.doesNotMatch(fb, /git worktree add <wt>|git merge --ff-only <還流 branch>|git cherry-pick/, '還流の git を d2-run が直接打たない');
  assert.match(fb, /d2-decide `mode=feedback`/);
  assert.match(fb, /d2-contract `mode=feedback`/);
  assert.doesNotMatch(fb, /phase=rules/, 'ルールの作り直しは派遣しない (feedbackBatch が最後にまとめて作る)');
  assert.doesNotMatch(read('skills/d2-foundation/SKILL.md'), /phase=all \| finish \| rules/);
  assert.doesNotMatch(read(TEMPLATE), /還流 \(ルールの再生成\)/);
  for (const re of [/^\| 還流 \(ADR\) /, /^\| 還流 \(契約\) /]) {
    const r = row(read(TEMPLATE), re);
    assert.match(r, /`課題: <worktree の中の docs\/feedback\/<issue>\.md の絶対パス>`/, '課題は課題ファイルを読む');
    assert.match(r, /`作業ディレクトリ: <本体の \.distillery\/worktrees\/feedback の絶対パス>/);
  }
  assert.doesNotMatch(fb, /\.ready|\.approved/, '課題ごとの印は使わない');
});

test('0.1.27: 還流の順: 再開の判定 → 切り出し → 課題ごと (派遣 → 受理 → commit-issue → regen → static → record-static → discard) → finalize → ゲート → 確認ページ → hold → merge', () => {
  const fb = feedbackSection();
  const order = ['`FB status`', '`FB start`', '`git -C <wt> status --porcelain` が空', '派遣表「還流 (ADR)」', '派遣表「還流 (契約)」', '`FB commit-issue <issue>`', '`FB regen` → `runGates.js --uc d2-feedback --only static`', '`FB record-static <issue>`', '5. `FB discard` (成功でも失敗でも', '`FB stop-issue <issue> --reason-file', '`FB finalize`', '`FB record-gate --result', '**確認ページ 1 回**', '`FB decide --take', '`FB rebuild`', '引数が `merge=hold` なら止めて報告する', '**取り込み**: `FB merge`'];
  let last = -1;
  for (const o of order) { const i = fb.indexOf(o); assert.ok(i > last, `還流の順: ${o}`); last = i; }
});

test('0.1.27: 還流のゲート: 課題ごとに static、最後に 1 回 (rule は static、contract は変えた契約を使う UC ごとの全段)。落ちても推測で外さない', () => {
  const fb = feedbackSection();
  assert.match(fb, /`runGates\.js --uc d2-feedback --only static`/, 'run 名は kebab-case (runGates が _ 始まりを拒む)');
  assert.match(fb, /\*\*変えた契約を使う UC ごとに\*\* `runGates\.js --uc <その UC> --tiers <その UC の use-cases\.yaml の tiers>` \(全段/);
  assert.match(fb, /ルールの課題だけなら static だけ/);
  assert.match(fb, /落ちても原因を推測で課題を外さない/);
  assert.match(fb, /branch の先頭の sha と一緒に残る/);
});

test('0.1.27: 還流の確認ページ: 出す条件 (取り込む課題・2 回目以上の停止・ゲートの落ち)、出さないときも decide --auto、落ちたら全部の取り込みは選べない', () => {
  const fb = feedbackSection();
  assert.match(fb, /取り込む課題 \(`commit-issue` の `result` が `committed`\)、2 回目以上止まった課題/);
  assert.match(fb, /出さずに `FB decide --auto`/);
  assert.match(fb, /ゲートが落ちていれば「すべて取り込む」は選べない/);
  assert.match(fb, /`FB decide --abandon`/);
  assert.match(fb, /「取り下げる \/ 残す」/);
  assert.match(fb, /生成物の commit が 2 つ \(ADR の索引 → ルールと契約の生成物\)/);
  assert.match(fb, /承認し直しはしない/);
});

test('0.1.27: 還流の取り込み: exit 3 は組み直し (リベース)、exit 4 は push の拒否で止まる (force push しない)、再開は cleanup', () => {
  const fb = feedbackSection();
  assert.match(fb, /exit 3 \(main が進み、還流 branch の祖先でない\) → 9 の組み直し \(リベース\)/);
  assert.match(fb, /exit 4 \(push の拒否\) → 止まって報告する/);
  assert.match(fb, /`cleanup`/);
  const del = read(DELIVERY);
  assert.match(del, /ADR の索引は生成物の先頭に別の commit にする/);
  assert.match(del, /`refs\/distillery2\/feedback-prev\/<b>`/);
  assert.match(del, /ゲートの通った記録 \(`<fb>\/gate\.json` の sha\) が branch の先頭と一致しなければ取り込まない/);
});

test('0.1.27: 止まった課題: 理由はすべて並べ、仕上げで課題ファイルに書き足し、止まった課題だけでは還流しない', () => {
  const st = section(SKILL, '### 止まったとき', '### 課題ファイル');
  assert.match(st, /成り立った理由は\*\*すべて\*\*並べ/);
  for (const re of [/結果ファイルが `blocked`/, /受理の検査か課題ごとの static で落ちた/, /write-set の外が変わった/, /結果ファイルが無い/, /`absent`/]) assert.match(st, re);
  assert.match(st, /止まった理由と差分の中身/);
  assert.match(st, /止まった課題だけでは還流を始めない/);
  assert.doesNotMatch(st, /feedback_deferred/);
});

test('0.1.27: 要求を直すときは課題ファイルを main に入れて停止する。一時の branch は feedback-req/ (feedback/ は還流のバッチ)', () => {
  const t = read(SKILL);
  const rev = t.slice(t.indexOf('## 人レビュー'), t.indexOf('## 配送 (deliver 段階)'));
  assert.match(rev, /課題ファイルにして main に入れる/);
  assert.match(rev, /`blocked_on_requirement`/);
  assert.match(rev, /次の起動で要求の差分が課題を反映し、この feature を退避する/);
  const put = section(SKILL, '### 課題ファイル', '## 完了報告');
  assert.match(put, /`git fetch \. feedback-req\/<slug>\/<issue>:main`/);
  assert.match(put, /`feedback\/` は還流のバッチの名前なので使わない/);
  assert.match(put, /remote `origin` があれば `git push origin main`/);
  assert.match(put, /`docs\/feedback\/README\.md` は genDocsReadme が生成する/);
  assert.doesNotMatch(put, /git fetch \. feedback\/<slug>/);
});

test('0.1.27: run-state の feedback_filed は課題ファイルにした記録。取り込んだ記録は trailer。feedback_deferred は旧記録だけ', () => {
  const rs = read(RUN_STATE);
  assert.match(rs, /\| feedback_filed \| UC の課題を課題ファイルにした記録。`\{kind, ref, issue_path\}`/);
  assert.match(rs, /取り込んだ記録は commit の trailer \(`Feedback-Consumed:`\)/);
  assert.match(rs, /\| feedback_deferred \| \(0\.1\.25 までの記録だけ。0\.1\.26 からは書かない\)/);
  assert.match(rs, /配送済みの正は `stages\/deliver\.done\.yaml`/);
  assert.match(rs, /`unfiled_issues`/);
  const del = read(DELIVERY);
  for (const k of ['Feedback-Consumed', 'Feedback-Dismissed', 'Feedback-Result', 'Feedback-Stopped']) assert.match(del, new RegExp(`\\| ${k} `));
});
