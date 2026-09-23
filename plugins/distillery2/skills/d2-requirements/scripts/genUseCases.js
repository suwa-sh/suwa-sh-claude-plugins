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
 * 既存 use-cases.yaml があれば uc_id をキーに slug / status / tiers_hint / spec_ids_rejected を引き継ぐ
 * (LLM が編集した値を再生成で上書きしない)。
 * spec_ids の再生成は却下済みを尊重する:
 *   candidates   = 今回の推定 − 既存 spec_ids − 既存 spec_ids_rejected (今回はじめて出た候補だけ)
 *   spec_ids     = 既存 spec_ids ∪ candidates (sorted / unique。既に絞った SPEC は保持)
 *   spec_ids_added = candidates (新規候補だけ。無ければキーごと省く)
 * spec_ids_rejected は LLM が外した SPEC の置き場。毎回 [] を出力し (LLM が id を移す)、
 * 再生成では uc_id をキーに引き継ぐので、一度却下した候補は spec_ids へ戻らない。
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

/**
 * 既存 use-cases.yaml を uc_id をキーに読む。
 * 解析できないファイルを黙って捨てると slug / status / spec_ids_rejected などの手編集が失われるため、
 * forceRebuild でない限り解析失敗を例外にする (呼び出し側で exit 2)。
 */
function parseErr(msg, forceRebuild) {
  if (forceRebuild) return null;
  const err = new Error(`既存 use-cases.yaml の解析に失敗: ${msg}`);
  err.code = 'EXISTING_PARSE';
  return err;
}

function readExisting(outPath, { forceRebuild = false } = {}) {
  const byId = new Map();
  if (!fs.existsSync(outPath)) return byId;
  const raw = fs.readFileSync(outPath, 'utf8');
  if (raw.trim() === '') return byId; // 空ファイルは「既存なし」扱い
  let prev;
  try {
    prev = parseYaml(raw);
  } catch (e) {
    // 共有パーサは JSON パス (先頭が [ / {) でだけ例外を投げる。
    const err = parseErr(e.message, forceRebuild);
    if (err) throw err;
    return byId;
  }
  // それ以外の構文誤りは例外にならず壊れたオブジェクトになるため、構造で判定する。
  // use_cases が配列として読めない非空ファイルは、手編集の取りこぼしを避けて解析失敗扱いにする。
  if (!prev || typeof prev !== 'object' || Array.isArray(prev) || !Array.isArray(prev.use_cases)) {
    const err = parseErr('use_cases 配列として読み取れない (構文誤りの可能性)', forceRebuild);
    if (err) throw err;
    return byId;
  }
  for (const uc of prev.use_cases) if (uc && uc.uc_id) byId.set(uc.uc_id, uc);
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
    // 既存の spec_ids (LLM が絞った値) と却下済み (spec_ids_rejected) を尊重する。
    // candidates は「今回はじめて推定された候補」だけ。既に外した SPEC は再び戻さない。
    const prevSpecs = Array.isArray(prev.spec_ids) ? prev.spec_ids : [];
    const prevRejected = Array.isArray(prev.spec_ids_rejected) ? prev.spec_ids_rejected : [];
    const candidates = inferredSpecs.filter((s) => !prevSpecs.includes(s) && !prevRejected.includes(s));
    const specIds = Array.from(new Set([...prevSpecs, ...candidates])).sort();
    const uc = {
      uc_id: id,
      business: g.business,
      buc: g.buc,
      uc: g.uc,
      slug: typeof prev.slug === 'string' && prev.slug && prev.slug !== `uc-${id}` ? prev.slug : `uc-${id}`,
      spec_ids: specIds,
      spec_ids_rejected: Array.from(new Set(prevRejected)).sort(),
      actors: Array.from(g.actors),
      tiers_hint: Array.isArray(prev.tiers_hint) && prev.tiers_hint.length ? prev.tiers_hint : inferTiers(g),
      status: typeof prev.status === 'string' ? prev.status : 'planned',
    };
    // spec_ids_added は「新規候補があるときだけ」出す (無ければキーごと省く)。
    if (candidates.length) uc.spec_ids_added = candidates.slice().sort();
    return uc;
  });

  return {
    version: '1.0',
    system_name: (reqData && reqData.system_name) || '',
    use_cases: useCases,
  };
}

function main() {
  const argv = process.argv.slice(2);
  const forceRebuild = argv.includes('--force-rebuild');
  const positional = argv.filter((a) => !a.startsWith('--'));
  const reqPath = path.resolve(positional[0] || 'docs/requirements/requirements.yaml');
  const bucPath = path.resolve(positional[1] || 'docs/requirements/rdra/BUC.tsv');
  const outPath = path.resolve(positional[2] || 'docs/requirements/use-cases.yaml');
  for (const [label, p] of [['requirements.yaml', reqPath], ['BUC.tsv', bucPath]]) {
    if (!fs.existsSync(p)) { console.error(`File not found (${label}): ${p}`); process.exit(2); }
  }
  let existing;
  try {
    existing = readExisting(outPath, { forceRebuild });
  } catch (e) {
    if (e.code === 'EXISTING_PARSE') {
      console.error(e.message);
      console.error('  上書きを避けて中断した。手編集の値 (slug / status / spec_ids_rejected) を失わないため。');
      console.error('  壊れた use-cases.yaml を直すか、破棄してよければ --force-rebuild を付けて作り直す。');
      process.exit(2);
    }
    throw e;
  }
  const reqData = parseYaml(fs.readFileSync(reqPath, 'utf8'));
  const bucText = fs.readFileSync(bucPath, 'utf8');
  const doc = generate(reqData, bucText, existing);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, stringifyYaml(doc) + '\n', 'utf8');
  const filled = doc.use_cases.filter((u) => u.spec_ids.length).length;
  const named = doc.use_cases.filter((u) => !/^uc-[0-9a-f]+$/.test(u.slug)).length;
  console.log(`Generated: ${outPath}`);
  console.log(`  UCs: ${doc.use_cases.length}  spec_ids 推定済: ${filled}  slug 確定済: ${named}`);
  // spec_ids が空のままの UC は validateUseCases で FAIL する。LLM が SPEC を当てるか no_spec_reason を書く必要がある。
  const empty = doc.use_cases.filter((u) => !u.spec_ids.length);
  if (empty.length) {
    console.warn(`  警告: spec_ids が空の UC が ${empty.length} 件ある。SPEC を当てるか no_spec_reason を書いて status: blocked にするまで validateUseCases は FAIL する:`);
    for (const u of empty) console.warn(`    - ${u.business} / ${u.buc} / ${u.uc} (uc_id: ${u.uc_id})`);
  }
}

if (require.main === module) main();

module.exports = { ucId, buildFlowSpecMap, parseBucTsv, inferTiers, generate, readExisting };
