'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { run } = require('../../../plugins/distillery2/skills/d2-foundation/scripts/importUi');
const { parseYaml } = require('../../../plugins/distillery2/scripts/lib/yaml');

function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function manifest(cwd) {
  const text = fs.readFileSync(path.join(cwd, 'packages/ui/.imported.yaml'), 'utf8');
  return parseYaml(text.split('\n').filter(l => !l.startsWith('#')).join('\n'));
}

test('src/ 配下の tokens/tokens.json を packages/ui に取り込む', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'd2imp-'));
  const design = path.join(cwd, 'design');
  writeFile(path.join(design, 'src/components/ui/Button.tsx'), 'export const Button = () => null;');
  writeFile(path.join(design, 'src/tokens/tokens.json'), '{"primitive":{}}');

  const r = run({ from: 'design', cwd });
  assert.equal(r.code, 0);
  assert.ok(fs.existsSync(path.join(cwd, 'packages/ui/tokens/tokens.json')), 'tokens が取り込まれる');
  assert.ok(fs.existsSync(path.join(cwd, 'packages/ui/components/ui/Button.tsx')));
  const paths = manifest(cwd).files.map(f => f.path);
  assert.ok(paths.includes('tokens/tokens.json'), JSON.stringify(paths));
});

test('src/ の外 (ルート直下) の tokens/ も防御的に取り込む', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'd2imp-'));
  const design = path.join(cwd, 'design');
  writeFile(path.join(design, 'src/components/ui/Button.tsx'), 'export const Button = () => null;');
  writeFile(path.join(design, 'tokens/tokens.json'), '{"primitive":{}}'); // src/ の外

  const r = run({ from: 'design', cwd });
  assert.equal(r.code, 0);
  assert.ok(fs.existsSync(path.join(cwd, 'packages/ui/tokens/tokens.json')), 'ルート tokens も取り込まれる');
  const paths = manifest(cwd).files.map(f => f.path);
  assert.ok(paths.includes('tokens/tokens.json'), JSON.stringify(paths));
});
