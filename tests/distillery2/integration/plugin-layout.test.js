'use strict';
// プラグインの配布形の整合: skill name (= ディレクトリ名)、plugin.json の version、marketplace 登録、他プラグインを require しないこと
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const plugin = path.join(root, 'plugins/distillery2');
const EXPECTED_SKILLS = ['d2-common', 'd2-run', 'd2-requirements', 'd2-decide', 'd2-foundation', 'd2-design', 'd2-contract', 'd2-implement', 'd2-verify', 'd2-asbuilt'];

// name は Agent Skills 仕様どおりディレクトリ名と同じ。Claude Code はプラグイン名を自動で前置する (/distillery2:<dir>)
test('every skill exists and is named <dir> (Agent Skills spec)', () => {
  const dirs = fs.readdirSync(path.join(plugin, 'skills')).sort();
  assert.deepEqual(dirs, [...EXPECTED_SKILLS].sort());
  for (const d of dirs) {
    const text = fs.readFileSync(path.join(plugin, 'skills', d, 'SKILL.md'), 'utf8');
    const m = text.match(/^name:\s*(\S+)/m);
    assert.ok(m, `${d}: name missing`);
    assert.equal(m[1], d);
    assert.match(text, /^description:/m, `${d}: description missing`);
  }
});

test('plugin.json has semver version and marketplace lists the plugin', () => {
  const pj = JSON.parse(fs.readFileSync(path.join(plugin, '.claude-plugin/plugin.json'), 'utf8'));
  assert.equal(pj.name, 'distillery2');
  assert.match(pj.version, /^\d+\.\d+\.\d+$/);
  const mp = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin/marketplace.json'), 'utf8'));
  const entry = mp.plugins.find(p => p.name === 'distillery2');
  assert.ok(entry);
  assert.equal(entry.source, './plugins/distillery2');
});

test('plugin scripts never require another plugin', () => {
  const offenders = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) {
        const text = fs.readFileSync(p, 'utf8');
        if (/require\((['"])[^'"]*plugins\/(distillery|distillery-impl|toolbox|ddd|cc)\//.test(text) || /\.\.\/\.\.\/\.\.\/(distillery|distillery-impl)\//.test(text)) offenders.push(path.relative(root, p));
      }
    }
  })(plugin);
  assert.deepEqual(offenders, []);
});
