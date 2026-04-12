#!/usr/bin/env node
/**
 * design-event.yaml バリデータ
 *
 * Usage:
 *   node validateDesignEvent.js <path-to-design-event.yaml>
 *   node validateDesignEvent.js docs/design/events/20260328_100000_initial/design-event.yaml
 *   node validateDesignEvent.js docs/design/events/20260328_100000_initial/design-event.yaml --json
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
// 簡易 YAML パーサー（design-event.yaml のサブセットのみ対応）
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

  if (schema.minProperties !== undefined && typeof data === 'object' && !Array.isArray(data)) {
    if (Object.keys(data).length < schema.minProperties) {
      errors.push({ path: jsonPath, message: `Object has too few properties (${Object.keys(data).length} < ${schema.minProperties})` });
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// デザインシステム固有クロスリファレンスチェック
// ---------------------------------------------------------------------------

function validateDesignSpecific(data) {
  const errors = [];
  const warnings = [];

  const portals = data.portals || [];
  const components = data.components || {};
  const screens = data.screens || [];
  const states = data.states || [];
  const brand = data.brand || {};
  const tokens = data.tokens || {};

  // ポータルID一覧
  const portalIds = new Set(portals.map(p => p.id));

  // コンポーネント名一覧（UI + Domain）
  const uiComponents = (components.ui || []);
  const domainComponents = (components.domain || []);
  const componentNames = new Set([
    ...uiComponents.map(c => c.name),
    ...domainComponents.map(c => c.name)
  ]);

  // チェック1: screen.portal が portals[].id に存在するか
  for (let i = 0; i < screens.length; i++) {
    const screen = screens[i];
    if (screen.portal && !portalIds.has(screen.portal)) {
      errors.push({
        path: `$.screens[${i}].portal`,
        message: `portal "${screen.portal}" not found in portals[].id`
      });
    }

    // チェック2: screen.components が components.ui[].name または components.domain[].name に存在するか
    for (let j = 0; j < (screen.components || []).length; j++) {
      const compName = screen.components[j];
      if (!componentNames.has(compName)) {
        errors.push({
          path: `$.screens[${i}].components[${j}]`,
          message: `component "${compName}" not found in components.ui[].name or components.domain[].name`
        });
      }
    }
  }

  // チェック3: states color values が有効な enum 値であるか
  const validColors = ['amber', 'green', 'blue', 'gray', 'red', 'violet', 'orange'];
  for (let i = 0; i < states.length; i++) {
    const stateModel = states[i];
    for (let j = 0; j < (stateModel.entries || []).length; j++) {
      const entry = stateModel.entries[j];
      if (entry.color && !validColors.includes(entry.color)) {
        errors.push({
          path: `$.states[${i}].entries[${j}].color`,
          message: `color "${entry.color}" not in valid enum [${validColors.join(', ')}]`
        });
      }
    }
  }

  // チェック4: brand.logo.variants のパスが .svg で終わるか（警告）
  const logo = brand.logo || {};
  const variants = logo.variants || [];
  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i];
    if (variant.path && !variant.path.endsWith('.svg')) {
      warnings.push({
        path: `$.brand.logo.variants[${i}].path`,
        message: `logo path "${variant.path}" does not end with .svg (recommended format)`
      });
    }
  }

  // チェック5: tokens.dark_overrides に semantic.background が定義されているか（警告）
  const darkOverrides = tokens.dark_overrides || {};
  const darkSemantic = darkOverrides.semantic || {};
  if (Object.keys(darkOverrides).length > 0 && !darkSemantic.background) {
    warnings.push({
      path: '$.tokens.dark_overrides.semantic.background',
      message: 'dark_overrides exists but semantic.background is not defined (recommended for dark mode)'
    });
  }

  // カウント集計
  const portalCount = portals.length;
  const componentCount = uiComponents.length + domainComponents.length;
  const screenCount = screens.length;
  const stateModelCount = states.length;

  return { errors, warnings, portalCount, componentCount, screenCount, stateModelCount };
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const jsonFlag = args.includes('--json');
  const nonFlagArgs = args.filter(a => !a.startsWith('--'));

  if (nonFlagArgs.length === 0) {
    console.error('Usage: node validateDesignEvent.js <path-to-design-event.yaml> [--json]');
    process.exit(2);
  }

  const yamlPath = path.resolve(nonFlagArgs[0]);
  if (!fs.existsSync(yamlPath)) {
    console.error(`File not found: ${yamlPath}`);
    process.exit(2);
  }

  // スキーマ読み込み
  const schemaPath = path.join(__dirname, 'schema-design-event.json');
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

  // デザインシステム固有チェック
  const { errors: designErrors, warnings, portalCount, componentCount, screenCount, stateModelCount } = validateDesignSpecific(data);

  const allErrors = [...schemaErrors, ...designErrors];

  if (jsonFlag) {
    const result = {
      status: allErrors.length === 0 ? 'pass' : 'fail',
      file: yamlPath,
      errors: allErrors,
      warnings: warnings,
      stats: {
        portals: portalCount,
        components: componentCount,
        screens: screenCount,
        state_models: stateModelCount
      }
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(allErrors.length === 0 ? 0 : 1);
  }

  if (allErrors.length === 0) {
    console.log(`PASS: ${yamlPath}`);
    console.log(`  Portals: ${portalCount}`);
    console.log(`  Components: ${componentCount}`);
    console.log(`  Screens: ${screenCount}`);
    console.log(`  State Models: ${stateModelCount}`);
    if (warnings.length > 0) {
      console.log(`  ${warnings.length} warning(s):`);
      for (const w of warnings) {
        console.log(`  - [WARN] ${w.path}: ${w.message}`);
      }
    }
    process.exit(0);
  } else {
    console.log(`FAIL: ${yamlPath}`);
    console.log(`  ${allErrors.length} error(s):`);
    for (const e of allErrors) {
      console.log(`  - ${e.path}: ${e.message}`);
    }
    if (warnings.length > 0) {
      console.log(`  ${warnings.length} warning(s):`);
      for (const w of warnings) {
        console.log(`  - [WARN] ${w.path}: ${w.message}`);
      }
    }
    process.exit(1);
  }
}

main();
