#!/usr/bin/env node
/**
 * generateInfraEventMd.js
 *
 * infra-event.yaml をインフラ設計イベント Markdown に変換する。
 *
 * Usage:
 *   node generateInfraEventMd.js <path-to-infra-event.yaml>
 *
 *   入力と同じディレクトリに infra-event.md を生成（.yaml → .md）。
 *
 * npm 依存なし。Node.js 18+ 標準モジュールのみ使用。
 */
'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// 簡易 YAML パーサー（infra-event.yaml のサブセットのみ対応）
// ---------------------------------------------------------------------------

function parseYaml(text) {
  const lines = text.split('\n');
  return parseNode(lines, 0, -1).value;
}

function parseNode(lines, startIdx, parentIndent) {
  let i = startIdx;
  const result = {};

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.replace(/\s+$/, '');

    if (trimmed === '' || trimmed.trimStart().startsWith('#')) { i++; continue; }

    const indent = line.search(/\S/);
    if (indent <= parentIndent) break;

    const content = trimmed.trimStart();

    if (content.startsWith('- ')) {
      break;
    }

    if (content.includes(':')) {
      const colonIdx = content.indexOf(':');
      const key = content.slice(0, colonIdx).trim();
      const rawValue = content.slice(colonIdx + 1).trim();

      if (rawValue === '' || rawValue === '>' || rawValue === '|') {
        const nextLineIdx = findNextNonEmpty(lines, i + 1);
        if (nextLineIdx < lines.length) {
          const nextIndent = lines[nextLineIdx].search(/\S/);
          if (nextIndent > indent) {
            const nextContent = lines[nextLineIdx].trimStart();
            if (nextContent.startsWith('- ')) {
              const arr = parseArray(lines, nextLineIdx, indent);
              result[key] = arr.value;
              i = arr.nextIdx;
              continue;
            } else if (rawValue === '>' || rawValue === '|') {
              const scalar = parseFoldedScalar(lines, i + 1, indent);
              result[key] = scalar.value;
              i = scalar.nextIdx;
              continue;
            } else {
              const child = parseNode(lines, i + 1, indent);
              result[key] = child.value;
              i = child.nextIdx;
              continue;
            }
          }
        }
        result[key] = null;
        i++;
        continue;
      }

      result[key] = parseValue(rawValue);
      i++;
      continue;
    }

    i++;
  }

  return { value: result, nextIdx: i };
}

function parseArray(lines, startIdx, parentIndent) {
  let i = startIdx;
  const arr = [];

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.replace(/\s+$/, '');
    if (trimmed === '' || trimmed.trimStart().startsWith('#')) { i++; continue; }

    const indent = line.search(/\S/);
    if (indent <= parentIndent) break;

    const content = trimmed.trimStart();
    if (!content.startsWith('- ')) break;

    const itemContent = content.slice(2).trim();
    const itemIndent = indent;

    if (itemContent.includes(':') && !isQuotedString(itemContent)) {
      const obj = {};
      const colonIdx = itemContent.indexOf(':');
      const k = itemContent.slice(0, colonIdx).trim();
      const v = itemContent.slice(colonIdx + 1).trim();

      if (v === '' || v === '>' || v === '|') {
        const nextLineIdx = findNextNonEmpty(lines, i + 1);
        if (nextLineIdx < lines.length) {
          const nextIndent = lines[nextLineIdx].search(/\S/);
          if (nextIndent > itemIndent) {
            const nextContent = lines[nextLineIdx].trimStart();
            if (nextContent.startsWith('- ')) {
              const sub = parseArray(lines, nextLineIdx, itemIndent);
              obj[k] = sub.value;
              const child = parseNode(lines, sub.nextIdx, itemIndent);
              Object.assign(obj, child.value);
            } else {
              const child = parseNode(lines, i + 1, itemIndent);
              obj[k] = child.value[k] || null;
              delete child.value[k];
              Object.assign(obj, child.value);
            }
            arr.push(obj);
            i = findNextAtOrAbove(lines, i + 1, itemIndent);
            continue;
          }
        }
        obj[k] = null;
      } else {
        obj[k] = parseValue(v);
      }

      const nextLineIdx2 = findNextNonEmpty(lines, i + 1);
      if (nextLineIdx2 < lines.length) {
        const nextIndent2 = lines[nextLineIdx2].search(/\S/);
        const nextContent2 = lines[nextLineIdx2].trimStart();
        if (nextIndent2 > itemIndent && !nextContent2.startsWith('- ')) {
          const child = parseNode(lines, i + 1, itemIndent);
          Object.assign(obj, child.value);
          arr.push(obj);
          i = child.nextIdx;
          continue;
        }
      }

      arr.push(obj);
      i++;
      continue;
    }

    arr.push(parseValue(itemContent));
    i++;
  }

  return { value: arr, nextIdx: i };
}

function parseFoldedScalar(lines, startIdx, parentIndent) {
  let i = startIdx;
  const parts = [];

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.replace(/\s+$/, '');
    if (trimmed === '') { parts.push(''); i++; continue; }
    const indent = line.search(/\S/);
    if (indent <= parentIndent) break;
    parts.push(trimmed.trim());
    i++;
  }

  return { value: parts.join('\n').trim(), nextIdx: i };
}

