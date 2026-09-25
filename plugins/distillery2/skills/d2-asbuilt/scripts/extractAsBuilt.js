#!/usr/bin/env node
/**
 * extractAsBuilt.js — 実装から as-built ドキュメントを抽出する (段階④ の最後)
 *
 * 入力 (すべて任意。無ければ該当節に「なし」と書く):
 *   .distillery/config.yaml                       ティア・契約・docs_root
 *   docs/requirements/use-cases.yaml              UC 一覧 (run の slug で該当 UC を引く。actors / tiers)
 *   docs/requirements/requirements.yaml           受入基準
 *   docs/adr/*.md                                 レイヤ規則 (arch_test.level: layer) → 計装の範囲の期待値
 *   <run>/reports/gates.json / *.json             ゲート結果・cucumber JSON・vitest JSON
 *   <run>/traces/<scenario>.jsonl                 実行トレース (traceTree.js の形)
 *   <run>/attempt-<n>/assumptions.<tier>.yaml     AssumptionRecord
 *   <run>/attempt-<n>/findings.<tier>.yaml        Verifier の findings
 *   <run>/events.jsonl                            review_approved の決定・generated_at の元
 *   <run>/issues/*.md                             仕様起因の課題 (front matter kind/title)
 *   contracts/generated/slices/<slug>/contract-slice.json
 *   contracts/generated/openapi.bundle.yaml       api-inventory.md 用
 *   docs/design/screens.yaml                      画面 ↔ UC
 *   <run>/reports/depcruise.json (または --depcruise)  dependency-graph.md 用
 *
 * 出力:
 *   docs/as-built/<業務>/<UC>/{index.md, sequence.md}
 *   docs/as-built/_system/{traceability-index.json, api-inventory.md, dependency-graph.md, data-flow.md, index.md}
 *
 * index.md は読者の問いの順 (何をする → 結果 → 入口 → どう動く → 何を守る → 決めたこと → 課題 → 証跡 → 付録)。
 * 決定論: 同じ入力なら同じ出力。generated_at のみ最新イベント ts (壁時計ではない)。
 * 要約節は `<!-- 要約:begin <名前> -->…<!-- 要約:end -->` の中身を再実行でも保存する。
 *
 * Usage:
 *   node extractAsBuilt.js --run <runDir> [--cwd <repo>] [--config <path>] [--docs-root <dir>] [--depcruise <path>] [--changed <file>]
 * npm 依存なし。共有ライブラリ (../../../scripts/lib) のみ。
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseYaml } = require('../../../scripts/lib/yaml');
const { stamp, headerLine } = require('../../../scripts/lib/basis');
const { writeCanonicalJson, readCanonicalJson } = require('../../../scripts/lib/canonicalJson');
const { readEvents } = require('../../../scripts/lib/runState');
const { renderScenario, pickHappyPath, summarizeScenario } = require('./renderSequence');
const { buildFlows, renderFlowchart, renderSystemDataFlow } = require('./renderDataFlow');
const { buildTree, observedPlacements, cmpStr } = require('./traceTree');
const { check: checkSummaries } = require('./checkAsBuilt');
const { deriveFromTraces, groupChangedFiles, changedFilesFromGit, loadTraces } = require('./buildTraceIndex');

// ---------------------------------------------------------------------------
// 小道具
// ---------------------------------------------------------------------------

function readTextIfExists(p) { return p && fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
function readYamlIfExists(p) { const t = readTextIfExists(p); return t == null ? null : parseYaml(t); }
function readJsonIfExists(p) { const t = readTextIfExists(p); if (t == null) return null; try { return JSON.parse(t); } catch { return null; } }

function ensureWrite(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function headSha(cwd) {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null; } catch { return null; }
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = sortKeysDeep(value[k]);
    return out;
  }
  return value;
}

/** YAML front matter を持つ md を {data, body} に分ける。 */
function parseFrontMatter(text) {
  const lines = String(text || '').split('\n');
  if (lines[0] !== '---') return { data: {}, body: text || '' };
  let end = -1;
  for (let i = 1; i < lines.length; i++) if (lines[i] === '---') { end = i; break; }
  if (end < 0) return { data: {}, body: text };
  const data = parseYaml(lines.slice(1, end).join('\n')) || {};
  return { data, body: lines.slice(end + 1).join('\n') };
}

function mdEscape(s) { return String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' '); }
function short(sha) { return sha ? String(sha).slice(0, 7) : ''; }

/** gates.json の all_recorded (全段が記録済みか)。旧形式 (all_recorded 無し) は missing 段の有無で判定する。 */
function gatesAllRecorded(gates) {
  if (!gates) return false;
  if (typeof gates.all_recorded === 'boolean') return gates.all_recorded;
  return ((gates.gates) || []).every((g) => g.status !== 'missing');
}
function gatesMissing(gates) {
  return (((gates && gates.gates) || []).filter((g) => g.status === 'missing')).map((g) => g.name);
}

// 内部 ID → 読める言葉
const CATEGORY_JA = { persistence: '永続化', error_handling: 'エラー処理', data_format: 'データ形式', input_validation: '入力検証', security: 'セキュリティ', concurrency: '並行性' };
const VERDICT_JA = { consistent: '仕様と一致', spec_absent: '仕様に無い', contradicts: '仕様と矛盾', unlisted: '未申告' };
const DECISION_JA = { confirmed: '人が承認', auto_confirmed: '自動承認', rejected: '却下' };
const KIND_JA = { rule: 'ルール', contract: '契約', requirement: '要求' };
const ja = (map, v, fallback) => (v == null || v === '' ? fallback : (map[v] || String(v)));

// ---------------------------------------------------------------------------
// レポートの解釈 (Context7 で確認済みの形)
// ---------------------------------------------------------------------------

/** cucumber-js の legacy JSON formatter (feature 配列) → シナリオ配列。 */
function parseCucumberReport(json) {
  const out = [];
  if (!Array.isArray(json)) return out;
  for (const feature of json) {
    const featureName = feature && feature.name;
    for (const el of (feature && feature.elements) || []) {
      if (el.type && el.type !== 'scenario' && el.type !== 'scenario_outline') continue;
      const steps = el.steps || [];
      let nanos = 0;
      for (const s of steps) if (s.result && typeof s.result.duration === 'number') nanos += s.result.duration;
      out.push({
        feature: featureName,
        name: el.name,
        tags: (el.tags || []).map((t) => t.name).sort(),
        status: scenarioStatus(steps),
        duration_ms: Math.round(nanos / 1e6),
      });
    }
  }
  out.sort((a, b) => cmpStr(a.name, b.name));
  return out;
}

function scenarioStatus(steps) {
  // hook (Before / After。name が無い) は成功なら本体の結果に数えない: @browser を off で skip したシナリオは
  // 本体が全部 skipped でも After hook が passed になり、passed と誤判定していた。hook の失敗はシナリオの失敗
  const all = steps || [];
  const isHook = (s) => s && (s.name == null || s.name === '' || /^(Before|After)\s*$/.test(String(s.keyword || '')));
  if (all.some((s) => isHook(s) && s.result && s.result.status === 'failed')) return 'failed';
  const body = all.filter((s) => !isHook(s));
  const st = (body.length ? body : all).map((s) => (s.result && s.result.status) || 'unknown');
  if (!st.length) return 'unknown';
  if (st.includes('failed')) return 'failed';
  if (st.includes('undefined')) return 'undefined';
  if (st.includes('ambiguous')) return 'ambiguous';
  if (st.includes('pending')) return 'pending';
  if (st.every((x) => x === 'skipped')) return 'skipped';
  if (st.every((x) => x === 'passed' || x === 'skipped')) return 'passed';
  return 'unknown';
}

