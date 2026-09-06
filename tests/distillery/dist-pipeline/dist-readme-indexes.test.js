'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

test('README discloses domain indexes before individual records, with portable links and no stale generated history', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-readme-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, body) => { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, body); };
  write('arch/events/20260901_120000_first/decisions/a.yaml', 'title: Original decision\nstatus: approved\n');
  write('design/events/20260902_120000_second/decisions/b.yaml', 'title: Design decision\nstatus: proposed\n');
  write('arch/events/20260903_120000_third/source.txt', 'Update');
  const generate = () => execFileSync(process.execPath, [path.resolve('plugins/distillery/skills/dist-pipeline/scripts/generateReadme.js'), root]);
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  generate();
  const main = read('README.md');
  const adr = main.split('## ADRs')[1].split('## イベント履歴')[0];
  const history = main.split('## イベント履歴')[1];
  assert.match(adr, /全2件/);
  assert.match(adr, /_indexes\/adrs\/arch.md/);
  assert.doesNotMatch(adr, /Original decision|Design decision/);
  assert.match(history, /全3件/);
  assert.match(history, /_indexes\/events\/arch.md/);
  assert.doesNotMatch(history, /20260901_120000_first/);
  const files = ['_indexes/adrs/arch.md', '_indexes/adrs/design.md', '_indexes/events/arch.md', '_indexes/events/design.md'];
  const before = files.map(read);
  assert.match(before[0], /Original decision/);
  assert.ok(before[2].indexOf('20260901_120000_first') < before[2].indexOf('20260903_120000_third'));
  for (const file of files) for (const [, href] of read(file).matchAll(/\]\(([^)]+)\)/g)) {
    assert.ok(fs.existsSync(path.resolve(root, path.dirname(file), href)), `${file}: ${href}`);
  }
  generate();
  assert.deepEqual(files.map(read), before);
  fs.rmSync(path.join(root, 'design/events'), { recursive: true });
  write('_indexes/events/notes.md', 'User notes');
  generate();
  assert.ok(!fs.existsSync(path.join(root, '_indexes/events/design.md')));
  assert.ok(!fs.existsSync(path.join(root, '_indexes/adrs/design.md')));
  assert.equal(read('_indexes/events/notes.md'), 'User notes');
  assert.match(read('README.md').split('## イベント履歴')[1], /全2件/);
});
