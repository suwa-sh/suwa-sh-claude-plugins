#!/usr/bin/env node
/**
 * feedbackBatch.js — 還流 (溜まった課題をまとめて 1 回で直す段階) の git の状態遷移
 *
 * d2-run が回す。派遣・受理の検査・ゲート・確認ページは d2-run が行い、このスクリプトは git と課題ファイルだけを扱う。
 * 名前: バッチ <b> (YYYYMMDD-HHMMSS)、還流 branch feedback/<b>、worktree .distillery/worktrees/feedback、
 *       状態 .distillery/logs/feedback/<b>/ (gitignore: batch.json・<issue>.state・<issue>.failed.diff・gate.json・decision.json)
 *
 * branch の commit の並び (main から):
 *   feedback(<b>): <rule|contract> <issue>   課題ごと。原本と課題ファイルの削除 (trailer Feedback-Consumed)
 *   feedback(<b>): plugin <issue>            課題ごと。直す場所がプラグイン側の課題を kind: plugin に書き換える (trailer Feedback-Reclassified。0.1.28)
 *   feedback(<b>): dismiss                   確認ページで取り下げた課題ファイルの削除 (trailer Feedback-Dismissed)
 *   feedback(<b>): stopped                   止まった課題ファイルの書き足し
 *   feedback(<b>): adr index                 ADR の索引 (ルールの basis の対象の docs/adr を変えるので、ルールより先に別の commit)
 *   feedback(<b>): regenerate                ルール・契約の生成物と docs/README.md (必ず最後。変化が無くても作る = 仕上げ済みの印)
 *
 * CLI (すべて --cwd <repo> を取る。既定はカレント。結果は JSON 1 行):
 *   file-issues <runDir>        UC の課題 (issues/*.md) のうち課題ファイルにしていないものを docs/feedback/ に書き、feedback_filed を記録
 *   scan                        自動選択の材料: 要求の差分のきっかけ (止まっていない要求の課題)・還流のきっかけ (止まっていないルール・契約)・止まった課題・プラグインへ持ち帰る課題・課題ファイルにしていない配送済みの run・途中のバッチ
 *   hold <issue> --reason-file <f>   要求の差分の確認ページで外して残す課題に止まった印を付ける (main の作業ツリーで書き換えるだけ。commit は d2-run)
 *   start [--batch <b>]         worktree と branch を main から作り、batch.json に対象の課題を書く
 *   status                      再開地点 (none | issues | gate | rebuild | merge | cleanup)
 *   commit-issue <issue>        原本と課題ファイルの削除を 1 commit に。契約で原本に差分が無ければ取り込み済み (worktree の残りはこのスクリプトが捨てる)
 *   reclassify <issue> --reason-file <f>   直す場所がプラグイン側の課題を kind: plugin に書き換えて commit (還流の対象から外れる。止まった印は外す)
 *   regen [--only adr-index|derived] [--regen-cmds <json>]   生成物を作り直す (commit しない)
 *   discard                     worktree の未 commit の変化をすべて捨てる (reset --hard と clean -fd)
 *   record-static <issue>       課題ごとの static が通った記録 (sha = 課題の commit)
 *   stop-issue <issue> --reason-file <f>   差分を残し、課題の commit を落として、止まった記録
 *   finalize [--regen-cmds <json>]         原本全体の検査 → stopped → adr index → regenerate
 *   record-gate --result pass|fail [--detail <f>[,<f>…]] [--retried]   最後のゲートの結果 (sha = branch の先頭)。--detail は runGates の gates.json を複数渡せる (落ちた段だけ要約)。
 *                                          --retried は 1 回だけ回し直して通った印 (0.1.30 M5。そのときの --detail は 1 回目の写し)
 *   decide (--take a,b --drop c --dismiss d | --abandon | --auto)   確認ページの回答 (--dismiss は止まった課題と取り込む候補)
 *   rebuild [--regen-cmds <json>]          main の先端から組み直す (外す課題・取り下げ・main の進行)
 *   merge                       main へ ff merge → push → 後始末 (取り込み済みなら push と後始末だけ)
 *
 * 終了コード: 0 成功 / 1 失敗 (理由は JSON の error) / 2 使い方の誤り / 3 main が還流 branch の祖先でない (組み直しが要る) / 4 push の拒否
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
const CONTRACT_SOURCES = ['contracts/openapi/', 'contracts/asyncapi/', 'contracts/db/', 'contracts/uc-index.yaml'];
const ADR_SOURCE_RE = /^docs\/adr\/[0-9][^/]*\.md$/;
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
function trailerValues(cwd, sha, key) {
  const body = git(cwd, ['log', '-1', '--format=%B', sha]);
  return body.split('\n').map((l) => l.match(new RegExp(`^${key}:\\s*(.+)$`))).filter(Boolean).map((m) => m[1].trim());
}

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

/** batch.json の co_author (start --co-author の値) を Co-Authored-By の trailer として本文の末尾に足す (0.1.30 L14) */
function withCoAuthor(message, coAuthor) {
  if (!coAuthor) return message;
  const body = message.replace(/\s+$/, '');
  return `${body}${body.includes('\n\n') ? '\n' : '\n\n'}Co-Authored-By: ${coAuthor}`;
}

