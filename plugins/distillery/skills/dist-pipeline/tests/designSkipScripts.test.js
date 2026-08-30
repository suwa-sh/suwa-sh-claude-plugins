'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { presentationTiers, isPresentationTierId } = require('../scripts/hasPresentationTier');
const { resolvePipelineConfig } = require('../scripts/resolvePipelineConfig');

test('presentation tier detection matches whole id tokens only', () => {
  assert.equal(isPresentationTierId('tier-frontend'), true);
  assert.equal(isPresentationTierId('tier-web-ui'), true);
  assert.equal(isPresentationTierId('admin_presentation'), true);
  assert.equal(isPresentationTierId('tier-build-worker'), false, '"build" contains "ui" but is not a UI tier');
  assert.equal(isPresentationTierId('tier-cli'), false);
  assert.equal(isPresentationTierId('tier-backend-api'), false);
  const result = presentationTiers({ system_architecture: { tiers: [{ id: 'tier-cli' }, { id: 'tier-backend-api' }] } });
  assert.deepEqual(result, { tier_ids: ['tier-cli', 'tier-backend-api'], presentation_tiers: [] });
  assert.throws(() => presentationTiers({ system_architecture: {} }), /tiers is not an array/);
});

test('pipeline-config resolution distinguishes undefined skip_steps from an explicit empty list', () => {
  const undefinedKey = resolvePipelineConfig({ step_models: { step5: 'sonnet' } });
  assert.equal(undefinedKey.skip_steps_defined, false);
  assert.deepEqual(undefinedKey.skip_steps, []);
  assert.equal(undefinedKey.step_models.step5, 'sonnet');

  const explicitEmpty = resolvePipelineConfig({ skip_steps: [] });
  assert.equal(explicitEmpty.skip_steps_defined, true);
  assert.deepEqual(explicitEmpty.skip_steps, []);

  const missingFile = resolvePipelineConfig(null);
  assert.equal(missingFile.skip_steps_defined, false);
});

test('skip_steps implies step6a from step5 and ignores unsupported values with a warning', () => {
  const step5 = resolvePipelineConfig({ skip_steps: ['step5'] });
  assert.deepEqual(step5.skip_steps, ['step5', 'step6a']);
  assert.deepEqual(step5.warnings, []);

  const step6aOnly = resolvePipelineConfig({ skip_steps: ['step6a'] });
  assert.deepEqual(step6aOnly.skip_steps, ['step6a']);

  const bogus = resolvePipelineConfig({ skip_steps: ['step3', 'step6a'], step_models: { step6a: 3 } });
  assert.deepEqual(bogus.skip_steps, ['step6a']);
  assert.equal(bogus.warnings.length, 2);
  assert.equal(bogus.step_models.step6a, null);

  const notArray = resolvePipelineConfig({ skip_steps: 'step5' });
  assert.deepEqual(notArray.skip_steps, []);
  assert.ok(notArray.warnings[0].includes('not an array'));
});

test('config text with inline comments (README / schema examples) resolves correctly', () => {
  const { parsePipelineConfigText } = require('../scripts/resolvePipelineConfig');
  const text = [
    'schema_version: distillery.pipeline-config/v1',
    'step_models:',
    '  step1: null      # requirements',
    '  step4b: "sonnet"  # lightweight',
    '  step6: "op#us"    # quoted hash must survive',
    '# skip_steps: [step5, step6a]',
    'skip_steps: [step5, step6a]   # skip design',
    '',
  ].join('\n');
  const resolved = resolvePipelineConfig(parsePipelineConfigText(text));
  assert.equal(resolved.step_models.step1, null);
  assert.equal(resolved.step_models.step4b, 'sonnet');
  assert.equal(resolved.step_models.step6, 'op#us');
  assert.equal(resolved.skip_steps_defined, true);
  assert.deepEqual(resolved.skip_steps, ['step5', 'step6a']);
  assert.deepEqual(resolved.warnings, []);

  const commentedOnly = resolvePipelineConfig(parsePipelineConfigText('step_models:\n  step5: null\n# skip_steps: [step5]\n'));
  assert.equal(commentedOnly.skip_steps_defined, false);
});

test('design skip recommendation combines interface_kind with presentation tier presence', () => {
  const { evaluate } = require('../scripts/hasPresentationTier');
  const cliArch = { system_architecture: { tiers: [{ id: 'tier-cli-presentation' }, { id: 'tier-backend-api' }] } };
  assert.equal(evaluate(cliArch, 'gui').recommend_design_skip, false, 'presentation tier present and gui → run design');
  assert.equal(evaluate(cliArch, 'cli').recommend_design_skip, true, 'interface_kind cli overrides tier naming');
  const noUiArch = { system_architecture: { tiers: [{ id: 'tier-cli' }, { id: 'tier-worker' }] } };
  assert.equal(evaluate(noUiArch, 'gui').recommend_design_skip, true, 'no presentation tier → recommend skip even when gui');
});
