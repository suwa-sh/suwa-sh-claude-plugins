#!/usr/bin/env node
/**
 * feedbackBatch.js — 課題ファイル (docs/feedback/) の扱いと、0.1.x の還流のバッチの片付け
 *
 * 0.2.0 で還流 (溜まった課題をまとめて直す段階) を外した。ルール・契約の課題は target_step の戻し先で直す (scan の upstream・reopen_targets)。
 * 0.1.x で作ったリポには途中で止まったバッチが残ることがあるので、見つける (status・scan の batch) と片付ける (merge・abandon) だけを残す。
 * バッチの名前: <b> (YYYYMMDD-HHMMSS)、branch feedback/<b>、worktree .distillery/worktrees/feedback、状態 .distillery/logs/feedback/<b>/ (batch.json ほか)。
 * branch の最後の commit が feedback(<b>): regenerate なら仕上げ済み (status は main への取り込みの有無で cleanup かそれ以外かを決める)。
 *
 * CLI (すべて --cwd <repo> を取る。既定はカレント。結果は JSON 1 行):
 *   file-issues <runDir>        UC の課題 (issues/*.md) のうち課題ファイルにしていないものを docs/feedback/ に書き、feedback_filed を記録
 *   scan                        自動選択の材料: 要求の課題・戻し先ごとの課題 (upstream・reopen_targets)・止まった課題・未起票の run・途中のバッチ (batch。feedback_due は途中のバッチがあること) ほか
 *   hold <issue> --reason-file <f>   要求の差分の確認ページで外して残す課題に止まった印を付ける (main の作業ツリーで書き換えるだけ。commit は d2-run)
 *   reclassify <issue> --reason-file <f> [--co-author <値>]   直す場所がプラグイン側の課題を kind: plugin に書き換え、今の branch に commit (決定の差分で使う)
 *   status                      途中のバッチの地点 (none | issues | gate | rebuild | merge | cleanup | broken)
 *   merge                       main へ取り込み済み (cleanup) のバッチの push と後始末。それ以外の地点は拒む (abandon を使う)
 *   abandon                     main へ取り込む前のバッチを捨てる。対象の課題ファイルがすべて main に残っていることを確かめてから worktree・branch・状態を消す
 *
 * 終了コード: 0 成功 / 1 失敗 (理由は JSON の error) / 2 使い方の誤り / 4 push の拒否
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { parseYaml, stringifyYaml } = require('./lib/yaml');
const runState = require('./lib/runState');

// スキル群のルート (skills/)。兄弟スキルのスクリプトを相対で指す (プラグインでも ~/.agents/skills/ の平置きでも同じ関係。0.1.29)
const SKILLS_ROOT = path.resolve(__dirname, '..', '..');
const WT_REL = path.join('.distillery', 'worktrees', 'feedback');
const LOG_REL = path.join('.distillery', 'logs', 'feedback');
const FEEDBACK_REL = path.join('docs', 'feedback');
const DIFF_MAX_LINES = 200;

class Fail extends Error {
  constructor(message, code = 1, extra = {}) { super(message); this.code = code; this.extra = extra; }
}

// ---- git ----

function git(cwd, args, opts = {}) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0 && !opts.allowFail) throw new Fail(`git ${args.join(' ')} が失敗した: ${(r.stderr || r.stdout || '').trim()}`);
  return opts.allowFail ? { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } : (r.stdout || '').trim();
}

function gitOk(cwd, args) { return git(cwd, args, { allowFail: true }).ok; }
function revParse(cwd, ref) { const r = git(cwd, ['rev-parse', '--verify', '-q', `${ref}^{commit}`], { allowFail: true }); return r.ok ? r.out : null; }
function isAncestor(cwd, a, b) { return gitOk(cwd, ['merge-base', '--is-ancestor', a, b]); }
function hasOrigin(cwd) { return gitOk(cwd, ['remote', 'get-url', 'origin']); }
function currentBranch(cwd) { return git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']); }
function subjectOf(cwd, ref) { return git(cwd, ['log', '-1', '--format=%s', ref]); }

/** porcelain の行 (`XY path`)。-z で区切り、rename の元パスは捨てる */
function statusEntries(cwd) {
  const out = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd, encoding: 'utf8' });
  const parts = out.split('\0').filter(Boolean);
  const entries = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const xy = p.slice(0, 2);
    entries.push({ xy, path: p.slice(3) });
    if (xy[0] === 'R' || xy[0] === 'C') i++;
  }
  return entries;
}


