'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const validator = require(path.join(root, 'plugins/distillery-impl/skills/dist-impl-implement/scripts/validateAssumptions.js'));

const ID = ['--uc', '6078c4ed', '--tier', 'tier-facade', '--attempt', '1'];
function verdictsArgs(findingsFile, recordFile) {
  return ['verdicts', findingsFile, '--assumptions', recordFile, ...ID];
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'assumption-validator-'));
let n = 0;
function write(text) {
  const file = path.join(tmp, `f${n += 1}.yaml`);
  fs.writeFileSync(file, text);
  return file;
}

const RECORD = `schema_version: "1.0"
uc_id: "6078c4ed"
tier: "tier-facade"
attempt: 1
extraction:
  candidate_count: 4
  excluded_as_explicit: 2
  recorded_count: 2
assumptions:
  - id: A-001
    category: data_format
    assumption: "occurred_at は秒精度 ISO8601 UTC"
    target: "facade/src/id_gateway.sh:28"
    reason: "契約に時刻精度の定義が無い"
    confidence: medium
    spec_refs: ["rdb-schema.yaml#runner_result_events"]
  - id: A-002
    category: error_handling
    assumption: "SSH 失敗時は status を FAILED にする"
    target: "facade/src/launch_gateway.sh:32"
    reason: "失敗時の status が tier md に無いと判断した"
    confidence: low
    spec_refs: ["tier-facade.md#stdout"]
`;

function findings(overrides = {}) {
  const base = {
    verdicts: `  - id: A-001
    tier: "tier-facade"
    assumption: "occurred_at は秒精度 ISO8601 UTC"
    target: "facade/src/id_gateway.sh:28"
    category: data_format
    verified_category: persistence
    verdict: spec_absent
    finding_id: F-010
    evidence: "契約に精度の記載なし"
  - id: A-002
    tier: "tier-facade"
    assumption: "SSH 失敗時は status を FAILED にする"
    target: "facade/src/launch_gateway.sh:32"
    category: error_handling
    verified_category: error_handling
    verdict: contradicts
    finding_id: F-011
    evidence: "tier-facade.md:79 は STARTING 固定"
  - id: V-001
    tier: "tier-facade"
    assumption: "audit hash の canonical 順を fields 順にした"
    target: "facade/src/domain.sh:40"
    category: null
    verified_category: data_format
    verdict: unlisted
    finding_id: F-012
    evidence: "前提ファイルに記載なし"
`,
    findings: `  - id: F-010
    viewpoint: assumption_conformance
    kind: spec_absent
    assumption_id: A-001
    severity: major
    target: "facade/src/id_gateway.sh:28"
    claim: "時刻精度は仕様に無い"
    evidence: "..."
  - id: F-013
    viewpoint: assumption_conformance
    kind: category_mismatch
    assumption_id: A-001
    severity: minor
    target: "facade/src/id_gateway.sh:28"
    claim: "分類は persistence が妥当"
    evidence: "..."
  - id: F-011
    viewpoint: assumption_conformance
    kind: contradicts
    assumption_id: A-002
    severity: blocker
    target: "facade/src/launch_gateway.sh:32"
    claim: "STARTING 固定に違反"
    evidence: "..."
  - id: F-012
    viewpoint: assumption_conformance
    kind: unlisted
    assumption_id: V-001
    severity: minor
    target: "facade/src/domain.sh:40"
    claim: "黙って決めた canonical 順"
    evidence: "..."
`,
    summary: `  consistent: 0
  spec_absent: 1
  contradicts: 1
  unlisted: 1
`,
    sha: null,
  };
  const o = { ...base, ...overrides };
  const sha = o.sha ?? validator.run(['record', write(RECORD), ...ID]).sha256;
  return `schema_version: "1.0"
uc_id: "6078c4ed"
tier: "tier-facade"
attempt: 1
verified_at: "2026-08-30T10:00:00+09:00"
gate_reexec: {format: pass, lint: pass, tdd: pass, bdd_tier: pass}
viewpoints_checked:
  spec_conformance: {status: done}
  readability_maintainability: {status: done}
  security: {status: done}
  performance: {status: done}
  operability: {status: done}
  fault_tolerance: {status: done}
  refactoring: {status: done}
  assumption_conformance: {status: done}
assumptions_sha256: "${sha}"
assumption_verdicts:
${o.verdicts}assumption_verdicts_summary:
${o.summary}findings:
${o.findings}summary: {blocker: 1, major: 1, minor: 2}
`;
}

