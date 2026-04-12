#!/usr/bin/env node
/**
 * generateNfrGradeMd.js
 *
 * nfr-grade.yaml を IPA 非機能要求グレード活用シート形式の Markdown 表に変換する。
 *
 * Usage:
 *   node generateNfrGradeMd.js <input-yaml> [output-md]
 *
 *   input-yaml : nfr-grade.yaml のパス
 *   output-md  : 出力先 .md のパス（省略時は入力と同じディレクトリに nfr-grade.md を生成）
 *
 * 出力形式:
 *   - メタ情報（モデルシステム、作成日時等）
 *   - サマリ（カテゴリ別のグレード分布）
 *   - 6大項目ごとの非機能要求グレード表（活用シート形式）
 *
 * npm 依存なし。Node.js 18+ 標準モジュールのみ使用。
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
    } else if (valueStr === 'true') {
      obj[key] = true;
      index++;
    } else if (valueStr === 'false') {
      obj[key] = false;
      index++;
    } else if (valueStr === 'null' || valueStr === '~') {
      obj[key] = null;
      index++;
    } else if (/^-?[0-9]+$/.test(valueStr)) {
      obj[key] = parseInt(valueStr, 10);
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

    if (afterDash.startsWith('"') || afterDash.startsWith("'")) {
      arr.push(afterDash.replace(/^["']|["']$/g, ''));
      index++;
      continue;
    }

    const kvMatch = afterDash.match(/^([^:\s][^:]*?)\s*:\s*(.*)/);
    if (kvMatch) {
      const objIndent = currentIndent + 2;
      const tempLines = [' '.repeat(objIndent) + afterDash];

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
        tempLines.push(nextLine);
        nextIdx++;
      }

      const result = parseObject(tempLines, 0, objIndent);
      arr.push(result.value);
      index = nextIdx;
      continue;
    }

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
// 定数
// ============================================================

const MODEL_SYSTEM_LABELS = {
  model1: 'モデルシステム1（社会的影響がほとんど無い）',
  model2: 'モデルシステム2（社会的影響が限定される）',
  model3: 'モデルシステム3（社会的影響が極めて大きい）',
};

const CONFIDENCE_LABELS = {
  high: '高',
  medium: '中',
  low: '低',
  default: 'デフォルト',
  user: 'ユーザー指定',
};

const GRADE_BAR = ['_', '\u2581', '\u2582', '\u2583', '\u2585', '\u2588'];

// ============================================================
// Markdown 生成
// ============================================================

function esc(text) {
  if (text === null || text === undefined) return '-';
  return String(text).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function gradeLabel(grade) {
  const n = Number(grade);
  if (isNaN(n) || n < 0 || n > 5) return `Lv${grade}`;
  return `Lv${n}`;
}

function confidenceBadge(confidence) {
  return CONFIDENCE_LABELS[confidence] || confidence || '-';
}

function generateMarkdown(data) {
  const lines = [];
  const categories = data.categories || [];
  const ms = data.model_system || {};

  // ヘッダー
  lines.push('# 非機能要求グレード表');
  lines.push('');

  // メタ情報
  lines.push('## 概要');
  lines.push('');
  lines.push(`| 項目 | 内容 |`);
  lines.push(`|------|------|`);
  lines.push(`| イベントID | ${esc(data.event_id)} |`);
  lines.push(`| 作成日時 | ${esc(data.created_at)} |`);
  lines.push(`| モデルシステム | ${esc(MODEL_SYSTEM_LABELS[ms.type] || ms.type)} |`);
  lines.push(`| 選定根拠 | ${esc(ms.reason)} |`);
  lines.push('');

  // サマリ
  lines.push('## サマリ');
  lines.push('');
  lines.push('| カテゴリ | メトリクス数 | 重要項目 | 平均Lv | 確信度内訳（高/中/低/デフォルト/ユーザー） |');
  lines.push('|---------|:----------:|:-------:|:-----:|----------------------------------------|');

  let totalMetrics = 0;
  let totalImportant = 0;

  for (const cat of categories) {
    let metricCount = 0;
    let importantCount = 0;
    let gradeSum = 0;
    const confCounts = { high: 0, medium: 0, low: 0, default: 0, user: 0 };

    for (const sub of (cat.subcategories || [])) {
      for (const item of (sub.items || [])) {
        for (const m of (item.metrics || [])) {
          metricCount++;
          if (m.important) importantCount++;
          gradeSum += Number(m.grade) || 0;
          const c = m.confidence || 'default';
          if (c in confCounts) confCounts[c]++;
        }
      }
    }

    totalMetrics += metricCount;
    totalImportant += importantCount;
    const avg = metricCount > 0 ? (gradeSum / metricCount).toFixed(1) : '-';
    const confStr = `${confCounts.high}/${confCounts.medium}/${confCounts.low}/${confCounts.default}/${confCounts.user}`;

    lines.push(`| **${esc(cat.id)}. ${esc(cat.name)}** | ${metricCount} | ${importantCount} | ${avg} | ${confStr} |`);
  }

  lines.push(`| **合計** | **${totalMetrics}** | **${totalImportant}** | | |`);
  lines.push('');

  // カテゴリ別グレード表
  for (const cat of categories) {
    lines.push(`## ${esc(cat.id)}. ${esc(cat.name)}`);
    lines.push('');
    lines.push('| 中項目 | 小項目 | ★ | メトリクス | Lv | 内容 | 根拠 | 確信度 | RDRA要素 |');
    lines.push('|--------|--------|:-:|----------|:--:|------|------|:-----:|---------|');

    for (const sub of (cat.subcategories || [])) {
      let isFirstSub = true;

      for (const item of (sub.items || [])) {
        let isFirstItem = true;

        for (const m of (item.metrics || [])) {
          const subLabel = isFirstSub ? `**${esc(sub.id)}** ${esc(sub.name)}` : '';
          const itemLabel = isFirstItem ? `${esc(item.id)} ${esc(item.name)}` : '';
          const imp = m.important ? '\u2605' : '';
          const conf = confidenceBadge(m.confidence);
          const source = m.source_model ? esc(m.source_model) : '-';
          const gradeDesc = m.grade_description ? esc(m.grade_description) : '-';

          lines.push(
            `| ${subLabel} | ${itemLabel} | ${imp} | ${esc(m.id)} ${esc(m.name)} | **${gradeLabel(m.grade)}** | ${gradeDesc} | ${esc(m.reason)} | ${conf} | ${source} |`
          );

          isFirstSub = false;
          isFirstItem = false;
        }
      }
    }

    lines.push('');
  }

  // 凡例
  lines.push('## 凡例');
  lines.push('');
  lines.push('### レベル定義');
  lines.push('');
  lines.push('| Lv | 意味 |');
  lines.push('|:--:|------|');
  lines.push('| 0 | 規定なし・最低水準 |');
  lines.push('| 1 | 低水準 |');
  lines.push('| 2 | 標準水準 |');
  lines.push('| 3 | 高水準 |');
  lines.push('| 4 | 非常に高い水準 |');
  lines.push('| 5 | 最高水準 |');
  lines.push('');
  lines.push('### 確信度');
  lines.push('');
  lines.push('| 確信度 | 意味 |');
  lines.push('|:------:|------|');
  lines.push('| 高 | RDRA モデルから明確に推論 |');
  lines.push('| 中 | RDRA モデルから間接推論 |');
  lines.push('| 低 | 弱い根拠での推論 |');
  lines.push('| デフォルト | モデルシステムのデフォルト値 |');
  lines.push('| ユーザー指定 | 対話でユーザーが指定 |');
  lines.push('');
  lines.push('### 記号');
  lines.push('');
  lines.push('- ★: IPA 非機能要求グレードの重要項目');
  lines.push('');

  return lines.join('\n');
}

// ============================================================
// Main
// ============================================================

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node generateNfrGradeMd.js <input-yaml> [output-md]');
    process.exit(1);
  }

  const resolvedInput = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`Error: File not found: ${resolvedInput}`);
    process.exit(1);
  }

  const outputPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(path.dirname(resolvedInput), 'nfr-grade.md');

  const yamlText = fs.readFileSync(resolvedInput, 'utf-8');
  const data = parseYaml(yamlText);

  const markdown = generateMarkdown(data);
  fs.writeFileSync(outputPath, markdown, 'utf-8');

  const catCount = (data.categories || []).length;
  let metricCount = 0;
  for (const cat of (data.categories || [])) {
    for (const sub of (cat.subcategories || [])) {
      for (const item of (sub.items || [])) {
        metricCount += (item.metrics || []).length;
      }
    }
  }

  console.log(`Generated: ${outputPath}`);
  console.log(`  Model System: ${(data.model_system || {}).type || 'unknown'}`);
  console.log(`  Categories: ${catCount}, Metrics: ${metricCount}`);
}

main();
