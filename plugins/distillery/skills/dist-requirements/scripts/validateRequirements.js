#!/usr/bin/env node
/**
 * requirements.yaml バリデータ
 *
 * Usage:
 *   node validateRequirements.js <path-to-requirements.yaml> [--feedback-plan <plan.json> --feedback-stage-event <event.json>]
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
const { readCanonicalJson } = require('../../dist-pipeline/scripts/canonicalJson');

// ---------------------------------------------------------------------------
// 簡易 YAML パーサー（requirements.yaml のサブセットのみ対応）
// ---------------------------------------------------------------------------

function parseYaml(text) {
  const lines = text.split('\n');
  return parseNode(lines, 0, -1).value;
}

function parseMappingKey(rawKey) {
  const key = rawKey.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    throw new Error(`Unsupported mapping key: ${key || '(empty)'}`);
  }
  return key;
}

function setMappingKey(target, key, value) {
  if (Object.prototype.hasOwnProperty.call(target, key)) {
    throw new Error(`Duplicate mapping key: ${key}`);
  }
  target[key] = value;
}

function mergeMappings(target, source) {
  for (const [key, value] of Object.entries(source)) setMappingKey(target, key, value);
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
        const k = parseMappingKey(itemContent.slice(0, colonIdx));
        const v = itemContent.slice(colonIdx + 1).trim();

        // この配列要素がオブジェクトかを判断
        const nextLineIdx = findNextNonEmpty(lines, i + 1);
        if (nextLineIdx < lines.length) {
          const nextIndent = lines[nextLineIdx].search(/\S/);
          const nextContent = lines[nextLineIdx].trimStart();
          if (nextIndent > indent && !nextContent.startsWith('- ')) {
            // 子プロパティがある → オブジェクト
            const obj = {};
            setMappingKey(obj, k, parseValue(v));
            const child = parseNode(lines, i + 1, indent);
            mergeMappings(obj, child.value);
            currentArray.push(obj);
            i = child.nextIdx;
            continue;
          }
        }
        // 単一行オブジェクト
        const obj = {};
        setMappingKey(obj, k, parseValue(v));
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
      const key = parseMappingKey(content.slice(0, colonIdx));
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
              setMappingKey(result, key, arr.value);
              i = arr.nextIdx;
              continue;
            } else if (rawValue === '>') {
              // 折りたたみスカラー
              const scalar = parseFoldedScalar(lines, i + 1, indent);
              setMappingKey(result, key, scalar.value);
              i = scalar.nextIdx;
              continue;
            } else {
              // ネストオブジェクト
              const child = parseNode(lines, i + 1, indent);
              setMappingKey(result, key, child.value);
              i = child.nextIdx;
              continue;
            }
          }
        }
        setMappingKey(result, key, null);
        i++;
        continue;
      }

      setMappingKey(result, key, parseValue(rawValue));
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
      const k = parseMappingKey(itemContent.slice(0, colonIdx));
      const v = itemContent.slice(colonIdx + 1).trim();

      if (v === '' || v === '>') {
        // 子ノードを持つ
        const nextLineIdx = findNextNonEmpty(lines, i + 1);
        if (nextLineIdx < lines.length) {
          const nextIndent = lines[nextLineIdx].search(/\S/);
          if (nextIndent > itemIndent) {
            if (v === '>') {
              const scalar = parseFoldedScalar(lines, i + 1, itemIndent);
              setMappingKey(obj, k, scalar.value);
              // 残りのプロパティ
              const child = parseNode(lines, scalar.nextIdx, itemIndent);
              mergeMappings(obj, child.value);
              arr.push(obj);
              i = child.nextIdx;
              continue;
            }
            const nextContent = lines[nextLineIdx].trimStart();
            if (nextContent.startsWith('- ')) {
              const sub = parseArray(lines, nextLineIdx, itemIndent);
              setMappingKey(obj, k, sub.value);
              const child = parseNode(lines, sub.nextIdx, itemIndent);
              mergeMappings(obj, child.value);
            } else {
              const child = parseNode(lines, i + 1, itemIndent);
              setMappingKey(obj, k, parseValue(v) || child.value[k]);
              delete child.value[k];
              mergeMappings(obj, child.value);
              arr.push(obj);
              i = child.nextIdx;
              continue;
            }
            arr.push(obj);
            i = Object.keys(obj).length > 1 ? findNextAtOrAbove(lines, i + 1, itemIndent) : i + 1;
            continue;
          }
        }
        setMappingKey(obj, k, null);
      } else {
        setMappingKey(obj, k, parseValue(v));
      }

      // 追加プロパティのチェック
      const nextLineIdx2 = findNextNonEmpty(lines, i + 1);
      if (nextLineIdx2 < lines.length) {
        const nextIndent2 = lines[nextLineIdx2].search(/\S/);
        const nextContent2 = lines[nextLineIdx2].trimStart();
        if (nextIndent2 > itemIndent && !nextContent2.startsWith('- ')) {
          const child = parseNode(lines, i + 1, itemIndent);
          mergeMappings(obj, child.value);
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

function validateRequirementsDocument(data) {
  const schemaPath = path.join(__dirname, 'schema-requirements.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  return [
    ...validate(data, schema, schema.$defs || {}, '$'),
    ...validateRequirementsSemantics(data),
  ];
}

function validateRequirementsSemantics(data) {
  const errors = [];
  const requirementIds = new Map();
  const specificationIds = new Map();
  const requirements = Array.isArray(data?.requirements) ? data.requirements : [];

  for (let reqIndex = 0; reqIndex < requirements.length; reqIndex++) {
    const requirement = requirements[reqIndex];
    const requirementPath = `$.requirements[${reqIndex}]`;
    const requirementId = requirement?.id;
    if (typeof requirementId === 'string') {
      if (requirementIds.has(requirementId)) {
        errors.push({
          path: `${requirementPath}.id`,
          message: `Requirement id ${requirementId} duplicates ${requirementIds.get(requirementId)}`,
        });
      } else {
        requirementIds.set(requirementId, `${requirementPath}.id`);
      }
    }

    const requirementNumber = typeof requirementId === 'string'
      ? /^REQ-([0-9]{3})$/.exec(requirementId)?.[1]
      : undefined;
    const specifications = Array.isArray(requirement?.specifications) ? requirement.specifications : [];
    for (let specIndex = 0; specIndex < specifications.length; specIndex++) {
      const specification = specifications[specIndex];
      const specificationPath = `${requirementPath}.specifications[${specIndex}]`;
      const specificationId = specification?.id;
      if (typeof specificationId !== 'string') continue;
      if (specificationIds.has(specificationId)) {
        errors.push({
          path: `${specificationPath}.id`,
          message: `Specification id ${specificationId} duplicates ${specificationIds.get(specificationId)}`,
        });
      } else {
        specificationIds.set(specificationId, `${specificationPath}.id`);
      }
      const specificationRequirementNumber = /^SPEC-([0-9]{3})-[0-9]{2}$/.exec(specificationId)?.[1];
      if (requirementNumber && specificationRequirementNumber &&
          requirementNumber !== specificationRequirementNumber) {
        errors.push({
          path: `${specificationPath}.id`,
          message: `Specification id ${specificationId} must belong to ${requirementId}`,
        });
      }
    }
  }

  return errors;
}

function validateFeedbackLineage(data, plan, options = {}) {
  const errors = [];
  const requirementsWorkUnits = (plan.work_units || [])
    .filter(item => item.direct_stage === 'requirements');
  const applied = options.appliedWorkUnitIds === undefined
    ? new Set(requirementsWorkUnits.map(item => item.id))
    : new Set(options.appliedWorkUnitIds);
  const requirementsIds = new Set(requirementsWorkUnits.map(item => item.id));
  for (const id of applied) {
    if (!requirementsIds.has(id)) {
      errors.push({ path: '$', message: `Applied work unit ${id} is not assigned to requirements` });
    }
  }
  const workUnits = requirementsWorkUnits.filter(item => applied.has(item.id));
  const allowed = new Set(workUnits.map(item => item.id));
  const covered = new Set();

  function check(source, jsonPath) {
    // Existing, unchanged REQ/SPEC entries do not acquire lineage from the
    // current feedback run. Only entries created or changed by an applied
    // owner-ledger work unit carry feedback_source; the coverage gate below
    // still requires every such work unit to appear at least once.
    if (source === undefined || source === null) return;
    if (typeof source !== 'object' || Array.isArray(source)) {
      errors.push({ path: jsonPath, message: 'feedback_source must be an object when present' });
      return;
    }
    const workUnitIds = Array.isArray(source.work_unit_ids) ? source.work_unit_ids : [];
    if (typeof source.feedback_request_id !== 'string' || source.feedback_request_id.trim() === '' ||
        !Array.isArray(source.work_unit_ids) || workUnitIds.some(id => typeof id !== 'string' || id.trim() === '')) {
      errors.push({ path: jsonPath, message: 'feedback_source must contain a non-empty feedback_request_id and string work_unit_ids array' });
      return;
    }
    if (new Set(workUnitIds).size !== workUnitIds.length) {
      errors.push({ path: `${jsonPath}.work_unit_ids`, message: 'work_unit_ids must be unique' });
    }
    const touchesCurrentLineage = source.feedback_request_id === plan.feedback_request_id ||
      workUnitIds.some(id => requirementsIds.has(id));
    if (!touchesCurrentLineage) return;
    if (source.feedback_request_id !== plan.feedback_request_id) {
      errors.push({ path: `${jsonPath}.feedback_request_id`, message: `Expected ${plan.feedback_request_id}` });
    }
    if (workUnitIds.length === 0) {
      errors.push({ path: `${jsonPath}.work_unit_ids`, message: 'Current feedback_source work_unit_ids must be non-empty' });
    }
    for (const id of workUnitIds) {
      if (!allowed.has(id)) {
        errors.push({ path: `${jsonPath}.work_unit_ids`, message: `Work unit ${id} is not assigned to requirements` });
      } else {
        covered.add(id);
      }
    }
  }

  for (let reqIndex = 0; reqIndex < (data.requirements || []).length; reqIndex++) {
    const requirement = data.requirements[reqIndex];
    check(requirement.feedback_source, `$.requirements[${reqIndex}].feedback_source`);
    for (let specIndex = 0; specIndex < (requirement.specifications || []).length; specIndex++) {
      check(
        requirement.specifications[specIndex].feedback_source,
        `$.requirements[${reqIndex}].specifications[${specIndex}].feedback_source`
      );
    }
  }
  for (const id of allowed.keys()) {
    if (!covered.has(id)) {
      errors.push({ path: '$.requirements', message: `Requirements work unit ${id} is not referenced by any feedback_source` });
    }
  }
  return errors;
}

function deriveAppliedRequirementsWorkUnitIds(plan, stageEvent) {
  const errors = [];
  const plannedStage = (plan.execution_stages || []).find(item => item.id === 'requirements');
  if (!plannedStage) return { appliedWorkUnitIds: [], errors: ['Feedback plan has no requirements execution stage'] };
  if (!stageEvent || typeof stageEvent !== 'object' || Array.isArray(stageEvent)) {
    return { appliedWorkUnitIds: [], errors: ['Requirements feedback stage event must be an object'] };
  }
  if (stageEvent.type !== 'feedback_stage_completed' || stageEvent.stage !== 'requirements') {
    errors.push('Requirements feedback stage event must be a completed requirements event');
  }
  const exactArray = (left, right) => Array.isArray(left) && JSON.stringify(left) === JSON.stringify(right);
  if (!exactArray(stageEvent.direct_work_unit_ids, plannedStage.direct_work_unit_ids)) {
    errors.push('Requirements feedback stage event direct_work_unit_ids must exactly match the plan');
  }
  if (!exactArray(stageEvent.causal_work_unit_ids, plannedStage.causal_work_unit_ids)) {
    errors.push('Requirements feedback stage event causal_work_unit_ids must exactly match the plan');
  }
  const lineage = stageEvent.feedback_request || {};
  const expectedRequestIds = [...new Set((plannedStage.causal_work_unit_ids || []).map(id =>
    (plan.work_units || []).find(item => item.id === id)?.request_id))];
  if (lineage.feedback_request_id !== plan.feedback_request_id ||
      lineage.input_sha256 !== plan.input_sha256 ||
      !exactArray(lineage.request_ids, expectedRequestIds) ||
      !exactArray(lineage.work_unit_ids, plannedStage.causal_work_unit_ids)) {
    errors.push('Requirements feedback stage event lineage must exactly match the plan');
  }
  if (!Array.isArray(stageEvent.work_unit_results) ||
      !exactArray(stageEvent.work_unit_results.map(item => item?.work_unit_id), plannedStage.direct_work_unit_ids)) {
    errors.push('Requirements feedback stage event work_unit_results must cover direct work units in plan order');
    return { appliedWorkUnitIds: [], errors };
  }
  const appliedWorkUnitIds = [];
  for (const result of stageEvent.work_unit_results) {
    if (!result || typeof result !== 'object' || Array.isArray(result) ||
        !['applied', 'merged', 'deferred', 'rejected'].includes(result.disposition)) {
      errors.push(`Requirements feedback stage event has an invalid owner disposition: ${result?.work_unit_id || '(missing)'}`);
      continue;
    }
    if (result.disposition === 'applied') appliedWorkUnitIds.push(result.work_unit_id);
  }
  return { appliedWorkUnitIds, errors };
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node validateRequirements.js <path-to-requirements.yaml> [--feedback-plan <plan.json> --feedback-stage-event <event.json>]');
    process.exit(2);
  }
  const valueOptions = new Set(['--feedback-plan', '--feedback-stage-event']);
  const flagOptions = new Set(['--json']);
  for (let index = 1; index < args.length; index++) {
    const option = args[index];
    if (flagOptions.has(option)) continue;
    if (!valueOptions.has(option)) {
      console.error(`Unknown option: ${option}`);
      process.exit(2);
    }
    const value = args[++index];
    if (!value || value.startsWith('--')) {
      console.error(`${option} requires a value`);
      process.exit(2);
    }
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
  const errors = validateRequirementsDocument(data);
  const planIndex = args.indexOf('--feedback-plan');
  if (planIndex >= 0) {
    const planPath = args[planIndex + 1];
    if (!planPath || !fs.existsSync(planPath)) {
      console.error(`Feedback plan not found: ${planPath || '(missing)'}`);
      process.exit(2);
    }
    let plan;
    try {
      plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    } catch (error) {
      console.error(`Feedback plan parse error: ${error.message}`);
      process.exit(2);
    }
    const stageEventIndex = args.indexOf('--feedback-stage-event');
    const stageEventPath = stageEventIndex >= 0 ? args[stageEventIndex + 1] : null;
    if (!stageEventPath || !fs.existsSync(stageEventPath)) {
      console.error(`Requirements feedback stage event not found: ${stageEventPath || '(missing)'}`);
      process.exit(2);
    }
    let stageEvent;
    try {
      stageEvent = readCanonicalJson(stageEventPath, 'requirements feedback stage event');
    } catch (error) {
      console.error(`Requirements feedback stage event parse error: ${error.message}`);
      process.exit(2);
    }
    const binding = deriveAppliedRequirementsWorkUnitIds(plan, stageEvent);
    errors.push(...binding.errors.map(message => ({ path: '$', message })));
    errors.push(...validateFeedbackLineage(data, plan, { appliedWorkUnitIds: binding.appliedWorkUnitIds }));
  } else if (args.includes('--feedback-stage-event')) {
    console.error('--feedback-stage-event requires --feedback-plan');
    process.exit(2);
  }

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

module.exports = {
  deriveAppliedRequirementsWorkUnitIds,
  parseYaml,
  validate,
  validateFeedbackLineage,
  validateRequirementsDocument,
  validateRequirementsSemantics,
};

if (require.main === module) main();
