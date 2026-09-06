'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const selectors = process.argv.slice(2);
// Explicit discovery works on Node 20 and does not execute archived fixture code.
function discover(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === 'fixtures') return [];
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? discover(file) : entry.name.endsWith('.test.js') ? [file] : [];
  });
}
const all = discover(__dirname).sort();
const selected = new Set();
for (const selector of selectors.length ? selectors : ['']) {
  if (selector && !/^[a-z0-9-]+(?:\/[a-z0-9-]+)?$/.test(selector)) {
    console.error(`Invalid test selector: ${selector}`); process.exit(1);
  }
  const prefix = path.join(__dirname, selector) + path.sep;
  const matches = all.filter(file => file.startsWith(prefix));
  if (!matches.length) { console.error(`No tests for: ${selector}`); process.exit(1); }
  for (const file of matches) selected.add(file);
}
const files = [...selected].sort();
console.log(`Running ${files.length} test files (${selectors.join(', ') || 'all plugins and integration'})`);
const result = spawnSync(process.execPath, ['--test', ...files], { cwd: root, stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
