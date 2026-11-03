#!/usr/bin/env node
/**
 * resumeAfterUpstream.js — 上流 (要求・決定・基盤) で止めた機能を、上流を直した後の main の上に写し直す (0.3.0)
 *
 * 機能の作業を捨てずに、止めたときの feature の変更を新しい main の上へ 3 方向で統合して 1 commit にし、影響する段から続ける。
 * merge commit も rebase も使わない (main マージの squash の検査は feature に merge commit が無いことを求め、basis は commit の ID を使う)。
 *
 * CLI (結果は JSON 1 行):
 *   node resumeAfterUpstream.js run <root> <slug> [--override-limit] [--co-author "<attribution の値>"]
 *     前提: 作業ツリーが clean、今の branch が main、feature/<slug> の run の最後の止まりが blocked_on_upstream で、その課題ファイルがすべて main から消えている (反映か取り下げ)
 *     出力: {slug, from_stage, conflicts, diffs, regenerated, resumes, limit, base_head, from_head, commit}
 *   node resumeAfterUpstream.js check-diffs <runDir> --handoff <引き継ぎファイル>
 *     最後の写し直しの差分ファイル (統合できなかった機能側の変更) を担当が扱ったかを確かめる: 引き継ぎファイルの resume_diffs に全件あり、
 *     applied は差分の追加行 (空白を詰めて比べる) がすべて where のファイルにあり、dropped は理由がある。出力 {ok, errors[], applied, dropped}
 *
 * 写し直しの段 (処理の記録 .distillery/logs/resume-<slug>.json に段ごとに残し、途中で止まったら最初の終わっていない段から続ける):
 *   2 古い feature を refs/distillery2/paused/<slug>/<ts> に控える
 *   3 git merge-tree --write-tree --name-only -z --merge-base <有効な base_head> <main_sha> feature/<slug>
 *   4 一時の index に tree を読み、衝突したパスと作り直せる生成物を main の側に置き換えて write-tree (衝突の印が残れば止まる)
 *   5 commit-tree -p <main_sha> → feature を付け替える (main が進んでいたら main_sha を更新して 3 から) → feature に切り替える
 *   6 衝突したパスごとに機能側の差分を <run>/resume/<n>/ に保存する
 *   7 生成物を作り直す (機能が変えていた生成物だけ)
 *   8 続きの段を決める (課題の resume_from・戻し先・止めた段・衝突したパスの段の最も早いもの)
 *   9 続きの段以降の done とレビューの置き場を退避し、resumed_after_upstream を記録して commit (main が進んでいたら止まる)
 *
 * 終了コード: 0 成功 / 1 失敗 (理由は JSON の error。処理の記録は残る) / 2 使い方の誤り / 3 写し直しの回数の上限 (何も変えない)
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const runState = require('./lib/runState');
const { parseHeader, check: basisCheck } = require('./lib/basis');

const SKILLS_ROOT = path.resolve(__dirname, '..', '..');
const STEPS = [2, 3, 4, 5, 6, 7, 8, 9];
const SUBJECT_COMMIT = (slug) => `impl(${slug}): resume after upstream`;
const SUBJECT_RECORDS = (slug) => `impl(${slug}): resume records`;

/**
 * 作り直せる生成物 (今の各段の受理で使う生成のコマンドで、正本から決定論で作り直せるもの)。
 * 契約の分割ファイル (contracts/openapi/** など) は正本なので入れない。順に回す (README は最後)
 */
