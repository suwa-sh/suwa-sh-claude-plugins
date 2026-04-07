#!/usr/bin/env node
/**
 * generateSpecEventMd.js
 *
 * spec-event.yaml を Spec 概要 Markdown に変換する。
 *
 * Usage:
 *   node generateSpecEventMd.js <input-yaml> [output-md]
 *
 *   input-yaml : spec-event.yaml のパス
 *   output-md  : 出力先 .md のパス（省略時は入力と同じディレクトリに spec-event.md を生成）
 *
 * npm 依存なし。Node.js 18+ 標準モジュールのみ使用。
 */

const fs = require('fs');
const path = require('path');
const { parseYaml } = require('./lib/yaml-parser');

// ============================================================
// Markdown ヘルパー
// ============================================================

function esc(text) {
  if (text === null || text === undefined) return '-';
  return String(text).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

// ============================================================
// Markdown 生成
// ============================================================

function generateMarkdown(data) {
  const lines = [];
  const useCases = data.use_cases || [];
  const crossCutting = data.cross_cutting || {};
  const stats = data.stats || {};

  // ヘッダー
  lines.push('# Spec Event Summary');
  lines.push('');

  // Overview
  lines.push('## Overview');
  lines.push('');
  lines.push('| 項目 | 内容 |');
  lines.push('|------|------|');
  lines.push(`| Event ID | ${esc(data.event_id)} |`);
  lines.push(`| Created At | ${esc(data.created_at)} |`);
  lines.push(`| Source | ${esc(data.source)} |`);
  lines.push(`| UC 総数 | ${esc(stats.total_ucs)} |`);
  lines.push(`| API 総数 | ${esc(stats.total_apis)} |`);
  lines.push(`| 非同期イベント総数 | ${esc(stats.total_async_events)} |`);
  lines.push(`| 業務数 | ${esc(stats.businesses)} |`);
  lines.push(`| BUC 数 | ${esc(stats.bucs)} |`);
  lines.push('');

  // UC 一覧
  lines.push('## UC 一覧');
  lines.push('');
  lines.push('| 業務 | BUC | UC | API数 | 非同期 | インフラ |');
  lines.push('|------|-----|-----|:-----:|:-----:|:-------:|');

  for (const uc of useCases) {
    const asyncFlag = uc.has_asyncapi ? 'Yes' : '-';
    const infraFlag = uc.has_infra ? 'Yes' : '-';
    const apiCount = uc.api_count !== null && uc.api_count !== undefined ? uc.api_count : '-';
    lines.push(`| ${esc(uc.business)} | ${esc(uc.buc)} | ${esc(uc.uc)} | ${apiCount} | ${asyncFlag} | ${infraFlag} |`);
  }
  lines.push('');

  // UC ファイル構成
  lines.push('## UC ファイル構成');
  lines.push('');

  // Group by business
  const byBusiness = {};
  for (const uc of useCases) {
    const biz = uc.business || 'unknown';
    if (!byBusiness[biz]) byBusiness[biz] = {};
    const buc = uc.buc || 'unknown';
    if (!byBusiness[biz][buc]) byBusiness[biz][buc] = [];
    byBusiness[biz][buc].push(uc);
  }

  for (const [biz, bucs] of Object.entries(byBusiness)) {
    lines.push(`### ${esc(biz)}`);
    lines.push('');
    for (const [buc, ucs] of Object.entries(bucs)) {
      lines.push(`#### ${esc(buc)}`);
      lines.push('');
      for (const uc of ucs) {
        const files = (uc.files || []).join(', ');
        lines.push(`- **${esc(uc.uc)}**: ${files}`);
      }
      lines.push('');
    }
  }

  // 全体横断仕様
  lines.push('## 全体横断仕様');
  lines.push('');

  const ux = crossCutting.ux_design || {};
  const ui = crossCutting.ui_design || {};
  const dv = crossCutting.data_visualization || {};

  lines.push('### UX Design');
  lines.push('');
  lines.push(`- User Flows: ${esc(ux.user_flows)}`);
  lines.push(`- IA Pages: ${esc(ux.ia_pages)}`);
  lines.push(`- Psychology Principles: ${esc(ux.psychology_principles)}`);
  lines.push('');

  lines.push('### UI Design');
  lines.push('');
  lines.push(`- Layout Patterns: ${esc(ui.layout_patterns)}`);
  lines.push(`- Responsive Breakpoints: ${esc(ui.responsive_breakpoints)}`);
  lines.push(`- Component Guidelines: ${esc(ui.component_guidelines)}`);
  lines.push('');

  lines.push('### Data Visualization');
  lines.push('');
  lines.push(`- Target Screens: ${esc(dv.target_screens)}`);
  lines.push(`- Chart Types: ${esc(dv.chart_types)}`);
  lines.push('');

  return lines.join('\n');
}

// ============================================================
// Main
// ============================================================

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node generateSpecEventMd.js <input-yaml> [output-md]');
    process.exit(1);
  }

  const resolvedInput = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`Error: File not found: ${resolvedInput}`);
    process.exit(1);
  }

  const outputPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(path.dirname(resolvedInput), 'spec-event.md');

  const yamlText = fs.readFileSync(resolvedInput, 'utf-8');
  const data = parseYaml(yamlText);

  const markdown = generateMarkdown(data);
  fs.writeFileSync(outputPath, markdown, 'utf-8');

  const useCases = data.use_cases || [];
  const stats = data.stats || {};

  console.log(`Generated: ${outputPath}`);
  console.log(`  UCs: ${useCases.length}, APIs: ${stats.total_apis || 0}, Async Events: ${stats.total_async_events || 0}`);
}

main();
