'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseYaml, stringifyYaml } = require('../../../plugins/distillery2/scripts/lib/yaml');

test('scalars, nested maps, arrays', () => {
  const doc = parseYaml(['name: loan', 'count: 3', 'ratio: 0.5', 'ok: true', 'none: ~', 'tags: [a, "b c", 1]', 'flow: {x: 1, y: pass}', 'nested:', '  deep:', '    key: v', 'list:', '  - one', '  - 2'].join('\n'));
  assert.deepEqual(doc, { name: 'loan', count: 3, ratio: 0.5, ok: true, none: null, tags: ['a', 'b c', 1], flow: { x: 1, y: 'pass' }, nested: { deep: { key: 'v' } }, list: ['one', 2] });
});

test('array of objects with sibling keys and nested first key (v1 が壊していた形)', () => {
  const doc = parseYaml(['items:', '  - id: a', '    meta:', '      k: 1', '  - meta:', '      k: 2', '    id: b', '  - list:', '      - x', '      - y', '    id: c'].join('\n'));
  assert.deepEqual(doc.items, [{ id: 'a', meta: { k: 1 } }, { meta: { k: 2 }, id: 'b' }, { list: ['x', 'y'], id: 'c' }]);
});

test('block scalars keep relative indent, drop trailing newline, fold with >', () => {
  const doc = parseYaml(['lit: |', '  line1', '    indented', '', '  line3', '', 'strip: |-', '  a', 'fold: >', '  one', '  two', 'after: 1', 'inArr:', '  - text: |', '      Given x', '      - not a list', '    id: q'].join('\n'));
  assert.equal(doc.lit, 'line1\n  indented\n\nline3');
  assert.equal(doc.strip, 'a');
  assert.equal(doc.fold, 'one two');
  assert.equal(doc.after, 1);
  assert.deepEqual(doc.inArr, [{ text: 'Given x\n- not a list', id: 'q' }]);
});

test('JSON text is parsed as JSON', () => {
  assert.deepEqual(parseYaml('{"a": [1, 2]}'), { a: [1, 2] });
});

test('quoted strings and trailing comments', () => {
  const doc = parseYaml(['a: "x: y" # comment', "b: 'it''s'", 'c: plain # note', '"quoted key": 1'].join('\n'));
  assert.deepEqual(doc, { a: 'x: y', b: "it's", c: 'plain', 'quoted key': 1 });
});

test('stringifyYaml round-trips through parseYaml', () => {
  const value = { stage: 'tier', completed_at: '2026-09-23T00:00:00Z', attempt: 2, ok: true, none: null, tags: ['@uc:loan', 'x'], summary: { pass: 3, fail: 0 }, items: [{ id: 'a', nested: { k: 'v' } }, { id: 'b', list: [1, 2] }], tricky: 'a: b', empty: [], emptyObj: {}, multi: 'l1\nl2' };
  const text = stringifyYaml(value);
  assert.deepEqual(parseYaml(text), value);
});
