'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

// samples/distillery/pipeline の feedback 往復（distillery 1.9.x / --recommended-auto）を固定 fixture として検証する。
// 旧 sample（2026-07、6 merged / 5 deferred / blocked）は 1.9.3 で全面再生成し、11 applied / completed の run に置き換えた。
const root = path.resolve(__dirname, '..');
const sampleRoot = path.join(root, 'samples/distillery/pipeline');
const feedbackId = '20260902_184257_impl_feedback_d0f57ea2';
const runDir = path.join(sampleRoot, 'pipeline/feedback-runs', feedbackId);
const eventsDir = path.join(sampleRoot, 'pipeline/events');
// 公開 Markdown は sample 内に同梱している（distillery-impl sample とは独立）
const producerInput = path.join(sampleRoot, 'feedback-requests', `${feedbackId}.md`);
const {
  loadCatalog,
} = require('../plugins/distillery/skills/dist-pipeline/scripts/planFeedbackRequest');
const {
  validateRunDirectory,
} = require('../plugins/distillery/skills/dist-pipeline/scripts/verifyFeedbackResult');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

test('consumer sample passes the standalone lifecycle, routing, artifact, and lineage verifier', () => {
  assert.deepEqual(validateRunDirectory(runDir, eventsDir, { artifactRoot: sampleRoot }), []);
});

test('consumer run input is the producer Markdown exact bytes and has no companion target-stage input', () => {
  const producerBytes = fs.readFileSync(producerInput);
  const runBytes = fs.readFileSync(path.join(runDir, 'input.md'));
  const run = readJson(path.join(runDir, 'run.json'));
  assert.deepEqual(runBytes, producerBytes);
  assert.equal(run.input_sha256, sha256(producerBytes));
  assert.equal(run.input_sha256, '7afd483f6a221ae5f469cbcbc5c7c3bce46be4f4924e7aec3f1e9b2b682c9133');
  assert.equal(fs.existsSync(path.join(runDir, 'input.json')), false);
});

test('consumer result reports eleven applied, zero merged or deferred, and a result-bound completion', () => {
  const result = readJson(path.join(runDir, 'result.json'));
  const status = readJson(path.join(runDir, 'status.json'));
  const terminal = readJson(path.join(eventsDir, result.terminal_event_id, 'event.json'));
  const counts = result.work_units.reduce((accumulator, item) => {
    accumulator[item.disposition] = (accumulator[item.disposition] || 0) + 1;
    return accumulator;
  }, {});
  assert.deepEqual(counts, { applied: 11 });
  assert.equal(result.requests.length, 11);
  assert.ok(result.requests.every(item => item.disposition === 'applied'));
  assert.equal(result.status, 'completed');
  assert.equal(status.state, 'completed');
  assert.equal(status.ambiguity_policy, 'recommended_auto');
  assert.equal(terminal.type, 'feedback_run_completed');
  assert.equal(terminal.run_id, result.run_id);
  assert.equal(terminal.attempt, result.attempt);
  assert.equal(terminal.result_sha256, sha256(fs.readFileSync(path.join(runDir, 'result.json'))));
});

test('conservative suffix closure runs design_system → spec → spec_stories and reconciles every causal unit', () => {
  const plan = readJson(path.join(runDir, 'plan.json'));
  const result = readJson(path.join(runDir, 'result.json'));
  assert.deepEqual(result.stages.map(stage => stage.stage_id), ['design_system', 'spec', 'spec_stories']);
  const catalog = loadCatalog().value;
  const catalogById = new Map(catalog.stages.map(stage => [stage.id, stage]));
  for (const stageResult of result.stages) {
    const planned = plan.execution_stages.find(stage => stage.id === stageResult.stage_id);
    const event = readJson(path.join(eventsDir, stageResult.event_ids[0], 'event.json'));
    const roots = catalogById.get(stageResult.stage_id).domain_event_roots;
    assert.deepEqual(event.work_unit_results.map(item => item.work_unit_id), planned.direct_work_unit_ids);
    assert.deepEqual(event.reconciliation_results.map(item => item.work_unit_id), planned.causal_work_unit_ids);
    assert.ok(event.domain_event_refs.length > 0, stageResult.stage_id);
    for (const reference of event.domain_event_refs) {
      assert.ok(roots.some(root => reference.path.startsWith(`${root}/`)), `${stageResult.stage_id}: ${reference.path} is outside owned roots`);
      assert.equal(reference.path.includes('/latest/'), false);
      assert.equal(reference.sha256, sha256(fs.readFileSync(path.join(sampleRoot, reference.path))));
    }
  }
});

test('applied evidence lives under immutable event directories with exact hashes, never under latest', () => {
  const result = readJson(path.join(runDir, 'result.json'));
  for (const unit of result.work_units) {
    assert.ok(unit.artifact_refs.length > 0, unit.work_unit_id);
    for (const reference of unit.artifact_refs) {
      assert.match(reference, /\/events\/2026/);
      assert.equal(reference.includes('/latest/'), false);
      assert.ok(fs.statSync(path.join(sampleRoot, reference)).isFile(), reference);
    }
  }
  for (const stage of result.stages) {
    const event = readJson(path.join(eventsDir, stage.event_ids[0], 'event.json'));
    for (const evidence of event.work_unit_evidence_refs) {
      assert.equal(evidence.sha256, sha256(fs.readFileSync(path.join(sampleRoot, evidence.path))));
    }
  }
});

test('executed stages append auditable event directories and the final basis covers every domain root', () => {
  const plan = readJson(path.join(runDir, 'plan.json'));
  const result = readJson(path.join(runDir, 'result.json'));
  const initial = plan.routing_basis.domain_event_root_snapshots;
  const finalStage = readJson(path.join(eventsDir, result.stages.at(-1).event_ids[0], 'event.json'));
  const final = finalStage.post_execution_basis.domain_event_root_snapshots;
  assert.deepEqual(Object.keys(final).sort(), Object.keys(initial).sort());
  for (const root of Object.keys(initial)) {
    assert.ok(final[root].event_ids.length >= initial[root].event_ids.length, root);
    for (const eventId of initial[root].event_ids) assert.ok(final[root].event_ids.includes(eventId), `${root}: ${eventId} vanished`);
  }
  // 変更対象 root（design / specs）は event が増え、非対象 root は増えない
  assert.ok(final['design/events'].event_ids.length > initial['design/events'].event_ids.length);
  assert.ok(final['specs/events'].event_ids.length > initial['specs/events'].event_ids.length);
  assert.equal(final['rdra/events'].event_ids.length, initial['rdra/events'].event_ids.length);
});

test('requirements validator rejects a caller exclusion list instead of narrowing lineage coverage', () => {
  const validator = path.join(root, 'plugins/distillery/skills/dist-requirements/scripts/validateRequirements.js');
  const requirements = path.join(sampleRoot, 'usdm/latest/requirements.yaml');
  const result = spawnSync(process.execPath, [validator, requirements], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /PASS:/);

  const bypass = spawnSync(process.execPath, [
    validator,
    requirements,
    '--exclude-work-units', 'CR-d0f57ea2-001#1',
  ], { encoding: 'utf8' });
  assert.equal(bypass.status, 2);
  assert.match(bypass.stderr, /Unknown option: --exclude-work-units/);
});
