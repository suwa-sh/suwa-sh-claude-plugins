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
  // npm workspace 用の package.json (@repo/ui) を書く
  const uiPkg = JSON.parse(fs.readFileSync(path.join(cwd, 'packages/ui/package.json'), 'utf8'));
  assert.equal(uiPkg.name, '@repo/ui');
  assert.equal(uiPkg.type, 'module');
  assert.ok(uiPkg.main, 'main entry set');
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

test('既存 packages/ui/package.json の手編集 (exports) を保持し、管理キーだけ更新する (Finding 6)', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'd2imp-'));
  writeFile(path.join(cwd, 'design/src/components/ui/Button.tsx'), 'export const Button = () => null;');
  const pkgPath = path.join(cwd, 'packages/ui/package.json');

  assert.equal(run({ from: 'design', cwd }).code, 0);
  // ユーザーが exports を足し、管理キー (name) を書き換える
  const edited = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  edited.exports = { '.': './index.ts' };
  edited.dependencies = { clsx: '^2.0.0' };
  edited.name = 'hand-edited';
  fs.writeFileSync(pkgPath, JSON.stringify(edited, null, 2) + '\n');

  assert.equal(run({ from: 'design', cwd }).code, 0);
  const after = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  assert.deepEqual(after.exports, { '.': './index.ts' }, '手編集の exports を保持する');
  assert.deepEqual(after.dependencies, { clsx: '^2.0.0' }, '手編集の dependencies を保持する');
  assert.equal(after.name, '@repo/ui', '管理キー name は取り込み側の値へ戻す');
  assert.equal(after.type, 'module', '管理キー type を維持する');
});

test('同じ入力での再実行は .imported.yaml / package.json をバイト一致させる (Finding 7)', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'd2imp-'));
  writeFile(path.join(cwd, 'design/src/components/ui/Button.tsx'), 'export const Button = () => null;');
  writeFile(path.join(cwd, 'design/src/tokens/tokens.json'), '{"primitive":{}}');
  const manifestPath = path.join(cwd, 'packages/ui/.imported.yaml');
  const pkgPath = path.join(cwd, 'packages/ui/package.json');

  assert.equal(run({ from: 'design', cwd }).code, 0);
  const y1 = fs.readFileSync(manifestPath);
  const p1 = fs.readFileSync(pkgPath);

  assert.equal(run({ from: 'design', cwd }).code, 0);
  const y2 = fs.readFileSync(manifestPath);
  const p2 = fs.readFileSync(pkgPath);

  assert.ok(y1.equals(y2), '.imported.yaml が 2 回の実行でバイト一致する (imported_at を据え置く)');
  assert.ok(p1.equals(p2), 'package.json が 2 回の実行でバイト一致する');
  // 内容が変わったら imported_at を更新する
  const before = parseYaml(y2.toString().split('\n').filter(l => !l.startsWith('#')).join('\n'));
  writeFile(path.join(cwd, 'design/src/components/ui/Card.tsx'), 'export const Card = () => null;');
  assert.equal(run({ from: 'design', cwd }).code, 0);
  const after = parseYaml(fs.readFileSync(manifestPath, 'utf8').split('\n').filter(l => !l.startsWith('#')).join('\n'));
  assert.notEqual(after.content_sha256, before.content_sha256, 'ファイルが増えたら content_sha256 が変わる');
});
