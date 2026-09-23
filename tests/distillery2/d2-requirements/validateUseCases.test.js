'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPTS = path.resolve(__dirname, '../../../plugins/distillery2/skills/d2-requirements/scripts');
const FIX = path.join(__dirname, 'fixtures');
const { generate } = require(path.join(SCRIPTS, 'genUseCases'));
const { parseYaml, stringifyYaml } = require(path.resolve(SCRIPTS, '../../../scripts/lib/yaml'));

const reqData = parseYaml(fs.readFileSync(path.join(FIX, 'requirements-pass.yaml'), 'utf8'));
const bucText = fs.readFileSync(path.join(FIX, 'BUC.tsv'), 'utf8');
const VALIDATE = path.join(SCRIPTS, 'validateUseCases.js');

/** spec_ids が空の UC は no_spec_reason + status: blocked にして baseline を PASS 可能にする (指摘2)。 */
function fillEmpties(doc) {
  for (const uc of doc.use_cases) {
    if (!uc.spec_ids.length) { uc.no_spec_reason = '対応 SPEC が未確定 (テスト)'; uc.status = 'blocked'; }
  }
  return doc;
}
function tmpProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2vuc-'));
  fs.writeFileSync(path.join(dir, 'use-cases.yaml'), stringifyYaml(fillEmpties(generate(reqData, bucText, new Map()))) + '\n');
  return dir;
}
function run(dir, extra = []) {
  return spawnSync(process.execPath, [VALIDATE, path.join(dir, 'use-cases.yaml'), ...extra], { encoding: 'utf8' });
}

test('requirements.yaml が同ディレクトリにあれば PASS (exit 0)', () => {
  const dir = tmpProject();
  fs.copyFileSync(path.join(FIX, 'requirements-pass.yaml'), path.join(dir, 'requirements.yaml'));
  const r = run(dir);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('requirements.yaml が無いと省略せず exit 2', () => {
  const dir = tmpProject(); // requirements.yaml を置かない
  const r = run(dir);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /requirements\.yaml not found/);
});

test('requirements.yaml が読めない (ディレクトリ) と exit 2', () => {
  const dir = tmpProject();
  fs.mkdirSync(path.join(dir, 'requirements.yaml')); // 読み込みが EISDIR で失敗する
  const r = run(dir);
  assert.equal(r.status, 2, r.stdout + r.stderr);
});

test('requirements.yaml に無い spec_id はエラー (exit 1)', () => {
  const dir = tmpProject();
  fs.copyFileSync(path.join(FIX, 'requirements-pass.yaml'), path.join(dir, 'requirements.yaml'));
  const doc = parseYaml(fs.readFileSync(path.join(dir, 'use-cases.yaml'), 'utf8'));
  doc.use_cases[0].spec_ids = ['SPEC-999-99'];
  fs.writeFileSync(path.join(dir, 'use-cases.yaml'), stringifyYaml(doc) + '\n');
  const r = run(dir);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /SPEC-999-99/);
});

test('spec_ids_rejected が spec_ids と重複するとエラー (exit 1)', () => {
  const dir = tmpProject();
  fs.copyFileSync(path.join(FIX, 'requirements-pass.yaml'), path.join(dir, 'requirements.yaml'));
  const doc = parseYaml(fs.readFileSync(path.join(dir, 'use-cases.yaml'), 'utf8'));
  const uc = doc.use_cases.find(u => u.spec_ids.length);
  uc.spec_ids_rejected = [uc.spec_ids[0]];
  fs.writeFileSync(path.join(dir, 'use-cases.yaml'), stringifyYaml(doc) + '\n');
  const r = run(dir);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /spec_ids_rejected/);
  assert.match(r.stdout, /重複/);
});

test('requirements.yaml に無い spec_ids_rejected はエラー (exit 1)', () => {
  const dir = tmpProject();
  fs.copyFileSync(path.join(FIX, 'requirements-pass.yaml'), path.join(dir, 'requirements.yaml'));
  const doc = parseYaml(fs.readFileSync(path.join(dir, 'use-cases.yaml'), 'utf8'));
  doc.use_cases[0].spec_ids_rejected = ['SPEC-888-88'];
  fs.writeFileSync(path.join(dir, 'use-cases.yaml'), stringifyYaml(doc) + '\n');
  const r = run(dir);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /SPEC-888-88/);
});

test('spec_ids が空で no_spec_reason も無いとエラー (指摘2, exit 1)', () => {
  const dir = tmpProject();
  fs.copyFileSync(path.join(FIX, 'requirements-pass.yaml'), path.join(dir, 'requirements.yaml'));
  const doc = parseYaml(fs.readFileSync(path.join(dir, 'use-cases.yaml'), 'utf8'));
  const uc = doc.use_cases.find(u => u.spec_ids.length);
  uc.spec_ids = [];
  delete uc.no_spec_reason;
  fs.writeFileSync(path.join(dir, 'use-cases.yaml'), stringifyYaml(doc) + '\n');
  const r = run(dir);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /spec_ids が空/);
});

test('no_spec_reason があるのに status が blocked でないとエラー (指摘2, exit 1)', () => {
  const dir = tmpProject();
  fs.copyFileSync(path.join(FIX, 'requirements-pass.yaml'), path.join(dir, 'requirements.yaml'));
  const doc = parseYaml(fs.readFileSync(path.join(dir, 'use-cases.yaml'), 'utf8'));
  const uc = doc.use_cases.find(u => u.spec_ids.length);
  uc.spec_ids = [];
  uc.no_spec_reason = '対応 SPEC が無い';
  uc.status = 'planned';
  fs.writeFileSync(path.join(dir, 'use-cases.yaml'), stringifyYaml(doc) + '\n');
  const r = run(dir);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /status: blocked/);
});
