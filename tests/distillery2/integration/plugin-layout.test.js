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

// ---- 0.1.29: 共通化 (② 2-1〜2-3)。スキルだけを別の場所に置いても動くこと ----
const os = require('node:os');
const { spawnSync } = require('node:child_process');

function walkJs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walkJs(p, out); }
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

test('0.1.29: 共通のスクリプトは skills/d2-common/scripts にあり、プラグイン直下に scripts/ が無い。スキルのスクリプトは scripts/lib へ上る require を持たない', () => {
  assert.ok(!fs.existsSync(path.join(plugin, 'scripts')), 'プラグイン直下の scripts/ は無い');
  for (const f of ['feedbackBatch.js', 'genDocsReadme.js', 'prTrailers.js', 'runGates.js', 'tokenReport.js', 'lib/basis.js', 'lib/runState.js', 'lib/yaml.js', 'lib/resolveDep.js']) {
    assert.ok(fs.existsSync(path.join(plugin, 'skills/d2-common/scripts', f)), f);
  }
  const bad = walkJs(path.join(plugin, 'skills')).filter(p => /require\(['"](\.\.\/)+scripts\//.test(fs.readFileSync(p, 'utf8'))).map(p => path.relative(plugin, p));
  assert.deepEqual(bad, [], 'skills の外の scripts/ を指す require');
  assert.ok(!fs.existsSync(path.join(plugin, 'skills/d2-common/scripts/carryOver.js')), 'carryOver.js (UC への持ち越し) は 0.1.32 で削除した');
});

test('0.1.29: 手順書に CLAUDE_PLUGIN_ROOT は d2-common の「パスの書き方」の 1 か所だけ。<skills>/<skill> の skill 名は実在する', () => {
  const skills = fs.readdirSync(path.join(plugin, 'skills'));
  const hits = [];
  const unknown = new Set();
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(md|yaml)$/.test(e.name)) {
        const text = fs.readFileSync(p, 'utf8');
        const n = (text.match(/CLAUDE_PLUGIN_ROOT/g) || []).length;
        if (n) hits.push(`${path.relative(plugin, p)}:${n}`);
        for (const m of text.matchAll(/<skills>\/([a-z0-9-]+)\//g)) if (!skills.includes(m[1])) unknown.add(`${path.relative(plugin, p)}: ${m[1]}`);
        // `<skills>/<実装者のスキル>/...` のような置き換え変数は skill 名の検査の対象外 (正規表現が [a-z0-9-] なので元々当たらない)
        // 置き換え変数や glob を含まない具体のパスは、skills の下に実在する (派遣文の固定指示など。差分レビュー 2 ラウンド目)
        for (const m of text.matchAll(/<skills>\/([A-Za-z0-9_./-]+)/g)) {
          const rel = m[1].replace(/[.,:)]+$/, '');
          if (/[<>*{}]|\.\.\./.test(rel) || rel.endsWith('/')) continue;
          if (!fs.existsSync(path.join(plugin, 'skills', rel))) unknown.add(`${path.relative(plugin, p)}: <skills>/${rel} が無い`);
        }
      }
    }
  })(path.join(plugin, 'skills'));
  (function walk(dir) { for (const e of fs.readdirSync(dir)) { const t = fs.readFileSync(path.join(dir, e), 'utf8'); if (t.includes('CLAUDE_PLUGIN_ROOT')) hits.push(`agents/${e}`); } })(path.join(plugin, 'agents'));
  assert.deepEqual(hits, ['skills/d2-common/SKILL.md:1']);
  assert.deepEqual([...unknown], []);
});

/** skills/* を使い捨てディレクトリに平置きし、プラグインのルート無しで同じ検査を当てる */
function flatCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-flat-'));
  for (const d of fs.readdirSync(path.join(plugin, 'skills'))) fs.cpSync(path.join(plugin, 'skills', d), path.join(dir, d), { recursive: true });
  return dir;
}