test('record: valid file passes with counts and deterministic sha256', () => {
  const a = validator.run(['record', write(RECORD), ...ID]);
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.equal(a.count, 2);
  assert.equal(a.by_category.data_format, 1);
  const b = validator.run(['record', write(RECORD), ...ID]);
  assert.equal(a.sha256, b.sha256);
  assert.match(a.sha256, /^[0-9a-f]{64}$/);
});

test('record: zero assumptions must be an explicit empty array', () => {
  const zero = RECORD.replace(/assumptions:[\s\S]*$/, 'assumptions: []\n').replace('recorded_count: 2', 'recorded_count: 0').replace('candidate_count: 4', 'candidate_count: 2');
  const ok = validator.run(['record', write(zero), ...ID]);
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.equal(ok.count, 0);
  const missing = RECORD.replace(/assumptions:[\s\S]*$/, '').replace('recorded_count: 2', 'recorded_count: 0').replace('candidate_count: 4', 'candidate_count: 2');
  const ng = validator.run(['record', write(missing), ...ID]);
  assert.equal(ng.ok, false);
  assert.match(ng.errors.join('\n'), /assumptions must be an array/);
});

test('record: duplicate id, bad enum, count mismatch, identity mismatch are rejected', () => {
  const dup = validator.run(['record', write(RECORD.replace('id: A-002', 'id: A-001')), ...ID]);
  assert.match(dup.errors.join('\n'), /duplicated/);
  const badEnum = validator.run(['record', write(RECORD.replace('category: data_format', 'category: misc')), ...ID]);
  assert.match(badEnum.errors.join('\n'), /category must be one of/);
  const count = validator.run(['record', write(RECORD.replace('recorded_count: 2', 'recorded_count: 3')), ...ID]);
  assert.match(count.errors.join('\n'), /recorded_count/);
  const identity = validator.run(['record', write(RECORD), '--uc', '6078c4ed', '--tier', 'tier-backend-api', '--attempt', '1']);
  assert.match(identity.errors.join('\n'), /tier mismatch/);
  const noRefs = validator.run(['record', write(RECORD.replace('spec_refs: ["tier-facade.md#stdout"]', 'spec_refs: []')), ...ID]);
  assert.match(noRefs.errors.join('\n'), /spec_refs must be a non-empty array/);
});

test('verdicts: valid findings pass and report requires_answer', () => {
  const r = validator.run(verdictsArgs(write(findings()), write(RECORD)));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.counts, { consistent: 0, spec_absent: 1, contradicts: 1, unlisted: 1 });
  assert.equal(r.requires_answer, 1, 'A-001 is persistence per verified_category → answer required');
  assert.match(r.verdicts_sha256, /^[0-9a-f]{64}$/);
});

test('verdicts: stale assumptions hash is rejected', () => {
  const r = validator.run(verdictsArgs(write(findings({ sha: 'deadbeef' })), write(RECORD)));
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /assumptions_sha256 stale/);
});