// ---- 課題ファイル ----

function splitFrontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: text };
  return { fm: parseYaml(m[1]) || {}, body: m[2] };
}

function joinFrontMatter(fm, body) { return `---\n${stringifyYaml(fm).trimEnd()}\n---\n${body.startsWith('\n') ? body : `\n${body}`}`; }

// 戻し先のステップ (0.2.0)。target_step が無い古い課題は kind から読む (plugin は戻し先なし)
const TARGET_STEPS = ['requirements', 'decide', 'foundation', 'scenario', 'contract', 'implementation'];
const TARGET_OF_KIND = { requirement: 'requirements', rule: 'decide', contract: 'contract', foundation: 'foundation', scenario: 'scenario', implementation: 'implementation' };
function targetOf(fm) {
  if (fm.kind === 'plugin') return null;
  if (fm.target_step != null) return String(fm.target_step);
  return TARGET_OF_KIND[fm.kind] || null;
}

function listFeedback(dir) {
  const d = path.join(dir, FEEDBACK_REL);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => f.endsWith('.md') && f !== 'README.md').sort().map((f) => {
    const { fm } = splitFrontMatter(fs.readFileSync(path.join(d, f), 'utf8'));
    return { id: f.replace(/\.md$/, ''), kind: fm.kind || null, target_step: targetOf(fm), title: fm.title || '', from_uc: fm.from_uc || null, created: fm.created || '', stopped: Boolean(fm.stopped), stopped_count: Number(fm.stopped_count || 0) };
  });
}

function feedbackPath(dir, id) { return path.join(dir, FEEDBACK_REL, `${id}.md`); }

// ---- バッチの場所と状態 ----

function ctxOf(cwd) {
  const root = path.resolve(cwd);
  const wt = path.join(root, WT_REL);
  const branches = git(root, ['for-each-ref', '--format=%(refname:short)', 'refs/heads/feedback/']).split('\n').filter(Boolean);
  if (branches.length > 1) throw new Fail(`還流 branch が複数ある: ${branches.join(', ')}`);
  const branch = branches[0] || null;
  const batch = branch ? branch.replace(/^feedback\//, '') : null;
  const fb = batch ? path.join(root, LOG_REL, batch) : null;
  return { root, wt, branch, batch, fb };
}

function readJson(p, dflt = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return dflt; } }
function readState(ctx, id) { return readJson(path.join(ctx.fb, `${id}.state`)); }

/** branch の中の課題の commit (main から先端まで、subject が `feedback(<b>): rule|contract <id>`) */
function issueCommits(ctx, base = 'main') {
  const out = git(ctx.root, ['log', '--reverse', '--format=%H%x09%s', `${base}..${ctx.branch}`]);
  const re = new RegExp(`^feedback\\(${ctx.batch}\\): (rule|contract|plugin) (.+)$`);
  return out.split('\n').filter(Boolean).map((l) => { const [sha, s] = l.split('\t'); const m = s.match(re); return m ? { sha, kind: m[1], id: m[2] } : null; }).filter(Boolean);
}

/** main との merge-base から branch の先端までで contracts/generated/slices/<slug>/** が変わった UC (0.1.30 L7。最後のゲートで回す UC の一覧) */
function slicesChanged(ctx, base = 'main') {
  const mb = git(ctx.root, ['merge-base', base, ctx.branch], { allowFail: true });
  if (!mb.ok) return [];
  const files = git(ctx.root, ['diff', '--name-only', mb.out, ctx.branch, '--', 'contracts/generated/slices']).split('\n').filter(Boolean);
  return [...new Set(files.map((f) => f.split('/')[3]).filter(Boolean))].sort();
}

function requireCleanTracked(dir, what) {
  const dirty = statusEntries(dir).filter((e) => e.xy !== '??');
  if (dirty.length) throw new Fail(`${what} に未 commit の変更がある: ${dirty.map((e) => e.path).join(', ')}`);
}


