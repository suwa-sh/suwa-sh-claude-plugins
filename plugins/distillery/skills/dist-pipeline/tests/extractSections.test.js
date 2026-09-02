'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const { sliceSection, extract, renderMarkdown, sha256 } = require('../scripts/extractSections');
const { buildAll, readIndexSha } = require('../scripts/buildDigest');

const sampleRoot = path.resolve(__dirname, '../../../../../samples/distillery/pipeline');
const archYaml = path.join(sampleRoot, 'arch/latest/arch-design.yaml');
const nfrYaml = path.join(sampleRoot, 'nfr/latest/nfr-grade.yaml');
const designYaml = path.join(sampleRoot, 'design/latest/design-event.yaml');

const SMALL = [
  'version: "1.0"',
  '# note before section',
  'domain_architecture:',
  '  subdomains:',
  '    - id: "SD-001"',
  '      name: "予約"',
  '',
  '  bounded_contexts: []',
  'system_architecture:',
  '  tiers:',
  '    - id: "tier-frontend"',
  '      name: "FE"',
  '    - id: "tier-api"',
  '      name: "API"',
  '  cross_tier_policies: []',
  'categories:',
  '  - id: "A"',
  '    name: "可用性"',
  '    items:',
  '      - id: "A.1"',
  '  - id: B',
  '    name: "性能"',
  'trailing: 1',
].join('\n');

test('sliceSection returns the exact original lines of a top-level section (with leading comments)', () => {
  const r = sliceSection(SMALL, 'domain_architecture');
  assert.equal(r.found, true);
  assert.equal(r.text, ['# note before section', 'domain_architecture:', '  subdomains:', '    - id: "SD-001"', '      name: "予約"', '', '  bounded_contexts: []'].join('\n'));
  assert.equal(r.startLine, 2);
  assert.equal(r.endLine, 8);
});

test('sliceSection resolves nested keys and list items selected by id', () => {
  assert.equal(sliceSection(SMALL, 'system_architecture.tiers').text, ['  tiers:', '    - id: "tier-frontend"', '      name: "FE"', '    - id: "tier-api"', '      name: "API"'].join('\n'));
  assert.equal(sliceSection(SMALL, 'categories[id=A]').text, ['  - id: "A"', '    name: "可用性"', '    items:', '      - id: "A.1"'].join('\n'));
  assert.equal(sliceSection(SMALL, 'categories[id=B]').text, ['  - id: B', '    name: "性能"'].join('\n'), 'unquoted id matches too');
  assert.equal(sliceSection(SMALL, 'categories[id=A].items').text, ['    items:', '      - id: "A.1"'].join('\n'));
  assert.equal(sliceSection(SMALL, 'missing').found, false);
  assert.equal(sliceSection(SMALL, 'categories[id=Z]').found, false);
  assert.equal(sliceSection(SMALL, 'system_architecture.nope').found, false);
});

test('renderMarkdown emits headers, checklist with not_applicable, and fenced original text', () => {
  const results = { sourceText: SMALL, sections: extract(SMALL, ['system_architecture.tiers', 'missing']) };
  const md = renderMarkdown(results, 'docs/arch/latest/arch-design.yaml', ['design_available: false'], 'arch/nfr ダイジェスト');
  assert.ok(md.startsWith('design_available: false\n'));
  assert.ok(md.includes('| `system_architecture.tiers` | 転写済み |'));
  assert.ok(md.includes('| `missing` | not_applicable |'));
  assert.ok(md.includes('```yaml\n  tiers:\n'));
  assert.ok(md.includes(`source_sha256: \`${sha256(SMALL)}\``));
});

test('sample arch-design.yaml sections are extracted verbatim and concatenate back to the source', () => {
  const text = fs.readFileSync(archYaml, 'utf-8');
  const keys = ['technology_context', 'domain_architecture', 'system_architecture', 'app_architecture', 'data_architecture'];
  const parts = keys.map(k => sliceSection(text, k));
  for (const p of parts) assert.equal(p.found, true, p.path);
  // 各セクションの原文がソースにそのまま含まれ、順序どおり並ぶ
  let cursor = 0;
  for (const p of parts) {
    const idx = text.indexOf(p.text, cursor);
    assert.ok(idx >= cursor, `${p.path} must appear in order`);
    cursor = idx + p.text.length;
  }
  assert.ok(sliceSection(text, 'system_architecture.tiers').text.includes('- id: "tier-frontend"'));
});

