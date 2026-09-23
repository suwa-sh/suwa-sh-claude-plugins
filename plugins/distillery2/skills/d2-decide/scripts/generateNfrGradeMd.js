#!/usr/bin/env node
/**
 * generateNfrGradeMd.js (distillery2)
 *
 * nfr-grade.yaml を IPA 非機能要求グレード活用シート形式の Markdown 表に変換する。
 * 決定論的 (同一入力 → 同一出力)。共有ライブラリの parseYaml を使う。
 *
 * Usage:
 *   node generateNfrGradeMd.js <input-yaml> [output-md]
 *
 * v1 との違い: 入力 yaml に basis があれば先頭に YAML front matter として書き出す。
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseYaml } = require('../../../scripts/lib/yaml');

const MODEL_SYSTEM_LABELS = {
  model1: 'モデルシステム1（社会的影響がほとんど無い）',
  model2: 'モデルシステム2（社会的影響が限定される）',
  model3: 'モデルシステム3（社会的影響が極めて大きい）',
};
const CONFIDENCE_LABELS = { high: '高', medium: '中', low: '低', default: 'デフォルト', user: 'ユーザー指定' };

function esc(text) {
  if (text === null || text === undefined) return '-';
  return String(text).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}
function gradeLabel(grade) {
  const n = Number(grade);
  if (Number.isNaN(n) || n < 0 || n > 5) return `Lv${grade}`;
  return `Lv${n}`;
}
function confidenceBadge(c) { return CONFIDENCE_LABELS[c] || c || '-'; }

function generateMarkdown(data) {
  const lines = [];
  const categories = data.categories || [];
  const ms = data.model_system || {};

  if (data.basis) { lines.push('---', `basis: ${data.basis}`, '---', ''); }

  lines.push('# 非機能要求グレード表', '');
  lines.push('## 概要', '');
  lines.push('| 項目 | 内容 |', '|------|------|');
  lines.push(`| モデルシステム | ${esc(MODEL_SYSTEM_LABELS[ms.type] || ms.type)} |`);
  lines.push(`| 選定根拠 | ${esc(ms.reason)} |`);
  lines.push('');

  lines.push('## サマリ', '');
  lines.push('| カテゴリ | メトリクス数 | 重要項目 | 平均Lv | 確信度内訳（高/中/低/デフォルト/ユーザー） |');
  lines.push('|---------|:----------:|:-------:|:-----:|----------------------------------------|');
  let totalMetrics = 0, totalImportant = 0;
  for (const cat of categories) {
    let metricCount = 0, importantCount = 0, gradeSum = 0;
    const conf = { high: 0, medium: 0, low: 0, default: 0, user: 0 };
    for (const sub of cat.subcategories || []) for (const item of sub.items || []) for (const m of item.metrics || []) {
      metricCount++; if (m.important) importantCount++; gradeSum += Number(m.grade) || 0;
      const c = m.confidence || 'default'; if (c in conf) conf[c]++;
    }
    totalMetrics += metricCount; totalImportant += importantCount;
    const avg = metricCount > 0 ? (gradeSum / metricCount).toFixed(1) : '-';
    lines.push(`| **${esc(cat.id)}. ${esc(cat.name)}** | ${metricCount} | ${importantCount} | ${avg} | ${conf.high}/${conf.medium}/${conf.low}/${conf.default}/${conf.user} |`);
  }
  lines.push(`| **合計** | **${totalMetrics}** | **${totalImportant}** | | |`, '');

  for (const cat of categories) {
    lines.push(`## ${esc(cat.id)}. ${esc(cat.name)}`, '');
    lines.push('| 中項目 | 小項目 | ★ | メトリクス | Lv | 内容 | 根拠 | 確信度 | RDRA要素 |');
    lines.push('|--------|--------|:-:|----------|:--:|------|------|:-----:|---------|');
    for (const sub of cat.subcategories || []) {
      let firstSub = true;
      for (const item of sub.items || []) {
        let firstItem = true;
        for (const m of item.metrics || []) {
          const subLabel = firstSub ? `**${esc(sub.id)}** ${esc(sub.name)}` : '';
          const itemLabel = firstItem ? `${esc(item.id)} ${esc(item.name)}` : '';
          const imp = m.important ? '★' : '';
          const source = m.source_model ? esc(m.source_model) : '-';
          const gradeDesc = m.grade_description ? esc(m.grade_description) : '-';
          lines.push(`| ${subLabel} | ${itemLabel} | ${imp} | ${esc(m.id)} ${esc(m.name)} | **${gradeLabel(m.grade)}** | ${gradeDesc} | ${esc(m.reason)} | ${confidenceBadge(m.confidence)} | ${source} |`);
          firstSub = false; firstItem = false;
        }
      }
    }
    lines.push('');
  }

  lines.push('## 凡例', '', '### レベル定義', '');
  lines.push('| Lv | 意味 |', '|:--:|------|');
  lines.push('| 0 | 規定なし・最低水準 |', '| 1 | 低水準 |', '| 2 | 標準水準 |', '| 3 | 高水準 |', '| 4 | 非常に高い水準 |', '| 5 | 最高水準 |', '');
  lines.push('### 確信度', '');
  lines.push('| 確信度 | 意味 |', '|:------:|------|');
  lines.push('| 高 | RDRA モデルから明確に推論 |', '| 中 | RDRA モデルから間接推論 |', '| 低 | 弱い根拠での推論 |', '| デフォルト | モデルシステムのデフォルト値 |', '| ユーザー指定 | 対話でユーザーが指定 |', '');
  lines.push('### 記号', '', '- ★: IPA 非機能要求グレードの重要項目', '');
  return lines.join('\n');
}

function main(argv) {
  const inputPath = argv[0];
  if (!inputPath) { console.error('Usage: node generateNfrGradeMd.js <input-yaml> [output-md]'); return 1; }
  const resolvedInput = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInput)) { console.error(`Error: File not found: ${resolvedInput}`); return 1; }
  const outputPath = argv[1] ? path.resolve(argv[1]) : path.join(path.dirname(resolvedInput), 'nfr-grade.md');
  const data = parseYaml(fs.readFileSync(resolvedInput, 'utf8'));
  fs.writeFileSync(outputPath, generateMarkdown(data), 'utf8');
  let metricCount = 0;
  for (const cat of data.categories || []) for (const sub of cat.subcategories || []) for (const item of sub.items || []) metricCount += (item.metrics || []).length;
  console.log(`Generated: ${outputPath}`);
  console.log(`  Model System: ${(data.model_system || {}).type || 'unknown'}`);
  console.log(`  Categories: ${(data.categories || []).length}, Metrics: ${metricCount}`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { generateMarkdown };
