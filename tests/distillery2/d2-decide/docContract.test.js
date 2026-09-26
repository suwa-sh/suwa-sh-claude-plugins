'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SKILL_DIR = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-decide');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
const mdFiles = walk(SKILL_DIR).filter(f => f.endsWith('.md'));

test('SKILL.md の name は d2-decide (Agent Skills 仕様: ディレクトリ名と同じ)', () => {
  const text = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
  assert.match(text, /^name:\s*d2-decide\s*$/m);
});

test('v1 の廃止概念 (events/ latest/ arch-design.yaml) を含まない', () => {
  const forbidden = ['events/', 'latest/', 'arch-design.yaml'];
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

test('required-decisions.md が 8 つの決定領域を列挙する', () => {
  const text = fs.readFileSync(path.join(SKILL_DIR, 'references/required-decisions.md'), 'utf8');
  const areas = ['ティア構成', 'レイヤ構成', '言語', 'データストア', 'テスト', 'メッセージング', '認証', 'UI'];
  for (const area of areas) {
    assert.ok(text.includes(area), `required-decisions.md に決定領域 "${area}" が無い`);
  }
});
