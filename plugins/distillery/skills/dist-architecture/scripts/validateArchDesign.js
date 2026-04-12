#!/usr/bin/env node
/**
 * arch-design.yaml バリデータ
 *
 * Usage:
 *   node validateArchDesign.js <path-to-arch-design.yaml>
 *   node validateArchDesign.js docs/arch/events/20260328_100000_initial_arch/arch-design.yaml
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
// 簡易 YAML パーサー（arch-design.yaml のサブセットのみ対応）
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
// アーキテクチャ固有クロスリファレンスチェック
// ---------------------------------------------------------------------------

function validateArchSpecific(data) {
  const errors = [];
  const tiers = (data.system_architecture || {}).tiers || [];
  const tierLayers = (data.app_architecture || {}).tier_layers || [];
  const entities = (data.data_architecture || {}).entities || [];
  const storageMappings = (data.data_architecture || {}).storage_mapping || [];

  // ティアID一覧
  const tierIds = new Set(tiers.map(t => t.id));

  // エンティティID一覧
  const entityIds = new Set(entities.map(e => e.id));

  // チェック1: app_architecture.tier_layers[].tier_id が system_architecture.tiers[].id に存在するか
  for (let i = 0; i < tierLayers.length; i++) {
    const tl = tierLayers[i];
    if (tl.tier_id && !tierIds.has(tl.tier_id)) {
      errors.push({
        path: `$.app_architecture.tier_layers[${i}].tier_id`,
        message: `tier_id "${tl.tier_id}" not found in system_architecture.tiers[].id`
      });
    }

    // チェック4: allowed_dependencies が同一ティア内のレイヤーIDに存在するか
    const layerIds = new Set((tl.layers || []).map(l => l.id));
    for (let j = 0; j < (tl.layers || []).length; j++) {
      const layer = tl.layers[j];
      for (const dep of (layer.allowed_dependencies || [])) {
        if (!layerIds.has(dep)) {
          errors.push({
            path: `$.app_architecture.tier_layers[${i}].layers[${j}].allowed_dependencies`,
            message: `allowed_dependency "${dep}" not found in tier "${tl.tier_id}" layers`
          });
        }
      }
    }
  }

  // チェック2: data_architecture.storage_mapping[].entity_id が entities[].id に存在するか
  for (let i = 0; i < storageMappings.length; i++) {
    const sm = storageMappings[i];
    if (sm.entity_id && !entityIds.has(sm.entity_id)) {
      errors.push({
        path: `$.data_architecture.storage_mapping[${i}].entity_id`,
        message: `entity_id "${sm.entity_id}" not found in data_architecture.entities[].id`
      });
    }
  }

  // チェック3: data_architecture.entities[].relationships[].target_entity が entities[].id に存在するか
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    for (let j = 0; j < (entity.relationships || []).length; j++) {
      const rel = entity.relationships[j];
      if (rel.target_entity && !entityIds.has(rel.target_entity)) {
        errors.push({
          path: `$.data_architecture.entities[${i}].relationships[${j}].target_entity`,
          message: `target_entity "${rel.target_entity}" not found in data_architecture.entities[].id`
        });
      }
    }
  }

  // カウント集計
  const tiersCount = tiers.length;
  const entitiesCount = entities.length;
  let policiesCount = 0;
  let rulesCount = 0;

  // system_architecture のポリシー・ルール
  for (const tier of tiers) {
    policiesCount += (tier.policies || []).length;
    rulesCount += (tier.rules || []).length;
  }
  policiesCount += ((data.system_architecture || {}).cross_tier_policies || []).length;
  rulesCount += ((data.system_architecture || {}).cross_tier_rules || []).length;

  // app_architecture のポリシー・ルール
  for (const tl of tierLayers) {
    policiesCount += (tl.cross_layer_policies || []).length;
    rulesCount += (tl.cross_layer_rules || []).length;
    for (const layer of (tl.layers || [])) {
      policiesCount += (layer.policies || []).length;
      rulesCount += (layer.rules || []).length;
    }
  }

  return { errors, tiersCount, entitiesCount, policiesCount, rulesCount };
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node validateArchDesign.js <path-to-arch-design.yaml>');
    process.exit(2);
  }

  const yamlPath = path.resolve(args[0]);
  if (!fs.existsSync(yamlPath)) {
    console.error(`File not found: ${yamlPath}`);
    process.exit(2);
  }

  // スキーマ読み込み
  const schemaPath = path.join(__dirname, 'schema-arch-design.json');
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

  // スキーマバリデーション
  const schemaErrors = validate(data, schema, schema.$defs || {}, '$');

  // アーキテクチャ固有チェック
  const { errors: archErrors, tiersCount, entitiesCount, policiesCount, rulesCount } = validateArchSpecific(data);

  const allErrors = [...schemaErrors, ...archErrors];

  if (allErrors.length === 0) {
    console.log(`PASS: ${yamlPath}`);
    console.log(`  Tiers: ${tiersCount}`);
    console.log(`  Entities: ${entitiesCount}`);
    console.log(`  Policies + Rules: ${policiesCount + rulesCount} (policies: ${policiesCount}, rules: ${rulesCount})`);
    process.exit(0);
  } else {
    console.log(`FAIL: ${yamlPath}`);
    console.log(`  ${allErrors.length} error(s):`);
    for (const e of allErrors) {
      console.log(`  - ${e.path}: ${e.message}`);
    }
    if (args.includes('--json')) {
      console.log(JSON.stringify({ status: 'fail', errors: allErrors, file: yamlPath }, null, 2));
    }
    process.exit(1);
  }
}

main();