test('verdicts: every A-id needs exactly one verdict; V-ids must be unique', () => {
  const missing = findings();
  const withoutA2 = missing.replace(/  - id: A-002[\s\S]*?evidence: "tier-facade.md:79 は STARTING 固定"\n/, '');
  const r1 = validator.run(verdictsArgs(write(withoutA2), write(RECORD)));
  assert.match(r1.errors.join('\n'), /A-002 has no verdict/);
  const dupV = findings().replace('  - id: V-001', '  - id: V-001\n    tier: "tier-facade"\n    assumption: "x"\n    target: "y"\n    category: null\n    verified_category: data_format\n    verdict: unlisted\n    finding_id: F-012\n    evidence: "e"\n  - id: V-001');
  const r2 = validator.run(verdictsArgs(write(dupV), write(RECORD)));
  assert.match(r2.errors.join('\n'), /duplicated: V-001/);
});

test('verdicts: contradicts without a blocker finding, severity downgrade, and count padding are rejected', () => {
  const noBlocker = findings().replace('kind: contradicts\n    assumption_id: A-002\n    severity: blocker', 'kind: contradicts\n    assumption_id: A-002\n    severity: major');
  const r1 = validator.run(verdictsArgs(write(noBlocker), write(RECORD)));
  assert.match(r1.errors.join('\n'), /F-011\.severity must be blocker/);
  const downgrade = findings().replace('kind: spec_absent\n    assumption_id: A-001\n    severity: major', 'kind: spec_absent\n    assumption_id: A-001\n    severity: minor');
  const r2 = validator.run(verdictsArgs(write(downgrade), write(RECORD)));
  assert.match(r2.errors.join('\n'), /F-010\.severity must be major/);
  const padded = findings().replace('finding_id: F-011', 'finding_id: F-010');
  const r3 = validator.run(verdictsArgs(write(padded), write(RECORD)));
  assert.match(r3.errors.join('\n'), /shared by two verdicts|kind must be contradicts/);
});

test('verdicts: V-items must carry category null; category mismatch needs a minor finding; summary must match', () => {
  const vCat = findings().replace('category: null\n    verified_category: data_format\n    verdict: unlisted', 'category: data_format\n    verified_category: data_format\n    verdict: unlisted');
  const r1 = validator.run(verdictsArgs(write(vCat), write(RECORD)));
  assert.match(r1.errors.join('\n'), /category must be present and null for V-items/);
  const noMismatch = findings().replace(/  - id: F-013[\s\S]*?evidence: "\.\.\."\n(?=  - id: F-011)/, '');
  const r2 = validator.run(verdictsArgs(write(noMismatch), write(RECORD)));
  assert.match(r2.errors.join('\n'), /requires exactly one category_mismatch finding for A-001 \(got 0\)/);
  const badSummary = findings({ summary: '  consistent: 1\n  spec_absent: 1\n  contradicts: 1\n  unlisted: 0\n' });
  const r3 = validator.run(verdictsArgs(write(badSummary), write(RECORD)));
  assert.match(r3.errors.join('\n'), /assumption_verdicts_summary/);
});

test('hash helpers: order-insensitive canonical hash over declared keys only', () => {
  const items = [{ id: 'A-002', category: 'security', assumption: 'b', target: 't', reason: 'r', confidence: 'high', spec_refs: ['x'], extra: 1 },
    { id: 'A-001', category: 'security', assumption: 'a', target: 't', reason: 'r', confidence: 'high', spec_refs: ['x'] }];
  const h1 = validator.canonicalHash(items, validator.RECORD_HASH_KEYS);
  const h2 = validator.canonicalHash([items[1], { ...items[0], extra: 2 }], validator.RECORD_HASH_KEYS);
  assert.equal(h1, h2);
  assert.equal(validator.expectedSeverity('contradicts', 'data_format', 'data_format'), 'blocker');
  assert.equal(validator.expectedSeverity('spec_absent', 'data_format', 'persistence'), 'major');
  assert.equal(validator.expectedSeverity('spec_absent', 'data_format', 'data_format'), 'minor');
  assert.equal(validator.requiresAnswer('unlisted', null, 'security'), true);
  assert.equal(validator.requiresAnswer('consistent', 'security', 'security'), false);
});

