#!/usr/bin/env node
/**
 * RDB Schema バリデータ
 *
 * Usage:
 *   node validateRdbSchema.js <path-to-rdb-schema.yaml>
 *   node validateRdbSchema.js docs/specs/latest/_cross-cutting/datastore/rdb-schema.yaml
 *   node validateRdbSchema.js docs/specs/latest/_cross-cutting/datastore/rdb-schema.yaml --json
 *
 * 検証内容:
 *   1. ファイルの存在と YAML パース
 *   2. JSON Schema バリデーション（version, datastore, tables 必須）
 *   3. 各テーブルに description があること（error）
 *   4. 各カラムに description があること（error）
 *   5. indexes の各要素に name があること（空文字禁止）
 *   6. テーブル名が snake_case であること（/^[a-z][a-z0-9_]*$/）
 *
 * 終了コード:
 *   0 = 全チェック PASS
 *   1 = バリデーションエラーあり
 *   2 = システムエラー
 *
 * npm 依存なし。Node.js 18+ 標準モジュールのみ使用。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { parseYaml } = require('./lib/yaml-parser');

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

  if (schema.enum && !schema.enum.includes(data)) {
    errors.push({ path: jsonPath, message: `Value "${data}" not in enum [${schema.enum.join(', ')}]` });
  }

  if (schema.pattern && typeof data === 'string') {
    if (!new RegExp(schema.pattern).test(data)) {
      errors.push({ path: jsonPath, message: `Value "${data}" does not match pattern ${schema.pattern}` });
    }
  }

  if (schema.minLength !== undefined && typeof data === 'string' && data.length < schema.minLength) {
    errors.push({ path: jsonPath, message: `String too short (${data.length} < ${schema.minLength})` });
  }

  if (schema.minimum !== undefined && typeof data === 'number' && data < schema.minimum) {
    errors.push({ path: jsonPath, message: `Number too small (${data} < ${schema.minimum})` });
  }

  if (schema.required && typeof data === 'object' && !Array.isArray(data)) {
    for (const req of schema.required) {
      if (!(req in data)) {
        errors.push({ path: jsonPath, message: `Missing required property: ${req}` });
      }
    }
  }

  if (schema.properties && typeof data === 'object' && !Array.isArray(data)) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (key in data) {
        errors.push(...validate(data[key], propSchema, defs, `${jsonPath}.${key}`));
      }
    }
  }

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
// 追加チェック
// ---------------------------------------------------------------------------

const SNAKE_CASE_RE = /^[a-z][a-z0-9_]*$/;

function validateRdbExtra(data) {
  const errors = [];

  if (!data.tables || !Array.isArray(data.tables)) return errors;

  for (let i = 0; i < data.tables.length; i++) {
    const table = data.tables[i];
    const label = `tables[${i}](${table.name || '?'})`;

    // テーブル名が snake_case であること
    if (table.name && !SNAKE_CASE_RE.test(table.name)) {
      errors.push(`${label}: テーブル名が snake_case ではありません: "${table.name}" (期待: /^[a-z][a-z0-9_]*$/)`);
    }

    // テーブルに description があること
    if (!table.description || (typeof table.description === 'string' && table.description.trim().length === 0)) {
      errors.push(`${label}: description がありません`);
    }

    // 各カラムに description があること
    if (table.columns && Array.isArray(table.columns)) {
      for (let j = 0; j < table.columns.length; j++) {
        const col = table.columns[j];
        if (!col.description || (typeof col.description === 'string' && col.description.trim().length === 0)) {
          errors.push(`${label}.columns[${j}](${col.name || '?'}): description がありません`);
        }
      }
    }

    // indexes の各要素に name があること（空文字禁止）
    if (table.indexes && Array.isArray(table.indexes)) {
      for (let j = 0; j < table.indexes.length; j++) {
        const idx = table.indexes[j];
        if (!idx.name || (typeof idx.name === 'string' && idx.name.trim().length === 0)) {
          errors.push(`${label}.indexes[${j}]: name がありません（空文字禁止）`);
        }
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const jsonFlag = args.includes('--json');
  const nonFlagArgs = args.filter(a => !a.startsWith('--'));

  if (nonFlagArgs.length === 0) {
    console.error('Usage: node validateRdbSchema.js <path-to-rdb-schema.yaml> [--json]');
    process.exit(2);
  }

  const filePath = path.resolve(nonFlagArgs[0]);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(2);
  }

  const allErrors = [];
  const allWarnings = [];

  // --- rdb-schema.yaml バリデーション ---
  const yamlText = fs.readFileSync(filePath, 'utf8');
  let data;
  try {
    data = parseYaml(yamlText);
  } catch (e) {
    allErrors.push(`YAML parse error: ${e.message}`);
  }

  if (data) {
    const schemaPath = path.join(__dirname, 'schema-rdb-schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    const schemaErrors = validate(data, schema, schema.$defs || {}, '$');
    allErrors.push(...schemaErrors.map(e => `${e.path}: ${e.message}`));

    // 追加チェック
    const extraErrors = validateRdbExtra(data);
    allErrors.push(...extraErrors);
  }

  // --- 結果出力 ---
  if (jsonFlag) {
    const result = {
      status: allErrors.length === 0 ? 'pass' : 'fail',
      file: filePath,
      errors: allErrors,
      warnings: allWarnings
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(allErrors.length === 0 ? 0 : 1);
  }

  if (allErrors.length === 0) {
    console.log(`PASS${allWarnings.length > 0 ? ' (with warnings)' : ''}: ${filePath}`);
    if (data && data.tables) {
      console.log(`  tables: ${data.tables.length}`);
      for (const t of data.tables) {
        const colCount = t.columns ? t.columns.length : 0;
        const idxCount = t.indexes ? t.indexes.length : 0;
        console.log(`  - ${t.name}: ${colCount} columns, ${idxCount} indexes`);
      }
    }
    if (allWarnings.length > 0) {
      for (const w of allWarnings) {
        console.log(`  WARN: ${w}`);
      }
    }
  } else {
    console.log(`FAIL: ${filePath}`);
    console.log(`  ${allErrors.length} error(s), ${allWarnings.length} warning(s):`);
    for (const e of allErrors) {
      console.log(`  ERROR: ${e}`);
    }
    for (const w of allWarnings) {
      console.log(`  WARN: ${w}`);
    }
  }

  process.exit(allErrors.length > 0 ? 1 : 0);
}

main();
