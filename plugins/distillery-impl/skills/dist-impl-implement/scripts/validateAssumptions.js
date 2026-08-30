#!/usr/bin/env node
'use strict';

/**
 * validateAssumptions.js — AssumptionRecord と Verifier 判定の検証器(distillery-impl)
 *
 *   record   <assumptions.yaml> --uc <uc_id> --tier <tier_id> --attempt <n>
 *   verdicts <S5_verify.findings.yaml> --assumptions <assumptions.yaml> --uc <uc_id> --tier <tier_id> --attempt <n>
 *   evidence <tier_id>:<assumptions_sha256>:<assumption_verdicts_sha256> ...   # S9 の assumption_evidence_sha256 を算出
 *
 * option はすべて必須(identity 照合を省略できない)。未知 option / 値欠落 / 重複 / 余剰引数は拒否する。
 *
 * 正本: skills/dist-impl-implement/references/assumption-record.md
 *       skills/dist-impl-verify/references/verify-viewpoints.md §8
 * 出力: stdout に JSON 1 行。ok=false なら exit 1。
 * 依存: Node 18+ 標準モジュールのみ(YAML は同梱 lib/yaml-parser.js)。
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { parseYaml } = require('./lib/yaml-parser');

const CATEGORIES = ['input_validation', 'data_format', 'error_handling', 'persistence', 'performance', 'security'];
const CONFIDENCES = ['high', 'medium', 'low'];
const VERDICTS = ['consistent', 'spec_absent', 'contradicts', 'unlisted'];
const HIGH_RISK = ['security', 'persistence'];
const RECORD_HASH_KEYS = ['id', 'category', 'assumption', 'target', 'reason', 'confidence', 'spec_refs'];
const VERDICT_HASH_KEYS = ['id', 'tier', 'assumption', 'target', 'category', 'verified_category', 'verdict'];
const VERDICT_KIND = { consistent: 'restatement', spec_absent: 'spec_absent', contradicts: 'contradicts', unlisted: 'unlisted' };
const VIEWPOINTS = ['spec_conformance', 'readability_maintainability', 'security', 'performance', 'operability', 'fault_tolerance', 'refactoring', 'assumption_conformance'];
const SEVERITIES = ['blocker', 'major', 'minor'];

/** S9 の assumption_evidence_sha256: tier_id 昇順に `{assumptions_sha256}:{assumption_verdicts_sha256}` を \n 連結した sha256 */
function evidenceHash(tiers) {
  const rows = [...tiers].sort((a, b) => a.tier.localeCompare(b.tier)).map(t => `${t.assumptions_sha256}:${t.assumption_verdicts_sha256}`).join('\n');
  return crypto.createHash('sha256').update(rows, 'utf8').digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

function canonicalHash(items, keys) {
  const rows = items
    .map(item => Object.fromEntries(keys.map(k => [k, item[k] === undefined ? null : item[k]])))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map(row => `${canonicalJson(row)}\n`)
    .join('');
  return crypto.createHash('sha256').update(rows, 'utf8').digest('hex');
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '';
}

function expectedSeverity(verdict, category, verifiedCategory) {
  if (verdict === 'contradicts') return 'blocker';
  if (verdict === 'consistent') return 'minor';
  const highRisk = HIGH_RISK.includes(category) || HIGH_RISK.includes(verifiedCategory);
  return highRisk ? 'major' : 'minor';
}

function requiresAnswer(verdict, category, verifiedCategory) {
  if (verdict !== 'spec_absent' && verdict !== 'unlisted') return false;
  return HIGH_RISK.includes(category) || HIGH_RISK.includes(verifiedCategory);
}

function loadYaml(file, errors) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    errors.push(`cannot read ${file}: ${e.message}`);
    return null;
  }
  try {
    const doc = parseYaml(text);
    if (!doc || typeof doc !== 'object') {
      errors.push(`${file}: top-level must be a mapping`);
      return null;
    }
    return doc;
  } catch (e) {
    errors.push(`${file}: YAML parse error: ${e.message}`);
    return null;
  }
}

