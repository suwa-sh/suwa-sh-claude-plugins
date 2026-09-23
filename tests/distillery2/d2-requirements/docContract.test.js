'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SKILL_DIR = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-requirements');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
const mdFiles = walk(SKILL_DIR).filter(f => f.endsWith('.md'));

test('SKILL.md の name は distillery2:d2-requirements', () => {
  const text = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
  assert.match(text, /^name:\s*distillery2:d2-requirements\s*$/m);
});

test('SKILL.md はイベントソーシングの廃止概念を含まない', () => {
  const text = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
  for (const bad of ['events/', 'latest/', 'trigger_event', '_changes.md']) {
    assert.ok(!text.includes(bad), `SKILL.md が禁止文字列 "${bad}" を含む`);
  }
});

test('references もイベントソーシングのパス指示を含まない', () => {
  for (const f of mdFiles) {
    const text = fs.readFileSync(f, 'utf8');
    for (const bad of ['events/', 'trigger_event', '_changes.md']) {
      assert.ok(!text.includes(bad), `${path.relative(SKILL_DIR, f)} が禁止文字列 "${bad}" を含む`);
    }
  }
});

test('SKILL.md と references の相対リンクはすべて実在する', () => {
  for (const f of mdFiles) {
    const text = fs.readFileSync(f, 'utf8');
    const links = [...text.matchAll(/\]\(([^)]+)\)/g)].map(m => m[1]).filter(l => !/^(https?:|#|\$\{|mailto:)/.test(l));
    for (const link of links) {
      const target = path.resolve(path.dirname(f), link.split('#')[0]);
      assert.ok(fs.existsSync(target), `${path.relative(SKILL_DIR, f)} のリンク先が無い: ${link}`);
    }
  }
});
