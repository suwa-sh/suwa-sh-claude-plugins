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
const DIRECT_IO = 'skills/d2-run/references/direct-io.md';

/** 派遣表の「派遣ごとの write-set」(正本から生成した管理ブロック。0.1.31) の行を返す */
function wsRow(name) {
  const t = read(TEMPLATE);
  const block = t.slice(t.indexOf('<!-- distillery2:dispatch-write-sets:begin -->'), t.indexOf('<!-- distillery2:dispatch-write-sets:end -->'));
  const line = block.split('\n').find(l => l.startsWith(`| ${name} |`));
  assert.ok(line, `write-set row not found: ${name}`);
  return line;
}

/** 表の行 (`| **<stage>** |` や `| ④ <stage>`) を 1 行で返す */
const cells = line => line.split('|').slice(1, -1).map(c => c.trim());

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
  assert.match(row(skill, /^\| \*\*contract\*\* \|/), /classifyContractChanges\.js --uc <slug> --base <base_head> --json/);
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
  assert.match(asbuilt, /`<run>\/reports\/asbuilt\.json` があれば消し、/, '前回の集計で受理しない');
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
const ROUTING = 'skills/d2-run/references/routing.md';
const deliverSection = () => section(SKILL, '## main マージ (deliver 段階)', '## 課題ファイル');
/** routing.md の節 (見出しから次の同じ深さ以上の見出しまで) */
const routingSection = (head) => {
  const t = read(ROUTING);
  const i = t.indexOf(head);
  assert.ok(i >= 0, `${ROUTING}: ${head}`);
  const level = head.match(/^#+/)[0].length;
  const rest = t.slice(i + head.length);
  const m = rest.match(new RegExp(`\\n#{1,${level}} `));
  return t.slice(i, m ? i + head.length + m.index : undefined);
};
const autoSelect = () => section(SKILL, '自動選択 (起動時に作業 branch と段階を決める)', '## 原則');
const NEXT_ACTION = 'skills/d2-common/scripts/nextAction.js';

test('0.1.26: 手順書に gh (PR / issue) が出てこない', () => {
  for (const rel of [SKILL, DELIVERY, RUN_STATE, TEMPLATE, 'skills/d2-decide/SKILL.md', 'skills/d2-contract/SKILL.md', 'skills/d2-foundation/SKILL.md']) {
    assert.doesNotMatch(read(rel), /\bgh (pr|issue|auth)\b/, `${rel} に gh のコマンドがある`);
  }
  assert.match(read(SKILL), /PR \/ issue は作らない/);
});

test('0.1.27: UC は main マージで終わる。main マージの squash の前に UC の課題を課題ファイルにする', () => {
  assert.match(read(RUN_STATE), /`scenario → contract → scaffold → tier → contract-gate → integrate → verify → review → asbuilt → deliver`\n/);
  const t = read(SKILL);
  assert.ok(!t.includes('| **feedback** |'), '④ の表に feedback の段階が無い');
  assert.match(row(t, /^\| \*\*deliver\*\* \|/), /`unfiled_issues` が空/);
  const d = deliverSection();
  const order = ['feedbackBatch.js file-issues <run>', '`impl(<slug>): issues to feedback` で commit', 'git reset --soft <base_head>', '引数が `merge=hold` なら、ここで止めて報告する', '`git merge --ff-only feature/<slug>`', '`impl(<slug>): delivered` で commit', '`git push origin main`', '`git branch -d feature/<slug>`'];
  let last = -1;
  for (const o of order) { const i = d.indexOf(o); assert.ok(i > last, `main マージの順: ${o}`); last = i; }
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

test('0.3.0: 自動選択は nextAction.js が決め、進行役は action ごとの表に従ってからもう一度呼ぶ。順はスクリプトの冒頭が正 (進行中 → 途中 → push → 写し直し待ち → 旧形式・移行 → 連鎖の上限 → 上流の課題 → 開き直し → 次の機能)', () => {
  const a = autoSelect();
  assert.match(a, /`node <skills>\/d2-common\/scripts\/nextAction\.js <リポのルート> \[--uc <slug>\] \[--stage <段>\]` を呼ぶ \(読むだけ。JSON 1 行の `action`\)/);
  assert.match(a, /\*\*起動を終えずにもう一度呼ぶ\*\*/);
  for (const act of ['requirements', 'cleanup', 'continue-feature', 'resume', 'finish-resume', 'continue-upstream', 'switch-main', 'push', 'legacy', 'migrate', 'batch', 'limit-chain', 'requirements-diff', 'decide-diff', 'foundation-diff', 'reopen', 'uc', 'delivered', 'refuse', 'none']) {
    assert.match(a, new RegExp('`' + act + '`'), `action ${act} の行`);
  }
  assert.match(a, /0\.1\.x の還流で止まった課題 \(`stopped: true`\) も同じに扱う/, '止まった課題もきっかけにする (止まる理由だった還流が無くなった)');
  assert.match(a, /課題は戻し先のステップ \(`target_step`。無い古い課題は `kind` から\) で振り分ける/);
  assert.match(a, /force push はしない/);
  const head = read(NEXT_ACTION).split('*/')[0];
  const order = ['1  最初の段', '2  片付け', '3  進行中の機能', '4  途中の写し直し', '5  push のやり直し', '6  写し直し待ち', '7  旧形式・移行', '8  連鎖の上限超え', '9  上流の課題', '10 開き直し', '11 次の機能'];
  let last = -1;
  for (const o of order) { const i = head.indexOf(o); assert.ok(i > last, `自動選択の順: ${o}`); last = i; }
  assert.match(head, /名指し \(--uc \/ --stage\) は 1・2 の後に、3・4・6 に当たるもの/);
});

test('0.1.27: 要求の差分: 一括承認、外す課題はやり直し、残す課題は hold、trailer で記録、要求で止まった UC の feature を退避', () => {
  const r = section(SKILL, '### 要求の差分', '## ② 決定');
  assert.match(r, /\*\*承認は一括\*\*/);
  assert.match(r, /`git checkout -- docs\/requirements` と `git clean -fd -- docs\/requirements`/);
  assert.match(r, /`feedbackBatch\.js hold <issue> --reason-file <ファイル>`/);
  assert.match(r, /`Feedback-Consumed: docs\/feedback\/<issue>\.md`/);
  assert.match(r, /`Feedback-Dismissed: docs\/feedback\/<issue>\.md`/);
  assert.match(r, /上流で止めた UC の feature は消さない \(止めた課題がすべて main から消えると、次の自動選択が `resume` を返して写し直す/);
  assert.doesNotMatch(r, /abandoned/);
  assert.match(r, /requirement_all/);
  assert.match(row(read(TEMPLATE), /^\| ① 要求 /), /未処理の要求の課題ファイルのパス/);
  assert.match(read('skills/d2-requirements/SKILL.md'), /課題ファイルは読むだけで、消さない/);
});

test('0.2.0: 還流の段階は無い。課題は戻し先で直し、途中で止まった 0.1.x の還流は片付けるだけ (FB merge は取り込み済みの後始末、それ以外は FB abandon)', () => {
  const t = read(SKILL);
  assert.doesNotMatch(t, /^## 還流/m, 'd2-run に還流の節が無い');
  for (const c of ['FB start', 'FB commit-issue', 'FB regen', 'FB record-static', 'FB record-gate', 'FB finalize', 'FB decide', 'FB rebuild', 'FB stop-issue']) {
    for (const rel of [SKILL, ROUTING, TEMPLATE, DIRECT_IO]) assert.ok(!read(rel).includes(c), `${rel} に廃止したサブコマンド ${c} が残っている`);
  }
  assert.doesNotMatch(read(TEMPLATE), /^\| 還流/m, '派遣表に還流の行が無い');
  assert.doesNotMatch(read('skills/d2-contract/SKILL.md'), /mode=feedback/, '契約の課題は機能を巻き戻すか開き直して mode=uc で直す');
  assert.doesNotMatch(read('skills/d2-foundation/SKILL.md'), /phase=all \| finish \| rules/);
  const mig = routingSection('## 途中で止まった還流');
  assert.match(mig, /`cleanup` \(取り込み済み\): `FB merge` で push と片付けを終える/);
  assert.match(mig, /確認ページ `page:migration:abandon` \(推奨: 捨てる。課題ファイルは main に残り、戻し先で扱い直す\) → `FB abandon` \(課題ファイルが main に無ければ拒む\)/);
  assert.match(autoSelect(), /\| `legacy` \/ `migrate` \/ `batch` \| main マージの節「旧形式の run」\/ 下の「移行」\/ routing\.md「途中で止まった還流」 \|/);
});

test('0.1.28 / 0.3.0: 起動時: 移行は課題を数える前。main マージ済みの feature は進行中とみなさず片付ける (旧形式は退避して -D)。上流の差分と写し直しの後は自動選択をもう一度呼んで続け、main マージの後は次の機能へ自動で続けない', () => {
  const a = autoSelect();
  assert.match(a, /移行 \(`migrate`\): run ごとに `FB file-issues <run>` → `genDocsReadme\.js` → `git add -A -- docs \.distillery\/runs\/<slug>` → `impl\(<slug>\): issues to feedback`/);
  assert.match(a, /その feature を checkout していれば clean を確かめて `git switch main`/, 'checkout 中の branch は消せない');
  assert.match(a, /`legacy: true` なら `git update-ref refs\/distillery2\/legacy\/<slug>\/<ts> feature\/<slug>` で退避してから `git branch -D`、それ以外は `git branch -d`/);
  assert.match(a, /プラグインへ持ち帰る課題 \(`kind: plugin`\) はきっかけにしない/);
  const head = read(NEXT_ACTION).split('*/')[0];
  assert.ok(head.indexOf('7  旧形式・移行') < head.indexOf('9  上流の課題'), '移行は課題を数える前');
  assert.match(head, /main の run に main マージの done がある feature\/\*/);
  const d = deliverSection();
  assert.match(d, /`feature\/<slug>` が残っていれば `git update-ref refs\/distillery2\/legacy\/<slug>\/<ts> feature\/<slug>` で退避してから `git branch -D feature\/<slug>`/);
  assert.match(d, /その後は自動選択をもう一度呼ぶ/);
  assert.doesNotMatch(d, /commit してから還流へ進む/);
  const r = section(SKILL, '### 要求の差分', '## ② 決定');
  assert.match(r, /7\. 自動選択をもう一度呼んで続ける \(写し直し待ちの機能・次の上流の差分・次の UC\)/);
  assert.match(r, /`git commit -F <本文ファイル>`/);
  const done = section(SKILL, '## 完了報告', '## 参照');
  assert.match(done, /次の機能へは自動で続けない/);
  assert.match(done, /上流の差分と写し直しの後は、報告を控えて自動選択をもう一度呼んで続ける/);
  const del = read(DELIVERY);
  assert.match(del, /## 旧形式の片付け/);
  assert.match(del, /`git update-ref refs\/distillery2\/legacy\/<slug>\/<ts> feature\/<slug>` で退避してから `git branch -D feature\/<slug>`/);
  assert.match(read(RUN_STATE), /起動時の移行 \(`feedbackBatch\.js scan` の `unfiled_runs`。自動選択の `migrate`\)/);
});

test('0.1.28: main マージ: gates.json が無ければ全段を 1 回通す。課題 0 件なら issues to feedback の commit を作らない。stage は docs と <run> を指定 (docs/feedback は名指ししない)', () => {
  const d = deliverSection();
  assert.match(d, /古さは比べず、\*\*常に\*\* `runGates\.js --uc <slug> --tiers <use-cases\.yaml の tiers>` で全段を 1 回通して/);
  assert.match(d, /結果の `filed` が空でなければ `genDocsReadme\.js` を回し、`git add -A -- docs \.distillery\/runs\/<slug>` して `impl\(<slug>\): issues to feedback` で commit/);
  assert.match(d, /`filed` が空 \(課題 0 件\) なら commit を作らない/);
  assert.match(d, /`git add -A -- docs \.distillery\/runs\/<slug>` \(main マージの done・events・README・課題一覧の README/);
  assert.doesNotMatch(d, /git add -A -- docs\/feedback/, 'docs/feedback は無いことがあるので名指ししない');
});

test('0.1.28 / 0.2.0: 決定の差分: 結果ファイルで分岐し、reason_kind plugin は reclassify で kind: plugin に (止めない)、scope は人に返す。plugin の課題は自動選択のきっかけにしない', () => {
  const dd = routingSection('### 決定の差分');
  assert.match(dd, /`reason_kind: plugin` は「プラグインの不具合」\(理由をファイルに書いて `FB reclassify <issue> --reason-file <ファイル> --co-author "<attribution の値>"` でプラグインへ持ち帰る課題にする\)/);
  assert.match(dd, /`reason_kind: scope` は auto なら人に返し \(推奨: 戻し先を基盤にする\)、recommend なら推奨どおり課題の `target_step` を `foundation` に書き換え/);
  const put = section(SKILL, '## 課題ファイル', '## 完了報告');
  assert.match(put, /`kind: plugin` \(プラグインへ持ち帰る課題\): 自動選択のきっかけにしない。distillery2 を直した後に人が `git rm` して commit する/);
  const done = section(SKILL, '## 完了報告', '## 参照');
  assert.match(done, /プラグインへ持ち帰る課題 \(`scan` の `plugin`\)/);
  const del = read(DELIVERY);
  assert.match(del, /\| Feedback-Reclassified \/ Feedback-Kind-Original \|/);
  const t = read('skills/d2-decide/SKILL.md');
  assert.match(t, /`reason_kind: plugin`/);
  assert.match(t, /`reason_kind: scope`/);
  assert.match(t, /"reason_kind": "plugin" \| "scope"\}` \(`reason_kind` は `blocked` のとき必須\)/);
  assert.match(t, /\.distillery\/logs\/decide-<issue>\.result\.json/, '結果ファイルは還流のバッチの外');
  assert.match(read('skills/d2-run/references/troubleshooting.md'), /受理の検査[\s\S]*1 つの sh にまとめたものが同じ症状で止まった/);
});

test('0.2.0: 決定の差分・基盤の差分: clean な main で回し、決定は ADR → 索引・ルール・アーキテストの作り直し → static (run 名は d2-feedback) → レビュー → 確認ページ → 課題の消費と commit → 止めた feature の退避', () => {
  const dd = routingSection('### 決定の差分');
  const order = ['「上流の差分の branch」の 1 で branch を切る', 'sub `d2-decide mode=feedback issue=<docs/feedback/<issue>.md> result=<.distillery/logs/decide-<issue>.result.json>`', '`node <skills>/d2-decide/scripts/genAdrIndex.js', '`node <skills>/d2-foundation/scripts/genRules.js', '`node <skills>/d2-foundation/scripts/genArchTests.js', '`runGates.js --uc d2-feedback --only static`', '決定のレビュー', '`page:decide:approve`', '`decide: feedback (adr)`', '`git rm`', '`decide: feedback` で commit (trailer `Feedback-Consumed:`)', '「上流の差分の branch」の 3 で main へ確定する', '上流で止めた機能の feature は消さない'];
  let last = -1;
  for (const o of order) { const i = dd.indexOf(o); assert.ok(i > last, `決定の差分の順: ${o}`); last = i; }
  assert.match(dd, /派遣表「② 決定の差分 \(ADR\)」/);
  assert.match(dd, /落ちたら「人に返すとき」の表のゲートの再失敗の行に従う: auto は人に返し、recommend は担当を 2 回まで派遣し直して 3 回目で人に返す/);
  assert.doesNotMatch(dd, /worktree/, '決定の差分は本体の作業ツリーで回す (還流の worktree は使わない)');
  // 0.3.0: 決定のレビューの基盤向けの指摘は main に戻さず、同じ branch で基盤の差分まで回して確定する (指摘の連鎖を断つ)
  assert.match(dd, /戻し先が foundation の指摘は、課題ファイルにして main に戻さず、5 の 2 つの commit の後に\*\*同じ branch のまま\*\*下の「基盤の差分」の 2〜4 で直してから確定する/);
  // 基盤向けの指摘を残したら、決定の差分では確定しない (確定は基盤の差分の 4 の 1 回だけ)
  const s3 = dd.indexOf('3. 4 で基盤向けの指摘を残したなら、ここでは確定せず');
  assert.ok(s3 > dd.indexOf('`decide: feedback` で commit') && s3 < dd.indexOf('「上流の差分の branch」の 3 で main へ確定する'), '確定の前に基盤の差分へ分岐する');
  assert.match(dd, /非機能グレード表の根拠だけの訂正 \(レベルを変えない\) なら ADR は足さず表だけを直す/);
  const fd = routingSection('### 基盤の差分');
  assert.match(fd, /sub `d2-foundation phase=<該当 phase>`、契約の骨格は sub `d2-contract mode=skeleton` \(UC がある契約は[^\n]*「反証して直す派遣の引数」[^\n]*\)、画面部品は sub `d2-design mode=feedback items=<直すファイルと直す内容を 1 行ずつ>`[^\n]*どの派遣も再実行して安全。/);
  assert.match(fd, /仕上げの前に ③ の 4 と同じく `git add contracts docs\/design` → `foundation: feedback \(contracts and design\)` で commit する[^\n]*続けて sub `d2-foundation phase=finish ui=<true\|false>`/);
  assert.match(fd, /`validateUcIndex\.js contracts --keep-from <派遣の前の HEAD>` が exit 0 も足す/);
  assert.match(fd, /受理は ③ の 5 と同じ/);
  assert.match(fd, /`foundation: feedback`/);
  assert.match(row(read(TEMPLATE), /^\| ② 決定の差分 \(ADR\) \|/), /本体の作業ツリー \(clean な main\) で派遣する \(worktree は使わない/);
  assert.match(wsRow('② 決定の差分 (ADR)'), /`docs\/adr\/\*\*`、`docs\/nfr\/\*\*`、`\.distillery\/logs\/decide-<issue>\.result\.json`/);
});

test('0.1.27 / 0.2.0: 上流で止めるときは課題ファイルを一時の worktree から main に入れ、blocked_on_upstream を記録して停止する。一時の branch は feedback-req/', () => {
  const t = read(SKILL);
  const rev = t.slice(t.indexOf('## 人レビュー'), t.indexOf('## main マージ (deliver 段階)'));
  assert.match(rev, /「要求を直す」があれば `issues\/` に下書き \(`target_step: requirements`\) を書き、routing\.md「上流で止めるとき」の手順で止める/);
  assert.match(rev, /要求の差分が課題を反映した後、写し直して scenario から続ける/);
  const up = routingSection('### 上流で止めるとき');
  assert.match(up, /`git worktree add \.distillery\/worktrees\/<slug>\/<issue> -b feedback-req\/<slug>\/<issue> main`/);
  assert.match(up, /`git fetch \. feedback-req\/<slug>\/<issue>:main`/);
  assert.match(up, /remote `origin` があれば `git push origin main`/);
  assert.match(up, /`<RS> event <run> blocked_on_upstream --data-file <json>` \(`\{"issues": \[\{"id": "<課題ファイルの名前 \(\.md を除く\)>", "target": "<戻し先>", "resume_from": /);
  assert.match(up, /feature の\*\*変更をすべて\*\* commit する: `git add -A -- apps packages contracts features docs \.distillery\/runs\/<slug>`/, '実装の途中のコードも残す (写し直しで運ぶ)');
  assert.doesNotMatch(up, /git fetch \. feedback\/<slug>/);
  assert.match(section(SKILL, '## 課題ファイル', '## 完了報告'), /一覧 `docs\/feedback\/README\.md` は genDocsReadme が生成する/);
});

test('0.1.27: run-state の feedback_filed は課題ファイルにした記録。取り込んだ記録は trailer。feedback_deferred は旧記録だけ', () => {
  const rs = read(RUN_STATE);
  assert.match(rs, /\| feedback_filed \| UC の課題を課題ファイルにした記録。`\{kind, ref, issue_path\}`/);
  assert.match(rs, /取り込んだ記録は commit の trailer \(`Feedback-Consumed:`\)/);
  assert.match(rs, /\| feedback_deferred \| \(0\.1\.25 までの記録だけ。0\.1\.26 からは書かない\)/);
  assert.match(rs, /main マージ済みの正は `stages\/deliver\.done\.yaml`/);
  assert.match(rs, /`unfiled_issues`/);
  const del = read(DELIVERY);
  for (const k of ['Feedback-Consumed', 'Feedback-Dismissed']) assert.match(del, new RegExp(`\\| ${k} `));
  assert.match(del, /0\.1\.27〜0\.1\.36 の還流の commit には `Feedback-Kind`・`Feedback-From-UC`・`Feedback-Result`・`Feedback-Stopped` もある \(読むだけ。0\.2\.0 は書かない\)/);
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
  assert.match(routingSection('### 決定の差分'), /索引・開発ルール・アーキテストを作り直す \(1 コマンドずつ\)/);
  assert.match(t, /\*\*関与ティアの決め方\*\*[^\n]*`--tiers` にはカンマ区切りで渡す。例 `--tiers frontend,backend-api`/, '④ の正本にも区切り文字 (差分レビュー 1 ラウンド目)');
  assert.match(read(DELIVERY), /"squash":"<フル sha>"[^|]*sha は短縮しない/);
  assert.match(read('skills/d2-run/references/troubleshooting.md'), /0\.1\.28 の試し運転でも `genDocsReadme\.js; echo exit=\$\?`/);
});

test('0.1.30 L1/M4/M2/M3: 名指し起動でも main マージ済みの feature を片付ける。事前回答が選べなければ止まる。models_resolved は遅らせた場合だけ。squash の前に件名の検査', () => {
  const a = autoSelect();
  assert.match(a, /名指し \(`uc=` \/ `stage=`\) は片付けの後に、進行中・途中・写し直し待ちのものが別にあれば `refuse` になる/);
  assert.match(a, /`delivered` で `notes\.uncovered_done` に入っていれば「やり直し」の節/);
  assert.match(read(SKILL), /1\. 引数を解釈し、上の自動選択で段階を決める \(`uc=` \/ `stage=` の名指しも `nextAction\.js` に渡す\)/);
  assert.doesNotMatch(read(SKILL), /事前に与えられた回答/, 'headless の事前回答の規定は mode=recommend に置き換えた (0.2.0)');
  const d = deliverSection();
  assert.match(d, /6\. main の上で、④ の冒頭で遅らせた場合だけ `models_resolved` を記録し \(遅らせた = run の events に解決済み ID の `models_resolved` が無い。冒頭で記録済みなら記録しない/);
  assert.match(read(DELIVERY), /④ の冒頭で遅らせた場合だけの `models_resolved` \(遅らせた = run の events に解決済み ID の `models_resolved` が無い/, 'git-delivery も同じ条件 (差分レビュー 1 ラウンド目の指摘 2。0.1.32 O1 で判定基準)');
  assert.match(d, /1\. \*\*件名の検査\*\* \(最初に\): `git log <base_head>\.\.HEAD --format=%s` がすべて `impl\(<slug>\): ` か `req\(<slug>\): ` で始まる。そうでなければ UC 外の commit が混ざっているので、gates\.json の作り直しも課題ファイルの commit もせず止まって報告する/);
  const sq = section(DELIVERY, '## 手順 (squash)', '## 手順 (main への取り込み)');
  assert.match(sq, /件名がすべて `impl\(<slug>\): ` か `req\(<slug>\): ` で始まる。段階ごとの commit の規則/);
  assert.match(sq, /\*\*main マージ 1 の冒頭で検査済み\*\*/);
  assert.match(sq, /squash せず止まって報告する \(混ざった commit の一覧を添える/);
  assert.doesNotMatch(sq, /staged が当該 UC の変更だけであることを確認する/, '件名の検査に置き換えた');
});

test('0.1.32 J2: 残った作業は種類ごとの宛先へ (design → d2-design mode=feedback → importUi → frontend の unit の回帰 / assumption → assumption_resolved)。UC への持ち越し (carry_over) は無い。既存の持ち越しは要求の差分で流す', () => {
  const r = section(SKILL, '### 要求の差分', '## ② 決定');
  assert.match(r, /既存の持ち越し \(0\.1\.30〜0\.1\.31 形式の残った作業: `FB scan` の `carry_over_rows` \(`use-cases\.yaml` の `carry_over` の行\) と `carry_over_pending`\) が残っているときは、要求の課題が 0 件でも入る/);
  assert.match(r, /\*\*既存の持ち越しを先に控える\*\*: `FB scan` の `carry_over_rows` \(slug と items\) と `carry_over_pending` \(slug と items\) を 3 の材料として書き留める \(2 の再生成/);
  assert.match(r, /報告の「残った作業」\(要求担当の write-set の外で必要になった作業。種類 `design` \/ `assumption` と対象付き\)、「決定と違う反映」[\s\S]{0,200}「仮に決めた反映」[^\n]*を 3 の材料に控える/);
  assert.match(r, /要求の課題が 0 件 \(既存の持ち越しだけ\) なら要求担当は派遣せず、`node <skills>\/d2-requirements\/scripts\/genUseCases\.js` を回して/);
  assert.match(r, /\*\*「仮に決めた反映」\*\* \(課題ごとに選んだ案・理由。無ければ「なし」。「決定と違う反映」と並べて載せる/);
  assert.match(r, /\*\*「残った作業」\*\* を種類ごとに載せ、1 件ずつ「\*\*対応する \/ 無視\*\*」で聞く/);
  assert.doesNotMatch(r, /次の UC で拾う \/ 無視/);
  assert.doesNotMatch(r, /見込みの宛先/);
  assert.match(r, /報告が `packages\/ui\/<相対パス>` \(取り込み先\) で書いていたら `docs\/design\/storybook-app\/src\/<相対パス>` に読み替え、実在を確かめる。無ければ「対応づけられない」と出して派遣しない/);
  assert.match(r, /既存の持ち越し \(1 で控えた `carry_over_rows` と `carry_over_pending` の `items`\) も同じ一覧に載せる/);
  assert.match(r, /4\. 承認されたら、まず「対応する」残った作業を種類ごとの宛先に流す/);
  assert.match(r, /sub `d2-design mode=feedback items=<項目のファイル \(docs\/design\/storybook-app\/src\/<相対パス>。stories も部品も\) と直す内容を 1 行ずつ>` \(派遣表「① 要求の差分 \(画面部品\)」/);
  assert.match(r, /`node <skills>\/d2-design\/scripts\/validateScreens\.js docs\/design\/screens\.yaml --app docs\/design\/storybook-app\/src --use-cases docs\/requirements\/use-cases\.yaml` が exit 0/);
  assert.match(r, /`node <skills>\/d2-foundation\/scripts\/importUi\.js --from docs\/design\/storybook-app --cwd \.` で `packages\/ui\/\*\*` に取り込み直す \(前回の一覧にあって消えたファイルは消える\)/);
  assert.match(r, /\*\*項目がすべて「直した」\*\* \(報告に「直せない \(理由\)」が 1 件でもあれば受理せず、変更を捨てて/);
  assert.match(r, /1 つの項目に複数の id \(例「A-004 \/ A-005 \/ A-006」\) があれば \*\*id ごとに分けて\*\*候補を列挙し、id ごとの選択から `targets` の要素を 1 つずつ組む/);
  assert.match(r, /`tiers` に frontend を含むものごとに `runGates\.js --uc <slug> --tiers frontend --only unit` を回す[^\n]*落ちたら止まって報告する/);
  assert.match(r, /`node runState\.js event \.distillery\/runs\/<slug> assumption_resolved --data-file <json>`/);
  assert.match(r, /\{"targets": \[\{"tier": "<tier>", "attempt": <n>, "id": "A-xxx"\}\], "decision": "<要求の差分の決定の要点>", "by": "req: feedback"\}/);
  assert.match(r, /無い組は拒む。最新でない attempt の前提も閉じられる。AssumptionRecord の yaml は変えない/);
  assert.match(r, /`node runState\.js event \.distillery\/runs\/<slug> carry_over_migrated --data-file <json>`/);
  assert.match(r, /`git add -A -- docs packages\/ui \.distillery` \(`packages\/ui` は design の作業があったときだけ/, '.distillery の下の引き継ぎ・決めたことの記録・レビュー・やり直す UC の退避も同じ commit に入る');
  assert.match(r, /閉じた前提 \(`assumption_resolved`\) も同じ: 完了報告に「閉じた前提[^\n]*as-built は次にその UC を回したときに反映/);
  // 自動選択
  assert.match(read(NEXT_ACTION), /9  上流の課題        要求の課題か既存の持ち越し → requirements-diff/);
  assert.match(read(NEXT_ACTION), /scan\.carry_over_rows\.length \|\| scan\.carry_over_pending\.length/);
  // ④・人レビュー・main マージから持ち越しが消えている
  const t = read(SKILL);
  assert.doesNotMatch(t, /carryOver\.js/);
  assert.doesNotMatch(t, /carry_over_status/);
  const review = section(SKILL, '## 人レビュー (review 段階)', '## main マージ (deliver 段階)');
  assert.doesNotMatch(review, /残った作業/);
  assert.match(review, /`review_approved \{assumption_decisions\[\], assumption_evidence_sha256, gates_result, head\}` を記録する/);
  const d = deliverSection();
  assert.match(d, /`review_approved` に `carry_over\.carry` が残る run \(0\.1\.30 形式\) でも読まずに main マージし、完了報告に「持ち越し N 件は次の起動で要求の差分に載る」と書く/);
  assert.doesNotMatch(section(DELIVERY, '## 手順 (squash)', '## 手順 (main への取り込み)'), /carryOver/);
  assert.doesNotMatch(read(TEMPLATE), /\*\*残った作業の追記\*\*/);
  assert.match(read(TEMPLATE), /\| ① 要求の差分 \(画面部品\) \| 画面の見本の修正役 \| `distillery2:d2-design` `mode=feedback items=/);
  assert.match(wsRow('① 要求の差分 (画面部品)'), /`docs\/design\/\*\*`/);
  // run-state
  const rs = read(RUN_STATE);
  assert.match(rs, /\| assumption_resolved \| main マージ済み UC の前提の記録 \(AssumptionRecord\) を要求の差分の決定で閉じた。`\{targets: \[\{tier, attempt, id\}\], decision, by: "req: feedback"\}`/);
  assert.match(rs, /\| carry_over_migrated \|/);
  assert.doesNotMatch(rs, /carryOver\.js/);
  // d2-design / d2-requirements
  const design = read('skills/d2-design/SKILL.md');
  assert.match(design, /## mode=feedback \(要求の差分の残った作業: 項目のファイル \(stories と部品\) だけを直す。0\.1\.32、0\.1\.33 で部品も\)/);
  assert.match(design, /③ の全生成 \(手順 1〜6\) は\*\*しない\*\*/);
  assert.match(design, /## mode=feedback: 読むもの/);
  assert.match(design, /## mode=feedback: 書くもの/);
  assert.match(design, /項目ごとに「直した \(変えたファイル\)」か「直せない \(理由\)」、項目が部品なら「影響する Story」の一覧を書く/);
  const req = read('skills/d2-requirements/SKILL.md');
  assert.match(req, /種類は 2 つに限る \(0\.1\.32 J2\)/);
  assert.match(req, /`design` \(画面の見本\): 対象 = `docs\/design\/storybook-app\/src\/<相対パス>` \(見本 `stories\/<Name>\.stories\.tsx` でも部品 `components\/\*\*` でもよい。取り込み先 `packages\/ui\/` ではなく見本側のパス/);
  assert.match(req, /`assumption` \(前提の記録を閉じる\): 対象 = UC の slug・ティア・attempt・`A-xxx` の id/);
  assert.match(req, /8\. 最終報告に「\*\*仮に決めた反映\*\*」を書く/);
  assert.doesNotMatch(req, /次の UC で拾う/);
  // d2-run の表と正本
  const reqRow = row(read(DIRECT_IO), /^\| ① の要求の差分の取り込み \|/);
  assert.match(reqRow, /`docs\/design\/\*\*`/);
  assert.match(reqRow, /`packages\/ui\/\*\*` \(importUi\.js の取り込み直し\)/);
  assert.match(reqRow, /`<run>\/events\.jsonl` \(残った作業 `assumption` の `assumption_resolved`、既存の持ち越しを流した `carry_over_migrated`/);
  assert.match(row(read(DIRECT_IO), /^\| ④ の prTrailers\.js と main マージ \|/), /`docs\/requirements\/use-cases\.yaml` \(`status: done`\) \|$/);
});

test('0.1.32 J1: 仕様は 1 つの UC で確かめられる単位に。scenario の検査で他 UC の振る舞いが残れば要求の課題にして止まる (記録 → 1 回の commit)。blocked_on_requirement は stage を持つ', () => {
  const t = read(SKILL);
  const sc = row(t, /^\| \*\*scenario\*\* \|/);
  assert.match(sc, /checkScenario\.js features\/<業務>\/<slug>\.feature[^\n]*?を回し、結果 \(JSON 1 行。[^\n]*?\) を読む。\*\*`missing` \(対応づかない受入基準\) があれば ok の前に分岐する\*\*/);
  assert.match(sc, /執筆役の報告がそれを\*\*他 UC の振る舞い\*\*と判断していれば、\*\*要求の課題にして止まる\*\*/);
  assert.match(sc, /執筆役が `<run>\/issues\/` に書いた下書き \(`target_step: requirements`。無ければ d2-run が書く/);
  assert.match(sc, /routing\.md「上流で止めるとき」の手順で止める \(scenario は done にしない。要求の差分が仕様を UC 単位に分けた後、写し直して scenario から続ける\)/);
  assert.match(sc, /執筆役が「この UC の振る舞い」と判断していれば \(書き漏れ\) 執筆役に差し戻す/);
  assert.match(sc, /`scenario_approved \{feature, feature_sha256, acceptance: \{<path>: <sha256>\}\}` を書く。受入の feature が無ければ `acceptance: \{\}`/);
  assert.match(sc, /`node runState\.js done <run> scenario '\{"feature": "<path>"\}'`/);
  assert.match(t, /上流で止めた UC は再開しない \(自動選択が `resume` を返したときだけ写し直して続ける\)/);
  const rs = read(RUN_STATE);
  assert.match(rs, /\| blocked_on_upstream \| 上流 \(要求・決定・基盤\) の反映待ちで停止した。`\{issues: \[\{id, target, resume_from\?\}\]\}`/);
  assert.match(rs, /\| blocked_on_requirement \| \(0\.1\.x の記録。0\.2\.0 からは blocked_on_upstream\) 要求の反映待ちで停止した。`\{stage: scenario \\\| review\}`/);
  assert.match(rs, /scenario_approved は `\{feature, feature_sha256, acceptance: \{<path>: <sha256>\}\}`/);
  const usdm = read('skills/d2-requirements/references/usdm/usdm-decompose.md');
  assert.match(usdm, /\*\*仕様 \(SPEC\) は 1 つの UC で確かめられる単位に分ける\*\* \(0\.1\.32 J1\)/);
  assert.match(usdm, /受入基準だけを UC ごとに書いても足りない/);
  assert.match(usdm, /元の共有 SPEC は他の UC の `spec_ids_rejected` へ移す/);
  const req = read('skills/d2-requirements/SKILL.md');
  assert.match(req, /仕様は 1 つの UC で確かめられる単位に分ける \(複数の UC の振る舞いを 1 つの仕様に混ぜない/);
  assert.match(req, /課題が「他の UC の振る舞いが受入基準に混ざっている」なら、仕様自体を UC ごとに分け/);
});

test('0.1.32 手順の追記 16 件: 旧形式の自動選択 (legacy_runs)・main マージ 1 の順 (件名 → gates.json の新しさ → 条件)・再開・broken の片付け・applied で差分なし・timestamp の書式・回帰は d2-run・verify の一覧はファイル・mktemp・--data-file', () => {
  const t = read(SKILL);
  assert.match(read(NEXT_ACTION), /7  旧形式・移行      scan の legacy_runs → legacy/);
  assert.match(autoSelect(), /\| `legacy` \/ `migrate` \/ `batch` \| main マージの節「旧形式の run」/);
  const d = deliverSection();
  assert.match(d, /1\. main マージ 1 は 3 つの作業をこの順で行う/);
  assert.match(d, /2\. \*\*gates\.json の作り直し\*\*: 先に\*\*人の修正\*\*を判定する/);
  assert.match(d, /3\. \*\*条件の確認\*\*: `review_approved` が有効/);
  assert.match(d, /3\. 件名は 1 で検査済み → 復旧用 ref \(`refs\/distillery2\/pre-squash\/<slug>\/<timestamp>`。`<timestamp>` は `date -u \+%Y%m%dT%H%M%SZ`/);
  assert.match(d, /`git branch -D feature\/<slug>` \(`<ts>` は `date -u \+%Y%m%dT%H%M%SZ`\)/);
  const sq = section(DELIVERY, '## 手順 (squash)', '## 手順 (main への取り込み)');
  assert.match(sq, /止まった後の再開 \(0\.1\.32 N3\): 人が混入した commit を落とす \(rebase\)。残りは段階の commit なので、再開は main マージ 1 から \(gates\.json は常に作り直す\)/);
  assert.match(sq, /`<timestamp>` は `date -u \+%Y%m%dT%H%M%SZ` \(UTC。固定値を書かない/);
  assert.doesNotMatch(read(SKILL), /`broken`|already-applied/, '還流のバッチの状態の扱いは d2-run の本文に無い (0.1.x のバッチは FB status・merge・abandon で片付けるだけ)');
  const integ = row(t, /^\| \*\*integrate\*\* \|/);
  assert.match(integ, /\*\*他 UC への回帰は d2-run が回す\*\*: 受理して done を書き `impl\(<slug>\): integrate` で commit した後、`git diff --name-only <base_head>\.\.HEAD -- features\/support features\/step_definitions` \(commit 済みの変更だけを見るので、commit の前に回さない\) に変更があれば、main マージ済み UC \(`status: done`\) ごとに、[^\n]*`runGates\.js --uc <他 slug> --only uc-bdd` を回し/);
  assert.match(section(SKILL, '### 要求の差分', '## ② 決定'), /`grep -l "id: A-xxx" \.distillery\/runs\/\*\/attempt-\*\/assumptions\.<tier>\.yaml` で id を持つ \(slug, attempt\) の組をすべて出し、1 件なら確定、複数なら確認ページで人に選ばせる/);
  assert.match(read('skills/d2-design/SKILL.md'), /リポジトリのルートからの相対パス `docs\/design\/storybook-app\/src\/<相対パス>`/);
  assert.match(read('skills/d2-implement/references/integrate.md'), /共有の補助[^\n]*を変えたら報告に書く。他 UC のシナリオは自分では回さない/);
  const verify = row(t, /^\| \*\*verify\*\* \|/);
  assert.match(verify, /\*\*常に\*\* `\.distillery\/logs\/verify-<slug>-attempt-<n>\.txt` \(gitignore\) に書いてパスで渡す \(件数で渡し方を変えない/);
  assert.match(verify, /`docs\/README\.md`・`docs\/requirements\/use-cases\.yaml`・`docs\/feedback\/\*\*` \(どの UC も書く簿記のファイル\) を除いたもの/);
  assert.match(row(read(TEMPLATE), /^\| ④ verify/), /`変更ファイル一覧と他 UC と共有する変更ファイル \(初期候補\): <\.distillery\/logs\/verify-<slug>-attempt-<n>\.txt の絶対パス>`/);
  assert.match(wsRow('④ tier'), /OS の一時ファイル \(`mktemp` か `node -e` で作る。リポの外。使い終えたら削除\)/);
  assert.match(read('skills/d2-implement/references/tier-impl.md'), /`mktemp` か `node -e` で作る/);
  const ts = read('skills/d2-run/references/troubleshooting.md');
  assert.match(ts, /## headless で `mktemp` が拒否される/);
  assert.match(ts, /## `runState\.js event` \/ `done` に長い日本語の JSON を argv で渡すとハーネスの検査で止まる/);
  assert.match(t, /長い JSON \(日本語の一覧など\) は `\.distillery\/logs\/<name>\.json` に書いて `--data-file <ファイル>` で渡す \(argv と排他/);
  assert.match(read(RUN_STATE), /`--data-file <json ファイル>` \(排他\)/);
  assert.match(t, /\*\*「仮に決めた反映」\*\*/);
  assert.match(t, /6\. main の上で、④ の冒頭で遅らせた場合だけ `models_resolved` を記録し \(遅らせた = run の events に解決済み ID の `models_resolved` が無い/);
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
  assert.match(routingSection('### 決定の差分'), /`FB reclassify <issue> --reason-file <ファイル> --co-author "<attribution の値>"`/, 'スクリプトが作る commit にも attribution を付ける');
  const g = section(DELIVERY, '## commit の attribution (0.1.30)', '## UC branch の開始と再開');
  assert.match(g, /\*\*attribution 行\*\* = ハーネスが指定する trailer 1 行/);
  assert.match(g, /\*\*attribution の値\*\* = その行のキー `Co-Authored-By: ` を除いた部分/);
  assert.match(g, /`git commit -m "<件名>" -m "<attribution 行>"` \(2 つ目の `-m` が最後の段落になり、git が trailer として扱う\)/);
  assert.match(g, /\| プラグインへ持ち帰る書き換え \(`FB reclassify`。スクリプトが commit する\) \| `--co-author "<attribution の値>"` \|/);
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
  assert.match(read('skills/d2-run/references/troubleshooting.md'), /## headless で runGates の出力を `> <ファイル>` に保存できない/);
  const ts = read('skills/d2-run/references/troubleshooting.md');
  assert.match(ts, /回し直す前の写しは `cp` で `<run>\/reports\/gates\.failed-1\.json` に \(作業ディレクトリの中なので通る\)/);
  assert.doesNotMatch(ts, /`FB record-gate/, '廃止したサブコマンドを回避策に書かない');
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
  assert.match(t, /要求の差分で残った作業は ④ に持ち込まない/);
  assert.match(read(TEMPLATE), /要求の差分で残った作業は ④ の派遣文に追記しない/);
  assert.match(read('skills/d2-run/references/troubleshooting.md'), /`cd <wt> && node <スクリプト>` は通った/);
});

test('0.1.33 P1/P2/P5/P6: main マージ 1 の 2 は無ければ作り直し・あれば時刻で比べる・落ちたら推測で直さず止まり UC 外かの材料を添える・人は feature 上で直して main マージ 1 から。3 の review_approved の有効の定義。main マージ 6 の README は main マージ済みの状態列', () => {
  const d = deliverSection();
  assert.doesNotMatch(d, /%cI|finished_at/); // 0.1.35 R19: 古さは時刻で比べず常に作り直す
  assert.match(d, /それでも落ちたら、\*\*推測で直さず止まって報告する\*\*。報告に添えるもの: 落ちたゲート名と job \(`gates\.json` の `output_tail` \/ `failed_tests`\)、指摘の対象ファイルが UC の変更 \(`git diff --name-only <base_head>\.\.HEAD`\) に含まれるか。含まれなければ「UC と無関係の可能性/);
  assert.match(d, /人が直すときは \*\*feature の上で\*\* \(依存の更新、または `\.qlty\/qlty\.toml` の `\[\[ignore\]\] rules = \["<plugin>:<id>"\]`\) 件名 `impl\(<slug>\): <内容>` で commit し、main マージ 1 から再開する/);
  assert.match(d, /main で直して feature を rebase しない \(`base_head` は開始時の記録のまま更新されないので、main 側の修正 commit が `<base_head>\.\.HEAD` に入り、1 の件名の検査で止まる。通っても squash がその修正を UC の 1 commit に畳む\)/);
  assert.match(d, /`review_approved` が有効 \(= `runState\.js status` で review が done、かつ events で最後の `review_approved` より後に `stage_invalidated \{stage: review\}` も `review_rejected` も無い/);
  assert.match(d, /`genDocsReadme\.js` で `docs\/README\.md` を更新し \(UC 一覧の状態列が `status: done` を見て「main マージ済み」になる/);
  assert.match(section(DELIVERY, '## UC branch の開始と再開', '## 段階ごとの commit'), /main マージ 1 の 2 で止まった後に人が feature に足した commit \(UC と無関係な static の落ちの修正[^\n]*も件名は `impl\(<slug>\): ` なので件名の検査を通り、squash で UC の 1 commit に入る/);
});

test('0.1.33 P7/P8/P9/P15/P16: 「要求を直す」のコマンド列 (run は絶対パス・genDocsReadme・-D・push)。scenario 行は checkScenario のコマンド例と scenario-approve。執筆役は他 UC の振る舞いを要求の課題に', () => {
  const fb = routingSection('### 上流で止めるとき');
  assert.match(fb, /今の feature を main に入れずに、課題だけを main に入れる/);
  assert.match(fb, /2\. `node <skills>\/d2-common\/scripts\/feedbackBatch\.js file-issues <root>\/\.distillery\/runs\/<slug> --cwd <wt>` \(\*\*run は feature の作業ツリー上の絶対パス\*\*/);
  assert.match(fb, /3\. `node <skills>\/d2-common\/scripts\/genDocsReadme\.js --cwd <wt>`/);
  assert.match(fb, /4\. `git -C <wt> add -A -- docs` → `git -C <wt> commit -m "impl\(<slug>\): issues to feedback" -m "<attribution 行>"`/);
  assert.match(fb, /6\. `git worktree remove <wt>` → `git merge-base --is-ancestor feedback-req\/<slug>\/<issue> main` が exit 0 なら `git branch -D feedback-req\/<slug>\/<issue>`/);
  assert.match(fb, /7\. remote `origin` があれば `git push origin main` → `git push origin \'refs\/distillery2\/\*:refs\/distillery2\/\*\'` \(拒否されたら止まって報告する。force push はしない\)/);
  const t = read(SKILL);
  const sc = row(t, /^\| \*\*scenario\*\* \|/);
  assert.match(sc, /`node <skills>\/d2-implement\/scripts\/checkScenario\.js features\/<業務>\/<slug>\.feature --use-cases docs\/requirements\/use-cases\.yaml --requirements docs\/requirements\/requirements\.yaml --uc <slug> --acceptance-dir features\/acceptance` を回し、結果 \(JSON 1 行。`ok` \/ `missing` \/ `covered` \/ `unknown_tags` \/ `errors`/);
  assert.match(sc, /routing\.md「上流で止めるとき」の手順で止める/);
  assert.match(sc, /承認を `node runState\.js scenario-approve <run> --feature features\/<業務>\/<slug>\.feature --acceptance-dir features\/acceptance` で記録する \(feature の bytes の sha256 と、`@uc:<slug>` を持つ受入 feature の sha256 を計算して/);
  assert.match(sc, /進行役が自分で計算しない/);
  assert.match(row(section(SKILL, '## 人レビュー (review 段階)', '## main マージ (deliver 段階)'), /「要求を直す」があれば/), /routing\.md「上流で止めるとき」/);
  assert.match(read(RUN_STATE), /`runState\.js scenario-approve <run> --feature <path> \[--acceptance-dir <dir>\]` が書く: feature_sha256 は feature の bytes の sha256、acceptance は `@uc:<slug>` を持つシナリオがある `features\/acceptance\/\*\.feature` \(\*\*人が承認した対象\*\*。`checkScenario\.js` は印タグの整合のために受入 dir の全ファイルを読むが、他 UC だけのファイルは承認の対象でないのでハッシュに入れない/);
  assert.match(row(read(DIRECT_IO), /^\| ④ の段階の進行・確認ページ \|/), /`features\/<業務>\/<slug>\.feature`、`features\/acceptance\/\*\*` \(scenario の承認の `runState\.js scenario-approve` がハッシュを計算する\)/);
  const scen = read('skills/d2-implement/references/scenario.md');
  assert.match(scen, /受入基準が\*\*他 UC の振る舞い\*\* \(登録 UC の仕様に編集・削除が混ざる など\) を含み、この UC のシナリオで対応づけられないときも同じく引き継ぎファイルに戻し先 `requirements` の課題を書く/);
  assert.match(scen, /報告に「他 UC の振る舞い」と明記する。この UC で覆わない/);
  assert.match(scen, /プラグインや検査の仕組みを変える提案 \(`acceptance_ids` のような欄の追加 など\) は書かない/);
  const ts = read('skills/d2-run/references/troubleshooting.md');
  assert.match(ts, /scenario の承認のハッシュは `runState\.js scenario-approve` が計算するので、進行役が計算する場面は無い/);
  assert.match(ts, /## headless で `\/tmp` などリポの外への控えの保存が拒否される/);
  assert.match(ts, /控えは `\.distillery\/logs\/` \(gitignore\) に置く/);
});

test('0.1.33 P10/P11/P13/P17/P18: carry_over は廃止で戻さない (要求担当の手順書と派遣文)。design の items は src/** で部品も、影響する Story を辿る。basis.js の対象は決定の本文。別名の解決先が分かれば ID。carry_over が残れば genUseCases', () => {
  assert.match(read('skills/d2-requirements/SKILL.md'), /`carry_over` \(0\.1\.30〜0\.1\.31 の UC への持ち越し\) は 0\.1\.32 で廃止した。再生成で消えるのは想定どおりで、\*\*手で戻さない\*\*/);
  assert.match(row(read(TEMPLATE), /^\| ① 要求 \|/), /要求の差分のときだけ: `use-cases\.yaml の carry_over \(0\.1\.30〜0\.1\.31 の持ち越し\) は廃止済み。再生成で消えてよい \(手で戻さない\)`/);
  assert.match(row(read(TEMPLATE), /^\| ① 要求の差分 \(画面部品\) \|/), /`mode=feedback items=<直すファイル \(docs\/design\/storybook-app\/src\/<相対パス>。stories も部品も\) と直す内容を 1 行ずつ>`[^\n]*項目が部品なら「影響する Story」\(その部品から import を Story まで辿った一覧/);
  const design = read('skills/d2-design/SKILL.md');
  assert.match(design, /見本 `stories\/<Name>\.stories\.tsx` も部品 `components\/\*\*` も/);
  assert.match(design, /項目が部品のとき、その部品を使う他の Story の表示も変わる。直してよい \(「直せない」にしない\)。報告の「影響する Story」に、その部品から import を \*\*Story のファイルまで辿った\*\*一覧 \(部品を使う部品を介する間接の利用も含む\) を書く/);
  const r = section(SKILL, '### 要求の差分', '## ② 決定');
  assert.match(r, /項目が部品なら、報告の「影響する Story」\(その部品から import を Story まで辿った一覧\) を完了報告に転記する/);
  assert.match(r, /要求担当を派遣した後も、1 で控えた `carry_over_rows` が空でなく `use-cases\.yaml` に `carry_over` の行が残っていれば \(要求担当が再生成しなかった\)、3 の確認ページの前に `node <skills>\/d2-requirements\/scripts\/genUseCases\.js` を回す/);
  assert.match(r, /確認ページはこの再生成の後の差分で作る/);
  const step4 = r.slice(r.indexOf('4. 承認されたら'), r.indexOf('5. 反映・取り下げた課題'));
  assert.doesNotMatch(step4, /`node <skills>\/d2-requirements\/scripts\/genUseCases\.js`/, '承認の後に再生成を回さない (人が確認した UC 対応と違う内容を commit しない。2 の再生成への言及は可)');
  assert.match(r, /`docs\/adr\/\[0-9\]\*\.md` \(決定の本文。`_review-summary\.md` と `index\.md` は生成物なので渡さない。渡すと STALE に出る/);
  assert.match(read(SKILL), /別名 \(`opus` 等\) の解決先が分かっていれば \(ハーネスの指示、過去の run の `models_resolved`、Verifier の報告\) 最初から ID で書く/);
});

test('0.1.34 Q1/Q2/Q6/Q7: main マージ 1 の 2 は作り直す前に gates.prev.json に控え、static は回し直さず、qlty.toml に検査が足されたかを報告に添える。完了報告で前回と比べる。filed は空でよい', () => {
  const d = deliverSection();
  assert.match(d, /`reports\/gates\.json` があれば runGates の前に `reports\/gates\.prev\.json` に写す \(前の控えは上書きする\)/);
  assert.match(d, /無ければ \(gitignore なので再開で消えていることがある\)、残っている控えを `node -e "require\('fs'\)\.rmSync\('<run>\/reports\/gates\.prev\.json',\{force:true\}\)"` で消す/);
  assert.match(d, /作り直しの runGates が落ちたら、まず ④ の「ゲートの回し直し」のとおり 1 回だけ回し直す \(static は回し直さない\)/);
  assert.match(d, /それでも落ちたら、\*\*推測で直さず止まって報告する\*\*/);
  assert.match(d, /static で落ちたときは、落ちた job の検査 \(qlty の plugin 名。`output_tail` に出る\) が UC の変更で `\.qlty\/qlty\.toml` に足されたかも添える \(`git diff <base_head>\.\.HEAD -- \.qlty\/qlty\.toml` に `name = "<plugin>"` の追加があるか/);
  assert.match(d, /plugin 名が `output_tail` から特定できない \(出力が末尾で切れた、qlty 以外の job で落ちた\) ときは「判定できない」と書き、足されたか \/ いないかを推測で断定しない/);
  assert.match(d, /`unfiled_issues` が空であることを確かめる \(課題の取りこぼしはこれで確かめる。前の main マージ 1 で課題ファイルにした課題は `filed` に出ないので、止まって再開した main マージでは `filed` が空でよい/);
  const done = section(SKILL, '## 完了報告', '## 参照');
  assert.match(done, /`reports\/gates\.prev\.json` \(main マージ 1 の 2 の控え\) があり、その中で落ちていたゲート・job があれば、今回の gates\.json でそれぞれ pass かも書く \(無ければ書かない/);
  assert.match(read(RUN_STATE), /gates\.prev\.json \(main マージ 1 の 2 で作り直す前の控え\)・gates\.failed-1\.json \(回し直す前の控え\)/);
});

test('0.1.34 Q4/Q11/Q12/Q14: ④ 冒頭の順序 (switch → open → branch_started → models_resolved)。scenario 行は受入 dir が無ければ feature だけで判定。コマンド列は下書きをすべて課題ファイルにし <issue> は 1 件目。派遣文は置換部分の値を 1 行で添える', () => {
  const t = read(SKILL);
  assert.match(t, /上流の課題が無ければ `git switch -c feature\/<slug>` \(git-delivery\.md「UC branch の開始と再開」2\) → `node runState\.js open \. <slug>` → `branch_started` の追記 → `models_resolved` の記録、の順に行う \(run のイベントは open の後に書く/);
  const sc = row(t, /^\| \*\*scenario\*\* \|/);
  assert.match(sc, /^\| \*\*scenario\*\* \| \(④ 冒頭で切った branch の上で\) sub/);
  assert.doesNotMatch(sc, /branch `feature\/<slug>` を切る/);
  assert.match(sc, /`features\/acceptance\/` が無ければ受入は読まず、UC の feature だけで判定する。エラーにしない/);
  assert.match(section(DELIVERY, '## UC branch の開始と再開', '## 段階ごとの commit'), /`git switch -c feature\/<slug>`。作成直後に `runState\.js open` で run を開き、その直後に `events\.jsonl` へ\n\s+`branch_started \{base_branch, base_head, feature_branch\}` を追記する \(`models_resolved` はその後/);
  const fb = routingSection('### 上流で止めるとき');
  assert.match(fb, /`<issue>` = 課題ファイルにしていない下書きの 1 件目の名前/);
  assert.match(fb, /下書きはすべて課題ファイルになり、`feedback_filed` は feature の run に記録される/);
  assert.match(read(TEMPLATE), /\{write_set\}[^\n]*行はそのまま貼り \(置き換えない。受理の検査は行の形で見る\)、直後に置換部分の値を 1 行で添える/);
});

test('0.1.34 Q8/Q9/Q16/Q17: 要求の差分は決めずに返した論点を差し戻す・design の推奨は「対応する」で無視の影響・同じ前提は 1 回で決定が違えば並べる・項目の外の変更の受理', () => {
  const r = section(SKILL, '### 要求の差分', '## ② 決定');
  assert.match(r, /決めずに返した論点は引き継ぎファイルの問いとして routing\.md で振り分ける/, '0.2.0: 差し戻さず、モードの規則で推奨で決めるか人に返す');
  assert.match(r, /対応づいた項目の推奨 \(初期選択\) は「対応する」/);
  assert.match(r, /「無視」の横に影響を書く: 要求と画面の見本が食い違ったまま次の UC に入り/);
  assert.match(r, /同じ \(slug, tier, attempt, id\) を指す項目が複数あれば[^\n]*`targets` には 1 回だけ入れる。閉じる決定の要点が項目ごとに違えば、まとめずに両方の決定を並べて載せ、どちらで閉じるか \(または無視\) を人に選ばせる/);
  assert.match(r, /`git status --porcelain --untracked-files=all -- docs\/design` の変わったファイル[^\n]*がすべて、項目のファイルか、報告の「項目の外の変更」に項目との対応付きで載っているか、`docs\/design\/screens\.yaml` \(Story か画面を消す項目があるときだけ\) のどれかに入る/);
  assert.match(r, /のどれかに入る \(入らないファイルがあれば、理由の無い削除も含めて受理せず、下と同じく変更を捨てて止まって報告する\)/);
  assert.match(r, /課題の決定の外の論点を要求担当が選んだもの: 課題・論点・選んだ案・理由/);
  assert.match(read('skills/d2-requirements/SKILL.md'), /と、課題の決定の外の論点を自分が案を選んで反映したもの \(課題・論点・選んだ案・理由/);
  assert.match(row(read(TEMPLATE), /^\| ① 要求 \|/), /`課題の外の論点も決めずに返さない。推奨の案で反映し「仮に決めた反映」に書く`/);
  assert.match(row(read(TEMPLATE), /^\| ① 要求の差分 \(画面部品\) \|/), /「項目の外の変更」/);
  assert.match(read('skills/d2-requirements/SKILL.md'), /課題が想定していない論点 \(課題の決定の外で、反映するのに人の判断が要るもの\) も決めずに返さない。推奨の案で反映し、「仮に決めた反映」に論点・選んだ案・理由を書く/);
  assert.match(read('skills/d2-design/SKILL.md'), /項目のファイルの外を変えたか消したら「\*\*項目の外の変更\*\*」に、ファイルごとにどの項目のための依存か/);
});

test('0.1.35 R3/R21: やり直しの節 (検出・聞く・退避・回す・段ごとの扱い) と、4 か所からの参照。main マージ 3 の status は uc-status で書く', () => {
  const redo = section(SKILL, '### やり直し (main マージ済みの UC に新しい受入基準が付いたとき', '## ② 決定');
  assert.match(redo, /`FB scan` の `uncovered_done` は、`status: done` の UC のうち、シナリオ[^\n]*`checkScenario\.js` の `missing`/);
  assert.match(redo, /受入基準の文面が main マージの時点から変わったもの \(`acceptance_changed: true`/);
  assert.match(redo, /1\. \*\*聞く\*\*: 確認ページで UC ごとに「やり直す \/ 後で」。推奨は「やり直す」/);
  assert.match(redo, /2\. \*\*退避\*\*: 「やり直す」なら main の上で `node runState\.js reopen <リポのルート> <slug> --from scenario --data-file <scan の uncovered_done のその UC の記録 \(missing と acceptance_changed\) の json>`/);
  assert.match(redo, /派遣文に `reopened\.json` の `missing` と `acceptance_changed` を添える/);
  assert.match(redo, /3\. \*\*回す\*\*: 自動選択がやり直し中の UC を次の機能より先に選ぶ/);
  assert.match(redo, /scaffold: 既存の `<slug>\.steps\.ts` は残し、足りない step だけ pending で足す。red は新しい受入基準を実装するティアだけに求め/);
  const a = autoSelect();
  assert.match(a, /`delivered` で `notes\.uncovered_done` に入っていれば「やり直し」の節/);
  assert.match(a, /\| `uc` \| その UC の ④ \(`reopened: true` は「やり直し」の節\) \|/);
  assert.match(read(NEXT_ACTION), /11 次の機能          scan の reopened の先頭/);
  assert.match(a, /`none` は `notes` の `uncovered_done`・`plugin`・`paused` を載せる/, 'uncovered_done は報告に載せる (自動ではやり直さない)');
  const r = section(SKILL, '### 要求の差分', '### やり直し');
  assert.match(r, /\*\*やり直す UC\*\*: 要求担当の反映の後の作業ツリーで `FB scan` を回し、`uncovered_done` の UC ごとに/);
  assert.match(r, /- やり直す UC: 「やり直し」の節の `reopen` を UC ごとに回す/);
  assert.match(deliverSection(), /`node runState\.js uc-status <リポのルート> <slug> done` で `use-cases\.yaml` の該当行を `status: done` にする \(手で編集しない/);
  assert.match(read(RUN_STATE), /archive\/runs\/<uc_slug>\/<ts>\/ {6}# 開き直した UC の前の run \(追跡。runState\.js reopen が移す/);
  assert.match(read('skills/d2-implement/references/scaffold.md'), /やり直し \(派遣文に網羅されていない受入基準が添えてある。0\.1\.35\): 既存の `<slug>\.steps\.ts` の定義は残し/);
  assert.match(read('skills/d2-implement/references/scenario.md'), /やり直し \(派遣文に網羅されていない受入基準が添えてある。0\.1\.35\) では既存の feature を残し/);
  assert.match(read('skills/d2-contract/SKILL.md'), /やり直しで新しい受入基準が添えてあれば、既存の operation の応答・スキーマも直してよい/);
});

test('0.1.35 R1/R2/R11/R12/R13: static は ④ のどこでも回し直さない。static の落ちの戻り先は対象ファイルの書き込み範囲で決める。再開で止まった段の成果物は受理の検査から。integrate の完了条件に static', () => {
  const s = read(SKILL);
  assert.match(s, /\*\*ゲートの回し直し\*\*:[^\n]*\*\*static は回し直さない\*\* \(検査器の決定論的な指摘で、順番や並列に左右されない。④ のどこでも同じ/);
  assert.match(s, /\*\*static の落ちの戻り先\*\* \(tier・integrate の runGates\): 指摘の対象ファイル \(`output_tail`\) の書き込み範囲 \(派遣表\) で決める/);
  assert.match(s, /integrate の範囲 \(`features\/step_definitions\/\*\*`・`features\/support\/\*\*` など\) → integrate の担当に差し戻す \(attempt は上げない\)/);
  assert.match(s, /どの派遣の範囲でもない \(依存の一覧・検査の設定・ワークフローなど\) → main マージ 1 の 2 と同じく、推測で直さず材料を添えて止まる/);
  assert.match(s, /④ の再開では、対象の変更がすべて `runState\.js status` の `next_stage` の派遣の書き込み範囲 \(派遣表\) の中なら、止まった段の成果物なので整理を依頼せず、その段の受理の検査からやり直す \(範囲の外が 1 つでもあれば止まる/);
  assert.match(read('skills/d2-implement/references/integrate.md'), /`node <skills>\/d2-common\/scripts\/runGates\.js --uc <slug> --only static` が exit 0/);
});

test('0.1.35 R18/R19: 承認に head を残し、main マージ 1 の 2 で人がコードを直していれば verify から (全段を作り直してから)。gates.json は常に作り直す。共有の契約の変更でも他 UC の回帰', () => {
  const s = read(SKILL);
  assert.match(s, /`review_approved \{assumption_decisions\[\], assumption_evidence_sha256, gates_result, head\}` を記録する \(`head` は承認した時点の `git rev-parse HEAD`/);
  const d = deliverSection();
  assert.match(d, /最後の `review_approved` の `head` から HEAD までに、実装のフォルダの変更があれば \(`git diff --name-only <head>\.\.HEAD -- apps packages contracts features ':!\*\*\/package\.json' ':!\*\*\/package-lock\.json'` が空でない\)/);
  assert.match(d, /`node runState\.js invalidate <run> verify "<理由>" --from` で verify 以降を退避し、`runGates\.js --uc <slug> --tiers <tiers>` で全段 \(トレースも\) を作り直してから verify からやり直す/);
  assert.match(d, /`head` が無い承認 \(0\.1\.34 まで\) は判定せず、完了報告に「判定できない」と書く/);
  assert.match(d, /古さは比べず、\*\*常に\*\*/);
  assert.match(row(s, /^\| \*\*integrate\*\* \|/), /そうでなくても contract の done の `contract_changes` に他の UC にも効く変更 \(`also_used_by` の付いた own、`other_uc`、`shared`\) があれば、その UC ごとに/);
});

test('0.1.35: 記録だけの課題は troubleshooting の 2 節に (迷ったときの扱いと既知の不具合)。本文から 1 行で参照', () => {
  const t = read('skills/d2-run/references/troubleshooting.md');
  const how = section('skills/d2-run/references/troubleshooting.md', '## 手順書に書いていない扱い (迷ったら)', '## 既知の不具合 (未確認)');
  assert.equal(how.split('\n').filter((l) => /^\| [^-|]/.test(l) && !l.startsWith('| 場面 |')).length, 26);
  // 0.1.36 で足した記録 (試し運転 0.1.35 の S2 の一部・S3〜S5・S7〜S9)
  assert.match(how, /\| 人レビュー \| 検証役の指摘 \(major \/ minor\) が課題ファイルにならない \| 指摘は前提の記録に結びつき、人レビューで「承認 \/ 実装を直す \/ 要求を直す」を選ぶ/);
  assert.match(how, /\| 要求の差分 \| 6 の `docs\/adr\/\[0-9\]\*\.md` をそのまま渡すか、展開して列挙するか \| シェルの展開で列挙して渡す/);
  assert.match(how, /\| 人レビュー \| 全体の承認だけで、個別に答えていない回答任意の前提 \| 未回答として `auto_confirmed`/);
  assert.match(how, /\| main マージ \| squash の本文 \(`prTrailers\.js` の出力\) をファイルにする方法 \| 標準出力を `\.distillery\/logs\/` の下のファイルへリダイレクトし/);
  const bugs = t.slice(t.indexOf('## 既知の不具合 (未確認)'));
  assert.equal(bugs.split('\n').filter((l) => /^\| [^-|]/.test(l) && !l.startsWith('| 事象 |')).length, 5);
  assert.match(bugs, /出たら課題 \(`kind: plugin`\) にする/);
  assert.match(read(SKILL), /手順書に書いていない場面で迷ったら、d2-run の troubleshooting の「手順書に書いていない扱い」を見る/);
});

test('0.1.36 S1: 依存の脆弱性 (osv-scanner) だけの quality の落ちは runGates が通し、advisory を人レビューと完了報告に載せる。CI はそのまま落ちる', () => {
  const t = read(SKILL);
  assert.match(t, /\*\*依存の脆弱性\*\* \(どの段階の runGates でも[^\n]*\): static の quality が依存の脆弱性の指摘 \(osv-scanner\) だけで落ちたときは、runGates が通して job に `advisory` を残す/);
  assert.match(t, /CI は `commands\.quality` をそのまま回すので、main の CI では落ちる/);
  assert.match(t, /1\. 材料: `reports\/gates\.json` \(static の `advisory` があれば依存の脆弱性として載せる\)/);
  assert.match(t, /④ の main マージの後は、[^\n]*依存の脆弱性 \(gates\.json の `advisory`。あれば\)/);
  assert.match(t, /決定・基盤の差分の後は、[^\n]*依存の脆弱性 \(static の gates\.json の `advisory`。あれば\)/);
});

test('0.1.36 S2: as-built の要約役が見つけた課題は下書きにし、asbuilt の派遣の前と差し戻しで古い下書きを退避する', () => {
  const asbuilt = row(read(SKILL), /^\| \*\*asbuilt\*\* \|/);
  assert.match(asbuilt, /`node runState\.js set-aside-asbuilt-drafts <run>` で課題ファイルにしていない要約役の下書き/);
  assert.match(asbuilt, /一覧の下書きのファイルが `<run>\/issues\/` にあり、「下書きにした課題」と「下書きにしなかった行」の件数の合計が `checkAsBuilt\.js` の出力の「課題の行」と同じ/, '報告だけで受理しない。課題の行の取りこぼしを件数で止める');
  const d = read('skills/d2-asbuilt/SKILL.md');
  assert.match(d, /「決めたこと」\(人レビューに載った前提と Verifier の指摘\) と「課題」の issues の表のどちらにも載っていない事柄だけを、\n\s+下書き `<run>\/issues\/<ts>_asbuilt_<slug>\.md` にする/);
  assert.match(d, /front matter: `kind: requirement`/, '人が要求の差分で先に決める');
  assert.match(d, /`source: asbuilt` \(要約役の下書きの印。/, 'ティアの課題と区別して退避する');
  assert.match(d, /下書きを 1 つでも書いたら、2 の抽出をもう一度回し/, '抽出節の課題の表を下書きと揃える');
  assert.match(d, /\| LLM \(このスキル\) \| [^\n]*`<run>\/issues\/<ts>_asbuilt_<slug>\.md`/);
});

test('0.1.36 C: d2-run の本文に版・試し運転の注記を書かない (経緯は CHANGELOG)。旧形式を見分ける版の番号は残す', () => {
  const t = read(SKILL);
  assert.doesNotMatch(t, /実走|ラウンド目/, '試し運転・レビューの注記');
  assert.doesNotMatch(t, /0\.1\.\d+ [A-Z]{1,2}\d/, '版と課題番号の注記 (例: 0.1.35 R3)');
  assert.match(t, /\*\*旧形式の run\*\* \(0\.1\.25 まで。/, '旧形式の判定に使う版は振る舞いなので残す');
});

test('0.1.36 C: 「d2-run が直接読み書きするもの」の表は references/direct-io.md にあり、本文は 1 行で参照する', () => {
  const t = read(SKILL);
  const stub = section(SKILL, '## d2-run が直接読み書きするもの', '## 起動シーケンス');
  assert.match(stub, /\[references\/direct-io\.md\]\(references\/direct-io\.md\)/);
  assert.doesNotMatch(stub, /^\| /m, '表は本文に置かない');
  assert.match(t, /\[\.\.\/d2-common\/references\/dataflow\.yaml\]\(\.\.\/d2-common\/references\/dataflow\.yaml\)/, '正本へのリンクは本文に残す');
  const io = read(DIRECT_IO);
  assert.match(io, /^# d2-run が直接読み書きするもの\n/);
  assert.match(io, /\[\.\.\/\.\.\/d2-common\/references\/dataflow\.yaml\]\(\.\.\/\.\.\/d2-common\/references\/dataflow\.yaml\)/, '移した先からの相対パス');
  assert.match(io, /^\| ④ の段階の進行・確認ページ \|/m);
});

test('0.1.36 C (S6): やり直しの退避は、要求の差分の中なら反映の後の作業ツリーのまま、名指しの起動なら clean な main で回す', () => {
  const redo = section(SKILL, '### やり直し', '## ② 決定');
  assert.match(redo, /要求の差分の中なら、要求担当の反映の後の作業ツリー \(未 commit\) のまま回し、同じ `req: feedback` の commit に入れる。名指しの起動なら clean な main で回し、/);
});

test('0.2.0: 2 つのモード。auto でも要求の承認と人レビューは必ず人に返し、recommend は推奨で承認して記録する。どの起動にも付けられ、config に置かない', () => {
  const t = read(SKILL);
  assert.match(t, /\/distillery2:d2-run \.\.\. mode=auto \| mode=recommend {4}# どの起動にも付けられる。既定 auto/);
  const mode = routingSection('## モード');
  assert.match(mode, /起動の引数 `mode=auto` \(既定\) \/ `mode=recommend`。config には置かない \(③ で作り直されるため\)/);
  assert.match(mode, /`mode_resolved \{mode\}` を記録する/);
  const back = routingSection('## 人に返すとき');
  assert.match(back, /\| 要求の承認 \(①・要求の差分\)・人レビュー \| \*\*必ず人に返す\*\* \| 推奨で承認して記録 \|/);
  assert.match(back, /\| 事実が分からない問い \(`unknown_fact`\) \| 人に返す \| 推奨で仮置きして記録/);
  assert.match(back, /\| 推奨が無い問い \(`recommended: null`\) \| 人に返す \| 進行役が推奨を作って仮置きし記録する/);
  assert.match(back, /\| 戻り道の回数の上限 \(`runState\.js` が exit 3\) \| 人に返す \| 人に返す \|/);
  assert.match(back, /\| 上流への課題 \(`target_step` が requirements \/ decide \/ foundation\) \| 人に返す/);
  // 段の手順の側も同じ規則を書いている
  assert.match(section(SKILL, '## ① 要求', '### 要求の差分'), /auto でも必ず人に返す。recommend は推奨で承認して記録/);
  assert.match(section(SKILL, '### 要求の差分', '### やり直し'), /auto でも必ず人に返す/);
  assert.match(section(SKILL, '## 人レビュー (review 段階)', '## main マージ (deliver 段階)'), /auto でも必ず人に返す。recommend は下の推奨で答えて記録し、最後のまとめに載せる/);
  assert.match(section(SKILL, '## 完了報告', '## 参照'), /`mode=recommend` で起動したときは、どの段でも完了報告の最後に、推奨で決めたものの一覧の確認ページ 1 枚 \(`decisionLog\.js list --root \. --since <起動の時刻> --format md`/);
});

test('0.2.0: 確認ページの問いには ID と推奨がある (推奨の無い確認ページを作らない)。答えは決めたことの記録に残す', () => {
  const back = routingSection('## 人に返すとき');
  assert.match(back, /\*\*推奨の無い確認ページを作らない\*\*/);
  const ids = routingSection('### 確認ページの問いの ID と推奨');
  const rows = ids.split('\n').filter(l => /^\| [^-|]/.test(l) && !l.startsWith('| 問い |'));
  assert.ok(rows.length >= 12, `確認ページの問いが ${rows.length} 行`);
  for (const l of rows) {
    const c = cells(l);
    assert.match(c[1], /^`page:[a-z0-9-]+:/, `ID の形: ${l}`);
    assert.ok(c[2] && c[2].length > 1, `推奨が空: ${l}`);
  }
  for (const id of ['page:requirements:approve', 'page:review:assumption:<tier>:<A-id>', 'page:review:approve', 'page:upstream:<課題>', 'page:limit:<slug>', 'page:review-unavailable:<場所>', 'page:migration:abandon']) {
    assert.ok(ids.includes('`' + id + '`'), `問いの ID ${id}`);
  }
  assert.match(row(ids, /page:review:assumption/), /検証役の verdict が `contradicts` でなければ承認、`contradicts` なら実装を直す/);
  assert.match(ids, /`<D> add \(--run <run> \| --root \.\) --page <ID> --question "<問い>" --answer "<答え>" --by recommended\|human/);
  assert.match(section(SKILL, '## 原則', '## d2-run が直接読み書きするもの'), /どの確認ページの問いにも推奨 \(初期選択\) を書き、推奨で決めたものも人が答えたものも `decisionLog\.js` で記録する/);
});

test('0.2.0: 契約ゲート・結合・検証・人レビューからの戻しは runState.js rewind <run> implementation (回数を数える。上限の exit 3 は人に返す)', () => {
  const t = read(SKILL);
  assert.match(row(t, /^\| \*\*contract-gate\*\* \|/), /落ちたら `runState\.js rewind <run> implementation` で tier に戻し[^\n]*上限の exit 3 は人に返す/);
  assert.match(row(t, /^\| \*\*integrate\*\* \|/), /`rewind <run> implementation` で該当ティアを tier に戻す/);
  assert.match(row(t, /^\| \*\*verify\*\* \|/), /blocker があれば `rewind <run> implementation` で該当ティアを tier に戻す \(回数の上限は rewind が数える\)/);
  assert.match(section(SKILL, '## 人レビュー (review 段階)', '## main マージ (deliver 段階)'), /「実装を直す」が 1 件でもあれば `review_rejected \{rejected_assumptions\}` を記録し、`rewind <run> implementation` で該当ティアを tier に戻す/);
  assert.match(t, /attempt\+\+ は `runState\.js rewind <run> implementation` で行う/);
  const issues = routingSection('## 前のステップの課題');
  assert.match(issues, /契約ゲート・結合・検証・人レビューの「実装を直す」も、同じ `rewind <run> implementation` で戻す \(回数を数えるため\)/);
  assert.match(issues, /\*\*その場で巻き戻す\*\*: `<RS> rewind <run> <戻し先> --issue <下書き> \[--issue <下書き> \.\.\.\] --reason "<題名>"`/);
  assert.match(issues, /巻き戻しも開き直しも写し直しも 3 回まで。超えたら `runState\.js` \/ `resumeAfterUpstream\.js` が exit 3 を返すので、人に返す \(`page:limit:<slug>`\)/);
  assert.match(routingSection('### 課題の消し方'), /機能の中の巻き戻し: 下書きは `issues\/consumed\/` へ移る \(課題ファイルにならない\)/);
  assert.match(read(RUN_STATE), /\| rewound \| 機能の中で前のステップへ巻き戻した。`\{to, stage, attempt, issue, reason, over_limit\?\}`/);
});

test('0.2.0: 縦・横レビューは 7 か所。指摘があれば同じ担当を「反証して直す」で派遣し直し、2 ラウンド目は FAIL か受け入れた high / critical のときだけ 1 回', () => {
  const POINTS = ['requirements', 'decide', 'foundation', 'scenario', 'contract', 'implementation', 'asbuilt'];
  const rp = read('skills/d2-common/references/review-points.md');
  const table = rp.split('## 回し方')[0].split('\n').filter(l => /^\| [^-|]/.test(l) && !l.startsWith('| 場所 |'));
  assert.deepEqual(table.map(l => (cells(l)[0].match(/`([a-z]+)`/) || [])[1]), POINTS, 'review-points.md の場所の表');
  const yaml = rp.slice(rp.indexOf('## 観点の定義'));
  for (const p of POINTS) assert.match(yaml, new RegExp(`^${p}:\\n(  - \\{id: P\\d, .*\\}\\n){1,5}`, 'm'), `${p} の観点が 1〜5 個`);
  const t = read(SKILL);
  for (const p of POINTS) assert.ok(t.includes('`--point ' + p), `SKILL.md が ${p} のレビューを回す`);
  const rev = routingSection('## 縦・横レビュー');
  assert.match(rev, /`node <skills>\/d2-common\/scripts\/reviewStep\.js run --point <場所> --target <対象> \.\.\. --out <置き場> \[--known <課題ファイル> \.\.\.\]` \(Bash の timeout 600000 ms/);
  assert.match(rev, /その場所の担当を \*\*反証して直す\*\* で派遣し直す \(派遣表の「反証して直す」の行。write-set はその場所と同じ/);
  assert.match(rev, /引き継ぎファイルの `refutations` が全件あることを受理で確かめる/);
  assert.match(rev, /2 ラウンド目: `has_fail` か、`high_or_critical` の指摘が `refutations` で `accepted` なら、`--round 2 --previous <round1\.md>` で 1 回だけ回す。指摘が残れば 2 と同じく直させ、もう回さない/);
  assert.match(rev, /exit 4 \(未レビュー\) → 人に返すとき の表/);
  assert.match(rp, /\*\*2 ラウンド目\*\*は 1 回だけ、1 ラウンド目に `FAIL` の観点があるか、反証で `accepted` になった指摘に high \/ critical があるときに回す/);
  assert.match(row(read(TEMPLATE), /^\| 反証して直す \|/), /write-set は元の派遣の行をそのまま貼り、受理の write-set の検査も元の派遣の行で行う/);
  assert.match(wsRow('反証して直す'), /レビューした場所の派遣の行と同じ/);
});

test('0.2.0 / 0.3.0: 自動選択は上流の課題 (要求 → 決定 → 基盤) を先に 1 つだけ選び、次に main マージ済みの UC への課題で開き直す (reopen_targets。上限の exit 3 は人に返す)。上流で止めた機能は消さず、写し直して続ける', () => {
  const a = autoSelect();
  assert.match(a, /\| `requirements-diff` \/ `decide-diff` \/ `foundation-diff` \| ① の「要求の差分」\/ routing\.md「上流の差分」 \|/);
  assert.match(a, /\| `reopen` \| `node runState\.js reopen <リポのルート> <uc> --from <from> --issue <docs\/feedback\/<id>\.md> \.\.\.` を `impl\(<uc>\): reopen` で commit して、その UC の ④ \(exit 3 は人に返す\) \|/);
  assert.match(a, /上流の差分は main を進める。上流で止めた機能は、止めた課題がすべて main から消えたら \(反映か取り下げ\) 新しい main の上に写し直して続ける \(`resume`\)/);
  const head = read(NEXT_ACTION).split('*/')[0];
  assert.match(head, /要求の課題か既存の持ち越し → requirements-diff、決定 → decide-diff、基盤 → foundation-diff/);
  const up = routingSection('## 上流の差分');
  assert.match(up, /自動選択が `FB scan` の `upstream` で選ぶ \(要求 → 決定 → 基盤の順に 1 つ\)/);
  const issues = routingSection('## 前のステップの課題');
  assert.match(issues, /\| requirements \/ decide \/ foundation \| \*\*機能を止める\*\*: 下書きを「上流で止めるとき」の手順で課題ファイルにして main に入れ、`blocked_on_upstream \{issues\}` を記録して feature に commit する \(feature は消さない。上流の差分の後に写し直す\) \| 課題ファイルのまま。自動選択が上流の差分を選ぶ \|/);
  assert.match(issues, /\| scenario \/ contract \/ implementation \| \*\*その場で巻き戻す\*\*[^\n]*\| 課題ファイルのまま残す。次の起動の自動選択が `reopen_targets` で開き直す \|/);
  const resume = routingSection('## 写し直し');
  assert.match(resume, /`node <skills>\/d2-common\/scripts\/resumeAfterUpstream\.js run <root> <slug> --co-author "<attribution の値>"`/);
  assert.match(resume, /`node <skills>\/d2-common\/scripts\/resumeAfterUpstream\.js check-diffs <run> --handoff <その担当の引き継ぎファイル> --stage <scenario\|contract\|tier\|integrate> \[--tier <tier>\]` が exit 0/);
  assert.match(resume, /verify の派遣の前に、差分を渡したすべての担当の引き継ぎファイルを `--handoff` で並べて `--stage` なしで回し/);
  assert.match(resume, /「写し直しで取り下げた変更」/);
  for (const rel of [SKILL, ROUTING, DELIVERY]) assert.doesNotMatch(read(rel), /`git update-ref refs\/distillery2\/abandoned/, `${rel} が上流で止めた feature を捨てていない`);
  const del = section(DELIVERY, '## 写し直し', null);
  assert.match(del, /merge commit も rebase も使わない/);
  assert.match(del, /`refs\/distillery2\/paused\/<slug>\/<ts>`/);
});

test('0.3.0: 上流の差分は一時の branch upstream/<課題> で行い、段ごとの commit の後に作業ツリーが空かを確かめ、確定してから main を ff で進める。途中で止まったら同じ branch で最初から回し直す', () => {
  const b = routingSection('### 上流の差分の branch');
  assert.match(b, /`git switch -c upstream\/<1 件目の課題の名前> main`/);
  assert.match(b, /`git status --porcelain --untracked-files=all` を見る。[^\n]*write-set の中なら追加の commit に入れ \(`--amend` はしない\)、外なら止まって報告する/);
  assert.match(b, /`git switch main` → `git merge --ff-only upstream\/<名前>` → `git branch -d upstream\/<名前>` → remote `origin` があれば `git push origin main` と `git push origin \'refs\/distillery2\/\*:refs\/distillery2\/\*\'`。ff できなければ[^\n]*止まって報告する/);
  assert.match(b, /自動選択が `continue-upstream` を返す。その branch に切り替え、同じ差分を最初の手順から回し直す/);
  assert.match(section(SKILL, '### 要求の差分', '## ② 決定'), /routing\.md「上流の差分の branch」の 1 で一時の branch を切る/);
  assert.match(routingSection('### 決定の差分'), /`git add -A -- docs \.distillery \.dependency-cruiser\.cjs` → `decide: feedback` で commit/, 'アーキテストも commit に入れる (main が汚れない)');
});

test('0.3.0: 機能の最初の点検 (precheck) を branch を切る前に main の上で行い、上流の課題があれば一時の branch に課題を入れて上流の差分へ。担当は読むだけで引き継ぎファイルは git 管理外', () => {
  const p = routingSection('## 機能の最初の点検');
  assert.match(p, /sub `d2-implement mode=precheck` を\*\*同じメッセージで並列派遣\*\*する \(派遣表「④ precheck」。`\{handoff\}` は `\.distillery\/logs\/precheck-<slug>\/<tier>\.handoff\.json`\)/);
  assert.match(p, /`git status --porcelain` が派遣の前と同じ \(追跡ファイルを書いていない\)/);
  assert.match(p, /上流の課題が 0 件なら ④ の branch を切って run を開き、2 の問いを記録してから/);
  assert.match(p, /`upstream\/<1 件目の課題の id>` を切り[^\n]*`<H> file-drafts <写し> --root \.`[\s\S]*`precheck\(<slug>\): issues` で commit/);
  assert.match(read(SKILL), /新しい UC は branch を切る前に機能の最初の点検 \(routing\.md「機能の最初の点検」\) を行い/);
  const pre = read('skills/d2-implement/references/precheck.md');
  assert.match(pre, /\*\*1 件見つけたら、残りもすべて洗い出して同じファイルに書く\*\*/);
  assert.match(pre, /戻し先は `requirements` \/ `decide` \/ `foundation` と、distillery2 の側の不具合の `plugin` \(8\) だけ/);
  assert.match(row(read(TEMPLATE), /^\| ④ precheck \(ティアごと並列\) \|/), /`distillery2:d2-implement` `mode=precheck uc=<slug> tier=<tier>`/);
});

test('0.3.0: 担当は課題のファイルを直接書かず、上流の課題は残りの段の分まで洗い出して引き継ぎファイルに書く。起票は重ねず、まだ通っていない段への課題は巻き戻さない', () => {
  const h = read('skills/d2-common/references/handoff.md');
  assert.match(h, /\*\*上流の課題 \(戻し先 requirements \/ decide \/ foundation\) を 1 件書いたら、この UC の残りの段 \(契約・各ティア・結合\) で要る上流の決めごとも洗い出して、すべて同じファイルに書く\*\*/);
  assert.match(h, /課題のファイル \(`<run>\/issues\/`・`docs\/feedback\/`\) を直接書かない/);
  assert.match(h, /`resume_diffs` に扱いを書く/);
  for (const rel of ['skills/d2-implement/references/tier-impl.md', 'skills/d2-implement/references/scenario.md', 'skills/d2-implement/references/gates.md', 'skills/d2-implement/SKILL.md']) {
    assert.doesNotMatch(read(rel), /`issues\/`|issues\/<ts>/, `${rel} が課題のファイルを直接書かせていない`);
  }
  const issues = routingSection('## 前のステップの課題');
  assert.match(issues, /戻し先と題名が同じ既存の下書き・その場で直した下書き・課題ファイルがあれば書かない \(結果の `duplicates`\)/);
  assert.match(issues, /`--chain-from <直している課題ファイル>`/);
  assert.match(issues, /戻し先がまだ done でない段なら巻き戻さずに `deferred: true` を返す \(回数に数えない\)/);
  assert.match(issues, /`items` の課題ごとの戻し先 \(`target_step`\) の段の派遣文に課題ファイルの絶対パスを添える/);
});

test('0.3.0: recommend で人に返すのは戻り道の上限とプラグインの不具合だけ。推奨の無い問い・needs_info は進行役が推奨を作って仮置き、ゲートの再失敗は巻き戻し。止める前のレビューの指摘と決めたこと (D<n>) が消えない', () => {
  const back = routingSection('## 人に返すとき');
  assert.match(back, /`mode=recommend` で人に返すのは、戻り道の上限とリポの中で回避できないプラグインの不具合だけ/);
  assert.match(back, /\| レビューの反証で `needs_info` が残った \| 人に返す \| 進行役が推奨を作って仮置きし記録する/);
  assert.match(back, /\| ゲートが 2 回落ちた・受理の検査に落ちた \(再派遣で直らない\) \| 人に返す \| 機能の中なら `<RS> rewind <run> implementation` \(回数に数える。上限で人へ\)/);
  assert.match(back, /\| プラグインの不具合 [^\n]*\| リポの中で回避した \(`workaround` がある\) なら止めずに報告。回避できないなら人に返す \|/);
  // 0.3.0: 回避したプラグインの課題では止めない。止まるのは scan の plugin_blocking が残るときだけ
  const pl = routingSection('### プラグインの不具合');
  assert.match(pl, /\*\*回避した \(`workaround` がある\)\*\*: 止めない/);
  assert.match(pl, /`plugin_blocking`/);
  const pre = routingSection('## 機能の最初の点検');
  assert.match(pre, /回避していないプラグインの課題 \(`FB scan` の `plugin_blocking`\)/);
  assert.match(pre, /4 の `file-drafts` に `--skip-noted` を付け、機能の中でする回避 \(`workaround`\) の課題は課題ファイルにしない/);
  // 回避した課題だけの点検: 点検の記録を消す前に run の下書きにする (消してから写すと入力が無い)
  // 点検は読むだけなので、回避は機能の中の段がする。回避できなければその段が workaround 無しで返して止まる
  assert.match(pre, /回避は機能の中でする: 下書きの絶対パスを、回避の仕方に合う段の派遣文に添える[^\n]*「回避できない: 」で始まる題名の課題を `workaround` 無しで返す/);
  // 回避できない課題だけ: upstream の branch を切らず main の上で課題ファイルにする (4 を参照しない)
  assert.match(pre, /回避できないもの \(`issues\.plugin`\) があれば、\*\*main の上で\*\* \(upstream の branch を切らずに\)/);
  const doc = (p) => require('node:fs').readFileSync(require('node:path').join(__dirname, '../../../plugins/distillery2/skills', p), 'utf8');
  assert.match(doc('d2-implement/references/precheck.md'), /点検は読むだけなので回避はしない。機能の中で、その下書きを渡された段の担当が回避する/);
  assert.match(doc('d2-common/references/handoff.md'), /読むだけの点検 \(mode=precheck\) では回避をまだしないので、機能の中ですることになる回避の仕方を `workaround` に書く/);
  assert.match(pre, /\*\*`\.distillery\/logs\/precheck-<slug>\/` を消す前に\*\*各ティアの引き継ぎファイルを `<H> file-drafts \.distillery\/logs\/precheck-<slug>\/<tier>\.handoff\.json --run <run>` で下書きにしてから消して続ける/);
  const h = routingSection('## 引き継ぎファイルの処理');
  assert.match(h, /`<H> validate <handoff> --report <そのファイル>` が exit 0/);
  assert.match(h, /`make_recommendation\[\]` \(recommend だけ\)[^\n]*--by recommended --provisional/);
  assert.match(h, /`<D> add \(--run <run> \| --root \.\) --handoff <handoff> --decision D<n> --by recommended`/);
  const up = routingSection('### 上流で止めるとき');
  assert.match(up, /0\. 止める前に、反証して直すを派遣していないレビューの結果[^\n]*`<H> file-drafts <round<k>\.md> --review --target <場所の段> --run <run>`/);
  const plugin = routingSection('### プラグインの不具合');
  assert.match(plugin, /`FB reclassify <issue> --reason-file <ファイル> \[--workaround-file <回避の仕方のファイル>\] --co-author "<attribution の値>"`/);
  assert.match(plugin, /`\{"id": "<課題>", "target": "plugin"\}`/);
  assert.match(routingSection('## 縦・横レビュー'), /1 ラウンド目で決め済み[^\n]*と振り替え済み[^\n]*の指摘は、2 ラウンド目の反証に回さない/);
  assert.match(read(TEMPLATE), /報告の「決めたこと」の見出しの下に 1 行ずつ `D<n> <要点>` で書き、引き継ぎファイルの `decisions` にも同じ `D<n>` で書いてください/);
});

test('0.3.0: レビューの置き場は <場所>/<n>/、実装のレビューはティアごとに順に、反証して直す派遣の引数は場所ごと (UC がある契約に skeleton を使わない)。小さい直し (前提の記録の引数・層を固定しない雛形・控えの ref の push・戻し先の選び方)', () => {
  const rp = read('skills/d2-common/references/review-points.md');
  assert.match(rp, /`<場所の置き場>\/<n>\/round<k>\.md` に書く \(1 ラウンド目は新しい `<n>`、2 ラウンド目は同じ `<n>`/);
  assert.match(rp, /ティアごとに 1 依頼を\*\*順に\*\*回す/);
  assert.match(rp, /\| 基盤 \| 契約 \(`contracts\/uc-index\.yaml` に UC がある\) \| \*\*`d2-contract mode=uc uc=<その operation を持つ UC>`\*\* \(skeleton は使わない\)/);
  assert.match(rp, /\[--known <課題ファイル> \.\.\.\]/);
  assert.match(read('skills/d2-contract/SKILL.md'), /`contracts\/uc-index\.yaml` に UC が既にある[^\n]*既存の UC の operation と、その分割ファイル[^\n]*を変えない・消さない/);
  const t = read(SKILL);
  assert.match(t, /`node <skills>\/d2-implement\/scripts\/validateAssumptions\.js record <run>\/attempt-<n>\/assumptions\.<tier>\.yaml --uc <slug> --tier <tier> --attempt <n>`/);
  assert.match(t, /\| `push` \| `git push origin main` → `git push origin 'refs\/distillery2\/\*:refs\/distillery2\/\*'`/);
  assert.doesNotMatch(read('skills/d2-foundation/references/rule-templates/tier-backend.md'), /5 層/, '層は ADR が決める');
  assert.match(read('skills/d2-implement/SKILL.md'), /\| 技術の方針 [^\n]*\| `decide` \|\n\| 決定はあるが[^\n]*\| `foundation` \|/);
});

test('0.3.0: ADR の決定の領域に DDD の戦術設計・イミュータブルデータモデル・エラーハンドリング・ログのルール・機械チェックを足し、機械チェックの ADR から一括チェックと hook を生成する (6 観点)', () => {
  const req = read('skills/d2-decide/references/required-decisions.md');
  for (const [n, name, file] of [[10, 'DDD の戦術設計', 'ddd-tactical.md'], [11, 'イミュータブルデータモデル', 'immutable-data.md'], [12, 'エラーハンドリング', 'error-handling.md'], [13, 'ログのルール', 'logging.md'], [14, '機械チェック', 'machine-checks.md']]) {
    assert.match(req, new RegExp(`\\| ${n} \\| ${name} \\| [a-z]+ \\| \\[${file.replace('.', '\\.')}\\]`));
    assert.ok(fs.existsSync(path.join(PLUGIN, 'skills/d2-decide/references/decision-candidates', file)), file);
    assert.ok(read('skills/d2-decide/SKILL.md').includes(`decision-candidates/${file}`), `SKILL の表に ${file}`);
  }
  const mc = read('skills/d2-decide/references/decision-candidates/machine-checks.md');
  for (const a of ['generate', 'format', 'lint', 'build', 'test', 'security']) assert.match(mc, new RegExp(`\\| ${a} `), a);
  assert.match(read('skills/d2-foundation/SKILL.md'), /\| F5 \| [^\n]*`genCheck\.js`[^\n]*`scripts\/check\.mjs`、`\.githooks\/\*\*`/);
  assert.match(read('skills/d2-foundation/references/ci.md'), /`node scripts\/check\.mjs --mode ci` を回す 1 本の job/);
  assert.match(read(SKILL), /`node <skills>\/d2-foundation\/scripts\/genCheck\.js --cwd \. --check` が exit 0 で、`git config core\.hooksPath` が `\.githooks`/);
});