function validateRecord(doc, expect, errors) {
  if (doc.schema_version !== '1.0') errors.push(`schema_version must be "1.0" (got ${JSON.stringify(doc.schema_version)})`);
  for (const key of ['uc_id', 'tier']) {
    if (!isNonEmptyString(doc[key])) errors.push(`${key} is required`);
    else if (expect[key] !== undefined && doc[key] !== expect[key]) errors.push(`${key} mismatch: file=${doc[key]} expected=${expect[key]}`);
  }
  if (!Number.isInteger(doc.attempt) || doc.attempt < 1) errors.push('attempt must be a positive integer');
  else if (expect.attempt !== undefined && doc.attempt !== expect.attempt) errors.push(`attempt mismatch: file=${doc.attempt} expected=${expect.attempt}`);

  const ex = doc.extraction;
  if (!ex || typeof ex !== 'object') errors.push('extraction mapping is required');
  else {
    for (const key of ['candidate_count', 'excluded_as_explicit', 'recorded_count']) {
      if (!Number.isInteger(ex[key]) || ex[key] < 0) errors.push(`extraction.${key} must be a non-negative integer`);
    }
    if (Number.isInteger(ex.candidate_count) && Number.isInteger(ex.excluded_as_explicit) && Number.isInteger(ex.recorded_count)
      && ex.candidate_count !== ex.excluded_as_explicit + ex.recorded_count) {
      errors.push('extraction.candidate_count must equal excluded_as_explicit + recorded_count (every candidate is either recorded or excluded as explicit)');
    }
  }

  if (!Array.isArray(doc.assumptions)) {
    errors.push('assumptions must be an array (use [] for zero assumptions)');
    return null;
  }
  if (ex && Number.isInteger(ex.recorded_count) && ex.recorded_count !== doc.assumptions.length) {
    errors.push(`extraction.recorded_count (${ex.recorded_count}) != assumptions.length (${doc.assumptions.length})`);
  }
  const ids = new Set();
  const byCategory = Object.fromEntries(CATEGORIES.map(c => [c, 0]));
  doc.assumptions.forEach((a, i) => {
    const label = `assumptions[${i}]`;
    if (!a || typeof a !== 'object') { errors.push(`${label} must be a mapping`); return; }
    if (!/^A-\d{3,}$/.test(String(a.id))) errors.push(`${label}.id must match A-nnn (got ${JSON.stringify(a.id)})`);
    else if (ids.has(a.id)) errors.push(`${label}.id duplicated: ${a.id}`);
    else ids.add(a.id);
    if (!CATEGORIES.includes(a.category)) errors.push(`${label}.category must be one of ${CATEGORIES.join('|')} (got ${JSON.stringify(a.category)})`);
    else byCategory[a.category] += 1;
    for (const key of ['assumption', 'target', 'reason']) {
      if (!isNonEmptyString(a[key])) errors.push(`${label}.${key} is required`);
    }
    if (!CONFIDENCES.includes(a.confidence)) errors.push(`${label}.confidence must be one of ${CONFIDENCES.join('|')}`);
    if (!Array.isArray(a.spec_refs) || a.spec_refs.length === 0 || !a.spec_refs.every(isNonEmptyString)) {
      errors.push(`${label}.spec_refs must be a non-empty array of strings (where you looked and found nothing)`);
    }
  });
  return { count: doc.assumptions.length, by_category: byCategory, sha256: canonicalHash(doc.assumptions, RECORD_HASH_KEYS) };
}