/** vitest の JSON reporter → 件数。 */
function parseVitestReport(json) {
  if (!json) return null;
  return {
    total: json.numTotalTests || 0,
    passed: json.numPassedTests || 0,
    failed: json.numFailedTests || 0,
    pending: json.numPendingTests || 0,
    todo: json.numTodoTests || 0,
  };
}

// ---------------------------------------------------------------------------
// 収集
// ---------------------------------------------------------------------------

function collect(opts) {
  const cwd = opts.cwd;
  const runDir = opts.run;
  const slug = path.basename(runDir);
  const config = readYamlIfExists(path.resolve(cwd, opts.config)) || {};
  const docsRoot = opts.docsRoot || config.docs_root || 'docs';
  const docs = (rel) => path.resolve(cwd, docsRoot, rel);

  const ucDoc = readYamlIfExists(docs('requirements/use-cases.yaml')) || {};
  const ucs = ucDoc.use_cases || ucDoc.ucs || [];
  const uc = ucs.find((u) => u.slug === slug) || { slug, uc: slug, business: '未分類', buc: '', spec_ids: [], actors: [] };

  const reqDoc = readYamlIfExists(docs('requirements/requirements.yaml')) || {};

  const reportsDir = path.join(runDir, 'reports');
  const gates = readJsonIfExists(path.join(reportsDir, 'gates.json'));
  const ucBdd = parseCucumberReport(readJsonIfExists(path.join(reportsDir, 'uc-bdd.json')));
  const acceptance = parseCucumberReport(readJsonIfExists(path.join(reportsDir, 'acceptance-api.json')));
  // ブラウザ受入だけ再実行した結果も証跡・追跡表へ取り込む。同じ cucumber JSON 形。
  const acceptanceBrowser = parseCucumberReport(readJsonIfExists(path.join(reportsDir, 'acceptance-browser.json')));
  const scenarios = mergeScenarios(ucBdd, acceptance, acceptanceBrowser);

  const tiers = config.tiers || [];
  const unitByTier = {};
  const contractByTier = {};
  for (const t of tiers) {
    unitByTier[t.id] = parseVitestReport(readJsonIfExists(path.join(reportsDir, `unit.${t.id}.json`)));
    contractByTier[t.id] = parseVitestReport(readJsonIfExists(path.join(reportsDir, `contract.${t.id}.json`)));
  }

  const traces = loadTraces(path.join(runDir, 'traces'));
  const derived = deriveFromTraces(traces);

  const events = readEvents(runDir);
  const generatedAt = events.length ? events[events.length - 1].ts : '';
  const decisions = latestDecisions(events);
  const models = latestModels(events, config);

  const attempt = latestAttempt(runDir);
  const assumptions = loadAssumptions(runDir, attempt);
  const findings = loadFindings(runDir, attempt);

  const issues = loadIssues(path.join(runDir, 'issues'));

  const slice = readJsonIfExists(path.resolve(cwd, `contracts/generated/slices/${slug}/contract-slice.json`));
  const openapiBundle = readYamlIfExists(path.resolve(cwd, 'contracts/generated/openapi.bundle.yaml'));
  const screensDoc = readYamlIfExists(docs('design/screens.yaml'));
  const screens = screensRowsForUc(screensDoc, uc);

  // 変更ファイル: --changed 優先、無ければ events の base_head から git diff
  let changed = null;
  if (opts.changed) changed = String(readTextIfExists(opts.changed) || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!changed) {
    const baseHead = (events.find((e) => e.type === 'branch_started') || {}).base_head;
    changed = changedFilesFromGit(cwd, baseHead) || [];
  }
  const files = groupChangedFiles(changed, tiers);

  const depPath = opts.depcruise ? path.resolve(cwd, opts.depcruise) : path.join(reportsDir, 'depcruise.json');
  const depcruise = readJsonIfExists(depPath);

  const basis = stamp({ requirements: path.join(docsRoot, 'requirements'), adr: path.join(docsRoot, 'adr'), contracts: 'contracts' }, cwd);

  const actor = (Array.isArray(uc.actors) && uc.actors.length ? String(uc.actors[0]) : null) || 'シナリオ実行者';
  const adrLayers = layersFromAdr(docs('adr'), tiers);
  const instrumentation = instrumentationCoverage(uc, files, traces, adrLayers);

  return {
    cwd, runDir, slug, config, docsRoot, docs, uc, reqDoc, gates, scenarios,
    tiers, unitByTier, contractByTier, traces, derived, generatedAt, decisions,
    attempt, assumptions, findings, issues, slice, openapiBundle, screens, files, depcruise, basis,
    head: headSha(cwd), actor, adrLayers, instrumentation, models,
  };
}

/** 実行したモデル: events の最後の models_resolved。無ければ config.models (implementer null はセッション既定)。 */
function latestModels(events, config) {
  const ev = [...events].reverse().find((e) => e.type === 'models_resolved');
  if (ev) return { session: ev.session || null, implementer: ev.implementer || null, verifier: ev.verifier || null, source: 'events' };
  const m = (config && config.models) || {};
  return { session: null, implementer: m.implementer || null, verifier: m.verifier || null, source: 'config' };
}

function mergeScenarios(...lists) {
  const map = new Map();
  for (const s of lists.flat()) {
    const key = `${s.feature}\u0000${s.name}`;
    if (!map.has(key)) map.set(key, s);
    else {
      const cur = map.get(key);
      cur.tags = [...new Set([...(cur.tags || []), ...(s.tags || [])])].sort();
      cur.duration_ms = Math.max(cur.duration_ms, s.duration_ms);
      if (statusRank(s.status) > statusRank(cur.status)) cur.status = s.status;
    }
  }
  return [...map.values()].sort((x, y) => cmpStr(x.name, y.name));
}
function statusRank(s) { return { failed: 4, undefined: 3, ambiguous: 3, pending: 2, unknown: 1, skipped: 1, passed: 0 }[s] || 0; }

function latestAttempt(runDir) {
  if (!fs.existsSync(runDir)) return null;
  const nums = fs.readdirSync(runDir).map((n) => n.match(/^attempt-(\d+)$/)).filter(Boolean).map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) : null;
}

function loadAssumptions(runDir, attempt) {
  const out = [];
  if (attempt == null) return out;
  const dir = path.join(runDir, `attempt-${attempt}`);
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter((n) => /^assumptions\..+\.yaml$/.test(n)).sort()) {
    const doc = readYamlIfExists(path.join(dir, f)) || {};
    for (const a of doc.assumptions || []) out.push({ tier: doc.tier || f.replace(/^assumptions\.|\.yaml$/g, ''), ...a });
  }
  out.sort((a, b) => cmpStr(`${a.tier}\u0000${a.id}`, `${b.tier}\u0000${b.id}`));
  return out;
}

function loadFindings(runDir, attempt) {
  const findings = [];
  const verdicts = [];
  if (attempt == null) return { findings, verdicts };
  const dir = path.join(runDir, `attempt-${attempt}`);
  if (!fs.existsSync(dir)) return { findings, verdicts };
  for (const f of fs.readdirSync(dir).filter((n) => /^findings\..+\.yaml$/.test(n)).sort()) {
    const doc = readYamlIfExists(path.join(dir, f)) || {};
    const tier = doc.tier || f.replace(/^findings\.|\.yaml$/g, '');
    for (const x of doc.findings || []) findings.push({ tier, ...x });
    for (const v of doc.assumption_verdicts || []) verdicts.push({ tier, ...v });
  }
  findings.sort((a, b) => cmpStr(`${a.tier}\u0000${a.id}`, `${b.tier}\u0000${b.id}`));
  verdicts.sort((a, b) => cmpStr(`${a.tier}\u0000${a.id}`, `${b.tier}\u0000${b.id}`));
  return { findings, verdicts };
}

