#!/usr/bin/env node
/**
 * generateRdraMd.js
 *
 * RDRA スナップショット（docs/rdra/latest/*.tsv）から、ヒトが読むための
 * Markdown ビュー（Mermaid 図解つき）を決定論的に生成する。
 *
 * Usage:
 *   node generateRdraMd.js [rdra-dir] [output-dir] [--strict]
 *
 *   rdra-dir   : TSV があるディレクトリ（省略時は docs/rdra/latest）
 *   output-dir : 出力先（省略時は {rdra-dir}/views）
 *   --strict   : 不整合が 1 件でもあれば exit code 1 で終了する
 *
 * 入力（存在するものだけ使う。無いシートは空扱い）:
 *   アクター.tsv 外部システム.tsv BUC.tsv 情報.tsv 状態.tsv 条件.tsv
 *   バリエーション.tsv システム概要.json
 *
 * 出力:
 *   README.md                    — 目次 + システム概要 + モデル件数
 *   00_不整合チェック.md           — RDRA Sheet「✖不整合」相当の参照整合性チェック
 *   01_システムコンテキスト.md      — システム価値レイヤー
 *   02_業務構成.md                — システム外部環境レイヤー（業務→BUC）
 *   03_業務フロー.md              — システム外部環境レイヤー（BUC 単位のアクティビティフロー）
 *   04_UC複合図.md               — システム境界レイヤー（BUC 単位）
 *   05_情報モデル.md              — システム内部レイヤー
 *   06_状態モデル.md              — システム内部レイヤー
 *   07_条件・バリエーション.md      — システム内部レイヤー
 *
 * 決定論性:
 *   同一入力 → 同一出力。出力順は TSV の行順・初出順を保持し、
 *   タイムスタンプや乱数を含めない。
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// TSV 読み込み
// ============================================================

// セル正規化: 前後空白除去、リテラル "" は空文字扱い（harvest 出力対応）
function normalizeCell(cell) {
  const v = (cell || '').trim();
  if (v === '""') return '';
  return v.replace(/^"(.*)"$/, '$1');
}

// TSV を {header, rows} に読み込む。rows は {カラム名: 値} の配列
function readTsv(filePath) {
  if (!fs.existsSync(filePath)) return { header: [], rows: [] };
  const text = fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) return { header: [], rows: [] };
  const header = lines[0].split('\t').map(normalizeCell);
  const rows = lines.slice(1).map((line) => {
    const cells = line.split('\t');
    const row = {};
    header.forEach((h, i) => {
      row[h] = normalizeCell(cells[i]);
    });
    return row;
  });
  return { header, rows };
}

// 階層カラムのフィルダウン（空白セルは直上の値を引き継ぐ）
function fillDown(rows, columns) {
  const prev = {};
  for (const row of rows) {
    for (const col of columns) {
      if (row[col] === '' && prev[col] !== undefined) {
        row[col] = prev[col];
      } else if (row[col] !== '') {
        prev[col] = row[col];
      }
    }
  }
  return rows;
}

// 「、」「,」区切りのリストセルを分割
function splitList(cell) {
  if (!cell) return [];
  return cell
    .split(/[、,]/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

// ============================================================
// Mermaid ヘルパー
// ============================================================

// Mermaid ラベル用エスケープ（常に引用符で囲む前提）
function q(label) {
  return '"' + String(label).replace(/"/g, '#quot;').replace(/\n/g, ' ') + '"';
}

// Markdown テーブルセル用エスケープ
function esc(text) {
  if (!text) return '';
  return String(text).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

// ノード ID 採番器（種別プレフィックス + 初出順の連番）
function createIdGen() {
  const map = new Map();
  const counters = {};
  return function id(prefix, name) {
    const key = prefix + ' ' + name;
    if (!map.has(key)) {
      counters[prefix] = (counters[prefix] || 0) + 1;
      map.set(key, prefix + counters[prefix]);
    }
    return map.get(key);
  };
}

// ノード形状（RDRA モデル種別 → Mermaid 記法）
const SHAPES = {
  アクター: (id, label) => `${id}([${q(label)}])`,
  外部システム: (id, label) => `${id}[[${q(label)}]]`,
  画面: (id, label) => `${id}[/${q(label)}/]`,
  UC: (id, label) => `${id}(${q(label)})`,
  情報: (id, label) => `${id}[(${q(label)})]`,
  条件: (id, label) => `${id}{{${q(label)}}}`,
  イベント: (id, label) => `${id}>${q(label)}]`,
  タイマー: (id, label) => `${id}(((${q(label)})))`,
  アクティビティ: (id, label) => `${id}[${q(label)}]`,
  業務: (id, label) => `${id}[${q(label)}]`,
  BUC: (id, label) => `${id}([${q(label)}])`,
  状態モデル: (id, label) => `${id}[[${q(label)}]]`,
  バリエーション: (id, label) => `${id}[/${q(label)}/]`,
  参照: (id, label) => `${id}[${q(label)}]`, // 未定義参照のフォールバック
};

// 図 1 枚分のビルダー。ノード宣言とエッジを重複排除しつつ初出順に保持する
function createDiagram(headerLine) {
  const nodeLines = [];
  const nodeSet = new Set();
  const edgeLines = [];
  const edgeSet = new Set();
  return {
    node(idGen, type, name, labelOverride) {
      const nodeId = idGen(typePrefix(type), name);
      if (!nodeSet.has(nodeId)) {
        nodeSet.add(nodeId);
        const shape = SHAPES[type] || SHAPES['参照'];
        nodeLines.push('  ' + shape(nodeId, labelOverride || name));
      }
      return nodeId;
    },
    rawNode(line, key) {
      if (!nodeSet.has(key)) {
        nodeSet.add(key);
        nodeLines.push(line);
      }
    },
    edge(from, to, arrow, label) {
      const a = arrow || '-->';
      const line = label
        ? `  ${from} ${a}|${q(label)}| ${to}`
        : `  ${from} ${a} ${to}`;
      if (!edgeSet.has(line)) {
        edgeSet.add(line);
        edgeLines.push(line);
      }
    },
    render() {
      return ['```mermaid', headerLine, ...nodeLines, ...edgeLines, '```'].join('\n');
    },
    lines: { nodeLines, edgeLines },
  };
}

function typePrefix(type) {
  const prefixes = {
    アクター: 'AC',
    外部システム: 'EX',
    画面: 'SC',
    UC: 'UC',
    情報: 'IF',
    条件: 'CD',
    イベント: 'EV',
    タイマー: 'TM',
    アクティビティ: 'AT',
    業務: 'GY',
    BUC: 'BC',
    状態モデル: 'SM',
    バリエーション: 'VR',
    参照: 'RF',
  };
  return prefixes[type] || 'ND';
}

const GENERATED_NOTE =
  '<!-- generateRdraMd.js による自動生成ファイル。手動編集しないこと。元データ: docs/rdra/latest/*.tsv -->';

// ============================================================
// 01 システムコンテキスト
// ============================================================

function viewSystemContext(model) {
  const lines = [GENERATED_NOTE, '', '# システムコンテキスト', ''];
  lines.push('RDRA システム価値レイヤー。システムに関わるアクターと外部システムの全体像。');
  lines.push('');

  const idGen = createIdGen();
  const out = ['```mermaid', 'graph LR'];

  // アクター群ごとの subgraph
  const actorGroups = new Map();
  for (const row of model.actors) {
    const group = row['アクター群'] || '（アクター群未設定）';
    if (!actorGroups.has(group)) actorGroups.set(group, []);
    actorGroups.get(group).push(row);
  }
  const actorIds = [];
  let gi = 0;
  for (const [group, rows] of actorGroups) {
    gi++;
    out.push(`  subgraph AG${gi}[${q(group)}]`);
    for (const row of rows) {
      const nodeId = idGen('AC', row['アクター']);
      const meta = [row['社内外'], row['立場']].filter(Boolean).join('・');
      const label = meta ? `${row['アクター']}<br/>（${meta}）` : row['アクター'];
      out.push(`    ${nodeId}([${q(label)}])`);
      actorIds.push(nodeId);
    }
    out.push('  end');
  }

  out.push(`  SYS[${q(model.systemName)}]`);

  // 外部システム群ごとの subgraph
  const extGroups = new Map();
  for (const row of model.externals) {
    const group = row['外部システム群'] || '（外部システム群未設定）';
    if (!extGroups.has(group)) extGroups.set(group, []);
    extGroups.get(group).push(row);
  }
  const extIds = [];
  let ei = 0;
  for (const [group, rows] of extGroups) {
    ei++;
    out.push(`  subgraph EG${ei}[${q(group)}]`);
    for (const row of rows) {
      const nodeId = idGen('EX', row['外部システム']);
      out.push(`    ${nodeId}[[${q(row['外部システム'])}]]`);
      extIds.push(nodeId);
    }
    out.push('  end');
  }

  for (const a of actorIds) out.push(`  ${a} --> SYS`);
  for (const e of extIds) out.push(`  SYS --> ${e}`);
  out.push('```');
  lines.push(out.join('\n'));
  lines.push('');
  lines.push('> 凡例: `(丸角)` アクター / `[四角]` システム / `[[二重枠]]` 外部システム');
  lines.push('');

  if (model.actors.length > 0) {
    lines.push('## アクター');
    lines.push('');
    lines.push('| アクター群 | アクター | 役割 | 社内外 | 立場 | 主担当業務 |');
    lines.push('|---|---|---|---|---|---|');
    for (const row of model.actors) {
      lines.push(
        `| ${esc(row['アクター群'])} | ${esc(row['アクター'])} | ${esc(row['役割'])} | ${esc(row['社内外'])} | ${esc(row['立場'])} | ${esc(row['主担当業務'])} |`
      );
    }
    lines.push('');
  }

  if (model.externals.length > 0) {
    lines.push('## 外部システム');
    lines.push('');
    lines.push('| 外部システム群 | 外部システム | 役割 |');
    lines.push('|---|---|---|');
    for (const row of model.externals) {
      lines.push(
        `| ${esc(row['外部システム群'])} | ${esc(row['外部システム'])} | ${esc(row['役割'])} |`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================
// 02 業務構成
// ============================================================

function viewBusinessStructure(model) {
  const lines = [GENERATED_NOTE, '', '# 業務構成', ''];
  lines.push('RDRA システム外部環境レイヤー。業務とビジネスユースケース（BUC）の構成。');
  lines.push('');

  const idGen = createIdGen();
  const dia = createDiagram('graph LR');
  const stats = new Map(); // "業務 BUC" -> {activities:Set, ucs:Set}

  for (const row of model.buc) {
    const gyoumu = row['業務'];
    const buc = row['BUC'];
    if (!gyoumu || !buc) continue;
    const g = dia.node(idGen, '業務', gyoumu);
    const b = dia.node(idGen, 'BUC', buc);
    dia.edge(g, b);
    const key = gyoumu + ' ' + buc;
    if (!stats.has(key)) stats.set(key, { gyoumu, buc, activities: new Set(), ucs: new Set() });
    if (row['アクティビティ']) stats.get(key).activities.add(row['アクティビティ']);
    if (row['UC']) stats.get(key).ucs.add(row['UC']);
  }

  lines.push(dia.render());
  lines.push('');
  lines.push('> 凡例: `[四角]` 業務 / `(丸角)` BUC');
  lines.push('');
  lines.push('## BUC 一覧');
  lines.push('');
  lines.push('| 業務 | BUC | アクティビティ数 | UC 数 |');
  lines.push('|---|---|---|---|');
  for (const s of stats.values()) {
    lines.push(`| ${esc(s.gyoumu)} | ${esc(s.buc)} | ${s.activities.size} | ${s.ucs.size} |`);
  }
  lines.push('');
  return lines.join('\n');
}

// ============================================================
// 03 業務フロー
// ============================================================

// BUC.tsv の行から アクティビティ → 担当アクター集合 を引く
function collectActivityActors(bucRows) {
  const map = new Map(); // BUC アクティビティ -> Set(アクター)
  for (const row of bucRows) {
    if (row['関連モデル2'] === 'アクター' && row['関連オブジェクト2']) {
      const key = row['BUC'] + ' ' + row['アクティビティ'];
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(row['関連オブジェクト2']);
    }
  }
  return map;
}

function viewBusinessFlow(model) {
  const lines = [GENERATED_NOTE, '', '# 業務フロー', ''];
  lines.push('RDRA システム外部環境レイヤー。BUC ごとのアクティビティの流れ。');
  lines.push('担当（アクター）ごとのレーンに分けて表示する。');
  lines.push('');

  const activityActors = collectActivityActors(model.buc);

  // 業務 → BUC → アクティビティ（初出順）
  const gyoumuOrder = [];
  const gyoumuMap = new Map(); // 業務 -> Map(BUC -> {activities:[], hasExplicit, rows:[]})
  for (const row of model.buc) {
    const gyoumu = row['業務'];
    const buc = row['BUC'];
    if (!gyoumu || !buc || !row['アクティビティ']) continue;
    if (!gyoumuMap.has(gyoumu)) {
      gyoumuMap.set(gyoumu, new Map());
      gyoumuOrder.push(gyoumu);
    }
    const bucMap = gyoumuMap.get(gyoumu);
    if (!bucMap.has(buc)) bucMap.set(buc, { activities: [], hasExplicit: false, rows: [] });
    const entry = bucMap.get(buc);
    if (!entry.activities.includes(row['アクティビティ'])) {
      entry.activities.push(row['アクティビティ']);
    }
    if (row['先'] || row['次']) entry.hasExplicit = true;
    entry.rows.push(row);
  }

  for (const gyoumu of gyoumuOrder) {
    lines.push(`## ${gyoumu}`);
    lines.push('');
    for (const [buc, entry] of gyoumuMap.get(gyoumu)) {
      lines.push(`### ${buc}`);
      lines.push('');

      const idGen = createIdGen();
      const out = ['```mermaid', 'graph TD'];

      // レーン: アクター（無ければ立場、それも無ければ担当未設定）ごとの subgraph
      const laneOrder = [];
      const lanes = new Map(); // レーン名 -> [アクティビティ]
      const laneOf = new Map(); // アクティビティ -> レーン名
      for (const act of entry.activities) {
        const actors = activityActors.get(buc + ' ' + act);
        let lane;
        if (actors && actors.size > 0) {
          lane = [...actors].join('・');
        } else {
          const row = entry.rows.find((r) => r['アクティビティ'] === act);
          lane = (row && row['立場']) || '担当未設定';
        }
        if (!lanes.has(lane)) {
          lanes.set(lane, []);
          laneOrder.push(lane);
        }
        lanes.get(lane).push(act);
        laneOf.set(act, lane);
      }

      let li = 0;
      for (const lane of laneOrder) {
        li++;
        out.push(`  subgraph LN${li}[${q('👤 ' + lane)}]`);
        for (const act of lanes.get(lane)) {
          out.push(`    ${idGen('AT', act)}[${q(act)}]`);
        }
        out.push('  end');
      }

      // 順序エッジ: 先/次 があれば実線、無ければ行順の推定を点線で
      const edges = new Set();
      if (entry.hasExplicit) {
        for (const row of entry.rows) {
          const act = row['アクティビティ'];
          if (row['先'] && entry.activities.includes(row['先'])) {
            edges.add(`  ${idGen('AT', row['先'])} --> ${idGen('AT', act)}`);
          }
          if (row['次'] && entry.activities.includes(row['次'])) {
            edges.add(`  ${idGen('AT', act)} --> ${idGen('AT', row['次'])}`);
          }
        }
      } else {
        for (let i = 0; i + 1 < entry.activities.length; i++) {
          edges.add(
            `  ${idGen('AT', entry.activities[i])} -.-> ${idGen('AT', entry.activities[i + 1])}`
          );
        }
      }
      out.push(...edges);
      out.push('```');
      lines.push(out.join('\n'));
      lines.push('');
      if (!entry.hasExplicit && entry.activities.length > 1) {
        lines.push('> 点線矢印は TSV の行順にもとづく推定順序（`先`/`次` 未指定のため）。');
        lines.push('');
      }

      // アクティビティ表
      lines.push('| アクティビティ | 担当 | UC | 説明 |');
      lines.push('|---|---|---|---|');
      for (const act of entry.activities) {
        const actRows = entry.rows.filter((r) => r['アクティビティ'] === act);
        const ucs = [...new Set(actRows.map((r) => r['UC']).filter(Boolean))].join('、');
        const desc = actRows.map((r) => r['説明']).find(Boolean) || '';
        lines.push(`| ${esc(act)} | ${esc(laneOf.get(act))} | ${esc(ucs)} | ${esc(desc)} |`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ============================================================
// 04 UC複合図
// ============================================================

function viewUcComposite(model) {
  const lines = [GENERATED_NOTE, '', '# UC複合図', ''];
  lines.push('RDRA システム境界レイヤー。BUC ごとに、アクティビティ・UC・画面・イベント・');
  lines.push('情報・条件・外部システムの関係を表す。');
  lines.push('');

  // 業務 → BUC 単位でセクション化
  const gyoumuOrder = [];
  const gyoumuMap = new Map();
  for (const row of model.buc) {
    const gyoumu = row['業務'];
    const buc = row['BUC'];
    if (!gyoumu || !buc) continue;
    if (!gyoumuMap.has(gyoumu)) {
      gyoumuMap.set(gyoumu, new Map());
      gyoumuOrder.push(gyoumu);
    }
    const bucMap = gyoumuMap.get(gyoumu);
    if (!bucMap.has(buc)) bucMap.set(buc, []);
    bucMap.get(buc).push(row);
  }

  for (const gyoumu of gyoumuOrder) {
    lines.push(`## ${gyoumu}`);
    lines.push('');
    for (const [buc, rows] of gyoumuMap.get(gyoumu)) {
      const ucRows = rows.filter((r) => r['UC']);
      if (ucRows.length === 0) continue;
      lines.push(`### ${buc}`);
      lines.push('');

      const idGen = createIdGen();
      const dia = createDiagram('graph LR');

      for (const row of ucRows) {
        const uc = dia.node(idGen, 'UC', row['UC']);
        if (row['アクティビティ']) {
          dia.edge(dia.node(idGen, 'アクティビティ', row['アクティビティ']), uc);
        }
        const model1 = row['関連モデル1'];
        const obj1 = row['関連オブジェクト1'];
        const model2 = row['関連モデル2'];
        const obj2 = row['関連オブジェクト2'];
        if (!model1 || !obj1) continue;
        if (model1 === '情報') {
          dia.edge(uc, dia.node(idGen, '情報', obj1));
        } else if (model1 === '条件') {
          dia.edge(uc, dia.node(idGen, '条件', obj1), '-.->');
        } else if (model1 === '画面') {
          const sc = dia.node(idGen, '画面', obj1);
          if (model2 === 'アクター' && obj2) {
            dia.edge(dia.node(idGen, 'アクター', obj2), sc);
          }
          dia.edge(sc, uc);
        } else if (model1 === 'イベント') {
          const ev = dia.node(idGen, 'イベント', obj1);
          dia.edge(uc, ev);
          if (model2 === '外部システム' && obj2) {
            dia.edge(ev, dia.node(idGen, '外部システム', obj2));
          }
        } else if (model1 === 'タイマー') {
          dia.edge(dia.node(idGen, 'タイマー', obj1), uc);
        } else if (model1 === 'アクター') {
          dia.edge(dia.node(idGen, 'アクター', obj1), uc);
        }
      }

      lines.push(dia.render());
      lines.push('');
      lines.push(
        '> 凡例: `(丸角)` アクター・UC / `[四角]` アクティビティ / `[/斜め/]` 画面 / `[(円柱)]` 情報 / `{{六角}}` 条件 / `>旗]` イベント / `[[二重枠]]` 外部システム。点線は条件参照。'
      );
      lines.push('');

      // UC 表
      lines.push('| UC | アクティビティ | 画面 | 情報 | 条件 | イベント | 説明 |');
      lines.push('|---|---|---|---|---|---|---|');
      const ucOrder = [];
      const ucInfo = new Map();
      for (const row of ucRows) {
        if (!ucInfo.has(row['UC'])) {
          ucInfo.set(row['UC'], {
            activities: new Set(),
            screens: new Set(),
            infos: new Set(),
            conds: new Set(),
            events: new Set(),
            desc: '',
          });
          ucOrder.push(row['UC']);
        }
        const info = ucInfo.get(row['UC']);
        if (row['アクティビティ']) info.activities.add(row['アクティビティ']);
        if (row['関連モデル1'] === '画面') info.screens.add(row['関連オブジェクト1']);
        if (row['関連モデル1'] === '情報') info.infos.add(row['関連オブジェクト1']);
        if (row['関連モデル1'] === '条件') info.conds.add(row['関連オブジェクト1']);
        if (row['関連モデル1'] === 'イベント') info.events.add(row['関連オブジェクト1']);
        if (!info.desc && row['説明']) info.desc = row['説明'];
      }
      for (const uc of ucOrder) {
        const i = ucInfo.get(uc);
        lines.push(
          `| ${esc(uc)} | ${esc([...i.activities].join('、'))} | ${esc([...i.screens].join('、'))} | ${esc([...i.infos].join('、'))} | ${esc([...i.conds].join('、'))} | ${esc([...i.events].join('、'))} | ${esc(i.desc)} |`
        );
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ============================================================
// 05 情報モデル
// ============================================================

function viewInformationModel(model) {
  const lines = [GENERATED_NOTE, '', '# 情報モデル', ''];
  lines.push('RDRA システム内部レイヤー。コンテキストごとの情報と情報間の関連。');
  lines.push('');

  const idGen = createIdGen();
  const defined = new Set(model.infos.map((r) => r['情報']));

  const out = ['```mermaid', 'graph LR'];

  // コンテキストごとの subgraph
  const contexts = new Map();
  for (const row of model.infos) {
    const ctx = row['コンテキスト'] || '（コンテキスト未設定）';
    if (!contexts.has(ctx)) contexts.set(ctx, []);
    contexts.get(ctx).push(row);
  }
  let ci = 0;
  for (const [ctx, rows] of contexts) {
    ci++;
    out.push(`  subgraph CX${ci}[${q(ctx)}]`);
    for (const row of rows) {
      out.push(`    ${idGen('IF', row['情報'])}[(${q(row['情報'])})]`);
    }
    out.push('  end');
  }

  // 関連情報エッジ（無向・重複排除）+ 未定義参照ノード
  const undefinedRefs = [];
  const edgeSet = new Set();
  const edges = [];
  for (const row of model.infos) {
    for (const rel of splitList(row['関連情報'])) {
      if (!defined.has(rel) && !undefinedRefs.includes(rel)) undefinedRefs.push(rel);
      const pair = [row['情報'], rel].sort().join(' ');
      if (edgeSet.has(pair)) continue;
      edgeSet.add(pair);
      edges.push(`  ${idGen('IF', row['情報'])} --- ${idGen('IF', rel)}`);
    }
  }
  for (const ref of undefinedRefs) {
    out.push(`  ${idGen('IF', ref)}[${q(ref)}]`);
  }
  out.push(...edges);
  out.push('```');
  lines.push(out.join('\n'));
  lines.push('');
  lines.push('> 凡例: `[(円柱)]` 情報 / `[四角]` 情報.tsv 未定義の参照。実線は関連情報。');
  lines.push('');

  lines.push('## 情報一覧');
  lines.push('');
  lines.push('| コンテキスト | 情報 | 属性 | 状態モデル | バリエーション | 説明 |');
  lines.push('|---|---|---|---|---|---|');
  for (const row of model.infos) {
    lines.push(
      `| ${esc(row['コンテキスト'])} | ${esc(row['情報'])} | ${esc(row['属性'])} | ${esc(row['状態モデル'])} | ${esc(row['バリエーション'])} | ${esc(row['説明'])} |`
    );
  }
  lines.push('');
  return lines.join('\n');
}

// ============================================================
// 06 状態モデル
// ============================================================

function viewStateModel(model) {
  const lines = [GENERATED_NOTE, '', '# 状態モデル', ''];
  lines.push('RDRA システム内部レイヤー。状態モデルごとの状態遷移。遷移ラベルは UC。');
  lines.push('');

  // (コンテキスト, 状態モデル) 単位でグループ化
  const groupOrder = [];
  const groups = new Map();
  for (const row of model.states) {
    const key = (row['コンテキスト'] || '') + ' ' + (row['状態モデル'] || '');
    if (!groups.has(key)) {
      groups.set(key, { ctx: row['コンテキスト'], name: row['状態モデル'], rows: [] });
      groupOrder.push(key);
    }
    groups.get(key).rows.push(row);
  }

  for (const key of groupOrder) {
    const g = groups.get(key);
    if (!g.name) continue;
    lines.push(`## ${g.name}（${g.ctx}）`);
    lines.push('');

    // 状態のエイリアス定義（初出順）
    const aliasOrder = [];
    const aliases = new Map();
    const alias = (state) => {
      if (!aliases.has(state)) {
        aliases.set(state, 's' + (aliasOrder.length + 1));
        aliasOrder.push(state);
      }
      return aliases.get(state);
    };

    const transitions = [];
    for (const row of g.rows) {
      const from = row['状態'];
      const to = row['遷移先状態'];
      const uc = row['遷移UC'];
      if (from) alias(from);
      if (to) alias(to);
      if (from && to) {
        transitions.push({ from: alias(from), to: alias(to), uc });
      } else if (!from && to) {
        transitions.push({ from: '[*]', to: alias(to), uc });
      } else if (from && !to) {
        transitions.push({ from: alias(from), to: '[*]', uc });
      }
    }

    const out = ['```mermaid', 'stateDiagram-v2'];
    for (const state of aliasOrder) {
      out.push(`  ${aliases.get(state)} : ${state}`);
    }
    const seen = new Set();
    for (const t of transitions) {
      const line = t.uc ? `  ${t.from} --> ${t.to} : ${t.uc}` : `  ${t.from} --> ${t.to}`;
      if (seen.has(line)) continue;
      seen.add(line);
      out.push(line);
    }
    out.push('```');
    lines.push(out.join('\n'));
    lines.push('');

    lines.push('| 状態 | 遷移UC | 遷移先状態 | 説明 |');
    lines.push('|---|---|---|---|');
    for (const row of g.rows) {
      lines.push(
        `| ${esc(row['状態'])} | ${esc(row['遷移UC'])} | ${esc(row['遷移先状態'])} | ${esc(row['説明'])} |`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================
// 07 条件・バリエーション
// ============================================================

function viewConditionVariation(model) {
  const lines = [GENERATED_NOTE, '', '# 条件・バリエーション', ''];
  lines.push('RDRA システム内部レイヤー。判断条件（ビジネスルール）と区分・種別の一覧。');
  lines.push('');

  if (model.conditions.length > 0) {
    lines.push('## 条件（ビジネスルール）');
    lines.push('');

    const idGen = createIdGen();
    const dia = createDiagram('graph LR');
    let hasEdges = false;
    for (const row of model.conditions) {
      const cd = dia.node(idGen, '条件', row['条件']);
      for (const sm of splitList(row['状態モデル'])) {
        dia.edge(cd, dia.node(idGen, '状態モデル', sm), '-.->');
        hasEdges = true;
      }
      for (const vr of splitList(row['バリエーション'])) {
        dia.edge(cd, dia.node(idGen, 'バリエーション', vr), '-.->');
        hasEdges = true;
      }
    }
    if (hasEdges) {
      lines.push(dia.render());
      lines.push('');
      lines.push('> 凡例: `{{六角}}` 条件 / `[[二重枠]]` 状態モデル / `[/斜め/]` バリエーション');
      lines.push('');
    }

    lines.push('| コンテキスト | 条件 | 条件の説明 | バリエーション | 状態モデル |');
    lines.push('|---|---|---|---|---|');
    for (const row of model.conditions) {
      lines.push(
        `| ${esc(row['コンテキスト'])} | ${esc(row['条件'])} | ${esc(row['条件の説明'])} | ${esc(row['バリエーション'])} | ${esc(row['状態モデル'])} |`
      );
    }
    lines.push('');
  }

  if (model.variations.length > 0) {
    lines.push('## バリエーション');
    lines.push('');
    lines.push('| コンテキスト | バリエーション | 値 | 説明 |');
    lines.push('|---|---|---|---|');
    for (const row of model.variations) {
      lines.push(
        `| ${esc(row['コンテキスト'])} | ${esc(row['バリエーション'])} | ${esc(row['値'])} | ${esc(row['説明'])} |`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================
// 不整合チェック（RDRA Sheet「✖不整合」シート相当）
// ============================================================
// チェック仕様は RDRA Sheet テンプレート（2.RDRA定義分析_V1.0）の
// 「✖不整合」シート 2 行目のセルコメントに準拠する。
// 「-」は RDRA Sheet の「前行を引き継がない」プレースホルダのため参照値として扱わない。

function isRealValue(v) {
  return v !== '' && v !== '-';
}

function validateModel(model) {
  const findings = []; // {check, target, detail} — チェック定義順・初出順
  const add = (check, target, detail) => findings.push({ check, target, detail });

  // 定義済みセット
  const definedActors = new Set(model.actors.map((r) => r['アクター']).filter(isRealValue));
  const definedExternals = new Set(model.externals.map((r) => r['外部システム']).filter(isRealValue));
  const definedInfos = new Set(model.infos.map((r) => r['情報']).filter(isRealValue));
  const definedConditions = new Set(model.conditions.map((r) => r['条件']).filter(isRealValue));
  const definedVariations = new Set(model.variations.map((r) => r['バリエーション']).filter(isRealValue));
  const definedStateModels = new Set(model.states.map((r) => r['状態モデル']).filter(isRealValue));
  const definedUcs = new Set(model.buc.map((r) => r['UC']).filter(isRealValue));

  // BUC シートで参照されているオブジェクト（関連モデル1/2 の両方を見る）
  const refs = { アクター: new Map(), 外部システム: new Map(), 情報: new Map(), 条件: new Map() };
  for (const row of model.buc) {
    const pairs = [
      [row['関連モデル1'], row['関連オブジェクト1']],
      [row['関連モデル2'], row['関連オブジェクト2']],
    ];
    for (const [m, o] of pairs) {
      if (refs[m] && isRealValue(o) && !refs[m].has(o)) {
        refs[m].set(o, `BUC「${row['BUC']}」/ UC「${row['UC'] || '（なし）'}」`);
      }
    }
  }

  // 1-4. BUC シートで参照されているが定義シートに存在しないもの
  const undefinedChecks = [
    ['未定義「アクター」', refs['アクター'], definedActors],
    ['未定義「外部システム」', refs['外部システム'], definedExternals],
    ['未定義「情報」', refs['情報'], definedInfos],
    ['未定義「条件」', refs['条件'], definedConditions],
  ];
  for (const [check, referenced, defined] of undefinedChecks) {
    for (const [name, from] of referenced) {
      if (!defined.has(name)) add(check, name, `${from} から参照`);
    }
  }

  // 5-7. 情報シートの参照先が未定義のもの
  for (const row of model.infos) {
    if (!isRealValue(row['情報'])) continue;
    for (const rel of splitList(row['関連情報'])) {
      if (isRealValue(rel) && !definedInfos.has(rel)) {
        add('未定義「関連情報」', rel, `情報「${row['情報']}」の関連情報`);
      }
    }
    for (const sm of splitList(row['状態モデル'])) {
      if (isRealValue(sm) && !definedStateModels.has(sm)) {
        add('未定義「状態モデル」（情報）', sm, `情報「${row['情報']}」の状態モデル`);
      }
    }
    for (const vr of splitList(row['バリエーション'])) {
      if (isRealValue(vr) && !definedVariations.has(vr)) {
        add('未定義「バリエーション」（情報）', vr, `情報「${row['情報']}」のバリエーション`);
      }
    }
  }

  // 8-9. 状態シート: 遷移UC が BUC 未定義 / 遷移先状態が同一状態モデル内で未定義
  const statesByModel = new Map();
  for (const row of model.states) {
    const key = (row['コンテキスト'] || '') + ' ' + (row['状態モデル'] || '');
    if (!statesByModel.has(key)) {
      statesByModel.set(key, { name: row['状態モデル'], defined: new Set(), rows: [] });
    }
    const g = statesByModel.get(key);
    if (isRealValue(row['状態'])) g.defined.add(row['状態']);
    g.rows.push(row);
  }
  for (const g of statesByModel.values()) {
    for (const row of g.rows) {
      const uc = row['遷移UC'];
      if (isRealValue(uc) && !definedUcs.has(uc)) {
        add('未定義「UC」（状態）', uc, `状態モデル「${g.name}」の遷移UC`);
      }
      const to = row['遷移先状態'];
      if (isRealValue(to) && !g.defined.has(to)) {
        add('未定義遷移先「状態」', to, `状態モデル「${g.name}」の遷移先状態（状態カラムに未定義）`);
      }
    }
  }

  // 10-11. 条件シートの参照先が未定義のもの
  for (const row of model.conditions) {
    if (!isRealValue(row['条件'])) continue;
    for (const vr of splitList(row['バリエーション'])) {
      if (isRealValue(vr) && !definedVariations.has(vr)) {
        add('未定義「バリエーション」（条件）', vr, `条件「${row['条件']}」のバリエーション`);
      }
    }
    for (const sm of splitList(row['状態モデル'])) {
      if (isRealValue(sm) && !definedStateModels.has(sm)) {
        add('未定義「状態モデル」（条件）', sm, `条件「${row['条件']}」の状態モデル`);
      }
    }
  }

  // 12-15. 定義されているが BUC シートで参照されていないもの
  const unconnectedChecks = [
    ['未接続「アクター」', definedActors, refs['アクター']],
    ['未接続「外部システム」', definedExternals, refs['外部システム']],
    ['未接続「情報」', definedInfos, refs['情報']],
    ['未接続「条件」', definedConditions, refs['条件']],
  ];
  for (const [check, defined, referenced] of unconnectedChecks) {
    for (const name of defined) {
      if (!referenced.has(name)) add(check, name, 'BUC シートのどの行からも参照されていない');
    }
  }

  return findings;
}

const VALIDATION_CHECKS = [
  ['未定義「アクター」', 'BUC で参照されているが アクター.tsv で定義されていないアクター'],
  ['未定義「外部システム」', 'BUC で参照されているが 外部システム.tsv で定義されていない外部システム'],
  ['未定義「情報」', 'BUC で参照されているが 情報.tsv で定義されていない情報'],
  ['未定義「条件」', 'BUC で参照されているが 条件.tsv で定義されていない条件'],
  ['未定義「関連情報」', '情報.tsv の関連情報のうち 情報.tsv で定義されていないもの'],
  ['未定義「状態モデル」（情報）', '情報.tsv の状態モデルのうち 状態.tsv で定義されていないもの'],
  ['未定義「バリエーション」（情報）', '情報.tsv のバリエーションのうち バリエーション.tsv で定義されていないもの'],
  ['未定義「UC」（状態）', '状態.tsv の遷移UC のうち BUC.tsv で定義されていない UC'],
  ['未定義遷移先「状態」', '状態.tsv の遷移先状態のうち同一状態モデルの状態カラムに定義されていないもの'],
  ['未定義「バリエーション」（条件）', '条件.tsv のバリエーションのうち バリエーション.tsv で定義されていないもの'],
  ['未定義「状態モデル」（条件）', '条件.tsv の状態モデルのうち 状態.tsv で定義されていないもの'],
  ['未接続「アクター」', '定義されているが BUC で参照されていないアクター'],
  ['未接続「外部システム」', '定義されているが BUC で参照されていない外部システム'],
  ['未接続「情報」', '定義されているが BUC で参照されていない情報'],
  ['未接続「条件」', '定義されているが BUC で参照されていない条件'],
];

function viewValidation(findings) {
  const lines = [GENERATED_NOTE, '', '# 不整合チェック', ''];
  lines.push('RDRA Sheet の「✖不整合」シート相当の整合性チェック結果。');
  lines.push('モデル間の参照整合性（未定義参照・未接続要素）を機械的に検証する。');
  lines.push('');

  if (findings.length === 0) {
    lines.push('✅ **不整合は検出されませんでした。**');
    lines.push('');
  } else {
    lines.push(`⚠️ **${findings.length} 件の不整合が検出されました。**`);
    lines.push('');
    lines.push('| チェック | 対象 | 詳細 |');
    lines.push('|---|---|---|');
    for (const f of findings) {
      lines.push(`| ${esc(f.check)} | ${esc(f.target)} | ${esc(f.detail)} |`);
    }
    lines.push('');
  }

  lines.push('## チェック項目サマリ');
  lines.push('');
  lines.push('| # | チェック | 内容 | 件数 |');
  lines.push('|---|---|---|---|');
  VALIDATION_CHECKS.forEach(([check, desc], i) => {
    const count = findings.filter((f) => f.check === check).length;
    lines.push(`| ${i + 1} | ${esc(check)} | ${esc(desc)} | ${count} |`);
  });
  lines.push('');
  return lines.join('\n');
}

// ============================================================
// README（目次）
// ============================================================

function viewReadme(model, files) {
  const lines = [GENERATED_NOTE, '', `# ${model.systemName} — RDRA ビュー`, ''];
  if (model.systemOverview) {
    lines.push(model.systemOverview);
    lines.push('');
  }
  lines.push('`docs/rdra/latest/*.tsv` から自動生成した、ヒトが読むための RDRA ビュー集。');
  lines.push('');

  lines.push('| ビュー | RDRA レイヤー | 内容 |');
  lines.push('|---|---|---|');
  const meta = [
    ['00_不整合チェック.md', '整合性', 'RDRA Sheet「✖不整合」相当の参照整合性チェック結果'],
    ['01_システムコンテキスト.md', 'システム価値', 'アクター・外部システムの全体像'],
    ['02_業務構成.md', 'システム外部環境', '業務と BUC の構成'],
    ['03_業務フロー.md', 'システム外部環境', 'BUC ごとのアクティビティフロー'],
    ['04_UC複合図.md', 'システム境界', 'UC と画面・イベント・情報・条件の関係'],
    ['05_情報モデル.md', 'システム内部', '情報と情報間の関連'],
    ['06_状態モデル.md', 'システム内部', '状態遷移（遷移ラベルは UC）'],
    ['07_条件・バリエーション.md', 'システム内部', 'ビジネスルールと区分・種別'],
  ];
  for (const [file, layer, desc] of meta) {
    if (files.includes(file)) {
      lines.push(`| [${file.replace(/\.md$/, '')}](${encodeURI(file)}) | ${layer} | ${desc} |`);
    }
  }
  lines.push('');

  // モデル件数
  const uniq = (arr) => new Set(arr.filter(Boolean)).size;
  lines.push('## モデル件数');
  lines.push('');
  lines.push('| モデル | 件数 |');
  lines.push('|---|---|');
  lines.push(`| アクター | ${model.actors.length} |`);
  lines.push(`| 外部システム | ${model.externals.length} |`);
  lines.push(`| 業務 | ${uniq(model.buc.map((r) => r['業務']))} |`);
  lines.push(`| BUC | ${uniq(model.buc.map((r) => r['BUC']))} |`);
  lines.push(`| アクティビティ | ${uniq(model.buc.filter((r) => r['アクティビティ']).map((r) => r['BUC'] + ' ' + r['アクティビティ']))} |`);
  lines.push(`| UC | ${uniq(model.buc.map((r) => r['UC']))} |`);
  lines.push(`| 情報 | ${model.infos.length} |`);
  lines.push(`| 状態モデル | ${uniq(model.states.map((r) => r['コンテキスト'] + ' ' + r['状態モデル']))} |`);
  lines.push(`| 条件 | ${model.conditions.length} |`);
  lines.push(`| バリエーション | ${model.variations.length} |`);
  lines.push('');
  return lines.join('\n');
}

// ============================================================
// Main
// ============================================================

function loadModel(dir) {
  const actors = readTsv(path.join(dir, 'アクター.tsv'));
  fillDown(actors.rows, ['アクター群']);
  const externals = readTsv(path.join(dir, '外部システム.tsv'));
  fillDown(externals.rows, ['外部システム群']);
  const buc = readTsv(path.join(dir, 'BUC.tsv'));
  fillDown(buc.rows, ['業務', 'BUC', 'アクティビティ']);
  const infos = readTsv(path.join(dir, '情報.tsv'));
  fillDown(infos.rows, ['コンテキスト']);
  const states = readTsv(path.join(dir, '状態.tsv'));
  fillDown(states.rows, ['コンテキスト', '状態モデル']);
  const conditions = readTsv(path.join(dir, '条件.tsv'));
  fillDown(conditions.rows, ['コンテキスト']);
  const variations = readTsv(path.join(dir, 'バリエーション.tsv'));
  fillDown(variations.rows, ['コンテキスト']);

  let systemName = 'システム';
  let systemOverview = '';
  const overviewPath = path.join(dir, 'システム概要.json');
  if (fs.existsSync(overviewPath)) {
    try {
      const json = JSON.parse(fs.readFileSync(overviewPath, 'utf-8'));
      if (json.system_name) systemName = json.system_name;
      if (json.system_overview) systemOverview = json.system_overview;
    } catch (e) {
      console.error(`Warning: システム概要.json の読み込みに失敗: ${e.message}`);
    }
  }

  return {
    systemName,
    systemOverview,
    actors: actors.rows,
    externals: externals.rows,
    buc: buc.rows,
    infos: infos.rows,
    states: states.rows,
    conditions: conditions.rows,
    variations: variations.rows,
  };
}

function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const strict = process.argv.includes('--strict');
  const inputDir = path.resolve(args[0] || 'docs/rdra/latest');
  const outputDir = path.resolve(args[1] || path.join(inputDir, 'views'));

  if (!fs.existsSync(inputDir)) {
    console.error(`Error: Directory not found: ${inputDir}`);
    process.exit(1);
  }

  const model = loadModel(inputDir);

  // 不整合チェック（RDRA Sheet「✖不整合」相当）
  const findings = validateModel(model);

  // 生成対象を決定（データが無いビューはスキップ）
  const outputs = [];
  outputs.push(['00_不整合チェック.md', viewValidation(findings)]);
  if (model.actors.length > 0 || model.externals.length > 0) {
    outputs.push(['01_システムコンテキスト.md', viewSystemContext(model)]);
  }
  if (model.buc.length > 0) {
    outputs.push(['02_業務構成.md', viewBusinessStructure(model)]);
    outputs.push(['03_業務フロー.md', viewBusinessFlow(model)]);
    outputs.push(['04_UC複合図.md', viewUcComposite(model)]);
  }
  if (model.infos.length > 0) {
    outputs.push(['05_情報モデル.md', viewInformationModel(model)]);
  }
  if (model.states.length > 0) {
    outputs.push(['06_状態モデル.md', viewStateModel(model)]);
  }
  if (model.conditions.length > 0 || model.variations.length > 0) {
    outputs.push(['07_条件・バリエーション.md', viewConditionVariation(model)]);
  }

  // 出力ディレクトリを用意し、既存の生成 .md を削除（廃止ビューの残骸を防ぐ）
  fs.mkdirSync(outputDir, { recursive: true });
  for (const file of fs.readdirSync(outputDir)) {
    if (file.endsWith('.md')) fs.unlinkSync(path.join(outputDir, file));
  }

  const fileNames = outputs.map(([name]) => name);
  outputs.push(['README.md', viewReadme(model, fileNames)]);

  for (const [name, content] of outputs) {
    fs.writeFileSync(path.join(outputDir, name), content, 'utf-8');
  }

  console.log(`Generated: ${outputDir}`);
  for (const [name] of outputs) {
    console.log(`  ${name}`);
  }

  if (findings.length === 0) {
    console.log('不整合チェック: OK（0 件）');
  } else {
    console.log(`不整合チェック: ⚠ ${findings.length} 件検出（詳細: ${path.join(outputDir, '00_不整合チェック.md')}）`);
    for (const f of findings) {
      console.log(`  - ${f.check}: ${f.target} — ${f.detail}`);
    }
    if (strict) process.exit(1);
  }
}

main();
