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

/** 派遣表の「派遣ごとの write-set」(正本から生成した管理ブロック。0.1.31) の行を返す */
function wsRow(name) {
  const t = read(TEMPLATE);
  const block = t.slice(t.indexOf('<!-- distillery2:dispatch-write-sets:begin -->'), t.indexOf('<!-- distillery2:dispatch-write-sets:end -->'));
  const line = block.split('\n').find(l => l.startsWith(`| ${name} |`));
  assert.ok(line, `write-set row not found: ${name}`);
  return line;
}

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
  const tmplTier = wsRow('④ tier');
  assert.match(tmplTier, /OS の一時ファイル/);
  assert.doesNotMatch(tmplTier, /reports/, 'tier の write-set に reports を入れない (並列で記録を消し合う)');
});

test('単独の段 (scaffold / integrate) は runGates の出力先を write-set に持つ', () => {
  assert.match(wsRow('④ integrate'), /`<run>\/reports\/\*\*`、`<run>\/traces\/\*\*`/);
  assert.match(wsRow('④ scaffold'), /`<run>\/reports\/\*\*`/);
});

test('scaffold の入口スタブは新規ファイルだけ・中立の値を返す・動的 import で回避しない', () => {
  assert.match(wsRow('④ scaffold'), /新規ファイルだけ/);
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
  assert.match(s3, /`git add contracts docs\/design && git commit -m "foundation: contracts and design" -m "<attribution 行>"`/);
  assert.ok(s3.indexOf('foundation: contracts and design') < s3.indexOf('sub `d2-foundation phase=finish ui='), 'commit は仕上げの派遣の前');
  // 先に commit した契約を、仕上げの C4 図が basis に記録する (config と画面部品の取り込み記録は生成器が自分で契約・design を記録する)
  assert.match(read('skills/d2-foundation/SKILL.md'), /genArchitectureDoc\.js .*requirements=docs\/requirements contracts=contracts .*# F8/);
  assert.match(read(TEMPLATE), /例外: ③ の画面部品 \(d2-design\) は完了報告/);
  // static のゲートは契約テストの生成を見ないので、F4 の生成物の鮮度を受理時に確かめる
  assert.match(s3, /genContractTests\.js contracts --config \.distillery\/config\.yaml --out-root \. --check` が exit 0/);
  const fnd = read('skills/d2-foundation/SKILL.md');
  assert.match(fnd, /`ui=false` なら F6 と次の F7 を飛ばす/);
  assert.match(fnd, /前の実行の `docs\/design\/` が残っていても取り込まない/);
  assert.match(wsRow('③ 基盤 (仕上げ)'), /`node_modules\/\*\*`/);
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
  const order = ['`git rev-list --count origin/main..main` が 0 でなければ', '**移行**: `unfiled_runs`', '`batch.point` が `none` 以外', '`requirement` が空でない', '`feedback_due` が true', '`status` が `done` でない最初の UC'];
  let last = -1;
  for (const o of order) { const i = a.indexOf(o); assert.ok(i > last, `自動選択の順: ${o}`); last = i; }
  assert.match(a, /止まった課題 \(課題ファイルの `stopped: true`\) は 3 の 4・5 のきっかけにしない/);
  assert.match(a, /進行中の UC があれば止まって報告する/);
  assert.match(a, /要求で止まった UC \(`feature\/<slug>` が残っているもの\) は飛ばす/, '保留中の要求の課題で起動が行き詰まらない (差分レビュー 3 ラウンド目)');
  assert.match(a, /`uc=<slug>` で要求で止まった UC を直接指定したら、保留中のその UC の要求の課題を示して止まって報告する/);
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
  const order = ['`FB status`', '`FB start --co-author', '`git -C <wt> status --porcelain` が空', '派遣表「還流 (ADR)」', '派遣表「還流 (契約)」', '`FB commit-issue <issue>`', '`FB regen` → `runGates.js --uc d2-feedback --only static`', '`FB record-static <issue>`', '5. `FB discard` (成功でも失敗でも', '`FB stop-issue <issue> --reason-file', '`FB finalize`', '`FB record-gate --result', '**確認ページ 1 回**', '`FB decide --take', '`FB rebuild`', '引数が `merge=hold` なら止めて報告する', '**取り込み**: まず `FB status`', '次に `FB merge`'];
  let last = -1;
  for (const o of order) { const i = fb.indexOf(o); assert.ok(i > last, `還流の順: ${o}`); last = i; }
});

test('0.1.28: 起動時: 移行は課題を数える前 (stage= 直接指定でも)。配送済みの feature は進行中とみなさず片付ける (旧形式は退避して -D)。要求の差分の後は還流まで続け、次の UC には進まない', () => {
  const a = autoSelect();
  assert.match(a, /\*\*移行\*\*: `unfiled_runs`[\s\S]*`FB file-issues <run>` → `genDocsReadme\.js` → `git add -A -- docs \.distillery\/runs\/<slug>` → `impl\(<slug>\): issues to feedback`/);
  assert.match(a, /終わったら `FB scan` をやり直す/);
  assert.match(a, /直接指定でも 3 の 1〜2 \(push のやり直しと移行\) は行う/);
  assert.match(a, /\*\*main 上のその UC の run に配送の done があれば配送済み\*\*/);
  assert.match(a, /その feature を checkout していれば先に clean を確かめて `git switch main` する/, 'checkout 中の branch は消せない (差分レビュー 1 ラウンド目)');
  assert.match(a, /done が `legacy: true` なら `git update-ref refs\/distillery2\/legacy\/<slug>\/<ts> feature\/<slug>` で退避してから `git branch -D feature\/<slug>`、そうでなければ ff 済みなので `git branch -d feature\/<slug>`/);
  assert.match(a, /プラグインへ持ち帰る課題 \(`kind: plugin`。還流節\) もきっかけにしない/);
  const fb = feedbackSection();
  assert.match(fb, /`FB scan` の `unfiled_runs` が空 \(移行は自動選択の 3 の 2 で済ませる\)/);
  assert.doesNotMatch(fb, /\*\*移行\*\*: `FB scan` の `unfiled_runs`/, '還流節から移行の手順が消えた');
  const d = deliverSection();
  assert.match(d, /`feature\/<slug>` が残っていれば `git update-ref refs\/distillery2\/legacy\/<slug>\/<ts> feature\/<slug>` で退避してから `git branch -D feature\/<slug>`/);
  assert.match(d, /その後は自動選択の 3 からやり直す/);
  assert.doesNotMatch(d, /commit してから還流へ進む/);
  const r = section(SKILL, '### 要求の差分', '## ② 決定');
  assert.match(r, /自動選択の 3 の 2〜5 をやり直す/);
  assert.match(r, /\*\*同じ起動で次の UC \(3 の 6\) には進まない\*\*/);
  assert.match(r, /`git commit -F <本文ファイル>`/);
  const done = section(SKILL, '## 完了報告', '## 参照');
  assert.match(done, /要求の差分の後は、自動選択の 3 の 2〜5 をやり直す/);
  assert.match(done, /還流が要らなければ報告して終了する。同じ起動で次の UC には進まない/);
  const del = read(DELIVERY);
  assert.match(del, /## 旧形式の片付け/);
  assert.match(del, /`git update-ref refs\/distillery2\/legacy\/<slug>\/<ts> feature\/<slug>` で退避してから `git branch -D feature\/<slug>`/);
  assert.match(read(RUN_STATE), /起動時の移行 \(`feedbackBatch\.js scan` の `unfiled_runs`。自動選択の 3 の 2\)/);
});

test('0.1.28: 配送: gates.json が無ければ全段を 1 回通す。課題 0 件なら issues to feedback の commit を作らない。stage は docs と <run> を指定 (docs/feedback は名指ししない)', () => {
  const d = deliverSection();
  assert.match(d, /`reports\/gates\.json` が無ければ[\s\S]*`runGates\.js --uc <slug> --tiers <use-cases\.yaml の tiers>` で全段を 1 回通して/);
  assert.match(d, /結果の `filed` が空でなければ `genDocsReadme\.js` を回し、`git add -A -- docs \.distillery\/runs\/<slug>` して `impl\(<slug>\): issues to feedback` で commit/);
  assert.match(d, /`filed` が空 \(課題 0 件\) なら commit を作らない/);
  assert.match(d, /`git add -A -- docs \.distillery\/runs\/<slug>` \(配送の done・events・README・課題一覧の README/);
  assert.doesNotMatch(d, /git add -A -- docs\/feedback/, 'docs/feedback は無いことがあるので名指ししない');
});

test('0.1.28: 還流: reason_kind plugin は reclassify で kind: plugin に (止めない・聞かない)。問いは 3 択で --dismiss は候補にも。already-applied の後片付けはスクリプト。取り込みの前に status を控える', () => {
  const fb = feedbackSection();
  assert.match(row(fb, /^\| plugin \|/), /還流では扱わない。還流で「直す場所がプラグイン側」と分かった課題を `FB reclassify` がこの種類にする/);
  const st = section(SKILL, '### 止まったとき', '### 課題ファイル');
  assert.match(st, /\| 結果ファイルが `blocked` で `reason_kind` が `plugin` \| \*\*止めない\*\*/);
  assert.match(st, /`FB reclassify <issue> --reason-file <fb>\/<issue>\.reason\.txt`/);
  assert.match(st, /\| 結果ファイルが `blocked` \(`reason_kind` が `scope` か無い\) \| 結果ファイルの `reason` \|/);
  assert.match(fb, /「取り込む \/ 今回は外す \/ 取り下げる」/);
  assert.match(fb, /すべて `--take`・`--drop`・`--dismiss` のどれか一方に入れる/);
  assert.match(fb, /`--dismiss` は止まった課題と取り込む候補だけ/);
  assert.match(fb, /プラグインへ持ち帰る課題 \(`reclassify` した課題。載せるだけで聞かない\)/);
  assert.match(fb, /`result` が `already-applied`[\s\S]*次の課題へ \(5 の 4・5 は飛ばす。static は回さず、派遣が作り直した生成物はスクリプトが捨てる \(`discarded: true`\)/);
  assert.match(fb, /まず `FB status` を回し、その結果 \(ゲートの記録 `gate`・回答 `decision`\) と止まった課題の理由を完了報告用に控える/);
  assert.match(fb, /取り込みの前は還流 branch の課題ファイル `<wt>\/docs\/feedback\/\*\.md` に、取り込み済みの再開 \(`cleanup`\) なら main の課題ファイルにある/);
  const put = section(SKILL, '### 課題ファイル', '## 完了報告');
  assert.match(put, /`kind: plugin` \(プラグインへ持ち帰る課題。`kind_original` に元の種類\): 還流の対象ではなく、自動選択のきっかけにもしない/);
  assert.match(put, /distillery2 を直した後に人が `git rm` して commit する/);
  const done = section(SKILL, '## 完了報告', '## 参照');
  assert.match(done, /プラグインへ持ち帰る課題 \(`scan` の `plugin`\)/);
  const del = read(DELIVERY);
  assert.match(del, /\| Feedback-Reclassified \/ Feedback-Kind-Original \|/);
  assert.match(del, /`feedback\(<b>\): plugin <issue>`/);
  for (const rel of ['skills/d2-decide/SKILL.md', 'skills/d2-contract/SKILL.md']) {
    const t = read(rel);
    assert.match(t, /`reason_kind: plugin`/, rel);
    assert.match(t, /`reason_kind: scope`/, rel);
    assert.match(t, /"reason_kind": "plugin" \| "scope"\}` \(`reason_kind` は `blocked` のとき必須\)/, rel);
  }
  assert.match(read('skills/d2-run/references/troubleshooting.md'), /受理の検査[\s\S]*1 つの sh にまとめたものが同じ症状で止まった/);
});

test('0.1.27: 還流のゲート: 課題ごとに static、最後に 1 回 (rule は static、contract は変えた契約を使う UC ごとの全段)。落ちても推測で外さない', () => {
  const fb = feedbackSection();
  assert.match(fb, /`runGates\.js --uc d2-feedback --only static`/, 'run 名は kebab-case (runGates が _ 始まりを拒む)');
  assert.match(fb, /\*\*変えた契約を使う UC ごとに\*\* `runGates\.js --uc <その UC> --tiers <その UC の use-cases\.yaml の tiers をカンマ区切りで。例 frontend,backend-api>` \(全段/);
  assert.match(fb, /ルールの課題だけなら static だけ/);
  assert.match(fb, /落ちても原因を推測で課題を外さない/);
  assert.match(fb, /branch の先頭の sha と一緒に残る/);
});

test('0.1.27: 還流の確認ページ: 出す条件 (取り込む課題・2 回目以上の停止・ゲートの落ち)、出さないときも decide --auto、落ちたら全部の取り込みは選べない', () => {
  const fb = feedbackSection();
  assert.match(fb, /取り込む課題 \(`commit-issue` の `result` が `committed`\)、2 回目以上止まった課題/);
  assert.match(fb, /出さずに `FB decide --auto`/);
  assert.match(fb, /取り込む候補か 2 回目以上止まった課題があれば `--auto` は拒まれる/);
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

test('0.1.29: 手順書のパスは <skills>/ 記法。各 SKILL.md が d2-common の「パスの書き方」を参照し、CLAUDE_PLUGIN_ROOT は d2-common の 1 か所だけ', () => {
  const common = read('skills/d2-common/SKILL.md');
  assert.match(common, /^## パスの書き方$/m, '節名は固定 (各スキルがこの名前で参照する)');
  assert.match(common, /`<skills>` = スキル群のディレクトリ \(このスキルの `SKILL\.md` がある場所の 1 つ上\)/);
  assert.match(common, /`<skills>` = `\$\{CLAUDE_PLUGIN_ROOT\}\/skills`/);
  assert.match(common, /`<skills>` = `~\/\.agents\/skills`/);
  for (const d of fs.readdirSync(path.join(PLUGIN, 'skills'))) {
    if (d === 'd2-common') continue;
    assert.match(read(`skills/${d}/SKILL.md`), /\[\.\.\/d2-common\/SKILL\.md\]\(\.\.\/d2-common\/SKILL\.md\) の「パスの書き方」/, `${d} が d2-common の定義を参照する`);
  }
  assert.match(read(SKILL), /`FB` = `node <skills>\/d2-common\/scripts\/feedbackBatch\.js --cwd <リポのルート>`/);
  assert.match(read(TEMPLATE), /固定指示のパスは `<skills>\/\.\.\.` を絶対パスに展開して/);
  assert.match(row(read(TEMPLATE), /^\| ④ verify /), /<skills>\/d2-implement\/references\/tier-impl\.md/, '0.1.31: 固定指示のパスは d2-verify ではなく派遣表 (d2-run) が持つ');
});

test('0.1.29: 文言の穴 (モデル ID の流用・フル sha・旧形式は常に -D・鮮度検査のコマンド・record-gate の detail・tiers のカンマ区切り・受理の検査は 1 コマンドずつ)', () => {
  const t = read(SKILL);
  assert.match(t, /run の `models_resolved` に解決済みの ID があればそれを流用し、別名で記録し直さない/);
  assert.match(t, /"squash":"<squash commit のフル sha \(git rev-parse HEAD\)>"/);
  const d = deliverSection();
  assert.match(d, /常に退避してから `-D`/);
  assert.doesNotMatch(d, /祖先でないので `-d` は拒まれる/);
  assert.match(read(DELIVERY), /祖先でないことがあり `-d` では消せないので、常に退避してから `-D`/, 'git-delivery も同じ説明 (差分レビュー 3 ラウンド目)');
  assert.doesNotMatch(read(DELIVERY), /祖先でなく、`-d` は拒まれる/);
  const r = section(SKILL, '### 要求の差分', '## ② 決定');
  assert.match(r, /`node <skills>\/d2-common\/scripts\/lib\/basis\.js check <対象ファイル…> requirements=docs\/requirements adr=docs\/adr contracts=contracts`/);
  assert.match(r, /as-built がまだ無ければ省く/);
  assert.match(r, /STALE は完了報告に載せるだけで、自動では追随しない/);
  const fb = feedbackSection();
  assert.match(fb, /1 回目で全部通れば `FB record-gate --result pass` \(`--detail` は付けない\)/);
  assert.match(fb, /検査は 1 コマンドずつ回す \(1 つの sh にまとめない/);
  assert.match(t, /\*\*関与ティアの決め方\*\*[^\n]*`--tiers` にはカンマ区切りで渡す。例 `--tiers frontend,backend-api`/, '④ の正本にも区切り文字 (差分レビュー 1 ラウンド目)');
  assert.match(read(DELIVERY), /"squash":"<フル sha>"[^|]*sha は短縮しない/);
  assert.match(read('skills/d2-run/references/troubleshooting.md'), /0\.1\.28 の試し運転でも `genDocsReadme\.js; echo exit=\$\?`/);
});

test('0.1.30 L1/M4/M2/M3: 名指し起動でも配送済みの feature を片付ける。事前回答が選べなければ止まる。models_resolved は遅らせた場合だけ。squash の前に件名の検査', () => {
  const a = autoSelect();
  assert.match(a, /\*\*`uc=<slug>` の名指し起動でも、この 2 の片付け \(main 上の run に配送の done がある feature の退避・削除\) をすべての `feature\/\*` について先に行う\*\*/);
  assert.match(a, /名指しの UC 自身が配送済み[^\n]*「配送済み」と報告して終わる/);
  assert.match(read(SKILL), /1\. 引数を解釈し、段階を決める \([^\n]*`uc=` の名指しでも自動選択 2 の片付けを先に行う\)/);
  const principles = section(SKILL, '## 原則', '## d2-run が直接読み書きするもの');
  assert.match(principles, /事前に与えられた回答が、その確認ページの問いで選べない[^\n]*推測で別の回答にせず止まって報告する/);
  assert.match(feedbackSection(), /事前回答がこの問いで選べない回答[^\n]*`FB decide` を記録せず止まって報告する/);
  const d = deliverSection();
  assert.match(d, /6\. main の上で、④ の冒頭で遅らせた場合だけ `models_resolved` を記録し \(冒頭で記録済みなら記録しない/);
  assert.match(read(DELIVERY), /④ の冒頭で遅らせた場合だけの `models_resolved` \(冒頭で記録済みなら記録しない/, 'git-delivery も同じ条件 (差分レビュー 1 ラウンド目の指摘 2)');
  assert.match(d, /3\. commit の件名の検査 \(`git log <base_head>\.\.HEAD --format=%s` がすべて `impl\(<slug>\): ` か `req\(<slug>\): ` で始まる。そうでなければ UC 外の commit が混ざっているので squash せず止まって報告する/);
  const sq = section(DELIVERY, '## 手順 (squash)', '## 手順 (main への取り込み)');
  assert.match(sq, /件名がすべて `impl\(<slug>\): ` か `req\(<slug>\): ` で始まることを確認する/);
  assert.match(sq, /squash せず止まって報告する \(混ざった commit の一覧を添える/);
  assert.doesNotMatch(sq, /staged が当該 UC の変更だけであることを確認する/, '件名の検査に置き換えた');
});

test('0.1.30 L7: 変えた契約を使う UC は finalize / status の slices_changed × status: done。uc-index で数えない', () => {
  const fb = feedbackSection();
  assert.match(fb, /変えた契約を使う UC = `FB finalize` \(再開なら `FB status`\) の `slices_changed` \(main との差分で `contracts\/generated\/slices\/<slug>\/\*\*` が変わった UC\) のうち、`use-cases\.yaml` で `status` が `done` の UC すべて/);
  assert.match(fb, /共通部分を変えると全 UC の slice が変わり、全 UC を回す/);
  assert.match(fb, /「他の UC への影響」は照合の補助にだけ使い、`slices_changed` を狭めない/);
  assert.doesNotMatch(fb, /`contracts\/uc-index\.yaml` で、変えた operation/);
  assert.match(fb, /回した UC \(`slices_changed`\) ごとのゲートの結果/);
});

test('0.1.30 L10: 残った作業 → 確認ページ (見込みの宛先) → carryOver.js add → 派遣文に追記 → done の carry_over_status → 人レビューで持ち越す / 無視 → 配送で carryOver.js move', () => {
  const r = section(SKILL, '### 要求の差分', '## ② 決定');
  assert.match(r, /報告の「残った作業」[^\n]*と「決定と違う反映」[^\n]*を 3 の材料に控える/);
  assert.match(r, /\*\*「残った作業」\*\*[^\n]*1 件ずつ「\*\*次の UC で拾う \/ 無視\*\*」で聞く/);
  assert.match(r, /宛先の UC はこの時点では確定しない/);
  assert.match(r, /見込みの宛先: <`node <skills>\/d2-common\/scripts\/carryOver\.js next --skip <feature\/ が残る UC をカンマ区切り> --cwd <リポのルート>` の `target` の UC 名>。承認の後に確定する/);
  assert.match(r, /4\. 承認されたら、まず「次の UC で拾う」残った作業を `node <skills>\/d2-common\/scripts\/carryOver\.js add --items '<JSON 配列>' --skip <退避されずに残る feature の UC \(= feature\/\* のうち、今回反映・取り下げる課題の from_uc 以外\) をカンマ区切り> --cwd <リポのルート>`/);
  assert.match(r, /`added: false` \(宛先なし\) なら完了報告に「持ち越せなかった作業」として載せる/);
  assert.match(r, /次に、反映した課題ファイルと取り下げた課題ファイルを `git rm`/, '課題ファイルの削除は carryOver の後');
  const t = read(SKILL);
  assert.match(t, /\*\*残った作業 \(`carry_over`\)\*\*: `use-cases\.yaml` のこの UC の行に `carry_over`[^\n]*contract・tier・integrate の派遣文に追記する \(subagent-template\.md「残った作業の追記」/);
  assert.match(t, /"carry_over_status": \[\{"item": "<項目>", "status": "done\|cannot", "detail": "<変えたファイル か 理由>"\}\]/);
  assert.match(t, /review の前に中断しても、再開時に done から集められる/);
  const tmpl = read(TEMPLATE);
  assert.match(tmpl, /\*\*残った作業の追記\*\*[^\n]*④ の contract・tier・integrate の派遣文に/);
  assert.match(tmpl, /報告に項目ごとに「対応した \(変えたファイル\)」か「対応できない \(理由。write-set の外など\)」を書く/);
  assert.match(tmpl, /課題の起票は求めない。scaffold と integrate の write-set に `<run>\/issues\/` が無く/);
  const review = section(SKILL, '## 人レビュー (review 段階)', '## 配送 (deliver 段階)');
  assert.match(review, /残った作業の対応状況 \(`use-cases\.yaml` の `carry_over` の項目ごとに、各段階の done の `carry_over_status`。どの段階も `done` にしていない項目が「対応できなかった項目」\)/);
  assert.match(review, /対応できなかった項目ごとに「\*\*次の UC に持ち越す \/ 無視\*\*」を選ばせる/);
  assert.match(review, /review_approved \{assumption_decisions\[\], assumption_evidence_sha256, gates_result, carry_over: \{done: \[\.\.\.\], carry: \[\.\.\.\], ignore: \[\.\.\.\]\}\}/);
  const d = deliverSection();
  assert.match(d, /`node <skills>\/d2-common\/scripts\/carryOver\.js move --from <slug> --items '<review_approved の carry_over\.carry の JSON 配列>' --skip <feature\/ が残っている UC をカンマ区切り> --cwd <リポのルート>` で `carry_over` を次の UC へ持ち越す/);
  assert.match(d, /`carry` が空なら `carryOver\.js clear --from <slug>`。`moved: false` なら完了報告に「持ち越せなかった作業」として載せる。黙って消さない/);
  const sq = section(DELIVERY, '## 手順 (squash)', '## 手順 (main への取り込み)');
  assert.match(sq, /carryOver\.js move --from <slug> --items '<review_approved の carry_over\.carry>' --skip <feature\/ が残っている UC>/);
  assert.match(read(RUN_STATE), /carry_over_status \(要求の差分で残った作業の項目ごとの対応状況 \{item, status: done\|cannot, detail\}\)/);
  assert.match(read(RUN_STATE), /review_approved は残った作業の処遇 `carry_over: \{done, carry, ignore\}` も持つ/);
  // d2-run の表と正本
  assert.match(row(read(SKILL), /^\| ① の要求の差分の取り込み \|/), /`docs\/requirements\/use-cases\.yaml` \(`carryOver\.js add`/);
  assert.match(row(read(SKILL), /^\| ④ の prTrailers\.js と配送 \|/), /`docs\/requirements\/use-cases\.yaml` \(`status: done` と `carryOver\.js move` の持ち越し\)/);
});

test('0.1.30 L11: 要求担当は課題の決定に従い、違えば「決定と違う反映」を報告する。確認ページに載せる', () => {
  const req = read('skills/d2-requirements/SKILL.md');
  assert.match(req, /\*\*課題ファイルの「決定」に従って反映する\*\*。決定と違う反映にするなら、最終報告の「\*\*決定と違う反映\*\*」に課題・決定・実際の反映・理由を書く/);
  assert.match(req, /7\. 最終報告に「\*\*残った作業\*\*」を書く: 課題を反映するために write-set \(`docs\/requirements\/\*\*`\) の外で必要になった作業/);
  assert.match(req, /自分では触らない \(write-set の外\)。無ければ「なし」/);
  const r = section(SKILL, '### 要求の差分', '## ② 決定');
  assert.match(r, /\*\*「決定と違う反映」\*\* \(課題ごとに決定・反映・理由。無ければ「なし」。違いを戻すなら「直す点」で 2 から/);
});

test('0.1.30 L14: すべての commit に attribution 行。-m の commit は 2 つ目の -m、-F は trailer の末尾、squash と還流は値 (キー無し) を渡す', () => {
  const t = read(SKILL);
  const cmds = t.match(/git commit -m "[^"]+"[^`\n]*/g);
  assert.ok(cmds.length >= 5, `git commit -m が ${cmds.length} か所`);
  for (const c of cmds) assert.match(c, / -m "<attribution 行>"$/, c);
  assert.match(t, /自分が作るすべての commit に attribution 行を trailer で付ける \(git-delivery\.md「commit の attribution」/);
  assert.match(t, /各段階の done を書いたら `impl\(<slug>\): <stage>` で commit する \(attribution 行を付ける/);
  const r = section(SKILL, '### 要求の差分', '## ② 決定');
  assert.match(r, /最後に attribution 行 \(git-delivery\.md「commit の attribution」\)/);
  assert.match(feedbackSection(), /`FB start --co-author "<attribution の値>"`/);
  const g = section(DELIVERY, '## commit の attribution (0.1.30)', '## UC branch の開始と再開');
  assert.match(g, /\*\*attribution 行\*\* = ハーネスが指定する trailer 1 行/);
  assert.match(g, /\*\*attribution の値\*\* = その行のキー `Co-Authored-By: ` を除いた部分/);
  assert.match(g, /`git commit -m "<件名>" -m "<attribution 行>"` \(2 つ目の `-m` が最後の段落になり、git が trailer として扱う\)/);
  assert.match(g, /`FB start --co-author "<attribution の値>"` で batch に記録し、スクリプトが全 commit に付ける/);
  assert.match(read(DELIVERY), /--co-author "<attribution の値>"` で本文を作り/);
  assert.doesNotMatch(read(DELIVERY), /--co-author "<ハーネスの attribution 行>"/, '行を渡すとキーが二重になる');
});

test('0.1.30 M5/M6/M1: ゲートの回し直しは 1 回だけ・写しを取る。record-gate は gates.json (複数) と --retried。troubleshooting に保存先', () => {
  const t = read(SKILL);
  const rule = section(SKILL, '**ゲートの回し直し**', 'attempt++ のとき');
  assert.match(rule, /コードも commit も変えずに同じコマンドを \*\*1 回だけ\*\*回し直してよい/);
  assert.match(rule, /回し直す前に 1 回目の `<run>\/reports\/gates\.json` を `<run>\/reports\/gates\.failed-1\.json` に写す/);
  assert.match(rule, /2 回目も落ちたら落ちた扱い \(推測で直さない・課題を外さない\)。3 回目は回さない/);
  assert.match(rule, /gates\.json の job の `output_tail` と `failed_tests` で読む/);
  const fb = feedbackSection();
  assert.match(fb, /落ちたら ④ の「ゲートの回し直し」のとおり、同じ branch の先頭で 1 回だけ回し直す \(写しは `<wt>\/\.distillery\/runs\/<その UC か d2-feedback>\/reports\/gates\.failed-1\.json`。落ちた UC ごと\)/);
  assert.match(fb, /回し直して全部通れば `FB record-gate --result pass --retried --detail <1 回目の写しをカンマ区切りで>`/);
  assert.match(fb, /1 つでも 2 回目も落ちたら `FB record-gate --result fail --detail <落ちた runGates の gates\.json をカンマ区切りで/);
  assert.match(fb, /`FB status` の `gate\.detail` から落ちたゲート・落ちたテスト名・出力の末尾を UC ごとに。回し直して通ったなら 1 回目に落ちたテスト名/);
  assert.match(read('skills/d2-run/references/troubleshooting.md'), /## headless で runGates の出力を `> <ファイル>` に保存できない/);
  assert.match(read('skills/d2-run/references/troubleshooting.md'), /`FB record-gate --detail` にはその gates\.json をそのまま渡す/);
  assert.ok(t.length > 0);
});

test('0.1.31 2-5: 定義 3 ファイルは d2-common にあり、参照は移動先を指す。d2-verify は固定指示を派遣文から受け、他スキルの手順書を直接参照しない。troubleshooting は d2-common の索引から辿る', () => {
  for (const f of ['config-schema.md', 'assumption-record.md', 'adr-inputs.md', 'troubleshooting.md']) assert.ok(fs.existsSync(path.join(PLUGIN, 'skills/d2-common/references', f)), f);
  for (const f of ['skills/d2-run/references/config-schema.md', 'skills/d2-implement/references/assumption-record.md', 'skills/d2-foundation/references/adr-inputs.md']) assert.ok(!fs.existsSync(path.join(PLUGIN, f)), `${f} は移動済み`);
  assert.match(read(SKILL), /\[\.\.\/d2-common\/references\/config-schema\.md\]/);
  assert.match(read(SKILL), /索引は \[\.\.\/d2-common\/references\/troubleshooting\.md\]/);
  assert.match(read('skills/d2-foundation/SKILL.md'), /\.\.\/d2-common\/references\/config-schema\.md/);
  assert.match(read('skills/d2-foundation/SKILL.md'), /\.\.\/d2-common\/references\/adr-inputs\.md/);
  assert.match(read('skills/d2-implement/SKILL.md'), /\.\.\/d2-common\/references\/assumption-record\.md/);
  assert.match(read('skills/d2-implement/references/tier-impl.md'), /<skills>\/d2-common\/references\/assumption-record\.md/);
  assert.match(read('skills/d2-implement/references/gates.md'), /<skills>\/d2-common\/references\/config-schema\.md/);
  assert.match(read('skills/d2-decide/references/adr-format.md'), /\.\.\/\.\.\/d2-common\/references\/adr-inputs\.md/);
  const v = read('skills/d2-verify/SKILL.md');
  assert.match(v, /\.\.\/d2-common\/references\/assumption-record\.md/);
  assert.match(v, /\| 固定指示 \| 派遣文で渡された「実装者の固定指示」のパス/);
  assert.doesNotMatch(v, /d2-implement\/references/);
  const vp = read('skills/d2-verify/references/viewpoints.md');
  assert.match(vp, /固定指示 \(派遣文で渡された「実装者の固定指示」のパス\)/);
  assert.doesNotMatch(vp, /d2-implement\/references/);
  assert.match(row(read(TEMPLATE), /^\| ④ verify /), /`実装者の固定指示: <パス>` \(`<skills>\/d2-implement\/references\/tier-impl\.md` を絶対パスに展開して渡す/);
  assert.match(row(read(SKILL), /^\| \*\*verify\*\* \|/), /実装者の固定指示のパス/);
  for (const rel of ['skills/d2-run/references/troubleshooting.md', 'skills/d2-foundation/references/troubleshooting.md', 'skills/d2-contract/references/troubleshooting.md']) {
    assert.match(read(rel), /他のスキルの項目: \[索引\]\(\.\.\/\.\.\/d2-common\/references\/troubleshooting\.md\)/, rel);
  }
  assert.match(read('skills/d2-common/SKILL.md'), /## 参照の向き \(0\.1\.31\)/);
});

test('0.1.31 2-6: 派遣表の表に write-set の列が無く、「派遣ごとの write-set」は正本から生成した管理ブロック。{write_set} はその行を指す', () => {
  const t = read(TEMPLATE);
  assert.match(t, /\| 段階 \| role \| skill_name \/ skill_args \| model \| additional_instructions \|/);
  assert.match(t, /## 派遣ごとの write-set \(正本から生成。手で書かない\)/);
  assert.match(t, /<!-- distillery2:dispatch-write-sets:begin -->\n\| 段階 \| write-set \|/);
  assert.match(t, /\{write_set\}   ← 下の「派遣ごとの write-set」のその段階の行 \(正本から生成\)/);
  assert.match(wsRow('③ 基盤 (機械)'), /`apps\/\*\/`、`packages\/\*\/`、`package\.json`、`tsconfig\.base\.json`、`\.gitignore`、`biome\.json`、`package-lock\.json`。例外: `npm install` が作る `node_modules\/\*\*` \(gitignore\)/, '別名が表す書き込み先と注記の位置が保たれる');
  assert.match(wsRow('④ contract'), /`apps\/<datastore_owner>\/migrations\/\*\*`/);
});

test('0.1.31 小さい修正: models_resolved は再開時に同じ ID なら記録しない (N2)、還流の受理の検査は <wt> を実行ディレクトリに (N8)、残った作業の追記から scenario を外す (N12)', () => {
  const t = read(SKILL);
  assert.match(t, /再開時は、run の `models_resolved` に同じ ID が記録済みなら記録しない/);
  assert.match(feedbackSection(), /契約のスクリプトに `--cwd` は無いので、コマンドの実行ディレクトリを `<wt>` にして回す/);
  assert.match(t, /scenario は write-set が `features\/` と issues だけで残った作業に対応できないので追記しない/);
  assert.match(read('skills/d2-run/references/troubleshooting.md'), /`cd <wt> && node <スクリプト>` は通った/);
});
