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
 *  14. spec-event.yaml の use_cases[].usdm の spec_id が USDM に実在し req_id 配下であること
 *
 * オプション:
 *   --usdm <path>  USDM requirements.yaml のパス
 *                  （既定: {event-dir}/../../../usdm/latest/requirements.yaml）
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
// USDM 参照検証
// ---------------------------------------------------------------------------

/**
 * イベントディレクトリから USDM requirements.yaml のパスを導く。
 *
 * 規約上の入口 `{root}/specs/latest` と `{root}/specs/events/{id}` だけを認め、
 * `{root}/usdm/latest/requirements.yaml` に解決する。
 * 祖先探索はしない（別プロジェクトや無関係な `specs` の USDM を拾わないため）。
 * 規約外の配置では null を返し、`--usdm` での明示指定を求める。
 *
 * @param {string} eventDir - イベントまたは latest ディレクトリの絶対パス
 * @returns {string|null} USDM のパス（存在するとは限らない）。規約外の配置なら null
 */
function findUsdmPath(eventDir) {
  const parent = path.dirname(eventDir);
  let specsDir = null;
  if (path.basename(eventDir) === 'latest' && path.basename(parent) === 'specs') {
    specsDir = parent;
  } else if (path.basename(parent) === 'events' && path.basename(path.dirname(parent)) === 'specs') {
    specsDir = path.dirname(parent);
  }
  if (!specsDir) return null;
  return path.join(path.dirname(specsDir), 'usdm', 'latest', 'requirements.yaml');
}

/**
 * USDM requirements.yaml から SPEC ID → REQ ID の対応表を作る。
 *
 * `requirements[].specifications[]` の構造から作るため、キー順に依存しない。
 *
 * @param {string} usdmPath - requirements.yaml のパス
 * @returns {Map<string,string>|null} spec_id → req_id。ファイルが無い・構造が読めなければ null
 */
function loadUsdmIndex(usdmPath) {
  if (!usdmPath || !fs.existsSync(usdmPath)) return null;
  let document;
  try {
    document = parseYaml(fs.readFileSync(usdmPath, 'utf8'));
  } catch (_) {
    return null;
  }
  const requirements = Array.isArray(document?.requirements) ? document.requirements : null;
  if (!requirements) return null;

  const index = new Map();
  for (const requirement of requirements) {
    const reqId = requirement?.id;
    if (typeof reqId !== 'string') continue;
    for (const specification of (Array.isArray(requirement.specifications) ? requirement.specifications : [])) {
      const specId = specification?.id;
      if (typeof specId === 'string' && !index.has(specId)) index.set(specId, reqId);
    }
  }
  return index;
}

/**
 * spec-event.yaml の use_cases[].usdm を USDM の実在と照合する。
 *
 * @param {object} data - spec-event.yaml のパース結果
 * @param {Map<string,string>|null} usdmIndex - loadUsdmIndex の戻り値
 * @param {string} usdmPath - 表示用の USDM パス
 * @returns {{errors: string[], warnings: string[], checked: number}}
 */