function checkLayout(skillsDir, label) {
  // (a) 全スキルのスクリプトを読み込める (外部モジュールが要るものは resolveDep の失敗だけ許す。ESM・CLI 実行時の副作用は require せず構文だけ確かめる)
  const problems = [];
  for (const p of walkJs(skillsDir)) {
    const r = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' });
    if (r.status !== 0) problems.push(`${label}: ${path.relative(skillsDir, p)}: ${r.stderr.split('\n')[0]}`);
    // 実際に読み込む (子プロセス。CLI の main は require.main の判定で走らない)。相対 require の解決失敗・構文・参照エラーだけを失敗とし、
    // 外部モジュール (redocly など対象リポの依存) が無い失敗は許す
    const load = spawnSync(process.execPath, ['-e', "try { require(process.argv[1]); } catch (e) { const m = String(e && e.stack || e); if (/Cannot find module '(\\.|\\/)/.test(m) || /SyntaxError|ReferenceError|TypeError/.test(m)) { console.error('LAYOUT-LOAD-FAIL: ' + m.split('\\n')[0]); process.exit(1); } }", p], { encoding: 'utf8', cwd: os.tmpdir(), timeout: 20000 });
    if (load.status === 1 && /LAYOUT-LOAD-FAIL/.test(load.stderr)) problems.push(`${label}: ${path.relative(skillsDir, p)}: ${load.stderr.trim().split('\n')[0]}`);
    const text = fs.readFileSync(p, 'utf8');
    for (const m of text.matchAll(/require\((['"])(\.[^'"]+)\1\)/g)) {
      const target = path.resolve(path.dirname(p), m[2]);
      if (!['.js', '.json', '.cjs'].some(ext => fs.existsSync(target + ext)) && !fs.existsSync(target) && !fs.existsSync(path.join(target, 'index.js'))) problems.push(`${label}: ${path.relative(skillsDir, p)} → ${m[2]} が無い`);
    }
  }
  assert.deepEqual(problems, []);
  // (b) 還流の既定コマンドが指すスクリプトが実在する
  const fbPath = path.join(skillsDir, 'd2-common/scripts/feedbackBatch.js');
  const { defaultRegenCmds } = require(fbPath);
  const cmds = defaultRegenCmds();
  const scripts = [...cmds.validate, ...cmds['adr-index'], ...cmds.derived].map(c => c[1]);
  assert.ok(scripts.length >= 9, label);
  assert.deepEqual(scripts.filter(s => !fs.existsSync(s)), [], `${label}: 既定コマンドのスクリプト`);
  const realSkills = fs.realpathSync(skillsDir);
  for (const s of scripts) assert.ok(fs.realpathSync(s).startsWith(realSkills + path.sep), `${label}: ${s} は skills の中`);
  // (c) 依存の解決: 対象リポの node_modules から見つけ、無ければ null
  const { resolveDep } = require(path.join(skillsDir, 'd2-common/scripts/lib/resolveDep.js'));
  const target = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'd2-target-')));
  fs.mkdirSync(path.join(target, 'node_modules/d2-probe-dep'), { recursive: true });
  fs.writeFileSync(path.join(target, 'node_modules/d2-probe-dep/index.js'), 'module.exports = 1;\n');
  assert.equal(resolveDep('d2-probe-dep', { cwd: target }), path.join(target, 'node_modules/d2-probe-dep/index.js'), label);
  assert.equal(resolveDep('d2-probe-dep-missing', { cwd: target }), null, label);
}

test('0.1.29: プラグイン配置で、全スクリプトの構文と相対 require・還流の既定コマンド・依存の解決が通る', () => {
  checkLayout(path.join(plugin, 'skills'), 'plugin');
});

test('0.1.29: skills/* を平置きした配置 (プラグインのルート無し) でも同じ検査が通る', () => {
  checkLayout(flatCopy(), 'flat');
});

test('0.1.31 2-5: 参照の向き: d2-run と d2-common 以外のスキルは、他スキルの手順書 (SKILL.md・references/・templates/) を参照しない (scripts/ はよい。裸の d2-<他>/references/ も検出)', () => {
  const skills = fs.readdirSync(path.join(plugin, 'skills')).filter(d => fs.statSync(path.join(plugin, 'skills', d)).isDirectory());
  const offenders = [];
  for (const skill of skills) {
    if (skill === 'd2-run' || skill === 'd2-common') continue;
    const files = [];
    (function walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.md')) files.push(p); } })(path.join(plugin, 'skills', skill));
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      // 相対パス (../d2-x/、../../d2-x/)、<skills>/d2-x/、接頭辞の無い裸の d2-x/ のうち、SKILL.md・references/・templates/ を指すもの
      for (const m of text.matchAll(/(?:\.\.\/)+(d2-[a-z]+)\/(SKILL\.md|references\/|templates\/)|<skills>\/(d2-[a-z]+)\/(SKILL\.md|references\/|templates\/)|(?<![A-Za-z0-9_./-])(d2-[a-z]+)\/(SKILL\.md|references\/|templates\/)/g)) {
        const other = m[1] || m[3] || m[5];
        if (other === skill || other === 'd2-common') continue;
        offenders.push(`${path.relative(plugin, f)}: ${m[0]}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});
