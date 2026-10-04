/**
 * resolveDep.js — プラグインが同梱しない外部モジュール (redocly / ref-parser 等) の所在を解決する
 *
 * 優先順: 環境変数 → 対象リポ (cwd と git root) の node_modules → このリポ (plugin 開発時) → プラグインのルート → d2-common。
 * 起点はスキル群のルート (skills/) からの相対 (0.1.29。プラグイン直下の scripts/ は無い)。
 * v1 (dist-spec/compileContracts.js) の REDOCLY_CLI / ASYNCAPI_REF_PARSER と同じ約束。
 */
'use strict';

const path = require('node:path');
const { execFileSync } = require('node:child_process');

function gitRoot(cwd = process.cwd()) {
  try { return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}

const SKILL_ROOT = path.resolve(__dirname, '..', '..');            // skills/d2-common
const SKILLS_ROOT = path.resolve(SKILL_ROOT, '..');                 // skills/
const PLUGIN_ROOT = path.resolve(SKILLS_ROOT, '..');                // プラグインのルート (平置きでは意味を持たないが、探索しても害は無い)

/**
 * @param {string} spec  require.resolve に渡す指定 (例: '@redocly/cli/bin/cli.js')
 * @param {{env?: string, cwd?: string, extraPaths?: string[]}} opts
 * @returns {string|null} 解決した絶対パス
 */
function resolveDep(spec, opts = {}) {
  if (opts.env && process.env[opts.env]) return path.resolve(process.env[opts.env]);
  const cwd = opts.cwd || process.cwd();
  const paths = [cwd, gitRoot(cwd), path.resolve(PLUGIN_ROOT, '..', '..'), PLUGIN_ROOT, SKILL_ROOT, ...(opts.extraPaths || [])].filter(Boolean);
  try { return require.resolve(spec, { paths }); } catch { return null; }
}

function requireDep(spec, opts = {}) {
  const resolved = resolveDep(spec, opts);
  if (!resolved) throw new Error(`Cannot resolve ${spec}. Install it in the target repo${opts.env ? ` or set ${opts.env}` : ''}.`);
  return require(resolved);
}

module.exports = { resolveDep, requireDep, gitRoot, SKILLS_ROOT, PLUGIN_ROOT };
