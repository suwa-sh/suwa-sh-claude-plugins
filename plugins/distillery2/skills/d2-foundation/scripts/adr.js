'use strict';
/**
 * adr.js — docs/adr/*.md の front matter を読む (d2-foundation 内の共有ヘルパ)
 *
 * 読む front matter キー (adr-inputs.md が正本):
 *   id, title, status, scope[], nfr_refs[]
 *   rules[]: { scope, text, arch_test?: {from, to, effect, level} }  ※ level は d2-decide の検証専用。ここでは読まない
 *   ティア構成 ADR (accepted かつ非空の tiers[] を持つ 1 本): tiers[]{id,dir,kind,lang,provides[],consumes[]}, datastore_owner
 *   scope に "testing" を含む ADR: capabilities{browser}
 *
 * `status: accepted` の ADR だけが rules / tiers / capabilities に寄与する。
 */
const fs = require('node:fs');
const path = require('node:path');
const { parseYaml } = require('../../../scripts/lib/yaml');

const TIER_KINDS = ['frontend', 'backend', 'worker', 'data-pipeline', 'cli', 'mcp-server'];

function parseFrontMatter(text) {
  const lines = text.split('\n');
  if (lines[0].trim() !== '---') return null;
  let end = -1;
  for (let i = 1; i < lines.length; i++) { if (lines[i].trim() === '---') { end = i; break; } }
  if (end < 0) return null;
  return parseYaml(lines.slice(1, end).join('\n')) || {};
}

/** docs/adr/*.md を id 昇順で読む。index.md は除く。front matter の無いファイルは無視する。 */
function loadAdrs(adrDir) {
  if (!fs.existsSync(adrDir)) return [];
  const files = fs.readdirSync(adrDir).filter(f => f.endsWith('.md') && f !== 'index.md').sort();
  const adrs = [];
  for (const f of files) {
    const fm = parseFrontMatter(fs.readFileSync(path.join(adrDir, f), 'utf8'));
    if (!fm || fm.id == null) continue;
    adrs.push({ file: f, ...fm });
  }
  return adrs.sort((a, b) => String(a.id).localeCompare(String(b.id), 'en', { numeric: true }));
}

const isAccepted = adr => String(adr.status).toLowerCase() === 'accepted';
const hasScope = (adr, s) => Array.isArray(adr.scope) ? adr.scope.includes(s) : adr.scope === s;
const declaresTiers = adr => Array.isArray(adr.tiers) && adr.tiers.length > 0;

/**
 * ティア構成 ADR (accepted かつ非空の tiers[] を持つ 1 本) の tiers[] を集める。
 * 選択条件は validateAdr の tierStructureErrors と一致させる (検証を通れば必ず 1 本)。
 * 空 tiers[] の system ADR を先に拾ってティアが消える取り違えを避けるため、
 * 「非空の tiers[]」で選ぶ (旧実装は "先に現れた system ADR" で空配列を拾いえた)。
 */
function collectTiers(adrs) {
  const declaring = adrs.find(adr => isAccepted(adr) && declaresTiers(adr));
  if (declaring) return { tiers: declaring.tiers, datastore_owner: declaring.datastore_owner || null };
  return { tiers: [], datastore_owner: null };
}

/** 採用済みの testing ADR の capabilities を集める。 */
function collectCapabilities(adrs) {
  for (const adr of adrs) {
    if (isAccepted(adr) && hasScope(adr, 'testing') && adr.capabilities) return adr.capabilities;
  }
  return {};
}

module.exports = { TIER_KINDS, parseFrontMatter, loadAdrs, isAccepted, hasScope, declaresTiers, collectTiers, collectCapabilities };
