#!/usr/bin/env node
/**
 * generateDatastoreMd.js
 *
 * _cross-cutting/ 配下のデータストアスキーマ YAML を統合 Markdown に変換する。
 *
 * Usage:
 *   node generateDatastoreMd.js <cross-cutting-dir> [output-md] [buc-tsv]
 *
 *   cross-cutting-dir : _cross-cutting/ ディレクトリのパス
 *   output-md         : 出力先 .md のパス（省略時は同ディレクトリに datastore-schema.md を生成）
 *   buc-tsv           : BUC.tsv のパス（省略時は ../../rdra/latest/BUC.tsv を自動探索）
 *
 * BUC.tsv から UC→業務マッピングを動的に構築し、ER図を業務単位で分割する。
 * BUC.tsv が見つからない場合は分割せずに全体ER図を出力する。
 *
 * 入力:
 *   rdb-schema.yaml            — RDB テーブル定義
 *   kvs-schema.yaml            — KVS キーパターン定義（存在する場合のみ）
 *   object-storage-schema.yaml — Object Storage パス定義（存在する場合のみ）
 *
 * npm 依存なし。Node.js 18+ 標準モジュールのみ使用。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { parseYaml } = require('./lib/yaml-parser');

// ============================================================
// YAML ファイル読み込み
// ============================================================

function loadYaml(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const text = fs.readFileSync(filePath, 'utf8');
  return parseYaml(text);
}

// ============================================================
// Markdown 生成
// ============================================================

function toArr(v) { return Array.isArray(v) ? v : (v ? [v] : []); }
function esc(s) { return s == null ? '' : String(s); }
function usedByStr(arr) { return toArr(arr).join(', '); }

// BUC.tsv から UC名→業務名マッピングを構築
// BUC.tsv フォーマット: 業務\tBUC\t...\tUC\t... （タブ区切り、1行目ヘッダー）
function loadUcBusinessMap(bucTsvPath) {
  if (!bucTsvPath || !fs.existsSync(bucTsvPath)) return null;
  const text = fs.readFileSync(bucTsvPath, 'utf8');
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return null;

  const header = lines[0].split('\t');
  const bizIdx = header.indexOf('業務');
  const ucIdx = header.indexOf('UC');
  if (bizIdx < 0 || ucIdx < 0) return null;

  const map = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    const biz = (cols[bizIdx] || '').trim();
    const uc = (cols[ucIdx] || '').trim();
    if (biz && uc && !map[uc]) {
      map[uc] = biz;
    }
  }
  return Object.keys(map).length > 0 ? map : null;
}

// UC名→業務名を解決（ucBizMap がなければ null を返す）
function resolveBusinessFromMap(ucName, ucBizMap) {
  if (!ucBizMap) return null;
  return ucBizMap[ucName] || null;
}

// テーブルが属する業務群を特定
function getTableBusinesses(table, ucBizMap) {
  if (!ucBizMap) return [];
  const bizSet = new Set();
  for (const u of toArr(table.used_by)) {
    const ucName = typeof u === 'object' ? u.uc : u;
    const biz = resolveBusinessFromMap(ucName, ucBizMap);
    if (biz) bizSet.add(biz);
  }
  return [...bizSet];
}

// ER図の関連行をパース
function parseErRelations(erDiagram) {
  if (!erDiagram) return [];
  const erLines = erDiagram.split('\n').filter(l => l.trim() && !l.trim().startsWith('erDiagram'));
  // mermaid ER 関係構文: TableA ||--o{ TableB : "label"
  // 関係記号パターン: |o, ||, }o, }|, o{, |{ 等の組み合わせ
  return erLines.map(l => {
    const match = l.trim().match(/^(\w+)\s+([|o}{]+--[|o}{]+)\s+(\w+)\s*:\s*"(.*)"/);
    return match ? { from: match[1], to: match[3], rel: match[2], label: match[4], raw: l.trim() } : null;
  }).filter(Boolean);
}

// 全体 ER 図を生成（業務分割なし）
function generateFullErDiagram(erDiagram) {
  if (!erDiagram) return '';
  const lines = [];
  lines.push('```mermaid');
  lines.push(erDiagram.trim());
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}

// 業務単位の ER 図を生成（ucBizMap が利用可能な場合のみ分割）
function generateBusinessErDiagrams(tables, erDiagram, ucBizMap) {
  if (!erDiagram) return '';

  // BUC.tsv がなければ全体ER図を出力
  if (!ucBizMap) {
    return generateFullErDiagram(erDiagram);
  }

  const relations = parseErRelations(erDiagram);
  if (relations.length === 0) {
    return generateFullErDiagram(erDiagram);
  }

  // テーブル→業務マッピング
  const tableBizMap = {};
  for (const t of tables) {
    tableBizMap[t.name] = getTableBusinesses(t, ucBizMap);
  }

  // 業務一覧
  const allBiz = new Set();
  for (const bizList of Object.values(tableBizMap)) {
    for (const b of bizList) allBiz.add(b);
  }

  // 業務が1つ以下なら分割不要
  if (allBiz.size <= 1) {
    return generateFullErDiagram(erDiagram);
  }

  const lines = [];

  // まず全体図を出力
  lines.push('#### 全体');
  lines.push('');
  lines.push(generateFullErDiagram(erDiagram));

  // 業務別に分割
  for (const biz of [...allBiz].sort()) {
    // この業務に属するテーブルを収集
    const bizTables = new Set();
    for (const [tName, bizList] of Object.entries(tableBizMap)) {
      if (bizList.includes(biz)) bizTables.add(tName);
    }

    // この業務のテーブルに関連する ER 行を抽出（from または to が業務のテーブル）
    const bizRelations = relations.filter(r => bizTables.has(r.from) || bizTables.has(r.to));
    if (bizRelations.length === 0) continue;

    lines.push(`#### ${biz}`);
    lines.push('');
    lines.push('```mermaid');
    lines.push('erDiagram');
    for (const r of bizRelations) {
      lines.push(`  ${r.raw}`);
    }
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

function generateRdbSection(data, ucBizMap) {
  if (!data || !data.tables) return '';
  const tables = toArr(data.tables);
  const lines = [];

  lines.push('## RDB');
  lines.push('');
  lines.push(`${esc(data.description)}`);
  lines.push('');

  // ER 図（先頭に配置、BUC.tsv があれば業務単位で分割）
  if (data.er_diagram) {
    lines.push('### ER 図');
    lines.push('');
    lines.push(generateBusinessErDiagrams(tables, data.er_diagram, ucBizMap));
  }

  // サマリーテーブル
  lines.push('### テーブル一覧');
  lines.push('');
  lines.push('| テーブル名 | RDRA 情報 | 説明 | カラム数 | インデックス数 | 利用 UC 数 |');
  lines.push('|-----------|----------|------|:-------:|:----------:|:--------:|');
  for (const t of tables) {
    const cols = toArr(t.columns).length;
    const idxs = toArr(t.indexes).length;
    const ucs = toArr(t.used_by).length;
    lines.push(`| ${esc(t.name)} | ${esc(t.rdra_info)} | ${esc(t.description)} | ${cols} | ${idxs} | ${ucs} |`);
  }
  lines.push('');

  // 各テーブル詳細
  for (const t of tables) {
    lines.push(`### ${esc(t.name)}`);
    lines.push('');
    lines.push(`**RDRA 情報**: ${esc(t.rdra_info)}`);
    lines.push(`**説明**: ${esc(t.description)}`);
    lines.push('');

    // カラム
    const columns = toArr(t.columns);
    if (columns.length > 0) {
      lines.push('#### カラム');
      lines.push('');
      lines.push('| カラム名 | 型 | NULL | 説明 |');
      lines.push('|---------|---|:----:|------|');
      const pk = toArr(t.primary_key);
      for (const c of columns) {
        const isPk = pk.includes(c.name);
        const name = isPk ? `**${esc(c.name)}** (PK)` : esc(c.name);
        const nullable = c.nullable ? 'YES' : 'NO';
        lines.push(`| ${name} | ${esc(c.type)} | ${nullable} | ${esc(c.description)} |`);
      }
      lines.push('');
    }

    // FK
    const fks = toArr(t.foreign_keys);
    if (fks.length > 0) {
      lines.push('#### 外部キー');
      lines.push('');
      lines.push('| カラム | 参照先テーブル | 参照先カラム | ON DELETE |');
      lines.push('|-------|-------------|------------|----------|');
      for (const fk of fks) {
        const cols = toArr(fk.columns).join(', ');
        const ref = fk.references || {};
        const refTable = esc(ref.table);
        const refCols = toArr(ref.columns).join(', ');
        lines.push(`| ${cols} | ${refTable} | ${refCols} | ${esc(fk.on_delete)} |`);
      }
      lines.push('');
    }

    // インデックス
    const indexes = toArr(t.indexes);
    if (indexes.length > 0) {
      lines.push('#### インデックス');
      lines.push('');
      lines.push('| 名前 | カラム | UNIQUE | 理由 | 利用 UC |');
      lines.push('|------|-------|:------:|------|--------|');
      for (const idx of indexes) {
        const cols = toArr(idx.columns).join(', ');
        const unique = idx.unique ? 'YES' : 'NO';
        lines.push(`| ${esc(idx.name)} | ${cols} | ${unique} | ${esc(idx.reason)} | ${usedByStr(idx.used_by)} |`);
      }
      lines.push('');
    }

    // 利用 UC
    const usedBy = toArr(t.used_by);
    if (usedBy.length > 0) {
      lines.push('#### 利用 UC');
      lines.push('');
      lines.push('| UC | 操作 |');
      lines.push('|---|------|');
      for (const u of usedBy) {
        if (typeof u === 'object') {
          lines.push(`| ${esc(u.uc)} | ${toArr(u.operations).join(', ')} |`);
        } else {
          lines.push(`| ${esc(u)} | - |`);
        }
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateKvsSection(data) {
  if (!data || !data.key_patterns) return '';
  const patterns = toArr(data.key_patterns);
  const lines = [];

  lines.push('## KVS');
  lines.push('');
  lines.push(`${esc(data.description)}`);
  lines.push('');

  lines.push('| キーパターン | 用途 | 値の型 | TTL | 利用 UC |');
  lines.push('|------------|------|-------|-----|--------|');
  for (const p of patterns) {
    lines.push(`| \`${esc(p.pattern)}\` | ${esc(p.purpose)} | ${esc(p.value_type)} | ${esc(p.ttl)} | ${usedByStr(p.used_by)} |`);
  }
  lines.push('');

  // 詳細
  for (const p of patterns) {
    lines.push(`### \`${esc(p.pattern)}\``);
    lines.push('');
    lines.push(`- **用途**: ${esc(p.purpose)}`);
    lines.push(`- **値の型**: ${esc(p.value_type)}`);
    lines.push(`- **TTL**: ${esc(p.ttl)}`);
    if (p.description) lines.push(`- **説明**: ${esc(p.description)}`);
    lines.push(`- **利用 UC**: ${usedByStr(p.used_by)}`);
    lines.push('');
  }

  return lines.join('\n');
}

function generateOsSection(data) {
  if (!data || !data.buckets) return '';
  const buckets = toArr(data.buckets);
  const lines = [];

  lines.push('## Object Storage');
  lines.push('');
  lines.push(`${esc(data.description)}`);
  lines.push('');

  for (const b of buckets) {
    lines.push(`### ${esc(b.name)}`);
    lines.push('');
    lines.push(`${esc(b.description)}`);
    lines.push('');

    const paths = toArr(b.paths);
    if (paths.length > 0) {
      lines.push('| パスパターン | Content-Type | 最大サイズ | 利用 UC |');
      lines.push('|------------|-------------|----------|--------|');
      for (const p of paths) {
        lines.push(`| \`${esc(p.pattern)}\` | ${esc(p.content_type)} | ${esc(p.max_size)} | ${usedByStr(p.used_by)} |`);
      }
      lines.push('');
    }

    if (b.lifecycle) {
      const lc = b.lifecycle;
      if (lc.expiration_days) {
        lines.push(`**ライフサイクル**: ${lc.expiration_days}日で自動削除`);
      } else {
        lines.push('**ライフサイクル**: 無期限');
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ============================================================
// メイン
// ============================================================

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node generateDatastoreMd.js <cross-cutting-dir> [output-md] [buc-tsv]');
    process.exit(2);
  }

  const crossDir = path.resolve(args[0]);
  if (!fs.existsSync(crossDir)) {
    console.error(`Directory not found: ${crossDir}`);
    process.exit(2);
  }

  const outputPath = args[1]
    ? path.resolve(args[1])
    : path.join(crossDir, 'datastore', 'datastore-schema.md');

  // BUC.tsv の探索: 引数 > 自動探索（_cross-cutting の2階層上に rdra/latest/BUC.tsv がある想定）
  let bucTsvPath = args[2] ? path.resolve(args[2]) : null;
  if (!bucTsvPath) {
    // _cross-cutting/ → docs/specs/latest/_cross-cutting/
    // rdra/latest/BUC.tsv → docs/rdra/latest/BUC.tsv
    const autoPath = path.resolve(crossDir, '..', '..', '..', 'rdra', 'latest', 'BUC.tsv');
    if (fs.existsSync(autoPath)) {
      bucTsvPath = autoPath;
    }
  }

  const ucBizMap = loadUcBusinessMap(bucTsvPath);
  if (ucBizMap) {
    console.log(`BUC.tsv loaded: ${bucTsvPath} (${Object.keys(ucBizMap).length} UC mappings)`);
  } else {
    console.log('BUC.tsv not found — ER diagram will not be split by business domain.');
  }

  // YAML 読み込み
  const rdb = loadYaml(path.join(crossDir, 'datastore', 'rdb-schema.yaml'));
  const kvs = loadYaml(path.join(crossDir, 'datastore', 'kvs-schema.yaml'));
  const os = loadYaml(path.join(crossDir, 'datastore', 'object-storage-schema.yaml'));

  if (!rdb && !kvs && !os) {
    console.error('No datastore schema files found.');
    process.exit(1);
  }

  // 統計
  const tableCount = rdb ? toArr(rdb.tables).length : 0;
  const indexCount = rdb ? toArr(rdb.tables).reduce((sum, t) => sum + toArr(t.indexes).length, 0) : 0;
  const fkCount = rdb ? toArr(rdb.tables).reduce((sum, t) => sum + toArr(t.foreign_keys).length, 0) : 0;
  const kvsCount = kvs ? toArr(kvs.key_patterns).length : 0;
  const bucketCount = os ? toArr(os.buckets).length : 0;

  // Markdown 生成
  const lines = [];
  lines.push('# データストアスキーマ');
  lines.push('');
  lines.push('## サマリー');
  lines.push('');
  lines.push('| データストア | 項目数 |');
  lines.push('|------------|:------:|');
  if (rdb) lines.push(`| RDB テーブル | ${tableCount} |`);
  if (rdb) lines.push(`| RDB インデックス | ${indexCount} |`);
  if (rdb) lines.push(`| RDB 外部キー | ${fkCount} |`);
  if (kvs) lines.push(`| KVS キーパターン | ${kvsCount} |`);
  if (os) lines.push(`| Object Storage バケット | ${bucketCount} |`);
  lines.push('');

  if (rdb) lines.push(generateRdbSection(rdb, ucBizMap));
  if (kvs) lines.push(generateKvsSection(kvs));
  if (os) lines.push(generateOsSection(os));

  // 書き出し
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');

  console.log(`Generated: ${outputPath}`);
  console.log(`  RDB: ${tableCount} tables, ${indexCount} indexes, ${fkCount} FKs`);
  if (kvs) console.log(`  KVS: ${kvsCount} key patterns`);
  if (os) console.log(`  Object Storage: ${bucketCount} buckets`);
}

main();
