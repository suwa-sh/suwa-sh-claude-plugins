#!/usr/bin/env node
/**
 * handoff.js — 担当の引き継ぎファイル (人に聞くこと・前のステップの課題・反証) を検査し、振り分け、課題の下書きにする
 *
 * Usage:
 *   node handoff.js validate <handoff.yaml> [--report <報告のファイル>]   # 形の検査。JSON 1 行 {ok, errors[], asks, upstream_issues, refutations, decisions}
 *     --report: 報告の本文の「決めたこと」の D<n> と引き継ぎファイルの decisions が 1 対 1 で、見出しの下に D<n> で始まらない行が無いこと (0.3.0)
 *   node handoff.js route <handoff.yaml> --mode auto|recommend      # 問いの振り分け。JSON 1 行 {decide[], to_human[], issues{in_feature[], upstream[]}, needs_info[]}
 *   node handoff.js file-drafts <handoff.yaml> --run <runDir>       # 前のステップの課題を <run>/issues/ の下書きにする (機能の中)
 *   node handoff.js file-drafts <handoff.yaml> --root <repo>        # 上流の段 (run が無い): docs/feedback/ に課題ファイルを直接書く
 *   node handoff.js file-drafts <round<n>.md> --review --target <戻し先> --run <runDir>   # 処理していないレビューの指摘を下書きにする (上流で止める前。0.3.0)
 *   --findings                                                     # 入力が検証役の findings (asks と upstream_issues を読む)
 *   --chain-from <docs/feedback/<id>.md>                           # 上流の差分のレビュー・反証から課題を作るとき、直している課題。chain と chain_depth + 1 を書く (0.3.0)
 *   file-drafts は、戻し先と題名が同じ既存の下書き・その場で直した下書き・課題ファイルがあれば書かない (duplicates に返す。0.3.0)
 *
 * 終了コード: 0 = 成功 / 1 = 検査で不合格 / 2 = 引数・読み込みの失敗
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseYaml, stringifyYaml } = require('./lib/yaml');
const { validateWithSchema } = require('./lib/schemaValidate');

const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema-handoff.json'), 'utf8'));
const IN_FEATURE = new Set(['scenario', 'contract', 'implementation']);
const UPSTREAM = new Set(['requirements', 'decide', 'foundation']);
// target_step → 課題ファイルの kind (古い版が kind で読むための互換。0.2.0 の振り分けは target_step を見る)
const KIND_OF = { requirements: 'requirement', decide: 'rule', foundation: 'foundation', scenario: 'scenario', contract: 'contract', implementation: 'implementation', plugin: 'plugin' };

class Fail extends Error { constructor(msg, code = 1) { super(msg); this.code = code; } }

function load(file) {
  if (!file || !fs.existsSync(file)) throw new Fail(`引き継ぎファイルが無い: ${file}`, 2);
  const text = fs.readFileSync(file, 'utf8');
  try { return file.endsWith('.json') ? JSON.parse(text) : parseYaml(text); }
  catch (e) { throw new Fail(`読めない: ${file}: ${e.message}`, 2); }
}

/** 形の検査と、schema で書けない規則 (推奨は選択肢の 1 つ・推奨なしは理由が要る・id の重複) */
function validate(data) {
  const errors = validateWithSchema(data, SCHEMA).map((e) => `${e.path}: ${e.message}`);
  if (!data || typeof data !== 'object') return errors;
  const seen = new Set();
  for (const [i, a] of (Array.isArray(data.asks) ? data.asks : []).entries()) {
    if (!a || typeof a !== 'object') continue;
    if (seen.has(`ask:${a.id}`)) errors.push(`$.asks[${i}].id: 重複 ${a.id}`);
    seen.add(`ask:${a.id}`);
    // 同じ問いを 2 つに分けて書かない (推奨で決める問いと人に返す問いの両方に同じ論点が出る。0.3.0)
    const q = String(a.question || '').replace(/\s+/g, '');
    if (q && seen.has(`question:${q}`)) errors.push(`$.asks[${i}].question: 同じ問いが既にある (${a.question})`);
    seen.add(`question:${q}`);
    const labels = (Array.isArray(a.options) ? a.options : []).map((o) => o && o.label);
    if (new Set(labels).size !== labels.length) errors.push(`$.asks[${i}].options: label が重複`);
    if (a.recommended === null || a.recommended === undefined) {
      if (!a.no_recommendation_reason) errors.push(`$.asks[${i}]: recommended が null なら no_recommendation_reason が要る`);
    } else if (!labels.includes(a.recommended)) {
      errors.push(`$.asks[${i}].recommended: 選択肢の label のどれでもない (${a.recommended})`);
    } else if (!a.reason || !String(a.reason).trim()) {
      errors.push(`$.asks[${i}].reason: 推奨があるなら理由が要る`);
    }
  }
  for (const [i, d] of (Array.isArray(data.decisions) ? data.decisions : []).entries()) {
    if (!d || typeof d !== 'object') continue;
    if (seen.has(`decision:${d.id}`)) errors.push(`$.decisions[${i}].id: 重複 ${d.id}`);
    seen.add(`decision:${d.id}`);
  }
  for (const [i, u] of (Array.isArray(data.upstream_issues) ? data.upstream_issues : []).entries()) {
    if (!u || typeof u !== 'object') continue;
    if (seen.has(`issue:${u.id}`)) errors.push(`$.upstream_issues[${i}].id: 重複 ${u.id}`);
    seen.add(`issue:${u.id}`);
  }
  return errors;
}

