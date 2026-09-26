'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SKILL_DIR = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-contract');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
const mdFiles = walk(SKILL_DIR).filter(f => f.endsWith('.md'));

test('SKILL.md の name は d2-contract (Agent Skills 仕様: ディレクトリ名と同じ)', () => {
  const text = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
  assert.match(text, /^name:\s*d2-contract\s*$/m);
});

test('SKILL.md は 220 行以下', () => {
  const lines = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8').split('\n').length;
  assert.ok(lines <= 220, `SKILL.md は ${lines} 行`);
});

test('md は廃止概念 (_api-summary / legacy / specs/latest / events/ / arch-design.yaml) を含まない', () => {
  const forbidden = ['_api-summary', 'legacy', 'specs/latest', 'events/', 'arch-design.yaml'];
  for (const f of mdFiles) {
    const text = fs.readFileSync(f, 'utf8');
    for (const bad of forbidden) assert.ok(!text.includes(bad), `${path.relative(SKILL_DIR, f)} が "${bad}" を含む`);
  }
});

test('md の相対リンクはすべて実在する', () => {
  for (const f of mdFiles) {
    const text = fs.readFileSync(f, 'utf8');
    const links = [...text.matchAll(/\]\(([^)]+)\)/g)].map(m => m[1]).filter(l => !/^(https?:|#|\$\{)/.test(l));
    for (const link of links) {
      const target = path.resolve(path.dirname(f), link.split('#')[0]);
      assert.ok(fs.existsSync(target), `${path.relative(SKILL_DIR, f)} のリンク先が無い: ${link}`);
    }
  }
});