const REGENERABLE = [
  { id: 'contracts', paths: [/^contracts\/generated\//, /^apps\/[^/]+\/test\/contract\//, /^packages\/contracts\/[^/]+\/stubs\//, /^packages\/contracts\/[^/]+\/validators\.ts$/],
    needs: 'contracts/contracts.json',
    cmds: [
      ['<skills>/d2-contract/scripts/compileContracts.js', 'contracts'],
      ['<skills>/d2-contract/scripts/compileRdbSchema.js', 'contracts'],
      ['<skills>/d2-contract/scripts/genContractTests.js', 'contracts', '--config', '.distillery/config.yaml', '--out-root', '.'],
    ] },
  { id: 'rules', paths: [/^docs\/rules\//], needs: 'docs/adr', cmds: [['<skills>/d2-foundation/scripts/genRules.js', '--adr', 'docs/adr', '--out', 'docs/rules', '--cwd', '.']] },
  { id: 'arch-tests', paths: [/^\.dependency-cruiser\.cjs$/], needs: 'docs/adr', cmds: [['<skills>/d2-foundation/scripts/genArchTests.js', '--adr', 'docs/adr', '--out', '.dependency-cruiser.cjs', '--cwd', '.']] },
  { id: 'adr-index', paths: [/^docs\/adr\/index\.md$/], needs: 'docs/adr', cmds: [['<skills>/d2-decide/scripts/genAdrIndex.js', 'docs/adr', 'docs/adr/index.md', 'requirements=docs/requirements']] },
  { id: 'docs-readme', paths: [/^docs\/README\.md$/, /^docs\/feedback\/README\.md$/], needs: 'docs', cmds: [['<skills>/d2-common/scripts/genDocsReadme.js', '--cwd', '.']] },
];

class Fail extends Error { constructor(msg, code = 1, extra = {}) { super(msg); this.code = code; this.extra = extra; } }

function git(root, args, { allowFail = false, env = null, input = null, raw = false } = {}) {
  const r = spawnSync('git', args, { cwd: root, encoding: raw ? 'buffer' : 'utf8', env: env ? { ...process.env, ...env } : process.env, input, maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0 && !allowFail) throw new Fail(`git ${args.join(' ')} が失敗: ${String(r.stderr || '').trim()}`);
  return { ok: r.status === 0, status: r.status, out: raw ? r.stdout : String(r.stdout || '').replace(/\n$/, ''), err: String(r.stderr || '').trim() };
}
const revParse = (root, ref) => { const r = git(root, ['rev-parse', '--verify', '-q', `${ref}^{commit}`], { allowFail: true }); return r.ok ? r.out : null; };
const existsAt = (root, rev, p) => git(root, ['cat-file', '-e', `${rev}:${p}`], { allowFail: true }).ok;
const showAt = (root, rev, p) => { const r = git(root, ['show', `${rev}:${p}`], { allowFail: true }); return r.ok ? r.out : null; };
const currentBranch = (root) => git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).out;
function trackedDirty(root) {
  return git(root, ['status', '--porcelain=v1', '--untracked-files=no']).out.split('\n').filter(Boolean);
}
function stamp() { return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'); }

function eventsAt(root, rev, slug) {
  const text = showAt(root, rev, `.distillery/runs/${slug}/events.jsonl`);
  return text ? text.split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
}

function journalPath(root, slug) { return path.join(root, '.distillery', 'logs', `resume-${slug}.json`); }
function readJournal(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function writeJournal(p, j) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n'); }

/** パス → 続きの段 (機能の中の段のうち、そのパスを書く最も早い段。scenario / contract / tier) */
function stageOfPath(p) {
  if (/^features\//.test(p) && p.endsWith('.feature')) return 'scenario';
  if (/^contracts\//.test(p) || p === 'docs/requirements/use-cases.yaml') return 'contract';
  return 'tier';
}
function earliest(stages) {
  const idx = stages.filter(Boolean).map((s) => runState.STAGES.indexOf(s)).filter((i) => i >= 0);
  return idx.length ? runState.STAGES[Math.min(...idx)] : null;
}
const isRegenerable = (p, table) => table.some((e) => e.paths.some((re) => re.test(p)));

/**
 * merge-tree の -z の出力を読む: <tree>\0<衝突したパス>\0...\0\0 の後に、情報の記録 <N>\0<パス×N>\0<種類>\0<文>\0 が続く。
 * 種類が CONFLICT で始まる記録のパスはすべて衝突したパスに入れる (rename/delete の旧名は 1 つ目の欄に出ないので、記録から拾う)。
 * 記録ごとのパスの組 (rename の旧名と新名) を groups に返す (差分ファイルの単位)
 */
function parseMergeTree(buf) {
  const parts = buf.toString('utf8').split('\0');
  const tree = parts[0];
  let i = 1;
  const first = [];
  while (i < parts.length && parts[i] !== '') first.push(parts[i++]);
  i++;
  const groups = [];
  while (i < parts.length) {
    const n = Number(parts[i]);
    if (!Number.isInteger(n) || n < 1) break;
    const paths = parts.slice(i + 1, i + 1 + n);
    const type = parts[i + 1 + n] || '';
    i += n + 3;
    if (type.startsWith('CONFLICT')) groups.push({ type, paths });
  }
  const all = new Set(first);
  for (const g of groups) for (const p of g.paths) all.add(p);
  for (const p of first) if (!groups.some((g) => g.paths.includes(p))) groups.push({ type: 'CONFLICT', paths: [p] });
  // 同じパスを持つ記録はまとめる (rename/delete と内容の衝突が同じ新名に出るなど。差分ファイルは 1 つ)
  const merged = [];
  for (const g of groups) {
    const hit = merged.filter((m) => m.paths.some((p) => g.paths.includes(p)));
    const into = hit[0] || { types: [], paths: [] };
    for (const h of hit.slice(1)) { into.types.push(...h.types); into.paths.push(...h.paths); merged.splice(merged.indexOf(h), 1); }
    into.types.push(g.type);
    for (const p of g.paths) if (!into.paths.includes(p)) into.paths.push(p);
    if (!hit.length) merged.push(into);
  }
  return { tree, conflicts: [...all].sort(), groups: merged.map((m) => ({ type: [...new Set(m.types)].join(', '), paths: m.paths })) };
}

function lsTree(root, rev) {
  return git(root, ['ls-tree', '-r', '-z', '--full-tree', rev], { raw: true }).out.toString('utf8').split('\0').filter(Boolean).map((l) => {
    const tab = l.indexOf('\t');
    const [mode, , sha] = l.slice(0, tab).split(' ');
    return { mode, sha, path: l.slice(tab + 1) };
  });
}

// ---- 段 ----

function step3(ctx, j) {
  const r = git(ctx.root, ['merge-tree', '--write-tree', '--name-only', '-z', '--merge-base', j.base_head, j.main_sha, j.old_head], { allowFail: true, raw: true });
  if (r.status !== 0 && r.status !== 1) throw new Fail(`git merge-tree が失敗 (exit ${r.status}): ${r.err}`);
  const m = parseMergeTree(r.out);
  const runPrefix = `.distillery/runs/${ctx.slug}/`;
  const inRun = m.conflicts.filter((p) => p.startsWith(runPrefix));
  if (inRun.length) throw new Fail(`機能の run の記録が main 側と衝突した (main が進行中の run を変えている。写し直さずに止める): ${inRun.join(', ')}`);
  j.merge_tree = m.tree;
  j.conflict_groups = m.groups.filter((g) => !g.paths.every((p) => isRegenerable(p, ctx.table)));
  j.conflicts = [...new Set(j.conflict_groups.flatMap((g) => g.paths))].sort();
  j.regenerable_conflicts = m.conflicts.filter((p) => isRegenerable(p, ctx.table));
}

function step4(ctx, j) {
  const idx = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'd2-resume-')), 'index');
  const env = { GIT_INDEX_FILE: idx };
  try {
    git(ctx.root, ['read-tree', j.merge_tree], { env });
    const mainEntries = new Map(lsTree(ctx.root, j.main_sha).map((e) => [e.path, e]));
    const treePaths = lsTree(ctx.root, j.merge_tree).map((e) => e.path);
    const replace = new Set(j.conflicts);
    for (const p of [...treePaths, ...mainEntries.keys()]) if (isRegenerable(p, ctx.table)) replace.add(p);
    for (const p of [...replace].sort()) {
      const m = mainEntries.get(p);
      if (m) git(ctx.root, ['update-index', '--add', '--cacheinfo', `${m.mode},${m.sha},${p}`], { env });
      else git(ctx.root, ['update-index', '--force-remove', '--', p], { env });
    }
    j.tree = git(ctx.root, ['write-tree'], { env }).out;
  } finally { fs.rmSync(path.dirname(idx), { recursive: true, force: true }); }
  const marks = git(ctx.root, ['grep', '-I', '-l', '-E', '^(<<<<<<<|>>>>>>>) ', j.tree], { allowFail: true });
  if (marks.ok && marks.out) throw new Fail(`写し直した tree に衝突の印が残っている: ${marks.out.split('\n').map((l) => l.replace(/^[^:]+:/, '')).join(', ')}`);
  const featureChanged = git(ctx.root, ['diff', '--name-only', '-z', j.base_head, j.old_head]).out.split('\0').filter(Boolean);
  j.regenerate = ctx.table.filter((e) => featureChanged.some((p) => e.paths.some((re) => re.test(p))) || j.regenerable_conflicts.some((p) => e.paths.some((re) => re.test(p)))).map((e) => e.id);
}

function step5(ctx, j, journal) {
  if (j.new_commit && revParse(ctx.root, `refs/heads/feature/${ctx.slug}`) === j.new_commit) return null; // 付け替えの後に止まった
  const msg = [SUBJECT_COMMIT(ctx.slug), '', `写し直し ${j.resume_no} 回目: ${j.old_head} の変更を ${j.main_sha} の上へ統合した。衝突 ${j.conflicts.length} 件は main の側を採り、機能側の差分を担当に渡す`];
  if (ctx.coAuthor) msg.push('', `Co-Authored-By: ${ctx.coAuthor}`);
  j.new_commit = git(ctx.root, ['commit-tree', j.tree, '-p', j.main_sha, '-F', '-'], { input: msg.join('\n') + '\n' }).out;
  writeJournal(journal, j);
  const mainNow = revParse(ctx.root, 'main');
  if (mainNow !== j.main_sha) return 'main-moved';
  git(ctx.root, ['update-ref', '-m', 'distillery2: resume after upstream', `refs/heads/feature/${ctx.slug}`, j.new_commit, j.old_head]);
  return null;
}

function switchToFeature(ctx) {
  if (currentBranch(ctx.root) === `feature/${ctx.slug}`) return;
  const dirty = trackedDirty(ctx.root);
  if (dirty.length) throw new Fail(`feature に切り替えられない (追跡済みの変更がある): ${dirty.join(', ')}`);
  git(ctx.root, ['switch', `feature/${ctx.slug}`]);
}

function step6(ctx, j) {
  const dir = path.join(ctx.runDir, 'resume', String(j.resume_no));
  fs.rmSync(dir, { recursive: true, force: true });
  j.diffs = [];
  for (const g of j.conflict_groups) {
    const d = git(ctx.root, ['diff', '-M', j.base_head, j.old_head, '--', ...g.paths]).out;
    if (!d.trim()) continue;
    const name = `${g.paths[0].replace(/[\\/]/g, '__')}.diff`;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), d + '\n');
    j.diffs.push({ diff: path.relative(ctx.root, path.join(dir, name)).split(path.sep).join('/'), paths: g.paths, type: g.type });
  }
}

function step7(ctx, j) {
  j.regenerated = [];
  for (const e of ctx.table.filter((x) => j.regenerate.includes(x.id))) {
    if (e.needs && !fs.existsSync(path.join(ctx.root, e.needs))) continue;
    for (const c of e.cmds) {
      const args = c.map((a) => a.replace('<skills>', SKILLS_ROOT));
      const r = spawnSync(process.execPath, args, { cwd: ctx.root, encoding: 'utf8' });
      if (r.status !== 0) throw new Fail(`生成物の作り直しが失敗 (${e.id}): node ${args.join(' ')}: ${String(r.stderr || r.stdout || '').trim().slice(-600)}`);
    }
    j.regenerated.push(e.id);
  }
}

function step8(ctx, j) {
  const st = runState.status(ctx.runDir);
  const fromIssues = j.issues.map((i) => i.resume_from === 'implementation' ? 'tier' : (i.resume_from || (i.target === 'requirements' ? 'scenario' : 'tier')));
  // 機能が作った生成物のうち、新しい上流から古くなったもの (basis の行を持つファイル)
  const stale = [];
  const changed = git(ctx.root, ['diff', '--name-only', '-z', j.base_head, j.old_head]).out.split('\0').filter(Boolean);
  const dirs = { requirements: 'docs/requirements', adr: 'docs/adr', contracts: 'contracts' };
  for (const p of changed) {
    const f = path.join(ctx.root, p);
    if (isRegenerable(p, ctx.table) || !fs.existsSync(f) || !fs.statSync(f).isFile()) continue;
    if (!parseHeader(fs.readFileSync(f, 'utf8').split('\n').slice(0, 10).join('\n'))) continue;
    const r = basisCheck(f, dirs, ctx.root);
    if (r && r.entries.some((e) => e.stale)) stale.push(p);
  }
  j.stale = stale;
  const candidates = [...fromIssues, ...j.conflicts.map(stageOfPath), ...stale.map(stageOfPath)];
  if (st.next_stage) candidates.push(st.next_stage); // 止めた段 (まだ done でない段) より後からは始めない
  j.from_stage = earliest(candidates) || 'tier';
}

function step9(ctx, j) {
  const events = runState.readEvents(ctx.runDir);
  const last = [...events].reverse().find((e) => e.type === 'resumed_after_upstream');
  if (!(last && last.from_head === j.old_head)) {
    runState.invalidateFrom(ctx.runDir, j.from_stage, `上流の直しの後に写し直した (${j.resume_no} 回目)`, { reviews: true });
    runState.appendEvent(ctx.runDir, 'resumed_after_upstream', {
      base_head: j.main_sha, from_head: j.old_head, from_stage: j.from_stage, paused_ref: j.paused_ref,
      issues: j.issues, conflicts: j.conflicts, diffs: j.diffs.map((d) => d.diff), regenerated: j.regenerated, stale: j.stale,
    });
  }
  if (revParse(ctx.root, 'main') !== j.main_sha) throw new Fail(`写し直しの途中で main が進んだ (${j.main_sha} → ${revParse(ctx.root, 'main')})。feature は付け替え済みなので止める: 人が main の変更を確かめる`);
  const paths = [`.distillery/runs/${ctx.slug}`, 'docs', 'contracts', 'apps', 'packages', '.dependency-cruiser.cjs'].filter((p) => fs.existsSync(path.join(ctx.root, p)));
  git(ctx.root, ['add', '-A', '--', ...paths]);
  const msg = [SUBJECT_RECORDS(ctx.slug), '', `続きの段: ${j.from_stage}`];
  if (ctx.coAuthor) msg.push('', `Co-Authored-By: ${ctx.coAuthor}`);
  git(ctx.root, ['commit', '-q', '-F', '-'], { input: msg.join('\n') + '\n' });
  j.final_commit = revParse(ctx.root, 'HEAD');
}

/** 処理の記録と git の状態を突き合わせる。9 の commit まで済んでいれば記録を片付けて結果を返す */
function reconcile(ctx, j, journal) {
  const tip = revParse(ctx.root, `refs/heads/feature/${ctx.slug}`);
  if (tip === j.old_head) { j.done_steps = j.done_steps.filter((s) => s < 5); return null; }
  if (j.new_commit && tip === j.new_commit) return null;
  const parent = tip ? revParse(ctx.root, `${tip}^`) : null;
  const done9 = parent && j.new_commit && parent === j.new_commit && eventsAt(ctx.root, tip, ctx.slug).some((e) => e.type === 'resumed_after_upstream' && e.from_head === j.old_head);
  if (done9) { j.final_commit = tip; j.done_steps = STEPS.slice(); writeJournal(journal, j); return finish(ctx, j, journal); }
  throw new Fail(`写し直しの記録と git の状態が食い違う (feature の先端 ${tip} が old_head ${j.old_head}・new_commit ${j.new_commit}・その次の commit のどれでもない)。人が確かめる: ${path.relative(ctx.root, journal)}`);
}

function finish(ctx, j, journal) {
  fs.rmSync(journal, { force: true });
  return { slug: ctx.slug, from_stage: j.from_stage, conflicts: j.conflicts, diffs: j.diffs.map((d) => d.diff), regenerated: j.regenerated, stale: j.stale, resumes: j.resume_no, limit: runState.MAX_RESUMES, base_head: j.main_sha, from_head: j.old_head, paused_ref: j.paused_ref, commit: j.final_commit };
}

/** stopAfter はテスト用: その段を行った直後 (処理の記録に段を足す前) に止まる。途中で落ちた起動を再現する */
function resume(rootArg, slug, { overrideLimit = false, coAuthor = null, table = REGENERABLE, stopAfter = null } = {}) {
  const root = path.resolve(rootArg);
  if (!/^[a-z][a-z0-9-]*$/.test(String(slug || ''))) throw new Fail(`slug が不正: ${slug}`, 2);
  const ctx = { root, slug, table, coAuthor, runDir: runState.runDirOf(root, slug) };
  const journal = journalPath(root, slug);
  let j = readJournal(journal);
  if (j) {
    const done = reconcile(ctx, j, journal);
    if (done) return done;
  } else {
    const tip = revParse(root, `refs/heads/feature/${slug}`);
    if (!tip) throw new Fail(`feature/${slug} が無い`);
    if (currentBranch(root) !== 'main') throw new Fail(`main の上で回す (今は ${currentBranch(root)})`);
    const dirty = trackedDirty(root);
    if (dirty.length) throw new Fail(`作業ツリーに追跡済みの変更がある: ${dirty.join(', ')}`);
    const events = eventsAt(root, tip, slug);
    const paused = runState.pausedEvent(events);
    if (!paused) throw new Fail(`feature/${slug} は上流で止まっていない`);
    const resumes = events.filter((e) => e.type === 'resumed_after_upstream').length;
    if (resumes >= runState.MAX_RESUMES && !overrideLimit) throw new Fail(`写し直しが上限 (${runState.MAX_RESUMES} 回) に達した (${resumes} 回)。人に返す`, 3, { limit_reached: true });
    const issues = runState.blockedIssues(paused);
    const left = issues.filter((i) => existsAt(root, 'main', `docs/feedback/${i.id}.md`));
    if (left.length) throw new Fail(`止めた課題がまだ main に残っている (上流の差分で反映か取り下げをしてから): ${left.map((i) => i.id).join(', ')}`);
    const base = runState.effectiveBaseHead(events);
    if (!base) throw new Fail(`feature/${slug} の run に branch_started の base_head が無い`);
    j = { slug, main_sha: revParse(root, 'main'), old_head: tip, base_head: base, resume_no: resumes + 1, issues, done_steps: [], started_at: new Date().toISOString() };
    writeJournal(journal, j);
  }
  for (;;) {
    const step = STEPS.find((s) => !j.done_steps.includes(s));
    if (step === undefined) break;
    if (step === 2) {
      j.paused_ref = j.paused_ref || `refs/distillery2/paused/${slug}/${stamp()}`;
      git(root, ['update-ref', j.paused_ref, j.old_head]);
    } else if (step === 3) step3(ctx, j);
    else if (step === 4) step4(ctx, j);
    else if (step === 5) {
      if (step5(ctx, j, journal) === 'main-moved') {
        j.main_sha = revParse(root, 'main');
        j.done_steps = j.done_steps.filter((s) => s < 3);
        writeJournal(journal, j);
        continue;
      }
      switchToFeature(ctx);
    } else {
      switchToFeature(ctx);
      if (step === 6) step6(ctx, j);
      else if (step === 7) step7(ctx, j);
      else if (step === 8) step8(ctx, j);
      else step9(ctx, j);
    }
    if (stopAfter === step) throw new Fail(`(テスト) ${step} の後で止めた`, 1, { stopped_after: step });
    j.done_steps.push(step);
    writeJournal(journal, j);
  }
  return finish(ctx, j, journal);
}

// ---- check-diffs ----

const squash = (s) => String(s).replace(/\s+/g, '');

/** 差分の追加行 (+ で始まり +++ でない行) を空白を詰めて返す (空になる行は除く) */
function addedLines(diffText) {
  return diffText.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => squash(l.slice(1))).filter(Boolean);
}

function checkDiffs(runDirArg, handoffFile) {
  const runDir = path.resolve(runDirArg);
  const root = path.resolve(runDir, '..', '..', '..');
  const last = [...runState.readEvents(runDir)].reverse().find((e) => e.type === 'resumed_after_upstream');
  const expected = last ? (last.diffs || []) : [];
  const { parseYaml } = require('./lib/yaml');
  if (!handoffFile || !fs.existsSync(handoffFile)) throw new Fail(`引き継ぎファイルが無い: ${handoffFile}`, 2);
  const text = fs.readFileSync(handoffFile, 'utf8');
  const data = handoffFile.endsWith('.json') ? JSON.parse(text) : parseYaml(text);
  const rows = Array.isArray(data && data.resume_diffs) ? data.resume_diffs : [];
  const errors = [];
  let applied = 0;
  let dropped = 0;
  for (const d of expected) {
    const row = rows.find((r) => r && r.diff === d);
    if (!row) { errors.push(`resume_diffs に無い: ${d}`); continue; }
    if (row.result === 'dropped') {
      dropped++;
      if (!row.reason || !String(row.reason).trim()) errors.push(`dropped には理由が要る: ${d}`);
      continue;
    }
    if (row.result !== 'applied') { errors.push(`result は applied か dropped: ${d} (${row.result})`); continue; }
    applied++;
    const where = String(row.where || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!where.length) { errors.push(`applied には where (反映したファイル) が要る: ${d}`); continue; }
    const body = where.map((w) => (fs.existsSync(path.join(root, w)) ? squash(fs.readFileSync(path.join(root, w), 'utf8')) : '')).join('\n');
    const diffFile = path.join(root, d);
    const missing = fs.existsSync(diffFile) ? addedLines(fs.readFileSync(diffFile, 'utf8')).filter((l) => !body.includes(l)) : [`(差分ファイルが無い: ${d})`];
    if (missing.length) errors.push(`applied なのに差分の追加行が ${where.join(', ')} に無い (${d}): ${missing.slice(0, 5).join(' / ')}${missing.length > 5 ? ` ほか ${missing.length - 5} 行` : ''}`);
  }
  for (const r of rows) if (r && !expected.includes(r.diff)) errors.push(`最後の写し直しの差分ではない: ${r.diff}`);
  return { ok: errors.length === 0, errors, applied, dropped, expected: expected.length };
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const pos = [];
  const o = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--override-limit') o.overrideLimit = true;
    else if (rest[i] === '--co-author') o.coAuthor = rest[++i];
    else if (rest[i] === '--handoff') o.handoff = rest[++i];
    else if (rest[i].startsWith('--')) throw new Fail(`不明な引数: ${rest[i]}`, 2);
    else pos.push(rest[i]);
  }
  if (cmd === 'run') {
    if (pos.length !== 2) throw new Fail('run <root> <slug> [--override-limit] [--co-author <値>]', 2);
    return { out: resume(pos[0], pos[1], o), code: 0 };
  }
  if (cmd === 'check-diffs') {
    if (pos.length !== 1) throw new Fail('check-diffs <runDir> --handoff <引き継ぎファイル>', 2);
    const r = checkDiffs(pos[0], o.handoff);
    return { out: r, code: r.ok ? 0 : 1 };
  }
  throw new Fail('resumeAfterUpstream.js run|check-diffs ...', 2);
}

if (require.main === module) {
  try {
    const { out, code } = main(process.argv.slice(2));
    console.log(JSON.stringify(out));
    process.exit(code);
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: e.message, ...(e.extra || {}) }));
    process.exit(e instanceof Fail ? e.code : 1);
  }
}

module.exports = { resume, checkDiffs, parseMergeTree, stageOfPath, isRegenerable, REGENERABLE, addedLines, journalPath, Fail };