// ---- サブコマンド ----

function cmdFileIssues(root, runDirArg) {
  if (!runDirArg) throw new Fail('file-issues <runDir>', 2);
  const runDir = path.resolve(root, runDirArg);
  const slug = path.basename(runDir);
  const filed = [];
  for (const key of runState.unfiledIssues(runDir)) {
    const src = path.join(runDir, key);
    const { fm, body } = splitFrontMatter(fs.readFileSync(src, 'utf8'));
    const id = path.basename(key, '.md');
    const dest = feedbackPath(root, id);
    if (fs.existsSync(dest)) {
      const cur = splitFrontMatter(fs.readFileSync(dest, 'utf8')).fm;
      if ((cur.from_uc || null) !== slug) throw new Fail(`課題ファイルの名前が別の UC の課題と重なる: ${path.relative(root, dest)}`);
    } else {
      const target = targetOf(fm);
      if (fm.target_step != null && !TARGET_STEPS.includes(String(fm.target_step))) throw new Fail(`課題の target_step が不正: ${key} (${fm.target_step})`);
      const out = { kind: fm.kind || null, title: fm.title || id, from_uc: slug, status: 'open', created: new Date().toISOString().replace(/\.\d+Z$/, 'Z') };
      if (target) out.target_step = target;
      if (fm.tier) out.tier = fm.tier;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, joinFrontMatter(out, body));
    }
    const ref = path.join(FEEDBACK_REL, `${id}.md`).split(path.sep).join('/');
    runState.appendEvent(runDir, 'feedback_filed', { kind: fm.kind || null, ref, issue_path: key });
    filed.push(ref);
  }
  return { filed };
}

function batchStatus(root) {
  const ctx = ctxOf(root);
  if (!ctx.branch) return { point: fs.existsSync(ctx.wt) ? 'broken' : 'none', ...(fs.existsSync(ctx.wt) ? { error: `worktree だけがあり branch が無い: ${WT_REL}` } : {}) };
  const batch = readJson(path.join(ctx.fb, 'batch.json'));
  const head = revParse(root, ctx.branch);
  const base = { batch: ctx.batch, branch: ctx.branch, worktree: WT_REL, head };
  if (!batch) return { ...base, point: 'broken', error: `batch.json が無い: ${path.relative(root, ctx.fb)}` };
  const generated = subjectOf(root, ctx.branch) === `feedback(${ctx.batch}): regenerate`;
  // 取り込み済み (生成物の commit が main に入った) なら worktree が無くても後始末へ進める。それ以外で worktree が無いのは壊れた状態
  if (!fs.existsSync(ctx.wt) && !(generated && isAncestor(root, ctx.branch, 'main'))) return { ...base, point: 'broken', error: `branch だけがあり worktree が無い: ${WT_REL}` };
  const gate = readJson(path.join(ctx.fb, 'gate.json'));
  const decision = readJson(path.join(ctx.fb, 'decision.json'));
  if (generated) {
    base.slices_changed = slicesChanged(ctx);
    // 取り込み済み (push の拒否の後の再開など) でも、報告に使えるようにゲートの記録と回答を返す (0.1.27 実走 K19)
    if (isAncestor(root, ctx.branch, 'main')) return { ...base, point: 'cleanup', gate, decision };
    const gateOk = Boolean(gate && gate.result === 'pass' && gate.sha === head);
    const changes = Boolean(decision && ((decision.drop || []).length || (decision.dismiss || []).length));
    if (decision && changes && !decision.applied) return { ...base, point: 'rebuild', decision };
    if (gateOk && decision) return { ...base, point: 'merge', gate, decision };
    return { ...base, point: 'gate', gate, decision, confirm: Boolean(gate && gate.sha === head && gate.result === 'fail' && !decision) };
  }
  const commits = issueCommits(ctx);
  const done = [];
  const pending = [];
  const needsStatic = [];
  for (const it of batch.issues) {
    const st = readState(ctx, it.id);
    const c = commits.find((x) => x.id === it.id);
    // plugin の commit があれば state が無くても済み (status は読むだけで書かない。0.2.0)
    if (c && c.kind === 'plugin') done.push(it.id);
    else if (st && (st.status === 'stopped' || st.status === 'already-applied' || st.status === 'reclassified')) done.push(it.id);
    else if (st && st.status === 'passed' && c && st.sha === c.sha) done.push(it.id);
    else if (c) needsStatic.push(it.id);
    else pending.push(it.id);
  }
  const dirty = fs.existsSync(ctx.wt) ? statusEntries(ctx.wt).length > 0 : false;
  return { ...base, point: 'issues', done, pending, needs_static: needsStatic, worktree_dirty: dirty };
}

