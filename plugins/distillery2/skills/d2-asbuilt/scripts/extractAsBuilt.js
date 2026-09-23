#!/usr/bin/env node
/**
 * extractAsBuilt.js — 実装から as-built ドキュメントを抽出する (段階④ の最後)
 *
 * 入力 (すべて任意。無ければ該当節に「なし」と書く):
 *   .distillery/config.yaml                       ティア・契約・docs_root
 *   docs/requirements/use-cases.yaml              UC 一覧 (run の slug で該当 UC を引く)
 *   docs/requirements/requirements.yaml           受入基準 (coverage.md)
 *   <run>/reports/gates.json / *.json             ゲート結果・cucumber JSON・vitest JSON
 *   <run>/traces/<scenario>.jsonl                 実行トレース
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
 *   docs/as-built/<業務>/<UC>/{index.md, sequence.md, coverage.md}
 *   docs/as-built/_system/{traceability-index.json, api-inventory.md, dependency-graph.md, index.md}
 *
 * 決定論: 同じ入力なら同じ出力。generated_at のみ最新イベント ts (壁時計ではない)。
 * 要約節は `<!-- 要約:begin -->…<!-- 要約:end -->` の中身を再実行でも保存する。
 *
 * Usage:
 *   node extractAsBuilt.js --run <runDir> [--cwd <repo>] [--config <path>] [--docs-root <dir>] [--depcruise <path>]
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
const { renderScenario } = require('./renderSequence');
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
function tagList(tags) { return (Array.isArray(tags) ? tags : []).join(' '); }

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
  out.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return out;
}

function scenarioStatus(steps) {
  const st = (steps || []).map((s) => (s.result && s.result.status) || 'unknown');
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
  const scenarios = mergeScenarios(ucBdd, acceptance);

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

  return {
    cwd, runDir, slug, config, docsRoot, docs, uc, reqDoc, gates, scenarios,
    tiers, unitByTier, contractByTier, traces, derived, generatedAt, decisions,
    attempt, assumptions, findings, issues, slice, openapiBundle, screens, files, depcruise, basis,
    head: headSha(cwd),
  };
}

function mergeScenarios(a, b) {
  const map = new Map();
  for (const s of [...a, ...b]) {
    const key = `${s.feature}\u0000${s.name}`;
    if (!map.has(key)) map.set(key, s);
    else {
      // 同名は tags を統合し、より強い status を残す
      const cur = map.get(key);
      cur.tags = [...new Set([...(cur.tags || []), ...(s.tags || [])])].sort();
      cur.duration_ms = Math.max(cur.duration_ms, s.duration_ms);
      if (statusRank(s.status) > statusRank(cur.status)) cur.status = s.status;
    }
  }
  return [...map.values()].sort((x, y) => String(x.name).localeCompare(String(y.name)));
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
  out.sort((a, b) => `${a.tier}\u0000${a.id}`.localeCompare(`${b.tier}\u0000${b.id}`));
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
  findings.sort((a, b) => `${a.tier}\u0000${a.id}`.localeCompare(`${b.tier}\u0000${b.id}`));
  verdicts.sort((a, b) => `${a.tier}\u0000${a.id}`.localeCompare(`${b.tier}\u0000${b.id}`));
  return { findings, verdicts };
}

function latestDecisions(events) {
  const approvals = events.filter((e) => e.type === 'review_approved' && e.assumption_decisions);
  if (!approvals.length) return {};
  const raw = approvals[approvals.length - 1].assumption_decisions;
  const map = {};
  if (Array.isArray(raw)) for (const d of raw) { if (d && d.id) map[d.id] = d; }
  else if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw)) map[k] = (v && typeof v === 'object') ? v : { decision: v };
  return map;
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
    const ucField = r.uc || r.ucs || r.uc_slug;
    const list = Array.isArray(ucField) ? ucField : [ucField];
    if (list.includes(uc.slug) || list.includes(uc.uc)) out.push(r);
  }
  out.sort((a, b) => String(a.name || a.screen || '').localeCompare(String(b.name || b.screen || '')));
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

// ---------------------------------------------------------------------------
// index.md
// ---------------------------------------------------------------------------

const SUMMARY_BEGIN = '<!-- 要約:begin -->';
const SUMMARY_END = '<!-- 要約:end -->';

function buildIndexMd(ctx, preserved) {
  const L = [];
  const basisVal = headerLine(ctx.basis).replace(/^basis:\s*/, '');
  L.push('---');
  L.push(`basis: ${basisVal}`);
  L.push(`generated_at: ${ctx.generatedAt}`);
  L.push(`code: ${ctx.head || ''}`);
  L.push(`uc: ${yamlScalar(ctx.uc.uc)}`);
  L.push(`slug: ${ctx.slug}`);
  L.push('---');
  L.push('');
  L.push(`# ${ctx.uc.business} / ${ctx.uc.uc} (as-built)`);
  L.push('');

  // 1. 見出し
  L.push('## 1. 見出し (抽出)');
  L.push('');
  L.push(`- 業務 / BUC / UC: ${ctx.uc.business} / ${ctx.uc.buc || '-'} / ${ctx.uc.uc}`);
  L.push(`- いつ (generated_at): ${ctx.generatedAt || '不明'}`);
  L.push(`- 何を基に (code): ${ctx.head || '不明'}`);
  L.push(`- 実行試行 (attempt): ${ctx.attempt == null ? 'なし' : ctx.attempt}`);
  L.push(`- 上流 (basis): ${basisVal || 'なし'}`);
  L.push('');

  // 2. 実現の経路
  L.push('## 2. 実現の経路 (抽出)');
  L.push('');
  const involvedTiers = [...new Set([...Object.keys(ctx.files.byTier), ...ctx.tiers.filter((t) => ctx.derived.operations.length && openapiProvider(ctx.config) === t.id).map((t) => t.id)])].sort();
  L.push(`- 関与ティア: ${involvedTiers.length ? involvedTiers.join(', ') : 'なし'}`);
  const opPaths = operationPaths(ctx.slice);
  if (ctx.derived.operations.length) {
    L.push('- API operation:');
    for (const op of ctx.derived.operations) {
      const p = opPaths[op];
      L.push(`  - ${op}${p ? ` (${p.method} ${p.path})` : ''}`);
    }
  } else L.push('- API operation: なし');
  if (ctx.screens.length) {
    L.push('- 画面:');
    for (const s of ctx.screens) L.push(`  - ${s.name || s.screen || s.id}`);
  } else L.push('- 画面: なし');
  if (ctx.derived.messages.length) {
    L.push('- 発行イベント:');
    for (const m of ctx.derived.messages) L.push(`  - ${m}`);
  } else L.push('- 発行イベント: なし');
  const subs = sliceSubscriptions(ctx.slice);
  L.push(`- 購読イベント: ${subs.length ? subs.join(', ') : 'なし'}`);
  L.push('- 入口ファイル (変更):');
  if (Object.keys(ctx.files.byTier).length) {
    for (const tier of Object.keys(ctx.files.byTier).sort()) {
      L.push(`  - ${tier}:`);
      for (const f of ctx.files.byTier[tier]) L.push(`    - ${f}`);
    }
  } else L.push('  - なし');
  L.push('');

  // 3. シーケンス
  L.push('## 3. シーケンス (抽出)');
  L.push('');
  L.push(`- シナリオ数: ${ctx.traces.length}`);
  L.push('- [シーケンス図](sequence.md)');
  L.push('');

  // 4. データの読み書き
  L.push('## 4. データの読み書き (抽出)');
  L.push('');
  if (ctx.derived.perScenario.length) {
    L.push('| シナリオ | 読み | 書き | 発行 |');
    L.push('|---|---|---|---|');
    for (const s of ctx.derived.perScenario) {
      L.push(`| ${mdEscape(s.scenario)} | ${mdEscape(s.tables_read.join(', ') || '-')} | ${mdEscape(s.tables_written.join(', ') || '-')} | ${mdEscape(s.messages.join(', ') || '-')} |`);
    }
  } else L.push('トレースなし。');
  L.push('');

  // 5. 整合性の守り方 (要約)
  L.push('## 5. 整合性の守り方 (要約)');
  L.push('');
  L.push('<!-- 要約: 原子性の境界・冪等キー・競合判定・再送と障害回復・副作用。根拠はコード位置 path:line -->');
  L.push('');
  const hintCats = new Set(['persistence', 'error_handling', 'data_format']);
  const hints = ctx.assumptions.filter((a) => hintCats.has(a.category));
  L.push('ヒント (AssumptionRecord から。要約の手がかり):');
  if (hints.length) for (const a of hints) L.push(`- [${a.category}] ${mdEscape(a.assumption)} — ${a.target || '?'}`);
  else L.push('- なし');
  L.push('');
  L.push(SUMMARY_BEGIN);
  if (preserved[0]) L.push(preserved[0]);
  L.push(SUMMARY_END);
  L.push('');

  // 6. 画面
  L.push('## 6. 画面 (抽出)');
  L.push('');
  if (ctx.screens.length) {
    L.push('| 画面 | コンポーネント | バリアント |');
    L.push('|---|---|---|');
    for (const s of ctx.screens) {
      L.push(`| ${mdEscape(s.name || s.screen || s.id)} | ${mdEscape((s.components || s.component || []).toString() || '-')} | ${mdEscape((s.variants || []).toString() || '-')} |`);
    }
  } else L.push('画面定義なし。');
  L.push('');

  // 7. 検証の証跡
  L.push('## 7. 検証の証跡 (抽出)');
  L.push('');
  if (ctx.scenarios.length) {
    L.push('| シナリオ | タグ | 結果 | 時間(ms) |');
    L.push('|---|---|---|---|');
    for (const s of ctx.scenarios) L.push(`| ${mdEscape(s.name)} | ${mdEscape(tagList(s.tags))} | ${s.status} | ${s.duration_ms} |`);
  } else L.push('シナリオレポートなし。');
  L.push('');
  L.push('ゲート:');
  if (ctx.gates && ctx.gates.gates) {
    L.push('');
    L.push('| ゲート | 結果 |');
    L.push('|---|---|');
    for (const g of ctx.gates.gates) L.push(`| ${g.name} | ${g.status} |`);
    L.push(`| (総合) | ${ctx.gates.result || '-'} |`);
  } else L.push('- gates.json なし');
  L.push('');
  L.push('単体・契約テスト件数:');
  L.push('');
  L.push('| ティア | 単体 (pass/total) | 契約 (pass/total) |');
  L.push('|---|---|---|');
  for (const t of ctx.tiers) {
    const u = ctx.unitByTier[t.id];
    const c = ctx.contractByTier[t.id];
    L.push(`| ${t.id} | ${u ? `${u.passed}/${u.total}` : '-'} | ${c ? `${c.passed}/${c.total}` : '-'} |`);
  }
  if (!ctx.tiers.length) L.push('| - | - | - |');
  L.push('');

  // 8. 補った前提と処遇
  L.push('## 8. 補った前提と処遇 (転記)');
  L.push('');
  const verdictById = {};
  for (const v of ctx.findings.verdicts) verdictById[`${v.tier}\u0000${v.id}`] = v.verdict;
  if (ctx.assumptions.length) {
    L.push('| id | ティア | 分類 | 前提 | 判定 | 処遇 |');
    L.push('|---|---|---|---|---|---|');
    for (const a of ctx.assumptions) {
      const verdict = verdictById[`${a.tier}\u0000${a.id}`] || '-';
      const dec = decisionText(ctx.decisions[a.id]);
      L.push(`| ${a.id} | ${a.tier} | ${a.category || '-'} | ${mdEscape(a.assumption)} | ${verdict} | ${mdEscape(dec)} |`);
    }
  } else L.push('補った前提なし。');
  // Verifier が見つけた unlisted (V-*) も転記
  const unlisted = ctx.findings.verdicts.filter((v) => v.verdict === 'unlisted');
  if (unlisted.length) {
    L.push('');
    L.push('Verifier が追記した黙った判断 (unlisted):');
    for (const v of unlisted) L.push(`- ${v.id} (${v.tier}): ${mdEscape(v.assumption)} — ${v.target || '?'}`);
  }
  L.push('');

  // 9. 逸脱と既知の課題
  L.push('## 9. 逸脱と既知の課題 (抽出 + 要約)');
  L.push('');
  L.push('未解決の課題 (issues):');
  if (ctx.issues.length) for (const it of ctx.issues) L.push(`- [${it.kind}] ${mdEscape(it.title)}`);
  else L.push('- なし');
  L.push('');
  L.push('Verifier の指摘:');
  const notable = ctx.findings.findings.filter((f) => ['blocker', 'major', 'minor'].includes(f.severity));
  if (notable.length) for (const f of notable) L.push(`- [${f.severity}] ${mdEscape(f.claim || f.kind)} (${f.tier}${f.target ? ', ' + f.target : ''})`);
  else L.push('- なし');
  L.push('');
  L.push('<!-- 要約: 既知の課題の背景と対処方針。根拠はコード位置 path:line -->');
  L.push(SUMMARY_BEGIN);
  if (preserved[1]) L.push(preserved[1]);
  L.push(SUMMARY_END);
  L.push('');

  return L.join('\n');
}

