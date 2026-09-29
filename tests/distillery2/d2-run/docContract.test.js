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

test('還流: 派遣表の受理の説明も、結果ファイルを使うのは ADR と契約の 2 行だけ (差分レビュー 2 ラウンド目)', () => {
  const t = read(TEMPLATE);
  const line = t.split('\n').find(l => l.startsWith('- 還流の 3 行'));
  assert.ok(line, '派遣表に還流の受理の説明がある');
  const rest = t.slice(t.indexOf(line)).split('\n').slice(0, 2).join('\n');
  assert.match(rest, /結果ファイルはこの 2 つの派遣の前にだけ消す/);
  assert.match(rest, /「④ 還流 \(ルールの再生成\)」は結果ファイルを書かないので使わず/);
  assert.doesNotMatch(t, /還流の 3 行も同じ: 分岐は結果ファイル/);
});


// 0.1.26: PR / issue をやめ、配送 (main への取り込み) を還流の前にし、還流は worktree で作って確認ページの後に main へ取り込む
function section(rel, start, end) {
  const t = read(rel);
  const i = t.indexOf(start);
  assert.ok(i >= 0, `${rel}: ${start}`);
  const j = end ? t.indexOf(end, i + 1) : -1;
  return t.slice(i, j < 0 ? undefined : j);
}
const deliverSection = () => section(SKILL, '## 配送 (deliver 段階)', '## 還流 (feedback 段階)');
const stoppedSection = () => section(SKILL, '### 止まったとき', '### 課題ファイルを main に入れる');

test('0.1.26: 手順書に gh (PR / issue) が出てこない', () => {
  for (const rel of [SKILL, DELIVERY, RUN_STATE, TEMPLATE, 'skills/d2-decide/SKILL.md', 'skills/d2-contract/SKILL.md', 'skills/d2-foundation/SKILL.md']) {
    assert.doesNotMatch(read(rel), /\bgh (pr|issue|auth)\b/, `${rel} に gh のコマンドがある`);
  }
  assert.match(read(SKILL), /PR \/ issue は作らない/);
});