function validateVerdicts(findingsDoc, assumptionsDoc, expect, errors) {
  const recordErrors = [];
  const record = validateRecord(assumptionsDoc, expect, recordErrors);
  if (findingsDoc.schema_version !== '1.0') errors.push(`findings schema_version must be "1.0" (got ${JSON.stringify(findingsDoc.schema_version)})`);
  for (const key of ['uc_id', 'tier']) {
    if (findingsDoc[key] !== assumptionsDoc[key]) errors.push(`findings ${key} (${findingsDoc[key]}) != assumptions ${key} (${assumptionsDoc[key]})`);
    if (expect[key] !== undefined && findingsDoc[key] !== expect[key]) errors.push(`findings ${key} mismatch: file=${findingsDoc[key]} expected=${expect[key]}`);
  }
  if (findingsDoc.attempt !== assumptionsDoc.attempt) errors.push(`findings attempt (${findingsDoc.attempt}) != assumptions attempt (${assumptionsDoc.attempt})`);
  if (expect.attempt !== undefined && findingsDoc.attempt !== expect.attempt) errors.push(`findings attempt mismatch: file=${findingsDoc.attempt} expected=${expect.attempt}`);
  if (!isNonEmptyString(findingsDoc.verified_at)) errors.push('findings verified_at is required');
  const gr = findingsDoc.gate_reexec;
  if (!gr || typeof gr !== 'object' || Array.isArray(gr)) errors.push('gate_reexec mapping is required');
  else {
    for (const g of ['format', 'lint', 'tdd', 'bdd_tier']) {
      if (!['pass', 'fail'].includes(gr[g])) errors.push(`gate_reexec.${g} must be pass|fail (got ${JSON.stringify(gr[g])})`);
    }
  }
  const vc = findingsDoc.viewpoints_checked;
  if (!vc || typeof vc !== 'object') errors.push('viewpoints_checked mapping is required');
  else {
    for (const vp of VIEWPOINTS) {
      if (!vc[vp] || typeof vc[vp] !== 'object' || vc[vp].status !== 'done') errors.push(`viewpoints_checked.${vp}.status must be done (all 8 viewpoints must be completed)`);
    }
  }
  if (!Array.isArray(findingsDoc.findings)) errors.push('findings must be an explicit array (use [] for zero findings)');
  if (recordErrors.length) {
    errors.push(...recordErrors.map(e => `assumptions file invalid: ${e}`));
    return null;
  }
  if (findingsDoc.assumptions_sha256 !== record.sha256) {
    errors.push(`assumptions_sha256 stale: findings=${findingsDoc.assumptions_sha256} current=${record.sha256}`);
  }
  if (!Array.isArray(findingsDoc.assumption_verdicts)) {
    errors.push('assumption_verdicts must be an array (use [] when there are no assumptions and no unlisted judgments)');
    return null;
  }
  const findings = Array.isArray(findingsDoc.findings) ? findingsDoc.findings : [];
  const severityCounts = Object.fromEntries(SEVERITIES.map(s => [s, 0]));
  const findingById = new Map();
  findings.forEach((f, i) => {
    if (!f || typeof f !== 'object' || !isNonEmptyString(f.id)) { errors.push(`findings[${i}] must have id`); return; }
    if (findingById.has(f.id)) { errors.push(`findings[${i}].id duplicated: ${f.id}`); return; }
    findingById.set(f.id, f);
    for (const key of ['viewpoint', 'severity', 'target', 'claim', 'evidence']) {
      if (!isNonEmptyString(f[key])) errors.push(`findings[${i}] (${f.id}).${key} is required`);
    }
    if (!SEVERITIES.includes(f.severity)) errors.push(`findings[${i}] (${f.id}).severity must be one of ${SEVERITIES.join('|')}`);
    else severityCounts[f.severity] += 1;
    if (!VIEWPOINTS.includes(f.viewpoint)) errors.push(`findings[${i}] (${f.id}).viewpoint must be one of ${VIEWPOINTS.join('|')}`);
  });
  const top = findingsDoc.summary;
  if (!top || typeof top !== 'object') errors.push('summary mapping is required');
  else {
    for (const s of SEVERITIES) if (top[s] !== severityCounts[s]) errors.push(`summary.${s} (${top[s]}) != actual findings count ${severityCounts[s]}`);
  }

  const recordIds = new Map(assumptionsDoc.assumptions.map(a => [a.id, a]));
  const seen = new Set();
  const counts = Object.fromEntries(VERDICTS.map(v => [v, 0]));
  const usedFindingIds = new Set();
  let requiredAnswers = 0;
  findingsDoc.assumption_verdicts.forEach((v, i) => {
    const label = `assumption_verdicts[${i}]`;
    if (!v || typeof v !== 'object') { errors.push(`${label} must be a mapping`); return; }
    const id = String(v.id);
    if (seen.has(id)) errors.push(`${label}.id duplicated: ${id}`);
    seen.add(id);
    const isA = /^A-\d{3,}$/.test(id);
    const isV = /^V-\d{3,}$/.test(id);
    if (!isA && !isV) errors.push(`${label}.id must match A-nnn or V-nnn (got ${id})`);
    if (!VERDICTS.includes(v.verdict)) errors.push(`${label}.verdict must be one of ${VERDICTS.join('|')}`);
    else counts[v.verdict] += 1;
    if (!isNonEmptyString(v.evidence)) errors.push(`${label}.evidence is required`);
    if (!isNonEmptyString(v.tier)) errors.push(`${label}.tier is required`);
    else if (v.tier !== assumptionsDoc.tier) errors.push(`${label}.tier (${v.tier}) != assumptions.tier (${assumptionsDoc.tier})`);
    if (!CATEGORIES.includes(v.verified_category)) errors.push(`${label}.verified_category must be one of ${CATEGORIES.join('|')}`);
    if (isA) {
      const a = recordIds.get(id);
      if (!a) errors.push(`${label}: ${id} does not exist in the assumptions file`);
      else {
        if (v.verdict === 'unlisted') errors.push(`${label}: A-items cannot be unlisted`);
        if (v.category !== a.category) errors.push(`${label}.category must equal the Implementer category (${a.category})`);
        if (v.assumption !== a.assumption || v.target !== a.target) errors.push(`${label}: assumption/target must be copied verbatim from ${id}`);
      }
    }
    if (isV) {
      if (v.verdict !== 'unlisted' && v.verdict !== 'contradicts') errors.push(`${label}: V-items must be unlisted or contradicts`);
      if (!Object.hasOwn(v, 'category') || v.category !== null) errors.push(`${label}.category must be present and null for V-items`);
      for (const key of ['assumption', 'target']) if (!isNonEmptyString(v[key])) errors.push(`${label}.${key} is required`);
    }
    // finding 1:1
    if (!isNonEmptyString(v.finding_id)) errors.push(`${label}.finding_id is required`);
    else {
      const f = findingById.get(v.finding_id);
      if (!f) errors.push(`${label}.finding_id ${v.finding_id} not found in findings[]`);
      else {
        if (usedFindingIds.has(v.finding_id)) errors.push(`${label}.finding_id ${v.finding_id} is shared by two verdicts`);
        usedFindingIds.add(v.finding_id);
        if (f.viewpoint !== 'assumption_conformance') errors.push(`${label}: finding ${v.finding_id} must have viewpoint assumption_conformance`);
        if (f.kind !== VERDICT_KIND[v.verdict]) errors.push(`${label}: finding ${v.finding_id}.kind must be ${VERDICT_KIND[v.verdict]} (got ${JSON.stringify(f.kind)})`);
        if (f.assumption_id !== id) errors.push(`${label}: finding ${v.finding_id}.assumption_id must be ${id}`);
        const want = expectedSeverity(v.verdict, v.category, v.verified_category);
        if (f.severity !== want) errors.push(`${label}: finding ${v.finding_id}.severity must be ${want} (got ${f.severity})`);
      }
    }
    if (isA && v.category && CATEGORIES.includes(v.verified_category)) {
      const mms = findings.filter(f => f && f.viewpoint === 'assumption_conformance' && f.kind === 'category_mismatch' && f.assumption_id === id);
      if (v.category !== v.verified_category) {
        if (mms.length !== 1) errors.push(`${label}: category (${v.category}) != verified_category (${v.verified_category}) requires exactly one category_mismatch finding for ${id} (got ${mms.length})`);
        else if (mms[0].severity !== 'minor') errors.push(`${label}: category_mismatch finding ${mms[0].id}.severity must be minor`);
      } else if (mms.length) {
        errors.push(`${label}: category matches verified_category but ${mms.length} category_mismatch finding(s) exist for ${id}`);
      }
    }
    if (requiresAnswer(v.verdict, v.category, v.verified_category)) requiredAnswers += 1;
  });
  for (const id of recordIds.keys()) {
    if (!seen.has(id)) errors.push(`assumption ${id} has no verdict (every A-id needs exactly one)`);
  }
  // 逆方向: assumption_conformance の finding は exactly-one の verdict から参照されること(orphan 禁止)
  findings.forEach(f => {
    if (!f || f.viewpoint !== 'assumption_conformance') return;
    if (f.kind === 'category_mismatch') {
      if (!/^A-\d{3,}$/.test(String(f.assumption_id)) || !seen.has(String(f.assumption_id))) {
        errors.push(`finding ${f.id}: category_mismatch must reference an A-id that has a verdict`);
      }
      return; // 件数・severity は verdict 側の検査で exactly-one / minor を担保済み
    }
    if (!usedFindingIds.has(f.id)) errors.push(`finding ${f.id} (kind ${JSON.stringify(f.kind)}) is not referenced by any verdict (orphan assumption_conformance finding)`);
  });
  const summary = findingsDoc.assumption_verdicts_summary;
  if (!summary || typeof summary !== 'object') errors.push('assumption_verdicts_summary mapping is required');
  else {
    for (const v of VERDICTS) {
      if (summary[v] !== counts[v]) errors.push(`assumption_verdicts_summary.${v} (${summary[v]}) != actual ${counts[v]}`);
    }
  }
  return {
    verdicts_sha256: canonicalHash(findingsDoc.assumption_verdicts, VERDICT_HASH_KEYS),
    assumptions_sha256: record.sha256,
    counts,
    requires_answer: requiredAnswers,
  };
}

