'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');

const { sliceSection, listItemValues, extract, renderMarkdown, sha256, stripTrailingComment } = require('../../../plugins/distillery/skills/dist-pipeline/scripts/extractSections');
const { buildAll, readIndexSha, readIndex, digestIsCurrent, expectedRowsOf, DOMAINS } = require('../../../plugins/distillery/skills/dist-pipeline/scripts/buildDigest');

// 実リポジトリでは tests/fixtures/distillery/ の固定入力を使う。レビュー用コピー等では DIST_SAMPLE_ROOT で差し替えられる
const sampleRoot = process.env.DIST_SAMPLE_ROOT || path.resolve(__dirname, '../../fixtures/distillery/legacy-pipeline');
const archYaml = path.join(sampleRoot, 'arch/latest/arch-design.yaml');
const nfrYaml = path.join(sampleRoot, 'nfr/latest/nfr-grade.yaml');
const designYaml = path.join(sampleRoot, 'design/latest/design-event.yaml');
const script = path.join(__dirname, '../../../plugins/distillery/skills/dist-pipeline', 'scripts', 'extractSections.js');

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

test('edge cases: trailing comments on id lines, bare "-" items, nested leading comments, block scalars', () => {
  const y = [
    'categories:',
    '  - id: "A" # valid comment',
    '    name: "可用性"',
    '  -',
    '    id: B',
    '    name: "性能"',
    'root:',
    '  note: |',
    '    child:',
    '      not_a_mapping: true',
    '  # belongs to child',
    '  child:',
    '    real: true',
    'quoted: "a # not a comment"',
  ].join('\n');
  assert.equal(sliceSection(y, 'categories[id=A]').text, ['  - id: "A" # valid comment', '    name: "可用性"'].join('\n'));
  assert.equal(sliceSection(y, 'categories[id=B]').text, ['  -', '    id: B', '    name: "性能"'].join('\n'));
  assert.equal(sliceSection(y, 'root.note.child').found, false, 'block scalar body must not be searched as mapping');
  assert.equal(sliceSection(y, 'root.child').text, ['  # belongs to child', '  child:', '    real: true'].join('\n'), 'nested leading comment kept');
  assert.equal(sliceSection(y, 'root.note').text, ['  note: |', '    child:', '      not_a_mapping: true'].join('\n'));
  assert.equal(stripTrailingComment('"a # not a comment" # real'), '"a # not a comment"');
  assert.equal(stripTrailingComment('name: "Security \\" #1\\" team" # comment'), 'name: "Security \\" #1\\" team"', 'escaped quotes inside double quotes');
  assert.equal(stripTrailingComment("name: 'it''s # here' # c"), "name: 'it''s # here'");
  assert.deepEqual(listItemValues(y, 'categories', 'id', ['name']), [{ id: 'A', name: '可用性' }, { id: 'B', name: '性能' }]);

  // block scalar の指示子はどちらの順序でも、複数行 quoted scalar の本文もキー探索の対象外
  const y2 = [
    'root:',
    '  note: |2-',
    '    fake: 1',
    '  memo: >+2',
    '    fake: 2',
    '  quoted: "line one',
    '    fake: 3',
    '    still quoted"',
    '  single: \'it\'\'s',
    '    fake: 4\'',
    '  real:',
    '    value: 1',
  ].join('\n');
  assert.equal(sliceSection(y2, 'root.fake').found, false, 'strings inside scalars are not keys');
  assert.equal(sliceSection(y2, 'root.note.fake').found, false);
  assert.equal(sliceSection(y2, 'root.memo.fake').found, false);
  assert.equal(sliceSection(y2, 'root.quoted.fake').found, false);
  assert.equal(sliceSection(y2, 'root.real').text, ['  real:', '    value: 1'].join('\n'));
  assert.equal(sliceSection(y2, 'root.quoted').text, ['  quoted: "line one', '    fake: 3', '    still quoted"'].join('\n'));

  // flow style の内部は unsupported（not_applicable ではない）
  const y3 = ['root: { child: { value: 1 } }', 'list: [a, b]', 'plain: 1'].join('\n');
  const flow = sliceSection(y3, 'root.child');
  assert.equal(flow.found, false);
  assert.equal(flow.unsupported, true);
  assert.equal(sliceSection(y3, 'root').found, true, 'the flow mapping itself can still be extracted as a line');
  assert.equal(sliceSection(y3, 'plain').text, 'plain: 1');
  const flowDir = fs.mkdtempSync(path.join(os.tmpdir(), 'extract-flow-'));
  try {
    const flowFile = path.join(flowDir, 'flow.yaml');
    fs.writeFileSync(flowFile, y3, 'utf-8');
    const r = spawnSync(process.execPath, [script, flowFile, 'root.child'], { encoding: 'utf-8' });
    assert.equal(r.status, 3, `CLI exits 3 on unsupported paths (stderr: ${r.stderr})`);
    assert.ok(r.stderr.includes('flow style'));
  } finally {
    fs.rmSync(flowDir, { recursive: true, force: true });
  }
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
  let cursor = 0;
  for (const p of parts) {
    const idx = text.indexOf(p.text, cursor);
    assert.ok(idx >= cursor, `${p.path} must appear in order`);
    cursor = idx + p.text.length;
  }
  // sample の tier id は再生成のたびに変わり得る（tier-frontend / tier-frontend-patron 等）。backend-api は全世代で安定
  assert.ok(sliceSection(text, 'system_architecture.tiers').text.includes('- id: "tier-backend-api"'));
});

