#!/usr/bin/env node
'use strict';

// 正解の候補（絶対の正解ではない）を、現行方式（Claude）の成果物から機械抽出する。
// 出現ベースの正解は粗い（言及 = 適用とは限らない）。report.js でこの限界を明記する。
//
// レビュー指摘4: 単純な部分文字列検索だと「CQRSは不採用」のような却下の言及や
// decisions/*.yaml の alternatives_considered（却下案）まで適用として数えてしまう。
// 出現箇所を adopted（採用の文脈）/ rejected（却下の文脈）に分類し、ラベルは
// applied / not_applied / ambiguous の3値にする。一般語の別名（weakAliases）だけの
// 出現は ambiguous にする（パターン名としての言及と断定できないため）。

const fs = require('node:fs');
const path = require('node:path');
const { parse: parseYaml } = require('yaml');

const REJECT_KEYWORDS = ['不採用', '採用しない', '見送', '過剰', '不要', '却下'];

function readIfExists(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

// arch/latest 配下の候補ファイルを集める。DESIGN.md は decisions/*.md を挙げるが、
// samples/distillery/pipeline の実物は decisions/*.yaml だったため、拡張子を問わず
// decisions/ 配下の全ファイルを対象にする（実装ノート参照）。
function collectArchTexts(docsDir) {
  const archDir = path.join(docsDir, 'arch', 'latest');
  const files = [];
  for (const name of ['arch-design.yaml', 'arch-design.md']) {
    const file = path.join(archDir, name);
    const text = readIfExists(file);
    if (text !== null) files.push({ file: path.relative(docsDir, file), text, isDecisionRecord: false });
  }
  const decisionsDir = path.join(archDir, 'decisions');
  if (fs.existsSync(decisionsDir)) {
    for (const name of fs.readdirSync(decisionsDir).sort()) {
      const file = path.join(decisionsDir, name);
      if (!fs.statSync(file).isFile()) continue;
      files.push({ file: path.relative(docsDir, file), text: fs.readFileSync(file, 'utf8'), isDecisionRecord: true });
    }
  }
  return files;
}

// decision record（decisions/*）の alternatives_considered: 以降を却下案ゾーンとみなす。
// トップレベルキー（行頭に空白なし）として現れる行を探す。schema上、alternatives_considered は
// decision record の最後のキーであるため、見つかった行から末尾までを却下ゾーンとする。
function findRejectedZoneStart(text, isDecisionRecord) {
  if (!isDecisionRecord) return null;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === 'alternatives_considered:') return i;
  }
  return null;
}

function classifyLine(line, lineIndex, rejectedZoneStart) {
  if (rejectedZoneStart !== null && lineIndex >= rejectedZoneStart) return 'rejected';
  if (REJECT_KEYWORDS.some((kw) => line.includes(kw))) return 'rejected';
  return 'adopted';
}

// レビュー指摘7: 一般語の別名（weakAliases）でも、構造化された「採用の文脈」なら
// adopted の出現として扱う。(a) YAML の `name:` キーの値の中（例: `name: "Retry + ..."`）、
// (b) Markdown の表の行の先頭2セル（ID列・名前列を想定）の中。
function isNameKeyLine(line) {
  return /^\s*name:\s*"/.test(line);
}

function isLeadingTableCell(line, alias) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return false;
  if (/^\|[\s:-]+\|/.test(trimmed)) return false; // 見出し区切り行 (|---|---|) は除外
  const cells = trimmed.split('|').slice(1, -1);
  return cells.slice(0, 2).some((cell) => cell.includes(alias));
}

function isStructuredAdoptedContext(line, alias) {
  return isNameKeyLine(line) || isLeadingTableCell(line, alias);
}

// aliases（強い別名）/ weakAliases（一般語の別名）の出現を集める。
// 戻り値: { label: 'applied'|'not_applied'|'ambiguous', occurrences: [{file, line, alias, classification}] }
function patternLabels(docsDir, patterns) {
  const files = collectArchTexts(docsDir);
  const result = {};

  for (const pattern of patterns) {
    const strongAdopted = [];
    const strongRejected = [];
    const weak = [];

    for (const { file, text, isDecisionRecord } of files) {
      const rejectedZoneStart = findRejectedZoneStart(text, isDecisionRecord);
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let matchedStrong = null;
        for (const alias of pattern.aliases || []) {
          if (line.includes(alias)) {
            matchedStrong = alias;
            break;
          }
        }
        if (matchedStrong) {
          const classification = classifyLine(line, i, rejectedZoneStart);
          const occ = { file, line: i + 1, alias: matchedStrong, classification };
          if (classification === 'rejected') {
            if (strongRejected.length < 3) strongRejected.push(occ);
          } else if (strongAdopted.length < 3) {
            strongAdopted.push(occ);
          }
          continue; // 強い別名が見つかった行は弱い別名の重複カウントをしない
        }
        let matchedWeak = null;
        for (const alias of pattern.weakAliases || []) {
          if (line.includes(alias)) {
            matchedWeak = alias;
            break;
          }
        }
        if (!matchedWeak) continue;
        if (isStructuredAdoptedContext(line, matchedWeak)) {
          // 構造化された箇所での出現は強い別名と同列に扱う（却下ゾーン/キーワードなら rejected）
          const classification = classifyLine(line, i, rejectedZoneStart);
          const occ = { file, line: i + 1, alias: matchedWeak, classification, structuredWeak: true };
          if (classification === 'rejected') {
            if (strongRejected.length < 3) strongRejected.push(occ);
          } else if (strongAdopted.length < 3) {
            strongAdopted.push(occ);
          }
        } else if (weak.length < 3) {
          weak.push({ file, line: i + 1, alias: matchedWeak, classification: 'weak' });
        }
      }
    }

    let label;
    if (strongAdopted.length > 0 && strongRejected.length === 0) {
      label = 'applied';
    } else if (strongAdopted.length > 0 && strongRejected.length > 0) {
      label = 'ambiguous';
    } else if (strongRejected.length > 0) {
      label = 'not_applied';
    } else if (weak.length > 0) {
      label = 'ambiguous';
    } else {
      label = 'not_applied';
    }

    result[pattern.id] = {
      label,
      occurrences: [...strongAdopted, ...strongRejected, ...weak],
    };
  }
  return result;
}

// requirements.yaml の 仕様ID -> affected_models[].type の集合
function modelTypeLabels(docsDir) {
  const file = path.join(docsDir, 'usdm', 'latest', 'requirements.yaml');
  if (!fs.existsSync(file)) return {};
  const doc = parseYaml(fs.readFileSync(file, 'utf8'));
  const result = {};
  for (const req of doc.requirements || []) {
    for (const spec of req.specifications || []) {
      const types = new Set();
      for (const model of spec.affected_models || []) {
        if (model && model.type) types.add(model.type);
      }
      result[spec.id] = types;
    }
  }
  return result;
}

module.exports = {
  patternLabels,
  modelTypeLabels,
  collectArchTexts,
  findRejectedZoneStart,
  classifyLine,
  isNameKeyLine,
  isLeadingTableCell,
  isStructuredAdoptedContext,
  REJECT_KEYWORDS,
};