/**
 * 人に返す条件 (d2-run の「人に返すとき」の表の、引き継ぎファイルの分)。
 * choice で推奨あり → 推奨で決める / unknown_fact → auto は人へ、recommend は推奨で仮置き / 推奨なし → 人へ (両モード)
 */
function route(data, mode) {
  if (!['auto', 'recommend'].includes(mode)) throw new Fail(`--mode は auto か recommend: ${mode}`, 2);
  const decide = [];
  const toHuman = [];
  const makeRecommendation = [];
  for (const a of data.asks || []) {
    // 推奨の無い問い: auto は人へ。recommend は進行役が推奨を作って仮置きする (0.3.0。止まるのは上限超えとプラグインの不具合だけ)
    if (a.recommended === null || a.recommended === undefined) (mode === 'recommend' ? makeRecommendation : toHuman).push({ id: a.id, reason: 'no_recommendation' });
    else if (a.kind === 'unknown_fact' && mode === 'auto') toHuman.push({ id: a.id, reason: 'unknown_fact' });
    else decide.push({ id: a.id, answer: a.recommended, provisional: a.kind === 'unknown_fact' });
  }
  const issues = { in_feature: [], upstream: [], plugin: [] };
  for (const u of data.upstream_issues || []) {
    const to = u.target_step === 'plugin' ? issues.plugin : (IN_FEATURE.has(u.target_step) ? issues.in_feature : issues.upstream);
    to.push({ id: u.id, target_step: u.target_step, title: u.title });
  }
  const needsInfo = (data.refutations || []).filter((r) => r.result === 'needs_info').map((r) => r.finding);
  const plugin = (data.refutations || []).filter((r) => r.result === 'plugin').map((r) => r.finding);
  return { decide, to_human: toHuman, make_recommendation: makeRecommendation, issues, needs_info: needsInfo, plugin_findings: plugin };
}

