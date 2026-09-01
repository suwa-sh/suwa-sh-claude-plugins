#!/usr/bin/env node
'use strict';
// セッション transcript(~/.claude/projects/<project>/<session>.jsonl と <session>/subagents/agent-*.jsonl)から
// エージェント別のトークン消費を集計する。
//
// Usage:
//   node tokenReport.js <session.jsonl | セッション dir | プロジェクト dir> [--json] [--md] [--out <dir>] [--latest]
//                       [--weights cache_read=0.1,cache_creation=1.25,output=5,input=1]
//
// - jsonl 指定: そのセッション(main)と <同名 dir>/subagents/agent-*.jsonl を集計
// - dir 指定: 直下の *.jsonl をすべてセッションとして集計(--latest で mtime 最新の 1 件のみ)
// - 出力: 既定は markdown + JSON を stdout。--json / --md は stdout に出す形式の選択。
//   --out <dir> は選択に関係なく token-report.md / token-report.json の両方を書く
//
// 集計規則:
// - type=assistant の行の message.usage を合算する。同じ message.id が content block ごとに複数行出るため id で重複排除する
// - max_context = 1 メッセージの input + cache_creation + cache_read の最大値
// - reported_tokens = main transcript 内の task-notification(<task-id> と <subagent_tokens>)を subagent id で突合した値(検算用)。
//   通知は type=queue-operation 行の content(文字列)にだけ現れるので、それ以外の行は解析しない
// - output_tokens は transcript では streaming 初期値のため過小。既定 weight は 0(コスト評価に含めない)
// - transcript は 1 セッション数 MB 程度(実測最大 1.5MB)なので同期一括読みで足りる

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_WEIGHTS = { input: 1, cache_creation: 1.25, cache_read: 0.1, output: 0 };

function emptyUsage() {
  return { msgs: 0, input: 0, cache_creation: 0, cache_read: 0, output: 0, max_context: 0, model: null, first_ts: null, last_ts: null };
}

// 通知ブロック(<task-notification>…</task-notification>)ごとに、<task-id> と <usage> ブロック内の
// <subagent_tokens> を取り出す。<result> は subagent の任意文字列を含むため、<usage> の外にある同名タグは無視する
// <result> が "</task-notification>" や "<usage>" を含んでも壊れないよう、ブロック境界は最後の閉じタグ、
// usage はブロック末尾側の最後の <usage> を採用する(実際の通知では usage が result の後ろ・末尾にある)
function parseNotifications(text, into) {
  const chunks = text.split('<task-notification>').slice(1);
  for (const chunk of chunks) {
    const end = chunk.lastIndexOf('</task-notification>');
    const body = end >= 0 ? chunk.slice(0, end) : chunk;
    const id = /<task-id>([^<\s]+)<\/task-id>/.exec(body);
    if (!id) continue;
    const usageStart = body.lastIndexOf('<usage>');
    if (usageStart < 0) continue;
    const usage = /<usage>([\s\S]*?)<\/usage>/.exec(body.slice(usageStart));
    if (!usage) continue;
    const tokens = /<subagent_tokens>(\d*)<\/subagent_tokens>/.exec(usage[1]);
    if (!tokens) continue;
    into[id[1]] = tokens[1] === '' ? null : Number(tokens[1]);
  }
}

function parseTranscript(file) {
  const usage = emptyUsage();
  const notifications = {};
  const seen = new Set();
  const lines = fs.readFileSync(file, 'utf-8').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (!row || typeof row !== 'object') continue;
    if (row.type === 'queue-operation' && typeof row.content === 'string' && row.content.includes('<task-notification>')) {
      parseNotifications(row.content, notifications);
      continue;
    }
    if (row.type !== 'assistant' || !row.message || typeof row.message !== 'object') continue;
    const u = row.message.usage;
    if (!u) continue;
    const id = row.message.id || row.uuid;
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    const inp = u.input_tokens || 0;
    const cc = u.cache_creation_input_tokens || 0;
    const cr = u.cache_read_input_tokens || 0;
    const out = u.output_tokens || 0;
    usage.msgs += 1;
    usage.input += inp;
    usage.cache_creation += cc;
    usage.cache_read += cr;
    usage.output += out;
    usage.max_context = Math.max(usage.max_context, inp + cc + cr);
    if (!usage.model && row.message.model) usage.model = row.message.model;
    if (row.timestamp) {
      if (!usage.first_ts) usage.first_ts = row.timestamp;
      usage.last_ts = row.timestamp;
    }
  }
  return { ...usage, notifications };
}

