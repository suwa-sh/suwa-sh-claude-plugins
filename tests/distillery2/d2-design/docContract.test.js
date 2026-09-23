'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SKILL_DIR = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-design');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
const mdFiles = walk(SKILL_DIR).filter(f => f.endsWith('.md'));

test('SKILL.md の name は distillery2:d2-design', () => {
  const text = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
  assert.match(text, /^name:\s*distillery2:d2-design\s*$/m);
});

test('v1 の廃止概念 (design-event.yaml events/ latest/) を含まない', () => {
  const forbidden = ['design-event.yaml', 'events/', 'latest/'];
  for (const f of mdFiles) {
    const text = fs.readFileSync(f, 'utf8');
    for (const bad of forbidden) {
      assert.ok(!text.includes(bad), `${path.relative(SKILL_DIR, f)} が禁止文字列 "${bad}" を含む`);
    }
  }
});

test('SKILL.md の相対リンクはすべて実在する', () => {
  const text = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
  const links = [...text.matchAll(/\]\(([^)]+)\)/g)].map(m => m[1]).filter(l => !/^(https?:|#|\$\{)/.test(l));
  for (const link of links) {
    const target = path.resolve(SKILL_DIR, link.split('#')[0]);
    assert.ok(fs.existsSync(target), `SKILL.md のリンク先が無い: ${link}`);
  }
});

test('SKILL.md が F6 の受け渡しディレクトリ docs/design/storybook-app/ に言及する', () => {
  const text = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
  assert.ok(text.includes('docs/design/storybook-app'), 'F6 hand-off ディレクトリの記載が無い');
});

test('SKILL.md が screens.yaml と packages/ui に言及する', () => {
  const text = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
  assert.ok(text.includes('screens.yaml'), 'screens.yaml の記載が無い');
  assert.ok(text.includes('packages/ui'), 'packages/ui の記載が無い');
});