const REQUIRED_OPTS = { record: ['uc', 'tier', 'attempt'], verdicts: ['assumptions', 'uc', 'tier', 'attempt'], evidence: [] };

function parseArgs(argv) {
  const [cmd, file, ...rest] = argv;
  if (!REQUIRED_OPTS[cmd]) throw new Error(`unknown command ${JSON.stringify(cmd)} (record | verdicts | evidence)`);
  if (cmd === 'evidence') {
    const tiers = [file, ...rest].filter(Boolean).map(spec => {
      const m = String(spec).match(/^([^:]+):([0-9a-f]{64}):([0-9a-f]{64})$/);
      if (!m) throw new Error(`evidence: each argument must be <tier_id>:<assumptions_sha256>:<assumption_verdicts_sha256> (got ${JSON.stringify(spec)})`);
      return { tier: m[1], assumptions_sha256: m[2], assumption_verdicts_sha256: m[3] };
    });
    if (!tiers.length) throw new Error('evidence: at least one tier is required');
    const seenTiers = new Set();
    for (const t of tiers) { if (seenTiers.has(t.tier)) throw new Error(`evidence: duplicate tier ${t.tier}`); seenTiers.add(t.tier); }
    return { cmd, tiers };
  }
  if (!file || file.startsWith('--')) throw new Error(`${cmd}: <file> is required`);
  const allowed = REQUIRED_OPTS[cmd];
  const opts = {};
  for (let i = 0; i < rest.length; i += 2) {
    const name = rest[i];
    if (!name.startsWith('--')) throw new Error(`unexpected argument ${name}`);
    const key = name.slice(2);
    if (!allowed.includes(key)) throw new Error(`unknown option --${key} for ${cmd}`);
    if (key in opts) throw new Error(`duplicate option --${key}`);
    const value = rest[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`option --${key} requires a value`);
    opts[key] = value;
  }
  for (const key of allowed) if (!(key in opts)) throw new Error(`option --${key} is required for ${cmd}`);
  if (!/^\d+$/.test(opts.attempt)) throw new Error('--attempt must be a positive integer');
  return { cmd, file, opts };
}