function readMeta(jsonlFile) {
  const metaFile = jsonlFile.replace(/\.jsonl$/, '.meta.json');
  try { return JSON.parse(fs.readFileSync(metaFile, 'utf-8')); } catch { return {}; }
}

function collectSession(jsonlFile) {
  const sessionId = path.basename(jsonlFile, '.jsonl');
  const main = parseTranscript(jsonlFile);
  const subDir = path.join(path.dirname(jsonlFile), sessionId, 'subagents');
  const subagents = [];
  if (fs.existsSync(subDir)) {
    for (const name of fs.readdirSync(subDir).filter(n => n.startsWith('agent-') && n.endsWith('.jsonl')).sort()) {
      const file = path.join(subDir, name);
      const id = name.slice('agent-'.length, -'.jsonl'.length);
      const meta = readMeta(file);
      const parsed = parseTranscript(file);
      subagents.push({ id, file, meta, ...parsed });
    }
  }
  return { session: sessionId, file: jsonlFile, main, subagents };
}

function parseWeights(text) {
  const w = { ...DEFAULT_WEIGHTS };
  if (!text) return w;
  for (const pair of text.split(',')) {
    if (!pair.trim()) continue;
    const m = /^\s*([a-z_]+)\s*=\s*([^=\s]+)\s*$/.exec(pair);
    const key = m ? m[1] : '';
    const value = m ? Number(m[2]) : NaN;
    if (Object.hasOwn(w, key) && Number.isFinite(value) && value >= 0) {
      w[key] = value;
    } else {
      console.warn(`warning: --weights entry "${pair}" ignored (known keys: ${Object.keys(DEFAULT_WEIGHTS).join(', ')}; value must be a finite number >= 0)`);
    }
  }
  return w;
}

function costOf(row, weights) {
  return row.input * weights.input + row.cache_creation * weights.cache_creation
    + row.cache_read * weights.cache_read + row.output * weights.output;
}

function aggregate(sessions, weights = DEFAULT_WEIGHTS) {
  const agents = [];
  for (const s of sessions) {
    const reported = s.main.notifications || {};
    agents.push({
      session: s.session, agent: 'main', description: '(orchestrator)', spawn_depth: 0, agent_type: null,
      msgs: s.main.msgs, input: s.main.input, cache_creation: s.main.cache_creation, cache_read: s.main.cache_read,
      output: s.main.output, max_context: s.main.max_context, model: s.main.model, reported_tokens: null,
      cost: costOf(s.main, weights),
    });
    for (const a of s.subagents) {
      agents.push({
        session: s.session, agent: a.id, description: a.meta.description || a.meta.name || '', spawn_depth: a.meta.spawnDepth ?? null,
        agent_type: a.meta.agentType || null,
        msgs: a.msgs, input: a.input, cache_creation: a.cache_creation, cache_read: a.cache_read, output: a.output,
        max_context: a.max_context, model: a.model, reported_tokens: reported[a.id] ?? null, cost: costOf(a, weights),
      });
    }
  }
  const totals = agents.reduce((t, a) => ({
    agents: t.agents + 1, msgs: t.msgs + a.msgs, input: t.input + a.input, cache_creation: t.cache_creation + a.cache_creation,
    cache_read: t.cache_read + a.cache_read, output: t.output + a.output, cost: t.cost + a.cost,
  }), { agents: 0, msgs: 0, input: 0, cache_creation: 0, cache_read: 0, output: 0, cost: 0 });
  return { sessions: sessions.map(s => s.session), weights, agents, totals };
}

