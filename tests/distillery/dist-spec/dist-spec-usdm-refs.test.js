'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const VALIDATOR = path.resolve('plugins/distillery/skills/dist-spec/scripts/validateSpecEvent.js');

const REQUIREMENTS = `version: "1.0"
requirements:
  - id: "REQ-001"
    requirement: "R1"
    specifications:
      - id: "SPEC-001-01"
        specification: "S1"
      - id: "SPEC-001-02"
        specification: "S2"
  - id: "REQ-002"
    requirement: "R2"
    specifications:
      - id: "SPEC-002-01"
        specification: "S3"
`;

const SPEC_MD = `# UC

## 概要

x

## 関連 RDRA モデル

| モデル種別 | 要素名 |
|---|---|
| 業務 | 業務A |

## 関連 USDM

| REQ ID | SPEC ID | 対応 BDD Scenario |
|---|---|---|
| REQ-001 | SPEC-001-01 | 正常系 |

## E2E 完了条件

\`\`\`gherkin
Scenario: 正常系
  Given a
  When b
  Then c
\`\`\`

## ティア別仕様

- [CLI](tier-cli.md)
`;

/**
 * docs/specs/{events/{id}|latest} を持つ最小のプロジェクトツリーを作り、validateSpecEvent を実行する。
 *
 * @param {object} t - node:test のコンテキスト
 * @param {Array|undefined} usdmRefs - spec-event.yaml の use_cases[0].usdm。空/undefined なら出力しない
 * @param {object} [options]
 * @param {boolean} [options.withUsdmFile] - docs/usdm/latest/requirements.yaml を置くか
 * @param {string} [options.requirements] - requirements.yaml の内容
 * @param {string} [options.specsSubdir] - docs/specs 配下の入口（既定は events/{id}）
 * @param {string[]} [options.extraArgs] - validateSpecEvent への追加引数
 */
function run(t, usdmRefs, options = {}) {
  const {
    withUsdmFile = true,
    requirements = REQUIREMENTS,
    specsSubdir = 'events/20260907_131000_feedback_abort_consistency',
    extraArgs = [],
  } = options;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-spec-usdm-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const eventDir = path.join(tmp, 'docs/specs', specsSubdir);
  const ucDir = path.join(eventDir, '業務A/BUC-A/UC-A');
  fs.mkdirSync(ucDir, { recursive: true });
  fs.writeFileSync(path.join(ucDir, 'spec.md'), SPEC_MD);
  fs.writeFileSync(path.join(ucDir, 'tier-cli.md'), '## 責務\n\nGiven a When b Then c\n');
  fs.writeFileSync(path.join(ucDir, '_model-summary.yaml'), 'models: []\ntables: []\n');

  if (withUsdmFile) {
    const usdmDir = path.join(tmp, 'docs/usdm/latest');
    fs.mkdirSync(usdmDir, { recursive: true });
    fs.writeFileSync(path.join(usdmDir, 'requirements.yaml'), requirements);
  }

  const lines = [
    'version: "1.0"',
    'event_id: "20260907_131000_feedback_abort_consistency"',
    'created_at: "2026-09-07T13:10:00"',
    'source: "feedback"',
    'use_cases:',
    '  - business: "業務A"',
    '    buc: "BUC-A"',
    '    uc: "UC-A"',
    '    files:',
    '      - spec.md',
    '      - tier-cli.md',
  ];
  if (usdmRefs && usdmRefs.length > 0) {
    lines.push('    usdm:');
    for (const ref of usdmRefs) {
      lines.push(`      - req_id: "${ref.req_id}"`, `        spec_id: "${ref.spec_id}"`);
    }
  }
  lines.push(
    'cross_cutting:',
    '  ux_design:',
    '    user_flows: 0',
    '  ui_design:',
    '    layout_patterns: 0',
    '  data_visualization:',
    '    target_screens: 0',
    'stats:',
    '  total_ucs: 1',
    '  total_apis: 0',
    ''
  );
  fs.writeFileSync(path.join(eventDir, 'spec-event.yaml'), lines.join('\n'));

  return spawnSync(process.execPath, [VALIDATOR, eventDir, '--json', ...extraArgs], { encoding: 'utf8' });
}

/** run() の結果から usdm 検査に関係する error / warning だけを取り出す。 */
function usdmMessages(result) {
  const parsed = JSON.parse(result.stdout);
  const relevant = message => /usdm|USDM|SPEC-|REQ-/.test(message);
  return {
    errors: parsed.errors.filter(relevant),
    warnings: parsed.warnings.filter(relevant),
    stats: parsed.stats,
  };
}

