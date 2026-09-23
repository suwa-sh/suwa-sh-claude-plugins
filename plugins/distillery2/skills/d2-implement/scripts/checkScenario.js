#!/usr/bin/env node
/**
 * checkScenario.js — UC シナリオ (.feature) の静的確認
 *
 *   node checkScenario.js <feature> --use-cases docs/requirements/use-cases.yaml --requirements docs/requirements/requirements.yaml [--uc <slug>] [--json]
 *
 * 確認すること:
 * - parse できる。Feature 名がある。Scenario が 1 つ以上ある
 * - `@uc:<slug>` タグが Feature に付いている (slug は use-cases.yaml に存在する)
 * - UC の spec_ids が持つ受入基準 (acceptance_criteria) の各項目が、どこかの Scenario に `@acceptance:<SPEC>-<n>` で対応している
 *   (--acceptance-dir で features/acceptance/ も探索範囲に含める)
 * - 使われている `@acceptance:` タグが実在する受入基準を指している
 * 出力: JSON 1 行 {ok, slug, scenarios, covered, missing: [...], unknown_tags: [...], browser}。ok=false なら exit 1
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseYaml } = require('../../../scripts/lib/yaml');
const { parseFeature, parseAcceptanceTag } = require('../../../scripts/lib/gherkin');

function parseArgs(argv) {
  const o = { files: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--use-cases') o.useCases = argv[++i];
    else if (a === '--requirements') o.requirements = argv[++i];
    else if (a === '--uc') o.uc = argv[++i];
    else if (a === '--acceptance-dir') o.acceptanceDir = argv[++i];
    else if (a === '--json') o.json = true;
    else if (a.startsWith('--')) throw new Error(`Unknown arg: ${a}`);
    else o.files.push(a);
  }
  if (!o.files.length || !o.useCases || !o.requirements) throw new Error('Usage: checkScenario.js <feature> --use-cases <yaml> --requirements <yaml> [--uc <slug>] [--acceptance-dir <dir>]');
  return o;
}

function listUseCases(doc) { return doc.use_cases || doc.ucs || []; }

/** requirements.yaml → { 'SPEC-001-01': ['criterion text', ...] } */
function acceptanceIndex(reqDoc) {
  const idx = {};
  for (const r of reqDoc.requirements || []) for (const s of r.specifications || []) idx[s.id] = s.acceptance_criteria || [];
  return idx;
}

/**
 * タグを集める。追加 feature (acceptance/ 等) は、対象 UC のタグ (@uc:<slug>) を Feature か Scenario に持つシナリオだけ数える
 * (他 UC 向けのシナリオが同じ受入基準タグを持っていても、対象 UC の充足にはしない)
 */
function collectTags(features, slug) {
  const tags = new Set();
  features.forEach((f, i) => {
    for (const s of f.scenarios) {
      const all = [...f.tags, ...s.tags];
      if (i > 0 && slug && !all.includes(`@uc:${slug}`)) continue;
      for (const t of all) tags.add(t);
    }
  });
  return tags;
}

function check(o) {
  const ucDoc = parseYaml(fs.readFileSync(o.useCases, 'utf8'));
  const reqDoc = parseYaml(fs.readFileSync(o.requirements, 'utf8'));
  const main = parseFeature(fs.readFileSync(o.files[0], 'utf8'));
  const errors = [];
  if (!main.name) errors.push('Feature 名がありません');
  if (!main.scenarios.length) errors.push('Scenario がありません');
  const ucTag = main.tags.find(t => t.startsWith('@uc:'));
  const slug = o.uc || (ucTag ? ucTag.slice(4) : null);
  if (!ucTag) errors.push('Feature に @uc:<slug> タグがありません');
  else if (o.uc && ucTag !== `@uc:${o.uc}`) errors.push(`@uc タグ (${ucTag}) が引数の slug (${o.uc}) と違います`);
  const uc = listUseCases(ucDoc).find(u => u.slug === slug);
  if (!uc) errors.push(`use-cases.yaml に slug ${slug} がありません`);
  const idx = acceptanceIndex(reqDoc);
  const others = [];
  for (const f of o.files.slice(1)) others.push(parseFeature(fs.readFileSync(f, 'utf8')));
  if (o.acceptanceDir && fs.existsSync(o.acceptanceDir)) {
    for (const name of fs.readdirSync(o.acceptanceDir)) if (name.endsWith('.feature')) others.push(parseFeature(fs.readFileSync(path.join(o.acceptanceDir, name), 'utf8')));
  }
  const tags = collectTags([main, ...others], slug);
  const covered = new Set();
  const unknown = [];
  for (const t of tags) {
    const a = parseAcceptanceTag(t);
    if (!a) continue;
    if (!idx[a.spec] || a.n < 1 || a.n > idx[a.spec].length) unknown.push(t); else covered.add(`${a.spec}-${a.n}`);
  }
  const missing = [];
  for (const spec of (uc && uc.spec_ids) || []) {
    if (!idx[spec]) { missing.push({ spec, n: null, text: '(requirements.yaml に無い SPEC id)' }); continue; }
    idx[spec].forEach((text, i) => { if (!covered.has(`${spec}-${i + 1}`)) missing.push({ spec, n: i + 1, tag: `@acceptance:${spec}-${i + 1}`, text }); });
  }
  const browser = main.scenarios.filter(s => s.tags.includes('@browser')).length;
  const ok = errors.length === 0 && missing.length === 0 && unknown.length === 0;
  return { ok, slug, feature: main.name, scenarios: main.scenarios.length, browser, covered: [...covered].sort(), missing, unknown_tags: unknown, errors };
}

function main(argv) {
  let o;
  try { o = parseArgs(argv); } catch (e) { console.error(e.message); return 2; }
  let r;
  try { r = check(o); } catch (e) { console.error(e.message); return 2; }
  if (o.json || true) console.log(JSON.stringify(r));
  return r.ok ? 0 : 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { check, acceptanceIndex };
