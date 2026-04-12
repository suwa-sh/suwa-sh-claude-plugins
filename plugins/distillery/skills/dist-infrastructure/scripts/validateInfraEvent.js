#!/usr/bin/env node
/**
 * infra-event.yaml バリデータ
 *
 * Usage:
 *   node validateInfraEvent.js <path-to-infra-event.yaml>
 *   node validateInfraEvent.js docs/infra/events/20260328_100000_infra_product_design/infra-event.yaml
 *
 * 終了コード:
 *   0 = 全チェック PASS
 *   1 = バリデーションエラーあり
 *   2 = ファイル読み込みエラー
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
      // 配列要素は parseArray で処理
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
// バリデーション
// ---------------------------------------------------------------------------

const VALID_WORKLOAD_TYPES = ['web_app', 'api', 'batch', 'event_driven'];
const VALID_AVAILABILITY_TIERS = ['99%', '99.9%', '99.95%', '99.99%'];
const VALID_COST_POSTURES = ['cost_optimized', 'balanced', 'performance_optimized'];
const VALID_TARGET_CLOUDS = ['aws', 'azure', 'gcp'];
const VALID_FEEDBACK_ACTIONS = ['add', 'upgrade'];
const VALID_MCL_STATUSES = ['completed', 'partial', 'failed'];
const EVENT_ID_PATTERN = /^\d{8}_\d{6}_infra_product_design$/;

function validateInfraEvent(data) {
  const errors = [];
  const warnings = [];
  let stats = {
    outputFiles: 0,
    feedbackItems: 0,
  };

  // --- Top-level required fields ---
  const requiredTopLevel = [
    'version', 'event_id', 'created_at', 'source',
    'arch_event_ref', 'nfr_event_ref',
    'foundation_context_ref', 'shared_platform_context_ref'
  ];
  for (const field of requiredTopLevel) {
    if (!(field in data) || data[field] === null || data[field] === undefined) {
      errors.push({ path: `$.${field}`, message: `Missing required top-level field: ${field}` });
    }
  }

  // --- version ---
  if (data.version !== undefined && data.version !== null) {
    const ver = String(data.version);
    if (ver !== '1.0') {
      errors.push({ path: '$.version', message: `version must be "1.0", got "${ver}"` });
    }
  }

  // --- event_id pattern ---
  if (data.event_id !== undefined && data.event_id !== null) {
    const eid = String(data.event_id);
    if (!EVENT_ID_PATTERN.test(eid)) {
      errors.push({ path: '$.event_id', message: `event_id "${eid}" does not match pattern YYYYMMDD_HHMMSS_infra_product_design` });
    }
  }

  // --- translation section ---
  if (!data.translation || typeof data.translation !== 'object') {
    errors.push({ path: '$.translation', message: 'Missing required section: translation' });
  } else {
    const t = data.translation;
    const requiredTranslation = [
      'workload_type', 'availability_tier', 'latency_target_p99',
      'data_classification', 'traffic_pattern_type', 'consistency_model',
      'cost_posture', 'target_clouds'
    ];
    for (const field of requiredTranslation) {
      if (!(field in t) || t[field] === null || t[field] === undefined) {
        errors.push({ path: `$.translation.${field}`, message: `Missing required field: ${field}` });
      }
    }

    // workload_type enum
    if (t.workload_type !== undefined && t.workload_type !== null) {
      if (!VALID_WORKLOAD_TYPES.includes(t.workload_type)) {
        errors.push({ path: '$.translation.workload_type', message: `Value "${t.workload_type}" not in enum [${VALID_WORKLOAD_TYPES.join(', ')}]` });
      }
    }

    // availability_tier enum
    if (t.availability_tier !== undefined && t.availability_tier !== null) {
      const avail = String(t.availability_tier);
      if (!VALID_AVAILABILITY_TIERS.includes(avail)) {
        errors.push({ path: '$.translation.availability_tier', message: `Value "${avail}" not in enum [${VALID_AVAILABILITY_TIERS.join(', ')}]` });
      }
    }

    // cost_posture enum
    if (t.cost_posture !== undefined && t.cost_posture !== null) {
      if (!VALID_COST_POSTURES.includes(t.cost_posture)) {
        errors.push({ path: '$.translation.cost_posture', message: `Value "${t.cost_posture}" not in enum [${VALID_COST_POSTURES.join(', ')}]` });
      }
    }

    // target_clouds should be array
    if (t.target_clouds !== undefined && t.target_clouds !== null) {
      if (!Array.isArray(t.target_clouds)) {
        errors.push({ path: '$.translation.target_clouds', message: 'target_clouds must be an array' });
      } else if (t.target_clouds.length === 0) {
        errors.push({ path: '$.translation.target_clouds', message: 'target_clouds must not be empty' });
      } else {
        for (let i = 0; i < t.target_clouds.length; i++) {
          if (!VALID_TARGET_CLOUDS.includes(t.target_clouds[i])) {
            errors.push({ path: `$.translation.target_clouds[${i}]`, message: `Value "${t.target_clouds[i]}" not in enum [${VALID_TARGET_CLOUDS.join(', ')}]` });
          }
        }
      }
    }
  }

  // --- mcl_execution section ---
  if (!data.mcl_execution || typeof data.mcl_execution !== 'object') {
    errors.push({ path: '$.mcl_execution', message: 'Missing required section: mcl_execution' });
  } else {
    const m = data.mcl_execution;

    // status
    if (!(('status') in m) || m.status === null || m.status === undefined) {
      errors.push({ path: '$.mcl_execution.status', message: 'Missing required field: status' });
    } else if (!VALID_MCL_STATUSES.includes(m.status)) {
      errors.push({ path: '$.mcl_execution.status', message: `Value "${m.status}" not in enum [${VALID_MCL_STATUSES.join(', ')}]` });
    }

    // outputs
    if (!('outputs' in m) || m.outputs === null || m.outputs === undefined) {
      errors.push({ path: '$.mcl_execution.outputs', message: 'Missing required field: outputs' });
    } else if (!Array.isArray(m.outputs)) {
      errors.push({ path: '$.mcl_execution.outputs', message: 'outputs must be an array' });
    } else {
      stats.outputFiles = m.outputs.length;
      for (let i = 0; i < m.outputs.length; i++) {
        const output = m.outputs[i];
        if (typeof output === 'object' && output !== null) {
          if (!output.path) {
            errors.push({ path: `$.mcl_execution.outputs[${i}].path`, message: 'Missing required field: path' });
          }
          if (!output.status) {
            errors.push({ path: `$.mcl_execution.outputs[${i}].status`, message: 'Missing required field: status' });
          }
        }
      }
    }
  }

  // --- arch_feedback section (optional: null | object) ---
  if (data.arch_feedback === null || data.arch_feedback === undefined) {
    // null = 未実行（Step3 完了前）→ PASS
  } else if (typeof data.arch_feedback === 'object') {
    const fb = data.arch_feedback;
    const fbKeys = Object.keys(fb);

    if (fbKeys.length === 0) {
      // {} = 旧形式 → WARNING
      warnings.push({ path: '$.arch_feedback', message: 'Empty object is deprecated. Use null to indicate Step3 not yet executed.' });
    } else {
      // feedback_items の検証
      if ('feedback_items' in fb) {
        if (!Array.isArray(fb.feedback_items)) {
          errors.push({ path: '$.arch_feedback.feedback_items', message: 'feedback_items must be an array' });
        } else {
          stats.feedbackItems = fb.feedback_items.length;
          for (let i = 0; i < fb.feedback_items.length; i++) {
            const item = fb.feedback_items[i];
            if (typeof item === 'object' && item !== null) {
              if (!item.target) {
                errors.push({ path: `$.arch_feedback.feedback_items[${i}].target`, message: 'Missing required field: target' });
              }
              if (!item.action) {
                errors.push({ path: `$.arch_feedback.feedback_items[${i}].action`, message: 'Missing required field: action' });
              } else if (!VALID_FEEDBACK_ACTIONS.includes(item.action)) {
                errors.push({ path: `$.arch_feedback.feedback_items[${i}].action`, message: `Value "${item.action}" not in enum [${VALID_FEEDBACK_ACTIONS.join(', ')}]` });
              }
            }
          }
        }
      }
    }
  }

  return { errors, warnings, stats };
}

// ---------------------------------------------------------------------------
// 必須出力ファイルチェック
// ---------------------------------------------------------------------------

/**
 * MCL 実行完了時に event ディレクトリ内の必須出力ファイルを検証する。
 * 存在しないファイルがあれば WARNING メッセージを返す（PASS/FAIL は変えない）。
 *
 * @param {string} eventDir - イベントディレクトリの絶対パス
 * @returns {string[]} 警告メッセージの配列
 */
