'use strict';
/**
 * checks.js — 機械チェックの ADR (front matter の checks) から、config のコマンドを作る (0.3.0)
 *
 * 機械チェックの観点は 6 つ: generate / format / lint / build / test / security。
 * リポ全体 (repo) は文書類と設定に、ティアごと (tiers) はソースに当てる。generate は生成物の表 (d2-common/scripts/lib/generators.js) が決める。
 *
 * ADR の書き方 (accepted で scope に system を含む 1 本だけ。validateAdr が検査):
 *   checks:
 *     repo:   {format: biome, lint: qlty, security: [secrets]}
 *     tiers:
 *       "*":          {format: biome, lint: biome, build: tsc, test: vitest, security: [dependency-audit, sast]}
 *       backend-api:  {security: [dependency-audit, sast]}      # ティア id で上書きできる
 * 値は下の既知の道具の名前か、{cmd: "<コマンド>"} (ティアは {dir} を apps/ の下の名前に置き換える)。
 * checks が無ければ既定 (DEFAULTS) を使う。
 */

const QLTY = 'qlty check --no-fix --no-progress --no-upgrade-check --no-formatters --fail-level medium';

const TIER_TOOLS = {
  format: { biome: 'npm run format:check -w apps/{dir}' },
  lint: { biome: 'npm run lint -w apps/{dir}' },
  build: { tsc: 'npm run build -w apps/{dir}' },
  test: { vitest: 'npm run test -w apps/{dir} -- --run --reporter=json --outputFile={report}' },
  security: {
    'dependency-audit': 'npm audit -w apps/{dir} --audit-level=high --omit=dev',
    sast: `${QLTY} apps/{dir}`,
  },
};
const REPO_TOOLS = {
  format: { biome: 'npx biome format .' },
  lint: { qlty: `${QLTY.replace('qlty check', 'qlty check --all')}` },
  security: { secrets: `${QLTY.replace('qlty check', 'qlty check --all')} --filter trufflehog` },
};

const DEFAULTS = {
  repo: { format: 'biome', lint: 'qlty', security: ['secrets'] },
  tiers: { '*': { format: 'biome', lint: 'biome', build: 'tsc', test: 'vitest', security: ['dependency-audit', 'sast'] } },
};

class ChecksError extends Error {}

function toolCmd(table, aspect, v, where) {
  if (v && typeof v === 'object' && typeof v.cmd === 'string' && v.cmd.trim()) return v.cmd.trim();
  const known = table[aspect] || {};
  if (typeof v === 'string' && known[v]) return known[v];
  throw new ChecksError(`checks の ${where}.${aspect} に知らない道具: ${JSON.stringify(v)} (既知: ${Object.keys(known).join(', ') || 'なし'}。または {cmd: "..."})`);
}

const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

/** 機械チェックの ADR の checks (無ければ null) */
function collectChecks(adrs) {
  const hits = adrs.filter((a) => a.fm && a.fm.status === 'accepted' && a.fm.checks);
  return hits.length ? hits[0].fm.checks : null;
}

/** ティアのコマンド: format_check / lint / build / unit / security (文字列。複数の道具は && でつなぐ) */
function tierCheckCommands(checks, tierId, dir) {
  const c = checks || DEFAULTS;
  const base = { ...(DEFAULTS.tiers['*']), ...((c.tiers || {})['*'] || {}), ...((c.tiers || {})[tierId] || {}) };
  const sub = (s) => s.replace(/\{dir\}/g, dir);
  const out = {
    format_check: sub(toolCmd(TIER_TOOLS, 'format', base.format, `tiers.${tierId}`)),
    lint: sub(toolCmd(TIER_TOOLS, 'lint', base.lint, `tiers.${tierId}`)),
    build: sub(toolCmd(TIER_TOOLS, 'build', base.build, `tiers.${tierId}`)),
    unit: sub(toolCmd(TIER_TOOLS, 'test', base.test, `tiers.${tierId}`)),
  };
  const sec = list(base.security).map((v) => sub(toolCmd(TIER_TOOLS, 'security', v, `tiers.${tierId}`)));
  if (sec.length) out.security = sec.join(' && ');
  return out;
}

/** リポ全体のコマンド: format / quality (lint) / secrets (security) */
function repoCheckCommands(checks) {
  const c = checks || DEFAULTS;
  const r = { ...DEFAULTS.repo, ...(c.repo || {}) };
  const out = {};
  if (r.format) out.format = toolCmd(REPO_TOOLS, 'format', r.format, 'repo');
  if (r.lint) out.quality = toolCmd(REPO_TOOLS, 'lint', r.lint, 'repo');
  const sec = list(r.security).map((v) => toolCmd(REPO_TOOLS, 'security', v, 'repo'));
  if (sec.length) out.secrets = sec.join(' && ');
  return out;
}

/** checks の形の検査 (validateAdr が使う)。エラーの文の配列 */
function validateChecks(checks, tierIds = null) {
  const errors = [];
  if (!checks || typeof checks !== 'object') return ['checks はオブジェクト ({repo, tiers})'];
  for (const k of Object.keys(checks)) if (!['repo', 'tiers'].includes(k)) errors.push(`checks.${k}: repo と tiers だけ`);
  try { repoCheckCommands(checks); } catch (e) { errors.push(e.message); }
  for (const id of Object.keys(checks.tiers || {})) {
    if (id !== '*' && tierIds && !tierIds.includes(id)) errors.push(`checks.tiers.${id}: ティア構成の ADR に無いティア`);
    try { tierCheckCommands(checks, id, 'x'); } catch (e) { errors.push(e.message); }
  }
  return errors;
}

module.exports = { TIER_TOOLS, REPO_TOOLS, DEFAULTS, collectChecks, tierCheckCommands, repoCheckCommands, validateChecks, ChecksError };
