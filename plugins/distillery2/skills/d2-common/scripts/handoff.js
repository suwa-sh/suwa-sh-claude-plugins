#!/usr/bin/env node
/**
 * handoff.js — 担当の引き継ぎファイル (人に聞くこと・前のステップの課題・反証) を検査し、振り分け、課題の下書きにする
 *
 * Usage:
 *   node handoff.js validate <handoff.yaml>                         # 形の検査。JSON 1 行 {ok, errors[], asks, upstream_issues, refutations}
 *   node handoff.js route <handoff.yaml> --mode auto|recommend      # 問いの振り分け。JSON 1 行 {decide[], to_human[], issues{in_feature[], upstream[]}, needs_info[]}
 *   node handoff.js file-drafts <handoff.yaml> --run <runDir>       # 前のステップの課題を <run>/issues/ の下書きにする (機能の中)
 *   node handoff.js file-drafts <handoff.yaml> --root <repo>        # 上流の段 (run が無い): docs/feedback/ に課題ファイルを直接書く
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
const KIND_OF = { requirements: 'requirement', decide: 'rule', foundation: 'foundation', scenario: 'scenario', contract: 'contract', implementation: 'implementation' };

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
  for (const a of data.asks || []) {
    if (a.recommended === null || a.recommended === undefined) toHuman.push({ id: a.id, reason: 'no_recommendation' });
    else if (a.kind === 'unknown_fact' && mode === 'auto') toHuman.push({ id: a.id, reason: 'unknown_fact' });
    else decide.push({ id: a.id, answer: a.recommended, provisional: a.kind === 'unknown_fact' });
  }
  const issues = { in_feature: [], upstream: [] };
  for (const u of data.upstream_issues || []) {
    (IN_FEATURE.has(u.target_step) ? issues.in_feature : issues.upstream).push({ id: u.id, target_step: u.target_step, title: u.title });
  }
  const needsInfo = (data.refutations || []).filter((r) => r.result === 'needs_info').map((r) => r.finding);
  return { decide, to_human: toHuman, issues, needs_info: needsInfo };
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

const squashTitle = (t) => String(t || '').replace(/\s+/g, '');

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
function fileDrafts(file, data, { run, root, chainFrom = null }) {
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
    const fm = { kind: KIND_OF[u.target_step], title: u.title, target_step: u.target_step, source: `handoff:${step}`, ...(u.resume_from ? { resume_from: u.resume_from } : {}), ...(chain || {}) };
    let dest;
    if (run) {
      dest = path.join(path.resolve(run), 'issues', `${stamp()}_${step}_${name}`);
      const dir = path.dirname(dest);
      if (fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith(`_${step}_${name}`))) { skipped.push(name); continue; }
      if (known.has(key)) { duplicates.push({ id: u.id, title: u.title }); continue; }
    } else {
      dest = path.join(path.resolve(root), 'docs', 'feedback', `${stamp()}_${step}_${name}`);
      const dir = path.dirname(dest);
      if (fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith(`_${step}_${name}`))) { skipped.push(name); continue; }
      if (known.has(key)) { duplicates.push({ id: u.id, title: u.title }); continue; }
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
    else throw new Fail(`不明な引数: ${rest[i]}`, 2);
  }
  if (!['validate', 'route', 'file-drafts'].includes(cmd)) throw new Fail('handoff.js validate|route|file-drafts <file> ...', 2);
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
  if (cmd === 'validate' || errors.length) {
    const counts = errors.length ? {} : { asks: data.asks.length, upstream_issues: data.upstream_issues.length, refutations: (data.refutations || []).length };
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

module.exports = { validate, route, fileDrafts, main, KIND_OF, IN_FEATURE, UPSTREAM };
