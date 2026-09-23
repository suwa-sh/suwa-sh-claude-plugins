#!/usr/bin/env node
/**
 * genUseCases.js (distillery2)
 *
 * requirements.yaml (USDM) + RDRA の BUC.tsv から UC 一覧 (use-cases.yaml) を決定論的に導出する。
 *
 * 導出できる項目: uc_id / business / buc / uc / actors / tiers_hint / spec_ids (フロー単位の推定)。
 * 導出できない項目: slug (英語 kebab-case)。暫定で `uc-<uc_id>` を置き、LLM が意味のある英名へ差し替える。
 * spec_ids はフロー (BUC) 単位で当てた候補。LLM が UC が実現する SPEC へ絞り込む。
 *
 * 既存 use-cases.yaml があれば uc_id をキーに slug / status / tiers_hint を引き継ぐ
 * (LLM が編集した値を再生成で上書きしない)。
 * spec_ids は「既存値 (LLM が絞った SPEC) ∪ 新たな推定候補」の和集合 (sorted / unique) にし、
 * 追加された候補を spec_ids_added に記録する (LLM が採否を再度絞るための差分)。
 *
 * Usage:
 *   node genUseCases.js [requirements.yaml] [BUC.tsv] [out.yaml]
 *   既定: docs/requirements/requirements.yaml  docs/requirements/rdra/BUC.tsv  docs/requirements/use-cases.yaml
 *
 * npm 依存なし。共有ライブラリ (../../../scripts/lib) のみ使用。
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseYaml, stringifyYaml } = require('../../../scripts/lib/yaml');

/** state-schema.md の uc_id 生成式を JS で再現 (NFC 正規化 + Python json.dumps(ensure_ascii=False) 相当)。 */
function ucId(parts, digits = 8) {
  const canonical = '[' + parts.map((p) => JSON.stringify(String(p).normalize('NFC'))).join(', ') + ']';
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex').slice(0, digits);
}

function stripFlow(name) {
  return String(name || '').replace(/フロー$/, '');
}

/** requirements.yaml から「BUC (フロー正規化名) → SPEC id[]」の対応を作る。 */
function buildFlowSpecMap(reqData) {
  const map = new Map();
  const specIds = new Set();
  for (const req of (reqData && reqData.requirements) || []) {
    for (const spec of req.specifications || []) {
      if (spec.id) specIds.add(spec.id);
      for (const m of spec.affected_models || []) {
        if (m && m.type === 'buc' && m.target) {
          const key = stripFlow(m.target);
          if (!map.has(key)) map.set(key, new Set());
          if (spec.id) map.get(key).add(spec.id);
        }
      }
    }
  }
  return { map, specIds };
}

/** BUC.tsv をパースし、(業務,BUC,UC) 単位に UC を集約する。UC 空行 (非システム作業) は除外。 */
function parseBucTsv(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];
  const header = lines[0].split('\t').map((h) => h.trim());
  const col = (name) => header.indexOf(name);
  const ci = {
    business: col('業務'), buc: col('BUC'), uc: col('UC'),
    m1: col('関連モデル1'), o1: col('関連オブジェクト1'),
    m2: col('関連モデル2'), o2: col('関連オブジェクト2'),
    desc: col('説明'),
  };
  const groups = new Map();
  const order = [];
  for (let i = 1; i < lines.length; i++) {
    const v = lines[i].split('\t');
    const cell = (idx) => (idx >= 0 && v[idx] !== undefined ? v[idx].trim() : '');
    const business = cell(ci.business), buc = cell(ci.buc), uc = cell(ci.uc);
    if (!business || !buc || !uc) continue; // UC のない作業行は UC ではない
    const key = JSON.stringify([business, buc, uc]);
    if (!groups.has(key)) {
      groups.set(key, { business, buc, uc, actors: new Set(), related: new Set(), screen: false, timer: false, desc: '' });
      order.push(key);
    }
    const g = groups.get(key);
    for (const [mi, oi] of [[ci.m1, ci.o1], [ci.m2, ci.o2]]) {
      const model = cell(mi), obj = cell(oi);
      if (!model) continue;
      if (model === 'アクター' && obj) g.actors.add(obj);
      else if (obj) g.related.add(obj);
      if (model === '画面') g.screen = true;
      if (model === 'タイマー' || obj === 'タイマー') g.timer = true;
    }
    const d = cell(ci.desc);
    if (d && !g.desc) g.desc = d;
  }
  return order.map((k) => groups.get(k));
}

