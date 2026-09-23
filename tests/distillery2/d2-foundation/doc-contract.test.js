'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SKILL = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-foundation');
const skillMd = fs.readFileSync(path.join(SKILL, 'SKILL.md'), 'utf8');

test('SKILL.md has correct name', () => {
  assert.ok(/^name:\s*distillery2:d2-foundation\s*$/m.test(skillMd), 'name field wrong');
});

test('SKILL.md drops v1 concepts', () => {
  for (const banned of ['docs/impl', 'events/', 'latest/', 'ティア BDD', 'tier BDD']) {
    assert.ok(!skillMd.includes(banned), `SKILL.md still mentions "${banned}"`);
  }
});

test('SKILL.md relative reference links resolve', () => {
  const links = [...skillMd.matchAll(/\]\((references\/[^)]+|\.\.\/[^)]+)\)/g)].map(m => m[1]);
  assert.ok(links.length >= 5, 'expected several reference links');
  for (const link of links) {
    const target = link.endsWith('/') ? link.slice(0, -1) : link;
    assert.ok(fs.existsSync(path.resolve(SKILL, target)), `broken link: ${link}`);
  }
});

test('SKILL.md is within length budget', () => {
  assert.ok(skillMd.split('\n').length <= 220, 'SKILL.md exceeds 220 lines');
});

test('rule templates: testing.md uses 4 layers, no tier BDD as a layer', () => {
  const testing = fs.readFileSync(path.join(SKILL, 'references/rule-templates/testing.md'), 'utf8');
  for (const layer of ['受入', 'UC BDD', '契約', '単体']) assert.ok(testing.includes(layer), `missing layer ${layer}`);
  assert.ok(!/ティア BDD/.test(testing) && !/tier BDD/.test(testing), 'tier BDD present as a layer');
});