/** レビューの結果 (round<n>.md の「### 指摘 N」) を前のステップの課題にする (上流で止める前に、処理していない指摘を下書きに残す) */
function reviewToHandoff(md, target, point) {
  const field = (b, k) => { const m = b.match(new RegExp(`\\*\\*${k}\\*\\*:\\s*([^\\n]*(?:\\n(?!- \\*\\*)[^\\n#]+)*)`)); return m ? m[1].trim() : ''; };
  const issues = md.split(/^### 指摘 /m).slice(1).map((b) => {
    const n = (b.match(/^(\d+)/) || [, '?'])[1];
    const claim = field(b, 'claim') || '(claim なし)';
    const where = field(b, '対象');
    return {
      id: `R${n}`, target_step: target, title: claim.length > 40 ? `${claim.slice(0, 39)}…` : claim,
      detail: `${claim}${where ? `\n\n対象: ${where}` : ''}\n\n(${point} のレビューの指摘 ${n}。severity: ${field(b, 'severity') || '?'}。反証して直す前に機能を止めたので下書きに残した)`,
      evidence: field(b, 'evidence') || '(evidence なし)', recommended_fix: field(b, 'suggested_fix') || '(レビューの案なし)',
    };
  });
  return { schema_version: 'distillery2.handoff/v1', step: `review-${point}`.replace(/[^a-z0-9-]/g, '-'), asks: [], upstream_issues: issues };
}

