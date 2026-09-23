'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateWithSchema } = require('../../../plugins/distillery2/scripts/lib/schemaValidate');

const schema = {
  type: 'object', required: ['id', 'kind'], additionalProperties: false,
  properties: {
    id: { type: 'string', pattern: '^[a-z-]+$', maxLength: 10 },
    kind: { enum: ['rule', 'contract', 'requirement'] },
    n: { type: 'integer', minimum: 1 },
    items: { type: 'array', minItems: 1, items: { $ref: '#/$defs/item' } },
    choice: { oneOf: [{ type: 'string' }, { type: 'integer' }] },
  },
  $defs: { item: { type: 'object', required: ['x'], properties: { x: { type: 'number' } } } },
};

test('valid document passes', () => {
  assert.deepEqual(validateWithSchema({ id: 'abc', kind: 'rule', n: 2, items: [{ x: 1 }], choice: 'a' }, schema), []);
});

test('violations are reported with paths', () => {
  const errors = validateWithSchema({ id: 'ABC-TOO-LONG', kind: 'other', n: 0, items: [], extra: 1, choice: true }, schema);
  const paths = errors.map(e => e.path).sort();
  assert.deepEqual(paths, ['$.choice', '$.extra', '$.id', '$.id', '$.items', '$.kind', '$.n']);
});

test('$ref into $defs and missing required inside items', () => {
  const errors = validateWithSchema({ id: 'a', kind: 'rule', items: [{}] }, schema);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].path, '$.items[0]');
});