function cmdScan(root) {
  const all = listFeedback(root);
  // 止まった課題は要求の差分のきっかけにしない (起動のたびに同じ課題で戻り、UC へ進めなくなる)。ほかの課題で回すときに一緒に読む
  const requirement = all.filter((x) => x.kind === 'requirement' && !x.stopped).map((x) => x.id);
  const requirementAll = all.filter((x) => x.kind === 'requirement').map((x) => x.id);
  const triggers = all.filter((x) => (x.kind === 'rule' || x.kind === 'contract') && !x.stopped).map((x) => x.id);
  const stopped = all.filter((x) => (x.kind === 'rule' || x.kind === 'contract') && x.stopped).map((x) => ({ id: x.id, stopped_count: x.stopped_count }));
  // プラグインへ持ち帰る課題は還流の対象でない (報告用に返すだけ。きっかけにしない)
  const plugin = all.filter((x) => x.kind === 'plugin').map((x) => x.id);
  const runsDir = path.join(root, '.distillery', 'runs');
  const unfiledRuns = [];
  const legacyRuns = [];
  const carryOverPending = [];
  if (fs.existsSync(runsDir)) {
    for (const slug of fs.readdirSync(runsDir).sort()) {
      const rd = path.join(runsDir, slug);
      if (!fs.statSync(rd).isDirectory()) continue;
      const run = path.relative(root, rd).split(path.sep).join('/');
      // 旧形式 (0.1.25 までの順) の run。main マージの done の有無で除外しない (片付けの途中で止まった run も拾う。0.1.32 N7/O7)
      if (runState.isLegacyOrder(rd)) legacyRuns.push({ run, slug });
      const carry = carryOverPendingOf(rd);
      if (carry) carryOverPending.push({ run, slug, items: carry });
      if (!runState.isDone(rd, 'deliver')) continue;
      const unfiled = runState.unfiledIssues(rd);
      if (unfiled.length) unfiledRuns.push({ run, unfiled });
    }
  }
  // 0.2.0 の振り分け: 上流の課題は戻し先ごと、main マージ済みの UC への課題は開き直す段ごと (止まった課題も含む)
  const upstream = { requirements: [], decide: [], foundation: [] };
  const reopenBy = new Map();
  const order = ['scenario', 'contract', 'implementation'];
  for (const x of all) {
    if (upstream[x.target_step]) { upstream[x.target_step].push(x.id); continue; }
    if (!order.includes(x.target_step) || !x.from_uc) continue;
    if (!runState.isDone(runState.runDirOf(root, x.from_uc), 'deliver')) continue;
    const cur = reopenBy.get(x.from_uc) || { uc: x.from_uc, from: x.target_step, issues: [] };
    if (order.indexOf(x.target_step) < order.indexOf(cur.from)) cur.from = x.target_step;
    cur.issues.push(x.id);
    reopenBy.set(x.from_uc, cur);
  }
  const batch = batchStatus(root);
  // 0.2.0: 還流は無い。feedback_due は 0.1.x の途中で止まったバッチがあること (片付けが要る) だけを表す。triggers・stopped は互換のため残す
  const feedbackDue = batch.point !== 'none';
  return { requirement, requirement_all: requirementAll, triggers, stopped, plugin, unfiled_runs: unfiledRuns, legacy_runs: legacyRuns, carry_over_rows: carryOverRows(root), carry_over_pending: carryOverPending, uncovered_done: uncoveredDone(root), reopened: runState.reopenedSlugs(root), batch, feedback_due: feedbackDue, upstream, reopen_targets: [...reopenBy.values()] };
}

