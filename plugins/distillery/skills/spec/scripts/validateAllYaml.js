#!/usr/bin/env node
/**
 * 全 YAML 一括構文チェック
 *
 * Usage:
 *   node validateAllYaml.js <path-to-spec-event-dir>
 *   node validateAllYaml.js docs/specs/events/20260329_100000_spec_generation
 *   node validateAllYaml.js docs/specs/events/20260329_100000_spec_generation --json
 *
 * 検証内容:
 *   1. 指定ディレクトリ内の全 .yaml ファイルを再帰的に収集
 *   2. 各ファイルを parseYaml でパースし、エラーがないことを確認
 *   3. パース結果が null/undefined でないことを確認
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
// YAML ファイル再帰収集
// ---------------------------------------------------------------------------

function collectYamlFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectYamlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.yaml')) {
      results.push(fullPath);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const jsonFlag = args.includes('--json');
  const nonFlagArgs = args.filter(a => !a.startsWith('--'));

  if (nonFlagArgs.length === 0) {
    console.error('Usage: node validateAllYaml.js <path-to-spec-event-dir> [--json]');
    process.exit(2);
  }

  const eventDir = path.resolve(nonFlagArgs[0]);
  if (!fs.existsSync(eventDir)) {
    console.error(`Directory not found: ${eventDir}`);
    process.exit(2);
  }

  const allErrors = [];
  const allWarnings = [];
  const passed = [];
  const failed = [];

  // --- 全 YAML ファイルを再帰収集 ---
  const yamlFiles = collectYamlFiles(eventDir);

  if (yamlFiles.length === 0) {
    allWarnings.push('YAML ファイルが1つも見つかりません');
  }

  // --- 各ファイルをパース ---
  for (const filePath of yamlFiles) {
    const relPath = path.relative(eventDir, filePath);
    const yamlText = fs.readFileSync(filePath, 'utf8');

    try {
      const data = parseYaml(yamlText);
      if (data === null || data === undefined) {
        allErrors.push(`${relPath}: パース結果が null/undefined です`);
        failed.push(relPath);
      } else {
        passed.push(relPath);
      }
    } catch (e) {
      allErrors.push(`${relPath}: YAML parse error: ${e.message}`);
      failed.push(relPath);
    }
  }

  // --- 結果出力 ---
  if (jsonFlag) {
    const result = {
      status: allErrors.length === 0 ? 'pass' : 'fail',
      dir: eventDir,
      total: yamlFiles.length,
      passed: passed.length,
      failed: failed.length,
      errors: allErrors,
      warnings: allWarnings,
      files: {
        passed,
        failed
      }
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(allErrors.length === 0 ? 0 : 1);
  }

  if (allErrors.length === 0) {
    console.log(`PASS${allWarnings.length > 0 ? ' (with warnings)' : ''}: ${eventDir}`);
    console.log(`  YAML files: ${yamlFiles.length} (all parsed successfully)`);
    for (const f of passed) {
      console.log(`  OK: ${f}`);
    }
    if (allWarnings.length > 0) {
      for (const w of allWarnings) {
        console.log(`  WARN: ${w}`);
      }
    }
  } else {
    console.log(`FAIL: ${eventDir}`);
    console.log(`  YAML files: ${yamlFiles.length} (${passed.length} passed, ${failed.length} failed)`);
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
