'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const originalRoot = path.join(root, 'samples/distillery/pipeline-opus-medium/specs/latest');
const ucPath = '蔵書利用業務/書籍を貸し出すフロー/貸出を登録する';
const original = path.join(originalRoot, ucPath);
const concise = path.join(root, 'samples/distillery/spec-concise/loan-registration');
const documents = ['spec.md', 'tier-backend-api.md', 'tier-frontend-staff.md'];
const summaries = ['_api-summary.yaml', '_model-summary.yaml'];
const scripts = path.join(root, 'plugins/distillery/skills/dist-spec/scripts');
const read = (dir, name) => fs.readFileSync(path.join(dir, name), 'utf8');
const gherkin = text => [...text.matchAll(/```gherkin\r?\n([\s\S]*?)```/g)].map(m => m[1]);

test('editorial reduction preserves every existing acceptance scenario verbatim', () => {
  for (const name of documents) {
    const before = gherkin(read(original, name));
    assert.ok(before.length > 0, name);
    assert.deepEqual(gherkin(read(concise, name)), before, name);
  }
});

test('editorial reduction preserves API dependencies and all model operations', () => {
  for (const name of summaries) {
    assert.equal(read(concise, name), read(original, name), name);
  }
  // API request/response/error and replay contract remain the generation source in phase 1.
  const apiSection = text => text.slice(text.indexOf('#### リクエスト'), text.indexOf('## 非同期イベント'))
    .replaceAll('../../pipeline-opus-medium/specs/latest/_cross-cutting/', '_cross-cutting/');
  assert.equal(apiSection(read(concise, documents[1])), apiSection(read(original, documents[1])));
});

test('editorial sample Markdown links resolve to real files and headings', () => {
  const anchor = heading => heading.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/ /g, '-');
  for (const name of documents) {
    for (const match of read(concise, name).matchAll(/\]\(([^)]+)\)/g)) {
      const [file, fragment] = match[1].split('#');
      const target = path.resolve(concise, file || name);
      assert.ok(fs.statSync(target).isFile(), `${name}: ${match[1]}`);
      if (fragment) {
        const headings = [...fs.readFileSync(target, 'utf8').matchAll(/^#{1,6} (.+)$/gm)].map(m => anchor(m[1]));
        assert.ok(headings.includes(decodeURIComponent(fragment)), `${name}: missing heading ${fragment}`);
      }
    }
  }
});

test('concise UC overlays pass existing event and summary validators in an isolated directory', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-spec-concise-'));
  try {
    fs.cpSync(originalRoot, temp, { recursive: true });
    const uc = path.join(temp, ucPath);
    for (const name of [...documents, ...summaries]) {
      // The standalone sample links to the original shared definitions; an event uses its own root.
      const text = read(concise, name).replaceAll('../../pipeline-opus-medium/specs/latest/_cross-cutting/', '../../../_cross-cutting/');
      fs.writeFileSync(path.join(uc, name), text);
    }
    for (const [script, target] of [
      ['validateSpecEvent.js', temp],
      ['validateApiSummary.js', uc],
      ['validateModelSummary.js', uc],
    ]) {
      const result = spawnSync(process.execPath, [path.join(scripts, script), target], { encoding: 'utf8' });
      assert.equal(result.status, 0, `${script}: ${result.stdout}\n${result.stderr}`);
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