function parseValue(str) {
  if (str === '' || str === 'null' || str === '~') return null;
  if (str === '[]') return [];
  if (str === 'true') return true;
  if (str === 'false') return false;
  if (/^-?[0-9]+$/.test(str)) return parseInt(str, 10);
  if (/^-?[0-9]*\.[0-9]+$/.test(str)) return parseFloat(str);
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  return str;
}

function isQuotedString(s) {
  return (s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"));
}

function findNextNonEmpty(lines, startIdx) {
  let i = startIdx;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t !== '' && !t.startsWith('#')) return i;
    i++;
  }
  return i;
}

function findNextAtOrAbove(lines, startIdx, maxIndent) {
  let i = startIdx;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t === '' || t.startsWith('#')) { i++; continue; }
    const indent = lines[i].search(/\S/);
    if (indent <= maxIndent) return i;
    i++;
  }
  return i;
}

// ---------------------------------------------------------------------------
// Markdown 生成ヘルパー
// ---------------------------------------------------------------------------

function esc(text) {
  if (text === null || text === undefined) return '-';
  return String(text).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

// ---------------------------------------------------------------------------
// Markdown 生成
// ---------------------------------------------------------------------------

function generateMarkdown(data) {
  const lines = [];
  const translation = data.translation || {};
  const mcl = data.mcl_execution || {};
  const feedback = data.arch_feedback || null;

  // ヘッダー
  lines.push('# インフラ設計イベント');
  lines.push('');

  // 概要テーブル
  lines.push('| 項目 | 値 |');
  lines.push('|------|-----|');
  lines.push(`| イベント ID | ${esc(data.event_id)} |`);
  lines.push(`| 作成日時 | ${esc(data.created_at)} |`);
  lines.push(`| ソース | ${esc(data.source)} |`);
  lines.push(`| Arch 参照 | ${esc(data.arch_event_ref)} |`);
  lines.push(`| NFR 参照 | ${esc(data.nfr_event_ref)} |`);
  lines.push('');

  // 変換サマリ
  lines.push('## 変換サマリ');
  lines.push('');
  lines.push('| 特性 | 値 |');
  lines.push('|------|-----|');
  lines.push(`| ワークロードタイプ | ${esc(translation.workload_type)} |`);
  lines.push(`| 可用性 | ${esc(translation.availability_tier)} |`);
  lines.push(`| レイテンシ p99 | ${esc(translation.latency_target_p99)} |`);
  lines.push(`| データ分類 | ${esc(translation.data_classification)} |`);
  lines.push(`| トラフィック | ${esc(translation.traffic_pattern_type)} |`);
  lines.push(`| 整合性 | ${esc(translation.consistency_model)} |`);
  lines.push(`| コスト方針 | ${esc(translation.cost_posture)} |`);

  const clouds = Array.isArray(translation.target_clouds)
    ? translation.target_clouds.join(', ')
    : esc(translation.target_clouds);
  lines.push(`| 対象クラウド | ${clouds} |`);
  lines.push('');

  // MCL 実行結果
  lines.push('## MCL 実行結果');
  lines.push('');
  lines.push(`| ステータス | ${esc(mcl.status)} |`);
  lines.push('');

  // 出力ファイル
  const outputs = mcl.outputs || [];
  if (outputs.length > 0) {
    lines.push('### 出力ファイル');
    lines.push('');
    lines.push('| パス | ステータス |');
    lines.push('|------|-----------|');
    for (const output of outputs) {
      if (typeof output === 'object' && output !== null) {
        lines.push(`| ${esc(output.path)} | ${esc(output.status)} |`);
      }
    }
    lines.push('');
  }

  // Arch フィードバック（存在する場合のみ）
  if (feedback && typeof feedback === 'object') {
    lines.push('## Arch フィードバック');
    lines.push('');

    const items = feedback.feedback_items || [];
    if (items.length > 0) {
      lines.push('### フィードバック項目');
      lines.push('');
      lines.push('| ターゲット | アクション | 説明 |');
      lines.push('|-----------|-----------|------|');
      for (const item of items) {
        if (typeof item === 'object' && item !== null) {
          lines.push(`| ${esc(item.target)} | ${esc(item.action)} | ${esc(item.description)} |`);
        }
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node generateInfraEventMd.js <path-to-infra-event.yaml>');
    process.exit(1);
  }

  const resolvedInput = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`Error: File not found: ${resolvedInput}`);
    process.exit(1);
  }

  // 出力先: 入力ファイルと同じディレクトリに .yaml → .md
  const outputPath = resolvedInput.replace(/\.yaml$/, '.md');

  const yamlText = fs.readFileSync(resolvedInput, 'utf8');
  let data;
  try {
    data = parseYaml(yamlText);
  } catch (e) {
    console.error(`YAML parse error: ${e.message}`);
    process.exit(1);
  }

  const markdown = generateMarkdown(data);
  fs.writeFileSync(outputPath, markdown, 'utf-8');

  const outputCount = ((data.mcl_execution || {}).outputs || []).length;
  const feedbackCount = ((data.arch_feedback || {}).feedback_items || []).length;
  console.log(`Generated: ${outputPath}`);
  console.log(`  Output files: ${outputCount}, Feedback items: ${feedbackCount}`);
}

main();