test('USDM に実在する spec_id は usdm の error も warning も出さない', t => {
  const usdm = usdmMessages(run(t, [{ req_id: 'REQ-001', spec_id: 'SPEC-001-01' }]));
  assert.deepEqual(usdm.errors, []);
  assert.deepEqual(usdm.warnings, []);
  assert.equal(usdm.stats.usdm_refs, 1);
});

test('USDM に無い spec_id はエラーになる', t => {
  const usdm = usdmMessages(run(t, [{ req_id: 'REQ-001', spec_id: 'SPEC-009-01' }]));
  assert.ok(usdm.errors.some(e => /SPEC-009-01" が USDM に存在しません/.test(e)), usdm.errors.join('\n'));
});

test('spec_id の親 REQ が req_id と違えばエラーになる', t => {
  const usdm = usdmMessages(run(t, [{ req_id: 'REQ-001', spec_id: 'SPEC-002-01' }]));
  assert.ok(usdm.errors.some(e => /の親は "REQ-002" です/.test(e)), usdm.errors.join('\n'));
});

test('複数参照のうち先頭だけが不正でも検出する', t => {
  const usdm = usdmMessages(run(t, [
    { req_id: 'REQ-001', spec_id: 'SPEC-009-01' },
    { req_id: 'REQ-001', spec_id: 'SPEC-001-01' },
  ]));
  assert.equal(usdm.stats.usdm_refs, 2);
  assert.ok(usdm.errors.some(e => /SPEC-009-01" が USDM に存在しません/.test(e)), usdm.errors.join('\n'));
});

test('requirements.yaml のキー順が変わっても親 REQ を取り違えない', t => {
  // id を specifications の後ろに置いた場合。行順の走査だと SPEC-002-01 の親が REQ-001 になる
  const reordered = [
    'version: "1.0"',
    'requirements:',
    '  - id: "REQ-001"',
    '    requirement: "R1"',
    '    specifications:',
    '      - id: "SPEC-001-01"',
    '        specification: "S1"',
    '  - requirement: "R2"',
    '    specifications:',
    '      - id: "SPEC-002-01"',
    '        specification: "S3"',
    '    id: "REQ-002"',
    '',
  ].join('\n');
  const usdm = usdmMessages(run(t, [{ req_id: 'REQ-002', spec_id: 'SPEC-002-01' }], { requirements: reordered }));
  assert.deepEqual(usdm.errors, []);
  assert.deepEqual(usdm.warnings, []);   // skip で通っていないこと
  assert.equal(usdm.stats.usdm_refs, 1);
});

/**
 * ブロックスカラーの見出しと本文を差し込んだ requirements.yaml を作る。
 *
 * @param {string} header - `|-` や `|2-` などのブロックスカラー見出し
 * @param {string[]} body - 本文行（インデント込み）
 */
function blockScalarRequirements(header, body) {
  return [
    'version: "1.0"',
    'requirements:',
    '  - id: "REQ-001"',
    `    requirement: ${header}`,
    ...body,
    '    specifications:',
    '      - id: "SPEC-001-01"',
    '        specification: "S1"',
    '  - id: "REQ-002"',
    '    requirement: "R2"',
    '    specifications:',
    '      - id: "SPEC-002-01"',
    '        specification: "S3"',
    '',
  ].join('\n');
}

test('ブロックスカラー本文の "id:" を requirement として読み取らない', t => {
  const cases = [
    ['|-', ['      次の形式の要求例を表示すること。', '      id: REQ-002']],
    ['|2-', ['      example', '      id: REQ-002']],
    ['|-2', ['      example', '      id: REQ-002']],
    ['|- # 補足', ['      example', '      id: REQ-002']],
    ['|-', ['      - example', '      id: REQ-002']],   // 本文が "- " で始まっても配列ではない
    ['>-', ['      example', '      id: REQ-002']],
  ];
  for (const [header, body] of cases) {
    const requirements = blockScalarRequirements(header, body);
    const wrong = usdmMessages(run(t, [{ req_id: 'REQ-002', spec_id: 'SPEC-001-01' }], { requirements }));
    assert.ok(wrong.errors.some(e => /の親は "REQ-001" です/.test(e)), `${header}: ${wrong.errors.join('\n')}`);

    const right = usdmMessages(run(t, [{ req_id: 'REQ-001', spec_id: 'SPEC-001-01' }], { requirements }));
    assert.deepEqual(right.errors, [], header);
    assert.deepEqual(right.warnings, [], header);
  }
});

test('規約外の入口では USDM を推測せず skip 警告を出す', t => {
  const usdm = usdmMessages(run(t, [{ req_id: 'REQ-001', spec_id: 'SPEC-001-01' }], { specsSubdir: 'snapshots/latest' }));
  assert.deepEqual(usdm.errors, []);
  assert.ok(usdm.warnings.some(w => /--usdm で指定してください/.test(w)), usdm.warnings.join('\n'));
});

test('docs/specs/latest を検査しても USDM を見つけられる', t => {
  const usdm = usdmMessages(run(t, [{ req_id: 'REQ-001', spec_id: 'SPEC-009-01' }], { specsSubdir: 'latest' }));
  assert.ok(usdm.errors.some(e => /SPEC-009-01" が USDM に存在しません/.test(e)), usdm.errors.join('\n'));
  assert.equal(usdm.stats.usdm_refs, 1);
});

test('USDM ファイルが無ければ実在チェックを skip して警告にとどめる', t => {
  const usdm = usdmMessages(run(t, [{ req_id: 'REQ-001', spec_id: 'SPEC-001-01' }], { withUsdmFile: false }));
  assert.deepEqual(usdm.errors, []);
  assert.ok(usdm.warnings.some(w => /USDM が見つからないため実在チェックを skip/.test(w)));
});

test('spec.md に「関連 USDM」節があるのに usdm が無ければ警告する', t => {
  const usdm = usdmMessages(run(t, undefined));
  assert.ok(
    usdm.warnings.some(w => /「関連 USDM」節があるが spec-event.yaml の use_cases\[\].usdm がありません/.test(w)),
    usdm.warnings.join('\n')
  );
});

test('--usdm に値が無ければ検査を迂回せず exit 2 で止まる', t => {
  for (const extraArgs of [['--usdm'], ['--usdm', '']]) {
    const result = run(t, [{ req_id: 'REQ-001', spec_id: 'SPEC-009-01' }], { extraArgs });
    assert.equal(result.status, 2, `extraArgs=${JSON.stringify(extraArgs)}`);
    assert.match(result.stderr, /--usdm には requirements.yaml のパスが必要です/);
  }
});

test('プロジェクト外の usdm/latest/requirements.yaml は拾わない', t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-spec-usdm-outside-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  // 成果物ルートの外側にだけ USDM を置く
  const outside = path.join(tmp, 'usdm/latest');
  fs.mkdirSync(outside, { recursive: true });
  fs.writeFileSync(path.join(outside, 'requirements.yaml'), REQUIREMENTS);

  const project = path.join(tmp, 'project');
  const eventDir = path.join(project, 'docs/specs/latest');
  const ucDir = path.join(eventDir, '業務A/BUC-A/UC-A');
  fs.mkdirSync(ucDir, { recursive: true });
  fs.writeFileSync(path.join(ucDir, 'spec.md'), SPEC_MD);
  fs.writeFileSync(path.join(ucDir, 'tier-cli.md'), '## 責務\n\nGiven a When b Then c\n');
  fs.writeFileSync(path.join(ucDir, '_model-summary.yaml'), 'models: []\ntables: []\n');
  fs.writeFileSync(path.join(eventDir, 'spec-event.yaml'), [
    'version: "1.0"',
    'event_id: "20260907_131000_feedback_abort_consistency"',
    'created_at: "2026-09-07T13:10:00"',
    'source: "feedback"',
    'use_cases:',
    '  - business: "業務A"',
    '    buc: "BUC-A"',
    '    uc: "UC-A"',
    '    files:',
    '      - spec.md',
    '      - tier-cli.md',
    '    usdm:',
    '      - req_id: "REQ-001"',
    '        spec_id: "SPEC-001-01"',
    'cross_cutting:',
    '  ux_design:',
    '    user_flows: 0',
    '  ui_design:',
    '    layout_patterns: 0',
    '  data_visualization:',
    '    target_screens: 0',
    'stats:',
    '  total_ucs: 1',
    '  total_apis: 0',
    '',
  ].join('\n'));

  const result = spawnSync(process.execPath, [VALIDATOR, eventDir, '--json'], { encoding: 'utf8' });
  const parsed = JSON.parse(result.stdout);
  assert.ok(
    parsed.warnings.some(w => /USDM が見つからないため実在チェックを skip/.test(w)),
    parsed.warnings.join('\n')
  );
});