function checkRequiredOutputFiles(eventDir) {
  const warnings = [];

  // 固定パスの必須ファイル
  const exactFiles = [
    { path: 'specs/product/input/product-input.yaml', label: 'MCL 入力（product-input.yaml）' },
    { path: 'specs/product/output/product-workload-model.yaml', label: 'ワークロードモデル（product-workload-model.yaml）' },
    { path: 'specs/product/output/product-observability.yaml', label: 'オブザーバビリティ（product-observability.yaml）' },
    { path: 'specs/product/output/product-cost-hints.yaml', label: 'コストヒント（product-cost-hints.yaml）' },
  ];

  for (const file of exactFiles) {
    const fullPath = path.join(eventDir, file.path);
    if (!fs.existsSync(fullPath)) {
      warnings.push(`必須出力ファイルが見つかりません: ${file.path} (${file.label})`);
    }
  }

  // glob パターンの必須ファイル（最低1ファイル）
  const globPatterns = [
    { prefix: 'product-mapping-', dir: 'specs/product/output', label: 'ベンダーマッピング（product-mapping-*.yaml）' },
    { prefix: 'product-impl-', dir: 'specs/product/output', label: '実装仕様（product-impl-*.yaml）' },
  ];

  for (const pat of globPatterns) {
    const dirPath = path.join(eventDir, pat.dir);
    let found = false;
    if (fs.existsSync(dirPath)) {
      try {
        const entries = fs.readdirSync(dirPath);
        found = entries.some(e => e.startsWith(pat.prefix) && e.endsWith('.yaml'));
      } catch (_) {
        // ディレクトリ読み込みエラーは無視
      }
    }
    if (!found) {
      warnings.push(`必須出力ファイルが見つかりません: ${pat.dir}/${pat.prefix}*.yaml (${pat.label}、最低1ファイル)`);
    }
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node validateInfraEvent.js <path-to-infra-event.yaml>');
    process.exit(2);
  }

  const yamlPath = path.resolve(args[0]);
  if (!fs.existsSync(yamlPath)) {
    console.error(`File not found: ${yamlPath}`);
    process.exit(2);
  }

  // YAML 読み込み・パース
  const yamlText = fs.readFileSync(yamlPath, 'utf8');
  let data;
  try {
    data = parseYaml(yamlText);
  } catch (e) {
    console.error(`YAML parse error: ${e.message}`);
    process.exit(2);
  }

  // バリデーション
  const { errors, warnings: validationWarnings, stats } = validateInfraEvent(data);

  // 必須出力ファイルチェック（mcl_execution.status === "completed" の場合のみ）
  const warnings = [...validationWarnings];
  if (data.mcl_execution && data.mcl_execution.status === 'completed') {
    const eventDir = path.dirname(yamlPath);
    const requiredFiles = checkRequiredOutputFiles(eventDir);
    for (const w of requiredFiles) {
      warnings.push({ path: '$.mcl_execution', message: w });
    }
  }

  if (errors.length === 0) {
    console.log(`PASS: ${yamlPath}`);
    console.log(`  Output files: ${stats.outputFiles}`);
    console.log(`  Feedback items: ${stats.feedbackItems}`);
    if (warnings.length > 0) {
      console.log(`  ${warnings.length} warning(s):`);
      for (const w of warnings) {
        console.log(`  - WARNING: ${w.path}: ${w.message}`);
      }
    }
    process.exit(0);
  } else {
    console.log(`FAIL: ${yamlPath}`);
    console.log(`  ${errors.length} error(s):`);
    for (const e of errors) {
      console.log(`  - ${e.path}: ${e.message}`);
    }
    if (warnings.length > 0) {
      console.log(`  ${warnings.length} warning(s):`);
      for (const w of warnings) {
        console.log(`  - WARNING: ${w.path}: ${w.message}`);
      }
    }
    if (args.includes('--json')) {
      console.log(JSON.stringify({ status: 'fail', errors, warnings, file: yamlPath }, null, 2));
    }
    process.exit(1);
  }
}

main();
