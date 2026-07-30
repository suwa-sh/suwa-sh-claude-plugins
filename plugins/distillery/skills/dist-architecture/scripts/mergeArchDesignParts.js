#!/usr/bin/env node
/**
 * arch-design.parts/ 連結スクリプト
 *
 * 大出力の arch-design.yaml を一括 Write すると失敗しやすいため、
 * トップレベルセクション単位の分割ファイル（parts）を小分けに書き出し、
 * 本スクリプトで決定論的に連結して正本 YAML を生成する。
 *
 * Usage:
 *   node mergeArchDesignParts.js <parts-dir> <output-yaml> [--rm-parts]
 *   node mergeArchDesignParts.js docs/arch/events/{event_id}/arch-design.parts \
 *     docs/arch/events/{event_id}/arch-design.yaml
 *
 * 仕様:
 *   - <parts-dir> 直下の *.yaml / *.yml をファイル名昇順（数値考慮）で連結する
 *   - 各 part はトップレベルキー（行頭の裸の識別子 `key:`）を 1 つ以上含むこと
 *   - quoted トップレベルキー（`"key":` / `'key':`）はエラー
 *     （arch-design スキーマのトップレベルキーは裸の ASCII 識別子のみ。
 *     エスケープ表記の差で重複検査をすり抜けるのを防ぐため一律拒否する）
 *   - トップレベルキーが part 間/内で重複していたらエラー（連結すると不正 YAML になるため）
 *   - YAML document 区切り（--- / ...）を含む part はエラー（単一 document 前提）
 *   - parts ディレクトリは既定で保持する（validateArchDesign.js の PASS を確認してから
 *     呼び出し側が削除する。--rm-parts 指定時のみ連結成功後に即削除）
 *
 * 終了コード: 0 = 成功 / 1 = 入力不正 / 2 = 読み込みエラー
 *
 * npm 依存なし。Node.js 18+ 標準モジュールのみ使用。
 */
'use strict';

const fs = require('fs');
const path = require('path');

// YAML はキーとコロンの間の水平空白を許容する（`key :`）ため、両regexとも空白を許容して検出する
const TOP_LEVEL_KEY_RE = /^([A-Za-z_][A-Za-z0-9_-]*)[ \t]*:/;
const QUOTED_TOP_LEVEL_KEY_RE = /^(?:"(?:[^"\\]|\\.)*"|'[^']*')[ \t]*:/;

function listPartFiles(partsDir) {
  const entries = fs.readdirSync(partsDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && /\.ya?ml$/i.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

function topLevelKeys(text) {
  const keys = [];
  const quoted = [];
  for (const line of text.split('\n')) {
    const m = TOP_LEVEL_KEY_RE.exec(line);
    if (m) {
      keys.push(m[1]);
    } else if (QUOTED_TOP_LEVEL_KEY_RE.test(line)) {
      quoted.push(line.trimEnd());
    }
  }
  return { keys, quoted };
}

function mergeParts(partsDir) {
  const files = listPartFiles(partsDir);
  const errors = [];
  if (files.length === 0) {
    return { errors: [`parts ディレクトリに .yaml/.yml がありません: ${partsDir}`] };
  }

  const seen = new Map(); // top-level key -> part file
  const chunks = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(partsDir, file), 'utf8');
    if (/^(---|\.\.\.)\s*$/m.test(raw)) {
      errors.push(`${file}: YAML document 区切り(--- / ...)を含んでいます（単一 document 前提）`);
      continue;
    }
    const { keys, quoted } = topLevelKeys(raw);
    if (quoted.length > 0) {
      errors.push(
        `${file}: quoted トップレベルキーは使用できません（裸の識別子のみ）: ${quoted[0]}`
      );
      continue;
    }
    if (keys.length === 0) {
      errors.push(`${file}: トップレベルキーがありません（インデント崩れの可能性）`);
      continue;
    }
    for (const key of keys) {
      if (seen.has(key)) {
        errors.push(`${file}: トップレベルキー "${key}" が ${seen.get(key)} と重複しています`);
      } else {
        seen.set(key, file);
      }
    }
    chunks.push(raw.replace(/\s+$/u, '') + '\n');
  }

  if (errors.length > 0) return { errors };
  return { errors: [], files, keys: [...seen.keys()], text: chunks.join('') };
}

function main(argv) {
  const args = argv.filter((a) => a !== '--rm-parts');
  const rmParts = argv.includes('--rm-parts');
  const [partsDir, outputFile] = args;

  if (!partsDir || !outputFile) {
    console.error('Usage: node mergeArchDesignParts.js <parts-dir> <output-yaml> [--rm-parts]');
    return 1;
  }
  if (!fs.existsSync(partsDir) || !fs.statSync(partsDir).isDirectory()) {
    console.error(`ERROR: parts ディレクトリが存在しません: ${partsDir}`);
    return 2;
  }

  const result = mergeParts(partsDir);
  if (result.errors.length > 0) {
    for (const err of result.errors) console.error(`ERROR: ${err}`);
    return 1;
  }

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, result.text, 'utf8');
  console.log(`OK: ${result.files.length} parts -> ${outputFile}`);
  console.log(`top-level keys: ${result.keys.join(', ')}`);

  if (rmParts) {
    fs.rmSync(partsDir, { recursive: true, force: true });
    console.log(`removed: ${partsDir}`);
  } else {
    console.log(`parts kept: ${partsDir} (validateArchDesign.js の PASS 後に削除すること)`);
  }
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { listPartFiles, mergeParts, topLevelKeys };
