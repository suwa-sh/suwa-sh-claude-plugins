#!/usr/bin/env node
/**
 * generateCoverageReport.js
 *
 * RDRA モデルと NFR グレードに対するアーキテクチャ設計の要件網羅率レポートを生成する。
 *
 * Usage:
 *   node generateCoverageReport.js <rdra-dir> <nfr-yaml> <arch-yaml> [output-md]
 *
 *   rdra-dir  : RDRA latest ディレクトリ（例: docs/rdra/latest/）
 *   nfr-yaml  : NFR グレード YAML（例: docs/nfr/latest/nfr-grade.yaml）
 *   arch-yaml : アーキテクチャ設計 YAML（例: docs/arch/latest/arch-design.yaml）
 *   output-md : 出力先（省略時は arch-yaml と同じディレクトリに coverage-report.md）
 *
 * 終了コード:
 *   0 = 成功
 *   2 = エラー
 *
 * npm 依存なし。Node.js 18+ 標準モジュールのみ使用。
 */
'use strict';

const fs = require('fs');
const path = require('path');

// ===========================================================================
// 簡易 YAML パーサー（外部依存なし）
// ===========================================================================

function parseYaml(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  return parseObject(lines, 0, 0).value;
}

function parseObject(lines, index, indent) {
  const obj = {};
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === '' || line.trim().startsWith('#')) {
      index++;
      continue;
    }
    const currentIndent = line.search(/\S/);
    if (currentIndent < indent) break;
    if (currentIndent > indent && Object.keys(obj).length > 0) break;

    const match = line.match(/^(\s*)([^:\s][^:]*?)\s*:\s*(.*)/);
    if (!match) {
      index++;
      continue;
    }

    const key = match[2].replace(/^["']|["']$/g, '');
    const valueStr = match[3].trim();

    if (valueStr === '' || valueStr === '|' || valueStr === '>') {
      if (index + 1 < lines.length) {
        const nextLine = lines[index + 1];
        const nextTrim = nextLine.trim();
        const nextIndent = nextLine.search(/\S/);
        if (nextIndent > currentIndent && nextTrim.startsWith('- ')) {
          const result = parseArray(lines, index + 1, nextIndent);
          obj[key] = result.value;
          index = result.index;
          continue;
        } else if (nextIndent > currentIndent) {
          if (valueStr === '|' || valueStr === '>') {
            const result = parseBlockScalar(lines, index + 1, currentIndent);
            obj[key] = result.value;
            index = result.index;
            continue;
          }
          const result = parseObject(lines, index + 1, nextIndent);
          obj[key] = result.value;
          index = result.index;
          continue;
        }
      }
      obj[key] = '';
      index++;
    } else if (valueStr.startsWith('"') || valueStr.startsWith("'")) {
      obj[key] = valueStr.replace(/^["']|["']$/g, '');
      index++;
    } else if (valueStr === 'true') {
      obj[key] = true;
      index++;
    } else if (valueStr === 'false') {
      obj[key] = false;
      index++;
    } else if (valueStr === 'null' || valueStr === '~') {
      obj[key] = null;
      index++;
    } else if (valueStr === '[]') {
      obj[key] = [];
      index++;
    } else if (/^-?[0-9]+$/.test(valueStr)) {
      obj[key] = parseInt(valueStr, 10);
      index++;
    } else {
      obj[key] = valueStr;
      index++;
    }
  }
  return { value: obj, index };
}

function parseArray(lines, index, indent) {
  const arr = [];
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === '' || line.trim().startsWith('#')) {
      index++;
      continue;
    }
    const currentIndent = line.search(/\S/);
    if (currentIndent < indent) break;

    const trimmed = line.trim();
    if (!trimmed.startsWith('- ')) {
      if (currentIndent <= indent) break;
      index++;
      continue;
    }

    const afterDash = trimmed.slice(2).trim();

    if (afterDash.startsWith('"') || afterDash.startsWith("'")) {
      arr.push(afterDash.replace(/^["']|["']$/g, ''));
      index++;
      continue;
    }

    const kvMatch = afterDash.match(/^([^:\s][^:]*?)\s*:\s*(.*)/);
    if (kvMatch) {
      const objIndent = currentIndent + 2;
      const tempLines = [' '.repeat(objIndent) + afterDash];

      let nextIdx = index + 1;
      while (nextIdx < lines.length) {
        const nextLine = lines[nextIdx];
        if (nextLine.trim() === '' || nextLine.trim().startsWith('#')) {
          tempLines.push(nextLine);
          nextIdx++;
          continue;
        }
        const nextInd = nextLine.search(/\S/);
        if (nextInd <= currentIndent) break;
        tempLines.push(nextLine);
        nextIdx++;
      }

      const result = parseObject(tempLines, 0, objIndent);
      arr.push(result.value);
      index = nextIdx;
      continue;
    }

    if (afterDash !== '') {
      arr.push(afterDash.replace(/^["']|["']$/g, ''));
      index++;
      continue;
    }

    index++;
  }
  return { value: arr, index };
}

function parseBlockScalar(lines, index, parentIndent) {
  const parts = [];
  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.replace(/\s+$/, '');
    if (trimmed === '') { parts.push(''); index++; continue; }
    const indent = line.search(/\S/);
    if (indent <= parentIndent) break;
    parts.push(trimmed.trim());
    index++;
  }
  return { value: parts.join('\n').trim(), index };
}

// ===========================================================================
// TSV 読み込み
// ===========================================================================

function readTsv(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split('\n').filter(l => l.trim() !== '');
  if (lines.length <= 1) return [];
  const header = lines[0].split('\t');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    const row = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = (cols[j] || '').trim();
    }
    rows.push(row);
  }
  return rows;
}

function uniqueValues(rows, key) {
  const set = new Set();
  for (const row of rows) {
    const v = row[key];
    if (v) set.add(v);
  }
  return [...set];
}

// ===========================================================================
// RDRA 要素の読み込み
// ===========================================================================

function loadRdraElements(rdraDir) {
  // アクター（2列目）
  const actorRows = readTsv(path.join(rdraDir, 'アクター.tsv'));
  const actors = uniqueValues(actorRows, 'アクター');

  // 外部システム（2列目）
  const extRows = readTsv(path.join(rdraDir, '外部システム.tsv'));
  const externalSystems = uniqueValues(extRows, '外部システム');

  // 情報（2列目）
  const infoRows = readTsv(path.join(rdraDir, '情報.tsv'));
  const infos = uniqueValues(infoRows, '情報');

  // 状態モデル（2列目、ユニーク）
  const stateRows = readTsv(path.join(rdraDir, '状態.tsv'));
  const stateModels = uniqueValues(stateRows, '状態モデル');

  // 条件（2列目）
  const condRows = readTsv(path.join(rdraDir, '条件.tsv'));
  const conditions = uniqueValues(condRows, '条件');

  // BUC（1列目: 業務、2列目: BUC）
  const bucRows = readTsv(path.join(rdraDir, 'BUC.tsv'));
  const businesses = uniqueValues(bucRows, '業務');
  const bucs = uniqueValues(bucRows, 'BUC');

  // BUC名 → 業務名 のマッピング
  const bucToBusiness = {};
  for (const row of bucRows) {
    const biz = row['業務'];
    const buc = row['BUC'];
    if (biz && buc) {
      bucToBusiness[buc] = biz;
    }
  }

  return { actors, externalSystems, infos, stateModels, conditions, businesses, bucs, bucToBusiness };
}

// ===========================================================================
// NFR 重要メトリクスの読み込み
// ===========================================================================

const NFR_CATEGORY_NAMES = {
  'A': 'A. 可用性',
  'B': 'B. 性能・拡張性',
  'C': 'C. 運用・保守性',
  'D': 'D. 移行性',
  'E': 'E. セキュリティ',
  'F': 'F. 環境',
};

function loadImportantNfrMetrics(nfrData) {
  const result = {}; // categoryId -> [ { id, name, grade } ]
  for (const cat of (nfrData.categories || [])) {
    const catId = cat.id;
    if (!result[catId]) result[catId] = [];
    for (const sub of (cat.subcategories || [])) {
      for (const item of (sub.items || [])) {
        for (const metric of (item.metrics || [])) {
          if (metric.important === true) {
            result[catId].push({
              id: metric.id,
              name: metric.name,
              grade: metric.grade,
            });
          }
        }
      }
    }
  }
  return result;
}

// ===========================================================================
// arch-design.yaml から source_model を収集
// ===========================================================================

function collectSourceModels(archData) {
  // { id, source_model } のリストを収集
  const entries = [];

  const sa = archData.system_architecture || {};
  const aa = archData.app_architecture || {};
  const da = archData.data_architecture || {};

  // system_architecture.tiers[].policies/rules
  for (const tier of (sa.tiers || [])) {
    for (const p of (tier.policies || [])) {
      if (p.source_model) entries.push({ id: p.id, source_model: p.source_model });
    }
    for (const r of (tier.rules || [])) {
      if (r.source_model) entries.push({ id: r.id, source_model: r.source_model });
    }
  }

  // system_architecture.cross_tier_policies/rules
  for (const p of (sa.cross_tier_policies || [])) {
    if (p.source_model) entries.push({ id: p.id, source_model: p.source_model });
  }
  for (const r of (sa.cross_tier_rules || [])) {
    if (r.source_model) entries.push({ id: r.id, source_model: r.source_model });
  }

  // app_architecture.tier_layers[]
  for (const tl of (aa.tier_layers || [])) {
    for (const layer of (tl.layers || [])) {
      for (const p of (layer.policies || [])) {
        if (p.source_model) entries.push({ id: p.id, source_model: p.source_model });
      }
      for (const r of (layer.rules || [])) {
        if (r.source_model) entries.push({ id: r.id, source_model: r.source_model });
      }
    }
    for (const p of (tl.cross_layer_policies || [])) {
      if (p.source_model) entries.push({ id: p.id, source_model: p.source_model });
    }
    for (const r of (tl.cross_layer_rules || [])) {
      if (r.source_model) entries.push({ id: r.id, source_model: r.source_model });
    }
  }

  return entries;
}

function collectDataArchInfo(archData) {
  const da = archData.data_architecture || {};
  const entities = da.entities || [];
  const storageMappings = da.storage_mapping || [];
  return { entities, storageMappings };
}

// ===========================================================================
// マッチング
// ===========================================================================

function matchRdraActors(actors, sourceEntries) {
  const results = {};
  for (const name of actors) {
    results[name] = { covered: false, refs: [] };
  }
  for (const entry of sourceEntries) {
    const sm = entry.source_model;
    for (const name of actors) {
      if (sm.includes(`アクター: ${name}`) || sm.includes(name)) {
        results[name].covered = true;
        if (!results[name].refs.includes(entry.id)) {
          results[name].refs.push(entry.id);
        }
      }
    }
  }
  return results;
}

function matchRdraExternalSystems(externalSystems, sourceEntries) {
  const results = {};
  for (const name of externalSystems) {
    results[name] = { covered: false, refs: [] };
  }
  for (const entry of sourceEntries) {
    const sm = entry.source_model;
    for (const name of externalSystems) {
      if (sm.includes(`外部システム: ${name}`) || sm.includes(name)) {
        results[name].covered = true;
        if (!results[name].refs.includes(entry.id)) {
          results[name].refs.push(entry.id);
        }
      }
    }
  }
  return results;
}

function matchRdraInfos(infos, sourceEntries, entities, storageMappings) {
  const results = {};
  for (const name of infos) {
    results[name] = { covered: false, refs: [], entityId: null, storageType: null };
  }

  // source_info マッチ
  for (const entity of entities) {
    const si = entity.source_info || '';
    for (const name of infos) {
      if (si.includes(`情報: ${name}`)) {
        results[name].covered = true;
        results[name].entityId = entity.id;
        // storage_mapping から storage_type を取得（最初にヒットした rdb を優先）
        for (const sm of storageMappings) {
          if (sm.entity_id === entity.id) {
            if (!results[name].storageType || sm.storage_type === 'rdb') {
              results[name].storageType = sm.storage_type;
            }
          }
        }
      }
    }
  }

  // source_model マッチ
  for (const entry of sourceEntries) {
    const sm = entry.source_model;
    for (const name of infos) {
      if (sm.includes(`情報: ${name}`) || sm.includes(`情報: ${name}`)) {
        results[name].covered = true;
        if (!results[name].refs.includes(entry.id)) {
          results[name].refs.push(entry.id);
        }
      }
    }
  }
  return results;
}

function matchRdraStateModels(stateModels, sourceEntries) {
  const results = {};
  for (const name of stateModels) {
    results[name] = { covered: false, refs: [] };
  }
  for (const entry of sourceEntries) {
    const sm = entry.source_model;
    for (const name of stateModels) {
      // "状態: オーナー, 会議室, 予約" のようなカンマ区切りリストにも対応
      if (sm.includes(`状態モデル「${name}」`)) {
        results[name].covered = true;
        if (!results[name].refs.includes(entry.id)) {
          results[name].refs.push(entry.id);
        }
        continue;
      }
      // "状態: " の後のカンマ区切りリストを解析
      const stateMatch = sm.match(/状態:\s*([^,]+(?:,\s*[^,]+)*)/g);
      if (stateMatch) {
        for (const seg of stateMatch) {
          const afterColon = seg.replace(/^状態:\s*/, '');
          const names = afterColon.split(/,\s*/);
          for (const n of names) {
            if (n.trim() === name) {
              results[name].covered = true;
              if (!results[name].refs.includes(entry.id)) {
                results[name].refs.push(entry.id);
              }
            }
          }
        }
      }
    }
  }
  return results;
}

function matchRdraConditions(conditions, sourceEntries) {
  const results = {};
  for (const name of conditions) {
    results[name] = { covered: false, refs: [] };
  }
  for (const entry of sourceEntries) {
    const sm = entry.source_model;
    for (const name of conditions) {
      if (sm.includes(`条件: ${name}`) || sm.includes(name)) {
        results[name].covered = true;
        if (!results[name].refs.includes(entry.id)) {
          results[name].refs.push(entry.id);
        }
      }
    }
  }
  return results;
}

function matchRdraBucs(businesses, bucs, sourceEntries, bucToBusiness) {
  const results = {};
  for (const name of businesses) {
    results[name] = { covered: false, refs: [] };
  }
  for (const entry of sourceEntries) {
    const sm = entry.source_model;
    // 業務名で直接マッチ
    for (const name of businesses) {
      if (sm.includes(name)) {
        results[name].covered = true;
        if (!results[name].refs.includes(entry.id)) {
          results[name].refs.push(entry.id);
        }
      }
    }
    // BUC フロー名でマッチ → 属する業務をカバー
    for (const bucName of bucs) {
      if (sm.includes(`BUC: ${bucName}`) || sm.includes(bucName)) {
        const bizName = bucToBusiness[bucName];
        if (bizName && results[bizName]) {
          results[bizName].covered = true;
          if (!results[bizName].refs.includes(entry.id)) {
            results[bizName].refs.push(entry.id);
          }
        }
      }
    }
    // "BUC: 6業務" のような総称パターンへの対応
    const bucCountMatch = sm.match(/BUC:\s*(\d+)業務/);
    if (bucCountMatch) {
      // 全業務をカバー扱い
      for (const name of businesses) {
        results[name].covered = true;
        if (!results[name].refs.includes(entry.id)) {
          results[name].refs.push(entry.id);
        }
      }
    }
  }

  return results;
}

function matchNfrMetrics(nfrMetricsByCategory, sourceEntries) {
  // categoryId -> [ { id, name, grade, covered, refs } ]
  const results = {};
  for (const [catId, metrics] of Object.entries(nfrMetricsByCategory)) {
    results[catId] = metrics.map(m => ({
      ...m,
      covered: false,
      refs: [],
    }));
  }

  // source_model からすべての NFR ID 参照を抽出する
  // パターン: "NFR X.Y.Z.W" や "X.Y.Z.W" の形式
  for (const entry of sourceEntries) {
    const sm = entry.source_model;
    // NFR ID パターンを抽出: "NFR " の後に続く ID、またはカンマ区切りの ID リスト
    // 例: "NFR E.5.1.1", "NFR A.2.1.1, NFR A.2.5.1", "NFR C.1.2.1, NFR A.4.1.1"
    const nfrIds = extractNfrIds(sm);

    for (const [catId, metrics] of Object.entries(results)) {
      for (const metric of metrics) {
        for (const nfrId of nfrIds) {
          // 完全一致
          if (nfrId === metric.id) {
            metric.covered = true;
            if (!metric.refs.includes(entry.id)) {
              metric.refs.push(entry.id);
            }
            break;
          }
          // 前方一致: nfrId が metric.id のプレフィックスである場合
          // 例: nfrId = "E.5" は metric.id = "E.5.1.1" をカバー
          if (metric.id.startsWith(nfrId + '.')) {
            metric.covered = true;
            if (!metric.refs.includes(entry.id)) {
              metric.refs.push(entry.id);
            }
            break;
          }
        }
      }
    }
  }

  return results;
}

function extractNfrIds(sourceModel) {
  const ids = [];
  // "NFR X.Y.Z" パターンを抽出（"NFR " プレフィックス付き）
  const nfrPattern = /NFR\s+([A-F]\.\d+(?:\.\d+)*)/g;
  let match;
  while ((match = nfrPattern.exec(sourceModel)) !== null) {
    ids.push(match[1]);
  }
  // "NFR" なしの独立した ID パターンも抽出（ただし文脈的に NFR を指している場合）
  // source_model に "NFR" が含まれない場合でも、"A.1.1.1" のようなパターンは NFR ID の可能性がある
  // ただし誤マッチを避けるため、明示的に "NFR" プレフィックスがある場合のみ抽出する
  return ids;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ===========================================================================
// ストレージタイプのラベル
// ===========================================================================

const STORAGE_TYPE_LABELS = {
  rdb: 'RDB',
  nosql: 'NoSQL',
  cache: 'キャッシュ',
  file: 'ファイル',
  search: '検索エンジン',
};

// ===========================================================================
// レポート生成
// ===========================================================================

function generateReport(archData, rdra, nfrMetricsByCategory, sourceEntries, dataArch) {
  const { entities, storageMappings } = dataArch;

  // RDRA マッチング
  const actorResults = matchRdraActors(rdra.actors, sourceEntries);
  const extResults = matchRdraExternalSystems(rdra.externalSystems, sourceEntries);
  const infoResults = matchRdraInfos(rdra.infos, sourceEntries, entities, storageMappings);
  const stateResults = matchRdraStateModels(rdra.stateModels, sourceEntries);
  const condResults = matchRdraConditions(rdra.conditions, sourceEntries);
  const bucResults = matchRdraBucs(rdra.businesses, rdra.bucs, sourceEntries, rdra.bucToBusiness);

  // NFR マッチング
  const nfrResults = matchNfrMetrics(nfrMetricsByCategory, sourceEntries);

  // サマリ計算
  function countCoverage(results) {
    const entries = Object.values(results);
    const total = entries.length;
    const covered = entries.filter(e => e.covered).length;
    return { total, covered };
  }

  function countNfrCoverage(metrics) {
    const total = metrics.length;
    const covered = metrics.filter(m => m.covered).length;
    return { total, covered };
  }

  const rdraCategories = [
    { name: 'アクター', ...countCoverage(actorResults) },
    { name: '外部システム', ...countCoverage(extResults) },
    { name: '情報', ...countCoverage(infoResults) },
    { name: '状態モデル', ...countCoverage(stateResults) },
    { name: '条件', ...countCoverage(condResults) },
    { name: 'BUC（業務）', ...countCoverage(bucResults) },
  ];

  const nfrCategories = [];
  for (const catId of ['A', 'B', 'C', 'D', 'E', 'F']) {
    const metrics = nfrResults[catId] || [];
    const cov = countNfrCoverage(metrics);
    nfrCategories.push({ name: NFR_CATEGORY_NAMES[catId] || catId, ...cov });
  }

  const rdraTotal = rdraCategories.reduce((s, c) => s + c.total, 0);
  const rdraCovered = rdraCategories.reduce((s, c) => s + c.covered, 0);
  const nfrTotal = nfrCategories.reduce((s, c) => s + c.total, 0);
  const nfrCovered = nfrCategories.reduce((s, c) => s + c.covered, 0);

  function pct(covered, total) {
    if (total === 0) return '- ';
    return Math.round((covered / total) * 100) + '%';
  }

  // ==== Domain Architecture coverage ====
  const domain = archData.domain_architecture;
  let domainMetrics = null;
  if (domain) {
    const subdomains = domain.subdomains || [];
    const bcs = domain.bounded_contexts || [];
    const contextMap = domain.context_map || [];
    const aggregates = domain.aggregate_hypotheses || [];

    // Subdomain coverage: BUC 総数 / SD に割当された BUC 数
    const allBucNames = new Set();
    for (const bucs of Object.values(rdra.bucs || {})) {
      for (const b of bucs) if (b.name) allBucNames.add(b.name);
    }
    // BUC.tsv の business 別 BUC リストとは別に rdra.bucs はオブジェクト {business: [{name, ...}]} 構造
    // related_buc_ids には BUC ID（例: BUC-001）が入る想定。本実装では BUC ID は RDRA 側に明示的に無いため
    // 関連付け検証は「全 SD が related_buc_ids に何かしらを持っている」のチェックに留める
    const bucsAssignedToSd = new Set();
    for (const sd of subdomains) {
      for (const bucId of (sd.related_buc_ids || [])) bucsAssignedToSd.add(bucId);
    }
    const bucTotal = allBucNames.size;
    // BUC ID 体系が将来確定するまで、SD への BUC 割当が「最低 1 件以上ある」SD の割合で代用
    const sdsWithBucs = subdomains.filter(sd => (sd.related_buc_ids || []).length > 0).length;
    const subdomainCoverage = subdomains.length > 0
      ? { total: subdomains.length, covered: sdsWithBucs }
      : { total: 0, covered: 0 };

    // BC coverage: entity 総数 / BC.owned_entity_ids に含まれる entity 数
    const allEntityIds = new Set((entities || []).map(e => e.id).filter(Boolean));
    const ownedEntities = new Set();
    for (const bc of bcs) {
      for (const eid of (bc.owned_entity_ids || [])) ownedEntities.add(eid);
    }
    const bcCoverage = {
      total: allEntityIds.size,
      covered: Array.from(ownedEntities).filter(eid => allEntityIds.has(eid)).length,
    };

    // Context Map completeness: BC が 2 以上あれば context_map に最低 1 件期待
    const contextMapCompleteness = bcs.length >= 2
      ? { total: 1, covered: contextMap.length > 0 ? 1 : 0 }
      : { total: 0, covered: 0 };

    // Core 投資集中度: Core SD 数 / 全 SD 数
    const coreCount = subdomains.filter(sd => sd.type === 'core').length;

    domainMetrics = {
      subdomains, bcs, contextMap, aggregates,
      bucTotal, subdomainCoverage, bcCoverage, contextMapCompleteness, coreCount,
    };
  }

  const lines = [];

  // ヘッダー
  lines.push('# アーキテクチャ設計 要件網羅率レポート');
  lines.push('');
  lines.push(`- arch-design: ${archData.event_id || 'unknown'}`);
  // 生成日時は決定論性のため arch-design.yaml の created_at を使う
  // （`new Date()` を使うと毎回 baseline が変わるため）
  const generatedAt = archData.created_at || '-';
  lines.push(`- arch-design 作成日時: ${generatedAt}`);
  lines.push('');

  // ==== RDRA サマリ ====
  lines.push('## 網羅率サマリ');
  lines.push('');
  lines.push('### RDRA モデル網羅率');
  lines.push('');
  lines.push('| カテゴリ | 対象数 | カバー数 | 網羅率 |');
  lines.push('|---------|:------:|:-------:|:-----:|');
  for (const c of rdraCategories) {
    lines.push(`| ${c.name} | ${c.total} | ${c.covered} | ${pct(c.covered, c.total)} |`);
  }
  lines.push(`| **合計** | **${rdraTotal}** | **${rdraCovered}** | **${pct(rdraCovered, rdraTotal)}** |`);
  lines.push('');

  // ==== Domain Architecture 設計密度 ====
  // 注: これらは「網羅率（coverage）」ではなく「設計密度（design density）/ ヒューリスティクス指標」。
  // RDRA 要素 ID と一対一でマッチングできるのは entity (data_architecture.entities) のみのため、
  // BUC や Subdomain の coverage は厳密には算出できない。本指標は「設計の健全性ヒント」として扱う。
  if (domainMetrics) {
    lines.push('### ドメイン設計密度（ヒューリスティクス指標）');
    lines.push('');
    lines.push('> 注: これらは厳密な「網羅率」ではなく、設計が一定の密度・健全性を持つかを判定するヒューリスティクス指標です。RDRA 要素 ID との厳密な照合が可能なのは entity 割当のみ。');
    lines.push('');
    lines.push('| メトリクス | 種別 | 分母 | 分子 | 値 |');
    lines.push('|---------|:----:|:------:|:-------:|:-----:|');
    lines.push(`| BC への entity 割当率 | **coverage**（厳密）| ${domainMetrics.bcCoverage.total} | ${domainMetrics.bcCoverage.covered} | ${pct(domainMetrics.bcCoverage.covered, domainMetrics.bcCoverage.total)} |`);
    lines.push(`| Subdomain に BUC 関連付けられている率 | ヒューリスティクス | ${domainMetrics.subdomainCoverage.total} | ${domainMetrics.subdomainCoverage.covered} | ${pct(domainMetrics.subdomainCoverage.covered, domainMetrics.subdomainCoverage.total)} |`);
    lines.push(`| Context Map の存在（BC>=2 なら期待）| ヒューリスティクス | ${domainMetrics.contextMapCompleteness.total} | ${domainMetrics.contextMapCompleteness.covered} | ${pct(domainMetrics.contextMapCompleteness.covered, domainMetrics.contextMapCompleteness.total)} |`);
    const coreRatio = domainMetrics.subdomains.length > 0
      ? Math.round((domainMetrics.coreCount / domainMetrics.subdomains.length) * 100) + '%'
      : '- ';
    lines.push(`| Core SD 比率（投資集中度）| 設計密度比率 | ${domainMetrics.subdomains.length} | ${domainMetrics.coreCount} | ${coreRatio} |`);
    lines.push('');
    lines.push('凡例:');
    lines.push('- **coverage**: 分母の各要素を分子で網羅できているかを表す厳密な指標');
    lines.push('- **ヒューリスティクス**: 設計の健全性ヒント。100% でも設計の正しさは保証されない');
    lines.push('- **設計密度比率**: 設計判断の比率指標（網羅性ではなく投資配分・分布を表す）');
    lines.push('');
    lines.push(`- Subdomain: ${domainMetrics.subdomains.length} 件 / BC: ${domainMetrics.bcs.length} 件 / Context Map: ${domainMetrics.contextMap.length} 件 / Aggregate 仮説: ${domainMetrics.aggregates.length} 件`);
    lines.push('');
  } else {
    lines.push('### ドメイン設計密度（ヒューリスティクス指標）');
    lines.push('');
    lines.push('- `domain_architecture` セクションなし（既存スナップショットの後方互換、または初期構築前の状態）');
    lines.push('');
  }

  // ==== NFR サマリ ====
  lines.push('### NFR グレード網羅率（重要メトリクスのみ）');
  lines.push('');
  lines.push('| カテゴリ | 対象数 | カバー数 | 網羅率 |');
  lines.push('|---------|:------:|:-------:|:-----:|');
  for (const c of nfrCategories) {
    lines.push(`| ${c.name} | ${c.total} | ${c.covered} | ${pct(c.covered, c.total)} |`);
  }
  lines.push(`| **合計** | **${nfrTotal}** | **${nfrCovered}** | **${pct(nfrCovered, nfrTotal)}** |`);
  lines.push('');

  // ==== RDRA 対応状況 ====
  lines.push('## RDRA モデル 対応状況');
  lines.push('');

  // アクター
  lines.push('### アクター');
  lines.push('');
  lines.push('| アクター | カバー | 参照元（Policy/Rule ID） |');
  lines.push('|---------|:-----:|----------------------|');
  for (const [name, res] of Object.entries(actorResults)) {
    const mark = res.covered ? '\u2705' : '\u274C';
    const refs = res.refs.length > 0 ? res.refs.join(', ') : '-';
    lines.push(`| ${name} | ${mark} | ${refs} |`);
  }
  lines.push('');

  // 外部システム
  lines.push('### 外部システム');
  lines.push('');
  lines.push('| 外部システム | カバー | 参照元（Policy/Rule ID） |');
  lines.push('|------------|:-----:|----------------------|');
  for (const [name, res] of Object.entries(extResults)) {
    const mark = res.covered ? '\u2705' : '\u274C';
    const refs = res.refs.length > 0 ? res.refs.join(', ') : '-';
    lines.push(`| ${name} | ${mark} | ${refs} |`);
  }
  lines.push('');

  // 情報
  lines.push('### 情報');
  lines.push('');
  lines.push('| 情報 | エンティティ | ストレージ | 参照元（Policy/Rule ID） |');
  lines.push('|-----|:----------:|:--------:|----------------------|');
  for (const [name, res] of Object.entries(infoResults)) {
    const entityMark = res.entityId ? `\u2705 ${res.entityId}` : '\u274C';
    const storageMark = res.storageType ? (STORAGE_TYPE_LABELS[res.storageType] || res.storageType) : '-';
    const refs = res.refs.length > 0 ? res.refs.join(', ') : '-';
    lines.push(`| ${name} | ${entityMark} | ${storageMark} | ${refs} |`);
  }
  lines.push('');

  // 状態モデル
  lines.push('### 状態モデル');
  lines.push('');
  lines.push('| 状態モデル | カバー | 参照元（Policy/Rule ID） |');
  lines.push('|----------|:-----:|----------------------|');
  for (const [name, res] of Object.entries(stateResults)) {
    const mark = res.covered ? '\u2705' : '\u274C';
    const refs = res.refs.length > 0 ? res.refs.join(', ') : '-';
    lines.push(`| ${name} | ${mark} | ${refs} |`);
  }
  lines.push('');

  // 条件
  lines.push('### 条件');
  lines.push('');
  lines.push('| 条件 | カバー | 参照元（Policy/Rule ID） |');
  lines.push('|-----|:-----:|----------------------|');
  for (const [name, res] of Object.entries(condResults)) {
    const mark = res.covered ? '\u2705' : '\u274C';
    const refs = res.refs.length > 0 ? res.refs.join(', ') : '-';
    lines.push(`| ${name} | ${mark} | ${refs} |`);
  }
  lines.push('');

  // BUC（業務）
  lines.push('### BUC（業務）');
  lines.push('');
  lines.push('| 業務 | カバー | 参照元（Policy/Rule ID） |');
  lines.push('|-----|:-----:|----------------------|');
  for (const [name, res] of Object.entries(bucResults)) {
    const mark = res.covered ? '\u2705' : '\u274C';
    const refs = res.refs.length > 0 ? res.refs.join(', ') : '-';
    lines.push(`| ${name} | ${mark} | ${refs} |`);
  }
  lines.push('');

  // ==== Domain Architecture 対応状況 ====
  if (domainMetrics) {
    lines.push('## ドメインアーキテクチャ対応状況');
    lines.push('');

    if (domainMetrics.subdomains.length > 0) {
      lines.push('### サブドメイン → BUC 割当');
      lines.push('');
      lines.push('| Subdomain ID | 名前 | type | 関連 BUC | confidence |');
      lines.push('|--------------|------|:----:|---------|:----------:|');
      for (const sd of domainMetrics.subdomains) {
        const bucs = (sd.related_buc_ids || []).join(', ') || '❌ 未割当';
        const conf = sd.confidence || '-';
        lines.push(`| ${sd.id} | ${sd.name} | ${sd.type} | ${bucs} | ${conf} |`);
      }
      lines.push('');
    }

    if (domainMetrics.bcs.length > 0) {
      lines.push('### Bounded Context → entity 割当');
      lines.push('');
      lines.push('| BC ID | 名前 | 所属 SD | owned_entity_ids | confidence |');
      lines.push('|-------|------|:-------:|------------------|:----------:|');
      for (const bc of domainMetrics.bcs) {
        const ents = (bc.owned_entity_ids || []).join(', ') || '❌ 未割当';
        const conf = bc.confidence || '-';
        lines.push(`| ${bc.id} | ${bc.name} | ${bc.related_subdomain_id || '-'} | ${ents} | ${conf} |`);
      }
      lines.push('');

      // 未割当 entity の検出
      const allEntityIds = new Set((entities || []).map(e => e.id).filter(Boolean));
      const ownedEntities = new Set();
      for (const bc of domainMetrics.bcs) {
        for (const eid of (bc.owned_entity_ids || [])) ownedEntities.add(eid);
      }
      const unassigned = Array.from(allEntityIds).filter(eid => !ownedEntities.has(eid));
      if (unassigned.length > 0) {
        lines.push(`> ⚠ BC 未割当の entity: ${unassigned.join(', ')}`);
        lines.push('');
      }
    }

    if (domainMetrics.contextMap.length > 0) {
      lines.push('### Context Map');
      lines.push('');
      lines.push('| CM ID | from BC | to BC | パターン | 方向 |');
      lines.push('|-------|---------|-------|:-------:|:----:|');
      for (const cm of domainMetrics.contextMap) {
        lines.push(`| ${cm.id} | ${cm.from_bc_id} | ${cm.to_bc_id} | ${cm.pattern} | ${cm.direction} |`);
      }
      lines.push('');
    } else if (domainMetrics.bcs.length >= 2) {
      lines.push('> ⚠ BC が 2 以上あるが context_map が空です。BC 間の依存関係を明示してください');
      lines.push('');
    }
  }

  // ==== NFR 対応状況 ====
  lines.push('## NFR グレード 対応状況');
  lines.push('');
  for (const catId of ['A', 'B', 'C', 'D', 'E', 'F']) {
    const catName = NFR_CATEGORY_NAMES[catId] || catId;
    const metrics = nfrResults[catId] || [];
    if (metrics.length === 0) continue;

    lines.push(`### ${catName}`);
    lines.push('');
    lines.push('| ID | メトリクス | Lv | カバー | 参照元（Policy/Rule ID） |');
    lines.push('|----|---------|:--:|:-----:|----------------------|');
    for (const m of metrics) {
      const mark = m.covered ? '\u2705' : '\u274C';
      const refs = m.refs.length > 0 ? m.refs.join(', ') : '-';
      lines.push(`| ${m.id} | ${m.name} | ${m.grade} | ${mark} | ${refs} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ===========================================================================
// メイン
// ===========================================================================

function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('Usage: node generateCoverageReport.js <rdra-dir> <nfr-yaml> <arch-yaml> [output-md]');
    process.exit(2);
  }

  const rdraDir = path.resolve(args[0]);
  const nfrYamlPath = path.resolve(args[1]);
  const archYamlPath = path.resolve(args[2]);
  const outputPath = args[3]
    ? path.resolve(args[3])
    : path.join(path.dirname(archYamlPath), 'coverage-report.md');

  // ファイル存在チェック
  if (!fs.existsSync(rdraDir)) {
    console.error(`Error: RDRA directory not found: ${rdraDir}`);
    process.exit(2);
  }
  if (!fs.existsSync(nfrYamlPath)) {
    console.error(`Error: NFR YAML not found: ${nfrYamlPath}`);
    process.exit(2);
  }
  if (!fs.existsSync(archYamlPath)) {
    console.error(`Error: arch-design.yaml not found: ${archYamlPath}`);
    process.exit(2);
  }

  // RDRA 読み込み
  const rdra = loadRdraElements(rdraDir);

  // NFR 読み込み
  let nfrData;
  try {
    nfrData = parseYaml(fs.readFileSync(nfrYamlPath, 'utf-8'));
  } catch (e) {
    console.error(`Error: NFR YAML parse error: ${e.message}`);
    process.exit(2);
  }
  const nfrMetricsByCategory = loadImportantNfrMetrics(nfrData);

  // arch-design 読み込み
  let archData;
  try {
    archData = parseYaml(fs.readFileSync(archYamlPath, 'utf-8'));
  } catch (e) {
    console.error(`Error: arch-design.yaml parse error: ${e.message}`);
    process.exit(2);
  }

  // source_model 収集
  const sourceEntries = collectSourceModels(archData);
  const dataArch = collectDataArchInfo(archData);

  // レポート生成
  const report = generateReport(archData, rdra, nfrMetricsByCategory, sourceEntries, dataArch);

  // 出力
  fs.writeFileSync(outputPath, report, 'utf-8');
  console.log(`Generated: ${outputPath}`);

  // サマリ出力
  const rdraTotal = rdra.actors.length + rdra.externalSystems.length + rdra.infos.length +
    rdra.stateModels.length + rdra.conditions.length + rdra.businesses.length;
  let nfrTotal = 0;
  for (const metrics of Object.values(nfrMetricsByCategory)) {
    nfrTotal += metrics.length;
  }
  console.log(`  RDRA elements: ${rdraTotal}, NFR important metrics: ${nfrTotal}`);
  console.log(`  Source model entries: ${sourceEntries.length}`);
}

main();