function yamlScalar(s) {
  const str = String(s == null ? '' : s);
  return /[:#\[\]{}]|^\s|\s$/.test(str) ? JSON.stringify(str) : str;
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
  return [...new Set(out)].sort();
}

/** 既存 index.md から 要約:begin..end の中身を順に取り出す。 */
function extractPreserved(text) {
  const out = [];
  if (!text) return out;
  const re = new RegExp(`${SUMMARY_BEGIN}\\n?([\\s\\S]*?)${SUMMARY_END}`, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    const inner = m[1].replace(/\n+$/, '').replace(/^\n+/, '');
    out.push(inner);
  }
  return out;
}

// ---------------------------------------------------------------------------
// sequence.md / coverage.md
// ---------------------------------------------------------------------------

function basisComment(ctx) {
  const basisVal = headerLine(ctx.basis).replace(/^basis:\s*/, '');
  return `<!-- basis: ${basisVal} | generated_at: ${ctx.generatedAt} | slug: ${ctx.slug} -->`;
}

function buildSequenceMd(ctx) {
  const L = [];
  L.push(basisComment(ctx));
  L.push('');
  L.push(`# ${ctx.uc.business} / ${ctx.uc.uc} — シーケンス (抽出)`);
  L.push('');
  if (!ctx.traces.length) { L.push('トレースなし。'); L.push(''); return L.join('\n'); }
  for (const tr of ctx.traces) {
    L.push(`## ${tr.scenario}`);
    L.push('');
    L.push('```mermaid');
    L.push(renderScenario(tr.lines));
    L.push('```');
    L.push('');
  }
  return L.join('\n');
}

function buildCoverageMd(ctx) {
  const L = [];
  L.push(basisComment(ctx));
  L.push('');
  L.push(`# ${ctx.uc.business} / ${ctx.uc.uc} — 受入基準カバレッジ (抽出)`);
  L.push('');
  const specMap = specById(ctx.reqDoc);
  const specIds = (ctx.uc.spec_ids || []).slice().sort();
  if (!specIds.length) { L.push('spec_ids なし。'); L.push(''); return L.join('\n'); }
  L.push('| SPEC | 受入基準 | 基準ID | シナリオ (結果) |');
  L.push('|---|---|---|---|');
  for (const specId of specIds) {
    const spec = specMap[specId];
    const criteria = (spec && spec.acceptance_criteria) || [];
    if (!criteria.length) {
      L.push(`| ${specId} | (受入基準なし) | - | - |`);
      continue;
    }
    criteria.forEach((crit, idx) => {
      const critId = `${specId}-${idx + 1}`;
      const tag = `@acceptance:${critId}`;
      const matched = ctx.scenarios.filter((s) => (s.tags || []).includes(tag)).map((s) => `${s.name} (${s.status})`);
      L.push(`| ${specId} | ${mdEscape(crit)} | ${critId} | ${mdEscape(matched.join('; ') || '未カバー')} |`);
    });
  }
  L.push('');
  return L.join('\n');
}

function specById(reqDoc) {
  const map = {};
  for (const req of (reqDoc && reqDoc.requirements) || []) for (const s of req.specifications || []) if (s.id) map[s.id] = s;
  return map;
}

// ---------------------------------------------------------------------------
// _system/*
// ---------------------------------------------------------------------------

function ucEntry(ctx) {
  return {
    business: ctx.uc.business,
    uc: ctx.uc.uc,
    spec_ids: (ctx.uc.spec_ids || []).slice().sort(),
    scenarios: ctx.scenarios.map((s) => ({ name: s.name, tags: s.tags, status: s.status })),
    operations: ctx.derived.operations,
    tables: ctx.derived.tables.map((t) => t.name),
    messages: ctx.derived.messages,
    files: ctx.files.all,
    gates: (ctx.gates && ctx.gates.result) || 'unknown',
    generated_at: ctx.generatedAt,
    as_built: `${ctx.docsRoot}/as-built/${ctx.uc.business}/${ctx.uc.uc}/`,
  };
}

function rebuildIndex(index, config) {
  const provider = openapiProvider(config);
  const acceptance = {};
  const operations = {};
  const tables = {};
  for (const slug of Object.keys(index.ucs).sort()) {
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
  for (const r of Object.values(acceptance)) { r.ucs.sort(); r.scenarios.sort(); }
  for (const r of Object.values(operations)) r.ucs.sort();
  for (const r of Object.values(tables)) r.ucs.sort();
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
  ops.sort((a, b) => a.operationId.localeCompare(b.operationId));
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
  if (!ctx.depcruise) { L.push('dependency-cruiser の JSON なし。'); L.push(''); return L.join('\n'); }
  const collapse = (mod) => {
    const m = String(mod).match(/^(apps\/[^/]+|packages\/[^/]+)/);
    return m ? m[1] : String(mod).split('/').slice(0, 1)[0];
  };
  const edges = new Set();
  for (const mod of ctx.depcruise.modules || []) {
    const from = collapse(mod.source);
    for (const dep of mod.dependencies || []) {
      const to = collapse(dep.resolved || dep.module);
      if (from && to && from !== to) edges.add(`${from}\u0000${to}`);
    }
  }
  L.push('```mermaid');
  L.push('graph LR');
  const nodes = new Set();
  for (const e of [...edges].sort()) { const [a, b] = e.split('\u0000'); nodes.add(a); nodes.add(b); }
  for (const e of [...edges].sort()) { const [a, b] = e.split('\u0000'); L.push(`  ${nodeId(a)}["${a}"] --> ${nodeId(b)}["${b}"]`); }
  if (!edges.size) for (const n of [...nodes].sort()) L.push(`  ${nodeId(n)}["${n}"]`);
  L.push('```');
  L.push('');
  const violations = (ctx.depcruise.summary && ctx.depcruise.summary.violations) || [];
  L.push('## 違反');
  L.push('');
  if (violations.length) {
    L.push('| from | to | rule | severity |');
    L.push('|---|---|---|---|');
    for (const v of violations.slice().sort((a, b) => String(a.from).localeCompare(String(b.from)))) {
      L.push(`| ${mdEscape(v.from)} | ${mdEscape(v.to)} | ${mdEscape(v.rule && v.rule.name)} | ${mdEscape(v.rule && v.rule.severity)} |`);
    }
  } else L.push('違反なし。');
  L.push('');
  return L.join('\n');
}
function nodeId(label) { return 'n_' + String(label).replace(/[^A-Za-z0-9]/g, '_'); }

function buildSystemIndex(index, docsRoot) {
  const L = [];
  L.push('# as-built 一覧 (抽出)');
  L.push('');
  L.push('| 業務 / UC | slug | ゲート | 生成日時 | ドキュメント |');
  L.push('|---|---|---|---|---|');
  for (const slug of Object.keys(index.ucs).sort()) {
    const e = index.ucs[slug];
    L.push(`| ${mdEscape(e.business)} / ${mdEscape(e.uc)} | ${slug} | ${e.gates || '-'} | ${e.generated_at || '-'} | [index](${e.as_built}index.md) |`);
  }
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
  ensureWrite(indexPath, buildIndexMd(ctx, preserved));
  ensureWrite(path.join(asBuiltDir, 'sequence.md'), buildSequenceMd(ctx));
  ensureWrite(path.join(asBuiltDir, 'coverage.md'), buildCoverageMd(ctx));

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
  for (const slug of Object.keys(index.ucs).sort()) ordered.ucs[slug] = index.ucs[slug];
  writeCanonicalJson(indexJsonPath, sortKeysDeep(ordered));

  ensureWrite(path.join(systemDir, 'api-inventory.md'), buildApiInventory(ctx, index));
  ensureWrite(path.join(systemDir, 'dependency-graph.md'), buildDependencyGraph(ctx));
  ensureWrite(path.join(systemDir, 'index.md'), buildSystemIndex(index, ctx.docsRoot));

  return { asBuiltDir, systemDir, slug: ctx.slug, scenarios: ctx.scenarios.length, operations: ctx.derived.operations.length };
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
  console.log(`as-built: ${path.relative(o.cwd, r.asBuiltDir)} (scenarios=${r.scenarios}, operations=${r.operations})`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = {
  run, collect, buildIndexMd, buildSequenceMd, buildCoverageMd, buildApiInventory, buildDependencyGraph,
  buildSystemIndex, rebuildIndex, ucEntry, extractPreserved, parseCucumberReport, parseVitestReport,
  scenarioStatus, parseFrontMatter, main,
};