/** features/ 配下 (features/acceptance/ を除く) の <slug>.feature を探す。無ければ null、複数なら配列のまま返す */
function findFeature(root, slug) {
  const base = path.join(root, 'features');
  const hits = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (path.relative(base, p) !== 'acceptance' && e.name !== 'node_modules') walk(p); }
      else if (e.name === `${slug}.feature`) hits.push(path.relative(root, p).split(path.sep).join('/'));
    }
  };
  if (fs.existsSync(base)) walk(base);
  return hits;
}

/**
 * main マージ済み (status: done) の UC のうち、シナリオが UC の仕様の受入基準を網羅しないもの (0.1.35 R3)。
 * 要求の差分で main マージ済みの UC に新しい仕様が付いたときに出る。checkScenario.js (d2-implement) の missing をそのまま使う。
 * 網羅していれば入れない。feature が見つからない・checkScenario が missing 以外の理由で落ちた UC は error 付きで入れる (黙って落とさない)。
 * 受入基準の文面だけが変わった UC は、main マージの done の acceptance_sha256 (0.1.35 から記録) と今の指紋が違えば acceptance_changed: true で入れる。
 * 0.1.34 までに main マージした UC は指紋が無いので、番号が増えたときだけ出る
 */
function uncoveredDone(root) {
  const ucFile = path.join(root, 'docs', 'requirements', 'use-cases.yaml');
  const reqFile = path.join(root, 'docs', 'requirements', 'requirements.yaml');
  if (!fs.existsSync(ucFile) || !fs.existsSync(reqFile)) return [];
  let doc;
  try { doc = parseYaml(fs.readFileSync(ucFile, 'utf8')); } catch { return []; }
  const script = path.join(SKILLS_ROOT, 'd2-implement', 'scripts', 'checkScenario.js');
  const out = [];
  for (const uc of (doc && Array.isArray(doc.use_cases)) ? doc.use_cases : []) {
    if (!uc || uc.status !== 'done' || !uc.slug) continue;
    const slug = String(uc.slug);
    const features = findFeature(root, slug);
    if (features.length !== 1) { out.push({ slug, feature: features.length ? features : null, missing: null, error: features.length ? 'feature が複数ある' : 'feature が無い' }); continue; }
    const r = spawnSync(process.execPath, [script, features[0], '--use-cases', ucFile, '--requirements', reqFile, '--uc', slug, '--acceptance-dir', path.join(root, 'features', 'acceptance')], { cwd: root, encoding: 'utf8' });
    let res = null;
    try { res = JSON.parse(String(r.stdout || '').trim().split('\n').pop()); } catch { res = null; }
    // 受入基準の文面だけが変わった UC は、main マージの done の指紋 (0.1.35 から) と今の指紋の違いで見つける (番号は網羅していても入れる)
    const deliver = runState.readDone(path.join(root, '.distillery', 'runs', slug), 'deliver');
    const recorded = deliver && deliver.acceptance_sha256;
    const changed = Boolean(recorded) && recorded !== runState.acceptanceSha256(root, slug);
    if (res && res.ok && !changed) continue;
    const missing = res && Array.isArray(res.missing) ? res.missing.map((m) => ({ spec: m.spec, n: m.n, tag: m.tag })) : [];
    const otherErrors = !res || (res.errors && res.errors.length) || (res.unknown_tags && res.unknown_tags.length) || (!res.ok && !missing.length);
    out.push({ slug, feature: features[0], missing, acceptance_changed: changed, ...(otherErrors ? { error: res ? JSON.stringify({ errors: res.errors || [], unknown_tags: res.unknown_tags || [] }) : String(r.stderr || '').trim().slice(0, 400) } : {}) });
  }
  return out;
}

/**
 * 0.1.30〜0.1.31 形式の use-cases.yaml に残った carry_over の行 ({slug, items})。要求の差分が確認ページに載せて宛先へ流す材料
 * (再生成 (genUseCases.js) は carry_over を引き継がないので、要求担当の派遣や再生成の前に scan で控える。差分レビュー 2 ラウンド目)
 */