function validateUsdmRefs(data, usdmIndex, usdmPath) {
  const errors = [];
  const warnings = [];
  let checked = 0;

  const useCases = Array.isArray(data?.use_cases) ? data.use_cases : [];
  const withRefs = useCases.filter(uc => Array.isArray(uc?.usdm) && uc.usdm.length > 0);
  if (withRefs.length === 0) return { errors, warnings, checked };

  if (!usdmIndex) {
    const where = usdmPath || '規約上の入口（specs/latest または specs/events/{id}）ではないため未解決。--usdm で指定してください';
    warnings.push(`spec-event.yaml に usdm 参照があるが USDM が見つからないため実在チェックを skip: ${where}`);
    return { errors, warnings, checked };
  }

  for (const uc of withRefs) {
    const label = `${uc.business}/${uc.buc}/${uc.uc}`;
    for (let i = 0; i < uc.usdm.length; i++) {
      const ref = uc.usdm[i];
      const at = `spec-event.yaml use_cases(${label}).usdm[${i}]`;
      if (!ref || typeof ref !== 'object') continue;
      checked++;
      if (!usdmIndex.has(ref.spec_id)) {
        errors.push(`${at}: spec_id "${ref.spec_id}" が USDM に存在しません (${usdmPath})`);
        continue;
      }
      const owner = usdmIndex.get(ref.spec_id);
      if (owner !== ref.req_id) {
        errors.push(`${at}: spec_id "${ref.spec_id}" の親は "${owner}" です（req_id "${ref.req_id}" と不一致）`);
      }
    }
  }

  return { errors, warnings, checked };
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
  let hasUsdmSection = false;
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

    // 列名は固定せず、関連モデルの節に表または参照リストがあることを確認する。
    const rdraSection = content.match(/^##[^\n]*関連[^\n]*RDRA[^\n]*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1] || '';
    const hasTable = /^\s*\|\s*:?-{3,}:?\s*\|/m.test(rdraSection);
    const hasReferenceList = /^\s*[-*]\s+.*\[[^\]]+\]\([^)]+\)/m.test(rdraSection);
    if (!hasTable && !hasReferenceList) {
      warnings.push(`[${ucLabel}] spec.md の関連RDRAモデルに表または参照リストがありません`);
    }

    // 「関連 USDM」節の有無。spec-event.yaml の usdm 参照と対で持つべきなので main で突き合わせる
    hasUsdmSection = /^##[^\n]*関連[^\n]*USDM/im.test(content);
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
      if (!/^##.*(?:責務|概要|画面|変更内容)/im.test(content)) {
        warnings.push(`[${ucLabel}] ${tierFile}: 責務または概要を示すセクションがありません`);
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

  return { errors, warnings, tierFiles: allFiles, hasUsdmSection };
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

  const catalogPath = path.join(crossDir, 'api', 'contracts.json');
  let catalog = null;
  if (fs.existsSync(catalogPath)) {
    try {
      catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      require('./compileContracts').run(baseDir, true);
    } catch (e) { errors.push(`Contract catalog: ${e.message}`); }
  }
  const requiredFiles = ['ux-ui/ux-design.md', 'ux-ui/ui-design.md', 'ux-ui/data-visualization.md'];
  const splitOpenapi = typeof catalog?.openapi === 'string';
  if (!catalog || catalog.openapi !== null) requiredFiles.push(splitOpenapi ? 'api/generated/openapi.bundle.yaml' : 'api/openapi.yaml');
  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(crossDir, file))) errors.push(`_cross-cutting/${file} が存在しません`);
  }

  // Parse native JSON/YAML documents rather than searching serialized field names.
  for (const [kind, required, optional] of [
    ['openapi', ['openapi', 'paths'], ['info']],
    ['asyncapi', ['asyncapi'], ['channels']],
  ]) {
    const file = path.join(crossDir, 'api', typeof catalog?.[kind] === 'string' ? `generated/${kind}.bundle.yaml` : `${kind}.yaml`);
    if (!fs.existsSync(file)) continue;
    try {
      const data = require('./lib/yaml-parser').parseYaml(fs.readFileSync(file, 'utf8'));
      for (const key of required) if (!data || !Object.prototype.hasOwnProperty.call(data, key))
        errors.push(`_cross-cutting/api/${kind}.yaml: "${key}" フィールドがありません`);
      for (const key of optional) if (!data || !Object.prototype.hasOwnProperty.call(data, key))
        warnings.push(`_cross-cutting/api/${kind}.yaml: "${key}" フィールドがありません`);
    } catch (e) { errors.push(`_cross-cutting/api/${kind}.yaml: ${e.message}`); }
  }

  // --- rdb-schema.yaml 構文チェック（存在する場合） ---
  const rdbSchemaPath = path.join(crossDir, 'datastore', 'rdb-schema.yaml');
  if (fs.existsSync(rdbSchemaPath)) {
    const content = fs.readFileSync(rdbSchemaPath, 'utf8');
    if (/schema_version:\s*["']?distillery\.rdb-split\/v1/.test(content) || /"schema_version"\s*:\s*"distillery\.rdb-split\/v1"/.test(content)) {
      try {
        require('./compileRdbSchema').compileRdbSchema(rdbSchemaPath, { check: true });
      } catch (error) { errors.push(`Split RDB validation failed: ${error.message}`); }
    } else {
      if (!content.includes('tables:')) errors.push('_cross-cutting/rdb-schema.yaml: "tables:" フィールドがありません');
      if (!content.includes('datastore:')) warnings.push('_cross-cutting/rdb-schema.yaml: "datastore:" フィールドがありません');
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
  const usdmFlagIdx = args.indexOf('--usdm');
  const usdmValueIdx = usdmFlagIdx >= 0 ? usdmFlagIdx + 1 : -1;
  const usdmOverride = usdmValueIdx >= 0 ? args[usdmValueIdx] : null;
  const nonFlagArgs = args.filter((a, i) => !a.startsWith('--') && i !== usdmValueIdx);

  const usage = 'Usage: node validateSpecEvent.js <path-to-spec-event-dir> [--json] [--usdm <requirements.yaml>]';
  if (nonFlagArgs.length === 0) {
    console.error(usage);
    process.exit(2);
  }
  if (usdmFlagIdx >= 0) {
    if (args.lastIndexOf('--usdm') !== usdmFlagIdx) {
      console.error('--usdm は 1 回だけ指定してください');
      process.exit(2);
    }
    if (!usdmOverride || usdmOverride.startsWith('--')) {
      console.error(`--usdm には requirements.yaml のパスが必要です\n${usage}`);
      process.exit(2);
    }
  }

  const eventDir = path.resolve(nonFlagArgs[0]);
  if (!fs.existsSync(eventDir)) {
    console.error(`Directory not found: ${eventDir}`);
    process.exit(2);
  }
  if (!fs.statSync(eventDir).isDirectory()) {
    console.error(`Not a directory: ${eventDir}`);
    console.error('Hint: spec-event.yaml のファイルパスではなく、イベントディレクトリを指定してください');
    process.exit(2);
  }

  const allErrors = [];
  const allWarnings = [];

  // --- spec-event.yaml バリデーション ---
  let specEventData = null;
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
      specEventData = data;
    } catch (e) {
      allErrors.push(`spec-event.yaml YAML parse error: ${e.message}`);
    }

    if (data) {
      const schemaErrors = validate(data, schema, schema.$defs || {}, '$');
      allErrors.push(...schemaErrors.map(e => `spec-event.yaml ${e.path}: ${e.message}`));

      // story_generation と _inputs-digest.md の design_available の整合(1.5.0 以降の新規 event のみ。
      // 旧 event には digest の design_available 行が無いので検査しない = 後方互換)
      const digestPath = path.join(eventDir, '_inputs-digest.md');
      if (fs.existsSync(digestPath)) {
        const m = fs.readFileSync(digestPath, 'utf8').match(/^design_available:\s*(true|false)\s*$/m);
        if (m) {
          const expected = m[1] === 'true' ? 'required' : 'not_applicable';
          if (data.story_generation === undefined) {
            allErrors.push(`spec-event.yaml $.story_generation: 必須(_inputs-digest.md が design_available: ${m[1]} のため "${expected}" を期待)`);
          } else if (data.story_generation !== expected) {
            allErrors.push(`spec-event.yaml $.story_generation: "${data.story_generation}" は _inputs-digest.md の design_available: ${m[1]} と矛盾("${expected}" を期待)`);
          }
        } else if (data.story_generation === undefined) {
          // 1.5.0 の生成契約では両方が揃う。両方欠落は新規 event の生成不備として fail-closed にする
          allErrors.push('_inputs-digest.md に design_available 行が無く、spec-event.yaml にも story_generation が無い(1.5.0 以降の生成契約違反。Step1 で design_available を記録し Step5 で story_generation を書くこと)');
        } else {
          // 1.3.x〜1.4.x の event(digest はあるが design_available 行が無い)。story_generation があれば互換として警告のみ
          allWarnings.push('_inputs-digest.md に design_available 行が無い(1.4.x 以前の event なら無視してよい)');
        }
      }
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

  // --- USDM 参照検証 ---
  const usdmPath = usdmOverride ? path.resolve(usdmOverride) : findUsdmPath(eventDir);
  const usdmIndex = loadUsdmIndex(usdmPath);
  const usdmResult = validateUsdmRefs(specEventData, usdmIndex, usdmPath);
  allErrors.push(...usdmResult.errors);
  allWarnings.push(...usdmResult.warnings);

  // spec.md に「関連 USDM」節がある UC は spec-event.yaml にも usdm 参照を持つべき
  const usdmByUc = new Map(
    (Array.isArray(specEventData?.use_cases) ? specEventData.use_cases : [])
      .map(uc => [`${uc?.business}/${uc?.buc}/${uc?.uc}`, uc?.usdm])
  );
  for (const uc of ucResults) {
    const key = `${uc.business}/${uc.buc}/${uc.uc}`;
    const refs = usdmByUc.get(key);
    if (uc.hasUsdmSection && !(Array.isArray(refs) && refs.length > 0)) {
      allWarnings.push(`[${key}] spec.md に「関連 USDM」節があるが spec-event.yaml の use_cases[].usdm がありません`);
    }
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
        bucs: new Set(ucDirs.map(u => `${u.business}/${u.buc}`)).size,
        usdm_refs: usdmResult.checked
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