function latestDecisions(events) {
  const approvals = events.filter((e) => e.type === 'review_approved' && e.assumption_decisions);
  if (!approvals.length) return {};
  const raw = approvals[approvals.length - 1].assumption_decisions;
  const map = {};
  // 前提は tier + id で一意 (別ティアの同 id が上書きし合わないようにする)。
  // tier が付いていれば `${tier}\u0000${id}` を正キーにし、id 単独キーは後方互換のフォールバックとして
  // 「最初に見たものだけ」保持する (ティア付きキーがあればそちらを優先して引く)。
  const put = (tier, id, v) => {
    if (id == null) return;
    if (tier != null && tier !== '') map[`${tier}\u0000${id}`] = v;
    if (!(id in map)) map[id] = v;
  };
  if (Array.isArray(raw)) for (const d of raw) { if (d && d.id) put(d.tier, d.id, d); }
  else if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw)) {
    const val = (v && typeof v === 'object') ? v : { decision: v };
    put(val.tier, k, val);
  }
  return map;
}

/** 前提の処遇を tier + id で引く (無ければ id 単独へフォールバック)。 */
function decisionFor(decisions, tier, id) {
  return decisions[`${tier}\u0000${id}`] || decisions[id];
}

function decisionText(d) {
  if (!d) return '未確認';
  return d.decision || d.verdict || d.status || d.resolution || '確認済み';
}

function loadIssues(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.md')).sort()) {
    const { data } = parseFrontMatter(fs.readFileSync(path.join(dir, f), 'utf8'));
    out.push({ file: f, kind: data.kind || '未分類', title: data.title || f.replace(/\.md$/, '') });
  }
  return out;
}

function screensRowsForUc(doc, uc) {
  if (!doc) return [];
  const rows = doc.screens || doc.rows || (Array.isArray(doc) ? doc : []);
  const out = [];
  for (const r of rows) {
    // d2-design の screens.yaml は uc_slugs (validateScreens の形)。旧い uc / ucs / uc_slug も受ける
    const ucField = r.uc_slugs || r.uc || r.ucs || r.uc_slug;
    const list = Array.isArray(ucField) ? ucField : [ucField];
    if (list.includes(uc.slug) || list.includes(uc.uc)) out.push(r);
  }
  out.sort((a, b) => cmpStr(a.name || a.screen || '', b.name || b.screen || ''));
  return out;
}

/** slice の openapi から operationId → {method, path} を作る。 */
function operationPaths(slice) {
  const map = {};
  const paths = slice && slice.openapi && slice.openapi.paths;
  if (!paths) return map;
  for (const [p, item] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(item || {})) {
      if (op && op.operationId) map[op.operationId] = { method: method.toUpperCase(), path: p };
    }
  }
  return map;
}

/** config の openapi 契約の provider ティア。 */
function openapiProvider(config) {
  const c = (config.contracts || []).find((x) => x.type === 'openapi');
  return c ? c.provider : null;
}

/**
 * ADR の arch_test (level: layer) の glob から、ティアごとのレイヤ名を拾う。
 * glob は `apps/<tier or glob>/src/<layer>/**` の形を期待する。それ以外は無視。
 * @returns {Record<string, string[]>} tierId → layers (昇順)
 */
