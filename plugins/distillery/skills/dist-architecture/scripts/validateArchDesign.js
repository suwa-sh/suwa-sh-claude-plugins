#!/usr/bin/env node
/**
 * arch-design.yaml バリデータ
 *
 * Usage:
 *   node validateArchDesign.js <path-to-arch-design.yaml> [--mode=auto|initial|diff]
 *   node validateArchDesign.js docs/arch/events/20260328_100000_initial_arch/arch-design.yaml
 *
 * 終了コード:
 *   0 = 全チェック PASS（WARN は含み得る）
 *   1 = バリデーションエラーあり（ERROR）
 *   2 = ファイル読み込みエラー
 *
 * モード:
 *   auto    (default) パス名から自動判定。`/latest/` を含めば initial 相当、`/events/` 配下なら mode に応じて分岐
 *   initial 新規構築 / latest スナップショット扱い。domain_architecture 欠落は WARN（exit 0）
 *   diff    差分更新扱い。domain_architecture が無くても WARN にしない（差分は変更セクションのみ）
 *
 * 既知の制約（TODO: 将来 PR で対応）:
 *   - 現状は完全版スキーマ（arch-design.yaml）のみ正式サポート。arch-design-diff.yaml に対しても
 *     同じスキーマで検証するため、必須トップレベルキー（version, event_id, technology_context 等）が
 *     欠落していると schema ERROR になる
 *   - 当面の運用: diff yaml を直接検証せず、latest にマージしてから検証することを推奨
 *   - --mode=diff オプションは domain_architecture 欠落 WARN の抑制のみで、トップレベル必須キー
 *     チェックは無効化していない
 *
 * 設計判断:
 *   - domain_architecture セクションは optional（後方互換）。欠落しても WARN 止まり
 *   - クロスリファレンスチェック（BC <-> entity 等）は domain_architecture が存在する場合のみ実施
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
    const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    let typeMatch = false;
    for (const t of allowedTypes) {
      if (t === 'integer') {
        if (typeof data === 'number' && Number.isInteger(data)) { typeMatch = true; break; }
      } else if (actualType === t) {
        typeMatch = true; break;
      }
    }
    if (!typeMatch) {
      errors.push({ path: jsonPath, message: `Expected ${allowedTypes.join(' | ')}, got ${actualType} (value: ${JSON.stringify(data)?.slice(0, 60)})` });
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

function validateArchSpecific(data, mode) {
  const errors = [];
  const warnings = [];
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

  // --- domain_architecture チェック（optional セクション） ---
  const domainArch = data.domain_architecture;
  let subdomainsCount = 0;
  let bcsCount = 0;
  let contextMapCount = 0;
  let aggregatesCount = 0;

  if (domainArch === undefined || domainArch === null) {
    if (mode === 'initial') {
      warnings.push({
        path: '$.domain_architecture',
        message: 'domain_architecture not present. Allowed for backward compatibility with pre-domain snapshots, but new builds should include at least 1 subdomain and 1 bounded_context.'
      });
    }
  } else {
    const subdomains = domainArch.subdomains || [];
    const bcs = domainArch.bounded_contexts || [];
    const contextMap = domainArch.context_map || [];
    const aggregates = domainArch.aggregate_hypotheses || [];

    subdomainsCount = subdomains.length;
    bcsCount = bcs.length;
    contextMapCount = contextMap.length;
    aggregatesCount = aggregates.length;

    // ID 一意性チェック
    const sdIds = new Set();
    for (let i = 0; i < subdomains.length; i++) {
      const sd = subdomains[i];
      if (sd.id) {
        if (sdIds.has(sd.id)) {
          errors.push({
            path: `$.domain_architecture.subdomains[${i}].id`,
            message: `Duplicate subdomain id "${sd.id}"`
          });
        }
        sdIds.add(sd.id);
      }
    }

    const bcIds = new Set();
    for (let i = 0; i < bcs.length; i++) {
      const bc = bcs[i];
      if (bc.id) {
        if (bcIds.has(bc.id)) {
          errors.push({
            path: `$.domain_architecture.bounded_contexts[${i}].id`,
            message: `Duplicate bounded_context id "${bc.id}"`
          });
        }
        bcIds.add(bc.id);
      }
    }

    const cmIds = new Set();
    for (let i = 0; i < contextMap.length; i++) {
      const cm = contextMap[i];
      if (cm.id) {
        if (cmIds.has(cm.id)) {
          errors.push({
            path: `$.domain_architecture.context_map[${i}].id`,
            message: `Duplicate context_map id "${cm.id}"`
          });
        }
        cmIds.add(cm.id);
      }
    }

    const agIds = new Set();
    for (let i = 0; i < aggregates.length; i++) {
      const ag = aggregates[i];
      if (ag.id) {
        if (agIds.has(ag.id)) {
          errors.push({
            path: `$.domain_architecture.aggregate_hypotheses[${i}].id`,
            message: `Duplicate aggregate_hypothesis id "${ag.id}"`
          });
        }
        agIds.add(ag.id);
      }
    }

    // BC.related_subdomain_id → SD.id 参照整合性
    for (let i = 0; i < bcs.length; i++) {
      const bc = bcs[i];
      if (bc.related_subdomain_id && !sdIds.has(bc.related_subdomain_id)) {
        errors.push({
          path: `$.domain_architecture.bounded_contexts[${i}].related_subdomain_id`,
          message: `related_subdomain_id "${bc.related_subdomain_id}" not found in subdomains[].id`
        });
      }
      // BC.owned_entity_ids → entities[].id 参照整合性
      for (let j = 0; j < (bc.owned_entity_ids || []).length; j++) {
        const eid = bc.owned_entity_ids[j];
        if (!entityIds.has(eid)) {
          errors.push({
            path: `$.domain_architecture.bounded_contexts[${i}].owned_entity_ids[${j}]`,
            message: `owned_entity_id "${eid}" not found in data_architecture.entities[].id`
          });
        }
      }
    }

    // context_map の from/to → BC.id 参照整合性
    for (let i = 0; i < contextMap.length; i++) {
      const cm = contextMap[i];
      if (cm.from_bc_id && !bcIds.has(cm.from_bc_id)) {
        errors.push({
          path: `$.domain_architecture.context_map[${i}].from_bc_id`,
          message: `from_bc_id "${cm.from_bc_id}" not found in bounded_contexts[].id`
        });
      }
      if (cm.to_bc_id && !bcIds.has(cm.to_bc_id)) {
        errors.push({
          path: `$.domain_architecture.context_map[${i}].to_bc_id`,
          message: `to_bc_id "${cm.to_bc_id}" not found in bounded_contexts[].id`
        });
      }
      if (cm.from_bc_id && cm.to_bc_id && cm.from_bc_id === cm.to_bc_id) {
        errors.push({
          path: `$.domain_architecture.context_map[${i}]`,
          message: `from_bc_id and to_bc_id are the same ("${cm.from_bc_id}"); context_map must connect distinct BCs`
        });
      }
    }

    // aggregate_hypotheses の参照整合性
    // BC.id → owned_entity_ids のマップ
    const bcOwnedEntities = new Map();
    for (const bc of bcs) {
      bcOwnedEntities.set(bc.id, new Set(bc.owned_entity_ids || []));
    }
    for (let i = 0; i < aggregates.length; i++) {
      const ag = aggregates[i];
      if (ag.bounded_context_id && !bcIds.has(ag.bounded_context_id)) {
        errors.push({
          path: `$.domain_architecture.aggregate_hypotheses[${i}].bounded_context_id`,
          message: `bounded_context_id "${ag.bounded_context_id}" not found in bounded_contexts[].id`
        });
        continue;
      }
      const ownedSet = bcOwnedEntities.get(ag.bounded_context_id) || new Set();

      // root_entity_id は BC.owned_entity_ids に含まれていること（WARN - 強整合の仮説違反）
      if (ag.root_entity_id && !ownedSet.has(ag.root_entity_id)) {
        warnings.push({
          path: `$.domain_architecture.aggregate_hypotheses[${i}].root_entity_id`,
          message: `root_entity_id "${ag.root_entity_id}" is not in bounded_context "${ag.bounded_context_id}".owned_entity_ids. Aggregate root should belong to its BC.`
        });
      }
      // member_entity_ids も BC 内であることを期待（WARN）
      for (let j = 0; j < (ag.member_entity_ids || []).length; j++) {
        const mid = ag.member_entity_ids[j];
        if (!ownedSet.has(mid)) {
          warnings.push({
            path: `$.domain_architecture.aggregate_hypotheses[${i}].member_entity_ids[${j}]`,
            message: `member_entity_id "${mid}" is not in bounded_context "${ag.bounded_context_id}".owned_entity_ids`
          });
        }
      }
    }

    // confidence 上限ルール: Core は medium 以下、BC は medium 以下、Aggregate は low 以下
    for (let i = 0; i < subdomains.length; i++) {
      const sd = subdomains[i];
      if (sd.type === 'core' && sd.confidence === 'high') {
        warnings.push({
          path: `$.domain_architecture.subdomains[${i}].confidence`,
          message: `Core subdomain "${sd.id}" has confidence "high"; recommended max is "medium" (Core は経営判断のため自動推論では high を付けない)`
        });
      }
    }
    for (let i = 0; i < bcs.length; i++) {
      const bc = bcs[i];
      if (bc.confidence === 'high') {
        warnings.push({
          path: `$.domain_architecture.bounded_contexts[${i}].confidence`,
          message: `BoundedContext "${bc.id}" has confidence "high"; recommended max is "medium" (BC 分割はユーザー確認必須)`
        });
      }
    }
    for (let i = 0; i < aggregates.length; i++) {
      const ag = aggregates[i];
      if (ag.confidence === 'high' || ag.confidence === 'medium') {
        warnings.push({
          path: `$.domain_architecture.aggregate_hypotheses[${i}].confidence`,
          message: `AggregateHypothesis "${ag.id}" has confidence "${ag.confidence}"; recommended max is "low" (集約は戦略段階の仮説)`
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

  return { errors, warnings, tiersCount, entitiesCount, policiesCount, rulesCount, subdomainsCount, bcsCount, contextMapCount, aggregatesCount };
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

function detectMode(yamlPath, explicitMode) {
  if (explicitMode && ['initial', 'diff'].includes(explicitMode)) return explicitMode;
  // auto: パス名から判定
  if (yamlPath.endsWith('arch-design-diff.yaml')) return 'diff';
  return 'initial'; // arch-design.yaml は initial / latest スナップショット相当
}

function main() {
  const rawArgs = process.argv.slice(2);
  const positional = [];
  let explicitMode = null;
  let jsonOutput = false;
  for (const a of rawArgs) {
    if (a.startsWith('--mode=')) {
      explicitMode = a.slice('--mode='.length);
    } else if (a === '--json') {
      jsonOutput = true;
    } else {
      positional.push(a);
    }
  }

  if (positional.length === 0) {
    console.error('Usage: node validateArchDesign.js <path-to-arch-design.yaml> [--mode=auto|initial|diff] [--json]');
    process.exit(2);
  }

  const yamlPath = path.resolve(positional[0]);
  if (!fs.existsSync(yamlPath)) {
    console.error(`File not found: ${yamlPath}`);
    process.exit(2);
  }

  const mode = detectMode(yamlPath, explicitMode);

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
  const archResult = validateArchSpecific(data, mode);
  const allErrors = [...schemaErrors, ...archResult.errors];
  const allWarnings = archResult.warnings || [];

  if (allErrors.length === 0) {
    console.log(`PASS: ${yamlPath}  (mode: ${mode})`);
    console.log(`  Tiers: ${archResult.tiersCount}`);
    console.log(`  Entities: ${archResult.entitiesCount}`);
    console.log(`  Policies + Rules: ${archResult.policiesCount + archResult.rulesCount} (policies: ${archResult.policiesCount}, rules: ${archResult.rulesCount})`);
    if (archResult.subdomainsCount + archResult.bcsCount + archResult.contextMapCount + archResult.aggregatesCount > 0) {
      console.log(`  Domain: subdomains=${archResult.subdomainsCount}, BCs=${archResult.bcsCount}, context_map=${archResult.contextMapCount}, aggregates=${archResult.aggregatesCount}`);
    }
    if (allWarnings.length > 0) {
      console.error(`  ${allWarnings.length} warning(s):`);
      for (const w of allWarnings) {
        console.error(`  [WARN] ${w.path}: ${w.message}`);
      }
    }
    if (jsonOutput) {
      console.log(JSON.stringify({ status: 'pass', warnings: allWarnings, file: yamlPath, mode }, null, 2));
    }
    process.exit(0);
  } else {
    console.log(`FAIL: ${yamlPath}  (mode: ${mode})`);
    console.log(`  ${allErrors.length} error(s):`);
    for (const e of allErrors) {
      console.log(`  - ${e.path}: ${e.message}`);
    }
    if (allWarnings.length > 0) {
      console.error(`  ${allWarnings.length} warning(s):`);
      for (const w of allWarnings) {
        console.error(`  [WARN] ${w.path}: ${w.message}`);
      }
    }
    if (jsonOutput) {
      console.log(JSON.stringify({ status: 'fail', errors: allErrors, warnings: allWarnings, file: yamlPath, mode }, null, 2));
    }
    process.exit(1);
  }
}

main();