test('buildAll generates _digest for arch/nfr/design from a copy of the samples and is idempotent', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'digest-'));
  try {
    for (const [dom, file] of [['arch', 'arch-design.yaml'], ['nfr', 'nfr-grade.yaml'], ['design', 'design-event.yaml']]) {
      fs.mkdirSync(path.join(tmp, dom, 'latest'), { recursive: true });
      fs.copyFileSync(path.join(sampleRoot, dom, 'latest', file), path.join(tmp, dom, 'latest', file));
    }
    const first = buildAll(tmp, ['arch', 'nfr', 'design']);
    assert.deepEqual(first.map(r => r.status), ['generated', 'generated', 'generated']);
    const archDir = path.join(tmp, 'arch/latest/_digest');
    assert.ok(fs.existsSync(path.join(archDir, 'system_architecture.yaml')));
    assert.ok(fs.existsSync(path.join(archDir, 'index.md')));
    assert.equal(readIndexSha(path.join(archDir, 'index.md')), sha256(fs.readFileSync(path.join(tmp, 'arch/latest/arch-design.yaml'), 'utf-8')));
    const nfrFiles = fs.readdirSync(path.join(tmp, 'nfr/latest/_digest')).sort();
    assert.ok(nfrFiles.includes('category-A.yaml') && nfrFiles.includes('category-F.yaml') && nfrFiles.includes('model_system.yaml'), nfrFiles.join(','));
    const catA = fs.readFileSync(path.join(tmp, 'nfr/latest/_digest/category-A.yaml'), 'utf-8');
    assert.ok(catA.includes('name: "可用性"'));
    assert.ok(!catA.includes('name: "性能"'), 'category-A must not include other categories');
    const designFiles = fs.readdirSync(path.join(tmp, 'design/latest/_digest'));
    assert.ok(designFiles.includes('screens.yaml') && designFiles.includes('components.yaml'));

    const second = buildAll(tmp, ['arch', 'nfr', 'design']);
    assert.deepEqual(second.map(r => r.status), ['up_to_date', 'up_to_date', 'up_to_date']);

    // 正本が変わったら再生成される
    fs.appendFileSync(path.join(tmp, 'arch/latest/arch-design.yaml'), '\n# touched\n');
    assert.equal(buildAll(tmp, ['arch'])[0].status, 'generated');
    assert.equal(buildAll(tmp, ['missing-domain'.slice(0, 0) || 'arch'])[0].status, 'up_to_date');
    fs.rmSync(path.join(tmp, 'design/latest/design-event.yaml'));
    assert.equal(buildAll(tmp, ['design'])[0].status, 'source_missing');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('CLI --md writes a digest markdown with the design_available header', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'extract-'));
  try {
    const target = path.join(out, '_inputs-digest.md');
    const stdout = execFileSync(process.execPath, [
      path.join(__dirname, '..', 'scripts', 'extractSections.js'), archYaml,
      'system_architecture.tiers', 'app_architecture.tier_layers', 'data_architecture.entities', 'technology_context', 'domain_architecture', 'nope.section',
      '--md', '--header', 'design_available: false', '--out', target, '--source-label', 'docs/arch/latest/arch-design.yaml',
    ], { encoding: 'utf-8' });
    assert.ok(stdout.includes('not_applicable: nope.section'));
    const md = fs.readFileSync(target, 'utf-8');
    assert.ok(/^design_available:\s*false\s*$/m.test(md), 'validateSpecEvent.js reads this header line');
    assert.ok(md.includes('| `nope.section` | not_applicable |'));
    assert.ok(md.includes('## system_architecture.tiers'));
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('nfr sample: category selection keeps subcategories and metrics intact', () => {
  const text = fs.readFileSync(nfrYaml, 'utf-8');
  const a = sliceSection(text, 'categories[id=A]');
  assert.equal(a.found, true);
  assert.ok(a.text.split('\n')[0].startsWith('  - id: "A"'));
  assert.ok(a.text.includes('id: "A.1.1.1"'));
  const d = sliceSection(text, 'categories[id=D]');
  assert.ok(d.found && d.text.includes('name: "移行性"'));
  const e = sliceSection(text, 'categories[id=E]');
  assert.ok(e.found && e.text.includes('name: "セキュリティ"'));
  assert.ok(!d.text.includes('name: "セキュリティ"'), 'category D must end before category E');
  const s = sliceSection(fs.readFileSync(designYaml, 'utf-8'), 'screens');
  assert.ok(s.found && s.text.startsWith('screens:'));
});