function carryOverRows(root) {
  const f = path.join(root, 'docs', 'requirements', 'use-cases.yaml');
  if (!fs.existsSync(f)) return [];
  let doc;
  try { doc = parseYaml(fs.readFileSync(f, 'utf8')); } catch { return []; }
  const out = [];
  for (const uc of (doc && Array.isArray(doc.use_cases)) ? doc.use_cases : []) {
    if (uc && Array.isArray(uc.carry_over) && uc.carry_over.length) out.push({ slug: String(uc.slug || ''), items: uc.carry_over.map(String) });
  }
  return out;
}

/**
 * 0.1.30 形式の人レビューが残した持ち越し (最後の review_approved の carry_over.carry) のうち、要求の差分でまだ宛先へ流していないもの
 * (carry_over_migrated が review_approved より後に無い)。無ければ null (0.1.32 J2。持ち越しの仕組みを外した後の移行用)
 */
function carryOverPendingOf(runDir) {
  const events = runState.readEvents(runDir);
  let carry = null;
  for (const e of events) {
    if (e.type === 'review_approved') carry = (e.carry_over && Array.isArray(e.carry_over.carry) && e.carry_over.carry.length) ? e.carry_over.carry.map(String) : null;
    else if (e.type === 'carry_over_migrated') carry = null;
  }
  return carry;
}

function stoppedSection(reason, diffText, count) {
  const lines = diffText ? diffText.replace(/\n$/, '').split('\n') : [];
  const shown = lines.slice(0, DIFF_MAX_LINES);
  const out = [`## 止まった理由`, '', `${count} 回目の還流で止まった。`, '', reason, ''];
  if (lines.length) {
    out.push(`止まったときの差分 (${lines.length} 行${lines.length > DIFF_MAX_LINES ? `。先頭 ${DIFF_MAX_LINES} 行` : ''}):`, '', '```diff', ...shown, '```', '');
  } else {
    out.push('止まったときの差分: なし', '');
  }
  return out.join('\n');
}

/** 課題ファイルに止まった印を書き足す (stopped・stopped_count・題名の接頭辞・本文の先頭の止まった理由。前回の理由は残す) */
function writeStopped(fp, id, reason, diffText) {
  const { fm, body } = splitFrontMatter(fs.readFileSync(fp, 'utf8'));
  const count = Number(fm.stopped_count || 0) + 1;
  const nfm = { ...fm, stopped: true, stopped_count: count };
  if (!String(nfm.title || '').startsWith('止まった: ')) nfm.title = `止まった: ${nfm.title || id}`;
  const prevBody = body.replace(/^\n+/, '').replace(/^## 止まった理由\n/, '## 前回までの止まった理由\n');
  fs.writeFileSync(fp, joinFrontMatter(nfm, `\n${stoppedSection(reason, diffText, count)}\n${prevBody}`));
  return count;
}

function cmdHold(root, id, opts) {
  if (!id || !opts['reason-file']) throw new Fail('hold <issue> --reason-file <f>', 2);
  const fp = feedbackPath(root, id);
  if (!fs.existsSync(fp)) throw new Fail(`課題ファイルが無い: ${path.relative(root, fp)}`);
  const reason = fs.readFileSync(path.resolve(root, opts['reason-file']), 'utf8').trim();
  const count = writeStopped(fp, id, reason, '');
  return { held: id, stopped_count: count };
}

/**
 * 直す場所がプラグイン側 (生成器・テンプレート・手順書) の課題を kind: plugin に書き換え、今の branch に commit する (0.1.28。0.2.0 からバッチを使わず --cwd の作業ツリーで行う)。
 * 戻し先から外れ main に残る。止まった印は外し、止まった理由の本文は残す。commit するのはこの課題ファイルだけ (ほかの staged の変化は混ぜない)
 */
function cmdReclassify(root, id, opts) {
  if (!id || !opts['reason-file']) throw new Fail('reclassify <issue> --reason-file <f> [--co-author <値>]', 2);
  const fp = feedbackPath(root, id);
  if (!fs.existsSync(fp)) throw new Fail(`課題ファイルが無い: ${path.relative(root, fp)}`);
  const reason = fs.readFileSync(path.resolve(root, opts['reason-file']), 'utf8').trim();
  const { fm, body } = splitFrontMatter(fs.readFileSync(fp, 'utf8'));
  if (fm.kind === 'plugin') throw new Fail(`もう kind: plugin の課題: ${id}`);
  const original = fm.kind || null;
  const nfm = { ...fm, kind: 'plugin', kind_original: original };
  delete nfm.stopped;
  delete nfm.stopped_count;
  nfm.title = String(nfm.title || id).replace(/^止まった: /, '');
  const section = ['## プラグインへ持ち帰る理由', '', reason, ''].join('\n');
  fs.writeFileSync(fp, joinFrontMatter(nfm, `\n${section}\n${body.replace(/^\n+/, '')}`));
  const rel = path.relative(root, fp).split(path.sep).join('/');
  git(root, ['add', '--', rel]);
  const lines = [`feedback: plugin ${id}`, '', `Feedback-Reclassified: ${rel}`, 'Feedback-Kind: plugin', `Feedback-Kind-Original: ${original || 'unknown'}`, `Feedback-From-UC: ${fm.from_uc || 'unknown'}`];
  const coAuthor = opts['co-author'] ? String(opts['co-author']).replace(/^Co-Authored-By:\s*/i, '').trim() : null;
  if (coAuthor) lines.push(`Co-Authored-By: ${coAuthor}`);
  const tmpDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'd2-fb-msg-'));
  const msg = path.join(tmpDir, 'msg.txt');
  fs.writeFileSync(msg, `${lines.join('\n')}\n`);
  try { git(root, ['commit', '-q', '-F', msg, '--', rel]); } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
  return { reclassified: id, kind_original: original, sha: revParse(root, 'HEAD'), branch: currentBranch(root) };
}