test('0.1.26: 段階の順は配送 → 還流。配送は squash → merge=hold → ff merge → main の上で done を commit → push', () => {
  assert.match(read(RUN_STATE), /`scenario → contract → scaffold → tier → contract-gate → integrate → verify → review → asbuilt → deliver → feedback`/);
  const t = read(SKILL);
  assert.ok(t.indexOf('| **deliver** |') < t.indexOf('| **feedback** |'), '段階の表で deliver が feedback の前');
  const d = deliverSection();
  const order = ['git reset --soft <base_head>', '引数が `merge=hold` なら、ここで止めて報告する', '`git merge --ff-only feature/<slug>`', '`impl(<slug>): delivered` で commit', '`git push origin main`', '`git branch -d feature/<slug>`'];
  let last = -1;
  for (const o of order) { const i = d.indexOf(o); assert.ok(i > last, `配送の順: ${o}`); last = i; }
  assert.match(d, /force push はしない/);
  assert.match(d, /origin\/main` が `main` の祖先か同じ/);
});

test('0.1.26: 再開で配送の done があれば main で作業し、何より先に未 push の main を push する。squash 済みの再開はイベント記録を遅らせる', () => {
  const t = read(SKILL);
  const startup = t.slice(t.indexOf('## 起動シーケンス'), t.indexOf('## ① 要求'));
  const s4 = startup.indexOf('配送 (deliver) の done がある UC は、作業 branch が main');
  const s5 = startup.indexOf('作業ツリーの clean 判定');
  assert.ok(s4 > 0 && s5 > s4);
  assert.match(startup, /`git rev-list --count origin\/main\.\.main` が 0 でなければ\*\*何より先に\*\* `git push origin main`/);
  assert.match(t, /squash 済みで配送の done が無い再開 \(`merge=hold` で止めた後など\) では、記録を配送の 6 まで遅らせ、配送の done と同じ commit に含める/);
  assert.match(read(DELIVERY), /再開時 \(配送の done がある\) は作業 branch が main/);
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

test('0.1.26: 還流は main から worktree を切り、node_modules を symlink し、課題はそのまま読む (写さない)', () => {
  const fb = feedbackSection();
  assert.match(fb, /配送の後、\*\*main の上で\*\*行う/);
  assert.match(fb, /`git worktree add <wt> -b <還流 branch> main`/);
  assert.match(fb, /`node_modules`[^。]*symlink する/);
  assert.match(fb, /課題は `<wt>\/\.distillery\/runs\/<slug>\/issues\/<file>\.md` をそのまま読む/);
  assert.doesNotMatch(fb, /課題を `<fb>\/<issue>\.md` に写す/);
  assert.doesNotMatch(fb, /untracked\.txt/);
});

test('0.1.26: ADR の commit が rules の再生成より前、--check は commit より前、main を壊さないことのゲート', () => {
  const fb = feedbackSection();
  const adrCommit = fb.indexOf('git commit -m "feedback(<slug>): adr"');
  const rulesDispatch = fb.indexOf('sub d2-foundation `phase=rules`');
  const rulesCheck = fb.indexOf('genRules.js --adr docs/adr --out docs/rules --check');
  const rulesCommit = fb.indexOf('git commit -m "feedback(<slug>): rules"');
  assert.ok(adrCommit > 0 && rulesDispatch > adrCommit && rulesCheck > rulesDispatch && rulesCommit > rulesCheck);
  assert.match(fb, /受理の `--check` は\*\*生成物を commit する前に\*\*/);
  // ゲート: rule は static だけ、contract は static と変えた契約を使う UC ごとの全段
  assert.match(fb, /rule: `runGates\.js --uc <slug> --only static`/);
  assert.match(fb, /\*\*変えた契約を使う UC ごとに\*\* `runGates\.js --uc <その UC> --tiers <その UC の use-cases\.yaml の tiers>` \(全段/);
  const gate = fb.indexOf('**main を壊さないことのゲート**');
  const merge = fb.indexOf('`git merge --ff-only <還流 branch>`');
  assert.ok(gate > 0 && merge > gate, 'ゲートは main へ入れる前');
});

test('0.1.26: 確認ページを 1 回、merge=hold と受理済みの印、ff できなければ rebase せず作り直す', () => {
  const fb = feedbackSection();
  assert.match(fb, /\*\*確認ページを 1 回\*\*出す/);
  assert.match(fb, /受理済みの印 `<fb>\/<issue>\.ready`/);
  assert.match(fb, /引数が `merge=hold` なら止めて報告する \(worktree・還流 branch・受理済みの印は残す/);
  assert.match(fb, /\*\*rebase しない\*\*/);
  assert.match(fb, /git diff <approved の sha> <やり直した branch> -- <その本文>/);
  assert.match(fb, /`<fb>\/<issue>\.approved` に書く/);
  // 記録 (feedback_filed の commit) は worktree と branch を消す前 (差分レビュー 1 ラウンド目)
  const rec = fb.indexOf('8. main の上で `feedback_filed');
  const del = fb.indexOf('`git worktree remove <wt>` → `git branch -d <還流 branch>`');
  assert.ok(rec > 0 && del > rec, '記録してから worktree と branch を消す');
  assert.match(read(DELIVERY), /ff できなければ \*\*rebase しない\*\*/);
});

test('0.1.26: 止まったら worktree ごと捨て、理由つきの課題ファイルを main に入れて feedback_filed (保留にしない)', () => {
  const st = stoppedSection();
  assert.match(st, /`git worktree remove --force <wt>`/);
  assert.match(st, /成り立った理由は\*\*すべて\*\*並べ/);
  for (const re of [/結果ファイルが `blocked`/, /受理の検査かゲートで落ちた/, /write-set の外が変わった/, /結果ファイルが無い/, /確認ページで取り込まないと答えた/]) assert.match(st, re);
  assert.match(st, /`feedback_filed \{kind, ref: "docs\/feedback\/<issue>\.md", issue_path\}`/);
  assert.doesNotMatch(st, /feedback_deferred/);
  const fb = feedbackSection();
  assert.match(fb, /`feedback_filed \{kind, ref, issue_path\}`/);
});

test('0.1.26: 要求を直すときは課題ファイルを main に入れて停止する (feature に混ぜない)', () => {
  const t = read(SKILL);
  const rev = t.slice(t.indexOf('## 人レビュー'), t.indexOf('## 配送 (deliver 段階)'));
  assert.match(rev, /課題ファイルにして main に入れる/);
  assert.match(rev, /`blocked_on_requirement`/);
  const put = section(SKILL, '### 課題ファイルを main に入れる', '## 完了報告');
  assert.match(put, /`git fetch \. feedback\/<slug>\/<issue>:main`/);
  assert.match(put, /`docs\/feedback\/<issue>\.md`/);
});

test('0.1.26: run-state の feedback_filed は ref。feedback_deferred は旧記録だけ', () => {
  const rs = read(RUN_STATE);
  assert.match(rs, /\| feedback_filed \| 還流の記録。`\{kind, ref, issue_path\}`/);
  assert.match(rs, /\| feedback_deferred \| \(0\.1\.25 までの記録だけ。0\.1\.26 からは書かない\)/);
  assert.match(rs, /配送済みの正は `stages\/deliver\.done\.yaml`/);
});
