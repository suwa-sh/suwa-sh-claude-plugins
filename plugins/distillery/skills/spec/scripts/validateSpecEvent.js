#!/usr/bin/env node
/**
 * Spec イベントバリデータ
 *
 * Usage:
 *   node validateSpecEvent.js <path-to-spec-event-dir>
 *   node validateSpecEvent.js docs/specs/events/20260329_100000_spec_generation
 *   node validateSpecEvent.js docs/specs/events/20260329_100000_spec_generation --json
 *
 * 検証内容:
 *   1. spec-event.yaml の存在と JSON Schema バリデーション
 *   2. UC ディレクトリ構成（業務/BUC/UC の3階層）
 *   3. 各 UC の必須ファイル（spec.md, tier-*.md が1つ以上）
 *   4. spec.md の必須セクション（概要、関連RDRAモデル、E2E完了条件、ティア別仕様）
 *   5. BDD シナリオに Given/When/Then が含まれる
 *   6. _cross-cutting/ ディレクトリの必須ファイル（ux-design.md, ui-design.md, data-visualization.md, openapi.yaml）
 *   7. _cross-cutting/openapi.yaml の基本構文チェック
 *   8. _cross-cutting/asyncapi.yaml の基本構文チェック（存在する場合のみ）
 *   9. _cross-cutting/rdb-schema.yaml の基本構文チェック（存在する場合のみ）
 *  10. _cross-cutting/kvs-schema.yaml の基本構文チェック（存在する場合のみ）
 *  11. _cross-cutting/object-storage-schema.yaml の基本構文チェック（存在する場合のみ）
 *  12. 各 UC の _model-summary.yaml 存在チェック + models/tables フィールド検証
 *  13. ディレクトリ名にスラッシュが含まれない
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
// UC ディレクトリ検証
// ---------------------------------------------------------------------------

function findUcDirs(baseDir) {
  const ucDirs = [];
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('_')) continue; // _cross-cutting 等をスキップ

    // 業務ディレクトリ
    const bizDir = path.join(baseDir, entry.name);
    const bizEntries = fs.readdirSync(bizDir, { withFileTypes: true });

    for (const bucEntry of bizEntries) {
      if (!bucEntry.isDirectory()) continue;

      // BUC ディレクトリ
      const bucDir = path.join(bizDir, bucEntry.name);
      const bucContents = fs.readdirSync(bucDir, { withFileTypes: true });

      for (const ucEntry of bucContents) {
        if (!ucEntry.isDirectory()) continue;

        // UC ディレクトリ
        ucDirs.push({
          business: entry.name,
          buc: bucEntry.name,
          uc: ucEntry.name,
          path: path.join(bucDir, ucEntry.name)
        });
      }
    }
  }

  return ucDirs;
}

function validateUcDir(ucInfo) {
  const errors = [];
  const warnings = [];
  const ucDir = ucInfo.path;
  const ucLabel = `${ucInfo.business}/${ucInfo.buc}/${ucInfo.uc}`;

  // ディレクトリ名にスラッシュが含まれないか（パス区切り以外）
  if (ucInfo.uc.includes('/')) {
    errors.push(`[${ucLabel}] UC ディレクトリ名にスラッシュが含まれています`);
  }

  // --- spec.md 検証 ---
  const specPath = path.join(ucDir, 'spec.md');
  if (!fs.existsSync(specPath)) {
    errors.push(`[${ucLabel}] spec.md が存在しません`);
  } else {
    const content = fs.readFileSync(specPath, 'utf8');

    const requiredSections = [
      { heading: '概要', required: true },
      { heading: '関連', required: true },
      { heading: 'E2E', required: true },
      { heading: 'ティア', required: true },
    ];

    for (const { heading, required } of requiredSections) {
      const regex = new RegExp(`##.*${heading}`, 'i');
      if (!regex.test(content)) {
        if (required) {
          errors.push(`[${ucLabel}] spec.md に "${heading}" を含むセクションがありません`);
        }
      }
    }

    // BDD シナリオ検証
    const hasGiven = /Given/i.test(content);
    const hasWhen = /When/i.test(content);
    const hasThen = /Then/i.test(content);
    if (!hasGiven || !hasWhen || !hasThen) {
      errors.push(`[${ucLabel}] spec.md に BDD シナリオ（Given/When/Then）が不完全です`);
    }

    // 関連RDRAモデルのテーブル検証
    if (!content.includes('| モデル種別') && !content.includes('|モデル種別')) {
      warnings.push(`[${ucLabel}] spec.md の関連RDRAモデルがテーブル形式ではありません`);
    }
  }

  // --- tier-*.md 検証（動的ティア） ---
  const allFiles = fs.readdirSync(ucDir);
  const tierMdFiles = allFiles.filter(f => /^tier-.*\.md$/.test(f));
  if (tierMdFiles.length === 0) {
    errors.push(`[${ucLabel}] tier-*.md が1つも存在しません（arch-design.yaml の tiers に対応するファイルが必要）`);
  } else {
    for (const tierFile of tierMdFiles) {
      const tierPath = path.join(ucDir, tierFile);
      const content = fs.readFileSync(tierPath, 'utf8');
      if (!/##.*変更概要|##.*変更内容/i.test(content)) {
        warnings.push(`[${ucLabel}] ${tierFile}: "変更概要" セクションがありません`);
      }
    }
  }

  // tier ファイルの BDD 検証
  for (const tierFile of tierMdFiles) {
    const tierPath = path.join(ucDir, tierFile);
    const content = fs.readFileSync(tierPath, 'utf8');
    const hasBDD = /Given/i.test(content) && /When/i.test(content) && /Then/i.test(content);
    if (!hasBDD) {
      warnings.push(`[${ucLabel}] ${tierFile}: BDD シナリオ（Given/When/Then）がありません`);
    }
  }

  // --- _model-summary.yaml 検証 ---
  const modelSummaryPath = path.join(ucDir, '_model-summary.yaml');
  if (!fs.existsSync(modelSummaryPath)) {
    warnings.push(`[${ucLabel}] _model-summary.yaml が存在しません`);
  } else {
    const content = fs.readFileSync(modelSummaryPath, 'utf8');
    if (!content.includes('models:')) {
      errors.push(`[${ucLabel}] _model-summary.yaml: "models:" フィールドがありません`);
    }
    if (!content.includes('tables:')) {
      errors.push(`[${ucLabel}] _model-summary.yaml: "tables:" フィールドがありません`);
    }
  }

  return { errors, warnings, tierFiles: allFiles };
}

// ---------------------------------------------------------------------------
// _cross-cutting 検証
// ---------------------------------------------------------------------------

function validateCrossCutting(baseDir) {
  const errors = [];
  const warnings = [];
  const crossDir = path.join(baseDir, '_cross-cutting');

  if (!fs.existsSync(crossDir)) {
    errors.push('_cross-cutting/ ディレクトリが存在しません');
    return { errors, warnings };
  }

  const requiredFiles = ['ux-ui/ux-design.md', 'ux-ui/ui-design.md', 'ux-ui/data-visualization.md', 'api/openapi.yaml'];
  for (const file of requiredFiles) {
    const filePath = path.join(crossDir, file);
    if (!fs.existsSync(filePath)) {
      errors.push(`_cross-cutting/${file} が存在しません`);
    }
  }

  // --- openapi.yaml 構文チェック ---
  const openapiPath = path.join(crossDir, 'api', 'openapi.yaml');
  if (fs.existsSync(openapiPath)) {
    const content = fs.readFileSync(openapiPath, 'utf8');
    if (!content.includes('openapi:')) {
      errors.push('_cross-cutting/openapi.yaml: "openapi:" フィールドがありません');
    }
    if (!content.includes('paths:')) {
      errors.push('_cross-cutting/openapi.yaml: "paths:" フィールドがありません');
    }
    if (!content.includes('info:')) {
      warnings.push('_cross-cutting/openapi.yaml: "info:" フィールドがありません');
    }
  }

  // --- asyncapi.yaml 構文チェック（存在する場合のみ、optional） ---
  const asyncapiPath = path.join(crossDir, 'api', 'asyncapi.yaml');
  if (fs.existsSync(asyncapiPath)) {
    const content = fs.readFileSync(asyncapiPath, 'utf8');
    if (!content.includes('asyncapi:')) {
      errors.push('_cross-cutting/asyncapi.yaml: "asyncapi:" フィールドがありません');
    }
    if (!content.includes('channels:')) {
      warnings.push('_cross-cutting/asyncapi.yaml: "channels:" フィールドがありません');
    }
  }

  // --- rdb-schema.yaml 構文チェック（存在する場合） ---
  const rdbSchemaPath = path.join(crossDir, 'datastore', 'rdb-schema.yaml');
  if (fs.existsSync(rdbSchemaPath)) {
    const content = fs.readFileSync(rdbSchemaPath, 'utf8');
    if (!content.includes('tables:')) {
      errors.push('_cross-cutting/rdb-schema.yaml: "tables:" フィールドがありません');
    }
    if (!content.includes('datastore:')) {
      warnings.push('_cross-cutting/rdb-schema.yaml: "datastore:" フィールドがありません');
    }
  }

  // --- kvs-schema.yaml 構文チェック（存在する場合） ---
  const kvsSchemaPath = path.join(crossDir, 'datastore', 'kvs-schema.yaml');
  if (fs.existsSync(kvsSchemaPath)) {
    const content = fs.readFileSync(kvsSchemaPath, 'utf8');
    if (!content.includes('key_patterns:')) {
      errors.push('_cross-cutting/kvs-schema.yaml: "key_patterns:" フィールドがありません');
    }
  }

  // --- object-storage-schema.yaml 構文チェック（存在する場合） ---
  const osSchemaPath = path.join(crossDir, 'datastore', 'object-storage-schema.yaml');
  if (fs.existsSync(osSchemaPath)) {
    const content = fs.readFileSync(osSchemaPath, 'utf8');
    if (!content.includes('buckets:')) {
      errors.push('_cross-cutting/object-storage-schema.yaml: "buckets:" フィールドがありません');
    }
  }

  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const jsonFlag = args.includes('--json');
  const nonFlagArgs = args.filter(a => !a.startsWith('--'));

  if (nonFlagArgs.length === 0) {
    console.error('Usage: node validateSpecEvent.js <path-to-spec-event-dir> [--json]');
    process.exit(2);
  }

  const eventDir = path.resolve(nonFlagArgs[0]);
  if (!fs.existsSync(eventDir)) {
    console.error(`Directory not found: ${eventDir}`);
    process.exit(2);
  }

  const allErrors = [];
  const allWarnings = [];

  // --- spec-event.yaml バリデーション ---
  const yamlPath = path.join(eventDir, 'spec-event.yaml');
  if (!fs.existsSync(yamlPath)) {
    allErrors.push('spec-event.yaml が存在しません');
  } else {
    const schemaPath = path.join(__dirname, 'schema-spec-event.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

    const yamlText = fs.readFileSync(yamlPath, 'utf8');
    let data;
    try {
      data = parseYaml(yamlText);
    } catch (e) {
      allErrors.push(`spec-event.yaml YAML parse error: ${e.message}`);
    }

    if (data) {
      const schemaErrors = validate(data, schema, schema.$defs || {}, '$');
      allErrors.push(...schemaErrors.map(e => `spec-event.yaml ${e.path}: ${e.message}`));
    }
  }

  // --- UC ディレクトリ検証 ---
  const ucDirs = findUcDirs(eventDir);

  if (ucDirs.length === 0) {
    allErrors.push('UC ディレクトリが1つも存在しません（業務/BUC/UC の3階層が必要）');
  }

  const ucResults = [];
  for (const ucInfo of ucDirs) {
    const result = validateUcDir(ucInfo);
    ucResults.push({ ...ucInfo, ...result });
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  // --- _cross-cutting 検証 ---
  const crossResult = validateCrossCutting(eventDir);
  allErrors.push(...crossResult.errors);
  allWarnings.push(...crossResult.warnings);

  // --- 結果出力 ---
  if (jsonFlag) {
    const result = {
      status: allErrors.length === 0 ? 'pass' : 'fail',
      dir: eventDir,
      errors: allErrors,
      warnings: allWarnings,
      stats: {
        uc_count: ucDirs.length,
        businesses: new Set(ucDirs.map(u => u.business)).size,
        bucs: new Set(ucDirs.map(u => `${u.business}/${u.buc}`)).size
      }
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(allErrors.length === 0 ? 0 : 1);
  }

  if (allErrors.length === 0) {
    console.log(`PASS${allWarnings.length > 0 ? ' (with warnings)' : ''}: ${eventDir}`);
    console.log(`  UC count: ${ucDirs.length}`);
    console.log(`  Businesses: ${new Set(ucDirs.map(u => u.business)).size}`);
    console.log(`  BUCs: ${new Set(ucDirs.map(u => `${u.business}/${u.buc}`)).size}`);
    for (const uc of ucResults) {
      console.log(`  - ${uc.business}/${uc.buc}/${uc.uc}: ${uc.tierFiles.join(', ')}`);
    }
    if (allWarnings.length > 0) {
      console.log(`  ${allWarnings.length} warning(s):`);
      for (const w of allWarnings) {
        console.log(`  WARN: ${w}`);
      }
    }
  } else {
    console.log(`FAIL: ${eventDir}`);
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
