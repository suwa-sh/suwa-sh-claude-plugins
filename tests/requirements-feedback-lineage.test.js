'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  deriveAppliedRequirementsWorkUnitIds,
  parseYaml,
  validateFeedbackLineage,
  validateRequirementsSemantics,
} = require('../plugins/distillery/skills/dist-requirements/scripts/validateRequirements');

const plan = {
  feedback_request_id: 'feedback-1',
  work_units: [
    { id: 'CR-example-001#1', direct_stage: 'requirements' },
  ],
};

test('feedback lineage is required only on entries changed by the current requirements work unit', () => {
  const data = {
    requirements: [
      {
        feedback_source: {
          feedback_request_id: 'feedback-1',
          work_unit_ids: ['CR-example-001#1'],
        },
        specifications: [{ id: 'SPEC-001-01' }],
      },
      {
        id: 'REQ-002',
        specifications: [{ id: 'SPEC-002-01' }],
      },
    ],
  };

  assert.deepEqual(validateFeedbackLineage(data, plan), []);
});

test('feedback lineage still requires exact coverage and rejects foreign work units when present', () => {
  const missing = { requirements: [{ specifications: [{}] }] };
  assert.ok(validateFeedbackLineage(missing, plan).some(error => error.message.includes('is not referenced')));

  const foreign = {
    requirements: [{
      feedback_source: {
        feedback_request_id: 'feedback-1',
        work_unit_ids: ['CR-foreign-001#1'],
      },
      specifications: [{}],
    }],
  };
  assert.ok(validateFeedbackLineage(foreign, plan).some(error => error.message.includes('is not assigned')));
});

test('requirements lineage scope is derived from applied owner-ledger results only', () => {
  const ledgerPlan = {
    feedback_request_id: 'feedback-1',
    input_sha256: 'a'.repeat(64),
    work_units: [
      { id: 'CR-example-001#1', request_id: 'CR-example-001', direct_stage: 'requirements' },
      { id: 'CR-example-002#1', request_id: 'CR-example-002', direct_stage: 'requirements' },
    ],
    execution_stages: [{
      id: 'requirements',
      direct_work_unit_ids: ['CR-example-001#1', 'CR-example-002#1'],
      causal_work_unit_ids: ['CR-example-001#1', 'CR-example-002#1'],
    }],
  };
  const stageEvent = {
    type: 'feedback_stage_completed',
    stage: 'requirements',
    direct_work_unit_ids: ['CR-example-001#1', 'CR-example-002#1'],
    causal_work_unit_ids: ['CR-example-001#1', 'CR-example-002#1'],
    feedback_request: {
      feedback_request_id: 'feedback-1',
      input_sha256: 'a'.repeat(64),
      request_ids: ['CR-example-001', 'CR-example-002'],
      work_unit_ids: ['CR-example-001#1', 'CR-example-002#1'],
    },
    work_unit_results: [
      { work_unit_id: 'CR-example-001#1', disposition: 'applied' },
      { work_unit_id: 'CR-example-002#1', disposition: 'merged' },
    ],
  };
  const binding = deriveAppliedRequirementsWorkUnitIds(ledgerPlan, stageEvent);
  assert.deepEqual(binding, { appliedWorkUnitIds: ['CR-example-001#1'], errors: [] });

  const data = {
    requirements: [
      {
        feedback_source: {
          feedback_request_id: 'historic-feedback',
          work_unit_ids: ['CR-historic-001#1'],
        },
        specifications: [{}],
      },
      {
        feedback_source: {
          feedback_request_id: 'feedback-1',
          work_unit_ids: ['CR-example-001#1'],
        },
        specifications: [{}],
      },
    ],
  };
  assert.deepEqual(validateFeedbackLineage(data, ledgerPlan, {
    appliedWorkUnitIds: binding.appliedWorkUnitIds,
  }), []);

  const forged = structuredClone(stageEvent);
  forged.direct_work_unit_ids.reverse();
  assert.ok(deriveAppliedRequirementsWorkUnitIds(ledgerPlan, forged).errors.some(error =>
    error.includes('direct_work_unit_ids')));

  const forgedHistoricLineage = structuredClone(data);
  forgedHistoricLineage.requirements[0].feedback_source.work_unit_ids = ['CR-example-002#1'];
  assert.ok(validateFeedbackLineage(forgedHistoricLineage, ledgerPlan, {
    appliedWorkUnitIds: binding.appliedWorkUnitIds,
  }).some(error => error.message.includes('Expected feedback-1')));
});

test('requirements and specification identifiers are globally unambiguous', () => {
  const duplicateIds = {
    requirements: [
      {
        id: 'REQ-001',
        specifications: [{ id: 'SPEC-001-01' }],
      },
      {
        id: 'REQ-001',
        specifications: [{ id: 'SPEC-001-01' }],
      },
    ],
  };
  const duplicateErrors = validateRequirementsSemantics(duplicateIds);
  assert.ok(duplicateErrors.some(error => error.message.includes('Requirement id REQ-001 duplicates')));
  assert.ok(duplicateErrors.some(error => error.message.includes('Specification id SPEC-001-01 duplicates')));

  const wrongParent = {
    requirements: [{
      id: 'REQ-002',
      specifications: [{ id: 'SPEC-003-01' }],
    }],
  };
  assert.ok(validateRequirementsSemantics(wrongParent).some(error =>
    error.message === 'Specification id SPEC-003-01 must belong to REQ-002'));

  const valid = {
    requirements: [
      { id: 'REQ-001', specifications: [{ id: 'SPEC-001-01' }, { id: 'SPEC-001-02' }] },
      { id: 'REQ-002', specifications: [{ id: 'SPEC-002-01' }] },
    ],
  };
  assert.deepEqual(validateRequirementsSemantics(valid), []);
});

test('requirements YAML rejects duplicate mapping keys at every nesting level', () => {
  assert.throws(
    () => parseYaml('version: "1.0"\nversion: "2.0"\n'),
    /Duplicate mapping key: version/,
  );
  assert.throws(
    () => parseYaml([
      'requirements:',
      '  - id: "REQ-001"',
      '    feedback_source:',
      '      feedback_request_id: "feedback-1"',
      '      feedback_request_id: "forged"',
      '      work_unit_ids:',
      '        - "CR-example-001#1"',
      '    specifications:',
      '      - id: "SPEC-001-01"',
      '',
    ].join('\n')),
    /Duplicate mapping key: feedback_request_id/,
  );
  assert.throws(
    () => parseYaml([
      'requirements:',
      '  - id: "REQ-001"',
      '    id: "REQ-002"',
      '    specifications:',
      '      - id: "SPEC-001-01"',
      '',
    ].join('\n')),
    /Duplicate mapping key: id/,
  );
  assert.throws(
    () => parseYaml('"version": "1.0"\n'),
    /Unsupported mapping key/,
  );
});
