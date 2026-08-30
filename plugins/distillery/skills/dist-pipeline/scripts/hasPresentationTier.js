#!/usr/bin/env node
'use strict';

// arch-design.yaml の system_architecture.tiers[].id だけを検査し、presentation 系 tier
// (id のトークンに frontend / presentation / ui / web / spa / mobile を含む)の有無を判定する。
// layer id(例: L-backend-api-presentation)を誤検出しないよう、tiers 配列以外は見ない。
//
// 使い方: node hasPresentationTier.js docs/arch/latest/arch-design.yaml [docs/rdra/latest/システム概要.json]
// 出力: JSON {"tier_ids":[...], "presentation_tiers":[...], "interface_kind":"gui|cli|api|batch",
//             "has_presentation_tier": bool, "recommend_design_skip": bool}
// 終了コード: 0 = design skip を推奨しない / 1 = 推奨する(interface_kind != gui または presentation tier 無し)/ 2 = 入力エラー

const fs = require('node:fs');
const path = require('node:path');

const { parseYaml } = require(path.join(__dirname, '..', '..', 'dist-spec', 'scripts', 'lib', 'yaml-parser.js'));

// id を - / _ / . / 空白で分割したトークンの完全一致で判定する(部分文字列だと "build" の ui を誤検出する)
const PRESENTATION_TOKENS = new Set(['frontend', 'presentation', 'ui', 'web', 'spa', 'mobile']);
const PRESENTATION_RE = /^(frontend|presentation|ui|web|spa|mobile)$/i;

function isPresentationTierId(id) {
  return String(id).split(/[-_.\s]+/).some(token => PRESENTATION_TOKENS.has(token.toLowerCase()));
}

function presentationTiers(archDesign) {
  const tiers = archDesign?.system_architecture?.tiers;
  if (!Array.isArray(tiers)) throw new Error('system_architecture.tiers is not an array');
  const ids = tiers.map(tier => String(tier?.id ?? '')).filter(Boolean);
  return { tier_ids: ids, presentation_tiers: ids.filter(isPresentationTierId) };
}

// システム概要.json の interface_kind(省略時 gui)。dist-requirements 1.5.0 以降が記録する
function readInterfaceKind(file) {
  if (!file || !fs.existsSync(file)) return 'gui';
  const value = JSON.parse(fs.readFileSync(file, 'utf8'))?.interface_kind;
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : 'gui';
}

// design skip を推奨する条件: interface_kind が gui 以外 OR presentation 系 tier が無い(dist-design-system の Step0 と同じ規則)
function evaluate(archDesign, interfaceKind) {
  const result = presentationTiers(archDesign);
  const hasPresentationTier = result.presentation_tiers.length > 0;
  return {
    ...result,
    interface_kind: interfaceKind,
    has_presentation_tier: hasPresentationTier,
    recommend_design_skip: interfaceKind !== 'gui' || !hasPresentationTier,
  };
}

function main() {
  const [file, overviewFile] = process.argv.slice(2);
  if (!file) {
    console.error('usage: hasPresentationTier.js <arch-design.yaml> [システム概要.json]');
    process.exit(2);
  }
  let output;
  try {
    output = evaluate(parseYaml(fs.readFileSync(file, 'utf8')), readInterfaceKind(overviewFile));
  } catch (error) {
    console.error(`hasPresentationTier: ${error.message}`);
    process.exit(2);
  }
  console.log(JSON.stringify(output));
  // exit 0 = design を実行してよい(推奨しない) / 1 = design skip を推奨
  process.exit(output.recommend_design_skip ? 1 : 0);
}

if (require.main === module) main();

module.exports = { presentationTiers, isPresentationTierId, evaluate, readInterfaceKind, PRESENTATION_RE };
