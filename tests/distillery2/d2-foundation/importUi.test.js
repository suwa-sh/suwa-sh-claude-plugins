'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { run } = require('../../../plugins/distillery2/skills/d2-foundation/scripts/importUi');
const { parseYaml } = require('../../../plugins/distillery2/skills/d2-common/scripts/lib/yaml');

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

test('0.1.32 J2: 前回の一覧にあって取り込み元から消えたファイルは packages/ui からも消え、.imported.yaml の一覧が更新される。一覧に無いファイルは触らない', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'd2imp-'));
  writeFile(path.join(cwd, 'design/src/components/ui/Button.tsx'), 'export const Button = () => null;');
  writeFile(path.join(cwd, 'design/src/stories/Old.stories.tsx'), 'export default {};');
  writeFile(path.join(cwd, 'design/src/tokens/tokens.json'), '{"primitive":{}}');
  assert.equal(run({ from: 'design', cwd }).code, 0);
  assert.ok(fs.existsSync(path.join(cwd, 'packages/ui/stories/Old.stories.tsx')));
  writeFile(path.join(cwd, 'packages/ui/handmade.ts'), 'export const x = 1;');
  fs.rmSync(path.join(cwd, 'design/src/stories/Old.stories.tsx'));
  const r = run({ from: 'design', cwd });
  assert.equal(r.code, 0);
  assert.deepEqual(r.removed, ['stories/Old.stories.tsx']);
  assert.ok(!fs.existsSync(path.join(cwd, 'packages/ui/stories/Old.stories.tsx')), '消えたファイルは取り込み先からも消える');
  assert.ok(!fs.existsSync(path.join(cwd, 'packages/ui/stories')), '空になったディレクトリも消える');
  assert.ok(fs.existsSync(path.join(cwd, 'packages/ui/handmade.ts')), '一覧に無いファイルは触らない');
  assert.deepEqual(manifest(cwd).files.map(f => f.path), ['components/ui/Button.tsx', 'tokens/tokens.json']);
  // もう一度回しても何も消えない
  assert.deepEqual(run({ from: 'design', cwd }).removed, []);
  // 一覧に packages/ui の外を指す項目があっても消さない (一覧は追跡ファイルで人が書き換えうる)
  writeFile(path.join(cwd, 'outside.txt'), 'keep');
  const manifestPath = path.join(cwd, 'packages/ui/.imported.yaml');
  fs.writeFileSync(manifestPath, fs.readFileSync(manifestPath, 'utf8').replace('files:', 'files:\n  - path: ../../outside.txt\n    sha256: x\n  - path: /etc/hosts\n    sha256: x'));
  assert.deepEqual(run({ from: 'design', cwd }).removed, []);
  assert.ok(fs.existsSync(path.join(cwd, 'outside.txt')), '外のファイルは消えない');
});

test('取り込みの後に packages/ui を biome で整形する (biome が無ければ飛ばす。0.3.0)', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'd2imp-'));
  writeFile(path.join(cwd, 'design/src/components/ui/Button.tsx'), 'export const Button = () => null;');
  assert.equal(run({ from: 'design', cwd }).format, 'skipped (biome が無い)');
  // 偽の biome: 受け取った引数を書き残す
  const bin = path.join(cwd, 'node_modules/.bin/biome');
  writeFile(bin, '#!/bin/sh\necho "$@" > "$(dirname "$0")/../../biome-args.txt"\n');
  fs.chmodSync(bin, 0o755);
  assert.equal(run({ from: 'design', cwd }).format, 'formatted');
  assert.equal(fs.readFileSync(path.join(cwd, 'biome-args.txt'), 'utf8').trim(), 'format --write --no-errors-on-unmatched packages/ui');
  writeFile(bin, '#!/bin/sh\necho broken >&2\nexit 1\n');
  assert.match(run({ from: 'design', cwd }).format, /^failed \(exit 1\): broken/, '整形できなくても取り込みは成功し、報告だけする');
});

