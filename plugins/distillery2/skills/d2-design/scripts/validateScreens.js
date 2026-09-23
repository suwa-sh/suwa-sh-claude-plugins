#!/usr/bin/env node
'use strict';

/**
 * validateScreens.js <screens.yaml> [--app <storybook-app-dir>] [--use-cases <use-cases.yaml>] [--json]
 *
 * docs/design/screens.yaml を検査する:
 *  1. スキーマ (schema-screens.json)
 *  2. name / route が screens 内で一意
 *  3. uc_slugs が use-cases.yaml の use_cases[].slug に実在 (--use-cases 指定時)
 *  4. story パスが app dir 配下に実在 / components が app dir に <name>.tsx として実在 (--app 指定時)
 *  5. variants が Story ファイルの named export (`export const <Name>`) として存在 (--app 指定時)
 *  6. tokens.file が app dir 配下に実在 (--app 指定時。tokens を書いた場合)
 *
 * --app / --use-cases はそれぞれ指定したときだけ該当グループを検査する。
 * 終了コード: 0 = PASS / 1 = 違反あり / 2 = 読み込み失敗。
 */

const fs = require('node:fs');
const path = require('node:path');
const { validateWithSchema } = require('../../../scripts/lib/schemaValidate');
const { parseYaml } = require('../../../scripts/lib/yaml');

const STORY_EXT = ['.tsx', '.ts', '.jsx', '.js'];
const COMPONENT_EXT = ['.tsx', '.ts', '.jsx', '.js'];

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/** app dir 配下の basename(拡張子除く) → true の集合を作る (コンポーネント実在チェック用) */
function componentBasenames(appDir) {
  const set = new Set();
  for (const f of walk(appDir)) {
    const ext = path.extname(f);
    if (COMPONENT_EXT.includes(ext) && !f.includes('.stories.')) {
      set.add(path.basename(f, ext));
    }
  }
  return set;
}

function storyExports(storyAbsPath) {
  const text = fs.readFileSync(storyAbsPath, 'utf8');
  const names = new Set();
  for (const m of text.matchAll(/export\s+const\s+([A-Za-z0-9_]+)/g)) names.add(m[1]);
  return names;
}

function validate({ screensPath, appDir, useCasesPath }) {
  const errors = [];
  const screensDoc = parseYaml(fs.readFileSync(screensPath, 'utf8'));
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema-screens.json'), 'utf8'));
  for (const e of validateWithSchema(screensDoc, schema)) errors.push(`schema ${e.path}: ${e.message}`);

  const screens = Array.isArray(screensDoc && screensDoc.screens) ? screensDoc.screens : [];

  // 2. 一意性
  const seenName = new Map();
  const seenRoute = new Map();
  for (const s of screens) {
    if (!s || typeof s !== 'object') continue;
    if (s.name != null) {
      if (seenName.has(s.name)) errors.push(`name "${s.name}" が重複している`);
      else seenName.set(s.name, true);
    }
    if (s.route != null) {
      if (seenRoute.has(s.route)) errors.push(`route "${s.route}" が重複している`);
      else seenRoute.set(s.route, true);
    }
  }

  // 3. uc_slugs 実在
  if (useCasesPath) {
    const uc = parseYaml(fs.readFileSync(useCasesPath, 'utf8'));
    const slugs = new Set((uc && Array.isArray(uc.use_cases) ? uc.use_cases : []).map(u => u && u.slug).filter(Boolean));
    for (const s of screens) {
      for (const slug of s.uc_slugs || []) {
        if (!slugs.has(slug)) errors.push(`${s.name}: uc_slug "${slug}" は use-cases.yaml に存在しない`);
      }
    }
  }

  // 4/5. app dir に対する実在 + variants export
  if (appDir) {
    if (!fs.existsSync(appDir)) {
      errors.push(`--app のディレクトリが無い: ${appDir}`);
    } else {
      const components = componentBasenames(appDir);
      for (const s of screens) {
        if (s.story) {
          const storyAbs = path.join(appDir, s.story);
          if (!fs.existsSync(storyAbs)) {
            errors.push(`${s.name}: story "${s.story}" が app dir に存在しない`);
          } else {
            const exports = storyExports(storyAbs);
            for (const v of s.variants || []) {
              if (!exports.has(v)) errors.push(`${s.name}: variant "${v}" が ${s.story} の named export に無い`);
            }
          }
        }
        for (const c of s.components || []) {
          if (!components.has(c)) errors.push(`${s.name}: component "${c}" の実装ファイル (${c}.tsx 等) が app dir に無い`);
        }
      }
      // 6. tokens.file 実在 (screens.yaml に tokens を書いた場合)
      const tokenFile = screensDoc && screensDoc.tokens && screensDoc.tokens.file;
      if (tokenFile && !fs.existsSync(path.join(appDir, tokenFile))) {
        errors.push(`tokens.file "${tokenFile}" が app dir に存在しない (${path.join(appDir, tokenFile)})`);
      }
    }
  }

  return { errors, screens: screens.length };
}

module.exports = { validate };

if (require.main === module) {
  try {
    const argv = process.argv.slice(2);
    const positional = argv.filter(a => !a.startsWith('--'));
    const screensPath = positional[0];
    const getFlag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
    if (!screensPath) { console.error('Usage: validateScreens.js <screens.yaml> [--app <dir>] [--use-cases <use-cases.yaml>] [--json]'); process.exit(2); }
    if (!fs.existsSync(screensPath)) { console.error(`File not found: ${screensPath}`); process.exit(2); }
    const { errors, screens } = validate({ screensPath, appDir: getFlag('--app'), useCasesPath: getFlag('--use-cases') });
    if (argv.includes('--json')) console.log(JSON.stringify({ status: errors.length ? 'fail' : 'pass', errors }, null, 2));
    else if (!errors.length) console.log(`PASS: screens (${screens} 画面)`);
    else { console.log(`FAIL: screens (${errors.length} error)`); for (const e of errors) console.log(`  - ${e}`); }
    process.exit(errors.length ? 1 : 0);
  } catch (e) { console.error(`Error: ${e.message}`); process.exit(2); }
}