function coAuthorOf(ctx) {
  const batch = ctx && ctx.fb ? readJson(path.join(ctx.fb, 'batch.json')) : null;
  return batch && batch.co_author ? String(batch.co_author) : null;
}

function commitWithMessage(cwd, message, { allowEmpty = false, coAuthor = null } = {}) {
  const tmp = path.join(fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'd2-fb-msg-')), 'msg.txt');
  const msg = withCoAuthor(message, coAuthor);
  fs.writeFileSync(tmp, msg.endsWith('\n') ? msg : `${msg}\n`);
  try {
    git(cwd, ['commit', '-q', ...(allowEmpty ? ['--allow-empty'] : []), '-F', tmp]);
  } finally { fs.rmSync(path.dirname(tmp), { recursive: true, force: true }); }
  return revParse(cwd, 'HEAD');
}

function hasStaged(cwd) { return !gitOk(cwd, ['diff', '--cached', '--quiet']); }

// ---- 課題ファイル ----

function splitFrontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: text };
  return { fm: parseYaml(m[1]) || {}, body: m[2] };
}

function joinFrontMatter(fm, body) { return `---\n${stringifyYaml(fm).trimEnd()}\n---\n${body.startsWith('\n') ? body : `\n${body}`}`; }

function listFeedback(dir) {
  const d = path.join(dir, FEEDBACK_REL);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => f.endsWith('.md') && f !== 'README.md').sort().map((f) => {
    const { fm } = splitFrontMatter(fs.readFileSync(path.join(d, f), 'utf8'));
    return { id: f.replace(/\.md$/, ''), kind: fm.kind || null, title: fm.title || '', from_uc: fm.from_uc || null, created: fm.created || '', stopped: Boolean(fm.stopped), stopped_count: Number(fm.stopped_count || 0) };
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
function writeJson(p, v) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`); }
function stateFile(ctx, id) { return path.join(ctx.fb, `${id}.state`); }
function readState(ctx, id) { return readJson(stateFile(ctx, id)); }

function requireBatch(ctx, { needWorktree = true } = {}) {
  if (!ctx.branch) throw new Fail('途中のバッチが無い (feedback/* branch が無い)');
  if (needWorktree && !fs.existsSync(ctx.wt)) throw new Fail(`worktree が無い: ${WT_REL}`);
  const batch = readJson(path.join(ctx.fb, 'batch.json'));
  if (!batch) throw new Fail(`batch.json が無い: ${path.relative(ctx.root, ctx.fb)}`);
  return batch;
}

function issueOf(batch, id) {
  const it = batch.issues.find((x) => x.id === id);
  if (!it) throw new Fail(`バッチの対象に無い課題: ${id}`);
  return it;
}

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

function branchSubjects(ctx, base = 'main') {
  return git(ctx.root, ['log', '--format=%s', `${base}..${ctx.branch}`]).split('\n').filter(Boolean);
}

// ---- main の同期 (fetch して origin/main へ ff。分岐していたら止まる) ----

function syncMain(root) {
  if (currentBranch(root) !== 'main') throw new Fail('作業 branch が main でない');
  if (!hasOrigin(root)) return { remote: false };
  git(root, ['fetch', '-q', 'origin']);
  const om = revParse(root, 'origin/main');
  if (!om) return { remote: true, origin_main: null };
  if (isAncestor(root, 'origin/main', 'main')) return { remote: true, behind: false };
  if (!isAncestor(root, 'main', 'origin/main')) throw new Fail('main と origin/main が分岐している (人が合わせ方を決める)');
  git(root, ['merge', '-q', '--ff-only', 'origin/main']);
  return { remote: true, behind: true };
}

function requireCleanTracked(dir, what) {
  const dirty = statusEntries(dir).filter((e) => e.xy !== '??');
  if (dirty.length) throw new Fail(`${what} に未 commit の変更がある: ${dirty.map((e) => e.path).join(', ')}`);
}

// ---- 作り直しのコマンド列 (正本はここ 1 か所) ----

function defaultRegenCmds() {
  const s = (rel) => path.join(SKILLS_ROOT, rel);
  const n = process.execPath;
  return {
    validate: [[n, s('d2-decide/scripts/validateAdr.js'), 'docs/adr']],
    'adr-index': [[n, s('d2-decide/scripts/genAdrIndex.js'), 'docs/adr', 'docs/adr/index.md', 'requirements=docs/requirements']],
    derived: [
      [n, s('d2-foundation/scripts/genRules.js'), '--adr', 'docs/adr', '--out', 'docs/rules', '--cwd', '.'],
      [n, s('d2-foundation/scripts/genArchTests.js'), '--adr', 'docs/adr', '--out', '.dependency-cruiser.cjs', '--cwd', '.'],
      [n, s('d2-contract/scripts/compileContracts.js'), 'contracts'],
      [n, s('d2-contract/scripts/compileRdbSchema.js'), 'contracts'],
      [n, s('d2-contract/scripts/validateUcIndex.js'), 'contracts'],
      [n, s('d2-contract/scripts/genContractTests.js'), 'contracts', '--config', '.distillery/config.yaml', '--out-root', '.'],
      [n, s('d2-contract/scripts/genRdbDdl.js'), 'contracts', '--config', '.distillery/config.yaml', '--out-root', '.'],
      [n, s('d2-common/scripts/genDocsReadme.js'), '--cwd', '.'],
    ],
  };
}

function regenCmds(opts) {
  if (!opts['regen-cmds']) return defaultRegenCmds();
  const v = JSON.parse(opts['regen-cmds'].startsWith('{') ? opts['regen-cmds'] : fs.readFileSync(opts['regen-cmds'], 'utf8'));
  return { ...defaultRegenCmds(), ...v };
}

function runCmds(dir, list, what) {
  for (const argv of list) {
    const r = spawnSync(argv[0], argv.slice(1), { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (r.status !== 0) {
      const tail = `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-20).join('\n');
      throw new Fail(`${what} が失敗した: ${path.basename(argv[1] || argv[0])} (exit ${r.status})`, 1, { output_tail: tail });
    }
  }
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
      const out = { kind: fm.kind || null, title: fm.title || id, from_uc: slug, status: 'open', created: new Date().toISOString().replace(/\.\d+Z$/, 'Z') };
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
    let st = readState(ctx, it.id);
    const c = commits.find((x) => x.id === it.id);
    // reclassify の commit と state の間で止まっても、commit があれば済み (state を復元する。外部レビュー 0.1.28 計画 2 ラウンド目)
    if (c && c.kind === 'plugin' && !(st && st.status === 'reclassified')) { st = { status: 'reclassified', sha: c.sha }; writeJson(stateFile(ctx, it.id), st); }
    if (st && (st.status === 'stopped' || st.status === 'already-applied' || st.status === 'reclassified')) done.push(it.id);
    else if (st && st.status === 'passed' && c && st.sha === c.sha) done.push(it.id);
    else if (c) needsStatic.push(it.id);
    else pending.push(it.id);
  }
  const dirty = fs.existsSync(ctx.wt) ? statusEntries(ctx.wt).length > 0 : false;
  return { ...base, point: 'issues', done, pending, needs_static: needsStatic, worktree_dirty: dirty };
}