test('画面の CSS の入口 (packages/ui/entry.css): Tailwind の CSS が 1 本ならそれを指す。0 本・2 本なら書かない (0.3.0)', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'd2imp-'));
  const design = path.join(cwd, 'design');
  writeFile(path.join(design, 'src/components/ui/Button.tsx'), 'export const Button = () => null;');
  writeFile(path.join(design, 'src/styles/design-tokens.css'), ':root { --x: 1px; }');
  const entry = path.join(cwd, 'packages/ui/entry.css');
  assert.equal(run({ from: 'design', cwd }).css, 'none (Tailwind の CSS が無い)');
  assert.ok(!fs.existsSync(entry));
  writeFile(path.join(design, 'src/app/globals.css'), "@import 'tailwindcss';\n@import '../styles/design-tokens.css';\n");
  assert.equal(run({ from: 'design', cwd }).css, 'entry.css → app/globals.css');
  assert.match(fs.readFileSync(entry, 'utf8'), /^@import "\.\/app\/globals\.css";$/m);
  assert.match(fs.readFileSync(entry, 'utf8'), /^@source "\.\/";$/m, '部品にだけ書いたクラスも画面の build に出す (packages/ui を走査させる)');
  writeFile(path.join(design, 'src/styles/globals.css'), '@import "tailwindcss";\n');
  assert.match(run({ from: 'design', cwd }).css, /^none \(Tailwind の CSS が 2 本/);
  assert.ok(!fs.existsSync(entry), '前に書いた入口は消す (どちらを指すか決められない)');
});

test('画面の土台の styles.css: 入口が書けたら packages/ui を読む形に替え、書けなければ戻す。手で変えたものと取り込み元の entry.css は触らない (0.3.0)', () => {
  const { STYLES_PLAIN, STYLES_UI } = require('../../../plugins/distillery2/skills/d2-foundation/scripts/spaStyles');
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'd2imp-'));
  const design = path.join(cwd, 'design');
  const app = path.join(cwd, 'apps/frontend/src/styles.css');
  const hand = path.join(cwd, 'apps/admin/src/styles.css');
  writeFile(app, STYLES_PLAIN);
  writeFile(hand, '@import "tailwindcss";\n/* 手で変えた */\n');
  writeFile(path.join(design, 'src/components/ui/Button.tsx'), 'export const Button = () => null;');
  writeFile(path.join(design, 'src/styles/globals.css'), '@import "tailwindcss";\n');
  const r = run({ from: 'design', cwd });
  assert.deepEqual(r.styles, ['apps/frontend/src/styles.css']);
  assert.equal(fs.readFileSync(app, 'utf8'), STYLES_UI);
  assert.match(STYLES_UI, /@import "\.\.\/\.\.\/\.\.\/packages\/ui\/entry\.css";/);
  assert.match(fs.readFileSync(hand, 'utf8'), /手で変えた/);
  assert.deepEqual(run({ from: 'design', cwd }).styles, [], '再実行は何も替えない');
  // 前の取り込みの entry.css が残っていても、Tailwind の CSS が無くなれば消して PLAIN に戻す
  fs.rmSync(path.join(design, 'src/styles/globals.css'));
  run({ from: 'design', cwd });
  assert.ok(!fs.existsSync(path.join(cwd, 'packages/ui/entry.css')));
  assert.equal(fs.readFileSync(app, 'utf8'), STYLES_PLAIN);
  // 取り込み元が entry.css を持つならそれを使う (上書きしない)
  writeFile(path.join(design, 'src/entry.css'), '@import "tailwindcss";\n/* design の入口 */\n');
  const own = run({ from: 'design', cwd });
  assert.match(own.css, /^kept/);
  assert.match(fs.readFileSync(path.join(cwd, 'packages/ui/entry.css'), 'utf8'), /design の入口/);
  assert.equal(fs.readFileSync(app, 'utf8'), STYLES_UI);
});

test('Tailwind の CSS の検出はコメントの中の @import を数えない (0.3.0)', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'd2imp-'));
  const design = path.join(cwd, 'design');
  writeFile(path.join(design, 'src/components/ui/Button.tsx'), 'export const Button = () => null;');
  writeFile(path.join(design, 'src/styles/globals.css'), '@import "tailwindcss";\n');
  writeFile(path.join(design, 'src/styles/old.css'), '/* 前は @import "tailwindcss"; をここに書いていた */\n.x { color: red; }\n');
  assert.equal(run({ from: 'design', cwd }).css, 'entry.css → styles/globals.css');
});

