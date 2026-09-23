'use strict';
// プラグイン内の Markdown の相対リンクがすべて実在するファイルを指すこと
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const plugin = path.resolve(__dirname, '../../../plugins/distillery2');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

test('relative markdown links resolve', () => {
  const broken = [];
  for (const file of walk(plugin)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const target = m[1];
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const clean = target.split('#')[0];
      if (!clean) continue;
      if (!fs.existsSync(path.resolve(path.dirname(file), clean))) broken.push(`${path.relative(plugin, file)} -> ${target}`);
    }
  }
  assert.deepEqual(broken, []);
});

test('no references to v1-only artifacts remain in skill docs', () => {
  const offenders = [];
  for (const file of walk(plugin)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const s of ['docs/impl/', 'specs/latest', '_api-summary.yaml', '_model-summary.yaml', 'docs/usdm/latest', 'docs/rdra/latest']) {
      if (text.includes(s)) offenders.push(`${path.relative(plugin, file)}: ${s}`);
    }
  }
  assert.deepEqual(offenders, []);
});