/** 報告の本文の「決めたこと」を引き継ぎファイルの decisions と突き合わせる (ID の無い判断を拒む。0.3.0) */
function checkReport(data, reportText) {
  const errors = [];
  const ids = (data.decisions || []).map((d) => d.id);
  const lines = reportText.split('\n');
  const h = lines.findIndex((l) => /^#{1,6}\s.*決めたこと/.test(l));
  const body = h < 0 ? [] : lines.slice(h + 1, (() => { const k = lines.slice(h + 1).findIndex((l) => /^#{1,6}\s/.test(l)); return k < 0 ? lines.length : h + 1 + k; })());
  const listed = [];
  for (const l of body) {
    if (!l.trim() || /^\s*(なし|無し|-\s*なし)\s*$/.test(l)) continue;
    const m = l.match(/^\s*(?:[-*]|\d+\.)?\s*(D\d+)\b/);
    if (!m) { errors.push(`「決めたこと」に D<n> で始まらない行がある: ${l.trim().slice(0, 60)}`); continue; }
    listed.push(m[1]);
  }
  const mentioned = [...new Set((reportText.match(/\bD\d+\b/g) || []))];
  for (const d of mentioned) if (!ids.includes(d)) errors.push(`本文の ${d} が引き継ぎファイルの decisions に無い`);
  if (listed.length !== ids.length) errors.push(`「決めたこと」の件数 (${listed.length}) と decisions の件数 (${ids.length}) が違う`);
  for (const d of ids) if (!listed.includes(d)) errors.push(`decisions の ${d} が本文の「決めたこと」に無い`);
  return errors;
}

/** UC 一覧の slug (無ければ null = 照らさない。要求の段の前など) */
function ucSlugs(root) {
  const f = path.join(path.resolve(root), 'docs', 'requirements', 'use-cases.yaml');
  if (!fs.existsSync(f)) return null;
  const doc = parseYaml(fs.readFileSync(f, 'utf8')) || {};
  return new Set((doc.use_cases || []).map((u) => u && u.slug).filter(Boolean));
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}_${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

function issueBody(u) {
  const parts = [u.detail.trim()];
  if (u.evidence) parts.push(`## 根拠\n\n${u.evidence.trim()}`);
  if (u.recommended_fix) parts.push(`## 推奨の直し方\n\n${u.recommended_fix.trim()}`);
  return `\n${parts.join('\n\n')}\n`;
}

// 重ねの比較は空白と、止めた課題の印 (feedbackBatch.js hold が題名に付ける「止まった: 」) を除いて行う
const squashTitle = (t) => String(t || '').replace(/^止まった:\s*/, '').replace(/\s+/g, '');

/** 既にある課題 (下書き・その場で直した下書き・課題ファイル) の 戻し先 + 題名 の組。同じ組の課題を重ねて書かない (0.3.0) */
function existingKeys(dirs) {
  const keys = new Set();
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.md') && x !== 'README.md')) {
      const m = /^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(path.join(d, f), 'utf8'));
      if (!m) continue;
      const fm = parseYaml(m[1]) || {};
      if (fm.title) keys.add(`${fm.target_step || KIND_TO_STEP[fm.kind] || ''}\n${squashTitle(fm.title)}`);
    }
  }
  return keys;
}
const KIND_TO_STEP = Object.fromEntries(Object.entries(KIND_OF).map(([k, v]) => [v, k]));

/** 連鎖の元の課題ファイル (上流の差分で直している課題) から chain と chain_depth + 1 を決める */
function chainOf(chainFrom) {
  if (!chainFrom) return null;
  if (!fs.existsSync(chainFrom)) throw new Fail(`--chain-from の課題ファイルが無い: ${chainFrom}`, 2);
  const m = /^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(chainFrom, 'utf8'));
  const fm = (m && parseYaml(m[1])) || {};
  return { chain: fm.chain || path.basename(chainFrom, '.md'), chain_depth: Number(fm.chain_depth || 0) + 1 };
}

/**
 * 前のステップの課題を下書き (機能の中) か課題ファイル (上流) にする。同じ課題を二度書かない
 * (handoff と id で名前を決める。加えて、戻し先と題名が同じ既存の下書き・課題ファイルがあれば書かない。0.3.0)。
 * chainFrom (上流の差分のレビュー・反証から課題を作るとき、直している課題ファイル) を渡すと chain と chain_depth を書く
 */
function fileDrafts(file, data, { run, root, chainFrom = null, byTitle = true }) {
  if (!run && !root) throw new Fail('--run か --root が要る', 2);
  const step = data.step || 'verify';
  const base = path.basename(file).replace(/\.(ya?ml|json)$/, '');
  const repo = root ? path.resolve(root) : path.resolve(run, '..', '..', '..');
  const known = existingKeys([path.join(repo, 'docs', 'feedback'), ...(run ? [path.join(path.resolve(run), 'issues'), path.join(path.resolve(run), 'issues', 'consumed')] : [])]);
  const chain = chainOf(chainFrom);
  // 書く前に全件を確かめる (途中で落ちて一部の課題だけが残らないように)
  if (!run) {
    const slugs = ucSlugs(root);
    for (const u of data.upstream_issues || []) {
      if (!IN_FEATURE.has(u.target_step)) continue;
      if (!u.uc) throw new Fail(`課題 ${u.id}: 戻し先が ${u.target_step} なら uc (対象の UC の slug) が要る`, 1);
      if (slugs && !slugs.has(u.uc)) throw new Fail(`課題 ${u.id}: uc ${u.uc} が UC 一覧 (docs/requirements/use-cases.yaml) に無い`, 1);
    }
  }
  const written = [];
  const skipped = [];
  const duplicates = [];
  for (const u of data.upstream_issues || []) {
    const name = `${base}_${u.id}.md`.replace(/[^A-Za-z0-9_.-]/g, '-');
    const key = `${u.target_step}\n${squashTitle(u.title)}`;
    const fm = { kind: KIND_OF[u.target_step], title: u.title, ...(u.target_step === 'plugin' ? {} : { target_step: u.target_step }), source: `handoff:${step}`, ...(u.resume_from ? { resume_from: u.resume_from } : {}), ...(chain || {}) };
    let dest;
    if (run) {
      dest = path.join(path.resolve(run), 'issues', `${stamp()}_${step}_${name}`);
      const dir = path.dirname(dest);
      if (fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith(`_${step}_${name}`))) { skipped.push(name); continue; }
      if (byTitle && known.has(key)) { duplicates.push({ id: u.id, title: u.title }); continue; }
    } else {
      dest = path.join(path.resolve(root), 'docs', 'feedback', `${stamp()}_${step}_${name}`);
      const dir = path.dirname(dest);
      if (fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith(`_${step}_${name}`))) { skipped.push(name); continue; }
      if (byTitle && known.has(key)) { duplicates.push({ id: u.id, title: u.title }); continue; }
      Object.assign(fm, { from_uc: u.uc || null, status: 'open', created: new Date().toISOString().replace(/\.\d+Z$/, 'Z') });
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, `---\n${stringifyYaml(fm).trimEnd()}\n---\n${issueBody(u)}`);
    known.add(key);
    written.push(dest);
  }
  return { written, skipped, duplicates };
}