function cleanupBatch(ctx) {
  if (fs.existsSync(ctx.wt)) git(ctx.root, ['worktree', 'remove', '--force', ctx.wt]);
  else git(ctx.root, ['worktree', 'prune']);
  git(ctx.root, ['branch', '-q', '-d', ctx.branch]);
  git(ctx.root, ['update-ref', '-d', `refs/distillery2/feedback-prev/${ctx.batch}`], { allowFail: true });
  fs.rmSync(ctx.fb, { recursive: true, force: true });
}

function pushMain(root) {
  if (!hasOrigin(root)) return { pushed: false, remote: false };
  const r = git(root, ['push', '-q', 'origin', 'main'], { allowFail: true });
  if (!r.ok) throw new Fail(`main の push が拒否された: ${r.err}。main は取り込み済み。force push はしない (人が remote との合わせ方を決める)`, 4, { merged: true });
  return { pushed: true, remote: true };
}


/** main へ取り込み済み (cleanup) のバッチの push と後始末だけを行う。取り込む前のバッチは abandon で片付ける (0.2.0) */
function cmdMerge(root) {
  const st = batchStatus(root);
  if (st.point !== 'cleanup') throw new Fail(`merge は main へ取り込み済みのバッチ (cleanup) の後始末だけ。0.2.0 から還流のバッチは取り込まない (point: ${st.point})。途中のバッチは abandon で片付ける`);
  const ctx = ctxOf(root);
  if (currentBranch(root) !== 'main') throw new Fail('作業 branch が main でない');
  requireCleanTracked(root, '作業ツリー');
  const push = pushMain(root);
  cleanupBatch(ctx);
  return { merged: true, already: true, head: st.head, ...push };
}

/** 課題ファイルが main に残っているか (main の commit か、main の作業ツリー。file-issues は main の作業ツリーに書くだけで commit しないことがある) */
function inMain(root, id) {
  const rel = `${FEEDBACK_REL.split(path.sep).join('/')}/${id}.md`;
  return gitOk(root, ['cat-file', '-e', `main:${rel}`]) || fs.existsSync(feedbackPath(root, id));
}

/** worktree が自分の作業ツリーとして git に読めるか (.git の結び付きが切れていると親のリポを読んでしまう) */
function ownWorktree(wt) {
  const r = git(wt, ['rev-parse', '--show-toplevel'], { allowFail: true });
  return r.ok && fs.realpathSync(r.out) === fs.realpathSync(wt);
}

