'use strict';
/**
 * adr.js — docs/adr/*.md の front matter を読む (d2-foundation 内の共有ヘルパ)
 *
 * 読む front matter キー (adr-inputs.md が正本):
 *   id, title, status, scope[], nfr_refs[]
 *   rules[]: { scope, text, arch_test?: {from, to, effect} }
 *   scope に "system" を含む ADR: tiers[]{id,dir,kind,lang,provides[],consumes[]}, datastore_owner
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

/** 採用済み ADR の tiers[] を集める (先に現れた system ADR を優先)。 */
function collectTiers(adrs) {
  for (const adr of adrs) {
    if (isAccepted(adr) && hasScope(adr, 'system') && Array.isArray(adr.tiers)) {
      return { tiers: adr.tiers, datastore_owner: adr.datastore_owner || null };
    }
  }
  return { tiers: [], datastore_owner: null };
}

/** 採用済みの testing ADR の capabilities を集める。 */
function collectCapabilities(adrs) {
  for (const adr of adrs) {
    if (isAccepted(adr) && hasScope(adr, 'testing') && adr.capabilities) return adr.capabilities;
  }
  return {};
}

module.exports = { TIER_KINDS, parseFrontMatter, loadAdrs, isAccepted, hasScope, collectTiers, collectCapabilities };
