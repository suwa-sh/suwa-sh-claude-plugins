'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const VALIDATOR = path.resolve('plugins/distillery/skills/dist-infrastructure/scripts/validateInfraEvent.js');

function infraEvent(eventId) {
  return [
    'version: "1.0"',
    `event_id: "${eventId}"`,
    'created_at: "2026-09-07T12:40:00"',
    'source: "arch-design.yaml からのインフラ設計変換"',
    'arch_event_ref: "20260907_122000_feedback_abort_consistency"',
    'nfr_event_ref: "20260907_120000_feedback_abort_consistency"',
    'foundation_context_ref: "docs/mcl/foundation/output/foundation-context.yaml"',
    'shared_platform_context_ref: "docs/mcl/shared-platform/output/shared-platform-context.yaml"',
    'translation:',
    '  workload_type: "batch"',
    '  availability_tier: "99.9%"',
    '  latency_target_p99: "1s"',
    '  data_classification: "internal"',
    '  traffic_pattern_type: "scheduled"',
    '  consistency_model: "strong"',
    '  cost_posture: "balanced"',
    '  target_clouds:',
    '    - onprem',
    'mcl_execution:',
    '  status: "partial"',
    '  outputs: []',
    'arch_feedback: null',
    '',
  ].join('\n');
}

function runValidator(t, eventId) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-infra-event-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const yamlPath = path.join(tmp, 'infra-event.yaml');
  fs.writeFileSync(yamlPath, infraEvent(eventId));
  return spawnSync(process.execPath, [VALIDATOR, yamlPath], { encoding: 'utf8' });
}

test('feedback mode の event_id を受け付ける', t => {
  const result = runValidator(t, '20260907_124000_feedback_abort_consistency');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /^PASS/m);
});

test('pipeline の feedback_id 文字種（. _ -）を受け付ける', t => {
  assert.equal(runValidator(t, '20260907_124000_feedback_abort.consistency').status, 0);
  assert.equal(runValidator(t, '20260907_124000_feedback_abort-consistency_2').status, 0);
});

test('feedback_id に使えない大文字は FAIL する', t => {
  assert.equal(runValidator(t, '20260907_124000_feedback_Abort').status, 1);
});

test('通常 mode の event_id と重複回避サフィックスを受け付ける', t => {
  assert.equal(runValidator(t, '20260328_140000_infra_product_design').status, 0);
  assert.equal(runValidator(t, '20260328_140000_infra_product_design_2').status, 0);
});

test('形式外の event_id は FAIL する', t => {
  const result = runValidator(t, 'abort_consistency');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /\$\.event_id/);
});
