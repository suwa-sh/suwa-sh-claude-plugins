/**
 * gherkin.js — .feature の構造を読む (外部依存なし)
 *
 * 用途: タグの列挙 (UC / 受入基準の対応チェック)、Scenario 一覧、step 骨格の生成、
 *       cucumber-js --dry-run の結果 (undefined step) の読み取り。
 * 英語と日本語 (# language: ja) のキーワードに対応。Doc string と表は step の引数として保持する。
 */
'use strict';

const { spawnSync } = require('node:child_process');

const KW = {
  feature: ['Feature', '機能', 'フィーチャ'],
  background: ['Background', '背景'],
  scenario: ['Scenario', 'Example', 'シナリオ'],
  outline: ['Scenario Outline', 'Scenario Template', 'シナリオアウトライン', 'シナリオテンプレート', 'シナリオテンプレ'],
  examples: ['Examples', 'Scenarios', '例', 'サンプル'],
  rule: ['Rule', 'ルール'],
};
const STEP_KW = ['Given', 'When', 'Then', 'And', 'But', '前提', 'もし', 'ならば', 'かつ', 'しかし', 'ただし', '*'];

function matchKeyword(line, list) {
  for (const kw of list) {
    if (line.startsWith(kw + ':')) return { kw, rest: line.slice(kw.length + 1).trim() };
  }
  return null;
}

function matchStep(line) {
  for (const kw of STEP_KW) {
    if (kw === '*') { if (line.startsWith('* ')) return { keyword: '*', text: line.slice(2).trim() }; continue; }
    if (line.startsWith(kw + ' ') || (/^[^\x00-\x7F]/.test(kw) && line.startsWith(kw))) {
      const rest = line.slice(kw.length).trim();
      if (rest) return { keyword: kw, text: rest };
    }
  }
  return null;
}

function parseFeature(text) {
  const lines = text.split('\n');
  const feature = { name: null, tags: [], background: null, scenarios: [], language: 'en', comments: [] };
  let pendingTags = [];
  let current = null; // background or scenario
  let inDoc = null;
  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];
    const line = raw.trim();
    const lineNo = idx + 1;
    if (inDoc) {
      if (line === inDoc.fence) { current.steps[current.steps.length - 1].docString = inDoc.lines.join('\n'); inDoc = null; }
      else inDoc.lines.push(raw.replace(/^\s{0,}/, ''));
      continue;
    }
    if (line === '') continue;
    if (line.startsWith('#')) {
      const lang = line.match(/^#\s*language:\s*(\S+)/);
      if (lang) feature.language = lang[1];
      feature.comments.push({ line: lineNo, text: line.slice(1).trim() });
      continue;
    }
    if (line.startsWith('@')) { pendingTags.push(...line.split(/\s+/).filter(t => t.startsWith('@'))); continue; }
    let m;
    if ((m = matchKeyword(line, KW.feature))) { feature.name = m.rest; feature.tags = pendingTags; pendingTags = []; feature.line = lineNo; continue; }
    if ((m = matchKeyword(line, KW.background))) { current = { name: m.rest, steps: [], line: lineNo }; feature.background = current; pendingTags = []; continue; }
    if ((m = matchKeyword(line, KW.outline)) || (m = matchKeyword(line, KW.scenario))) {
      const outline = KW.outline.includes(m.kw);
      current = { name: m.rest, tags: pendingTags, steps: [], line: lineNo, outline, examples: [] };
      feature.scenarios.push(current); pendingTags = []; continue;
    }
    if ((m = matchKeyword(line, KW.examples))) { if (current) current.examples.push({ name: m.rest, tags: pendingTags, rows: [], line: lineNo }); pendingTags = []; continue; }
    if (matchKeyword(line, KW.rule)) { pendingTags = []; continue; }
    if (line.startsWith('|') && current) {
      const cells = line.slice(1, line.lastIndexOf('|')).split('|').map(c => c.trim());
      const ex = current.examples && current.examples.length ? current.examples[current.examples.length - 1] : null;
      if (ex && current.steps.length && ex.line > current.steps[current.steps.length - 1].line) ex.rows.push(cells);
      else if (current.steps.length) (current.steps[current.steps.length - 1].table ||= []).push(cells);
      continue;
    }
    if ((line.startsWith('"""') || line.startsWith('```')) && current && current.steps.length) { inDoc = { fence: line.slice(0, 3), lines: [] }; continue; }
    const step = matchStep(line);
    if (step && current) { current.steps.push({ ...step, line: lineNo }); continue; }
  }
  return feature;
}

function allTags(feature) {
  const set = new Set(feature.tags);
  for (const s of feature.scenarios) for (const t of s.tags) set.add(t);
  return [...set];
}

function scenariosWithTag(feature, prefix) {
  return feature.scenarios.filter(s => [...feature.tags, ...s.tags].some(t => t === prefix || t.startsWith(prefix)));
}

/** 受入基準タグ `@acceptance:SPEC-001-2` から `{spec: 'SPEC-001', n: 2}` を取り出す */
function parseAcceptanceTag(tag) {
  const m = tag.match(/^@acceptance:([A-Za-z0-9_-]+?)-(\d+)$/);
  return m ? { spec: m[1], n: Number(m[2]) } : null;
}

/**
 * cucumber-js --dry-run を実行し、undefined / ambiguous な step を返す。
 * @returns {{ok: boolean, undefined: {text: string, location: string}[], error?: string}}
 */
function dryRun(cwd, extraArgs = []) {
  const res = spawnSync('npx', ['cucumber-js', '--dry-run', '--format', 'json', ...extraArgs], { cwd, encoding: 'utf8' });
  if (res.error) return { ok: false, undefined: [], error: res.error.message };
  let report;
  try { report = JSON.parse(res.stdout.slice(res.stdout.indexOf('['))); } catch { return { ok: false, undefined: [], error: res.stderr || res.stdout }; }
  const undef = [];
  for (const f of report) for (const el of f.elements || []) for (const st of el.steps || []) {
    if (st.result && (st.result.status === 'undefined' || st.result.status === 'ambiguous')) undef.push({ text: `${st.keyword}${st.name}`, location: `${f.uri}:${st.line}`, status: st.result.status });
  }
  return { ok: res.status === 0 && undef.length === 0, undefined: undef, raw: report };
}

module.exports = { parseFeature, allTags, scenariosWithTag, parseAcceptanceTag, dryRun, STEP_KW, KW };
