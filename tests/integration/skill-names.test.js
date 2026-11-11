'use strict';
// 全プラグインのスキル名の検査。コロンを受け付けないエージェントがあるため、
// name は Agent Skills 仕様 (英小文字・数字・ハイフン、ディレクトリ名と一致) に従う。
// Claude Code はプラグイン名を自動で前置する (/toolbox:human-html-review)。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const pluginsDir = path.join(root, 'plugins');
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ALLOWED_KEYS = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);

function skills() {
  const out = [];
  for (const plugin of fs.readdirSync(pluginsDir).sort()) {
    const dir = path.join(pluginsDir, plugin, 'skills');
    if (!fs.existsSync(dir)) continue;
    for (const d of fs.readdirSync(dir).sort()) {
      const file = path.join(dir, d, 'SKILL.md');
      if (fs.existsSync(file)) out.push({ plugin, dir: d, file });
    }
  }
  return out;
}

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : '';
}

test('every skill name equals its directory and follows the Agent Skills spec', () => {
  const list = skills();
  assert.ok(list.length > 0);
  for (const s of list) {
    const fm = frontmatter(fs.readFileSync(s.file, 'utf8'));
    const m = fm.match(/^name:\s*(\S+)\s*$/m);
    assert.ok(m, `${s.plugin}/${s.dir}: name missing`);
    assert.equal(m[1], s.dir, `${s.plugin}/${s.dir}: name must equal directory`);
    assert.match(m[1], NAME_RE, `${s.plugin}/${s.dir}: name must be lowercase letters, digits and single hyphens`);
    assert.ok(m[1].length <= 64, `${s.plugin}/${s.dir}: name too long`);
  }
});

test('skill frontmatter uses only Agent Skills spec keys', () => {
  for (const s of skills()) {
    const keys = frontmatter(fs.readFileSync(s.file, 'utf8')).split('\n')
      .map((l) => l.match(/^([A-Za-z][\w-]*):/)).filter(Boolean).map((m) => m[1]);
    for (const k of keys) assert.ok(ALLOWED_KEYS.has(k), `${s.plugin}/${s.dir}: key "${k}" is not in the Agent Skills spec`);
  }
});

// metadata は文字列から文字列への map (Agent Skills 仕様)。入れ子・配列を書かない
test('skill metadata values are strings', () => {
  for (const s of skills()) {
    const fm = frontmatter(fs.readFileSync(s.file, 'utf8'));
    const m = fm.match(/^metadata:\s*\n((?:[ \t]+.*\n?|\s*\n)*)/m);
    if (!m) continue;
    for (const line of m[1].split('\n')) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      assert.match(line, /^  [A-Za-z0-9_.-]+:\s*[^\s[{|>-]/, `${s.plugin}/${s.dir}: metadata must be a flat map of strings (got "${line.trim()}")`);
    }
  }
});

// toolbox は汎用スキル集なのでプリフィックスを付けない (空文字)
test('skill directories carry a plugin prefix', () => {
  const PREFIX = { cc: 'cc-', ddd: 'ddd-', distillery: 'dist-', 'distillery-impl': 'dist-impl-', distillery2: 'd2-', toolbox: '' };
  for (const s of skills()) {
    assert.ok(s.plugin in PREFIX, `${s.plugin}: add its skill prefix to this test`);
    assert.ok(s.dir.startsWith(PREFIX[s.plugin]), `${s.plugin}/${s.dir}: directory must start with ${PREFIX[s.plugin]}`);
  }
});