function layersFromAdr(adrDir, tiers) {
  const out = {};
  if (!fs.existsSync(adrDir)) return out;
  const dirOf = (t) => String(t.dir || `apps/${t.id}`).replace(/\/+$/, '');
  const matchTiers = (tierGlob) => {
    const re = new RegExp('^' + tierGlob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    return (tiers || []).filter((t) => re.test(dirOf(t)) || re.test(t.id)).map((t) => t.id);
  };
  for (const f of fs.readdirSync(adrDir).filter((n) => /^\d{4}-.*\.md$/.test(n)).sort()) {
    const { data } = parseFrontMatter(fs.readFileSync(path.join(adrDir, f), 'utf8'));
    if (!data || data.status !== 'accepted') continue;
    for (const r of data.rules || []) {
      const at = r && r.arch_test;
      if (!at || at.level !== 'layer') continue;
      for (const g of [at.from, at.to]) {
        const m = String(g || '').match(/^((?:apps|packages)\/[^/]+)\/src\/([^/*]+)\//);
        if (!m) continue;
        for (const id of matchTiers(m[1])) (out[id] = out[id] || new Set()).add(m[2]);
      }
    }
  }
  for (const k of Object.keys(out)) out[k] = [...out[k]].sort(cmpStr);
  return out;
}

/**
 * 計装の範囲: UC が通るはずのティア (use-cases.yaml の tiers、無ければ変更ファイルのティア) と、
 * トレースに現れたティア・レイヤを突き合わせる。
 */
function instrumentationCoverage(uc, files, traces, adrLayers) {
  const expected = (Array.isArray(uc.tiers) && uc.tiers.length ? uc.tiers.slice() : Object.keys(files.byTier)).sort(cmpStr);
  const observed = new Map();
  for (const tr of traces) for (const p of observedPlacements(buildTree(tr.lines))) {
    if (!observed.has(p.tier)) observed.set(p.tier, new Set());
    for (const l of p.layers) observed.get(p.tier).add(l);
  }
  const rows = [];
  for (const t of [...new Set([...expected, ...observed.keys()])].sort(cmpStr)) {
    const layers = observed.has(t) ? [...observed.get(t)].sort(cmpStr) : null;
    const known = adrLayers[t] || [];
    rows.push({ tier: t, expected: expected.includes(t), observed: observed.has(t), layers: layers || [], adr_layers: known, missing_layers: layers ? known.filter((l) => !layers.includes(l)) : known });
  }
  // 正常系 1 本に、期待する全ティアの部品 (call) が現れるか (integrate.md の完了条件と同じ判定)
  const happy = pickHappyPath(traces);
  const happyTiers = new Set();
  if (happy) for (const l of happy.lines) if (l.kind === 'call' && l.meta && l.meta.tier) happyTiers.add(l.meta.tier);
  const gaps = rows.filter((r) => r.expected && !r.observed).map((r) => r.tier);
  const happyGaps = happy ? expected.filter((t) => !happyTiers.has(t) && !gaps.includes(t)) : [];
  return { expected, rows, gaps, happy_gaps: happyGaps };
}

// ---------------------------------------------------------------------------
// index.md
// ---------------------------------------------------------------------------

const SUMMARY_END = '<!-- 要約:end -->';
const SUMMARY_NAMES = ['概要', '整合性', '課題'];
function summaryBegin(name) { return `<!-- 要約:begin ${name} -->`; }

function yamlScalar(s) {
  const str = String(s == null ? '' : s);
  return /[:#\[\]{}]|^\s|\s$/.test(str) ? JSON.stringify(str) : str;
}

function gatesSummary(gates) {
  if (!gates || !gates.gates) return 'ゲート結果なし';
  const list = gates.gates;
  const failed = list.filter((g) => g.status === 'fail').map((g) => g.name);
  if (failed.length) return `**fail** (落ちた段: ${failed.join(', ')})`;
  if (!gatesAllRecorded(gates)) return `部分実行 (未実行: ${gatesMissing(gates).join(', ') || '不明'})`;
  return `${list.length} 段すべて ${gates.result || 'pass'}`;
}

function specById(reqDoc) {
  const map = {};
  for (const req of (reqDoc && reqDoc.requirements) || []) for (const s of req.specifications || []) if (s.id) map[s.id] = s;
  return map;
}

/** 受入基準 → シナリオの対応行。 */
function coverageRows(ctx) {
  const specMap = specById(ctx.reqDoc);
  const rows = [];
  for (const specId of (ctx.uc.spec_ids || []).slice().sort(cmpStr)) {
    const spec = specMap[specId];
    const criteria = (spec && spec.acceptance_criteria) || [];
    if (!criteria.length) { rows.push({ specId, critId: '-', criterion: '(受入基準なし)', scenarios: [] }); continue; }
    criteria.forEach((crit, idx) => {
      const critId = `${specId}-${idx + 1}`;
      const tag = `@acceptance:${critId}`;
      const scenarios = ctx.scenarios.filter((s) => (s.tags || []).includes(tag)).map((s) => ({ name: s.name, status: s.status }));
      rows.push({ specId, critId, criterion: crit, scenarios });
    });
  }
  return rows;
}

function findingSeverityById(ctx) {
  const map = {};
  for (const f of ctx.findings.findings) map[`${f.tier}\u0000${f.id}`] = f;
  return map;
}

function buildIndexMd(ctx, preserved) {
  const L = [];
  const basisVal = headerLine(ctx.basis).replace(/^basis:\s*/, '');
  L.push('---');
  L.push(`basis: ${basisVal}`);
  L.push(`generated_at: ${ctx.generatedAt}`);
  L.push(`code: ${ctx.head || ''}`);
  L.push(`uc: ${yamlScalar(ctx.uc.uc)}`);
  L.push(`slug: ${ctx.slug}`);
  L.push(`attempt: ${ctx.attempt == null ? '' : ctx.attempt}`);
  L.push('---');
  L.push('');
  L.push(`# ${ctx.uc.business} / ${ctx.uc.uc}`);
  L.push('');
  L.push('<!-- 要約: 表 1 つ (| 項目 | 内容 | 根拠 |)。行は 誰が / 何をする / 完了の条件。内容は 40 字以内、根拠はコード位置 path:line -->');
  L.push(summaryBegin('概要'));
  if (preserved['概要']) L.push(preserved['概要']);
  L.push(SUMMARY_END);
  L.push('');

  // 結果
  const cov = coverageRows(ctx);
  const covered = cov.filter((r) => r.scenarios.length).length;
  const scenarioPass = ctx.scenarios.filter((s) => s.status === 'passed').length;
  const isAcc = (s) => (s.tags || []).some((t) => t === '@acceptance' || t.startsWith('@acceptance:'));
  const scenarioAcc = ctx.scenarios.filter(isAcc).length;
  const scenarioBrowser = ctx.scenarios.filter((s) => (s.tags || []).includes('@browser'));
  const decCount = { confirmed: 0, auto_confirmed: 0, rejected: 0, other: 0 };
  for (const a of ctx.assumptions) {
    const d = decisionText(decisionFor(ctx.decisions, a.tier, a.id));
    if (d in decCount) decCount[d] += 1; else decCount.other += 1;
  }
  const issueKinds = {};
  for (const it of ctx.issues) issueKinds[it.kind] = (issueKinds[it.kind] || 0) + 1;
  L.push('## 結果 (抽出)');
  L.push('');
  L.push('| 項目 | 結果 |');
  L.push('|---|---|');
  L.push(`| ゲート | ${gatesSummary(ctx.gates)} |`);
  L.push(`| 受入基準 | ${cov.length ? `${covered} / ${cov.length} をシナリオが覆う` : 'なし'} |`);
  const scParts = [];
  if (scenarioAcc) scParts.push(`受入 ${scenarioAcc}`);
  if (scenarioBrowser.length) scParts.push(`ブラウザ ${scenarioBrowser.length}${scenarioBrowser.every((s) => s.status === 'skipped') ? ' (未実行)' : ''}`);
  L.push(`| シナリオ | ${ctx.scenarios.length ? `${ctx.scenarios.length} 本中 ${scenarioPass} 本 pass${scParts.length ? ` (${scParts.join('、')})` : ''}` : 'レポートなし'} |`);
  const decParts = [];
  if (decCount.confirmed) decParts.push(`人が承認 ${decCount.confirmed}`);
  if (decCount.auto_confirmed) decParts.push(`自動承認 ${decCount.auto_confirmed}`);
  if (decCount.rejected) decParts.push(`却下 ${decCount.rejected}`);
  if (decCount.other) decParts.push(`未確認 ${decCount.other}`);
  L.push(`| 実装者が決めた前提 | ${ctx.assumptions.length ? `${ctx.assumptions.length} 件 (${decParts.join('、')})` : 'なし'} |`);
  const issueParts = Object.keys(issueKinds).sort(cmpStr).map((k) => `${ja(KIND_JA, k, k)} ${issueKinds[k]}`);
  L.push(`| 未決の課題 | ${ctx.issues.length ? `${ctx.issues.length} 件 (${issueParts.join('、')})` : 'なし'} |`);
  const ins = ctx.instrumentation;
  const insRows = ins.rows.filter((r) => r.observed);
  for (const r of insRows) L.push(`| 計装の範囲 (${r.tier}) | ${r.layers.length ? r.layers.join(', ') : '部品名のみ'} |`);
  for (const t of ins.gaps) L.push(`| 計装の範囲 (${t}) | **計装なし** |`);
  for (const t of ins.happy_gaps) L.push(`| 計装の範囲 (${t}) | **正常系に部品なし** |`);
  if (!insRows.length && !ins.gaps.length) L.push('| 計装の範囲 | トレースなし |');
  L.push('');

  // 入口
  L.push('## 入口 (抽出)');
  L.push('');
  const opPaths = operationPaths(ctx.slice);
  const ops = ctx.derived.operations.map((op) => { const p = opPaths[op]; return `${op}${p ? ` (${p.method} ${p.path})` : ''}`; });
  const subs = sliceSubscriptions(ctx.slice);
  L.push('| 種類 | 名前 |');
  L.push('|---|---|');
  L.push(`| API | ${ops.length ? ops.map(mdEscape).join('、') : 'なし'} |`);
  L.push(`| 画面 | ${ctx.screens.length ? ctx.screens.map((s) => mdEscape(s.name || s.screen || s.id)).join('、') : 'なし'} |`);
  L.push(`| 発行イベント | ${ctx.derived.messages.length ? ctx.derived.messages.map(mdEscape).join('、') : 'なし'} |`);
  L.push(`| 購読イベント | ${subs.length ? subs.map(mdEscape).join('、') : 'なし'} |`);
  // 上流へのリンク (下流から要求・シナリオ・契約へ戻れるように)
  const up = upstreamLinks(ctx);
  L.push(`| 要求 | ${up.requirements} |`);
  L.push(`| シナリオ | ${up.features} |`);
  L.push(`| 契約 | ${up.contract} |`);
  L.push('');
  const comps = componentsByTier(ctx.traces);
  if (comps.length) {
    L.push('主要な部品 (トレースに現れたもの):');
    L.push('');
    for (const c of comps) L.push(`- ${c.tier}: ${c.components.map(mdEscape).join('、')}`);
  } else L.push('計装した部品なし (`traced()` で包んだ部品がここと図の参加者になる)。');
  L.push('');

  // どう動くか
  L.push('## どう動くか (抽出)');
  L.push('');
  const happy = pickHappyPath(ctx.traces);
  if (happy) {
    L.push(`正常系: ${mdEscape(scenarioTitle(happy.scenario, ctx.slug))}`);
    L.push('');
    L.push('```mermaid');
    L.push(renderScenario(happy.lines, { actor: ctx.actor }));
    L.push('```');
    L.push('');
    const others = ctx.traces.filter((t) => t !== happy);
    if (others.length) {
      L.push('分岐 (他のシナリオとの違い):');
      L.push('');
      L.push('| シナリオ | 応答 | 書き込み | 発行 |');
      L.push('|---|---|---|---|');
      for (const t of others) {
        const s = summarizeScenario(t.lines);
        L.push(`| ${mdEscape(scenarioTitle(t.scenario, ctx.slug))} | ${mdEscape(s.status)} | ${s.writes.length ? mdEscape(s.writes.join(', ')) : 'なし'} | ${s.messages.length ? mdEscape(s.messages.join(', ')) : 'なし'} |`);
      }
      L.push('');
    }
    L.push('全シナリオの図は [sequence.md](sequence.md)。');
  } else L.push('トレースなし。UC BDD を計装付きで実行すると図が出る。');
  L.push('');
  if (ctx.traces.length) {
    L.push('### データの流れ');
    L.push('');
    L.push('全シナリオを合算。点線は Read、太線は Write。');
    L.push('');
    L.push('```mermaid');
    L.push(renderFlowchart(buildFlows(ctx.traces, { actor: ctx.actor })));
    L.push('```');
    L.push('');
  }

  // 何を守るか
  L.push('## 何を守るか (要約)');
  L.push('');
  L.push('<!-- 要約: 表 1 つ (| 守ること | 手段 | 根拠 |)。守ること = 原子性 / 競合 / 冪等 / 障害と副作用。手段は 1 行 1 つ (<br> 区切り、各 40 字以内)、根拠はコード位置 -->');
  L.push(summaryBegin('整合性'));
  if (preserved['整合性']) L.push(preserved['整合性']);
  L.push(SUMMARY_END);
  L.push('');

  // 決めたこと
  L.push('## 決めたこと (転記)');
  L.push('');
  L.push('仕様に書かれておらず、実装者が決めた前提。検証は Verifier の判定、処遇は人のレビューの結果。');
  L.push('');
  const sevById = findingSeverityById(ctx);
  const verdictById = {};
  for (const v of ctx.findings.verdicts) verdictById[`${v.tier}\u0000${v.id}`] = v;
  const groups = { confirmed: [], auto_confirmed: [], rejected: [], other: [] };
  for (const a of ctx.assumptions) {
    const d = decisionText(decisionFor(ctx.decisions, a.tier, a.id));
    (groups[d] || groups.other).push(a);
  }
  const groupTitles = [['confirmed', '人が承認した前提'], ['auto_confirmed', '自動承認した前提'], ['rejected', '却下した前提'], ['other', '未確認の前提']];
  let any = false;
  for (const [key, title] of groupTitles) {
    const list = groups[key];
    if (!list.length) continue;
    any = true;
    L.push(`### ${title} (${list.length})`);
    L.push('');
    L.push('| ティア | 分類 | 何を決めたか | 検証 | 場所 |');
    L.push('|---|---|---|---|---|');
    for (const a of list) {
      const v = verdictById[`${a.tier}\u0000${a.id}`];
      const f = v && v.finding_id ? sevById[`${a.tier}\u0000${v.finding_id}`] : null;
      let verdict = v ? ja(VERDICT_JA, v.verdict, '-') : '-';
      if (f && f.severity && f.severity !== 'info') verdict = ['blocker', 'major'].includes(f.severity) ? `**${verdict} (${f.severity})**` : `${verdict} (${f.severity})`;
      L.push(`| ${a.tier} | ${ja(CATEGORY_JA, a.category, '-')} | ${mdEscape(a.title || a.assumption)} | ${verdict} | ${mdEscape(shortTarget(a.target))} |`);
    }
    L.push('');
    L.push('<details>');
    L.push('<summary>前提の全文</summary>');
    L.push('');
    for (const a of list) L.push(`- **${mdEscape(a.title || a.id)}** (${a.tier}): ${mdEscape(a.assumption)}`);
    L.push('');
    L.push('</details>');
    L.push('');
  }
  if (!any) { L.push('実装者が決めた前提なし。'); L.push(''); }
  const unlisted = ctx.findings.verdicts.filter((v) => v.verdict === 'unlisted');
  if (unlisted.length) {
    L.push(`### Verifier が見つけた未申告の判断 (${unlisted.length})`);
    L.push('');
    L.push('| ティア | 判断 | 場所 |');
    L.push('|---|---|---|');
    for (const v of unlisted) L.push(`| ${v.tier} | ${mdEscape(v.assumption)} | ${mdEscape(shortTarget(v.target))} |`);
    L.push('');
  }
  // 前提に紐づかない指摘 (uc_intent 等)
  const linked = new Set(ctx.findings.verdicts.map((v) => `${v.tier}\u0000${v.finding_id}`));
  const other = ctx.findings.findings.filter((f) => !linked.has(`${f.tier}\u0000${f.id}`) && ['blocker', 'major', 'minor'].includes(f.severity));
  if (other.length) {
    const majors = other.filter((f) => f.severity !== 'minor');
    const minors = other.filter((f) => f.severity === 'minor');
    L.push(`### Verifier の指摘 (前提以外、${other.length})`);
    L.push('');
    const line = (f) => `- ${f.severity !== 'minor' ? `**${f.severity}** ` : ''}${mdEscape(f.title || f.claim || f.kind)} (${f.tier}${f.target ? `, ${shortTarget(f.target)}` : ''})`;
    for (const f of majors) L.push(line(f));
    if (minors.length) {
      if (majors.length) L.push('');
      L.push('<details>');
      L.push(`<summary>minor ${minors.length} 件</summary>`);
      L.push('');
      for (const f of minors) L.push(line(f));
      L.push('');
      L.push('</details>');
    }
    L.push('');
    L.push('<details>');
    L.push('<summary>指摘の全文</summary>');
    L.push('');
    for (const f of other) L.push(`- **${mdEscape(f.title || f.id)}** (${f.tier}, ${f.severity}): ${mdEscape(f.claim || f.kind)}`);
    L.push('');
    L.push('</details>');
    L.push('');
  }

  // 課題
  L.push('## 課題 (抽出 + 要約)');
  L.push('');
  if (ctx.issues.length) {
    L.push('| 種類 | 課題 |');
    L.push('|---|---|');
    for (const it of ctx.issues) L.push(`| ${ja(KIND_JA, it.kind, it.kind)} | ${mdEscape(it.title)} |`);
  } else L.push('未決の課題なし。');
  L.push('');
  L.push('<!-- 要約: 表 1 つ (| 課題 | 背景 | 今の実装 | 対処 | 根拠 |)。課題 1 つ 1 行、セルは 40 字以内、根拠はコード位置 -->');
  L.push(summaryBegin('課題'));
  if (preserved['課題']) L.push(preserved['課題']);
  L.push(SUMMARY_END);
  L.push('');

  // 証跡
  L.push('## 証跡 (抽出)');
  L.push('');
  if (ctx.gates && ctx.gates.gates) {
    L.push(`ゲート: ${ctx.gates.gates.map((g) => `${g.name} ${g.status}`).join(' / ')}`);
    L.push('');
  }
  const involved = ctx.tiers.filter((t) => ctx.unitByTier[t.id] || ctx.contractByTier[t.id]);
  if (involved.length) {
    L.push('| ティア | 単体 (pass/total) | 契約 (pass/total) |');
    L.push('|---|---|---|');
    for (const t of involved) {
      const u = ctx.unitByTier[t.id];
      const c = ctx.contractByTier[t.id];
      L.push(`| ${t.id} | ${u ? `${u.passed}/${u.total}` : '-'} | ${c ? `${c.passed}/${c.total}` : '-'} |`);
    }
    L.push('');
  }
  if (cov.length) {
    L.push('受入基準の対応:');
    L.push('');
    L.push('| 基準 | 内容 | シナリオ (結果) |');
    L.push('|---|---|---|');
    for (const r of cov) {
      const sc = r.scenarios.map((s) => `${s.name} (${s.status})`);
      L.push(`| ${r.critId === '-' ? r.specId : r.critId} | ${gwtLines(r.criterion)} | ${sc.length ? sc.map(mdEscape).join('<br>') : '**未カバー**'} |`);
    }
    L.push('');
  }

  // 付録
  L.push('## 付録 (抽出)');
  L.push('');
  L.push('<details>');
  L.push(`<summary>変更ファイル (${ctx.files.all.length})</summary>`);
  L.push('');
  if (Object.keys(ctx.files.byTier).length || ctx.files.other.length) {
    for (const tier of Object.keys(ctx.files.byTier).sort(cmpStr)) {
      L.push(`- ${tier} (${ctx.files.byTier[tier].length})`);
      for (const f of ctx.files.byTier[tier]) L.push(`  - ${f}`);
    }
    if (ctx.files.other.length) {
      L.push(`- その他 (${ctx.files.other.length})`);
      for (const f of ctx.files.other) L.push(`  - ${f}`);
    }
  } else L.push('- なし');
  L.push('');
  L.push('</details>');
  L.push('');
  L.push('<details>');
  L.push(`<summary>シナリオの実行結果 (${ctx.scenarios.length})</summary>`);
  L.push('');
  if (ctx.scenarios.length) {
    L.push('| シナリオ | 種別 | 結果 | 時間 (ms) |');
    L.push('|---|---|---|---|');
    for (const s of ctx.scenarios) {
      const kinds = [];
      if (isAcc(s)) kinds.push('受入');
      if ((s.tags || []).includes('@browser')) kinds.push('ブラウザ');
      L.push(`| ${mdEscape(s.name)} | ${kinds.join('・') || 'UC'} | ${s.status} | ${s.duration_ms} |`);
    }
  } else L.push('シナリオレポートなし。');
  L.push('');
  L.push('</details>');
  L.push('');
  L.push('<details>');
  L.push('<summary>生成情報</summary>');
  L.push('');
  L.push(`- 上流: ${basisVal ? basisVal.replace(/@([0-9a-f]{40})/g, (_, h) => '@' + short(h)) : 'なし'}`);
  L.push(`- コード: ${short(ctx.head) || '不明'}`);
  L.push(`- 生成日時: ${ctx.generatedAt || '不明'} / 実行試行: ${ctx.attempt == null ? 'なし' : ctx.attempt}`);
  const m = ctx.models;
  const modelText = m.source === 'events'
    ? `実装 ${m.implementer || '不明'} / 検証 ${m.verifier || '不明'} / オーケストレータ ${m.session || '不明'}`
    : `実装 ${m.implementer || 'セッション既定 (未解決)'} / 検証 ${m.verifier || '不明'} (config の設定値。実行時の解決名は未記録)`;
  L.push(`- モデル: ${modelText}`);
  L.push('- 凡例: (抽出) はスクリプトが生成、(要約) は LLM がコード位置を根拠に書く、(転記) は実行記録からの写し');
  L.push('');
  L.push('</details>');
  L.push('');

  return L.join('\n');
}

/** as-built から見た相対リンク。実在しなければ null。 */
function relLink(ctx, absPath, label) {
  if (!absPath || !fs.existsSync(absPath)) return null;
  const from = path.resolve(ctx.cwd, ctx.docsRoot, 'as-built', ctx.uc.business, ctx.uc.uc);
  const rel = path.relative(from, absPath).split(path.sep).map((seg) => (seg === '..' || seg === '.' ? seg : encodeURIComponent(seg))).join('/');
  return `[${mdEscape(label)}](${rel})`;
}

/** 上流 (要求 / シナリオ / 契約 slice) へのリンク。features は @uc:<slug> タグで探す。 */
function upstreamLinks(ctx) {
  const specs = (ctx.uc.spec_ids || []).slice().sort(cmpStr);
  const reqMd = relLink(ctx, ctx.docs('requirements/requirements.md'), '要求仕様書');
  const requirements = specs.length ? `${specs.join(', ')}${reqMd ? ` (${reqMd})` : ''}` : 'なし';
  const featureFiles = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => cmpStr(a.name, b.name))) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.feature') && new RegExp(`@uc:${ctx.slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_-])`).test(fs.readFileSync(p, 'utf8'))) featureFiles.push(p);
    }
  };
  walk(path.resolve(ctx.cwd, 'features'));
  const features = featureFiles.map((p) => relLink(ctx, p, path.basename(p))).filter(Boolean).join('<br>') || 'なし';
  const contract = relLink(ctx, path.resolve(ctx.cwd, 'contracts', 'generated', 'slices', ctx.slug, 'contract-slice.json'), 'contract-slice.json') || 'なし';
  return { requirements, features, contract };
}

/** 受入基準 "Given … When … Then …" を 3 行 (`<br>`) に分ける。分けられなければそのまま。 */
function gwtLines(text) {
  const t = mdEscape(text);
  const parts = t.split(/\s+(?=(?:When|Then)\s)/);
  return parts.length > 1 ? parts.join('<br>') : t;
}

function shortTarget(t) {
  if (!t) return '-';
  return String(t).split(/,\s*/).map((x) => x.trim().split('/').pop()).join(', ');
}

/** `slug#名前` → `名前`。 */
function scenarioTitle(scenarioId, slug) {
  const s = String(scenarioId || '');
  return s.startsWith(`${slug}#`) ? s.slice(slug.length + 1) : s;
}

/** トレースに現れた部品 (call の component) をティアごとに。 */
function componentsByTier(traces) {
  const map = new Map();
  for (const tr of traces) for (const l of tr.lines || []) {
    if (l.kind !== 'call') continue;
    const tier = (l.meta && l.meta.tier) || '(ティア不明)';
    const comp = (l.meta && l.meta.component) || l.name;
    if (!comp) continue;
    if (!map.has(tier)) map.set(tier, new Set());
    map.get(tier).add(String(comp));
  }
  return [...map.keys()].sort(cmpStr).map((t) => ({ tier: t, components: [...map.get(t)].sort(cmpStr) }));
}

function sliceSubscriptions(slice) {
  const out = [];
  const async = slice && slice.asyncapi;
  if (!async) return out;
  const channels = async.channels || {};
  for (const ch of Object.values(channels)) {
    if (ch && ch.subscribe && ch.subscribe.message) {
      const m = ch.subscribe.message;
      if (m.name) out.push(m.name);
    }
  }
  return [...new Set(out)].sort(cmpStr);
}

/**
 * 既存 index.md から要約ブロックの中身を取り出す。名前付き (`<!-- 要約:begin 概要 -->`) は名前で、
 * 旧形式の名前無しブロックは出現順に [整合性, 課題] へ対応づける。
 */
function extractPreserved(text) {
  const out = {};
  if (!text) return out;
  const re = /<!-- 要約:begin(?: ([^\s>]+))? -->\n?([\s\S]*?)<!-- 要約:end -->/g;
  const legacyOrder = ['整合性', '課題'];
  let m;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    const name = m[1] || legacyOrder[i] || `_${i}`;
    const inner = m[2].replace(/\n+$/, '').replace(/^\n+/, '');
    if (inner) out[name] = inner;
    i += 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// sequence.md
// ---------------------------------------------------------------------------

function basisComment(ctx) {
  const basisVal = headerLine(ctx.basis).replace(/^basis:\s*/, '');
  return `<!-- basis: ${basisVal} | generated_at: ${ctx.generatedAt} | slug: ${ctx.slug} -->`;
}

function buildSequenceMd(ctx) {
  const L = [];
  L.push(basisComment(ctx));
  L.push('');
  L.push(`# ${ctx.uc.business} / ${ctx.uc.uc} — 全シナリオのシーケンス (抽出)`);
  L.push('');
  if (!ctx.traces.length) { L.push('トレースなし。'); L.push(''); return L.join('\n'); }
  L.push(`アクターは ${ctx.actor}。正常系は [index.md](index.md) の「どう動くか」にも載せている。`);
  L.push('');
  for (const tr of ctx.traces) {
    L.push(`## ${scenarioTitle(tr.scenario, ctx.slug)}`);
    L.push('');
    L.push('```mermaid');
    L.push(renderScenario(tr.lines, { actor: ctx.actor }));
    L.push('```');
    L.push('');
  }
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// _system/*
// ---------------------------------------------------------------------------

function ucEntry(ctx) {
  const tablesRw = {};
  for (const t of ctx.derived.tables) tablesRw[t.name] = t.modes;
  return {
    business: ctx.uc.business,
    uc: ctx.uc.uc,
    spec_ids: (ctx.uc.spec_ids || []).slice().sort(cmpStr),
    scenarios: ctx.scenarios.map((s) => ({ name: s.name, tags: s.tags, status: s.status })),
    operations: ctx.derived.operations,
    tables: ctx.derived.tables.map((t) => t.name),
    tables_rw: tablesRw,
    messages: ctx.derived.messages,
    files: ctx.files.all,
    gates: (ctx.gates && ctx.gates.result) || 'unknown',
    gates_complete: gatesAllRecorded(ctx.gates),
    instrumentation_gaps: ctx.instrumentation.gaps,
    instrumentation_happy_gaps: ctx.instrumentation.happy_gaps,
    generated_at: ctx.generatedAt,
    as_built: `${ctx.docsRoot}/as-built/${ctx.uc.business}/${ctx.uc.uc}/`,
  };
}

function rebuildIndex(index, config) {
  const provider = openapiProvider(config);
  const acceptance = {};
  const operations = {};
  const tables = {};
  for (const slug of Object.keys(index.ucs).sort(cmpStr)) {
    const e = index.ucs[slug];
    for (const sc of e.scenarios || []) {
      for (const tag of sc.tags || []) {
        if (tag.startsWith('@acceptance:')) {
          const key = tag.slice('@acceptance:'.length);
          const rec = (acceptance[key] = acceptance[key] || { ucs: [], scenarios: [] });
          if (!rec.ucs.includes(slug)) rec.ucs.push(slug);
          if (!rec.scenarios.includes(sc.name)) rec.scenarios.push(sc.name);
        }
      }
    }
    for (const op of e.operations || []) {
      const rec = (operations[op] = operations[op] || { provider_tier: provider, ucs: [] });
      if (!rec.ucs.includes(slug)) rec.ucs.push(slug);
    }
    for (const tbl of e.tables || []) {
      const rec = (tables[tbl] = tables[tbl] || { ucs: [] });
      if (!rec.ucs.includes(slug)) rec.ucs.push(slug);
    }
  }
  for (const r of Object.values(acceptance)) { r.ucs.sort(cmpStr); r.scenarios.sort(cmpStr); }
  for (const r of Object.values(operations)) r.ucs.sort(cmpStr);
  for (const r of Object.values(tables)) r.ucs.sort(cmpStr);
  index.acceptance = acceptance;
  index.operations = operations;
  index.tables = tables;
  return index;
}

function buildApiInventory(ctx, index) {
  const L = [];
  L.push('# API インベントリ (抽出)');
  L.push('');
  if (!ctx.openapiBundle) { L.push('openapi bundle なし。'); L.push(''); return L.join('\n'); }
  const provider = openapiProvider(ctx.config);
  const ops = [];
  const paths = ctx.openapiBundle.paths || {};
  for (const [p, item] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(item || {})) {
      if (op && op.operationId) ops.push({ operationId: op.operationId, method: method.toUpperCase(), path: p });
    }
  }
  ops.sort((a, b) => cmpStr(a.operationId, b.operationId));
  L.push('| operationId | method path | provider | 使う UC | 状態 |');
  L.push('|---|---|---|---|---|');
  for (const op of ops) {
    const rec = index.operations[op.operationId];
    const ucList = rec ? rec.ucs : [];
    const impl = Boolean(rec);
    const marks = [];
    if (!impl) marks.push('未実装');
    if (!ucList.length) marks.push('未使用');
    L.push(`| ${op.operationId} | ${op.method} ${op.path} | ${provider || '-'} | ${ucList.join(', ') || '-'} | ${marks.join(', ') || '実装済み'} |`);
  }
  L.push('');
  return L.join('\n');
}

function buildDependencyGraph(ctx) {
  const L = [];
  L.push('# 依存グラフ (抽出)');
  L.push('');
  if (ctx.depcruise) {
    // 実態: dependency-cruiser の JSON からティア / パッケージ単位の依存を描く。
    L.push('## 実態 (dependency-cruiser)');
    L.push('');
    L.push('コードの import から抽出した実際の依存。');
    L.push('');
    const collapse = (mod) => {
      const m = String(mod).match(/^(apps\/[^/]+|packages\/[^/]+)/);
      return m ? m[1] : String(mod).split('/').slice(0, 1)[0];
    };
    // ノードは modules[].source からも集める。ティア内 import だけで
    // ティア間の辺が無いティアも、実態として存在する以上ノードとして描く。
    const nodes = new Set();
    const edges = new Set();
    for (const mod of ctx.depcruise.modules || []) {
      const from = collapse(mod.source);
      if (from) nodes.add(from);
      for (const dep of mod.dependencies || []) {
        const to = collapse(dep.resolved || dep.module);
        if (to) nodes.add(to);
        if (from && to && from !== to) edges.add(`${from}\u0000${to}`);
      }
    }
    L.push('```mermaid');
    L.push('graph LR');
    for (const n of [...nodes].sort(cmpStr)) L.push(`  ${nodeId(n)}["${n}"]`);
    for (const e of [...edges].sort(cmpStr)) { const [a, b] = e.split('\u0000'); L.push(`  ${nodeId(a)} --> ${nodeId(b)}`); }
    L.push('```');
    L.push('');
    const violations = (ctx.depcruise.summary && ctx.depcruise.summary.violations) || [];
    L.push('## 違反');
    L.push('');
    if (violations.length) {
      L.push('| from | to | rule | severity |');
      L.push('|---|---|---|---|');
      for (const v of violations.slice().sort((a, b) => cmpStr(a.from, b.from))) {
        L.push(`| ${mdEscape(v.from)} | ${mdEscape(v.to)} | ${mdEscape(v.rule && v.rule.name)} | ${mdEscape(v.rule && v.rule.severity)} |`);
      }
    } else L.push('違反なし。');
    L.push('');
    return L.join('\n');
  }
  // 実態が無いとき: config.yaml のティア・契約から「決定からの図」を描き、実態は未取得と明示する。
  L.push('## 決定からの図 (dependency-cruiser 未実行)');
  L.push('');
  L.push('実態 (コードの import) は未取得 (`reports/depcruise.json` が無い)。下図は `.distillery/config.yaml` の');
  L.push('ティアと契約から描いた**決定上の依存** (契約の consumer → provider)。実態を得るには asbuilt 段階で');
  L.push('`depcruise --output-type json` を実行する。');
  L.push('');
  const tiers = ctx.config.tiers || [];
  const contracts = ctx.config.contracts || [];
  const dirOf = new Map(tiers.map((t) => [t.id, t.dir || `apps/${t.id}`]));
  const label = (id) => dirOf.get(id) || id;
  const edges = new Set();
  for (const c of contracts) {
    if (!c.provider) continue;
    for (const consumer of (c.consumers || [])) {
      edges.add(`${label(consumer)}\u0000${label(c.provider)}\u0000${c.id}`);
    }
  }
  L.push('```mermaid');
  L.push('graph LR');
  const nodes = new Set(tiers.map((t) => label(t.id)));
  for (const e of [...edges].sort(cmpStr)) { const [a, b] = e.split('\u0000'); nodes.add(a); nodes.add(b); }
  for (const n of [...nodes].sort(cmpStr)) L.push(`  ${nodeId(n)}["${n}"]`);
  for (const e of [...edges].sort(cmpStr)) {
    const [a, b, id] = e.split('\u0000');
    L.push(`  ${nodeId(a)} -->|${mdEscape(id)}| ${nodeId(b)}`);
  }
  L.push('```');
  L.push('');
  return L.join('\n');
}
function nodeId(label) { return 'n_' + String(label).replace(/[^A-Za-z0-9]/g, '_'); }

function buildSystemIndex(index) {
  const L = [];
  L.push('# 実装の記録 (UC ごと)');
  L.push('');
  L.push('UC 名を押すと、その UC の記録 (概要 → 結果 → 入口 → どう動くか → 何を守るか → 決めたこと → 課題 → 証跡) に移る。');
  L.push('');
  L.push('| 業務 | UC (記録へ) | ゲート | 生成日時 |');
  L.push('|---|---|---|---|');
  let lastBiz = null;
  for (const slug of Object.keys(index.ucs).sort((a, b) => cmpStr(`${index.ucs[a].business}\u0000${index.ucs[a].uc}`, `${index.ucs[b].business}\u0000${index.ucs[b].uc}`))) {
    const e = index.ucs[slug];
    const biz = e.business === lastBiz ? '' : mdEscape(e.business);
    lastBiz = e.business;
    // このファイル (docs/as-built/_system/index.md) から見た相対パス
    const rel = path.relative(path.join(index.__docsRoot || 'docs', 'as-built', '_system'), path.join(e.as_built, 'index.md')).split(path.sep).map((x) => (x === '..' ? x : encodeURIComponent(x))).join('/');
    L.push(`| ${biz} | [${mdEscape(e.uc)}](${rel}) | ${e.gates || '-'} | ${e.generated_at || '-'} |`);
  }
  L.push('');
  L.push('横断して見る: [API インベントリ](api-inventory.md) / [データフロー](data-flow.md) / [依存グラフ](dependency-graph.md) / [追跡表 (機械向け)](traceability-index.json)');
  L.push('');
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

function run(opts) {
  const ctx = collect(opts);
  const asBuiltDir = path.resolve(ctx.cwd, ctx.docsRoot, 'as-built', ctx.uc.business, ctx.uc.uc);
  const systemDir = path.resolve(ctx.cwd, ctx.docsRoot, 'as-built', '_system');

  const indexPath = path.join(asBuiltDir, 'index.md');
  const preserved = extractPreserved(readTextIfExists(indexPath));
  const indexMd = buildIndexMd(ctx, preserved);
  ensureWrite(indexPath, indexMd);
  // 引き継いだ要約 (旧形式の文章を含む) が書式規則を満たすか。違反は d2-asbuilt が書き直す (checkAsBuilt.js がゲート)
  const summaryViolations = checkSummaries(indexMd).violations.filter((v) => !/R1/.test(v.rule));
  ensureWrite(path.join(asBuiltDir, 'sequence.md'), buildSequenceMd(ctx));
  // 0.1.4 以前の coverage.md は index.md の「証跡」に統合した
  const legacyCoverage = path.join(asBuiltDir, 'coverage.md');
  if (fs.existsSync(legacyCoverage)) fs.rmSync(legacyCoverage);

  // traceability-index.json (マージ)
  fs.mkdirSync(systemDir, { recursive: true });
  const indexJsonPath = path.join(systemDir, 'traceability-index.json');
  let index = { ucs: {}, acceptance: {}, operations: {}, tables: {} };
  if (fs.existsSync(indexJsonPath)) {
    try { index = readCanonicalJson(indexJsonPath); } catch { index = JSON.parse(fs.readFileSync(indexJsonPath, 'utf8')); }
  }
  index.ucs = index.ucs || {};
  index.ucs[ctx.slug] = ucEntry(ctx);
  rebuildIndex(index, ctx.config);
  const ordered = { ucs: {}, acceptance: index.acceptance, operations: index.operations, tables: index.tables };
  for (const slug of Object.keys(index.ucs).sort(cmpStr)) ordered.ucs[slug] = index.ucs[slug];
  writeCanonicalJson(indexJsonPath, sortKeysDeep(ordered));

  ensureWrite(path.join(systemDir, 'api-inventory.md'), buildApiInventory(ctx, index));
  ensureWrite(path.join(systemDir, 'dependency-graph.md'), buildDependencyGraph(ctx));
  ensureWrite(path.join(systemDir, 'data-flow.md'), renderSystemDataFlow(ordered));
  ensureWrite(path.join(systemDir, 'index.md'), buildSystemIndex({ ...index, __docsRoot: ctx.docsRoot }));

  return { asBuiltDir, systemDir, slug: ctx.slug, scenarios: ctx.scenarios.length, operations: ctx.derived.operations.length, instrumentation_gaps: ctx.instrumentation.gaps, instrumentation_happy_gaps: ctx.instrumentation.happy_gaps, summary_violations: summaryViolations.length };
}

function parseArgs(argv) {
  const o = { cwd: process.cwd(), config: '.distillery/config.yaml' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--run') o.run = argv[++i];
    else if (a === '--cwd') o.cwd = path.resolve(argv[++i]);
    else if (a === '--config') o.config = argv[++i];
    else if (a === '--docs-root') o.docsRoot = argv[++i];
    else if (a === '--depcruise') o.depcruise = argv[++i];
    else if (a === '--changed') o.changed = argv[++i];
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (!o.run) throw new Error('--run <runDir> is required');
  o.run = path.resolve(o.cwd, o.run);
  return o;
}

function main(argv) {
  let o;
  try { o = parseArgs(argv); } catch (e) { console.error(e.message); return 2; }
  const r = run(o);
  const gap = (r.instrumentation_gaps.length ? ` 計装なしのティア: ${r.instrumentation_gaps.join(', ')}` : '')
    + (r.instrumentation_happy_gaps.length ? ` 正常系に部品 (call) が無いティア: ${r.instrumentation_happy_gaps.join(', ')}` : '');
  const sv = r.summary_violations ? ` 要約ブロックに書式違反 ${r.summary_violations} 件 (引き継いだ旧形式を含む。checkAsBuilt.js で確認し d2-asbuilt が書き直す)` : '';
  console.log(`as-built: ${path.relative(o.cwd, r.asBuiltDir)} (scenarios=${r.scenarios}, operations=${r.operations})${gap}${sv}`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = {
  run, collect, buildIndexMd, buildSequenceMd, buildApiInventory, buildDependencyGraph,
  buildSystemIndex, rebuildIndex, ucEntry, extractPreserved, parseCucumberReport, parseVitestReport,
  scenarioStatus, parseFrontMatter, latestDecisions, decisionFor, loadAssumptions, layersFromAdr,
  instrumentationCoverage, coverageRows, main, SUMMARY_NAMES,
};