function run(argv) {
  const errors = [];
  let result = null;
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (e) {
    return { ok: false, errors: [e.message] };
  }
  const { cmd, file, opts } = parsed;
  if (cmd === 'evidence') return { ok: true, assumption_evidence_sha256: evidenceHash(parsed.tiers), tiers: parsed.tiers.length };
  const expect = { uc_id: opts.uc, tier: opts.tier, attempt: Number(opts.attempt) };
  if (cmd === 'record') {
    const doc = loadYaml(path.resolve(file), errors);
    if (doc) result = validateRecord(doc, expect, errors);
  } else {
    const findingsDoc = loadYaml(path.resolve(file), errors);
    const assumptionsDoc = loadYaml(path.resolve(opts.assumptions), errors);
    if (findingsDoc && assumptionsDoc) result = validateVerdicts(findingsDoc, assumptionsDoc, expect, errors);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, ...result };
}

if (require.main === module) {
  const out = run(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(out)}\n`);
  process.exit(out.ok ? 0 : 1);
}

module.exports = { run, validateRecord, validateVerdicts, canonicalHash, evidenceHash, expectedSeverity, requiresAnswer, CATEGORIES, VERDICTS, VIEWPOINTS, RECORD_HASH_KEYS, VERDICT_HASH_KEYS };