function fmt(n) {
  return n === null || n === undefined ? '-' : Math.round(n).toLocaleString('en-US');
}

// Markdown 表のセル用エスケープ(description は subagent 起動時の任意文字列)
function cell(s) {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\r\n?|\n/g, '<br>');
}

function renderMarkdown(report) {
  const rows = [...report.agents].sort((a, b) => b.cost - a.cost);
  const lines = [];
  lines.push(`# Token report (${report.sessions.join(', ')})`);
  lines.push('');
  lines.push(`weights: input=${report.weights.input} cache_creation=${report.weights.cache_creation} cache_read=${report.weights.cache_read} output=${report.weights.output}`);
  lines.push('');
  lines.push('| session | agent | description | depth | msgs | input | cache_creation | cache_read | output | max_context | reported | cost |');
  lines.push('|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of rows) {
    lines.push(`| ${r.session.slice(0, 8)} | ${r.agent === 'main' ? 'main' : r.agent.slice(0, 8)} | ${cell(r.description)} | ${r.spawn_depth ?? '-'} | ${fmt(r.msgs)} | ${fmt(r.input)} | ${fmt(r.cache_creation)} | ${fmt(r.cache_read)} | ${fmt(r.output)} | ${fmt(r.max_context)} | ${fmt(r.reported_tokens)} | ${fmt(r.cost)} |`);
  }
  const t = report.totals;
  lines.push(`| **total** | ${t.agents} agents | | | ${fmt(t.msgs)} | ${fmt(t.input)} | ${fmt(t.cache_creation)} | ${fmt(t.cache_read)} | ${fmt(t.output)} | | | ${fmt(t.cost)} |`);
  lines.push('');
  return lines.join('\n');
}

function resolveSessionFiles(target, latest) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  // セッション dir(<uuid>/)が指定された場合は隣の <uuid>.jsonl を使う
  const sibling = path.join(path.dirname(target), `${path.basename(target)}.jsonl`);
  if (fs.existsSync(sibling) && fs.existsSync(path.join(target, 'subagents'))) return [sibling];
  const files = fs.readdirSync(target).filter(n => n.endsWith('.jsonl')).map(n => path.join(target, n));
  if (files.length === 0) throw new Error(`no .jsonl under ${target}`);
  if (!latest) return files.sort();
  return [files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0]];
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0].startsWith('--')) {
    console.error('Usage: node tokenReport.js <session.jsonl | dir> [--json] [--md] [--out <dir>] [--latest] [--weights k=v,...]');
    process.exit(1);
  }
  const target = args[0];
  let json = false; let md = false; let out = null; let latest = false; let weightsText = null;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--json') json = true;
    else if (args[i] === '--md') md = true;
    else if (args[i] === '--latest') latest = true;
    else if (args[i] === '--out') out = args[++i];
    else if (args[i] === '--weights') weightsText = args[++i];
  }
  if (!json && !md) { json = true; md = true; }
  const sessions = resolveSessionFiles(target, latest).map(collectSession);
  const report = aggregate(sessions, parseWeights(weightsText));
  const mdText = renderMarkdown(report);
  const jsonText = JSON.stringify(report, null, 2);
  if (out) {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'token-report.md'), mdText + '\n', 'utf-8');
    fs.writeFileSync(path.join(out, 'token-report.json'), jsonText + '\n', 'utf-8');
    console.log(`written: ${path.join(out, 'token-report.md')}, ${path.join(out, 'token-report.json')}`);
  }
  if (md) process.stdout.write(mdText + '\n');
  if (json) process.stdout.write(jsonText + '\n');
}

module.exports = { parseTranscript, collectSession, aggregate, renderMarkdown, parseWeights, resolveSessionFiles, DEFAULT_WEIGHTS };

if (require.main === module) main(process.argv);