function cmdScan(root) {
  const all = listFeedback(root);
  // 止まった課題は要求の差分・還流のきっかけにしない (起動のたびに同じ課題で戻り、UC へ進めなくなる)。ほかの課題で回すときに一緒に読む
  const requirement = all.filter((x) => x.kind === 'requirement' && !x.stopped).map((x) => x.id);
  const requirementAll = all.filter((x) => x.kind === 'requirement').map((x) => x.id);
  const triggers = all.filter((x) => (x.kind === 'rule' || x.kind === 'contract') && !x.stopped).map((x) => x.id);
  const stopped = all.filter((x) => (x.kind === 'rule' || x.kind === 'contract') && x.stopped).map((x) => ({ id: x.id, stopped_count: x.stopped_count }));
  // プラグインへ持ち帰る課題は還流の対象でない (報告用に返すだけ。きっかけにしない)
  const plugin = all.filter((x) => x.kind === 'plugin').map((x) => x.id);
  const runsDir = path.join(root, '.distillery', 'runs');
  const unfiledRuns = [];
  if (fs.existsSync(runsDir)) {
    for (const slug of fs.readdirSync(runsDir).sort()) {
      const rd = path.join(runsDir, slug);
      if (!fs.statSync(rd).isDirectory() || !runState.isDone(rd, 'deliver')) continue;
      const unfiled = runState.unfiledIssues(rd);
      if (unfiled.length) unfiledRuns.push({ run: path.relative(root, rd).split(path.sep).join('/'), unfiled });
    }
  }
  const batch = batchStatus(root);
  const feedbackDue = batch.point !== 'none' || triggers.length > 0 || unfiledRuns.length > 0;
  return { requirement, requirement_all: requirementAll, triggers, stopped, plugin, unfiled_runs: unfiledRuns, batch, feedback_due: feedbackDue };
}