test('buildAll generates _digest, is idempotent, repairs missing/corrupted files, and drops stale digest when the source disappears', () => {
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
    assert.equal(readIndexSha(path.join(archDir, 'index.md')), sha256(fs.readFileSync(path.join(tmp, 'arch/latest/arch-design.yaml'), 'utf-8')));
    assert.ok(readIndex(path.join(archDir, 'index.md')).files.length >= 4, 'index records per-file sha256');
    const archText = fs.readFileSync(path.join(tmp, 'arch/latest/arch-design.yaml'), 'utf-8');
    assert.equal(digestIsCurrent(archDir, readIndexSha(path.join(archDir, 'index.md')), expectedRowsOf(DOMAINS.arch, archText)), true);

    // index の name 改変 / not_applicable 行の欠落も再生成の対象
    const nfrIndexPath = path.join(tmp, 'nfr/latest/_digest/index.md');
    const nfrIndexFull = fs.readFileSync(nfrIndexPath, 'utf-8');
    fs.writeFileSync(nfrIndexPath, nfrIndexFull.replace('| 可用性 |', '| 改変 |'), 'utf-8');
    assert.equal(buildAll(tmp, ['nfr'])[0].status, 'generated', 'tampered name column triggers regeneration');

    // index の行が欠けている（切り詰め）場合は期待集合と一致しないので up_to_date にならない
    const indexPath = path.join(archDir, 'index.md');
    const fullIndex = fs.readFileSync(indexPath, 'utf-8');
    fs.writeFileSync(indexPath, fullIndex.split('\n').filter(l => !l.includes('`_digest/data_architecture.yaml`')).join('\n'), 'utf-8');
    assert.equal(buildAll(tmp, ['arch'])[0].status, 'generated', 'truncated index triggers regeneration');
    fs.writeFileSync(indexPath, fullIndex.replace(/\| `technology_context`[^\n]*\n/, m => m + m), 'utf-8');
    assert.equal(buildAll(tmp, ['arch'])[0].status, 'generated', 'duplicated index rows trigger regeneration');

    const nfrDir = path.join(tmp, 'nfr/latest/_digest');
    const nfrFiles = fs.readdirSync(nfrDir).sort();
    assert.ok(nfrFiles.includes('category-A.yaml') && nfrFiles.includes('category-F.yaml') && nfrFiles.includes('model_system.yaml'), nfrFiles.join(','));
    const catA = fs.readFileSync(path.join(nfrDir, 'category-A.yaml'), 'utf-8');
    assert.ok(catA.includes('name: "可用性"'));
    assert.ok(!catA.includes('name: "性能'), 'category-A must not include other categories');
    const nfrIndex = fs.readFileSync(path.join(nfrDir, 'index.md'), 'utf-8');
    assert.ok(nfrIndex.includes('| `categories[id=A]` | `_digest/category-A.yaml` | 可用性 |'), 'nfr index carries category names');
    assert.ok(nfrIndex.includes('| `categories[id=E]` | `_digest/category-E.yaml` | セキュリティ |'));
    const designFiles = fs.readdirSync(path.join(tmp, 'design/latest/_digest'));
    assert.ok(designFiles.includes('screens.yaml') && designFiles.includes('components.yaml'));

    const second = buildAll(tmp, ['arch', 'nfr', 'design']);
    assert.deepEqual(second.map(r => r.status), ['up_to_date', 'up_to_date', 'up_to_date']);

    // 派生ファイルの欠落 / 改変は再生成される
    fs.rmSync(path.join(nfrDir, 'category-A.yaml'));
    assert.equal(buildAll(tmp, ['nfr'])[0].status, 'generated');
    assert.ok(fs.existsSync(path.join(nfrDir, 'category-A.yaml')));
    fs.appendFileSync(path.join(archDir, 'system_architecture.yaml'), '\n# tampered\n');
    assert.equal(buildAll(tmp, ['arch'])[0].status, 'generated');
    assert.ok(!fs.readFileSync(path.join(archDir, 'system_architecture.yaml'), 'utf-8').includes('# tampered'));

    // 正本が変わったら再生成される
    fs.appendFileSync(path.join(tmp, 'arch/latest/arch-design.yaml'), '\n# touched\n');
    assert.equal(buildAll(tmp, ['arch'])[0].status, 'generated');
    assert.equal(buildAll(tmp, ['arch'])[0].status, 'up_to_date');

    // 正本が消えたら stale な _digest/ を削除する
    fs.rmSync(path.join(tmp, 'design/latest/design-event.yaml'));
    const gone = buildAll(tmp, ['design'])[0];
    assert.equal(gone.status, 'source_missing');
    assert.equal(gone.removed_stale_digest, true);
    assert.equal(fs.existsSync(path.join(tmp, 'design/latest/_digest')), false);

    // CLI: --domain で明示したドメインの正本が無ければ exit 2、既定（全ドメイン）では 0
    const buildScript = path.join(__dirname, '../../../plugins/distillery/skills/dist-pipeline', 'scripts', 'buildDigest.js');
    assert.equal(spawnSync(process.execPath, [buildScript, tmp, '--domain', 'design'], { encoding: 'utf-8' }).status, 2);
    assert.equal(spawnSync(process.execPath, [buildScript, tmp], { encoding: 'utf-8' }).status, 0);
    // 未知の --domain / 空 / 未知オプションは CLI エラー
    assert.equal(spawnSync(process.execPath, [buildScript, tmp, '--domain', 'typo'], { encoding: 'utf-8' }).status, 1);
    assert.equal(spawnSync(process.execPath, [buildScript, tmp, '--domain', ''], { encoding: 'utf-8' }).status, 1);
    assert.equal(spawnSync(process.execPath, [buildScript, tmp, '--bogus'], { encoding: 'utf-8' }).status, 1);

    // flow style の categories は unsupported（空カテゴリで generated にしない）→ exit 3
    fs.writeFileSync(path.join(tmp, 'nfr/latest/nfr-grade.yaml'), 'version: "1.0"\nmodel_system:\n  type: "model1"\ncategories: [{ id: A, name: "可用性" }]\n', 'utf-8');
    const flow = buildAll(tmp, ['nfr'])[0];
    assert.equal(flow.status, 'unsupported');
    assert.equal(spawnSync(process.execPath, [buildScript, tmp, '--domain', 'nfr'], { encoding: 'utf-8' }).status, 3);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('CLI --md writes a digest markdown and --md --append adds a second source with its own checklist and fences', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'extract-'));
  try {
    const target = path.join(out, '_inputs-digest.md');
    const stdout = execFileSync(process.execPath, [
      script, archYaml,
      'system_architecture.tiers', 'app_architecture.tier_layers', 'data_architecture.entities', 'technology_context', 'domain_architecture', 'nope.section',
      '--md', '--header', 'design_available: false', '--out', target, '--source-label', 'docs/arch/latest/arch-design.yaml',
    ], { encoding: 'utf-8' });
    assert.ok(stdout.includes('not_applicable: nope.section'));
    const appended = execFileSync(process.execPath, [
      script, nfrYaml, 'categories[id=A]', 'categories[id=B]', 'categories[id=E]', 'categories[id=ZZ]',
      '--md', '--append', '--out', target, '--source-label', 'docs/nfr/latest/nfr-grade.yaml',
    ], { encoding: 'utf-8' });
    assert.ok(appended.startsWith('appended:'));
    const md = fs.readFileSync(target, 'utf-8');
    assert.ok(/^design_available:\s*false\s*$/m.test(md), 'validateSpecEvent.js reads this header line');
    assert.ok(md.includes('| `nope.section` | not_applicable |'));
    assert.ok(md.includes('## system_architecture.tiers'));
    assert.ok(md.includes('## 追加転写元: `docs/nfr/latest/nfr-grade.yaml`'));
    assert.ok(md.includes('| `categories[id=A]` | 転写済み |'));
    assert.ok(md.includes('| `categories[id=ZZ]` | not_applicable |'));
    assert.ok(md.includes('### categories[id=E]\n\n```yaml\n  - id: "E"'), 'appended sections are fenced');
    // fence の対応が取れている（``` の数が偶数）
    assert.equal((md.match(/^```/gm) || []).length % 2, 0);
    // --append は --md と --out が必須。未知オプション / 値欠落 / path 0 件 / ファイル無しは exit 1
    assert.notEqual(spawnSync(process.execPath, [script, nfrYaml, 'model_system', '--append'], { encoding: 'utf-8' }).status, 0);
    assert.equal(spawnSync(process.execPath, [script, nfrYaml, 'model_system', '--mdx'], { encoding: 'utf-8' }).status, 1);
    assert.equal(spawnSync(process.execPath, [script, nfrYaml, 'model_system', '--out'], { encoding: 'utf-8' }).status, 1);
    assert.equal(spawnSync(process.execPath, [script, nfrYaml, '--md'], { encoding: 'utf-8' }).status, 1);
    assert.equal(spawnSync(process.execPath, [script, path.join(out, 'nope.yaml'), 'model_system'], { encoding: 'utf-8' }).status, 1);
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
  assert.deepEqual(listItemValues(text, 'categories', 'id').map(o => o.id), ['A', 'B', 'C', 'D', 'E', 'F']);
});
