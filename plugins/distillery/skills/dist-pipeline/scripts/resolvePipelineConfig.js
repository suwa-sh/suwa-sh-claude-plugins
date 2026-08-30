#!/usr/bin/env node
'use strict';

// docs/pipeline/pipeline-config.yaml を YAML parser で読み、step_models / skip_steps を解決して JSON で出力する。
// grep による行単位判定(インデント・コメントの誤検出)を避けるための正本。
//
// 使い方: node resolvePipelineConfig.js [docs/pipeline/pipeline-config.yaml]
// 出力(JSON):
//   {
//     "exists": bool,                       // ファイルが存在するか
//     "step_models": {...},                 // 文字列 or null に正規化(不正型は null + warning)
//     "skip_steps_defined": bool,           // skip_steps キーがトップレベルに存在するか(= 判断済み)
//     "skip_steps": ["step5","step6a"],     // 暗黙 skip(step5 → step6a)を含む解決結果
//     "warnings": [...]
//   }
// 終了コード: 0(ファイルが無くても 0。exists で判定する)/ 2 = 入力エラー

const fs = require('node:fs');
const path = require('node:path');

const { parseYaml } = require(path.join(__dirname, '..', '..', 'dist-spec', 'scripts', 'lib', 'yaml-parser.js'));

const STEP_IDS = ['step0h', 'step1', 'step2', 'step3', 'step4a', 'step4b', 'step5', 'step6', 'step6a'];

// 同梱の簡易 YAML parser は行末コメント(`key: value # comment`)を落とさないため、parse 前に除去する。
// 引用符の内側の # は保護する。行頭コメント・空行はそのまま(parser 側が扱う)
function stripInlineComments(text) {
  return text.split('\n').map(line => {
    let quote = null;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quote) { if (ch === quote) quote = null; continue; }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i).replace(/\s+$/, '');
    }
    return line;
  }).join('\n');
}

function parsePipelineConfigText(text) {
  return parseYaml(stripInlineComments(text));
}
const SKIPPABLE = ['step5', 'step6a'];
const IMPLIED_SKIPS = { step5: ['step6a'] };

function resolvePipelineConfig(config) {
  const warnings = [];
  const stepModels = {};
  const rawModels = config?.step_models;
  if (rawModels !== undefined && rawModels !== null && (typeof rawModels !== 'object' || Array.isArray(rawModels))) {
    warnings.push('step_models is not a mapping; treating every step as null');
  }
  for (const step of STEP_IDS) {
    const value = rawModels && typeof rawModels === 'object' && !Array.isArray(rawModels) ? rawModels[step] : undefined;
    if (value === undefined || value === null) stepModels[step] = null;
    else if (typeof value === 'string' && value.trim() !== '') stepModels[step] = value.trim();
    else { stepModels[step] = null; warnings.push(`step_models.${step} is not a string; treated as null`); }
  }

  const defined = Boolean(config) && typeof config === 'object' && !Array.isArray(config) && Object.hasOwn(config, 'skip_steps');
  let raw = defined ? config.skip_steps : [];
  if (raw === null || raw === undefined) raw = [];
  if (!Array.isArray(raw)) { warnings.push('skip_steps is not an array; treated as []'); raw = []; }
  const selected = new Set();
  for (const item of raw) {
    const step = typeof item === 'string' ? item.trim() : '';
    if (!SKIPPABLE.includes(step)) { warnings.push(`skip_steps: unsupported value ignored: ${JSON.stringify(item)}`); continue; }
    selected.add(step);
    for (const implied of IMPLIED_SKIPS[step] || []) selected.add(implied);
  }
  return {
    step_models: stepModels,
    skip_steps_defined: defined,
    skip_steps: SKIPPABLE.filter(step => selected.has(step)),
    warnings,
  };
}

function main() {
  const file = process.argv[2] || path.join('docs', 'pipeline', 'pipeline-config.yaml');
  if (!fs.existsSync(file)) {
    console.log(JSON.stringify({ exists: false, ...resolvePipelineConfig(null) }));
    return;
  }
  let config;
  try {
    config = parsePipelineConfigText(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`resolvePipelineConfig: ${error.message}`);
    process.exit(2);
  }
  console.log(JSON.stringify({ exists: true, ...resolvePipelineConfig(config) }));
}

if (require.main === module) main();

module.exports = { resolvePipelineConfig, parsePipelineConfigText, stripInlineComments, SKIPPABLE, IMPLIED_SKIPS };
