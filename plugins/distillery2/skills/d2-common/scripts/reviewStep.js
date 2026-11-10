#!/usr/bin/env node
/**
 * reviewStep.js — 成果物の縦・横レビューを別系統のモデル (Codex) に 1 ラウンド回す。起動・待ち・回収までを 1 回の呼び出しで行う
 *
 * Usage:
 *   node reviewStep.js run --point <場所> --target <パス> [--target ...] --out <場所の置き場> [--cwd <repo>] [--round <n> --previous <前のラウンドの md>]
 *                       [--known <課題ファイル> ...] [--runner <codex-review-job.sh>] [--deadline <秒。既定 540>] [--poll <秒。既定 30>]
 *   node reviewStep.js prompt --point <場所> --target <パス> ... --out <場所の置き場> [--round ...]   # 依頼文だけを書く (同じモデルで代わりにレビューするとき)
 *
 * 置き場は <場所の置き場>/<n>/ (0.3.0)。1 ラウンド目は新しい <n> (今ある最大 + 1 を排他的に作る)、2 ラウンド目からは --previous (前のラウンドの結果) の <n> に書く (前の結果を上書きしない)。
 * --known: 課題にした指摘 (課題ファイル) を依頼文の「既知 (報告不要)」に載せる (課題にした既存の欠陥が次のラウンドで出直さない)。
 * runner のロック (同じ workspace の別のジョブ) で起動できないときは、unavailable にせず締め切りまで待って起動し直す (ティアごとのレビューを順に回す)。
 *
 * 場所と観点は <skills>/d2-common/references/review-points.md の yaml の定義。
 * runner は toolbox プラグインの review-refute-loop の codex-review-job.sh (既定は ~/.claude/plugins/cache/ の最新版。--runner か D2_REVIEW_RUNNER で上書き)。
 * 進行役は Bash の timeout を 600000 ms にして呼ぶ。このスクリプトは --deadline (既定 540 秒) で切り上げて cancel する。
 *
 * 出力 (JSON 1 行): {status: reviewed|unavailable|timed_out|failed, point, round, dir, prompt, result, perspectives{P1: PASS|CONCERN|FAIL|UNCHECKED}, findings, high_or_critical[], has_fail, waited_for_lock?, reason?}
 * 終了コード: 0 = reviewed / 4 = 未レビュー (unavailable・timed_out・failed) / 2 = 引数の誤り
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseYaml } = require('./lib/yaml');

const POINTS_DOC = path.join(__dirname, '..', 'references', 'review-points.md');

class Fail extends Error { constructor(msg, code = 2) { super(msg); this.code = code; } }

function loadPoints(doc = POINTS_DOC) {
  const m = fs.readFileSync(doc, 'utf8').match(/## 観点の定義\n+```yaml\n([\s\S]*?)\n```/);
  if (!m) throw new Fail(`観点の定義が無い: ${doc}`);
  return parseYaml(m[1]);
}

function parseArgs(argv) {
  const o = { targets: [], known: [], cwd: process.cwd(), round: 1, deadline: 540, poll: 30 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = () => { if (argv[i + 1] == null) throw new Fail(`${a} に値が要る`); return argv[++i]; };
    if (a === '--point') o.point = v();
    else if (a === '--target') o.targets.push(v());
    else if (a === '--known') o.known.push(v());
    else if (a === '--out') o.out = v();
    else if (a === '--cwd') o.cwd = path.resolve(v());
    else if (a === '--round') o.round = Number(v());
    else if (a === '--previous') o.previous = v();
    else if (a === '--runner') o.runner = v();
    else if (a === '--deadline') o.deadline = Number(v());
    else if (a === '--poll') o.poll = Number(v());
    else throw new Fail(`不明な引数: ${a}`);
  }
  if (!o.point || !o.out || !o.targets.length) throw new Fail('--point と --target と --out が要る');
  if (!(Number.isFinite(o.deadline) && o.deadline > 0) || !(Number.isFinite(o.poll) && o.poll > 0)) throw new Fail(`--deadline と --poll は正の数 (秒): ${o.deadline} / ${o.poll}`);
  if (!(Number.isInteger(o.round) && o.round >= 1)) throw new Fail(`--round は 1 以上の整数: ${o.round}`);
  if (o.round > 1 && !o.previous) throw new Fail('2 ラウンド目には --previous が要る');
  return o;
}

/** review-refute-loop の依頼文の形 (出力の形を変えると runner の結果の検査に落ちる) */
function buildPrompt(o, perspectives) {
  const table = ['| # | 観点 | 何を見るか | 報告閾値 |', '|---|------|-----------|---------|', ...perspectives.map((p) => `| ${p.id} | ${p.name} | ${p.look} | medium 以上 |`)].join('\n');
  const prev = o.round > 1
    ? `\n【前回の指摘】\n前回 (${o.round - 1} ラウンド目) の結果は ${o.previous}。担当が反証して直した。(a) 直しが足りず残っている指摘 (b) 直しで新たに生じた問題 だけを出してください。重複指摘は不要。観点と閾値は前回と同一。\n`
    : '';
  const known = (o.known || []).map((f) => {
    const file = path.resolve(o.cwd, f);
    const m = fs.existsSync(file) ? /^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(file, 'utf8')) : null;
    const t = m ? ((m[1].match(/^title:\s*(.+)$/m) || [, ''])[1].replace(/^["']|["']$/g, '')) : '';
    return `- ${t || '(題名なし)'} (${f})`;
  });
  const knownBlock = known.length ? `\n【既知 (報告不要)】\n次は課題として記録済みで、別の手順で直す。同じ問題を指摘として出さないでください (観点の判定にも数えない):\n${known.join('\n')}\n` : '';
  return `あなたはシニアレビュアー。以下の対象を第三者視点でレビューしてください。

【対象】
リポジトリ ${o.cwd} の次のパス (distillery2 が作った「${o.point}」の成果物):
${o.targets.map((t) => `- ${t}`).join('\n')}
縦 = この成果物の入力 (前のステップの成果物) との整合、横 = 同じ成果物の中の整合を見る。入力はリポジトリの docs/ (要望の原文は docs/input/、要求・決定) と contracts/・features/ にある。
${prev}${knownBlock}
【レビュー観点と閾値 (この表以外の軸で探さない)】
${table}

- 上の表の観点だけを見てください。観点は追加も変更もしないでください。
- 各観点の閾値**未満**の気づきは本体の指摘に混ぜず、末尾の「below-threshold」に 1 行で書いてください。
- 例外: **severity が critical のものは、表に無い観点でも報告してください**。その場合 perspective は \`OUT_OF_CONTRACT\` とします。

【あなたの権限】
- シェルあり。\`rg\` / \`git log\` / \`sed -n\` で一次情報まで確認してよい
- ただし **ファイルの追記・編集・削除は禁止**。指摘のみ。

【出力形式 (厳守)】
Markdown で、次の 3 ブロックをこの順に出力してください。

(1) 観点サマリ表 — 表の**全観点を必ず 1 行ずつ**埋めること。見ていない観点を PASS と書かないこと。

| # | 観点 | 判定 | 該当指摘 | 一言根拠 |
|---|------|------|---------|---------|
| P1 | <観点名> | PASS / CONCERN / FAIL | 指摘 1, 3 | <何を確認してそう判定したか> |

- 観点 ID は \`P1\` \`P2\` … の形式で書くこと
- 時間切れで確認できなかった観点は判定を \`UNCHECKED\` とし、その旨を書く

(2) 指摘 — 各指摘を以下の構造で番号付きに。

### 指摘 N
- **perspective**: <観点 ID。契約外の critical は OUT_OF_CONTRACT>
- **対象**: <file:line, セクション名 など>
- **severity**: critical | high | medium | low | nit
- **claim**: 何が問題か(1-2 文)
- **evidence**: なぜそう言えるか。**事実だけ**
- **why_raised**: なぜこれを閾値超えと判断したか。「どんな条件で / 誰に / どんな影響が出るか」
- **suggested_fix**: どう直すべきかの案(任意)

(3) below-threshold — 閾値未満の気づき。\`- <観点 ID> <severity> <一言>\` の形で 1 行ずつ。無ければ「なし」。

閾値以上の指摘が 1 件も無い場合も (1) と (3) は必ず出し、(2) には "No findings." と書くこと。

【重要な制約】
- あなた自身がレビューを完結させること。**サブエージェント・別セッション・スキル (review-refute-loop 等) によるクロスレビューの起動は禁止**。
- 調査は **7 分以内**で切り上げ、その時点の指摘を必ず【出力形式】で直接出力して終了すること。
`;
}

/** 結果の md から観点の判定・指摘の数・high / critical の指摘番号を読む */
function summarize(md) {
  const perspectives = {};
  for (const m of md.matchAll(/^\|\s*(P\d+)\s*\|[^|]*\|\s*(PASS|CONCERN|FAIL|UNCHECKED)\s*\|/gm)) perspectives[m[1]] = m[2];
  const blocks = md.split(/^### 指摘 /m).slice(1);
  const highOrCritical = [];
  for (const b of blocks) {
    const n = b.match(/^(\d+)/);
    const sev = b.match(/\*\*severity\*\*:\s*(critical|high|medium|low|nit)/);
    if (n && sev && (sev[1] === 'high' || sev[1] === 'critical')) highOrCritical.push(`指摘 ${n[1]}`);
  }
  return { perspectives, findings: blocks.length, high_or_critical: highOrCritical, has_fail: Object.values(perspectives).includes('FAIL') };
}

function versionKey(p) { return (p.match(/toolbox\/([^/]+)\//) || [, '0'])[1].split('.').map((x) => x.padStart(6, '0')).join('.'); }

function findRunner(o) {
  const explicit = o.runner || process.env.D2_REVIEW_RUNNER;
  if (explicit) return fs.existsSync(explicit) ? explicit : null;
  const cache = path.join(os.homedir(), '.claude', 'plugins', 'cache');
  if (!fs.existsSync(cache)) return null;
  const found = [];
  for (const mk of fs.readdirSync(cache)) {
    const tb = path.join(cache, mk, 'toolbox');
    if (!fs.existsSync(tb)) continue;
    for (const ver of fs.readdirSync(tb)) {
      const f = path.join(tb, ver, 'skills', 'review-refute-loop', 'scripts', 'codex-review-job.sh');
      if (fs.existsSync(f)) found.push(f);
    }
  }
  return found.sort((a, b) => (versionKey(a) < versionKey(b) ? -1 : 1)).pop() || null;
}

// runner (codex-review-job.sh) が同じ workspace の別のジョブで起動を断るときの文言
const LOCK_RE = /another Codex review job|being launched in this workspace|workspace lock is initializing|awaiting result recovery/;

function sleep(sec) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(0, sec) * 1000); }

function call(runner, args, env) {
  return spawnSync(runner, args, { encoding: 'utf8', env: { ...process.env, ...env } });
}

/** 置き場 <場所の置き場>/<n>/: 1 ラウンド目は新しい n、2 ラウンド目からは最後の n */
function roundDir(o) {
  const base = path.resolve(o.cwd, o.out);
  const nums = fs.existsSync(base) ? fs.readdirSync(base).filter((x) => /^\d+$/.test(x) && fs.statSync(path.join(base, x)).isDirectory()).map(Number) : [];
  const last = nums.length ? Math.max(...nums) : 0;
  if (o.round > 1) {
    // 2 ラウンド目からは --previous の置き場 (別の 1 ラウンド目が後から入っても取り違えない)
    const prevDir = path.dirname(path.resolve(o.cwd, o.previous));
    if (path.dirname(prevDir) !== base || !/^\d+$/.test(path.basename(prevDir))) throw new Fail(`--previous は ${o.out}/<n>/round<k>.md (同じ場所の前のラウンドの結果): ${o.previous}`);
    if (!fs.existsSync(path.resolve(o.cwd, o.previous))) throw new Fail(`--previous が無い: ${o.previous}`);
    if (path.basename(o.previous) !== `round${o.round - 1}.md`) throw new Fail(`--previous は前のラウンドの結果 round${o.round - 1}.md: ${o.previous}`);
    if (fs.existsSync(path.join(prevDir, `round${o.round}.md`))) throw new Fail(`${o.round} ラウンド目の結果が既にある (上書きしない): ${path.join(path.relative(o.cwd, prevDir), `round${o.round}.md`)}`);
    return prevDir;
  }
  // 同時に起動した 2 つが同じ <n> を取らないよう、ディレクトリを排他的に作って番号を確保する
  fs.mkdirSync(base, { recursive: true });
  for (let n = last + 1; ; n++) {
    const d = path.join(base, String(n));
    try { fs.mkdirSync(d); return d; } catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
}

function writePrompt(o) {
  const points = loadPoints();
  const perspectives = points[o.point];
  if (!Array.isArray(perspectives) || !perspectives.length) throw new Fail(`場所の定義が無い: ${o.point} (${Object.keys(points).join(', ')})`);
  const out = roundDir(o);
  fs.mkdirSync(out, { recursive: true });
  const prompt = path.join(out, `prompt-round${o.round}.md`);
  // 既にある依頼文は上書きしない (同じラウンドを 2 度書かない)
  try { fs.writeFileSync(prompt, buildPrompt(o, perspectives), { flag: 'wx' }); }
  catch (e) { if (e.code === 'EEXIST') throw new Fail(`依頼文が既にある (上書きしない): ${path.relative(o.cwd, prompt)}`); throw e; }
  return { out, prompt };
}

function run(o) {
  const { out, prompt } = writePrompt(o);
  const base = { point: o.point, round: o.round, dir: path.relative(o.cwd, out), prompt: path.relative(o.cwd, prompt) };
  const runner = findRunner(o);
  if (!runner) return { ...base, status: 'unavailable', reason: 'review-refute-loop の runner (toolbox プラグイン) が見つからない' };
  // 締め切りは待ちとレビューを合わせて 1 つ (進行役の Bash の timeout より先に切り上げて cancel する)
  const started = Date.now();
  const left = () => o.deadline - (Date.now() - started) / 1000;
  let st;
  let waited = 0;
  let env = { CODEX_REVIEW_TIMEOUT_SECONDS: String(o.deadline) };
  // 同じ workspace の別のジョブのロックで起動できないときは、締め切りまで待って起動し直す (unavailable にしない)
  for (;;) {
    env = { CODEX_REVIEW_TIMEOUT_SECONDS: String(Math.max(1, Math.floor(left()))) };
    st = call(runner, ['start', prompt, o.cwd], env);
    const err = String(st.stderr || '');
    if (st.status === 0 || !LOCK_RE.test(err) || left() <= o.poll) break;
    waited++;
    sleep(o.poll);
  }
  const job = (st.stdout || '').trim().split('\n').pop();
  if (st.status !== 0 || !job) return { ...base, status: 'unavailable', ...(waited ? { waited_for_lock: waited } : {}), reason: `起動できない: ${(st.stderr || '').trim().split('\n').pop() || `exit ${st.status}`}` };
  let verdict = 'unknown';
  for (;;) {
    sleep(Math.max(0, Math.min(o.poll, left())));
    const s = call(runner, ['status', job, o.cwd], env);
    try { verdict = JSON.parse(s.stdout).verdict; } catch { verdict = 'unknown'; }
    // 締め切りを過ぎた完了は受理しない (進行役の Bash の timeout より先に切り上げる約束)
    if (verdict === 'done' && left() >= 0) break;
    const elapsed = (Date.now() - started) / 1000;
    if (['stuck', 'failed', 'timed_out', 'cancelled'].includes(verdict) || elapsed > o.deadline) {
      call(runner, ['cancel', job, o.cwd], env);
      return { ...base, status: verdict === 'failed' ? 'failed' : 'timed_out', job, reason: `verdict ${verdict}、経過 ${Math.round(elapsed)} 秒` };
    }
  }
  const resultFile = path.join(out, `round${o.round}.md`);
  const r = call(runner, ['result', job, resultFile, o.cwd], env);
  if (r.status !== 0 || !fs.existsSync(resultFile)) return { ...base, status: 'failed', job, reason: `回収できない: ${(r.stderr || r.stdout || '').trim().split('\n').pop()}` };
  const md = fs.readFileSync(resultFile, 'utf8');
  const sum = summarize(md);
  const want = (loadPoints()[o.point] || []).map((p) => p.id);
  const missing = want.filter((id) => !sum.perspectives[id]);
  // 指摘ごとに perspective・severity・claim が要る (途中で切れた結果を、読めない指摘のまま受理しない)
  const broken = md.split(/^### 指摘 /m).slice(1).filter((b) => !/\*\*perspective\*\*:/.test(b) || !/\*\*severity\*\*:\s*(critical|high|medium|low|nit)/.test(b) || !/\*\*claim\*\*:\s*\S/.test(b)).map((b) => `指摘 ${(b.match(/^(\d+)/) || [, '?'])[1]}`);
  if (broken.length) return { ...base, status: 'failed', job, result: path.relative(o.cwd, resultFile), reason: `指摘の欄が足りない: ${broken.join(', ')}` };
  if (missing.length || !(/^### 指摘 \d+/m.test(md) || /No findings\./.test(md))) {
    return { ...base, status: 'failed', job, result: path.relative(o.cwd, resultFile), reason: `結果の形が足りない (判定の無い観点: ${missing.join(', ') || 'なし'}、指摘の節: ${/^### 指摘 \d+/m.test(md) || /No findings\./.test(md) ? 'あり' : 'なし'})` };
  }
  return { ...base, status: 'reviewed', job, result: path.relative(o.cwd, resultFile), ...(waited ? { waited_for_lock: waited } : {}), ...sum };
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const o = parseArgs(rest);
  if (cmd === 'prompt') { const { prompt } = writePrompt(o); return { out: { prompt: path.relative(o.cwd, prompt) }, code: 0 }; }
  if (cmd !== 'run') throw new Fail('reviewStep.js run|prompt ...');
  const res = run(o);
  return { out: res, code: res.status === 'reviewed' ? 0 : 4 };
}

if (require.main === module) {
  try { const { out, code } = main(process.argv.slice(2)); console.log(JSON.stringify(out)); process.exit(code); }
  catch (e) { console.log(JSON.stringify({ status: 'error', error: e.message })); process.exit(e.code || 2); }
}

module.exports = { loadPoints, buildPrompt, summarize, findRunner, run, main, roundDir, LOCK_RE };
