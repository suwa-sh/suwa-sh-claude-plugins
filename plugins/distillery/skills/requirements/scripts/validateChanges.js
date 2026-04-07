#!/usr/bin/env node
/**
 * _changes.md + 差分 TSV バリデータ
 *
 * Usage:
 *   node validateChanges.js <path-to-rdra-event-dir>
 *   node validateChanges.js docs/rdra/events/20260326_120000_add_review_feature
 *
 * 検証内容:
 *   1. _changes.md が存在し、追加/変更/削除セクションを含む
 *   2. 差分 TSV のヘッダーが既存 RDRA 形式に一致する
 *   3. _changes.md の要素名と TSV の内容に整合性がある
 *
 * 終了コード:
 *   0 = 全チェック PASS
 *   1 = バリデーションエラーあり
 *   2 = ファイル読み込みエラー
 */
'use strict';

const fs = require('fs');
const path = require('path');

// 既存 RDRA TSV の期待ヘッダー
// 既存 RDRA TSV の期待ヘッダー（先頭カラムのみチェック）
// 実際の TSV は追加カラムを持つ場合があるため、先頭の必須カラムのみ検証する
const EXPECTED_HEADERS = {
  'アクター.tsv': ['アクター群', 'アクター'],
  '外部システム.tsv': ['外部システム群', '外部システム'],
  '情報.tsv': ['コンテキスト', '情報'],
  '状態.tsv': ['コンテキスト', '状態モデル', '状態'],
  '条件.tsv': ['コンテキスト', '条件'],
  'バリエーション.tsv': ['コンテキスト', 'バリエーション'],
  'BUC.tsv': ['業務', 'BUC'],
};

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node validateChanges.js <path-to-rdra-event-dir>');
    process.exit(2);
  }

  const eventDir = path.resolve(args[0]);
  if (!fs.existsSync(eventDir)) {
    console.error(`Directory not found: ${eventDir}`);
    process.exit(2);
  }

  const errors = [];
  const warnings = [];

  // --- 1. _changes.md 検証 ---
  const changesMdPath = path.join(eventDir, '_changes.md');
  if (!fs.existsSync(changesMdPath)) {
    errors.push('_changes.md が存在しません');
  } else {
    const content = fs.readFileSync(changesMdPath, 'utf8');

    // 必須セクション
    const requiredSections = ['追加', '変更', '削除'];
    for (const section of requiredSections) {
      if (!content.includes(`## ${section}`)) {
        errors.push(`_changes.md に "## ${section}" セクションがありません`);
      }
    }

    // event_id 行
    if (!content.includes('event_id:')) {
      errors.push('_changes.md に event_id が記載されていません');
    }

    // 元USDM 行
    if (!content.includes('元USDM:')) {
      warnings.push('_changes.md に 元USDM が記載されていません');
    }

    // 生成日時 行
    if (!content.includes('生成日時:')) {
      warnings.push('_changes.md に 生成日時 が記載されていません');
    }

    // モデル種別の表記チェック（英語名ではなく日本語名であること）
    const englishModelNames = ['information', 'actor', 'state', 'condition', 'variation', 'external_system'];
    for (const eng of englishModelNames) {
      const regex = new RegExp(`- ${eng}:`, 'i');
      if (regex.test(content)) {
        errors.push(`_changes.md でモデル種別に英語名 "${eng}" が使われています。日本語名（情報、アクター、状態、条件、バリエーション、外部システム）を使用してください`);
      }
    }
  }

  // --- 2. 差分 TSV ヘッダー検証 ---
  const tsvFiles = fs.readdirSync(eventDir).filter(f => f.endsWith('.tsv'));

  if (tsvFiles.length === 0) {
    errors.push('差分 TSV ファイルが1つも存在しません');
  }

  for (const tsvFile of tsvFiles) {
    const tsvPath = path.join(eventDir, tsvFile);
    const content = fs.readFileSync(tsvPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim() !== '');

    if (lines.length === 0) {
      errors.push(`${tsvFile}: ファイルが空です`);
      continue;
    }

    // ヘッダー行チェック
    const header = lines[0].split('\t');
    const expected = EXPECTED_HEADERS[tsvFile];

    if (expected) {
      // 期待ヘッダーの先頭カラムが一致するか（TSVは追加カラムを持つ場合がある）
      for (let i = 0; i < expected.length; i++) {
        if (i >= header.length) {
          errors.push(`${tsvFile}: ヘッダーにカラム "${expected[i]}" がありません（${i + 1}列目）`);
        } else if (header[i].trim() !== expected[i]) {
          errors.push(`${tsvFile}: ヘッダー ${i + 1}列目が "${header[i].trim()}" ですが、"${expected[i]}" を期待しています`);
        }
      }
    } else {
      // 未知のTSVファイル名
      warnings.push(`${tsvFile}: RDRA標準ファイル名に一致しません（アクター.tsv, 外部システム.tsv, 情報.tsv, 状態.tsv, 条件.tsv, バリエーション.tsv, BUC.tsv のいずれか）`);
    }

    // データ行が存在するか
    if (lines.length < 2) {
      warnings.push(`${tsvFile}: データ行がありません（ヘッダーのみ）`);
    }

    // タブ区切りの一貫性チェック
    const headerColCount = header.length;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('\t');
      if (cols.length !== headerColCount) {
        warnings.push(`${tsvFile}: ${i + 1}行目のカラム数(${cols.length})がヘッダー(${headerColCount})と一致しません`);
        break; // 最初の不一致のみ報告
      }
    }
  }

  // --- 3. _changes.md と TSV の整合性 ---
  if (fs.existsSync(changesMdPath)) {
    const content = fs.readFileSync(changesMdPath, 'utf8');

    // 追加セクションに記載された情報が TSV に存在するか
    const addSection = extractSection(content, '追加');
    if (addSection) {
      const addedModels = extractModelEntries(addSection);
      for (const { modelType, elementName } of addedModels) {
        const tsvFile = modelTypeToTsvFile(modelType);
        if (tsvFile && !tsvFiles.includes(tsvFile)) {
          warnings.push(`_changes.md の追加セクションに "${modelType}: ${elementName}" がありますが、${tsvFile} が存在しません`);
        }
      }
    }
  }

  // --- 結果出力 ---
  if (errors.length === 0 && warnings.length === 0) {
    console.log(`PASS: ${eventDir}`);
    console.log(`  TSV files: ${tsvFiles.length}`);
    console.log(`  Files: ${tsvFiles.join(', ')}`);
    process.exit(0);
  } else if (errors.length === 0) {
    console.log(`PASS (with warnings): ${eventDir}`);
    console.log(`  TSV files: ${tsvFiles.length}`);
    for (const w of warnings) {
      console.log(`  WARN: ${w}`);
    }
    process.exit(0);
  } else {
    console.log(`FAIL: ${eventDir}`);
    console.log(`  ${errors.length} error(s), ${warnings.length} warning(s):`);
    for (const e of errors) {
      console.log(`  ERROR: ${e}`);
    }
    for (const w of warnings) {
      console.log(`  WARN: ${w}`);
    }
    process.exit(1);
  }
}

function extractSection(content, sectionName) {
  const regex = new RegExp(`## ${sectionName}\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = content.match(regex);
  return match ? match[1] : null;
}

function extractModelEntries(sectionText) {
  const entries = [];
  const lines = sectionText.split('\n');
  for (const line of lines) {
    const match = line.match(/^- (.+?): (.+?)(?:\（|$)/);
    if (match) {
      entries.push({ modelType: match[1].trim(), elementName: match[2].trim() });
    }
  }
  return entries;
}

function modelTypeToTsvFile(modelType) {
  const map = {
    '情報': '情報.tsv',
    'アクター': 'アクター.tsv',
    '外部システム': '外部システム.tsv',
    '状態': '状態.tsv',
    '条件': '条件.tsv',
    'バリエーション': 'バリエーション.tsv',
    'BUC': 'BUC.tsv',
  };
  return map[modelType] || null;
}

main();
