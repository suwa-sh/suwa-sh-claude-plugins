#!/usr/bin/env node
'use strict';

// 決定的な特徴量抽出。数える・数値を比べる・必要な部分だけ切り出す処理はここで行い、
// Jev には意味の判定だけを聞く（experiments/jev/DESIGN.md 分担の原則）。

const fs = require('node:fs');
const path = require('node:path');
const { parse: parseYaml } = require('yaml');

// TSV は 1 行目が見出し。`""` だけのセルは空として扱う。
function parseTsv(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split('\t');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '') continue;
    const cells = lines[i].split('\t');
    const row = {};
    for (let c = 0; c < headers.length; c++) {
      const raw = cells[c] ?? '';
      row[headers[c]] = raw === '""' ? '' : raw;
    }
    rows.push(row);
  }
  return { headers, rows };
}

function readTsv(dir, filename) {
  const file = path.join(dir, filename);
  if (!fs.existsSync(file)) return { headers: [], rows: [] };
  return parseTsv(fs.readFileSync(file, 'utf8'));
}

// nfr-grade.yaml を再帰的にたどり、id と grade を両方持つ要素（メトリクス）を集める。
function collectNfrMetrics(node, out) {
  if (Array.isArray(node)) {
    for (const item of node) collectNfrMetrics(item, out);
    return;
  }
  if (node && typeof node === 'object') {
    if (typeof node.id === 'string' && typeof node.grade === 'number') {
      out[node.id] = node.grade;
    }
    for (const value of Object.values(node)) collectNfrMetrics(value, out);
  }
}

function extractNfr(rdraDir, nfrDir) {
  const file = path.join(nfrDir, 'nfr-grade.yaml');
  if (!fs.existsSync(file)) return {};
  const doc = parseYaml(fs.readFileSync(file, 'utf8'));
  const out = {};
  collectNfrMetrics(doc, out);
  return out;
}

function dedupe(rows, keyFn) {
  const seen = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!seen.has(key)) seen.set(key, row);
  }
  return [...seen.values()];
}

function extractFeatures(docsDir) {
  const rdraDir = path.join(docsDir, 'rdra', 'latest');
  const nfrDir = path.join(docsDir, 'nfr', 'latest');

  const buc = readTsv(rdraDir, 'BUC.tsv');
  const actorsTsv = readTsv(rdraDir, 'アクター.tsv');
  const externalSystemsTsv = readTsv(rdraDir, '外部システム.tsv');
  const informationTsv = readTsv(rdraDir, '情報.tsv');
  const stateTsv = readTsv(rdraDir, '状態.tsv');
  const conditionsTsv = readTsv(rdraDir, '条件.tsv');
  const overviewFile = path.join(rdraDir, 'システム概要.json');
  const overview = fs.existsSync(overviewFile) ? JSON.parse(fs.readFileSync(overviewFile, 'utf8')) : {};

  // slices.activities: BUC.tsv から { buc, activity, uc, description } を重複排除
  const activityRows = buc.rows
    .filter((r) => r['アクティビティ'])
    .map((r) => ({
      buc: r['BUC'] || '',
      activity: r['アクティビティ'] || '',
      uc: r['UC'] || '',
      description: r['説明'] || '',
    }));
  const activitiesByKey = new Map();
  for (const row of activityRows) {
    const key = `${row.buc}\u0001${row.activity}\u0001${row.uc}`;
    const existing = activitiesByKey.get(key);
    if (!existing) {
      activitiesByKey.set(key, { ...row });
    } else if (!existing.description && row.description) {
      existing.description = row.description;
    }
  }
  const activities = [...activitiesByKey.values()];

  const externalSystems = externalSystemsTsv.rows
    .filter((r) => r['外部システム'])
    .map((r) => ({ name: r['外部システム'], role: r['役割'] || '' }));

  const actors = actorsTsv.rows
    .filter((r) => r['アクター'])
    .map((r) => ({ name: r['アクター'], role: r['役割'] || '', internalExternal: r['社内外'] || '' }));

  const information = informationTsv.rows
    .filter((r) => r['情報'])
    .map((r) => ({ name: r['情報'], attributes: r['属性'] || '', description: r['説明'] || '' }));

  const conditions = conditionsTsv.rows
    .filter((r) => r['条件'])
    .map((r) => ({ name: r['条件'], description: r['条件の説明'] || '' }));

  // slices.stateModels: 状態モデルごとに遷移をまとめる（コンテキストが違えば同名モデルも別扱い）
  const stateModelMap = new Map();
  for (const row of stateTsv.rows) {
    const model = row['状態モデル'];
    if (!model) continue;
    const key = `${row['コンテキスト'] || ''}\u0001${model}`;
    if (!stateModelMap.has(key)) stateModelMap.set(key, { model, context: row['コンテキスト'] || '', transitions: [] });
    stateModelMap.get(key).transitions.push({
      from: row['状態'] || '',
      uc: row['遷移UC'] || '',
      to: row['遷移先状態'] || '',
      description: row['説明'] || '',
    });
  }
  const stateModels = [...stateModelMap.values()];

  // counts
  const bucNames = dedupe(buc.rows.filter((r) => r['BUC']), (r) => r['BUC']);
  const ucNames = dedupe(buc.rows.filter((r) => r['UC']), (r) => r['UC']);
  const maxStateTransitions = stateModels.reduce((max, m) => Math.max(max, m.transitions.length), 0);

  const counts = {
    externalSystems: externalSystems.length,
    actors: actors.length,
    externalActors: actors.filter((a) => a.internalExternal === '社外').length,
    information: information.length,
    maxStateTransitions,
    buc: bucNames.length,
    uc: ucNames.length,
  };

  const nfr = extractNfr(rdraDir, nfrDir);

  return {
    counts,
    nfr,
    slices: {
      activities,
      externalSystems,
      actors,
      information,
      conditions,
      stateModels,
      overview,
    },
  };
}

module.exports = { extractFeatures, parseTsv, collectNfrMetrics };