function symlinkNodeModules(root, wt) {
  const linked = [];
  const walk = (rel, depth) => {
    const abs = path.join(root, rel);
    let ents;
    try { ents = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (!e.isDirectory()) continue;
      if (e.name === 'node_modules') {
        const target = path.join(wt, rel, 'node_modules');
        if (fs.existsSync(path.join(wt, rel)) && !fs.existsSync(target)) { fs.symlinkSync(path.join(abs, 'node_modules'), target); linked.push(path.join(rel, 'node_modules')); }
        continue;
      }
      if (e.name === '.git' || e.name === '.distillery' || e.name.startsWith('.') || depth >= 3) continue;
      walk(path.join(rel, e.name), depth + 1);
    }
  };
  walk('.', 0);
  return linked.map((p) => p.split(path.sep).join('/').replace(/^\.\//, ''));
}

function cmdStart(root, opts) {
  const ctx = ctxOf(root);
  if (ctx.branch || fs.existsSync(ctx.wt)) throw new Fail(`途中のバッチがある (${ctx.branch || WT_REL})。status で再開地点を確かめる`);
  requireCleanTracked(root, '作業ツリー');
  const sync = syncMain(root);
  for (const probe of [path.join(WT_REL, 'x'), 'apps/d2-check-symlink/node_modules']) {
    if (!gitOk(root, ['check-ignore', '-q', '--no-index', probe])) throw new Fail(`.gitignore が ${probe} を無視しない。genSkeleton.js --migrate を回して commit してから再開する`);
  }
  const order = { rule: 0, contract: 1 };
  const issues = listFeedback(root).filter((x) => x.kind === 'rule' || x.kind === 'contract')
    .sort((a, b) => (order[a.kind] - order[b.kind]) || String(a.created).localeCompare(String(b.created)) || a.id.localeCompare(b.id))
    .map((x) => ({ id: x.id, kind: x.kind, stopped_count: x.stopped_count }));
  if (!issues.length) return { started: false, reason: '対象の課題が無い' };
  const b = opts.batch || new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').replace(/\..+$/, '');
  const branch = `feedback/${b}`;
  git(root, ['worktree', 'add', '-q', '-b', branch, WT_REL, 'main']);
  const linked = symlinkNodeModules(root, path.join(root, WT_REL));
  const fb = path.join(root, LOG_REL, b);
  const coAuthor = opts['co-author'] ? String(opts['co-author']).replace(/^Co-Authored-By:\s*/i, '').trim() : null;
  writeJson(path.join(fb, 'batch.json'), { batch: b, base: revParse(root, 'main'), issues, ...(coAuthor ? { co_author: coAuthor } : {}) });
  return { started: true, batch: b, branch, worktree: WT_REL, issues, node_modules: linked, sync, co_author: coAuthor };
}

function cmdCommitIssue(root, id) {
  if (!id) throw new Fail('commit-issue <issue>', 2);
  const ctx = ctxOf(root);
  const batch = requireBatch(ctx);
  const it = issueOf(batch, id);
  const fp = feedbackPath(ctx.wt, id);
  if (!fs.existsSync(fp)) throw new Fail(`課題ファイルが worktree に無い: ${path.relative(ctx.wt, fp)}`);
  const { fm } = splitFrontMatter(fs.readFileSync(fp, 'utf8'));
  const changed = statusEntries(ctx.wt).map((e) => e.path);
  const sources = it.kind === 'rule'
    ? changed.filter((p) => ADR_SOURCE_RE.test(p))
    : changed.filter((p) => CONTRACT_SOURCES.some((s) => (s.endsWith('/') ? p.startsWith(s) : p === s)));
  if (it.kind === 'rule' && !sources.length) throw new Fail('ルールの課題なのに番号付きの ADR が変わっていない');
  if (sources.length) git(ctx.wt, ['add', '-A', '--', ...sources]);
  const alreadyApplied = it.kind === 'contract' && !hasStaged(ctx.wt);
  git(ctx.wt, ['rm', '-q', '--', path.join(FEEDBACK_REL, `${id}.md`)]);
  const lines = [`feedback(${ctx.batch}): ${it.kind} ${id}`, '', `Feedback-Consumed: docs/feedback/${id}.md`, `Feedback-Kind: ${it.kind}`, `Feedback-From-UC: ${fm.from_uc || 'unknown'}`];
  if (alreadyApplied) lines.push('Feedback-Result: already-applied');
  const sha = commitWithMessage(ctx.wt, lines.join('\n'), { coAuthor: coAuthorOf(ctx) });
  if (alreadyApplied) {
    writeJson(stateFile(ctx, id), { status: 'already-applied', sha });
    // 派遣が作り直した生成物が worktree に残る。static は回さないので、ここで捨てて次の課題を clean で始める (0.1.27 実走 K14)
    discardWt(ctx.wt);
    return { result: 'already-applied', sha, sources, discarded: true };
  }
  return { result: 'committed', sha, sources };
}

/** 直す場所がプラグイン側 (生成器・テンプレート・手順書) の課題を kind: plugin に書き換えて commit する。還流の対象から外れ、main に残る (0.1.28) */
function cmdReclassify(root, id, opts) {
  if (!id || !opts['reason-file']) throw new Fail('reclassify <issue> --reason-file <f>', 2);
  const ctx = ctxOf(root);
  const batch = requireBatch(ctx);
  const it = issueOf(batch, id);
  const reason = fs.readFileSync(path.resolve(root, opts['reason-file']), 'utf8').trim();
  // 派遣が書き込み範囲の中に残したものを commit に混ぜない
  discardWt(ctx.wt);
  const fp = feedbackPath(ctx.wt, id);
  if (!fs.existsSync(fp)) throw new Fail(`課題ファイルが worktree に無い: ${path.relative(ctx.wt, fp)}`);
  const { fm, body } = splitFrontMatter(fs.readFileSync(fp, 'utf8'));
  const original = fm.kind || it.kind;
  const nfm = { ...fm, kind: 'plugin', kind_original: original };
  // もう止まった課題ではない (止まった理由の本文は残す)
  delete nfm.stopped;
  delete nfm.stopped_count;
  nfm.title = String(nfm.title || id).replace(/^止まった: /, '');
  const section = ['## プラグインへ持ち帰る理由', '', reason, ''].join('\n');
  fs.writeFileSync(fp, joinFrontMatter(nfm, `\n${section}\n${body.replace(/^\n+/, '')}`));
  git(ctx.wt, ['add', '-A', '--', path.join(FEEDBACK_REL, `${id}.md`)]);
  const lines = [`feedback(${ctx.batch}): plugin ${id}`, '', `Feedback-Reclassified: docs/feedback/${id}.md`, 'Feedback-Kind: plugin', `Feedback-Kind-Original: ${original}`, `Feedback-From-UC: ${fm.from_uc || 'unknown'}`];
  const sha = commitWithMessage(ctx.wt, lines.join('\n'), { coAuthor: coAuthorOf(ctx) });
  writeJson(stateFile(ctx, id), { status: 'reclassified', sha, reason });
  return { reclassified: id, kind_original: original, sha };
}

function cmdRegen(root, opts) {
  const ctx = ctxOf(root);
  requireBatch(ctx);
  const cmds = regenCmds(opts);
  const steps = opts.only ? [opts.only] : ['adr-index', 'derived'];
  for (const s of steps) {
    if (!cmds[s]) throw new Fail(`不明な --only: ${s}`, 2);
    runCmds(ctx.wt, cmds[s], `生成物の作り直し (${s})`);
  }
  return { regenerated: steps };
}

function discardWt(wt) {
  git(wt, ['reset', '-q', '--hard']);
  git(wt, ['clean', '-q', '-fd']);
  const left = statusEntries(wt);
  if (left.length) throw new Fail(`worktree を clean にできない: ${left.map((e) => e.path).join(', ')}`);
}

function cmdDiscard(root) {
  const ctx = ctxOf(root);
  requireBatch(ctx);
  discardWt(ctx.wt);
  return { discarded: true };
}

function cmdRecordStatic(root, id) {
  if (!id) throw new Fail('record-static <issue>', 2);
  const ctx = ctxOf(root);
  const batch = requireBatch(ctx);
  issueOf(batch, id);
  const head = revParse(ctx.wt, 'HEAD');
  if (subjectOf(ctx.wt, 'HEAD') !== `feedback(${ctx.batch}): ${issueOf(batch, id).kind} ${id}`) throw new Fail(`worktree の先頭が課題 ${id} の commit でない`);
  writeJson(stateFile(ctx, id), { status: 'passed', sha: head });
  return { recorded: 'passed', sha: head };
}

function cmdStopIssue(root, id, opts) {
  if (!id || !opts['reason-file']) throw new Fail('stop-issue <issue> --reason-file <f>', 2);
  const ctx = ctxOf(root);
  const batch = requireBatch(ctx);
  const it = issueOf(batch, id);
  const reason = fs.readFileSync(path.resolve(root, opts['reason-file']), 'utf8').trim();
  const headIsIssue = subjectOf(ctx.wt, 'HEAD') === `feedback(${ctx.batch}): ${it.kind} ${id}`;
  const before = headIsIssue ? revParse(ctx.wt, 'HEAD~1') : revParse(ctx.wt, 'HEAD');
  git(ctx.wt, ['add', '-N', '--', '.']);
  const diff = git(ctx.wt, ['diff', before], { allowFail: true }).out;
  fs.mkdirSync(ctx.fb, { recursive: true });
  fs.writeFileSync(path.join(ctx.fb, `${id}.failed.diff`), diff ? `${diff}\n` : '');
  if (headIsIssue) git(ctx.wt, ['reset', '-q', '--hard', 'HEAD~1']);
  discardWt(ctx.wt);
  writeJson(stateFile(ctx, id), { status: 'stopped', reason, diff_lines: diff ? diff.split('\n').length : 0 });
  return { stopped: id, dropped_commit: headIsIssue };
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

function markStopped(ctx, ids, extraReasons = {}) {
  const marked = [];
  for (const id of ids) {
    const fp = feedbackPath(ctx.wt, id);
    if (!fs.existsSync(fp)) continue;
    const st = readState(ctx, id) || {};
    const reason = extraReasons[id] || st.reason || '(理由の記録なし)';
    const diffPath = path.join(ctx.fb, `${id}.failed.diff`);
    const diffText = fs.existsSync(diffPath) ? fs.readFileSync(diffPath, 'utf8') : '';
    writeStopped(fp, id, reason, diffText);
    marked.push(id);
  }
  return marked;
}

function cmdHold(root, id, opts) {
  if (!id || !opts['reason-file']) throw new Fail('hold <issue> --reason-file <f>', 2);
  const fp = feedbackPath(root, id);
  if (!fs.existsSync(fp)) throw new Fail(`課題ファイルが無い: ${path.relative(root, fp)}`);
  const reason = fs.readFileSync(path.resolve(root, opts['reason-file']), 'utf8').trim();
  const count = writeStopped(fp, id, reason, '');
  return { held: id, stopped_count: count };
}

function finalizeOn(ctx, batch, opts, { dismiss = [], dropReasons = {} } = {}) {
  const cmds = regenCmds(opts);
  requireCleanTracked(ctx.wt, 'worktree');
  runCmds(ctx.wt, cmds.validate, '原本全体の検査');
  const subjects = branchSubjects(ctx);
  const commits = {};
  if (!subjects.includes(`feedback(${ctx.batch}): stopped`)) {
    const stoppedIds = batch.issues.map((x) => x.id).filter((id) => !dismiss.includes(id) && (dropReasons[id] || (readState(ctx, id) || {}).status === 'stopped'));
    const marked = markStopped(ctx, stoppedIds, dropReasons);
    if (marked.length) {
      git(ctx.wt, ['add', '-A', '--', FEEDBACK_REL]);
      commits.stopped = commitWithMessage(ctx.wt, [`feedback(${ctx.batch}): stopped`, '', ...marked.map((id) => `Feedback-Stopped: docs/feedback/${id}.md`)].join('\n'), { coAuthor: coAuthorOf(ctx) });
    }
  }
  runCmds(ctx.wt, cmds['adr-index'], '生成物の作り直し (adr-index)');
  git(ctx.wt, ['add', '-A']);
  if (hasStaged(ctx.wt)) commits.adr_index = commitWithMessage(ctx.wt, `feedback(${ctx.batch}): adr index`, { coAuthor: coAuthorOf(ctx) });
  runCmds(ctx.wt, cmds.derived, '生成物の作り直し (derived)');
  git(ctx.wt, ['add', '-A']);
  commits.regenerate = commitWithMessage(ctx.wt, `feedback(${ctx.batch}): regenerate`, { allowEmpty: true, coAuthor: coAuthorOf(ctx) });
  return commits;
}

function cmdFinalize(root, opts) {
  const ctx = ctxOf(root);
  const batch = requireBatch(ctx);
  if (subjectOf(root, ctx.branch) === `feedback(${ctx.batch}): regenerate`) return { finalized: false, reason: '仕上げ済み', head: revParse(root, ctx.branch), slices_changed: slicesChanged(ctx) };
  const commits = finalizeOn(ctx, batch, opts);
  return { finalized: true, commits, head: revParse(root, ctx.branch), slices_changed: slicesChanged(ctx) };
}

function cmdRecordGate(root, opts) {
  if (!['pass', 'fail'].includes(opts.result)) throw new Fail('record-gate --result pass|fail [--detail <f>]', 2);
  const ctx = ctxOf(root);
  requireBatch(ctx);
  const head = revParse(root, ctx.branch);
  if (subjectOf(root, ctx.branch) !== `feedback(${ctx.batch}): regenerate`) throw new Fail('仕上げ (finalize) の前にゲートの結果は記録できない');
  const rec = { sha: head, result: opts.result, at: new Date().toISOString() };
  if (opts.retried) rec.retried = true;
  if (opts.detail) rec.detail = gateDetail(csv(opts.detail).map((f) => path.resolve(root, f)));
  writeJson(path.join(ctx.fb, 'gate.json'), rec);
  return rec;
}

function csv(v) { return v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []; }

/**
 * record-gate --detail の中身 (0.1.30 M6)。runGates の gates.json なら uc と落ちた段の落ちた job (exit・failed_tests・output_tail の末尾 20 行) を要約し、
 * それ以外のファイルは末尾 40 行。複数ファイルはファイルごとの要約を連結する (最後のゲートで複数 UC が落ちたとき)
 */
function gateDetail(files) {
  const parts = [];
  for (const f of files) {
    if (!fs.existsSync(f)) throw new Fail(`--detail のファイルが無い: ${f}`, 2);
    const text = fs.readFileSync(f, 'utf8');
    const j = readJsonText(text);
    if (j && Array.isArray(j.gates)) {
      const lines = [`[${j.uc || path.basename(path.dirname(path.dirname(f)))}] result=${j.result || '?'} (${path.basename(f)})`];
      for (const g of j.gates.filter((x) => x.status === 'fail')) {
        if (g.note && !(g.jobs || []).some((x) => x.status === 'fail')) lines.push(`${g.name}: ${g.note}`);
        for (const job of (g.jobs || []).filter((x) => x.status === 'fail')) {
          lines.push(`${g.name} ${job.tier ? `${job.tier}:` : ''}${job.name} exit=${job.exit}`);
          if (job.failed_tests) lines.push(`  failed_tests: ${job.failed_tests.join(', ')}${job.failed_tests_truncated ? ` (他 ${job.failed_tests_truncated - job.failed_tests.length} 件)` : ''}`);
          lines.push(...String(job.output_tail || '').split('\n').slice(-20).map((l) => `  ${l}`));
        }
      }
      parts.push(lines.join('\n'));
    } else {
      parts.push(text.split('\n').slice(-40).join('\n'));
    }
  }
  return parts.join('\n\n');
}

function readJsonText(text) { try { return JSON.parse(text); } catch { return null; } }

/** 確認ページで「取り込む / 今回は外す / 取り下げる」を聞く課題 (原本を commit した課題。取り込み済みとプラグインへ持ち帰る課題は聞かずに残す) */
function keptWithoutAsking(st) { return Boolean(st && (st.status === 'already-applied' || st.status === 'reclassified')); }
function candidatesOf(ctx) {
  return issueCommits(ctx).filter((c) => c.kind !== 'plugin').map((c) => c.id).filter((id) => !keptWithoutAsking(readState(ctx, id)));
}

function cmdDecide(root, opts) {
  const ctx = ctxOf(root);
  const batch = requireBatch(ctx);
  const gate = readJson(path.join(ctx.fb, 'gate.json'));
  const head = revParse(root, ctx.branch);
  const candidates = candidatesOf(ctx);
  const stoppedIds = batch.issues.map((x) => x.id).filter((id) => (readState(ctx, id) || {}).status === 'stopped');
  // 2 回目以上止まった課題 (切り出した時点で既に止まっていて、今回も止まった) は「取り下げる / 残す」を人に聞く
  const restopped = stoppedIds.filter((id) => Number((batch.issues.find((x) => x.id === id) || {}).stopped_count || 0) >= 1);
  let d;
  if (opts.auto) {
    // 確認ページを出さないとき (取り込み済みと 1 回目の停止だけ) に限る。人の回答なしで原本を取り込まない
    if (candidates.length || restopped.length) throw new Fail(`--auto は確認ページを出さないときだけ。取り込む候補 (${candidates.join(', ') || 'なし'}) か 2 回目以上止まった課題 (${restopped.join(', ') || 'なし'}) がある`);
    d = { auto: true, take: [], drop: [], dismiss: [] };
  } else if (opts.abandon) {
    d = { auto: false, take: [], drop: candidates, dismiss: csv(opts.dismiss) };
  } else {
    d = { auto: false, take: csv(opts.take), drop: csv(opts.drop), dismiss: csv(opts.dismiss) };
  }
  for (const id of [...d.take, ...d.drop, ...d.dismiss]) issueOf(batch, id);
  // 回答の転記漏れで、人が選んでいない課題を取り込まない (取り込む候補は take・drop・dismiss で漏れなく、重ならずに覆う)
  const both = d.take.filter((id) => d.drop.includes(id) || d.dismiss.includes(id)).concat(d.drop.filter((id) => d.dismiss.includes(id)));
  if (both.length) throw new Fail(`取り込む・外す・取り下げるの複数にある課題: ${[...new Set(both)].join(', ')}`);
  const missing = candidates.filter((id) => !d.take.includes(id) && !d.drop.includes(id) && !d.dismiss.includes(id));
  if (missing.length) throw new Fail(`取り込むか外すか取り下げるかが決まっていない課題: ${missing.join(', ')}`);
  const extra = [...d.take, ...d.drop].filter((id) => !candidates.includes(id));
  if (extra.length) throw new Fail(`取り込む候補でない課題 (止まった・取り込み済み・プラグインへ持ち帰る): ${extra.join(', ')}`);
  // 取り下げは止まった課題 (2 回目以上の停止) と取り込む候補 (直し方が要らない課題。0.1.27 実走 K17)
  const notDismissable = d.dismiss.filter((id) => !stoppedIds.includes(id) && !candidates.includes(id));
  if (notDismissable.length) throw new Fail(`取り下げられるのは止まった課題と取り込む候補だけ: ${notDismissable.join(', ')}`);
  const gateFailed = !gate || gate.sha !== head || gate.result !== 'pass';
  if (gateFailed) {
    // 取り込む候補が無いのに落ちたなら、原因は課題ではない (main か生成物の作り直し)。回答を記録せず人が調べる
    if (!candidates.length) throw new Fail('取り込む候補が無いのにゲートが通っていない (記録が無い・落ちた・先頭と違う)。原因は課題ではなく main か生成物の作り直し。止まって人が調べる');
    if (d.auto) throw new Fail('ゲートが通っていないときは --auto にできない');
    // 候補を外す (drop) か候補を取り下げる (dismiss) が無ければ、候補をすべて取り込む回答になる
    const removed = d.drop.length + d.dismiss.filter((id) => candidates.includes(id)).length;
    if (!removed) throw new Fail('ゲートが通っていない (記録が無い・落ちた・先頭と違う)。取り込む候補をすべて取り込む回答はできない。外すか取り下げる課題を選ぶか、バッチ全体を止める (--abandon)');
  }
  const rec = { ...d, applied: false, decided_at: new Date().toISOString(), head };
  writeJson(path.join(ctx.fb, 'decision.json'), rec);
  return rec;
}

function cmdRebuild(root, opts) {
  const ctx = ctxOf(root);
  const batch = requireBatch(ctx);
  requireCleanTracked(root, '作業ツリー');
  const sync = syncMain(root);
  discardWt(ctx.wt);
  const decision = readJson(path.join(ctx.fb, 'decision.json')) || { take: null, drop: [], dismiss: [] };
  const drop = decision.drop || [];
  const dismiss = decision.dismiss || [];
  const oldHead = revParse(root, ctx.branch);
  // main..branch は main が進んでいても branch 側の commit だけを返す。取り込むのは take (確認ページで選んだもの) と、聞かずに残すもの (取り込み済み・プラグインへ持ち帰る)
  const take = decision.take || null;
  const keep = issueCommits(ctx).filter((c) => !drop.includes(c.id) && !dismiss.includes(c.id)
    && (take === null || take.includes(c.id) || c.kind === 'plugin' || keptWithoutAsking(readState(ctx, c.id))));
  git(root, ['update-ref', `refs/distillery2/feedback-prev/${ctx.batch}`, oldHead]);
  git(ctx.wt, ['reset', '-q', '--hard', 'main']);
  const picked = [];
  for (const c of keep) {
    const r = git(ctx.wt, ['cherry-pick', c.sha], { allowFail: true });
    if (!r.ok) {
      git(ctx.wt, ['cherry-pick', '--abort'], { allowFail: true });
      git(ctx.wt, ['reset', '-q', '--hard', oldHead]);
      throw new Fail(`組み直しの cherry-pick が衝突した: ${c.id}。branch は組み直しの前に戻した`, 1, { conflict: c.id });
    }
    const sha = revParse(ctx.wt, 'HEAD');
    const st = readState(ctx, c.id);
    if (st && (st.status === 'passed' || st.status === 'already-applied' || st.status === 'reclassified')) writeJson(stateFile(ctx, c.id), { ...st, sha });
    picked.push({ id: c.id, sha });
  }
  const dismissed = dismiss.filter((id) => fs.existsSync(feedbackPath(ctx.wt, id)));
  if (dismissed.length) {
    git(ctx.wt, ['rm', '-q', '--', ...dismissed.map((id) => path.join(FEEDBACK_REL, `${id}.md`))]);
    commitWithMessage(ctx.wt, [`feedback(${ctx.batch}): dismiss`, '', ...dismissed.map((id) => `Feedback-Dismissed: docs/feedback/${id}.md`)].join('\n'), { coAuthor: coAuthorOf(ctx) });
  }
  const dropReasons = {};
  for (const id of drop) {
    dropReasons[id] = '確認ページで外した';
    writeJson(stateFile(ctx, id), { status: 'stopped', reason: '確認ページで外した' });
  }
  const commits = finalizeOn(ctx, batch, opts, { dismiss, dropReasons });
  const head = revParse(root, ctx.branch);
  writeJson(path.join(ctx.fb, 'decision.json'), { ...decision, applied: true, applied_head: head });
  fs.rmSync(path.join(ctx.fb, 'gate.json'), { force: true });
  return { rebuilt: true, picked, dismissed, dropped: drop, commits, head, sync };
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

function cmdMerge(root) {
  const ctx = ctxOf(root);
  // 取り込んだ後の後始末の途中で止まったとき (worktree だけ消えた) も進められるように、worktree の有無は取り込みの前にだけ見る
  requireBatch(ctx, { needWorktree: false });
  if (currentBranch(root) !== 'main') throw new Fail('作業 branch が main でない');
  requireCleanTracked(root, '作業ツリー');
  const head = revParse(root, ctx.branch);
  if (subjectOf(root, ctx.branch) !== `feedback(${ctx.batch}): regenerate`) throw new Fail('仕上げ (finalize) が済んでいない');
  if (isAncestor(root, ctx.branch, 'main')) {
    const push = pushMain(root);
    cleanupBatch(ctx);
    return { merged: true, already: true, head, ...push };
  }
  if (!fs.existsSync(ctx.wt)) throw new Fail(`worktree が無い: ${WT_REL}`);
  const gate = readJson(path.join(ctx.fb, 'gate.json'));
  if (!gate || gate.result !== 'pass' || gate.sha !== head) throw new Fail('ゲートが通った記録が branch の先頭と一致しない。取り込まない');
  const decision = readJson(path.join(ctx.fb, 'decision.json'));
  if (!decision) throw new Fail('確認ページの回答 (decision.json) が無い');
  if (((decision.drop || []).length || (decision.dismiss || []).length) && !decision.applied) throw new Fail('外す課題・取り下げが組み直しに反映されていない (rebuild が要る)');
  const sync = syncMain(root);
  if (!isAncestor(root, 'main', ctx.branch)) throw new Fail('main が還流 branch の祖先でない (main が進んだ)。組み直してゲートから', 3, { sync });
  git(root, ['merge', '-q', '--ff-only', ctx.branch]);
  const push = pushMain(root);
  cleanupBatch(ctx);
  return { merged: true, already: false, head, sync, ...push };
}

// ---- CLI ----

function parseArgs(argv) {
  const opts = { _: [] };
  const flags = new Set(['auto', 'abandon', 'retried']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (flags.has(k) || k === 'json') opts[k] = true;
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
    start: () => cmdStart(root, opts),
    status: () => batchStatus(root),
    'commit-issue': () => cmdCommitIssue(root, opts._[0]),
    reclassify: () => cmdReclassify(root, opts._[0], opts),
    regen: () => cmdRegen(root, opts),
    discard: () => cmdDiscard(root),
    'record-static': () => cmdRecordStatic(root, opts._[0]),
    'stop-issue': () => cmdStopIssue(root, opts._[0], opts),
    finalize: () => cmdFinalize(root, opts),
    'record-gate': () => cmdRecordGate(root, opts),
    decide: () => cmdDecide(root, opts),
    rebuild: () => cmdRebuild(root, opts),
    merge: () => cmdMerge(root),
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

module.exports = { main, batchStatus, cmdScan, splitFrontMatter, defaultRegenCmds, WT_REL, LOG_REL };