function main(argv) {
  const [cmd, file, ...rest] = argv;
  const opt = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--mode') opt.mode = rest[++i];
    else if (rest[i] === '--run') opt.run = rest[++i];
    else if (rest[i] === '--root') opt.root = rest[++i];
    else if (rest[i] === '--findings') opt.findings = true;
    else if (rest[i] === '--chain-from') opt.chainFrom = rest[++i];
    else if (rest[i] === '--review') opt.review = true;
    else if (rest[i] === '--target') opt.target = rest[++i];
    else if (rest[i] === '--report') opt.report = rest[++i];
    else throw new Fail(`不明な引数: ${rest[i]}`, 2);
  }
  if (!['validate', 'route', 'file-drafts'].includes(cmd)) throw new Fail('handoff.js validate|route|file-drafts <file> ...', 2);
  if (opt.review) {
    if (cmd !== 'file-drafts' || !opt.run) throw new Fail('--review は file-drafts <round<n>.md> --review --target <戻し先> --run <runDir> で使う', 2);
    if (!opt.target || !(IN_FEATURE.has(opt.target) || UPSTREAM.has(opt.target))) throw new Fail(`--target は戻し先 (requirements / decide / foundation / scenario / contract / implementation): ${opt.target}`, 2);
    if (!file || !fs.existsSync(file)) throw new Fail(`レビューの結果が無い: ${file}`, 2);
    const point = path.basename(path.dirname(path.dirname(path.resolve(file)))) || 'review';
    const sub = reviewToHandoff(fs.readFileSync(file, 'utf8'), opt.target, point);
    // レビューの指摘は 1 件ずつ別の課題 (切り詰めた題名が同じでも重ねない。同じ回の 2 度目は名前で重ねない)
    return { out: { ok: true, ...fileDrafts(file, sub, { ...opt, byTitle: false }) }, code: 0 };
  }
  const data = load(file);
  if (opt.findings) {
    // 検証役の findings は schema が別 (validateAssumptions.js verdicts が見る)。ここでは引き継ぎの欄 (asks と upstream_issues) だけを使う
    const sub = { schema_version: 'distillery2.handoff/v1', step: 'verify', asks: data.asks || [], upstream_issues: data.upstream_issues || [] };
    const errs = validate(sub);
    if (errs.length) return { out: { ok: false, errors: errs }, code: 1 };
    if (cmd !== 'file-drafts') return { out: { ok: true, ...route(sub, opt.mode || 'auto') }, code: 0 };
    return { out: { ok: true, ...fileDrafts(file, sub, opt) }, code: 0 };
  }
  const errors = validate(data);
  if (cmd === 'validate' && opt.report) {
    if (!fs.existsSync(opt.report)) throw new Fail(`報告のファイルが無い: ${opt.report}`, 2);
    errors.push(...checkReport(data, fs.readFileSync(opt.report, 'utf8')));
  }
  if (cmd === 'validate' || errors.length) {
    const counts = errors.length ? {} : { asks: data.asks.length, upstream_issues: data.upstream_issues.length, refutations: (data.refutations || []).length, decisions: (data.decisions || []).length };
    return { out: { ok: !errors.length, errors, ...counts }, code: errors.length ? 1 : 0 };
  }
  if (cmd === 'route') return { out: { ok: true, ...route(data, opt.mode || 'auto') }, code: 0 };
  return { out: { ok: true, ...fileDrafts(file, data, opt) }, code: 0 };
}

if (require.main === module) {
  try {
    const { out, code } = main(process.argv.slice(2));
    console.log(JSON.stringify(out));
    process.exit(code);
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: e.message }));
    process.exit(e.code || 2);
  }
}

module.exports = { validate, route, fileDrafts, main, KIND_OF, IN_FEATURE, UPSTREAM, reviewToHandoff, checkReport };