/** worktree に未 commit の変化も main より先の commit も無いか */
function wtUntouched(wt) {
  if (!ownWorktree(wt)) return false;
  if (statusEntries(wt).length) return false;
  return git(wt, ['rev-list', '--count', 'main..HEAD']) === '0';
}

/**
 * 0.1.x の途中で止まったバッチ (main へ取り込む前) を片付ける (0.2.0)。
 * 消す前に、バッチの対象の課題ファイルがすべて main に残っていることを確かめる (branch 側の課題の書き換えは捨てる)
 */
function cmdAbandon(root) {
  const st = batchStatus(root);
  if (st.point === 'none') return { abandoned: false };
  if (st.point === 'cleanup') throw new Fail('main へ取り込み済みのバッチ。abandon ではなく merge で push と後始末をする');
  const ctx = ctxOf(root);
  if (!ctx.branch) {
    // worktree だけがあり branch が無い: 何も残っていないときだけ消す
    if (!wtUntouched(ctx.wt)) throw new Fail(`branch の無い worktree に未 commit の変化か main より先の commit がある (または worktree として読めない)。人が中身を確かめる: ${WT_REL}`);
    git(root, ['worktree', 'remove', '--force', ctx.wt]);
    return { abandoned: true, batch: null, removed: { worktree: true, branch: false, state: false } };
  }
  const batch = readJson(path.join(ctx.fb, 'batch.json'));
  if (batch) {
    const missing = (batch.issues || []).map((x) => x.id).filter((id) => !inMain(root, id));
    if (missing.length) throw new Fail(`バッチの課題ファイルが main に無い。消すと課題が失われるので片付けない: ${missing.join(', ')}`, 1, { missing });
  } else {
    // batch.json が無いと対象の課題が分からない: branch に main より先の commit が無く、worktree も手つかずのときだけ消す
    const ahead = git(root, ['rev-list', '--count', `main..${ctx.branch}`]);
    if (ahead !== '0' || (fs.existsSync(ctx.wt) && !wtUntouched(ctx.wt))) throw new Fail(`batch.json が無く、還流 branch か worktree に変化がある。人が中身を確かめる: ${ctx.branch}`);
  }
  const removed = { worktree: fs.existsSync(ctx.wt), branch: true, state: Boolean(ctx.fb && fs.existsSync(ctx.fb)) };
  if (removed.worktree) git(root, ['worktree', 'remove', '--force', ctx.wt]);
  else git(root, ['worktree', 'prune']);
  git(root, ['branch', '-q', '-D', ctx.branch]);
  git(root, ['update-ref', '-d', `refs/distillery2/feedback-prev/${ctx.batch}`], { allowFail: true });
  fs.rmSync(ctx.fb, { recursive: true, force: true });
  return { abandoned: true, batch: ctx.batch, removed };
}

// ---- CLI ----

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (k === 'json') opts[k] = true;
      else opts[k] = argv[++i];
    } else opts._.push(a);
  }
  return opts;
}

function main(argv) {
  // `--cwd <repo> status` と `status --cwd <repo>` のどちらも受け付ける (最初の非オプションがサブコマンド)
  const all = parseArgs(argv);
  const cmd = all._[0];
  const opts = { ...all, _: all._.slice(1) };
  const root = path.resolve(opts.cwd || process.cwd());
  const table = {
    'file-issues': () => cmdFileIssues(root, opts._[0]),
    scan: () => cmdScan(root),
    hold: () => cmdHold(root, opts._[0], opts),
    reclassify: () => cmdReclassify(root, opts._[0], opts),
    status: () => batchStatus(root),
    merge: () => cmdMerge(root),
    abandon: () => cmdAbandon(root),
  };
  if (!table[cmd]) {
    console.error(`Usage: feedbackBatch.js ${Object.keys(table).join('|')} [--cwd <repo>] ...`);
    return 2;
  }
  try {
    console.log(JSON.stringify(table[cmd]()));
    return 0;
  } catch (e) {
    if (!(e instanceof Fail)) throw e;
    console.log(JSON.stringify({ error: e.message, ...e.extra }));
    return e.code;
  }
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { main, batchStatus, cmdScan, splitFrontMatter, WT_REL, LOG_REL };
