#!/usr/bin/env node
/**
 * API Summary バリデータ
 *
 * Usage:
 *   node validateApiSummary.js <path-to-uc-dir>
 *   node validateApiSummary.js docs/specs/latest/業務名/BUC名/UC名
 *   node validateApiSummary.js docs/specs/latest/業務名/BUC名/UC名 --json
 *
 * 検証内容:
 *   1. _api-summary.yaml の存在
 *   2. YAML パースが成功すること
 *   3. JSON Schema バリデーション（uc, business, buc 必須）
 *   4. paths が存在する場合、各 path の method/path/summary があること
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
// メイン
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const jsonFlag = args.includes('--json');
  const nonFlagArgs = args.filter(a => !a.startsWith('--'));

  if (nonFlagArgs.length === 0) {
    console.error('Usage: node validateApiSummary.js <path-to-uc-dir> [--json]');
    process.exit(2);
  }

  const ucDir = path.resolve(nonFlagArgs[0]);
  if (!fs.existsSync(ucDir)) {
    console.error(`Directory not found: ${ucDir}`);
    process.exit(2);
  }

  const allErrors = [];
  const allWarnings = [];

  // --- _api-summary.yaml バリデーション ---
  const yamlPath = path.join(ucDir, '_api-summary.yaml');
  if (!fs.existsSync(yamlPath)) {
    allErrors.push('_api-summary.yaml が存在しません');
  } else {
    const yamlText = fs.readFileSync(yamlPath, 'utf8');
    let data;
    try {
      data = parseYaml(yamlText);
    } catch (e) {
      allErrors.push(`_api-summary.yaml YAML parse error: ${e.message}`);
    }

    if (data) {
      const schemaPath = path.join(__dirname, 'schema-api-summary.json');
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      const schemaErrors = validate(data, schema, schema.$defs || {}, '$');
      allErrors.push(...schemaErrors.map(e => `_api-summary.yaml ${e.path}: ${e.message}`));

      // 追加チェック: paths が存在する場合、各 path の method/path/summary があること
      if (data.paths && Array.isArray(data.paths)) {
        for (let i = 0; i < data.paths.length; i++) {
          const p = data.paths[i];
          if (!p.method) allErrors.push(`_api-summary.yaml paths[${i}]: method がありません`);
          if (!p.path) allErrors.push(`_api-summary.yaml paths[${i}]: path がありません`);
          if (!p.summary) allErrors.push(`_api-summary.yaml paths[${i}]: summary がありません`);
        }
      }
    }
  }

  // --- 結果出力 ---
  if (jsonFlag) {
    const result = {
      status: allErrors.length === 0 ? 'pass' : 'fail',
      dir: ucDir,
      errors: allErrors,
      warnings: allWarnings
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(allErrors.length === 0 ? 0 : 1);
  }

  if (allErrors.length === 0) {
    console.log(`PASS${allWarnings.length > 0 ? ' (with warnings)' : ''}: ${ucDir}/_api-summary.yaml`);
    if (allWarnings.length > 0) {
      for (const w of allWarnings) {
        console.log(`  WARN: ${w}`);
      }
    }
  } else {
    console.log(`FAIL: ${ucDir}/_api-summary.yaml`);
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
