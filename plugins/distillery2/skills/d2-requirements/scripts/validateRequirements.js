#!/usr/bin/env node
/**
 * validateRequirements.js (distillery2)
 *
 * USDM requirements.yaml を検証する。v1 と違いイベントソーシング / feedback lineage は扱わない。
 * 構造は共有スキーマ (schema-requirements.json)、意味は下の validateSemantics で確認する。
 *
 * Usage:
 *   node validateRequirements.js <path-to-requirements.yaml> [--json]
 *   node validateRequirements.js docs/requirements/requirements.yaml
 *
 * 終了コード: 0 = PASS / 1 = バリデーションエラー / 2 = 読み込み失敗
 * npm 依存なし。共有ライブラリ (../../../scripts/lib) のみ使用。
 */
'use strict';

const path = require('node:path');
const { runValidatorCli } = require('../../../scripts/lib/schemaValidate');

/** 意味検証: ID 重複、SPEC が属する REQ の一致。 */
function validateSemantics(data) {
  const errors = [];
  const reqIds = new Map();
  const specIds = new Map();
  const requirements = Array.isArray(data && data.requirements) ? data.requirements : [];

  for (let ri = 0; ri < requirements.length; ri++) {
    const req = requirements[ri];
    const reqPath = `$.requirements[${ri}]`;
    const reqId = req && req.id;
    if (typeof reqId === 'string') {
      if (reqIds.has(reqId)) errors.push({ path: `${reqPath}.id`, message: `Requirement id ${reqId} duplicates ${reqIds.get(reqId)}` });
      else reqIds.set(reqId, `${reqPath}.id`);
    }
    const reqNum = typeof reqId === 'string' ? (/^REQ-([0-9]{3})$/.exec(reqId) || [])[1] : undefined;
    const specs = Array.isArray(req && req.specifications) ? req.specifications : [];
    for (let si = 0; si < specs.length; si++) {
      const spec = specs[si];
      const specPath = `${reqPath}.specifications[${si}]`;
      const specId = spec && spec.id;
      if (typeof specId !== 'string') continue;
      if (specIds.has(specId)) errors.push({ path: `${specPath}.id`, message: `Specification id ${specId} duplicates ${specIds.get(specId)}` });
      else specIds.set(specId, `${specPath}.id`);
      const specReqNum = (/^SPEC-([0-9]{3})-[0-9]{2}$/.exec(specId) || [])[1];
      if (reqNum && specReqNum && reqNum !== specReqNum) {
        errors.push({ path: `${specPath}.id`, message: `Specification id ${specId} must belong to ${reqId}` });
      }
    }
  }
  return errors;
}

function summarize(data) {
  const reqs = (data && data.requirements) || [];
  const specCount = reqs.reduce((s, r) => s + ((r.specifications || []).length), 0);
  const modelCount = reqs.reduce((s, r) => s + (r.specifications || []).reduce((s2, sp) => s2 + ((sp.affected_models || []).length), 0), 0);
  return [`Requirements: ${reqs.length}`, `Specifications: ${specCount}`, `Affected Models: ${modelCount}`];
}

if (require.main === module) {
  runValidatorCli({
    argv: process.argv.slice(2),
    schemaPath: path.join(__dirname, 'schema-requirements.json'),
    usage: 'Usage: node validateRequirements.js <path-to-requirements.yaml> [--json]',
    extra: (data) => ({ errors: validateSemantics(data), summary: summarize(data) }),
  });
}

module.exports = { validateSemantics, summarize };
