'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const scanRoots = [
  path.join(root, '.github'),
  path.join(root, 'plugins/distillery'),
  path.join(root, 'plugins/distillery-impl'),
  path.join(root, 'samples/distillery'),
  path.join(root, 'tests/fixtures/distillery'),
  path.join(root, 'samples/distillery-impl'),
];
const forbidden = [
  'distillery.feedback-batch/v1',
  'feedback-batches',
  'feedback-routes',
  'target_stages',
  'feedback_batch_approved',
  'feedbackBatchHash',
  'planFeedbackBatch',
  'reviewed feedback batch',
  'feedback batch contract',
  'directive_ids',
];

function filesUnder(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...filesUnder(target));
    else if (entry.isFile()) result.push(target);
  }
  return result;
}

test('active workflow, plugins, and samples contain no legacy external feedback-batch contract', () => {
  const violations = [];
  for (const file of scanRoots.flatMap(filesUnder)) {
    const bytes = fs.readFileSync(file);
    if (bytes.includes(0)) continue;
    const text = bytes.toString('utf8');
    const folded = text.toLowerCase();
    for (const token of forbidden) {
      if (folded.includes(token.toLowerCase())) violations.push(`${path.relative(root, file)}: ${token}`);
    }
  }
  assert.deepEqual(violations, []);
});
