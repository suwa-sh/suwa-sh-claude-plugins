'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SKILL_DIR = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-asbuilt');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
const mdFiles = walk(SKILL_DIR).filter((f) => f.endsWith('.md'));

test('SKILL.md の name は distillery2:d2-asbuilt', () => {
  const text = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
  assert.match(text, /^name:\s*distillery2:d2-asbuilt\s*$/m);
});

test('SKILL.md は 150 行以内', () => {
  const text = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
  assert.ok(text.split('\n').length <= 150, 'SKILL.md が 150 行を超えた');
});

test('SKILL.md の相対リンクはすべて実在する', () => {
  const text = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
  const links = [...text.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]).filter((l) => !/^(https?:|#|\$\{)/.test(l));
  for (const link of links) {
    const target = path.resolve(SKILL_DIR, link.split('#')[0]);
    assert.ok(fs.existsSync(target), `SKILL.md のリンク先が無い: ${link}`);
  }
});

test('v1 の廃止概念を含まない', () => {
  const forbidden = ['events/latest', 'latest/', 'docs/impl/', 'arch-design.yaml', '_api-summary.yaml'];
  for (const f of mdFiles) {
    const text = fs.readFileSync(f, 'utf8');
    for (const bad of forbidden) assert.ok(!text.includes(bad), `${path.relative(SKILL_DIR, f)} が禁止文字列 "${bad}" を含む`);
  }
});

test('asbuilt-format.md が 9 節すべてを列挙する', () => {
  const text = fs.readFileSync(path.join(SKILL_DIR, 'references/asbuilt-format.md'), 'utf8');
  for (const s of ['見出し', '実現の経路', 'シーケンス', 'データの読み書き', '整合性の守り方', '画面', '検証の証跡', '補った前提と処遇', '逸脱と既知の課題']) {
    assert.ok(text.includes(s), `asbuilt-format.md に節 "${s}" が無い`);
  }
});

test('スクリプトは他プラグインを require しない', () => {
  const scripts = walk(path.join(SKILL_DIR, 'scripts')).filter((f) => f.endsWith('.js'));
  for (const f of scripts) {
    const text = fs.readFileSync(f, 'utf8');
    assert.ok(!/require\(['"][^'"]*plugins\/distillery(-impl)?\//.test(text), `${path.basename(f)} が他プラグインを require`);
  }
});
