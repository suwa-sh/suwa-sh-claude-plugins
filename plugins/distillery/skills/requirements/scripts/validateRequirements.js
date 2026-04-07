#!/usr/bin/env node
/**
 * requirements.yaml バリデータ
 *
 * Usage:
 *   node validateRequirements.js <path-to-requirements.yaml>
 *   node validateRequirements.js docs/usdm/events/20260326_000000_add_ebook_lending/requirements.yaml
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
// 簡易 YAML パーサー（requirements.yaml のサブセットのみ対応）
// ---------------------------------------------------------------------------

function parseYaml(text) {
  const lines = text.split('\n');
  return parseNode(lines, 0, -1).value;
}

function parseNode(lines, startIdx, parentIndent) {
  let i = startIdx;
  const result = {};
  let currentKey = null;
  let currentArray = null;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.replace(/\s+$/, '');

    // 空行・コメント行
    if (trimmed === '' || trimmed.trimStart().startsWith('#')) { i++; continue; }

    const indent = line.search(/\S/);
    if (indent <= parentIndent) break;

    const content = trimmed.trimStart();

    // 配列要素
    if (content.startsWith('- ')) {
      if (!currentArray) currentArray = [];
      const itemContent = content.slice(2).trim();

      // "- key: value" 形式（オブジェクト配列の開始）
      if (itemContent.includes(':') && !itemContent.startsWith('"') && !itemContent.startsWith("'")) {
        const colonIdx = itemContent.indexOf(':');
        const k = itemContent.slice(0, colonIdx).trim();
        const v = itemContent.slice(colonIdx + 1).trim();

        // この配列要素がオブジェクトかを判断
        const nextLineIdx = findNextNonEmpty(lines, i + 1);
        if (nextLineIdx < lines.length) {
          const nextIndent = lines[nextLineIdx].search(/\S/);
          const nextContent = lines[nextLineIdx].trimStart();
          if (nextIndent > indent && !nextContent.startsWith('- ')) {
            // 子プロパティがある → オブジェクト
            const obj = {};
            obj[k] = parseValue(v);
            const child = parseNode(lines, i + 1, indent);
            Object.assign(obj, child.value);
            currentArray.push(obj);
            i = child.nextIdx;
            continue;
          }
        }
        // 単一行オブジェクト
        const obj = {};
        obj[k] = parseValue(v);
        currentArray.push(obj);
        i++;
        continue;
      }

      // "- value" 形式（スカラー配列）
      currentArray.push(parseValue(itemContent));
      i++;
      continue;
    }

    // キー: 値
    if (content.includes(':')) {
      const colonIdx = content.indexOf(':');
      const key = content.slice(0, colonIdx).trim();
      const rawValue = content.slice(colonIdx + 1).trim();

      // 値が空 → 子ノード（オブジェクトまたは配列）
      if (rawValue === '' || rawValue === '>') {
        if (currentArray && currentKey) {
          // 前の配列を保存
        }
        currentKey = key;
        currentArray = null;

        const nextLineIdx = findNextNonEmpty(lines, i + 1);
        if (nextLineIdx < lines.length) {
          const nextContent = lines[nextLineIdx].trimStart();
          const nextIndent = lines[nextLineIdx].search(/\S/);

          if (nextIndent > indent) {
            if (nextContent.startsWith('- ')) {
              // 配列
              const arr = parseArray(lines, nextLineIdx, indent);
              result[key] = arr.value;
              i = arr.nextIdx;
              continue;
            } else if (rawValue === '>') {
              // 折りたたみスカラー
              const scalar = parseFoldedScalar(lines, i + 1, indent);
              result[key] = scalar.value;
              i = scalar.nextIdx;
              continue;
            } else {
              // ネストオブジェクト
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

    // "- key: value" → オブジェクト要素
    if (itemContent.includes(':') && !isQuotedString(itemContent)) {
      const obj = {};
      const colonIdx = itemContent.indexOf(':');
      const k = itemContent.slice(0, colonIdx).trim();
      const v = itemContent.slice(colonIdx + 1).trim();

      if (v === '' || v === '>') {
        // 子ノードを持つ
        const nextLineIdx = findNextNonEmpty(lines, i + 1);
        if (nextLineIdx < lines.length) {
          const nextIndent = lines[nextLineIdx].search(/\S/);
          if (nextIndent > itemIndent) {
            if (v === '>') {
              const scalar = parseFoldedScalar(lines, i + 1, itemIndent);
              obj[k] = scalar.value;
              // 残りのプロパティ
              const child = parseNode(lines, scalar.nextIdx, itemIndent);
              Object.assign(obj, child.value);
              arr.push(obj);
              i = child.nextIdx;
              continue;
            }
            const nextContent = lines[nextLineIdx].trimStart();
            if (nextContent.startsWith('- ')) {
              const sub = parseArray(lines, nextLineIdx, itemIndent);
              obj[k] = sub.value;
              const child = parseNode(lines, sub.nextIdx, itemIndent);
              Object.assign(obj, child.value);
            } else {
              const child = parseNode(lines, i + 1, itemIndent);
              obj[k] = parseValue(v) || child.value[k];
              delete child.value[k];
              Object.assign(obj, child.value);
              arr.push(obj);
              i = child.nextIdx;
              continue;
            }
            arr.push(obj);
            i = Object.keys(obj).length > 1 ? findNextAtOrAbove(lines, i + 1, itemIndent) : i + 1;
            continue;
          }
        }
        obj[k] = null;
      } else {
        obj[k] = parseValue(v);
      }

      // 追加プロパティのチェック
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

    // スカラー要素
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

  return { value: parts.join(' ').trim(), nextIdx: i };
}

function parseValue(str) {
  if (str === '' || str === 'null' || str === '~') return null;
  if (str === 'true') return true;
  if (str === 'false') return false;
  if (/^-?[0-9]+$/.test(str)) return parseInt(str, 10);
  if (/^-?[0-9]*\.[0-9]+$/.test(str)) return parseFloat(str);
  // クォート除去
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
// JSON Schema バリデータ（サブセット実装）
// ---------------------------------------------------------------------------

function validate(data, schema, defs, jsonPath) {
  const errors = [];

  if (schema.$ref) {
    const refPath = schema.$ref.replace('#/$defs/', '');
    schema = defs[refPath];
    if (!schema) { errors.push({ path: jsonPath, message: `Unknown $ref: ${refPath}` }); return errors; }
  }

  // type チェック
  if (schema.type) {
    const actualType = Array.isArray(data) ? 'array' : (data === null ? 'null' : typeof data);
    if (schema.type === 'integer') {
      if (typeof data !== 'number' || !Number.isInteger(data)) {
        errors.push({ path: jsonPath, message: `Expected integer, got ${actualType}` });
        return errors;
      }
    } else if (actualType !== schema.type) {
      errors.push({ path: jsonPath, message: `Expected ${schema.type}, got ${actualType} (value: ${JSON.stringify(data)?.slice(0, 60)})` });
      return errors;
    }
  }

  // enum チェック
  if (schema.enum && !schema.enum.includes(data)) {
    errors.push({ path: jsonPath, message: `Value "${data}" not in enum [${schema.enum.join(', ')}]` });
  }

  // pattern チェック
  if (schema.pattern && typeof data === 'string') {
    if (!new RegExp(schema.pattern).test(data)) {
      errors.push({ path: jsonPath, message: `Value "${data}" does not match pattern ${schema.pattern}` });
    }
  }

  // minLength チェック
  if (schema.minLength !== undefined && typeof data === 'string' && data.length < schema.minLength) {
    errors.push({ path: jsonPath, message: `String too short (${data.length} < ${schema.minLength})` });
  }

  // required チェック
  if (schema.required && typeof data === 'object' && !Array.isArray(data)) {
    for (const req of schema.required) {
      if (!(req in data)) {
        errors.push({ path: jsonPath, message: `Missing required property: ${req}` });
      }
    }
  }

  // properties チェック
  if (schema.properties && typeof data === 'object' && !Array.isArray(data)) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (key in data) {
        errors.push(...validate(data[key], propSchema, defs, `${jsonPath}.${key}`));
      }
    }
  }

  // array items チェック
  if (schema.items && Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push({ path: jsonPath, message: `Array too short (${data.length} < ${schema.minItems})` });
    }
    for (let idx = 0; idx < data.length; idx++) {
      errors.push(...validate(data[idx], schema.items, defs, `${jsonPath}[${idx}]`));
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node validateRequirements.js <path-to-requirements.yaml>');
    process.exit(2);
  }

  const yamlPath = path.resolve(args[0]);
  if (!fs.existsSync(yamlPath)) {
    console.error(`File not found: ${yamlPath}`);
    process.exit(2);
  }

  // スキーマ読み込み
  const schemaPath = path.join(__dirname, 'schema-requirements.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

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
  const errors = validate(data, schema, schema.$defs || {}, '$');

  // 結果出力
  if (errors.length === 0) {
    const reqCount = (data.requirements || []).length;
    const specCount = (data.requirements || []).reduce(
      (sum, r) => sum + (r.specifications || []).length, 0
    );
    const modelCount = (data.requirements || []).reduce(
      (sum, r) => sum + (r.specifications || []).reduce(
        (s2, sp) => s2 + (sp.affected_models || []).length, 0
      ), 0
    );
    console.log(`PASS: ${yamlPath}`);
    console.log(`  Requirements: ${reqCount}`);
    console.log(`  Specifications: ${specCount}`);
    console.log(`  Affected Models: ${modelCount}`);
    process.exit(0);
  } else {
    console.log(`FAIL: ${yamlPath}`);
    console.log(`  ${errors.length} error(s):`);
    for (const e of errors) {
      console.log(`  - ${e.path}: ${e.message}`);
    }

    // JSON 形式でも出力（CI 連携用）
    if (args.includes('--json')) {
      console.log(JSON.stringify({ status: 'fail', errors, file: yamlPath }, null, 2));
    }
    process.exit(1);
  }
}

main();
