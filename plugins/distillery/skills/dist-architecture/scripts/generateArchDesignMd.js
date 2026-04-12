#!/usr/bin/env node
/**
 * generateArchDesignMd.js
 *
 * arch-design.yaml をアーキテクチャ設計書 Markdown に変換する。
 *
 * Usage:
 *   node generateArchDesignMd.js <input-yaml> [output-md]
 *
 *   input-yaml : arch-design.yaml のパス
 *   output-md  : 出力先 .md のパス（省略時は入力と同じディレクトリに arch-design.md を生成）
 *
 * 出力形式:
 *   - 概要テーブル（event_id, created_at, languages, frameworks）
 *   - システムアーキテクチャ（Mermaid 図 + ティア表 + cross-tier policies/rules）
 *   - アプリケーションアーキテクチャ（ティアごと Mermaid 図 + レイヤー表 + cross-layer policies/rules）
 *   - データアーキテクチャ（Mermaid ER 図 + エンティティ表 + ストレージマッピング表）
 *   - 凡例（確信度レベル）
 *
 * npm 依存なし。Node.js 18+ 標準モジュールのみ使用。
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// 簡易 YAML パーサー（外部依存なし）
// ============================================================

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

// ============================================================
// 定数
// ============================================================

const CONFIDENCE_LABELS = {
  high: '高',
  medium: '中',
  low: '低',
  default: 'デフォルト',
  user: 'ユーザー指定',
};

const MODEL_TYPE_LABELS = {
  event_snapshot: 'イベント+スナップショット',
  event: 'イベント',
  resource_scd2: 'リソース(SCD2)',
  resource_mutable: 'リソース',
};

const STORAGE_TYPE_LABELS = {
  rdb: 'RDB',
  nosql: 'NoSQL',
  cache: 'キャッシュ',
  file: 'ファイル',
  search: '検索エンジン',
};

// ============================================================
// Markdown 生成ヘルパー
// ============================================================

function esc(text) {
  if (text === null || text === undefined) return '-';
  return String(text).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function confidenceBadge(confidence) {
  return CONFIDENCE_LABELS[confidence] || confidence || '-';
}

function renderPolicyRuleTable(items, label) {
  if (!items || items.length === 0) return [];
  const lines = [];
  lines.push(`| ID | ${label}名 | 内容 | 根拠 | RDRA/NFR 要素 | 確信度 |`);
  lines.push('|-----|---------|------|------|--------------|:------:|');
  for (const item of items) {
    const source = item.source_model ? esc(item.source_model) : '-';
    lines.push(`| ${esc(item.id)} | ${esc(item.name)} | ${esc(item.description)} | ${esc(item.reason)} | ${source} | ${confidenceBadge(item.confidence)} |`);
  }
  return lines;
}

// ============================================================
// Markdown 生成
// ============================================================

function generateMarkdown(data) {
  const lines = [];
  const tc = data.technology_context || {};
  const sa = data.system_architecture || {};
  const aa = data.app_architecture || {};
  const da = data.data_architecture || {};

  // ヘッダー
  lines.push('# アーキテクチャ設計書');
  lines.push('');

  // 概要
  lines.push('## 概要');
  lines.push('');
  lines.push('| 項目 | 内容 |');
  lines.push('|------|------|');
  lines.push(`| イベントID | ${esc(data.event_id)} |`);
  lines.push(`| 作成日時 | ${esc(data.created_at)} |`);
  lines.push(`| ソース | ${esc(data.source)} |`);
  lines.push(`| 言語 | ${(tc.languages || []).join(', ') || '-'} |`);
  lines.push(`| フレームワーク | ${(tc.frameworks || []).join(', ') || '-'} |`);
  lines.push(`| 技術的制約 | ${(tc.constraints || []).join(', ') || '-'} |`);
  lines.push('');

  // ================================================================
  // システムアーキテクチャ
  // ================================================================
  lines.push('## システムアーキテクチャ');
  lines.push('');

  // Mermaid 図
  if (sa.diagram_mermaid) {
    lines.push('### システム構成図');
    lines.push('');
    lines.push('```mermaid');
    lines.push(sa.diagram_mermaid);
    lines.push('```');
    lines.push('');
  }

  // ティア一覧表
  lines.push('### ティア構成');
  lines.push('');
  lines.push('| ID | ティア名 | 説明 | テクノロジー候補 |');
  lines.push('|-----|---------|------|----------------|');
  for (const tier of (sa.tiers || [])) {
    const tech = (tier.technology_candidates || []).join(', ');
    lines.push(`| ${esc(tier.id)} | ${esc(tier.name)} | ${esc(tier.description)} | ${tech} |`);
  }
  lines.push('');

  // ティアごとのポリシー・ルール
  for (const tier of (sa.tiers || [])) {
    const hasPolicies = (tier.policies || []).length > 0;
    const hasRules = (tier.rules || []).length > 0;
    if (hasPolicies || hasRules) {
      lines.push(`### ${esc(tier.name)} (${esc(tier.id)}) の方針・ルール`);
      lines.push('');
      if (hasPolicies) {
        lines.push('#### 方針');
        lines.push('');
        lines.push(...renderPolicyRuleTable(tier.policies, '方針'));
        lines.push('');
      }
      if (hasRules) {
        lines.push('#### ルール');
        lines.push('');
        lines.push(...renderPolicyRuleTable(tier.rules, 'ルール'));
        lines.push('');
      }
    }
  }

  // Cross-tier ポリシー
  if ((sa.cross_tier_policies || []).length > 0) {
    lines.push('### ティア共通の方針');
    lines.push('');
    lines.push(...renderPolicyRuleTable(sa.cross_tier_policies, '方針'));
    lines.push('');
  }

  // Cross-tier ルール
  if ((sa.cross_tier_rules || []).length > 0) {
    lines.push('### ティア共通のルール');
    lines.push('');
    lines.push(...renderPolicyRuleTable(sa.cross_tier_rules, 'ルール'));
    lines.push('');
  }

  // ================================================================
  // アプリケーションアーキテクチャ
  // ================================================================
  lines.push('## アプリケーションアーキテクチャ');
  lines.push('');

  for (const tl of (aa.tier_layers || [])) {
    lines.push(`### ${esc(tl.tier_id)} のレイヤー構成`);
    lines.push('');

    // Mermaid 図
    if (tl.diagram_mermaid) {
      lines.push('#### レイヤー依存図');
      lines.push('');
      lines.push('```mermaid');
      lines.push(tl.diagram_mermaid);
      lines.push('```');
      lines.push('');
    }

    // レイヤー表
    lines.push('| ID | レイヤー名 | 責務 | 依存許可先 |');
    lines.push('|-----|---------|------|----------|');
    for (const layer of (tl.layers || [])) {
      const deps = (layer.allowed_dependencies || []).join(', ') || '-';
      lines.push(`| ${esc(layer.id)} | ${esc(layer.name)} | ${esc(layer.responsibility)} | ${deps} |`);
    }
    lines.push('');

    // レイヤーごとのポリシー・ルール
    for (const layer of (tl.layers || [])) {
      const hasPolicies = (layer.policies || []).length > 0;
      const hasRules = (layer.rules || []).length > 0;
      if (hasPolicies || hasRules) {
        lines.push(`#### ${esc(layer.name)} (${esc(layer.id)}) の方針・ルール`);
        lines.push('');
        if (hasPolicies) {
          lines.push('**方針**');
          lines.push('');
          lines.push(...renderPolicyRuleTable(layer.policies, '方針'));
          lines.push('');
        }
        if (hasRules) {
          lines.push('**ルール**');
          lines.push('');
          lines.push(...renderPolicyRuleTable(layer.rules, 'ルール'));
          lines.push('');
        }
      }
    }

    // Cross-layer ポリシー
    if ((tl.cross_layer_policies || []).length > 0) {
      lines.push('#### レイヤー共通の方針');
      lines.push('');
      lines.push(...renderPolicyRuleTable(tl.cross_layer_policies, '方針'));
      lines.push('');
    }

    // Cross-layer ルール
    if ((tl.cross_layer_rules || []).length > 0) {
      lines.push('#### レイヤー共通のルール');
      lines.push('');
      lines.push(...renderPolicyRuleTable(tl.cross_layer_rules, 'ルール'));
      lines.push('');
    }
  }

  // ================================================================
  // データアーキテクチャ
  // ================================================================
  lines.push('## データアーキテクチャ');
  lines.push('');

  // Mermaid ER 図
  if (da.diagram_mermaid) {
    lines.push('### ER 図');
    lines.push('');
    lines.push('```mermaid');
    lines.push(da.diagram_mermaid);
    lines.push('```');
    lines.push('');
  }

  // エンティティ表
  lines.push('### エンティティ一覧');
  lines.push('');

  for (const entity of (da.entities || [])) {
    const mtLabel = MODEL_TYPE_LABELS[entity.model_type] || entity.model_type || '-';
    lines.push(`#### ${esc(entity.id)}: ${esc(entity.name)}`);
    lines.push('');
    lines.push(`- **参照元**: ${esc(entity.source_info)}`);
    lines.push(`- **モデル種別**: ${mtLabel}`);
    lines.push('');

    // 属性表
    lines.push('| 属性名 | 型 | 説明 | NULL | PK |');
    lines.push('|--------|-----|------|:----:|:--:|');
    for (const attr of (entity.attributes || [])) {
      const nullable = attr.nullable ? 'Yes' : 'No';
      const pk = attr.primary_key ? 'Yes' : '';
      lines.push(`| ${esc(attr.name)} | ${esc(attr.type)} | ${esc(attr.description)} | ${nullable} | ${pk} |`);
    }
    lines.push('');

    // リレーション
    if ((entity.relationships || []).length > 0) {
      lines.push('**リレーション**');
      lines.push('');
      lines.push('| 対象エンティティ | カーディナリティ | 説明 |');
      lines.push('|-----------------|:---------------:|------|');
      for (const rel of entity.relationships) {
        lines.push(`| ${esc(rel.target_entity)} | ${esc(rel.type)} | ${esc(rel.description)} |`);
      }
      lines.push('');
    }
  }

  // ストレージマッピング表
  if ((da.storage_mapping || []).length > 0) {
    lines.push('### ストレージマッピング');
    lines.push('');
    lines.push('| エンティティID | ストレージ種別 | 根拠 | 確信度 |');
    lines.push('|---------------|:------------:|------|:------:|');
    for (const sm of da.storage_mapping) {
      const stLabel = STORAGE_TYPE_LABELS[sm.storage_type] || sm.storage_type;
      lines.push(`| ${esc(sm.entity_id)} | ${stLabel} | ${esc(sm.reason)} | ${confidenceBadge(sm.confidence)} |`);
    }
    lines.push('');
  }

  // ================================================================
  // 凡例
  // ================================================================
  lines.push('## 凡例');
  lines.push('');
  lines.push('### 確信度');
  lines.push('');
  lines.push('| 確信度 | 意味 |');
  lines.push('|:------:|------|');
  lines.push('| 高 | RDRA/NFR モデルから明確に推論 |');
  lines.push('| 中 | RDRA/NFR モデルから間接推論 |');
  lines.push('| 低 | 弱い根拠での推論 |');
  lines.push('| デフォルト | 一般的なベストプラクティスを適用 |');
  lines.push('| ユーザー指定 | 対話でユーザーが指定 |');
  lines.push('');

  return lines.join('\n');
}

// ============================================================
// Main
// ============================================================

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node generateArchDesignMd.js <input-yaml> [output-md]');
    process.exit(1);
  }

  const resolvedInput = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`Error: File not found: ${resolvedInput}`);
    process.exit(1);
  }

  const outputPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(path.dirname(resolvedInput), 'arch-design.md');

  const yamlText = fs.readFileSync(resolvedInput, 'utf-8');
  const data = parseYaml(yamlText);

  const markdown = generateMarkdown(data);
  fs.writeFileSync(outputPath, markdown, 'utf-8');

  const tiersCount = ((data.system_architecture || {}).tiers || []).length;
  const entitiesCount = ((data.data_architecture || {}).entities || []).length;
  const tierLayersCount = ((data.app_architecture || {}).tier_layers || []).length;

  console.log(`Generated: ${outputPath}`);
  console.log(`  Tiers: ${tiersCount}, Tier Layers: ${tierLayersCount}, Entities: ${entitiesCount}`);
}

main();