function inferTiers(g) {
  const tiers = [];
  if (g.screen) tiers.push('frontend');
  tiers.push('backend');
  if (g.timer) tiers.push('worker');
  return tiers;
}

function readExisting(outPath) {
  const byId = new Map();
  if (!fs.existsSync(outPath)) return byId;
  try {
    const prev = parseYaml(fs.readFileSync(outPath, 'utf8'));
    for (const uc of (prev && prev.use_cases) || []) if (uc && uc.uc_id) byId.set(uc.uc_id, uc);
  } catch { /* 壊れていれば無視して作り直す */ }
  return byId;
}

function generate(reqData, bucText, existingById) {
  const { map: flowSpec } = buildFlowSpecMap(reqData);
  const groups = parseBucTsv(bucText);

  // uc_id 衝突検査 → 衝突したら全体を 12 桁へ
  let digits = 8;
  const compute = (d) => groups.map((g) => ucId([g.business, g.buc, g.uc], d));
  let ids = compute(digits);
  if (new Set(ids).size !== ids.length) { digits = 12; ids = compute(digits); }

  const useCases = groups.map((g, i) => {
    const id = ids[i];
    const prev = existingById.get(id) || {};
    const flowKey = stripFlow(g.buc);
    const inferredSpecs = Array.from(flowSpec.get(flowKey) || []).sort();
    // 既存の spec_ids (LLM が絞った値) と新たな推定候補の和集合を取り、SPEC を取りこぼさない。
    // 既存があるときだけ、新規に増えた候補を spec_ids_added に記録し、LLM が採否を絞れるようにする。
    const prevSpecs = Array.isArray(prev.spec_ids) ? prev.spec_ids : [];
    const specIds = Array.from(new Set([...prevSpecs, ...inferredSpecs])).sort();
    const added = prevSpecs.length ? inferredSpecs.filter((s) => !prevSpecs.includes(s)) : [];
    const uc = {
      uc_id: id,
      business: g.business,
      buc: g.buc,
      uc: g.uc,
      slug: typeof prev.slug === 'string' && prev.slug && prev.slug !== `uc-${id}` ? prev.slug : `uc-${id}`,
      spec_ids: specIds,
      actors: Array.from(g.actors),
      tiers_hint: Array.isArray(prev.tiers_hint) && prev.tiers_hint.length ? prev.tiers_hint : inferTiers(g),
      status: typeof prev.status === 'string' ? prev.status : 'planned',
    };
    if (added.length) uc.spec_ids_added = added;
    return uc;
  });

  return {
    version: '1.0',
    system_name: (reqData && reqData.system_name) || '',
    use_cases: useCases,
  };
}

function main() {
  const reqPath = path.resolve(process.argv[2] || 'docs/requirements/requirements.yaml');
  const bucPath = path.resolve(process.argv[3] || 'docs/requirements/rdra/BUC.tsv');
  const outPath = path.resolve(process.argv[4] || 'docs/requirements/use-cases.yaml');
  for (const [label, p] of [['requirements.yaml', reqPath], ['BUC.tsv', bucPath]]) {
    if (!fs.existsSync(p)) { console.error(`File not found (${label}): ${p}`); process.exit(2); }
  }
  const reqData = parseYaml(fs.readFileSync(reqPath, 'utf8'));
  const bucText = fs.readFileSync(bucPath, 'utf8');
  const doc = generate(reqData, bucText, readExisting(outPath));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, stringifyYaml(doc) + '\n', 'utf8');
  const filled = doc.use_cases.filter((u) => u.spec_ids.length).length;
  const named = doc.use_cases.filter((u) => !/^uc-[0-9a-f]+$/.test(u.slug)).length;
  console.log(`Generated: ${outPath}`);
  console.log(`  UCs: ${doc.use_cases.length}  spec_ids 推定済: ${filled}  slug 確定済: ${named}`);
}

if (require.main === module) main();

module.exports = { ucId, buildFlowSpecMap, parseBucTsv, inferTiers, generate };
