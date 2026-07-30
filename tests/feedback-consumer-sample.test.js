'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const sampleRoot = path.join(root, 'samples/distillery/pipeline');
const feedbackId = '20260729_121600_impl_feedback_19ec0182';
const runDir = path.join(sampleRoot, 'pipeline/feedback-runs', feedbackId);
const eventsDir = path.join(sampleRoot, 'pipeline/events');
const producerInput = path.join(
  root,
  'samples/distillery-impl/docs/impl/latest/19ec0182/feedback-requests',
  `${feedbackId}.md`,
);
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
  assert.equal(run.input_sha256, '5b4dc4155b3d6aed830334dde78a0df21187dc84e93b70632c40b4b484a891f2');
  assert.equal(fs.existsSync(path.join(runDir, 'input.json')), false);
});

test('consumer result reports six merged, five deferred, zero applied, and a result-bound abort', () => {
  const result = readJson(path.join(runDir, 'result.json'));
  const status = readJson(path.join(runDir, 'status.json'));
  const terminal = readJson(path.join(eventsDir, result.terminal_event_id, 'event.json'));
  const counts = result.work_units.reduce((accumulator, item) => {
    accumulator[item.disposition] = (accumulator[item.disposition] || 0) + 1;
    return accumulator;
  }, {});
  assert.deepEqual(counts, { deferred: 5, merged: 6 });
  assert.equal(counts.applied || 0, 0);
  assert.equal(result.status, 'blocked');
  assert.equal(status.state, 'blocked');
  assert.equal(terminal.type, 'feedback_run_aborted');
  assert.equal(terminal.run_id, result.run_id);
  assert.equal(terminal.attempt, result.attempt);
  assert.equal(terminal.result_sha256, sha256(fs.readFileSync(path.join(runDir, 'result.json'))));
});

test('every successful stage writes one no-change manifest per owned root and reconciles every causal unit', () => {
  const plan = readJson(path.join(runDir, 'plan.json'));
  const result = readJson(path.join(runDir, 'result.json'));
  const catalog = loadCatalog().value;
  const catalogById = new Map(catalog.stages.map(stage => [stage.id, stage]));
  for (const stageResult of result.stages) {
    const planned = plan.execution_stages.find(stage => stage.id === stageResult.stage_id);
    const event = readJson(path.join(eventsDir, stageResult.event_ids[0], 'event.json'));
    const roots = catalogById.get(stageResult.stage_id).domain_event_roots;
    assert.deepEqual(event.work_unit_results.map(item => item.work_unit_id), planned.direct_work_unit_ids);
    assert.deepEqual(event.reconciliation_results.map(item => item.work_unit_id), planned.causal_work_unit_ids);
    assert.equal(event.reconciliation_results.some(item => item.status === 'changed'), false);
    assert.equal(event.domain_event_refs.length, roots.length);
    for (const root of roots) {
      const reference = event.domain_event_refs.find(item => item.path.startsWith(`${root}/`));
      assert.ok(reference, `${stageResult.stage_id}: missing ${root}`);
      assert.equal(path.basename(reference.path), 'feedback-disposition.json');
      const manifest = readJson(path.join(sampleRoot, reference.path));
      assert.equal(manifest.type, 'feedback_no_domain_change');
      assert.equal(manifest.stage, stageResult.stage_id);
      assert.equal(manifest.domain_event_root, root);
    }
  }
});

test('merged evidence is immutable prior-event data with exact hashes; generated domain events are manifests only', () => {
  const result = readJson(path.join(runDir, 'result.json'));
  for (const unit of result.work_units.filter(item => item.disposition === 'merged')) {
    assert.ok(unit.artifact_refs.length > 0, unit.work_unit_id);
    for (const reference of unit.artifact_refs) {
      assert.match(reference, /\/events\/2026(?:04|07)/);
      assert.equal(reference.includes('/latest/'), false);
      assert.ok(fs.statSync(path.join(sampleRoot, reference)).isFile());
    }
  }
  for (const stage of result.stages) {
    const event = readJson(path.join(eventsDir, stage.event_ids[0], 'event.json'));
    for (const evidence of event.work_unit_evidence_refs) {
      assert.equal(evidence.sha256, sha256(fs.readFileSync(path.join(sampleRoot, evidence.path))));
    }
    assert.ok(event.domain_event_refs.every(reference => reference.path.endsWith('/feedback-disposition.json')));
  }
});

test('no-change stages preserve every domain latest tree while appending auditable event directories', () => {
  const plan = readJson(path.join(runDir, 'plan.json'));
  const result = readJson(path.join(runDir, 'result.json'));
  const initial = plan.routing_basis.domain_event_root_snapshots;
  const finalStage = readJson(path.join(eventsDir, result.stages.at(-1).event_ids[0], 'event.json'));
  const final = finalStage.post_execution_basis.domain_event_root_snapshots;
  for (const root of Object.keys(initial)) {
    assert.equal(final[root].latest_tree_sha256, initial[root].latest_tree_sha256, root);
    assert.ok(final[root].event_ids.length > initial[root].event_ids.length, root);
  }
});

test('requirements lineage coverage is derived from the completed owner ledger, not a caller exclusion list', () => {
  const validator = path.join(root, 'plugins/distillery/skills/dist-requirements/scripts/validateRequirements.js');
  const requirements = path.join(sampleRoot, 'usdm/latest/requirements.yaml');
  const plan = path.join(runDir, 'plan.json');
  const stageEvent = path.join(eventsDir, '20260730_120200_feedback_requirements_completed/event.json');
  const result = spawnSync(process.execPath, [
    validator,
    requirements,
    '--feedback-plan', plan,
    '--feedback-stage-event', stageEvent,
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /PASS:/);

  const bypass = spawnSync(process.execPath, [
    validator,
    requirements,
    '--feedback-plan', plan,
    '--feedback-stage-event', stageEvent,
    '--exclude-work-units', 'CR-19ec0182-001#1',
  ], { encoding: 'utf8' });
  assert.equal(bypass.status, 2);
  assert.match(bypass.stderr, /Unknown option: --exclude-work-units/);
});