test('record: candidate_count must equal excluded + recorded; identity options are mandatory', () => {
  const loose = validator.run(['record', write(RECORD.replace('candidate_count: 4', 'candidate_count: 99')), ...ID]);
  assert.match(loose.errors.join('\n'), /must equal excluded_as_explicit \+ recorded_count/);
  const noOpts = validator.run(['record', write(RECORD)]);
  assert.equal(noOpts.ok, false);
  assert.match(noOpts.errors.join('\n'), /--uc is required/);
  const dangling = validator.run(['record', write(RECORD), '--uc', '6078c4ed', '--attempt', '1', '--tier']);
  assert.match(dangling.errors.join('\n'), /--tier requires a value/);
  const unknown = validator.run(['record', write(RECORD), ...ID, '--foo', 'bar']);
  assert.match(unknown.errors.join('\n'), /unknown option --foo/);
  const dup = validator.run(['record', write(RECORD), ...ID, '--uc', 'x']);
  assert.match(dup.errors.join('\n'), /duplicate option --uc/);
});

test('verdicts: findings identity, required evidence fields, and orphan findings are checked', () => {
  const wrongTier = findings().replace('tier: "tier-facade"\nattempt: 1\nverified_at', 'tier: "tier-other"\nattempt: 1\nverified_at');
  const r1 = validator.run(verdictsArgs(write(wrongTier), write(RECORD)));
  assert.match(r1.errors.join('\n'), /findings tier \(tier-other\)/);
  const noVerifiedAt = findings().replace('verified_at: "2026-08-30T10:00:00+09:00"\n', '');
  const r2 = validator.run(verdictsArgs(write(noVerifiedAt), write(RECORD)));
  assert.match(r2.errors.join('\n'), /verified_at is required/);
  const noEvidence = findings().replace('    evidence: "契約に精度の記載なし"\n', '');
  const r3 = validator.run(verdictsArgs(write(noEvidence), write(RECORD)));
  assert.match(r3.errors.join('\n'), /assumption_verdicts\[0\]\.evidence is required/);
  const noClaim = findings().replace('    claim: "STARTING 固定に違反"\n', '');
  const r4 = validator.run(verdictsArgs(write(noClaim), write(RECORD)));
  assert.match(r4.errors.join('\n'), /\(F-011\)\.claim is required/);
  const orphan = findings({ findings: findings().split('findings:\n')[1].split('summary:')[0] + '  - id: F-999\n    viewpoint: assumption_conformance\n    kind: contradicts\n    assumption_id: V-999\n    severity: minor\n    target: "x"\n    claim: "y"\n    evidence: "z"\n' });
  const r5 = validator.run(verdictsArgs(write(orphan), write(RECORD)));
  assert.match(r5.errors.join('\n'), /F-999 .* is not referenced by any verdict/);
  const strayMismatch = findings().replace('kind: category_mismatch\n    assumption_id: A-001', 'kind: category_mismatch\n    assumption_id: A-777');
  const r6 = validator.run(verdictsArgs(write(strayMismatch), write(RECORD)));
  assert.match(r6.errors.join('\n'), /category_mismatch must reference an A-id/);
});

