#!/usr/bin/env node
/**
 * basis.js — 「どの上流コミットを基に作ったか」の記録と照合
 *
 * 生成物の先頭 (最初の 10 行以内) に 1 行で書く。コメント記法は問わない:
 *   basis: requirements@<sha> adr@<sha> contracts@<sha>
 * YAML front matter では `basis: requirements@... adr@...` の文字列スカラーになる。
 *
 * CLI:
 *   node basis.js stamp requirements=docs/requirements adr=docs/adr      # 1 行を stdout に出す
 *   node basis.js check <file>... requirements=docs/requirements ...     # 古い basis を報告。--strict で exit 1
 *
 * 現版は stamp / check のみ。差分 (diff) は未対応。
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const HEADER_RE = /basis:\s*((?:[A-Za-z0-9_-]+@[0-9a-f]{7,40}\s*)+)/;
const SCAN_LINES = 10;

function lastCommit(dir, cwd = process.cwd()) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%H', '--', dir], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return out || null;
  } catch { return null; }
}

/** @param {Record<string,string>} dirs  name → directory */
function stamp(dirs, cwd = process.cwd()) {
  const basis = {};
  for (const [name, dir] of Object.entries(dirs)) basis[name] = lastCommit(dir, cwd);
  return basis;
}

function headerLine(basis) {
  const parts = Object.entries(basis).filter(([, sha]) => sha).map(([n, sha]) => `${n}@${sha}`);
  return `basis: ${parts.join(' ')}`;
}

function parseHeader(text) {
  const head = text.split('\n').slice(0, SCAN_LINES).join('\n');
  const m = head.match(HEADER_RE);
  if (!m) return null;
  const basis = {};
  for (const tok of m[1].trim().split(/\s+/)) {
    const [name, sha] = tok.split('@');
    basis[name] = sha;
  }
  return basis;
}

function check(filePath, dirs, cwd = process.cwd()) {
  const text = fs.readFileSync(filePath, 'utf8');
  const recorded = parseHeader(text);
  if (!recorded) return { file: filePath, missing: true, entries: [] };
  const entries = Object.entries(recorded).map(([name, sha]) => {
    const current = dirs[name] ? lastCommit(dirs[name], cwd) : null;
    return { name, recorded: sha, current, stale: Boolean(current) && !current.startsWith(sha) };
  });
  return { file: filePath, missing: false, entries };
}

function parseDirArgs(args) {
  const dirs = {};
  const rest = [];
  for (const a of args) {
    const m = a.match(/^([A-Za-z0-9_-]+)=(.+)$/);
    if (m) dirs[m[1]] = m[2]; else rest.push(a);
  }
  return { dirs, rest };
}

function main(argv) {
  const [cmd, ...args] = argv;
  const strict = args.includes('--strict');
  const { dirs, rest } = parseDirArgs(args.filter(a => a !== '--strict'));
  if (cmd === 'stamp') { console.log(headerLine(stamp(dirs))); return 0; }
  if (cmd === 'check') {
    let stale = 0;
    for (const file of rest) {
      const r = check(path.resolve(file), dirs);
      if (r.missing) { console.log(`MISSING ${file}`); stale++; continue; }
      for (const e of r.entries) {
        console.log(`${e.stale ? 'STALE ' : 'OK    '} ${file} ${e.name}@${e.recorded.slice(0, 12)}${e.stale ? ` -> ${e.current.slice(0, 12)}` : ''}`);
        if (e.stale) stale++;
      }
    }
    return strict && stale ? 1 : 0;
  }
  console.error('Usage: basis.js stamp <name>=<dir>... | check <file>... <name>=<dir>... [--strict]');
  return 2;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { lastCommit, stamp, headerLine, parseHeader, check, HEADER_RE };
