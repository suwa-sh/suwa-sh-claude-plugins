#!/usr/bin/env node
/**
 * generateRequirementsMd.js
 *
 * USDM requirements.yaml を人間が読める Markdown 表形式に変換する。
 *
 * Usage:
 *   node generateRequirementsMd.js <input-yaml> [output-md]
 *
 *   input-yaml : requirements.yaml のパス
 *   output-md  : 出力先 .md のパス（省略時は入力と同じディレクトリに requirements.md を生成）
 *
 * 出力形式:
 *   - メタ情報テーブル（version, event_id, created_at, source）
 *   - 要求ごとのセクション（要求・理由・優先度）
 *   - 仕様テーブル（ID, 仕様, 受け入れ基準, 影響モデル）
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// 簡易 YAML パーサー（外部依存なし）
// ============================================================

function parseYaml(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  return parseObject(lines, 0, 0).value;
}

function parseObject(lines, index, indent) {
  const obj = {};
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === '' || line.trim().startsWith('#')) {
      index++;
      continue;
    }
    const currentIndent = line.search(/\S/);
    if (currentIndent < indent) break;
    if (currentIndent > indent && Object.keys(obj).length > 0) break;

    const match = line.match(/^(\s*)([^:\s][^:]*?)\s*:\s*(.*)/);
    if (!match) {
      index++;
      continue;
    }

    const key = match[2].replace(/^["']|["']$/g, '');
    const valueStr = match[3].trim();

    if (valueStr === '' || valueStr === '|' || valueStr === '>') {
      // Check if next line starts an array or nested object
      if (index + 1 < lines.length) {
        const nextLine = lines[index + 1];
        const nextTrim = nextLine.trim();
        const nextIndent = nextLine.search(/\S/);
        if (nextIndent > currentIndent && nextTrim.startsWith('- ')) {
          const result = parseArray(lines, index + 1, nextIndent);
          obj[key] = result.value;
          index = result.index;
          continue;
        } else if (nextIndent > currentIndent) {
          const result = parseObject(lines, index + 1, nextIndent);
          obj[key] = result.value;
          index = result.index;
          continue;
        }
      }
      obj[key] = '';
      index++;
    } else if (valueStr.startsWith('"') || valueStr.startsWith("'")) {
      obj[key] = valueStr.replace(/^["']|["']$/g, '');
      index++;
    } else {
      obj[key] = valueStr;
      index++;
    }
  }
  return { value: obj, index };
}

function parseArray(lines, index, indent) {
  const arr = [];
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === '' || line.trim().startsWith('#')) {
      index++;
      continue;
    }
    const currentIndent = line.search(/\S/);
    if (currentIndent < indent) break;

    const trimmed = line.trim();
    if (!trimmed.startsWith('- ')) {
      if (currentIndent <= indent) break;
      index++;
      continue;
    }

    const afterDash = trimmed.slice(2).trim();

    // Simple scalar value in array (e.g., - "some text")
    if (afterDash.startsWith('"') || afterDash.startsWith("'")) {
      arr.push(afterDash.replace(/^["']|["']$/g, ''));
      index++;
      continue;
    }

    // Check if it's a key-value starting on same line as dash
    const kvMatch = afterDash.match(/^([^:\s][^:]*?)\s*:\s*(.*)/);
    if (kvMatch) {
      // It's an object in the array
      // Reconstruct as object starting from this line
      const objIndent = currentIndent + 2;
      const tempLines = [' '.repeat(objIndent) + afterDash];

      // Collect subsequent indented lines
      let nextIdx = index + 1;
      while (nextIdx < lines.length) {
        const nextLine = lines[nextIdx];
        if (nextLine.trim() === '' || nextLine.trim().startsWith('#')) {
          tempLines.push(nextLine);
          nextIdx++;
          continue;
        }
        const nextInd = nextLine.search(/\S/);
        if (nextInd <= currentIndent) break;
        // Re-indent relative lines
        tempLines.push(nextLine);
        nextIdx++;
      }

      const result = parseObject(tempLines, 0, objIndent);
      arr.push(result.value);
      index = nextIdx;
      continue;
    }

    // Plain scalar
    if (afterDash !== '') {
      arr.push(afterDash.replace(/^["']|["']$/g, ''));
      index++;
      continue;
    }

    index++;
  }
  return { value: arr, index };
}

// ============================================================
// Markdown 生成
// ============================================================

function escapeCell(text) {
  if (!text) return '';
  return String(text).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}


function generateMarkdown(data) {
  const lines = [];

  lines.push('# USDM 要求仕様書');
  lines.push('');

  lines.push(`- システム名: ${data.system_name || ''}`);
  lines.push(`- イベントID: ${data.event_id || ''}`);
  lines.push(`- 作成日時: ${data.created_at || ''}`);
  lines.push(`- ソース: ${data.source || ''}`);
  lines.push('');

  const requirements = data.requirements || [];

  // USDM table
  lines.push('| ID | 要求 | 仕様 | 理由（背景） | 説明 |');
  lines.push('|----|------|------|------------|------|');

  for (const req of requirements) {
    // 要求行
    lines.push(`| ${escapeCell(req.id)} | ${escapeCell(req.requirement)} | | ${escapeCell(req.reason)} | |`);

    const specs = req.specifications || [];
    for (const spec of specs) {
      const criteria = (spec.acceptance_criteria || [])
        .map((c, i) => `${i + 1}. ${c}`)
        .join('<br>');

      // 仕様行
      lines.push(`| ${escapeCell(spec.id)} | | ${escapeCell(spec.specification)} | | ${escapeCell(criteria)} |`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

// ============================================================
// Main
// ============================================================

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node generateRequirementsMd.js <input-yaml> [output-md]');
    process.exit(1);
  }

  const resolvedInput = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`Error: File not found: ${resolvedInput}`);
    process.exit(1);
  }

  const outputPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(path.dirname(resolvedInput), 'requirements.md');

  const yamlText = fs.readFileSync(resolvedInput, 'utf-8');
  const data = parseYaml(yamlText);

  const markdown = generateMarkdown(data);
  fs.writeFileSync(outputPath, markdown, 'utf-8');

  const reqCount = (data.requirements || []).length;
  const specCount = (data.requirements || []).reduce((sum, r) => sum + ((r.specifications || []).length), 0);
  console.log(`Generated: ${outputPath}`);
  console.log(`  Requirements: ${reqCount}, Specifications: ${specCount}`);
}

main();