test('verdicts: zero assumptions with only a Verifier-found V-item passes; flow-style summary is parsed', () => {
  const zero = `schema_version: "1.0"
uc_id: "6078c4ed"
tier: "tier-facade"
attempt: 1
extraction: {candidate_count: 0, excluded_as_explicit: 0, recorded_count: 0}
assumptions: []
`;
  const sha = validator.run(['record', write(zero), ...ID]).sha256;
  const f = `schema_version: "1.0"
uc_id: "6078c4ed"
tier: "tier-facade"
attempt: 1
verified_at: "2026-08-30T10:00:00+09:00"
gate_reexec: {format: pass, lint: pass, tdd: pass, bdd_tier: pass}
viewpoints_checked:
  spec_conformance: {status: done}
  readability_maintainability: {status: done}
  security: {status: done}
  performance: {status: done}
  operability: {status: done}
  fault_tolerance: {status: done}
  refactoring: {status: done}
  assumption_conformance: {status: done}
assumptions_sha256: "${sha}"
assumption_verdicts:
  - id: V-001
    tier: "tier-facade"
    assumption: "audit hash の canonical 順"
    target: "facade/src/domain.sh:40"
    category: null
    verified_category: security
    verdict: unlisted
    finding_id: F-001
    evidence: "前提ファイルに記載なし"
assumption_verdicts_summary: {consistent: 0, spec_absent: 0, contradicts: 0, unlisted: 1}
findings:
  - id: F-001
    viewpoint: assumption_conformance
    kind: unlisted
    assumption_id: V-001
    severity: major
    target: "facade/src/domain.sh:40"
    claim: "黙って決めた"
    evidence: "..."
summary: {blocker: 0, major: 1, minor: 0}
`;
  const r = validator.run(verdictsArgs(write(f), write(zero)));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.counts, { consistent: 0, spec_absent: 0, contradicts: 0, unlisted: 1 });
  assert.equal(r.requires_answer, 1);
  const empty = f.replace(/assumption_verdicts:[\s\S]*?assumption_verdicts_summary/, 'assumption_verdicts: []\nassumption_verdicts_summary')
    .replace('unlisted: 1}', 'unlisted: 0}').replace(/findings:[\s\S]*?summary: \{blocker/, 'findings: []\nsummary: {blocker').replace('major: 1, minor: 0}', 'major: 0, minor: 0}');
  const r2 = validator.run(verdictsArgs(write(empty), write(zero)));
  assert.equal(r2.ok, true, JSON.stringify(r2));
  assert.equal(r2.requires_answer, 0);
});

test('verdicts: completion evidence is required (gate_reexec, all 8 viewpoints done, explicit findings, matching summary)', () => {
  const noGate = findings().replace(/gate_reexec:[^\n]*\n/, '');
  assert.match(validator.run(verdictsArgs(write(noGate), write(RECORD))).errors.join('\n'), /gate_reexec mapping is required/);
  const notDone = findings().replace('assumption_conformance: {status: done}', 'assumption_conformance: {status: skipped}');
  assert.match(validator.run(verdictsArgs(write(notDone), write(RECORD))).errors.join('\n'), /viewpoints_checked\.assumption_conformance\.status must be done/);
  const noFindings = findings().replace(/findings:\n[\s\S]*?summary: \{blocker: 1, major: 1, minor: 2\}/, 'summary: {blocker: 0, major: 0, minor: 0}');
  const r = validator.run(verdictsArgs(write(noFindings), write(RECORD)));
  assert.match(r.errors.join('\n'), /findings must be an explicit array/);
  const badTop = findings().replace('summary: {blocker: 1, major: 1, minor: 2}', 'summary: {blocker: 0, major: 1, minor: 2}');
  assert.match(validator.run(verdictsArgs(write(badTop), write(RECORD))).errors.join('\n'), /summary\.blocker \(0\) != actual findings count 1/);
});

