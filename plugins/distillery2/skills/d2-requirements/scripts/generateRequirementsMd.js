#!/usr/bin/env node
/**
 * generateRequirementsMd.js (distillery2)
 *
 * USDM requirements.yaml を人間が読める Markdown 表形式に変換する。決定論的 (同一入力 → 同一出力)。
 *
 * Usage:
 *   node generateRequirementsMd.js <input-yaml> [output-md]
 *   input-yaml : requirements.yaml のパス (既定 docs/requirements/requirements.yaml)
 *   output-md  : 省略時は入力と同じディレクトリの requirements.md
 *
 * npm 依存なし。共有ライブラリ (../../../scripts/lib) の parseYaml を使う。
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseYaml } = require('../../../scripts/lib/yaml');

function escapeCell(text) {
  if (!text) return '';
  return String(text).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function generateMarkdown(data) {
  const lines = [];
  lines.push('# USDM 要求仕様書', '');
  lines.push(`- システム名: ${data.system_name || ''}`);
  lines.push(`- イベントID: ${data.event_id || ''}`);
  lines.push(`- 作成日時: ${data.created_at || ''}`);
  lines.push(`- ソース: ${data.source || ''}`, '');

  const requirements = data.requirements || [];
  lines.push('| ID | 要求 | 仕様 | 理由（背景） | 説明 |');
  lines.push('|----|------|------|------------|------|');
  for (const req of requirements) {
    lines.push(`| ${escapeCell(req.id)} | ${escapeCell(req.requirement)} | | ${escapeCell(req.reason)} | |`);
    for (const spec of req.specifications || []) {
      const criteria = (spec.acceptance_criteria || []).map((c, i) => `${i + 1}. ${c}`).join('<br>');
      lines.push(`| ${escapeCell(spec.id)} | | ${escapeCell(spec.specification)} | | ${escapeCell(criteria)} |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  const inputPath = process.argv[2] || 'docs/requirements/requirements.yaml';
  const resolvedInput = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`Error: File not found: ${resolvedInput}`);
    process.exit(1);
  }
  const outputPath = process.argv[3] ? path.resolve(process.argv[3]) : path.join(path.dirname(resolvedInput), 'requirements.md');
  const data = parseYaml(fs.readFileSync(resolvedInput, 'utf8'));
  fs.writeFileSync(outputPath, generateMarkdown(data), 'utf8');
  const reqCount = (data.requirements || []).length;
  const specCount = (data.requirements || []).reduce((s, r) => s + ((r.specifications || []).length), 0);
  console.log(`Generated: ${outputPath}`);
  console.log(`  Requirements: ${reqCount}, Specifications: ${specCount}`);
}

if (require.main === module) main();

module.exports = { generateMarkdown };