test('verdicts: category_mismatch is exactly-one minor when categories differ and forbidden when they match', () => {
  const dupMismatch = findings({ findings: findings().split('findings:\n')[1].split('summary:')[0] + '  - id: F-014\n    viewpoint: assumption_conformance\n    kind: category_mismatch\n    assumption_id: A-001\n    severity: minor\n    target: "x"\n    claim: "y"\n    evidence: "z"\n', summary: '  consistent: 0\n  spec_absent: 1\n  contradicts: 1\n  unlisted: 1\n' }).replace('summary: {blocker: 1, major: 1, minor: 2}', 'summary: {blocker: 1, major: 1, minor: 3}');
  assert.match(validator.run(verdictsArgs(write(dupMismatch), write(RECORD))).errors.join('\n'), /requires exactly one category_mismatch finding for A-001 \(got 2\)/);
  const majorMismatch = findings().replace('kind: category_mismatch\n    assumption_id: A-001\n    severity: minor', 'kind: category_mismatch\n    assumption_id: A-001\n    severity: major').replace('summary: {blocker: 1, major: 1, minor: 2}', 'summary: {blocker: 1, major: 2, minor: 1}');
  assert.match(validator.run(verdictsArgs(write(majorMismatch), write(RECORD))).errors.join('\n'), /category_mismatch finding F-013\.severity must be minor/);
  const matchesButFlagged = findings().replace('verified_category: persistence\n    verdict: spec_absent', 'verified_category: data_format\n    verdict: spec_absent').replace('kind: spec_absent\n    assumption_id: A-001\n    severity: major', 'kind: spec_absent\n    assumption_id: A-001\n    severity: minor').replace('summary: {blocker: 1, major: 1, minor: 2}', 'summary: {blocker: 1, major: 0, minor: 3}');
  assert.match(validator.run(verdictsArgs(write(matchesButFlagged), write(RECORD))).errors.join('\n'), /category matches verified_category but 1 category_mismatch finding/);
});

test('evidence: aggregate hash is tier-order-insensitive and rejects malformed input', () => {
  const sha1 = 'a'.repeat(64);
  const sha2 = 'b'.repeat(64);
  const x = validator.run(['evidence', `tier-b:${sha2}:${sha1}`, `tier-a:${sha1}:${sha2}`]);
  const y = validator.run(['evidence', `tier-a:${sha1}:${sha2}`, `tier-b:${sha2}:${sha1}`]);
  assert.equal(x.ok, true);
  assert.equal(x.assumption_evidence_sha256, y.assumption_evidence_sha256);
  assert.equal(x.assumption_evidence_sha256, validator.evidenceHash([{ tier: 'tier-a', assumptions_sha256: sha1, assumption_verdicts_sha256: sha2 }, { tier: 'tier-b', assumptions_sha256: sha2, assumption_verdicts_sha256: sha1 }]));
  assert.match(validator.run(['evidence', 'tier-a:short:short']).errors.join('\n'), /each argument must be/);
  assert.match(validator.run(['evidence', `tier-a:${sha1}:${sha2}`, `tier-a:${sha1}:${sha2}`]).errors.join('\n'), /duplicate tier/);
  assert.match(validator.run(['evidence']).errors.join('\n'), /at least one tier/);
});

test('verdicts: gate_reexec needs the 4 gates with pass|fail; viewpoint enum; V category must be explicit null', () => {
  const emptyGate = findings().replace(/gate_reexec:[^\n]*\n/, 'gate_reexec: {}\n');
  assert.match(validator.run(verdictsArgs(write(emptyGate), write(RECORD))).errors.join('\n'), /gate_reexec\.format must be pass\|fail/);
  const tddFail = findings().replace('tdd: pass', 'tdd: fail');
  assert.equal(validator.run(verdictsArgs(write(tddFail), write(RECORD))).ok, true, 'fail is a legitimate gate result');
  const madeUp = findings().replace('viewpoint: assumption_conformance\n    kind: unlisted', 'viewpoint: made_up\n    kind: unlisted');
  assert.match(validator.run(verdictsArgs(write(madeUp), write(RECORD))).errors.join('\n'), /\(F-012\)\.viewpoint must be one of/);
  const noCategoryKey = findings().replace('    category: null\n    verified_category: data_format\n    verdict: unlisted', '    verified_category: data_format\n    verdict: unlisted');
  assert.match(validator.run(verdictsArgs(write(noCategoryKey), write(RECORD))).errors.join('\n'), /category must be present and null for V-items/);
});
