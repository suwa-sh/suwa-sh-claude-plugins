'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const { canonicalJsonText, readCanonicalJson, writeCanonicalJson } = require('../scripts/canonicalJson');

const {
  detectFeedbackCandidate,
  parseFeedbackRequest,
  readFeedbackInput,
  sha256Bytes,
} = require('../scripts/feedbackRequest');
const {
  applyResolutions,
  buildPlan,
  buildRouting,
  createRoutingBasis,
  initializeRun,
  latestDomainEventIdsFromSnapshots,
  loadCatalog,
  loadPolicy,
  ownershipEvidence,
  renderStagePacket,
  semanticContractSha256,
  semanticDescriptorSet,
  snapshotDomainEventRoots,
  writeImmutable,
} = require('../scripts/planFeedbackRequest');
const {
  acquireLease,
  acquireNormalLease,
  readLease,
  releaseLease,
  touchLease,
} = require('../scripts/feedbackLease');
const {
  deriveRequestDisposition,
  requestReasonForDisposition,
  validateResult,
  validateRunDirectory,
} = require('../scripts/verifyFeedbackResult');

const fixturePath = path.join(__dirname, 'fixtures', 'valid-feedback-request.md');

function fixtureBuffer() {
  return fs.readFileSync(fixturePath);
}

function document() {
  return parseFeedbackRequest(fixtureBuffer());
}

function unit(directStage, constraintKey = directStage) {
  return {
    direct_stage: directStage,
    constraint_key: constraintKey,
    reason: `The requested source of truth belongs to ${directStage}`,
    evidence: [{ kind: 'semantic_target', value: directStage }],
  };
}

function resolvedProposal(input = document()) {
  return {
    schema_version: 'distillery.feedback-routing-proposal/v1',
    input_sha256: input.input_sha256,
    requests: [
      {
        request_id: input.requests[0].request_id,
        decision_state: 'resolved',
        reason: 'The requested change alters a business requirement.',
        evidence: [{ kind: 'requested_change', value: '業務条件を定義' }],
        confidence: 'high',
        work_units: [unit('requirements', 'business-cancellation')],
      },
      {
        request_id: input.requests[1].request_id,
        decision_state: 'resolved',
        reason: 'The requested change corrects the API specification.',
        evidence: [{ kind: 'requested_change', value: 'API enumを補完' }],
        confidence: 'high',
        work_units: [unit('spec', 'api-enum')],
      },
    ],
  };
}

function routingOptions(overrides = {}) {
  const catalogBundle = loadCatalog();
  const policyBundle = loadPolicy();
  return {
    catalogBundle,
    policyBundle,
    repositoryHead: 'non-git:test',
    latestDomainEventIds: Object.fromEntries(catalogBundle.value.stages.map((stage, stageIndex) => [
      stage.id,
      Object.fromEntries(stage.domain_event_roots.map((root, rootIndex) => [
        root,
        `evt-domain-${stageIndex + 1}-${rootIndex + 1}`,
      ])),
    ])),
    ...overrides,
  };
}

function emptyLatestDomainEvents() {
  const catalog = loadCatalog().value;
  return Object.fromEntries(catalog.stages.map(stage => [
    stage.id,
    Object.fromEntries(stage.domain_event_roots.map(root => [root, null])),
  ]));
}

function writeEmptyLatestDomainEvents(directory, name = 'empty-latest-domain-events.json') {
  const target = path.join(directory, name);
  fs.writeFileSync(target, `${JSON.stringify(emptyLatestDomainEvents(), null, 2)}\n`);
  return target;
}

test('canonical JSON producer and reader share one exact byte contract', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-canonical-json-'));
  const target = path.join(root, 'evidence.json');
  const value = { schema_version: 'example/v1', nested: { accepted: true }, values: ['a', 'b'] };
  writeCanonicalJson(target, value, { flag: 'wx' });
  assert.equal(fs.readFileSync(target, 'utf8'), canonicalJsonText(value));
  assert.deepEqual(readCanonicalJson(target), value);
  fs.writeFileSync(target, '{"schema_version":"example/v1"}\n');
  assert.throws(() => readCanonicalJson(target), /canonical two-space JSON/);
});

test('immutable write revalidates an EEXIST race before reading the destination', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-immutable-race-'));
  const target = path.join(root, 'evidence.json');
  const outside = path.join(os.tmpdir(), `feedback-immutable-outside-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(outside, 'same bytes\n');
  const originalLinkSync = fs.linkSync;
  fs.linkSync = (source, destination) => {
    fs.symlinkSync(outside, destination);
    const error = new Error('simulated destination race');
    error.code = 'EEXIST';
    throw error;
  };
  try {
    assert.throws(() => writeImmutable(target, 'same bytes\n', root), /symlink|regular file/);
    assert.equal(fs.readFileSync(outside, 'utf8'), 'same bytes\n');
  } finally {
    fs.linkSync = originalLinkSync;
    if (fs.existsSync(target) || fs.lstatSync(target).isSymbolicLink()) fs.unlinkSync(target);
    fs.unlinkSync(outside);
  }
});

test('strict parser binds exact byte spans while fenced fake headings remain data', () => {
  const buffer = fixtureBuffer();
  const parsed = parseFeedbackRequest(buffer);
  assert.equal(parsed.metadata.feedback_id, '20260730_120000_impl_feedback_19ec0182');
  assert.equal(parsed.requests.length, 2);
  assert.deepEqual(parsed.requests[0].related_ids, ['REQ-002', 'SPEC-002-01']);
  assert.match(parsed.requests[0].sections['観測した事実'].body, /CR-FAKE/);
  for (const request of parsed.requests) {
    assert.equal(sha256Bytes(buffer.subarray(...request.byte_span)), request.slice_sha256);
  }
});

test('strict parser rejects non-canonical bytes and structural/schema ambiguity', () => {
  const valid = fixtureBuffer();
  assert.equal(parseFeedbackRequest(Buffer.from(valid.toString('utf8').replace(
    'uc_id: 19ec0182', 'uc_id: 19ec0182abcd',
  ))).metadata.uc_id, '19ec0182abcd');
  assert.throws(() => parseFeedbackRequest(Buffer.from(valid.toString('utf8').replace(
    'uc_id: 19ec0182', 'uc_id: 19ec0182ab',
  ))), /exactly 8 or collision-extended 12/);
  assert.throws(() => parseFeedbackRequest(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), valid])), /BOM/);
  assert.throws(() => parseFeedbackRequest(Buffer.from(valid.toString('utf8').replaceAll('\n', '\r\n'))), /LF newlines/);
  assert.throws(() => parseFeedbackRequest(Buffer.from(valid.toString('utf8').replace('が', 'が'.normalize('NFD')))), /Unicode NFC/);
  assert.throws(() => parseFeedbackRequest(Buffer.from(valid.toString('utf8').replace('source: distillery-impl', 'unknown: x\nsource: distillery-impl'))), /unknown front matter key/);
  assert.throws(() => parseFeedbackRequest(Buffer.from(valid.toString('utf8').replace('- severity: blocker', '- severity: blocker\n- severity: spec-gap'))), /duplicate request metadata/);
  assert.throws(() => parseFeedbackRequest(Buffer.from(valid.toString('utf8').replace('### 現在の仕様と問題', '### 未知'))), /unknown H3/);
  assert.throws(() => parseFeedbackRequest(Buffer.from(valid.toString('utf8').replace('[REQ-002, SPEC-002-01]', '[]'))), /must not be empty/);
  assert.throws(() => parseFeedbackRequest(Buffer.from(valid.toString('utf8').replace('docs/usdm/latest/requirements.yaml', '../secret'))), /portable workspace-relative/);
  assert.throws(() => parseFeedbackRequest(Buffer.from(valid.toString('utf8').replace(
    '- severity: blocker',
    '- severity: blocker\ntarget stage is requirements',
  ))), /only blank lines and allowed metadata bullets/);
  assert.throws(() => parseFeedbackRequest(Buffer.from(valid.toString('utf8').replace(
    '- severity: blocker',
    '- severity: blocker\n- target_stage: requirements',
  ))), /unknown request metadata key/);
  assert.throws(() => parseFeedbackRequest(Buffer.from(valid.toString('utf8').replace(
    '- severity: blocker',
    '- severity: blocker\n```text\ntarget_stage: requirements\n```',
  ))), /only blank lines and allowed metadata bullets/);
  assert.throws(() => parseFeedbackRequest(Buffer.from(`${valid.toString('utf8')}\n\`\`\`text\nnot closed\n`)), /unclosed fenced code block/);
});

test('catalog and routing-policy overrides cannot weaken fixed safety invariants', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-routing-config-'));
  const referenceDir = path.join(__dirname, '..', 'references');
  const originalCatalog = JSON.parse(fs.readFileSync(path.join(referenceDir, 'feedback-stage-ownership.json'), 'utf8'));
  const originalPolicy = JSON.parse(fs.readFileSync(path.join(referenceDir, 'feedback-routing-policy.json'), 'utf8'));
  const writeFixture = (name, value) => {
    const target = path.join(root, name);
    fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
    return target;
  };
  const clone = value => JSON.parse(JSON.stringify(value));

  const missingOutside = clone(originalCatalog);
  delete missingOutside.outside_stage;
  assert.throws(() => loadCatalog(writeFixture('catalog-missing-outside.json', missingOutside)), /outside_stage/);

  const collidingOutside = clone(originalCatalog);
  collidingOutside.outside_stage = collidingOutside.stages[0].id;
  assert.throws(() => loadCatalog(writeFixture('catalog-colliding-outside.json', collidingOutside)), /outside_stage/);

  const unsafeOutside = clone(originalCatalog);
  unsafeOutside.outside_stage = '../outside';
  assert.throws(() => loadCatalog(writeFixture('catalog-unsafe-outside.json', unsafeOutside)), /outside_stage/);

  const duplicateStep = clone(originalCatalog);
  duplicateStep.stages[1].steps = [...duplicateStep.stages[0].steps];
  assert.throws(() => loadCatalog(writeFixture('catalog-duplicate-step.json', duplicateStep)), /duplicate catalog step/);

  for (const [name, roots] of [
    ['missing-domain-roots', undefined],
    ['escaping-domain-root', ['../events']],
    ['controller-domain-root', ['pipeline/events']],
    ['broad-domain-root', ['events']],
  ]) {
    const invalidRoots = clone(originalCatalog);
    if (roots === undefined) delete invalidRoots.stages[0].domain_event_roots;
    else invalidRoots.stages[0].domain_event_roots = roots;
    assert.throws(() => loadCatalog(writeFixture(`catalog-${name}.json`, invalidRoots)), /domain_event_roots/);
  }

  const missingRequirementsUsdmOwner = clone(originalCatalog);
  missingRequirementsUsdmOwner.stages[0].domain_event_roots = ['rdra/events'];
  assert.throws(
    () => loadCatalog(writeFixture('catalog-missing-requirements-usdm-owner.json', missingRequirementsUsdmOwner)),
    /usdm\/events must be owned exclusively by the requirements stage/,
  );

  const competingUsdmOwner = clone(originalCatalog);
  competingUsdmOwner.stages[1].domain_event_roots.push('usdm/events');
  assert.throws(
    () => loadCatalog(writeFixture('catalog-competing-usdm-owner.json', competingUsdmOwner)),
    /usdm\/events must be owned exclusively by the requirements stage/,
  );

  const externalAlternativeAllowed = clone(originalPolicy);
  externalAlternativeAllowed.auto_accept.requires_pipeline_internal_options = false;
  assert.throws(() => loadPolicy(writeFixture('policy-external-option.json', externalAlternativeAllowed)), /invalid feedback routing policy/);

  const expandedAutoKind = clone(originalPolicy);
  expandedAutoKind.auto_accept.ambiguity_kinds.push('requirement_interpretation');
  assert.throws(() => loadPolicy(writeFixture('policy-expanded-kind.json', expandedAutoKind)), /invalid feedback routing policy/);

  const unsafeConfidence = clone(originalPolicy);
  unsafeConfidence.confidence_values.push('uncalibrated');
  assert.throws(() => loadPolicy(writeFixture('policy-confidence.json', unsafeConfidence)), /invalid feedback routing policy/);

  const missingStop = clone(originalPolicy);
  missingStop.always_stop_flags.pop();
  assert.throws(() => loadPolicy(writeFixture('policy-stop.json', missingStop)), /invalid feedback routing policy/);

  assert.doesNotThrow(() => loadCatalog(writeFixture('catalog-valid.json', originalCatalog)));
  assert.doesNotThrow(() => loadPolicy(writeFixture('policy-valid.json', originalPolicy)));
});

test('candidate detection is fail-closed and readFeedbackInput performs one external read', () => {
  const malformed = Buffer.from('---\nfeedback_id: unsafe/../id\n---\nnormal text\n');
  assert.equal(detectFeedbackCandidate(malformed, 'notes.md'), true);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-read-once-'));
  const target = path.join(root, 'feedback-requests', 'input.md');
  fs.mkdirSync(path.dirname(target));
  fs.writeFileSync(target, malformed);
  const original = fs.readFileSync;
  let reads = 0;
  fs.readFileSync = function counted(file, ...args) {
    if (path.resolve(String(file)) === path.resolve(target)) reads += 1;
    return original.call(this, file, ...args);
  };
  try {
    assert.throws(() => readFeedbackInput(target), /front matter/);
    assert.equal(reads, 1);
  } finally {
    fs.readFileSync = original;
  }
  assert.throws(() => readFeedbackInput(path.join(root, 'normal.md'), { recommendedAuto: true }), /ENOENT/);
});

test('ownership evidence is catalog-owned and plan records per-work-unit closure causality', () => {
  const input = document();
  const options = routingOptions();
  const evidence = ownershipEvidence(input.requests[0], options.catalogBundle.value);
  assert.ok(evidence.some(item => item.stage === 'requirements' && item.kind === 'related_id_prefix'));
  const routing = buildRouting(input, resolvedProposal(input), 'interactive', options);
  const plan = buildPlan(input, routing, options);
  assert.deepEqual(plan.work_units.map(item => item.id), ['CR-19ec0182-001#1', 'CR-19ec0182-002#1']);
  assert.deepEqual(plan.execution_stages.map(stage => stage.id), options.catalogBundle.value.stages.map(stage => stage.id));
  assert.deepEqual(plan.execution_stages[0].causal_work_unit_ids, ['CR-19ec0182-001#1']);
  assert.deepEqual(plan.execution_stages.at(-2).causal_work_unit_ids, ['CR-19ec0182-001#1', 'CR-19ec0182-002#1']);
  assert.deepEqual(plan.execution_stages.at(-1).direct_work_unit_ids, []);

  const unbound = resolvedProposal(input);
  delete unbound.input_sha256;
  assert.throws(() => buildRouting(input, unbound, 'interactive', options), /input_sha256 is required/);
});

function recommendableProposal(input = document(), overrides = {}) {
  const base = resolvedProposal(input);
  const semanticContract = {
    requested_change_slice_sha256: input.requests[0].sections['変更してほしいこと'].slice_sha256,
    semantic_summary: 'キャンセル条件という同一制約を、意味を変えず正本所有先へ反映する。',
  };
  const contractSha = semanticContractSha256(semanticContract);
  const boundUnit = (directStage, constraintKey) => ({
    ...unit(directStage, constraintKey),
    semantic_contract_sha256: contractSha,
  });
  base.requests[0] = {
    request_id: input.requests[0].request_id,
    decision_state: 'recommendable',
    reason: 'Both a business-level correction and a narrow API correction are plausible.',
    evidence: [{ kind: 'mixed_reference', value: 'REQ-002 + SPEC-002-01' }],
    confidence: 'medium',
    ambiguity_kind: 'pipeline_stage_ownership',
    semantic_contract: semanticContract,
    question: '同一のキャンセル条件を、どちらのモデルを正本として反映しますか？',
    recommended_option_id: 'change-business-rule',
    options: [
      {
        option_id: 'change-business-rule', rank: 1, label: '業務モデルを正本にする（推奨）',
        route_impact: '同一制約を業務モデル側の正本へ反映し、関連成果物を再生成します。',
        rationale: '関連IDが業務モデル側の正本所有を示します。', safe: true,
        semantic_contract_sha256: contractSha,
        work_units: [boundUnit('requirements', 'business-cancellation')],
      },
      {
        option_id: 'change-api-only', rank: 2, label: '契約モデルを正本にする',
        route_impact: '同一制約を契約モデル側の正本へ反映し、関連成果物を再生成します。',
        rationale: '関連IDが契約モデル側の正本所有も候補にするためです。', safe: true,
        semantic_contract_sha256: contractSha,
        work_units: [boundUnit('spec', 'api-cancellation')],
      },
    ],
    ...overrides,
  };
  return base;
}

function blockedProposal(input = document()) {
  const proposal = resolvedProposal(input);
  proposal.requests[0] = {
    request_id: input.requests[0].request_id,
    decision_state: 'unresolved',
    reason: 'The requested source of truth cannot be determined safely.',
    evidence: [{ kind: 'missing_semantic_owner', value: 'cancellation rule' }],
    confidence: 'low',
    blocked_reason: 'A semantic owner must be established before planning.',
    candidates: ['requirements', 'spec'],
  };
  return proposal;
}

function outsideOnlyProposal(input = document()) {
  const proposal = resolvedProposal(input);
  proposal.requests.forEach((request, index) => {
    request.reason = 'The requested change is outside the configured pipeline boundary.';
    request.work_units = [unit('outside_pipeline', `outside-route-${index + 1}`)];
  });
  return proposal;
}

function routeOnlyRecommendableProposal(input = document(), overrides = {}) {
  const proposal = recommendableProposal(input, overrides);
  const contractSha = semanticContractSha256(proposal.requests[0].semantic_contract);
  const descriptor = directStage => ({
    direct_stage: directStage,
    constraint_key: 'cancellation-source-of-truth',
    reason: 'Apply the same cancellation constraint at its owning source of truth.',
    evidence: [{ kind: 'semantic_target', value: 'cancellation-source-of-truth' }],
    semantic_contract_sha256: contractSha,
  });
  proposal.requests[0].options[0].work_units = [descriptor('requirements')];
  proposal.requests[0].options[1].work_units = [descriptor('spec')];
  return proposal;
}

test('interactive asks with a recommendation; recommended-auto accepts only route-only ambiguity', () => {
  const input = document();
  const options = routingOptions();
  const proposal = recommendableProposal(input);
  const interactive = buildRouting(input, proposal, 'interactive', options);
  assert.equal(interactive.state, 'awaiting_resolution');
  assert.equal(interactive.requests[0].resolution.status, 'awaiting_user');
  assert.throws(() => buildPlan(input, interactive, options), /not executable/);
  const meaningDiffers = buildRouting(input, proposal, 'recommended_auto', options);
  assert.equal(meaningDiffers.state, 'awaiting_resolution');
  assert.equal(meaningDiffers.requests[0].resolution.status, 'awaiting_user');

  const automatic = buildRouting(input, routeOnlyRecommendableProposal(input), 'recommended_auto', options);
  assert.equal(automatic.state, 'resolved');
  assert.equal(automatic.requests[0].resolution.status, 'accepted_recommendation');
  assert.equal(automatic.requests[0].work_units[0].direct_stage, 'requirements');

  const wrongSourceContract = recommendableProposal(input);
  wrongSourceContract.requests[0].semantic_contract.requested_change_slice_sha256 = '0'.repeat(64);
  assert.throws(() => buildRouting(input, wrongSourceContract, 'interactive', options), /authoritative requested-change subsection/);
  const staleOptionContract = recommendableProposal(input);
  staleOptionContract.requests[0].semantic_contract.semantic_summary = '別の意味へ変更する。';
  assert.throws(() => buildRouting(input, staleOptionContract, 'interactive', options), /option must bind the request semantic_contract/);
  const staleUnitContract = recommendableProposal(input);
  staleUnitContract.requests[0].options[0].work_units[0].semantic_contract_sha256 = '0'.repeat(64);
  assert.throws(() => buildRouting(input, staleUnitContract, 'interactive', options), /work unit must bind the request semantic_contract/);
  const legacyImpactField = recommendableProposal(input);
  legacyImpactField.requests[0].options[0].impact = '意味変更を選択肢側へ隠す。';
  assert.throws(() => buildRouting(input, legacyImpactField, 'interactive', options), /invalid exact schema/);
  for (const ranks of [[2, 1], [1, 1], [1, 3]]) {
    const invalidRanks = recommendableProposal(input);
    invalidRanks.requests[0].options.forEach((option, index) => { option.rank = ranks[index]; });
    assert.throws(
      () => buildRouting(input, invalidRanks, 'interactive', options),
      /unique and contiguous|unique rank 1/,
    );
  }

  const unsafeAlternative = routeOnlyRecommendableProposal(input);
  unsafeAlternative.requests[0].options[1].safe = false;
  const unsafeAlternativeRouting = buildRouting(input, unsafeAlternative, 'recommended_auto', options);
  assert.equal(unsafeAlternativeRouting.state, 'awaiting_resolution');
  assert.equal(unsafeAlternativeRouting.requests[0].resolution.status, 'awaiting_user');

  const unsafe = recommendableProposal(input);
  unsafe.requests[0].options[1].work_units = [{
    ...unit('outside_pipeline', 'manual-boundary'),
    semantic_contract_sha256: unsafe.requests[0].options[1].semantic_contract_sha256,
  }];
  assert.equal(buildRouting(input, unsafe, 'recommended_auto', options).state, 'awaiting_resolution');
  const mandatoryStop = recommendableProposal(input, { stop_flags: ['requirement_reinterpretation'] });
  const stopped = buildRouting(input, mandatoryStop, 'recommended_auto', options);
  assert.equal(stopped.state, 'awaiting_resolution');
  assert.equal(stopped.requests[0].question, mandatoryStop.requests[0].question);
  assert.equal(stopped.requests[0].options.length, 2);
  const lowConfidence = routeOnlyRecommendableProposal(input, { confidence: 'low' });
  assert.equal(buildRouting(input, lowConfidence, 'recommended_auto', options).state, 'awaiting_resolution');

  const semanticWord = recommendableProposal(input, {
    question: 'API specificationの意味を変えず、契約表現だけを補完する案を比較しますか？',
  });
  assert.doesNotThrow(() => buildRouting(input, semanticWord, 'interactive', options));
  for (const field of ['label', 'route_impact', 'rationale']) {
    const leakedStage = recommendableProposal(input);
    leakedStage.requests[0].options[0][field] = 'requirementsを選ぶ内部ルーティングです。';
    assert.throws(
      () => buildRouting(input, leakedStage, 'interactive', options),
      /without internal pipeline stage IDs/,
    );
  }
  const leakedQuestion = recommendableProposal(input, { question: 'spec stageを選びますか？' });
  assert.throws(
    () => buildRouting(input, leakedQuestion, 'interactive', options),
    /without internal pipeline stage IDs/,
  );
  const leakedOutsideQuestion = recommendableProposal(input, { question: 'outside-pipelineを選びますか？' });
  assert.throws(
    () => buildRouting(input, leakedOutsideQuestion, 'interactive', options),
    /without internal pipeline stage IDs/,
  );
  const leakedCaseVariant = recommendableProposal(input);
  leakedCaseVariant.requests[0].options[0].route_impact = 'REQUIREMENTS_STAGEへ直接割り当てます。';
  assert.throws(
    () => buildRouting(input, leakedCaseVariant, 'interactive', options),
    /without internal pipeline stage IDs/,
  );
  for (const leakedText of ['target_requirements_stage', 'route_to_spec_stage', 'outside_pipeline_route']) {
    const leakedSnakeCase = recommendableProposal(input);
    leakedSnakeCase.requests[0].options[0].rationale = leakedText;
    assert.throws(
      () => buildRouting(input, leakedSnakeCase, 'interactive', options),
      /without internal pipeline stage IDs/,
    );
  }
  const customCatalog = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'references', 'feedback-stage-ownership.json'),
    'utf8',
  ));
  customCatalog.stages[1].id = 'quality-attributes-v2';
  const customRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-stage-text-'));
  const customCatalogPath = path.join(customRoot, 'catalog.json');
  fs.writeFileSync(customCatalogPath, `${JSON.stringify(customCatalog, null, 2)}\n`);
  const customCatalogBundle = loadCatalog(customCatalogPath);
  const customOptions = {
    ...options,
    catalogBundle: customCatalogBundle,
    latestDomainEventIds: Object.fromEntries(customCatalogBundle.value.stages.map(stage => [
      stage.id,
      Object.fromEntries(stage.domain_event_roots.map(root => [root, null])),
    ])),
  };
  const customStageLeak = recommendableProposal(input);
  customStageLeak.requests[0].options[0].work_units = [{
    ...unit('quality-attributes-v2', 'quality-constraint'),
    semantic_contract_sha256: customStageLeak.requests[0].options[0].semantic_contract_sha256,
  }];
  customStageLeak.requests[0].options[0].label = 'quality_attributes_v2_stageを選ぶ';
  assert.throws(
    () => buildRouting(input, customStageLeak, 'interactive', customOptions),
    /without internal pipeline stage IDs/,
  );
  const leakedFrozen = structuredClone(interactive);
  leakedFrozen.requests[0].options[0].label = 'design_system_stageを選ぶ';
  assert.throws(
    () => buildRouting(input, leakedFrozen, 'interactive', options),
    /without internal pipeline stage IDs/,
  );
  const misrankedFrozen = structuredClone(interactive);
  misrankedFrozen.requests[0].options[0].rank = 2;
  misrankedFrozen.requests[0].options[1].rank = 1;
  assert.throws(
    () => buildRouting(input, misrankedFrozen, 'interactive', options),
    /recommended_option_id must identify the unique rank 1 option/,
  );

  const resolutions = {
    schema_version: 'distillery.feedback-resolutions/v1',
    feedback_request_id: input.metadata.feedback_id,
    input_sha256: input.input_sha256,
    routing_basis: meaningDiffers.routing_basis,
    answers: [{ request_id: input.requests[0].request_id, selected_option_id: 'change-api-only', answered_by: 'human', answered_at: '2026-07-30T12:30:00+09:00' }],
  };
  const userResolved = applyResolutions(meaningDiffers, resolutions, meaningDiffers.routing_basis, options);
  assert.equal(userResolved.policy, 'recommended_auto');
  assert.equal(userResolved.requests[0].resolution.status, 'user_selected');
});

test('route-only comparison preserves descriptor multiplicity and rejects duplicate constraint ownership', () => {
  const descriptor = {
    constraint_key: 'one-constraint',
    reason: 'Preserve multiplicity.',
    evidence: [{ kind: 'semantic_target', value: 'one-constraint' }],
  };
  assert.notDeepEqual(
    semanticDescriptorSet({ work_units: [descriptor, descriptor] }),
    semanticDescriptorSet({ work_units: [descriptor] }),
  );

  const input = document();
  const duplicated = resolvedProposal(input);
  duplicated.requests[0].work_units = [
    { ...descriptor, direct_stage: 'requirements' },
    { ...descriptor, direct_stage: 'spec' },
  ];
  assert.throws(
    () => buildRouting(input, duplicated, 'interactive', routingOptions()),
    /duplicate constraint_key across direct stages/,
  );
});

test('frozen routing resumes only with the same mode, input and current routing basis', () => {
  const input = document();
  const options = routingOptions();
  const frozen = buildRouting(input, resolvedProposal(input), 'interactive', options);
  assert.equal(buildRouting(input, frozen, 'interactive', options), frozen);
  const automatic = buildRouting(input, routeOnlyRecommendableProposal(input), 'recommended_auto', options);
  assert.equal(buildRouting(input, automatic, 'recommended_auto', options), automatic);
  assert.throws(() => buildRouting(input, frozen, 'recommended_auto', options), /mode cannot change/);
  assert.throws(() => buildRouting(input, frozen, 'interactive', routingOptions({ repositoryHead: 'changed' })), /routing basis changed/);
  const tampered = structuredClone(frozen);
  tampered.requests[0].work_units[0].required_closure_stages = ['spec'];
  assert.throws(() => buildRouting(input, tampered, 'interactive', options), /not normalized or closure-bound/);

  const lowProposal = resolvedProposal(input);
  lowProposal.requests[0].confidence = 'low';
  assert.throws(() => buildRouting(input, lowProposal, 'interactive', options), /regenerate as recommendable or unresolved/);
  const lowFrozen = structuredClone(frozen);
  lowFrozen.requests[0].confidence = 'low';
  assert.throws(() => buildRouting(input, lowFrozen, 'interactive', options), /regenerate as recommendable or unresolved/);

  for (const [name, mutate] of [
    ['interactive policy', value => { value.policy = 'interactive'; }],
    ['resolved decision state', value => { value.requests[0].decision_state = 'resolved'; }],
    ['unsafe alternative', value => { value.requests[0].options[1].safe = false; }],
    ['missing policy provenance', value => { delete value.requests[0].resolution.policy_version; }],
  ]) {
    const forgedAutomatic = structuredClone(automatic);
    mutate(forgedAutomatic);
    assert.throws(
      () => buildRouting(input, forgedAutomatic, forgedAutomatic.policy, options),
      /automatic acceptance violates the current policy or canonical audit shape/,
      name,
    );
  }

  const awaiting = buildRouting(input, recommendableProposal(input), 'interactive', options);
  const userSelected = applyResolutions(awaiting, {
    schema_version: 'distillery.feedback-resolutions/v1',
    feedback_request_id: input.metadata.feedback_id,
    input_sha256: input.input_sha256,
    routing_basis: awaiting.routing_basis,
    answers: [{
      request_id: input.requests[0].request_id,
      selected_option_id: 'change-business-rule',
      answered_by: 'human',
      answered_at: '2026-07-30T12:30:00+09:00',
    }],
  }, awaiting.routing_basis, options);
  delete userSelected.requests[0].resolution.answered_by;
  delete userSelected.requests[0].resolution.answered_at;
  assert.throws(
    () => buildRouting(input, userSelected, 'interactive', options),
    /must not persist user_selected.*resolutions\.json provenance/,
  );
});

test('interactive resolution revalidates HEAD, latest events, catalog/policy and input binding', () => {
  const input = document();
  const options = routingOptions();
  const routing = buildRouting(input, recommendableProposal(input), 'interactive', options);
  const resolutions = {
    schema_version: 'distillery.feedback-resolutions/v1',
    feedback_request_id: input.metadata.feedback_id,
    input_sha256: input.input_sha256,
    routing_basis: routing.routing_basis,
    answers: [{ request_id: input.requests[0].request_id, selected_option_id: 'change-business-rule', answered_by: 'human', answered_at: '2026-07-30T12:30:00+09:00' }],
  };
  const resolved = applyResolutions(routing, resolutions, routing.routing_basis, options);
  assert.equal(resolved.state, 'resolved');
  const withExtraAnswer = structuredClone(resolutions);
  withExtraAnswer.answers.push({ request_id: input.requests[1].request_id, selected_option_id: 'unknown', answered_by: 'human', answered_at: '2026-07-30T12:30:00+09:00' });
  assert.throws(() => applyResolutions(routing, withExtraAnswer, routing.routing_basis, options), /cover awaiting requests exactly once/);
  const changedHead = createRoutingBasis({ ...options, repositoryHead: 'def456' }, options.catalogBundle, options.policyBundle);
  assert.throws(() => applyResolutions(routing, resolutions, changedHead, options), /routing basis changed/);
  const changedEventIds = structuredClone(options.latestDomainEventIds);
  changedEventIds.requirements['usdm/events'] = 'new-event';
  const changedEvents = createRoutingBasis({ ...options, latestDomainEventIds: changedEventIds }, options.catalogBundle, options.policyBundle);
  assert.throws(() => applyResolutions(routing, resolutions, changedEvents, options), /routing basis changed/);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-resolution-resume-'));
  const runDir = path.join(root, input.metadata.feedback_id);
  const plan = buildPlan(input, resolved, options);
  const illegalPersistRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-user-selected-routing-'));
  const illegalPersistDir = path.join(illegalPersistRoot, input.metadata.feedback_id);
  assert.throws(
    () => initializeRun(fixtureBuffer(), input, resolved, plan, illegalPersistDir, {
      resolutions, initStatus: true, effectiveRouting: resolved, catalogBundle: options.catalogBundle,
    }),
    /routing\.json must not persist user_selected/,
  );
  assert.equal(fs.existsSync(illegalPersistDir), false);

  const missingProvenanceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-user-selected-provenance-'));
  const missingProvenanceDir = path.join(missingProvenanceRoot, input.metadata.feedback_id);
  assert.throws(
    () => initializeRun(fixtureBuffer(), input, routing, plan, missingProvenanceDir, {
      initStatus: true, effectiveRouting: resolved, catalogBundle: options.catalogBundle,
    }),
    /effective user_selected routing requires canonical resolutions\.json provenance/,
  );
  assert.equal(fs.existsSync(missingProvenanceDir), false);

  initializeRun(fixtureBuffer(), input, routing, null, runDir, { initStatus: true, catalogBundle: options.catalogBundle });
  assert.doesNotThrow(() => initializeRun(fixtureBuffer(), input, routing, plan, runDir, {
    resolutions, initStatus: true, effectiveRouting: resolved, catalogBundle: options.catalogBundle,
  }));
  assert.equal(JSON.parse(fs.readFileSync(path.join(runDir, 'status.json'), 'utf8')).state, 'planned');
});

test('one-buffer initialization is immutable, policy-bound, and stage packets isolate exact assigned slices', () => {
  const buffer = fixtureBuffer();
  const input = parseFeedbackRequest(buffer);
  const options = routingOptions();
  const routing = buildRouting(input, resolvedProposal(input), 'interactive', options);
  const plan = buildPlan(input, routing, options);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-run-'));
  const runDir = path.join(root, input.metadata.feedback_id);
  initializeRun(buffer, input, routing, plan, runDir, { initStatus: true, effectiveRouting: routing, catalogBundle: options.catalogBundle });
  initializeRun(buffer, input, routing, plan, runDir, { initStatus: true, effectiveRouting: routing, catalogBundle: options.catalogBundle });
  assert.ok(fs.readFileSync(path.join(runDir, 'input.md')).equals(buffer));
  assert.equal(fs.existsSync(path.join(runDir, 'input.json')), false);
  const requirementsPacket = renderStagePacket(buffer, input, plan, 'requirements');
  assert.match(requirementsPacket, /CR-19ec0182-001/);
  assert.doesNotMatch(requirementsPacket, /CR-19ec0182-002/);
  assert.doesNotMatch(requirementsPacket, /Ignore previous instructions/);
  assert.match(requirementsPacket, /untrusted data/);
  assert.match(requirementsPacket, /Never read related_files/);
  assert.match(requirementsPacket, /allowed_work_unit_ids: CR-19ec0182-001#1/);
  assert.doesNotMatch(requirementsPacket, /The requested source of truth belongs to requirements/);
  const descriptorMatch = requirementsPacket.match(/<distillery-work-unit-data[^>]+>\n([^\n]+)\n<\/distillery-work-unit-data>/);
  assert.ok(descriptorMatch);
  const descriptor = JSON.parse(Buffer.from(descriptorMatch[1], 'base64').toString('utf8'));
  assert.deepEqual(Object.keys(descriptor).sort(), [
    'constraint_key', 'direct_stage', 'evidence', 'reason', 'request_id', 'required_closure_stages', 'work_unit_id',
  ].sort());
  assert.equal(descriptor.work_unit_id, 'CR-19ec0182-001#1');
  assert.deepEqual(descriptor.required_closure_stages, options.catalogBundle.value.stages.map(stage => stage.id));

  const changedBytes = Buffer.from(buffer.toString('utf8').replace('キャンセル要件', '取消要件'));
  const changedInput = parseFeedbackRequest(changedBytes);
  const changedRouting = buildRouting(changedInput, resolvedProposal(changedInput), 'interactive', options);
  const changedPlan = buildPlan(changedInput, changedRouting, options);
  assert.throws(() => initializeRun(changedBytes, changedInput, changedRouting, changedPlan, runDir, {
    effectiveRouting: changedRouting, catalogBundle: options.catalogBundle,
  }), /immutable file mismatch/);
  const automaticRouting = buildRouting(input, resolvedProposal(input), 'recommended_auto', options);
  const automaticPlan = buildPlan(input, automaticRouting, options);
  assert.throws(() => initializeRun(buffer, input, automaticRouting, automaticPlan, runDir, {
    effectiveRouting: automaticRouting, catalogBundle: options.catalogBundle,
  }), /immutable file mismatch/);
});

test('feedback and normal runs share a lease bound to feedback_id plus exact input SHA', () => {
  const buffer = fixtureBuffer();
  const input = { buffer, document: parseFeedbackRequest(buffer) };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-lease-'));
  fs.mkdirSync(path.join(root, 'docs'));
  const leasePath = path.join(root, 'docs', 'pipeline', 'run-lease.json');
  const lease = acquireLease(input, leasePath, { runId: 'feedback-run', startedHead: 'non-git:test' });
  assert.equal(lease.feedback_request_id, input.document.metadata.feedback_id);
  assert.equal(lease.input_sha256, input.document.input_sha256);
  assert.equal(readLease(leasePath).run_id, 'feedback-run');
  assert.throws(() => acquireNormalLease(fixturePath, leasePath, { runId: 'normal-run' }), /already leased/);
  assert.throws(() => releaseLease(leasePath, 'feedback-run', '0'.repeat(64)), /owner mismatch/);
  releaseLease(leasePath, lease.run_id, lease.input_sha256);
  assert.equal(fs.existsSync(leasePath), false);
});

test('lease path and ancestors are canonical, real, and never symlink-followed', () => {
  const buffer = fixtureBuffer();
  const input = { buffer, document: parseFeedbackRequest(buffer) };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-lease-path-'));
  const artifactRoot = path.join(root, 'artifacts');
  fs.mkdirSync(artifactRoot);

  const alternate = path.join(artifactRoot, 'pipeline', 'alternate-lock.json');
  assert.throws(() => acquireLease(input, alternate, { runId: 'alternate' }), /canonical/);
  assert.equal(fs.existsSync(path.join(artifactRoot, 'pipeline')), false);

  const outsidePipeline = path.join(root, 'outside-pipeline');
  fs.mkdirSync(outsidePipeline);
  fs.symlinkSync(outsidePipeline, path.join(artifactRoot, 'pipeline'));
  const leasePath = path.join(artifactRoot, 'pipeline', 'run-lease.json');
  assert.throws(() => acquireLease(input, leasePath, { runId: 'parent-link' }), /real directory|symlink/);
  assert.equal(fs.existsSync(path.join(outsidePipeline, 'run-lease.json')), false);
  fs.unlinkSync(path.join(artifactRoot, 'pipeline'));

  fs.mkdirSync(path.join(artifactRoot, 'pipeline'));
  const outsideLease = path.join(root, 'outside-lease.json');
  fs.writeFileSync(outsideLease, '{}\n');
  fs.symlinkSync(outsideLease, leasePath);
  assert.throws(() => readLease(leasePath), /regular file|symlink/);
  assert.throws(() => touchLease(leasePath, 'owner'), /regular file|symlink/);
  assert.throws(() => releaseLease(leasePath, 'owner'), /regular file|symlink/);
  assert.equal(fs.readFileSync(outsideLease, 'utf8'), '{}\n');
});

function createStandardPlannedRun(prefix = 'feedback-standard-run-', overrides = {}) {
  const buffer = fixtureBuffer();
  const input = parseFeedbackRequest(buffer);
  const options = routingOptions({ latestDomainEventIds: emptyLatestDomainEvents(), ...overrides });
  const routing = buildRouting(input, resolvedProposal(input), 'interactive', options);
  const plan = buildPlan(input, routing, options);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const artifactRoot = path.join(root, 'artifacts');
  const runRoot = path.join(artifactRoot, 'pipeline', 'feedback-runs');
  const runDir = path.join(runRoot, input.metadata.feedback_id);
  fs.mkdirSync(runRoot, { recursive: true });
  initializeRun(buffer, input, routing, plan, runDir, {
    initStatus: true,
    effectiveRouting: routing,
    catalogBundle: options.catalogBundle,
    policyBundle: options.policyBundle,
    runRoot,
  });
  return {
    root,
    artifactRoot,
    runDir,
    leasePath: path.join(artifactRoot, 'pipeline', 'run-lease.json'),
    buffer,
    input,
    routing,
    plan,
  };
}

function writeLatestEventsSnapshot(workspace, name = 'latest-events.json') {
  const target = path.join(workspace.root, name);
  fs.writeFileSync(target, `${JSON.stringify(workspace.routing.routing_basis.latest_domain_event_ids, null, 2)}\n`);
  return target;
}

test('planner permits lease-free pure planning but write/resume has one canonical controller lease', () => {
  const input = document();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-controller-boundary-'));
  const artifactRoot = path.join(root, 'artifacts');
  fs.mkdirSync(artifactRoot);
  const runDir = path.join(artifactRoot, 'pipeline', 'feedback-runs', input.metadata.feedback_id);
  const leasePath = path.join(artifactRoot, 'pipeline', 'run-lease.json');
  const proposalPath = path.join(root, 'proposal.json');
  const plannerPath = path.join(__dirname, '..', 'scripts', 'planFeedbackRequest.js');
  fs.writeFileSync(proposalPath, `${JSON.stringify(resolvedProposal(input), null, 2)}\n`);

  const pure = spawnSync(process.execPath, [
    plannerPath, fixturePath, '--routing', proposalPath, '--policy', 'interactive', '--repository-head', 'non-git:test',
  ], { encoding: 'utf8' });
  assert.equal(pure.status, 0, pure.stderr);
  assert.equal(JSON.parse(pure.stdout).schema_version, 'distillery.feedback-plan/v1');
  assert.equal(fs.existsSync(path.join(artifactRoot, 'pipeline')), false);

  const overriddenCatalog = spawnSync(process.execPath, [
    plannerPath, fixturePath, '--routing', proposalPath, '--policy', 'interactive',
    '--catalog', path.join(__dirname, '..', 'references', 'feedback-stage-ownership.json'),
  ], { encoding: 'utf8' });
  assert.equal(overriddenCatalog.status, 1);
  assert.match(overriddenCatalog.stderr, /plugin-bundled ownership catalog and routing policy/);

  const active = acquireLease({ buffer: fixtureBuffer(), document: input }, leasePath, {
    runId: 'first-controller', startedHead: 'non-git:test',
  });
  const withoutLease = spawnSync(process.execPath, [
    plannerPath, fixturePath, '--routing', proposalPath, '--policy', 'interactive', '--write', runDir,
  ], { encoding: 'utf8' });
  assert.equal(withoutLease.status, 1);
  assert.match(withoutLease.stderr, /require --lease plus --run-id/);

  const alternateLease = path.join(artifactRoot, 'pipeline', 'parallel', 'run-lease.json');
  const withAlternateLease = spawnSync(process.execPath, [
    plannerPath, fixturePath, '--routing', proposalPath, '--policy', 'interactive', '--write', runDir,
    '--lease', alternateLease, '--run-id', 'second-controller',
  ], { encoding: 'utf8' });
  assert.equal(withAlternateLease.status, 1);
  assert.match(withAlternateLease.stderr, /canonical path/);

  const withCanonicalLease = spawnSync(process.execPath, [
    plannerPath, fixturePath, '--routing', proposalPath, '--policy', 'interactive', '--write', runDir,
    '--lease', leasePath, '--run-id', 'second-controller',
  ], { encoding: 'utf8' });
  assert.equal(withCanonicalLease.status, 1);
  assert.match(withCanonicalLease.stderr, /already leased/);
  assert.equal(readLease(leasePath).run_id, 'first-controller');
  assert.equal(fs.existsSync(runDir), false);
  releaseLease(leasePath, active.run_id, active.input_sha256);
});

test('planner accepts frozen routing only from canonical run-directory resume', () => {
  const input = document();
  const options = routingOptions();
  const frozen = buildRouting(input, resolvedProposal(input), 'interactive', options);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-external-frozen-'));
  const artifactRoot = path.join(root, 'artifacts');
  const runDir = path.join(artifactRoot, 'pipeline', 'feedback-runs', input.metadata.feedback_id);
  const leasePath = path.join(artifactRoot, 'pipeline', 'run-lease.json');
  const frozenPath = path.join(root, 'frozen-routing.json');
  const plannerPath = path.join(__dirname, '..', 'scripts', 'planFeedbackRequest.js');
  fs.mkdirSync(artifactRoot);
  fs.writeFileSync(frozenPath, `${JSON.stringify(frozen, null, 2)}\n`);

  const attempted = spawnSync(process.execPath, [
    plannerPath, fixturePath,
    '--routing', frozenPath,
    '--policy', 'interactive',
    '--repository-head', 'non-git:test',
    '--write', runDir,
    '--lease', leasePath,
    '--run-id', 'external-frozen',
  ], { encoding: 'utf8' });
  assert.equal(attempted.status, 1);
  assert.match(attempted.stderr, /new Markdown input requires.*routing-proposal.*canonical run-directory resume/);
  assert.equal(fs.existsSync(runDir), false);
  assert.equal(fs.existsSync(leasePath), false);
});

test('planner CLI always creates a status checkpoint and the run resumes without --init-status', () => {
  const input = document();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-required-status-'));
  const artifactRoot = path.join(root, 'artifacts');
  const runDir = path.join(artifactRoot, 'pipeline', 'feedback-runs', input.metadata.feedback_id);
  const leasePath = path.join(artifactRoot, 'pipeline', 'run-lease.json');
  const proposalPath = path.join(root, 'proposal.json');
  const plannerPath = path.join(__dirname, '..', 'scripts', 'planFeedbackRequest.js');
  fs.mkdirSync(artifactRoot);
  fs.writeFileSync(proposalPath, `${JSON.stringify(resolvedProposal(input), null, 2)}\n`);

  const created = spawnSync(process.execPath, [
    plannerPath, fixturePath,
    '--routing', proposalPath,
    '--policy', 'interactive',
    '--repository-head', 'non-git:test',
    '--write', runDir,
    '--lease', leasePath,
    '--run-id', 'create-with-checkpoint',
  ], { encoding: 'utf8' });
  assert.equal(created.status, 0, created.stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(runDir, 'status.json'), 'utf8')).state, 'planned');
  assert.equal(fs.existsSync(path.join(runDir, 'initialization-in-progress.json')), false);
  releaseLease(leasePath, 'create-with-checkpoint', input.input_sha256);

  const resumed = spawnSync(process.execPath, [
    plannerPath, runDir,
    '--repository-head', 'non-git:test',
    '--lease', leasePath,
    '--run-id', 'resume-with-checkpoint',
  ], { encoding: 'utf8' });
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.equal(JSON.parse(resumed.stdout).schema_version, 'distillery.feedback-plan/v1');
  assert.equal(JSON.parse(fs.readFileSync(path.join(runDir, 'status.json'), 'utf8')).state, 'planned');
  releaseLease(leasePath, 'resume-with-checkpoint', input.input_sha256);
});

test('planner rejects run-tree and ancestor symlinks before acquiring the lease', () => {
  const input = document();
  const plannerPath = path.join(__dirname, '..', 'scripts', 'planFeedbackRequest.js');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-run-link-'));
  const artifactRoot = path.join(root, 'artifacts');
  const runRoot = path.join(artifactRoot, 'pipeline', 'feedback-runs');
  const runDir = path.join(runRoot, input.metadata.feedback_id);
  const leasePath = path.join(artifactRoot, 'pipeline', 'run-lease.json');
  const outsideRun = path.join(root, 'outside-run');
  const proposalPath = path.join(root, 'proposal.json');
  fs.mkdirSync(runRoot, { recursive: true });
  fs.mkdirSync(outsideRun);
  fs.symlinkSync(outsideRun, runDir);
  fs.writeFileSync(proposalPath, `${JSON.stringify(resolvedProposal(input), null, 2)}\n`);
  const linkedRun = spawnSync(process.execPath, [
    plannerPath, fixturePath, '--routing', proposalPath, '--policy', 'interactive', '--write', runDir,
    '--lease', leasePath, '--run-id', 'linked-run',
  ], { encoding: 'utf8' });
  assert.equal(linkedRun.status, 1);
  assert.match(linkedRun.stderr, /real directory|symlink/);
  assert.deepEqual(fs.readdirSync(outsideRun), []);
  assert.equal(fs.existsSync(leasePath), false);

  const ancestorRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-ancestor-link-'));
  const ancestorArtifactRoot = path.join(ancestorRoot, 'artifacts');
  const outsidePipeline = path.join(ancestorRoot, 'outside-pipeline');
  fs.mkdirSync(ancestorArtifactRoot);
  fs.mkdirSync(outsidePipeline);
  fs.symlinkSync(outsidePipeline, path.join(ancestorArtifactRoot, 'pipeline'));
  const ancestorRunDir = path.join(ancestorArtifactRoot, 'pipeline', 'feedback-runs', input.metadata.feedback_id);
  const ancestorLease = path.join(ancestorArtifactRoot, 'pipeline', 'run-lease.json');
  const linkedAncestor = spawnSync(process.execPath, [
    plannerPath, fixturePath, '--routing', proposalPath, '--policy', 'interactive', '--write', ancestorRunDir,
    '--lease', ancestorLease, '--run-id', 'linked-ancestor',
  ], { encoding: 'utf8' });
  assert.equal(linkedAncestor.status, 1);
  assert.match(linkedAncestor.stderr, /real directory|symlink/);
  assert.deepEqual(fs.readdirSync(outsidePipeline), []);
});

test('planner rejects symlinked core evidence and stage packets without touching targets or leases', () => {
  const plannerPath = path.join(__dirname, '..', 'scripts', 'planFeedbackRequest.js');
  for (const name of [
    'input.md', 'run.json', 'routing.json', 'resolutions.json', 'plan.json', 'status.json', 'result.json',
    'ownership-catalog.json', 'routing-policy.json', 'prompt-data-policy.txt',
  ]) {
    const workspace = createStandardPlannedRun(`feedback-core-link-${name.replace('.', '-')}-`);
    const target = path.join(workspace.runDir, name);
    const outside = path.join(workspace.root, `outside-${name}`);
    const bytes = fs.existsSync(target) ? fs.readFileSync(target) : Buffer.from('{}\n');
    if (fs.existsSync(target)) fs.unlinkSync(target);
    fs.writeFileSync(outside, bytes);
    fs.symlinkSync(outside, target);
    const resumed = spawnSync(process.execPath, [
      plannerPath, workspace.runDir, '--repository-head', 'non-git:test',
      '--lease', workspace.leasePath, '--run-id', `linked-${name.replace('.', '-')}`,
    ], { encoding: 'utf8' });
    assert.equal(resumed.status, 1, `${name}: ${resumed.stderr}`);
    assert.match(resumed.stderr, /regular file|symlink/, name);
    assert.ok(fs.readFileSync(outside).equals(bytes), `${name} external target changed`);
    assert.equal(fs.existsSync(workspace.leasePath), false, `${name} acquired a lease`);
  }

  const workspace = createStandardPlannedRun('feedback-packets-link-');
  const packetDir = path.join(workspace.runDir, 'stage-packets');
  const outsidePackets = path.join(workspace.root, 'outside-packets');
  fs.renameSync(packetDir, outsidePackets);
  const before = fs.readdirSync(outsidePackets).map(name => [name, fs.readFileSync(path.join(outsidePackets, name), 'utf8')]);
  fs.symlinkSync(outsidePackets, packetDir);
  const resumed = spawnSync(process.execPath, [
    plannerPath, workspace.runDir, '--repository-head', 'non-git:test',
    '--lease', workspace.leasePath, '--run-id', 'linked-packets',
  ], { encoding: 'utf8' });
  assert.equal(resumed.status, 1, resumed.stderr);
  assert.match(resumed.stderr, /stage-packets.*symlink|real directory/);
  assert.deepEqual(before, fs.readdirSync(outsidePackets).map(name => [name, fs.readFileSync(path.join(outsidePackets, name), 'utf8')]));
  assert.equal(fs.existsSync(workspace.leasePath), false);
});

test('run-directory resume reads only canonical snapshot paths and canonical JSON', () => {
  const plannerPath = path.join(__dirname, '..', 'scripts', 'planFeedbackRequest.js');
  for (const [flag, filename, message] of [
    ['--routing', 'outside-routing.json', /may not override routing/],
    ['--resolution', 'outside-resolutions.json', /may not override resolutions/],
    ['--write', 'outside-write', /may not override its write directory/],
    ['--events-dir', 'outside-events', /events directory must use artifactRoot\/pipeline\/events/],
  ]) {
    const workspace = createStandardPlannedRun(`feedback-resume-override-${flag.slice(2)}-`);
    const outside = path.join(workspace.root, filename);
    if (flag !== '--write') fs.writeFileSync(outside, '{}\n');
    const resumed = spawnSync(process.execPath, [
      plannerPath, workspace.runDir, flag, outside,
      '--lease', workspace.leasePath, '--run-id', `override-${flag.slice(2)}`,
    ], { encoding: 'utf8' });
    assert.equal(resumed.status, 1);
    assert.match(resumed.stderr, message);
    assert.equal(fs.existsSync(workspace.leasePath), false);
  }

  const duplicateWorkspace = createStandardPlannedRun('feedback-resume-duplicate-');
  const routingPath = path.join(duplicateWorkspace.runDir, 'routing.json');
  const routingText = fs.readFileSync(routingPath, 'utf8');
  fs.writeFileSync(routingPath, routingText.replace(
    '  "schema_version": "distillery.feedback-routing/v1",',
    '  "schema_version": "distillery.feedback-routing/v1",\n  "schema_version": "distillery.feedback-routing/v1",',
  ));
  const duplicateResume = spawnSync(process.execPath, [
    plannerPath, duplicateWorkspace.runDir, '--lease', duplicateWorkspace.leasePath, '--run-id', 'duplicate-routing',
  ], { encoding: 'utf8' });
  assert.equal(duplicateResume.status, 1);
  assert.match(duplicateResume.stderr, /canonical two-space JSON/);
  assert.equal(fs.existsSync(duplicateWorkspace.leasePath), false);

  const proposalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-proposal-duplicate-'));
  const proposalPath = path.join(proposalRoot, 'proposal.json');
  const proposalText = `${JSON.stringify(resolvedProposal(), null, 2)}\n`;
  fs.writeFileSync(proposalPath, proposalText.replace(
    '  "schema_version": "distillery.feedback-routing-proposal/v1",',
    '  "schema_version": "distillery.feedback-routing-proposal/v1",\n  "schema_version": "distillery.feedback-routing-proposal/v1",',
  ));
  const duplicateProposal = spawnSync(process.execPath, [
    plannerPath, fixturePath, '--routing', proposalPath, '--policy', 'interactive',
  ], { encoding: 'utf8' });
  assert.equal(duplicateProposal.status, 1);
  assert.match(duplicateProposal.stderr, /canonical two-space JSON/);

  const duplicateEventsPath = path.join(proposalRoot, 'latest-events.json');
  fs.writeFileSync(duplicateEventsPath, '{\n  "requirements": "evt-1",\n  "requirements": "evt-1"\n}\n');
  const validProposalPath = path.join(proposalRoot, 'valid-proposal.json');
  fs.writeFileSync(validProposalPath, `${JSON.stringify(resolvedProposal(), null, 2)}\n`);
  const duplicateLatestEvents = spawnSync(process.execPath, [
    plannerPath, fixturePath, '--routing', validProposalPath,
    '--policy', 'interactive', '--latest-domain-events', duplicateEventsPath,
  ], { encoding: 'utf8' });
  assert.equal(duplicateLatestEvents.status, 1);
  assert.match(duplicateLatestEvents.stderr, /canonical two-space JSON/);

  const duplicateResolutionWorkspace = createStandardPlannedRun('feedback-resolution-duplicate-');
  fs.writeFileSync(path.join(duplicateResolutionWorkspace.runDir, 'resolutions.json'), [
    '{',
    '  "schema_version": "distillery.feedback-resolutions/v1",',
    '  "schema_version": "distillery.feedback-resolutions/v1"',
    '}',
    '',
  ].join('\n'));
  const duplicateResolution = spawnSync(process.execPath, [
    plannerPath, duplicateResolutionWorkspace.runDir,
    '--repository-head', 'non-git:test',
    '--lease', duplicateResolutionWorkspace.leasePath,
    '--run-id', 'duplicate-resolution',
  ], { encoding: 'utf8' });
  assert.equal(duplicateResolution.status, 1);
  assert.match(duplicateResolution.stderr, /canonical two-space JSON/);
  assert.equal(fs.existsSync(duplicateResolutionWorkspace.leasePath), false);

  const driftRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-nonterminal-policy-drift-'));
  const driftPolicyPath = path.join(driftRoot, 'routing-policy.json');
  const driftPolicy = JSON.parse(fs.readFileSync(path.join(
    __dirname, '..', 'references', 'feedback-routing-policy.json',
  ), 'utf8'));
  driftPolicy.policy_version = 'historical-nonterminal';
  fs.writeFileSync(driftPolicyPath, `${JSON.stringify(driftPolicy, null, 2)}\n`);
  const driftWorkspace = createStandardPlannedRun('feedback-nonterminal-drift-', {
    policyBundle: loadPolicy(driftPolicyPath),
  });
  const driftedResume = spawnSync(process.execPath, [
    plannerPath, driftWorkspace.runDir,
    '--repository-head', 'non-git:test',
    '--lease', driftWorkspace.leasePath,
    '--run-id', 'policy-drift',
  ], { encoding: 'utf8' });
  assert.equal(driftedResume.status, 1);
  assert.match(driftedResume.stderr, /static routing basis changed/);
  assert.equal(fs.existsSync(driftWorkspace.leasePath), false);
});

test('planner repairs only marker-bound initialization gaps before any execution evidence', () => {
  const plannerPath = path.join(__dirname, '..', 'scripts', 'planFeedbackRequest.js');
  const markerFor = workspace => ({
    schema_version: 'distillery.feedback-initialization/v1',
    feedback_request_id: workspace.input.metadata.feedback_id,
    input_sha256: workspace.input.input_sha256,
  });
  const latestEventsFor = workspace => {
    const target = path.join(workspace.root, 'latest-events.json');
    fs.writeFileSync(target, `${JSON.stringify(workspace.routing.routing_basis.latest_domain_event_ids, null, 2)}\n`);
    return target;
  };

  for (const partialFoundation of [false, true]) {
    const input = document();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), partialFoundation
      ? 'feedback-partial-foundation-'
      : 'feedback-empty-foundation-'));
    const artifactRoot = path.join(root, 'artifacts');
    const runDir = path.join(artifactRoot, 'pipeline', 'feedback-runs', input.metadata.feedback_id);
    const leasePath = path.join(artifactRoot, 'pipeline', 'run-lease.json');
    const proposalPath = path.join(root, 'proposal.json');
    fs.mkdirSync(runDir, { recursive: true });
    if (partialFoundation) fs.writeFileSync(path.join(runDir, 'input.md'), fixtureBuffer());
    fs.writeFileSync(proposalPath, `${JSON.stringify(resolvedProposal(input), null, 2)}\n`);
    const resumed = spawnSync(process.execPath, [
      plannerPath, fixturePath,
      '--routing', proposalPath,
      '--policy', 'interactive',
      '--repository-head', 'non-git:test',
      '--write', runDir,
      '--lease', leasePath,
      '--run-id', partialFoundation ? 'partial-foundation' : 'empty-foundation',
      '--init-status',
    ], { encoding: 'utf8' });
    assert.equal(resumed.status, 0, resumed.stderr);
    assert.equal(JSON.parse(fs.readFileSync(path.join(runDir, 'status.json'), 'utf8')).state, 'planned');
    assert.equal(fs.existsSync(path.join(runDir, 'initialization-in-progress.json')), false);
    releaseLease(leasePath, partialFoundation ? 'partial-foundation' : 'empty-foundation', input.input_sha256);
  }

  const repairable = createStandardPlannedRun('feedback-partial-repair-');
  const missingPacket = path.join(repairable.runDir, 'stage-packets', 'spec.md');
  const expectedPacket = fs.readFileSync(missingPacket);
  fs.unlinkSync(missingPacket);
  fs.unlinkSync(path.join(repairable.runDir, 'status.json'));
  fs.writeFileSync(path.join(repairable.runDir, 'initialization-in-progress.json'),
    `${JSON.stringify(markerFor(repairable), null, 2)}\n`);
  const repaired = spawnSync(process.execPath, [
    plannerPath, repairable.runDir,
    '--repository-head', 'non-git:test',
    '--latest-domain-events', latestEventsFor(repairable),
    '--lease', repairable.leasePath,
    '--run-id', 'repair-initialization',
    '--init-status',
  ], { encoding: 'utf8' });
  assert.equal(repaired.status, 0, repaired.stderr);
  assert.ok(fs.readFileSync(missingPacket).equals(expectedPacket));
  assert.equal(JSON.parse(fs.readFileSync(path.join(repairable.runDir, 'status.json'), 'utf8')).state, 'planned');
  assert.equal(fs.existsSync(path.join(repairable.runDir, 'initialization-in-progress.json')), false);
  assert.equal(readLease(repairable.leasePath).run_id, 'repair-initialization');
  releaseLease(repairable.leasePath, 'repair-initialization', repairable.input.input_sha256);

  const started = createStandardPlannedRun('feedback-partial-started-');
  const startedStatus = path.join(started.runDir, 'status.json');
  fs.unlinkSync(startedStatus);
  fs.writeFileSync(path.join(started.runDir, 'initialization-in-progress.json'),
    `${JSON.stringify(markerFor(started), null, 2)}\n`);
  const eventsDir = path.join(started.artifactRoot, 'pipeline', 'events');
  const startedEventDir = path.join(eventsDir, 'feedback-started');
  fs.mkdirSync(startedEventDir, { recursive: true });
  fs.writeFileSync(path.join(startedEventDir, 'event.json'), `${JSON.stringify({
    event_id: 'feedback-started',
    type: 'feedback_run_started',
    feedback_request: {
      feedback_request_id: started.input.metadata.feedback_id,
      input_sha256: started.input.input_sha256,
    },
  }, null, 2)}\n`);
  const refused = spawnSync(process.execPath, [
    plannerPath, started.runDir,
    '--repository-head', 'non-git:test',
    '--latest-domain-events', latestEventsFor(started),
    '--lease', started.leasePath,
    '--run-id', 'refuse-repair-after-start',
  ], { encoding: 'utf8' });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /cannot be repaired after feedback execution evidence/);
  assert.equal(fs.existsSync(startedStatus), false);
  assert.equal(fs.existsSync(started.leasePath), false);

  const corruptStatus = createStandardPlannedRun('feedback-partial-corrupt-status-');
  const corruptStatusPath = path.join(corruptStatus.runDir, 'status.json');
  const corrupt = JSON.parse(fs.readFileSync(corruptStatusPath, 'utf8'));
  corrupt.stages[0].id = 'spec';
  fs.writeFileSync(corruptStatusPath, `${JSON.stringify(corrupt, null, 2)}\n`);
  const corruptMarkerPath = path.join(corruptStatus.runDir, 'initialization-in-progress.json');
  fs.writeFileSync(corruptMarkerPath, `${JSON.stringify(markerFor(corruptStatus), null, 2)}\n`);
  const corruptResume = spawnSync(process.execPath, [
    plannerPath, corruptStatus.runDir,
    '--repository-head', 'non-git:test',
    '--latest-domain-events', latestEventsFor(corruptStatus),
    '--lease', corruptStatus.leasePath,
    '--run-id', 'corrupt-partial-status',
  ], { encoding: 'utf8' });
  assert.equal(corruptResume.status, 1);
  assert.match(corruptResume.stderr, /status.json stage does not match frozen plan/);
  assert.equal(fs.existsSync(corruptMarkerPath), true);
  assert.equal(fs.existsSync(corruptStatus.leasePath), false);

  const staleBasis = createStandardPlannedRun('feedback-partial-stale-basis-');
  const staleMarkerPath = path.join(staleBasis.runDir, 'initialization-in-progress.json');
  fs.writeFileSync(staleMarkerPath, `${JSON.stringify(markerFor(staleBasis), null, 2)}\n`);
  fs.unlinkSync(path.join(staleBasis.runDir, 'stage-packets', 'spec.md'));
  const staleResume = spawnSync(process.execPath, [
    plannerPath, staleBasis.runDir,
    '--repository-head', 'non-git:changed-head',
    '--model-id', 'changed-model',
    '--lease', staleBasis.leasePath,
    '--run-id', 'stale-partial-basis',
  ], { encoding: 'utf8' });
  assert.equal(staleResume.status, 1);
  assert.match(staleResume.stderr, /routing basis changed/);
  assert.equal(fs.existsSync(staleMarkerPath), true);
  assert.equal(fs.existsSync(staleBasis.leasePath), false);
});

function writeSuccessfulStageEvent(plan, stage, eventsDir, artifactRoot, eventId = `evt-${stage.id}`) {
  const eventDir = path.join(eventsDir, eventId);
  fs.mkdirSync(eventDir, { recursive: true });
  const catalog = loadCatalog().value;
  const catalogStage = catalog.stages.find(item => item.id === stage.id);
  const unitById = new Map(plan.work_units.map(item => [item.id, item]));
  const requestIds = [...new Set(stage.causal_work_unit_ids.map(id => unitById.get(id).request_id))];
  const createdAt = `2026-07-30T03:${String(catalogStage.order).padStart(2, '0')}:00Z`;
  const feedbackRequest = {
    feedback_request_id: plan.feedback_request_id,
    input_sha256: plan.input_sha256,
    request_ids: requestIds,
    work_unit_ids: stage.causal_work_unit_ids,
  };
  const requirementsDomainEventId = `20260730_03${String(catalogStage.order).padStart(2, '0')}00_requirements`;
  const domainEventRefs = [];
  const normalMemberPaths = [];
  for (const domainRoot of catalogStage.domain_event_roots) {
    const domainEventId = stage.id === 'requirements' ? requirementsDomainEventId : eventId;
    const domainEventDirectory = path.join(artifactRoot, domainRoot, domainEventId);
    fs.mkdirSync(domainEventDirectory, { recursive: true });
    let domainEventRelativePath;
    if (domainRoot === 'rdra/events') {
      const memberRelativePath = path.posix.join(domainRoot, domainEventId, 'requirements.tsv');
      const memberPath = path.join(artifactRoot, memberRelativePath);
      fs.writeFileSync(memberPath, 'id\tstatement\nREQ-TEST\tverified\n');
      domainEventRelativePath = path.posix.join(domainRoot, domainEventId, 'event.json');
      const domainEventPath = path.join(artifactRoot, domainEventRelativePath);
      fs.writeFileSync(domainEventPath, `${JSON.stringify({
        schema_version: 'distillery.rdra-feedback-event/v1',
        event_id: domainEventId,
        created_at: createdAt,
        stage: 'requirements',
        feedback_request: feedbackRequest,
        members: [{
          path: memberRelativePath,
          sha256: sha256Bytes(fs.readFileSync(memberPath)),
        }],
      }, null, 2)}\n`);
      normalMemberPaths.push(memberRelativePath);
    } else if (domainRoot === 'usdm/events' && stage.id === 'requirements') {
      domainEventRelativePath = path.posix.join(domainRoot, domainEventId, 'requirements.yaml');
      const domainEventPath = path.join(artifactRoot, domainEventRelativePath);
      fs.writeFileSync(domainEventPath, [
        'version: "1.0"',
        `event_id: "${domainEventId}"`,
        `created_at: "2026-07-30T03:${String(catalogStage.order).padStart(2, '0')}:00"`,
        'source: "feedback request"',
        'system_name: "Test system"',
        'feedback_request:',
        `  feedback_request_id: ${JSON.stringify(plan.feedback_request_id)}`,
        `  input_sha256: ${JSON.stringify(plan.input_sha256)}`,
        `  request_ids: ${JSON.stringify(requestIds)}`,
        `  work_unit_ids: ${JSON.stringify(stage.causal_work_unit_ids)}`,
        'requirements:',
        '  - id: "REQ-001"',
        '    requirement: "Apply the verified feedback"',
        '    reason: "The accepted owner work requires this change"',
        '    priority: "must"',
        '    feedback_source:',
        `      feedback_request_id: ${JSON.stringify(plan.feedback_request_id)}`,
        '      work_unit_ids:',
        ...stage.direct_work_unit_ids.map(id => `        - ${JSON.stringify(id)}`),
        '    specifications:',
        '      - id: "SPEC-001-01"',
        '        specification: "Persist the verified feedback lineage"',
        '        acceptance_criteria:',
        '          - "The owner ledger and output lineage agree"',
        '        affected_models:',
        '          - type: "business_policy"',
        '            action: "modify"',
        '            target: "Feedback policy"',
        '',
      ].join('\n'));
      normalMemberPaths.push(domainEventRelativePath);
    } else {
      domainEventRelativePath = path.posix.join(domainRoot, domainEventId, `${stage.id}.json`);
      const domainEventPath = path.join(artifactRoot, domainEventRelativePath);
      fs.writeFileSync(domainEventPath, `${JSON.stringify({
        event_id: domainEventId,
        stage: stage.id,
        feedback_request: feedbackRequest,
      }, null, 2)}\n`);
      normalMemberPaths.push(domainEventRelativePath);
    }
    const domainEventPath = path.join(artifactRoot, domainEventRelativePath);
    domainEventRefs.push({
      path: domainEventRelativePath,
      sha256: sha256Bytes(fs.readFileSync(domainEventPath)),
    });
    const latestDirectory = path.join(artifactRoot, path.dirname(domainRoot), 'latest');
    fs.mkdirSync(latestDirectory, { recursive: true });
    if (domainRoot === 'usdm/events' && stage.id === 'requirements') {
      fs.copyFileSync(
        path.join(artifactRoot, domainEventRelativePath),
        path.join(latestDirectory, 'requirements.yaml'),
      );
    }
    fs.writeFileSync(path.join(latestDirectory, 'feedback-state.json'), `${JSON.stringify({
      event_id: domainEventId,
      stage: stage.id,
    }, null, 2)}\n`);
  }
  const primaryArtifactRef = normalMemberPaths.find(reference => !reference.startsWith('rdra/events/')) || normalMemberPaths[0];
  const workUnitResults = stage.direct_work_unit_ids.map(workUnitId => ({
    work_unit_id: workUnitId,
    disposition: 'applied',
    reason: 'applied by the owning stage',
    artifact_refs: [primaryArtifactRef],
  }));
  const directResultById = new Map(workUnitResults.map(item => [item.work_unit_id, item]));
  const reconciliationResults = stage.causal_work_unit_ids.map(workUnitId => {
    const directResult = directResultById.get(workUnitId);
    return {
      work_unit_id: workUnitId,
      status: 'changed',
      reason: directResult?.reason || 'changed by the closure-stage reconciliation',
      artifact_refs: directResult?.artifact_refs || [primaryArtifactRef],
    };
  });
  const workUnitEvidenceRefs = reconciliationResults.flatMap(item => item.artifact_refs.map(reference => ({
    work_unit_id: item.work_unit_id,
    path: reference,
    sha256: sha256Bytes(fs.readFileSync(path.join(artifactRoot, reference))),
  })));
  const domainEventRootSnapshots = snapshotDomainEventRoots(artifactRoot, catalog);
  fs.writeFileSync(path.join(eventDir, 'event.json'), `${JSON.stringify({
    event_id: eventId,
    type: 'feedback_stage_completed',
    run_id: 'feedback-execution-1',
    attempt: 1,
    created_at: createdAt,
    stage: stage.id,
    direct_work_unit_ids: stage.direct_work_unit_ids,
    causal_work_unit_ids: stage.causal_work_unit_ids,
    work_unit_results: workUnitResults,
    reconciliation_results: reconciliationResults,
    work_unit_evidence_refs: workUnitEvidenceRefs,
    domain_event_refs: domainEventRefs,
    feedback_request: feedbackRequest,
    post_execution_basis: {
      repository_head: plan.routing_basis.repository_head,
      latest_domain_event_ids: latestDomainEventIdsFromSnapshots(catalog, domainEventRootSnapshots),
      domain_event_root_snapshots: domainEventRootSnapshots,
    },
  }, null, 2)}\n`);
  return path.join(artifactRoot, primaryArtifactRef);
}

function writeStartedEvent(plan, eventsDir, runId = 'feedback-execution-1', attempt = 1, eventId = `evt-run-started-${attempt}`) {
  const eventDir = path.join(eventsDir, eventId);
  fs.mkdirSync(eventDir, { recursive: true });
  fs.writeFileSync(path.join(eventDir, 'event.json'), `${JSON.stringify({
    event_id: eventId,
    type: 'feedback_run_started',
    run_id: runId,
    attempt,
    feedback_request: {
      feedback_request_id: plan.feedback_request_id,
      input_sha256: plan.input_sha256,
      request_ids: plan.request_ids,
      work_unit_ids: plan.work_units.map(item => item.id),
    },
  }, null, 2)}\n`);
  return eventId;
}

test('nonterminal resume binds a recorded model_id after verified stage progress', () => {
  const workspace = createStandardPlannedRun('feedback-model-bound-resume-', {
    modelId: 'frozen-model',
  });
  const plannerPath = path.join(__dirname, '..', 'scripts', 'planFeedbackRequest.js');
  const eventsDir = path.join(workspace.artifactRoot, 'pipeline', 'events');
  const statusPath = path.join(workspace.runDir, 'status.json');
  const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  status.state = 'running';
  status.run_id = 'feedback-execution-1';
  status.attempt = 1;
  status.stages[0].state = 'completed';
  status.stages[0].event_ids = [`evt-${workspace.plan.execution_stages[0].id}`];
  fs.writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`);
  writeStartedEvent(workspace.plan, eventsDir);
  writeSuccessfulStageEvent(
    workspace.plan,
    workspace.plan.execution_stages[0],
    eventsDir,
    workspace.artifactRoot,
  );

  for (const [runId, modelArgs] of [
    ['missing-model', []],
    ['changed-model', ['--model-id', 'different-model']],
  ]) {
    const rejected = spawnSync(process.execPath, [
      plannerPath, workspace.runDir,
      '--repository-head', 'non-git:test',
      ...modelArgs,
      '--lease', workspace.leasePath,
      '--run-id', runId,
    ], { encoding: 'utf8' });
    assert.equal(rejected.status, 1, rejected.stderr);
    assert.match(rejected.stderr, /static routing basis model_id changed/);
    assert.equal(fs.existsSync(workspace.leasePath), false);
  }

  const resumed = spawnSync(process.execPath, [
    plannerPath, workspace.runDir,
    '--repository-head', 'non-git:test',
    '--model-id', 'frozen-model',
    '--lease', workspace.leasePath,
    '--run-id', 'matching-model',
  ], { encoding: 'utf8' });
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.equal(JSON.parse(resumed.stdout).schema_version, 'distillery.feedback-plan/v1');
  releaseLease(workspace.leasePath, 'matching-model', workspace.input.input_sha256);
});

test('planner refuses to re-run a stage when its durable event is orphaned from status.json', () => {
  const workspace = createStandardPlannedRun('feedback-orphan-checkpoint-');
  const plan = JSON.parse(fs.readFileSync(path.join(workspace.runDir, 'plan.json'), 'utf8'));
  const statusPath = path.join(workspace.runDir, 'status.json');
  const eventsDir = path.join(workspace.artifactRoot, 'pipeline', 'events');
  const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  Object.assign(status, { state: 'running', run_id: 'feedback-execution-1', attempt: 1 });
  fs.writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`);
  const pristineStatus = fs.readFileSync(statusPath);
  writeStartedEvent(plan, eventsDir);
  const firstStage = plan.execution_stages[0];
  writeSuccessfulStageEvent(plan, firstStage, eventsDir, workspace.artifactRoot, 'evt-orphaned-stage');
  const latestEventsPath = path.join(workspace.root, 'latest-events.json');
  fs.writeFileSync(latestEventsPath, `${JSON.stringify(workspace.routing.routing_basis.latest_domain_event_ids, null, 2)}\n`);
  const plannerPath = path.join(__dirname, '..', 'scripts', 'planFeedbackRequest.js');

  const resumed = spawnSync(process.execPath, [
    plannerPath, workspace.runDir,
    '--repository-head', 'non-git:test',
    '--lease', workspace.leasePath,
    '--run-id', 'orphan-checkpoint-resume',
  ], { encoding: 'utf8' });
  assert.equal(resumed.status, 1);
  assert.match(resumed.stderr, /orphan checkpoint event evt-orphaned-stage.*not referenced by status\.json.*status reconciliation required/);
  assert.equal(resumed.stdout, '');
  assert.ok(fs.readFileSync(statusPath).equals(pristineStatus));
  assert.equal(fs.existsSync(workspace.leasePath), false);
});

test('planner treats one-sided feedback lineage matches as corrupt orphan checkpoints', () => {
  const plannerPath = path.join(__dirname, '..', 'scripts', 'planFeedbackRequest.js');
  for (const [name, mutate] of [
    ['matching-id-wrong-sha', event => { event.feedback_request.input_sha256 = '0'.repeat(64); }],
    ['wrong-id-matching-sha', event => { event.feedback_request.feedback_request_id = 'different_feedback_id'; }],
  ]) {
    const workspace = createStandardPlannedRun(`feedback-orphan-${name}-`);
    const plan = JSON.parse(fs.readFileSync(path.join(workspace.runDir, 'plan.json'), 'utf8'));
    const statusPath = path.join(workspace.runDir, 'status.json');
    const eventsDir = path.join(workspace.artifactRoot, 'pipeline', 'events');
    const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
    Object.assign(status, { state: 'running', run_id: 'feedback-execution-1', attempt: 1 });
    fs.writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`);
    const pristineStatus = fs.readFileSync(statusPath);
    writeStartedEvent(plan, eventsDir);
    const eventId = `evt-${name}`;
    writeSuccessfulStageEvent(plan, plan.execution_stages[0], eventsDir, workspace.artifactRoot, eventId);
    const eventPath = path.join(eventsDir, eventId, 'event.json');
    const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
    mutate(event);
    fs.writeFileSync(eventPath, `${JSON.stringify(event, null, 2)}\n`);
    const latestEventsPath = path.join(workspace.root, 'latest-events.json');
    fs.writeFileSync(latestEventsPath, `${JSON.stringify(workspace.routing.routing_basis.latest_domain_event_ids, null, 2)}\n`);

    const resumed = spawnSync(process.execPath, [
      plannerPath, workspace.runDir,
      '--repository-head', 'non-git:test',
      '--lease', workspace.leasePath,
      '--run-id', `resume-${name}`,
    ], { encoding: 'utf8' });
    assert.equal(resumed.status, 1, `${name}: ${resumed.stderr}`);
    assert.match(resumed.stderr, /controller event .*partial feedback lineage match.*reconciliation required/, name);
    assert.equal(resumed.stdout, '', name);
    assert.ok(fs.readFileSync(statusPath).equals(pristineStatus), name);
    assert.equal(fs.existsSync(workspace.leasePath), false, name);
  }
});

test('planner fails closed across start, running-stage, result, and terminal checkpoint gaps', () => {
  const plannerPath = path.join(__dirname, '..', 'scripts', 'planFeedbackRequest.js');
  const resume = (workspace, runId) => spawnSync(process.execPath, [
    plannerPath, workspace.runDir,
    '--repository-head', 'non-git:test',
    '--lease', workspace.leasePath,
    '--run-id', runId,
  ], { encoding: 'utf8' });

  const startedOnly = createStandardPlannedRun('feedback-start-status-gap-');
  const startedPlan = JSON.parse(fs.readFileSync(path.join(startedOnly.runDir, 'plan.json'), 'utf8'));
  const startedStatusPath = path.join(startedOnly.runDir, 'status.json');
  const startedStatusBytes = fs.readFileSync(startedStatusPath);
  writeStartedEvent(startedPlan, path.join(startedOnly.artifactRoot, 'pipeline', 'events'));
  const startedResume = resume(startedOnly, 'resume-start-gap');
  assert.equal(startedResume.status, 1);
  assert.match(startedResume.stderr, /feedback_run_started is not reflected by planned status.*start\/status reconciliation required/);
  assert.equal(startedResume.stdout, '');
  assert.ok(fs.readFileSync(startedStatusPath).equals(startedStatusBytes));
  assert.equal(fs.existsSync(startedOnly.leasePath), false);

  const running = createStandardPlannedRun('feedback-running-intent-gap-');
  const runningPlan = JSON.parse(fs.readFileSync(path.join(running.runDir, 'plan.json'), 'utf8'));
  const runningStatusPath = path.join(running.runDir, 'status.json');
  const runningStatus = JSON.parse(fs.readFileSync(runningStatusPath, 'utf8'));
  Object.assign(runningStatus, { state: 'running', run_id: 'feedback-execution-1', attempt: 1 });
  runningStatus.stages[0].state = 'running';
  fs.writeFileSync(runningStatusPath, `${JSON.stringify(runningStatus, null, 2)}\n`);
  const runningStatusBytes = fs.readFileSync(runningStatusPath);
  writeStartedEvent(runningPlan, path.join(running.artifactRoot, 'pipeline', 'events'));
  const runningResume = resume(running, 'resume-running-gap');
  assert.equal(runningResume.status, 1);
  assert.match(runningResume.stderr, /running stage outcome is indeterminate.*reconciliation required/);
  assert.equal(runningResume.stdout, '');
  assert.ok(fs.readFileSync(runningStatusPath).equals(runningStatusBytes));
  assert.equal(fs.existsSync(running.leasePath), false);

  for (const evidence of ['result-only', 'terminal-only', 'result-and-terminal']) {
    const workspace = createStandardPlannedRun(`feedback-${evidence}-gap-`);
    const plan = JSON.parse(fs.readFileSync(path.join(workspace.runDir, 'plan.json'), 'utf8'));
    const statusPath = path.join(workspace.runDir, 'status.json');
    const statusBytes = fs.readFileSync(statusPath);
    const result = resultFor(plan);
    if (evidence !== 'terminal-only') {
      fs.writeFileSync(path.join(workspace.runDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
    }
    if (evidence !== 'result-only') {
      const eventsDir = path.join(workspace.artifactRoot, 'pipeline', 'events');
      writeStartedEvent(plan, eventsDir, result.run_id, result.attempt);
      const terminalDir = path.join(eventsDir, result.terminal_event_id);
      fs.mkdirSync(terminalDir, { recursive: true });
      fs.writeFileSync(path.join(terminalDir, 'event.json'), `${JSON.stringify({
        event_id: result.terminal_event_id,
        type: 'feedback_run_completed',
        run_id: result.run_id,
        attempt: result.attempt,
        result_sha256: evidence === 'terminal-only' ? '0'.repeat(64) : sha256Bytes(fs.readFileSync(path.join(workspace.runDir, 'result.json'))),
        feedback_request: {
          feedback_request_id: plan.feedback_request_id,
          input_sha256: plan.input_sha256,
          request_ids: plan.request_ids,
          work_unit_ids: plan.work_units.map(item => item.id),
        },
        work_unit_dispositions: result.work_units.map(item => ({ work_unit_id: item.work_unit_id, disposition: item.disposition })),
      }, null, 2)}\n`);
    }
    const resumed = resume(workspace, `resume-${evidence}`);
    assert.equal(resumed.status, 1, `${evidence}: ${resumed.stderr}`);
    assert.match(resumed.stderr, /terminal reconciliation required/, evidence);
    assert.equal(resumed.stdout, '', evidence);
    assert.ok(fs.readFileSync(statusPath).equals(statusBytes), evidence);
    assert.equal(fs.existsSync(workspace.leasePath), false, evidence);
  }
});

test('planner detects exact, partial, and malformed domain checkpoints without controller references', () => {
  const plannerPath = path.join(__dirname, '..', 'scripts', 'planFeedbackRequest.js');
  for (const kind of ['exact', 'exact-yaml', 'partial', 'malformed']) {
    const workspace = createStandardPlannedRun(`feedback-domain-orphan-${kind}-`);
    const plan = JSON.parse(fs.readFileSync(path.join(workspace.runDir, 'plan.json'), 'utf8'));
    const statusPath = path.join(workspace.runDir, 'status.json');
    const statusBytes = fs.readFileSync(statusPath);
    const domainDir = path.join(workspace.artifactRoot, 'usdm', 'events', `orphan-${kind}`);
    const domainPath = path.join(domainDir, kind === 'exact-yaml' ? 'requirements.yaml' : 'requirements.json');
    fs.mkdirSync(domainDir, { recursive: true });
    if (kind === 'malformed') {
      fs.writeFileSync(domainPath, `{"feedback_request_id":${JSON.stringify(plan.feedback_request_id)}`);
    } else if (kind === 'exact-yaml') {
      fs.writeFileSync(domainPath, [
        'event_id: "domain-orphan-exact-yaml"',
        'feedback_request:',
        `  feedback_request_id: ${JSON.stringify(plan.feedback_request_id)}`,
        `  input_sha256: ${JSON.stringify(plan.input_sha256)}`,
        `  request_ids: ${JSON.stringify([plan.request_ids[0]])}`,
        `  work_unit_ids: ${JSON.stringify([plan.work_units[0].id])}`,
        '',
      ].join('\n'));
    } else {
      fs.writeFileSync(domainPath, `${JSON.stringify({
        event_id: `domain-orphan-${kind}`,
        feedback_request: {
          feedback_request_id: plan.feedback_request_id,
          input_sha256: kind === 'partial' ? '0'.repeat(64) : plan.input_sha256,
          request_ids: [plan.request_ids[0]],
          work_unit_ids: [plan.work_units[0].id],
        },
      }, null, 2)}\n`);
    }
    const resumed = spawnSync(process.execPath, [
      plannerPath, workspace.runDir,
      '--repository-head', 'non-git:test',
      '--lease', workspace.leasePath,
      '--run-id', `resume-domain-${kind}`,
    ], { encoding: 'utf8' });
    assert.equal(resumed.status, 1, `${kind}: ${resumed.stderr}`);
    assert.match(resumed.stderr, /domain checkpoint .*reconciliation required|domain checkpoint contains current feedback identity but has an invalid envelope/, kind);
    assert.equal(resumed.stdout, '', kind);
    assert.ok(fs.readFileSync(statusPath).equals(statusBytes), kind);
    assert.equal(fs.existsSync(workspace.leasePath), false, kind);
  }

  const buffer = fixtureBuffer();
  const input = parseFeedbackRequest(buffer);
  const options = routingOptions();
  const specOnlyProposal = resolvedProposal(input);
  specOnlyProposal.requests[0].work_units = [unit('spec', 'spec-only-first')];
  specOnlyProposal.requests[1].work_units = [unit('spec', 'spec-only-second')];
  const routing = buildRouting(input, specOnlyProposal, 'interactive', options);
  const plan = buildPlan(input, routing, options);
  assert.deepEqual(plan.execution_stages.map(stage => stage.id), ['spec', 'spec_stories']);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-domain-unplanned-root-'));
  const artifactRoot = path.join(root, 'artifacts');
  const runRoot = path.join(artifactRoot, 'pipeline', 'feedback-runs');
  const runDir = path.join(runRoot, input.metadata.feedback_id);
  fs.mkdirSync(runRoot, { recursive: true });
  initializeRun(buffer, input, routing, plan, runDir, {
    initStatus: true, effectiveRouting: routing, catalogBundle: options.catalogBundle,
    policyBundle: options.policyBundle, runRoot,
  });
  const rogueDir = path.join(artifactRoot, 'arch', 'events', 'rogue-unplanned-stage');
  fs.mkdirSync(rogueDir, { recursive: true });
  fs.writeFileSync(path.join(rogueDir, 'arch.json'), `${JSON.stringify({
    feedback_request: {
      feedback_request_id: plan.feedback_request_id,
      input_sha256: plan.input_sha256,
      request_ids: [plan.request_ids[0]],
      work_unit_ids: [plan.work_units[0].id],
    },
  }, null, 2)}\n`);
  const latestPath = path.join(root, 'latest.json');
  fs.writeFileSync(latestPath, `${JSON.stringify(routing.routing_basis.latest_domain_event_ids, null, 2)}\n`);
  const leasePath = path.join(artifactRoot, 'pipeline', 'run-lease.json');
  const rogueResume = spawnSync(process.execPath, [
    plannerPath, runDir, '--repository-head', 'non-git:test',
    '--lease', leasePath, '--run-id', 'resume-unplanned-domain-root',
  ], { encoding: 'utf8' });
  assert.equal(rogueResume.status, 1);
  assert.match(rogueResume.stderr, /domain checkpoint is not referenced.*domain reconciliation required/);
  assert.equal(fs.existsSync(leasePath), false);
});

function writeTerminalResultEvidence(plan, runDir, eventsDir, artifactRoot) {
  fs.mkdirSync(path.join(artifactRoot, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(artifactRoot, 'docs', 'verified-artifact.md'), 'verified\n');
  const result = resultFor(plan);
  const startedPath = path.join(eventsDir, 'evt-run-started-1', 'event.json');
  if (!fs.existsSync(startedPath)) writeStartedEvent(plan, eventsDir, result.run_id, result.attempt);
  const resultPath = path.join(runDir, 'result.json');
  fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  const terminalDir = path.join(eventsDir, result.terminal_event_id);
  fs.mkdirSync(terminalDir, { recursive: true });
  fs.writeFileSync(path.join(terminalDir, 'event.json'), `${JSON.stringify({
    event_id: result.terminal_event_id,
    type: result.status === 'completed' ? 'feedback_run_completed' : 'feedback_run_aborted',
    run_id: result.run_id,
    attempt: result.attempt,
    result_sha256: sha256Bytes(fs.readFileSync(resultPath)),
    feedback_request: {
      feedback_request_id: plan.feedback_request_id,
      input_sha256: plan.input_sha256,
      work_unit_ids: plan.work_units.map(item => item.id),
      request_ids: plan.request_ids,
    },
    work_unit_dispositions: result.work_units.map(item => ({ work_unit_id: item.work_unit_id, disposition: item.disposition })),
  }, null, 2)}\n`);
  return result;
}

test('planner CLI separates pre-plan and execution-checkpoint basis validation and terminal resume is a lease-releasing no-op', () => {
  const input = document();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-cli-transaction-'));
  const artifactRoot = path.join(root, 'artifacts');
  fs.mkdirSync(artifactRoot);
  const runDir = path.join(artifactRoot, 'pipeline', 'feedback-runs', input.metadata.feedback_id);
  const leasePath = path.join(artifactRoot, 'pipeline', 'run-lease.json');
  const proposalPath = path.join(root, 'proposal.json');
  const plannerPath = path.join(__dirname, '..', 'scripts', 'planFeedbackRequest.js');
  fs.writeFileSync(proposalPath, `${JSON.stringify(recommendableProposal(input), null, 2)}\n`);

  const first = spawnSync(process.execPath, [
    plannerPath, fixturePath,
    '--routing', proposalPath,
    '--policy', 'recommended_auto',
    '--repository-head', 'non-git:test',
    '--write', runDir,
    '--init-status',
    '--lease', leasePath,
    '--run-id', 'feedback-cli-first',
    '--started-head', 'non-git:test',
  ], { encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr);
  assert.equal(JSON.parse(first.stdout).state, 'awaiting_resolution');
  assert.equal(fs.existsSync(leasePath), false);
  assert.ok(fs.readFileSync(path.join(runDir, 'input.md')).equals(fixtureBuffer()));

  const frozen = JSON.parse(fs.readFileSync(path.join(runDir, 'routing.json'), 'utf8'));
  const resolutionPath = path.join(runDir, 'resolutions.json');
  fs.writeFileSync(resolutionPath, `${JSON.stringify({
    schema_version: 'distillery.feedback-resolutions/v1',
    feedback_request_id: input.metadata.feedback_id,
    input_sha256: input.input_sha256,
    routing_basis: frozen.routing_basis,
    answers: [{
      request_id: input.requests[0].request_id,
      selected_option_id: 'change-business-rule',
      answered_by: 'human',
      answered_at: '2026-07-30T12:30:00+09:00',
    }],
  }, null, 2)}\n`);
  const changedBeforePlan = spawnSync(process.execPath, [
    plannerPath, runDir,
    '--policy', 'recommended_auto',
    '--resolution', resolutionPath,
    '--repository-head', 'non-git:changed-before-plan',
    '--lease', leasePath,
    '--run-id', 'feedback-cli-stale-answer',
    '--started-head', 'non-git:changed-before-plan',
  ], { encoding: 'utf8' });
  assert.equal(changedBeforePlan.status, 1);
  assert.match(changedBeforePlan.stderr, /routing basis changed/);
  assert.equal(fs.existsSync(leasePath), false);

  const resumed = spawnSync(process.execPath, [
    plannerPath, runDir,
    '--policy', 'recommended_auto',
    '--resolution', resolutionPath,
    '--repository-head', 'non-git:test',
    '--init-status',
    '--lease', leasePath,
    '--run-id', 'feedback-cli-resume',
    '--started-head', 'non-git:test',
  ], { encoding: 'utf8' });
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.equal(JSON.parse(resumed.stdout).schema_version, 'distillery.feedback-plan/v1');
  assert.equal(readLease(leasePath).run_id, 'feedback-cli-resume');
  assert.equal(JSON.parse(fs.readFileSync(path.join(runDir, 'status.json'), 'utf8')).state, 'planned');
  releaseLease(leasePath, 'feedback-cli-resume', input.input_sha256);

  const changedWhilePlanned = spawnSync(process.execPath, [
    plannerPath, runDir,
    '--repository-head', 'non-git:changed-while-still-planned',
    '--lease', leasePath,
    '--run-id', 'feedback-cli-planned-drift',
    '--started-head', 'non-git:changed-while-still-planned',
  ], { encoding: 'utf8' });
  assert.equal(changedWhilePlanned.status, 1);
  assert.match(changedWhilePlanned.stderr, /routing basis changed/);
  assert.equal(fs.existsSync(leasePath), false);

  const statusPath = path.join(runDir, 'status.json');
  const frozenPlan = JSON.parse(fs.readFileSync(path.join(runDir, 'plan.json'), 'utf8'));
  const eventsDir = path.join(artifactRoot, 'pipeline', 'events');
  for (const overallState of ['running', 'aborted']) {
    const fakeOverall = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
    fakeOverall.state = overallState;
    fs.writeFileSync(statusPath, `${JSON.stringify(fakeOverall, null, 2)}\n`);
    const bypass = spawnSync(process.execPath, [
      plannerPath, runDir,
      '--repository-head', `non-git:changed-${overallState}-without-progress`,
      '--model-id', 'changed-model',
      '--events-dir', eventsDir,
      '--artifact-root', artifactRoot,
      '--lease', leasePath,
      '--run-id', `feedback-cli-fake-${overallState}`,
    ], { encoding: 'utf8' });
    assert.equal(bypass.status, 1);
    assert.match(bypass.stderr, /execution identity|feedback_run_started|routing basis changed/);
    assert.equal(fs.existsSync(leasePath), false);
  }

  const runningStatus = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  runningStatus.state = 'running';
  runningStatus.run_id = 'feedback-execution-1';
  runningStatus.attempt = 1;
  runningStatus.stages[0].state = 'completed';
  runningStatus.stages[0].event_ids = ['evt-requirements'];
  fs.writeFileSync(statusPath, `${JSON.stringify(runningStatus, null, 2)}\n`);
  writeStartedEvent(frozenPlan, eventsDir);
  const fakeCheckpoint = spawnSync(process.execPath, [
    plannerPath, runDir,
    '--repository-head', 'non-git:changed-after-fake-execution',
    '--model-id', 'changed-model',
    '--events-dir', eventsDir,
    '--artifact-root', artifactRoot,
    '--lease', leasePath,
    '--run-id', 'feedback-cli-fake-checkpoint',
  ], { encoding: 'utf8' });
  assert.equal(fakeCheckpoint.status, 1);
  assert.match(fakeCheckpoint.stderr, /pipeline\/events|stage event does not exist/);
  assert.equal(fs.existsSync(leasePath), false);

  writeSuccessfulStageEvent(frozenPlan, frozenPlan.execution_stages[0], eventsDir, artifactRoot);
  const checkpointResume = spawnSync(process.execPath, [
    plannerPath, runDir,
    '--repository-head', 'non-git:test',
    '--model-id', 'changed-model',
    '--events-dir', eventsDir,
    '--artifact-root', artifactRoot,
    '--lease', leasePath,
    '--run-id', 'feedback-cli-checkpoint',
    '--started-head', 'non-git:test',
  ], { encoding: 'utf8' });
  assert.equal(checkpointResume.status, 0, checkpointResume.stderr);
  assert.equal(JSON.parse(checkpointResume.stdout).schema_version, 'distillery.feedback-plan/v1');
  assert.equal(readLease(leasePath).run_id, 'feedback-cli-checkpoint');
  releaseLease(leasePath, 'feedback-cli-checkpoint', input.input_sha256);

  const completedStatus = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  completedStatus.state = 'completed';
  completedStatus.run_id = 'feedback-execution-1';
  completedStatus.attempt = 1;
  completedStatus.stages.forEach(stage => {
    stage.state = 'completed';
    stage.event_ids = [`evt-${stage.id}`];
  });
  fs.writeFileSync(statusPath, `${JSON.stringify(completedStatus, null, 2)}\n`);
  const domainPaths = frozenPlan.execution_stages.map(stage =>
    writeSuccessfulStageEvent(frozenPlan, stage, eventsDir, artifactRoot));
  const missingResult = spawnSync(process.execPath, [
    plannerPath, runDir,
    '--repository-head', 'non-git:test',
    '--model-id', 'another-model',
    '--events-dir', eventsDir,
    '--artifact-root', artifactRoot,
    '--lease', leasePath,
    '--run-id', 'feedback-cli-terminal-missing-result',
  ], { encoding: 'utf8' });
  assert.equal(missingResult.status, 1);
  assert.match(missingResult.stderr, /terminal run validation failed/);
  assert.equal(fs.existsSync(leasePath), false);

  writeTerminalResultEvidence(frozenPlan, runDir, eventsDir, artifactRoot);
  const terminalWithoutLease = spawnSync(process.execPath, [
    plannerPath, runDir,
    '--repository-head', 'non-git:another-head-after-completion',
    '--events-dir', eventsDir,
    '--artifact-root', artifactRoot,
  ], { encoding: 'utf8' });
  assert.equal(terminalWithoutLease.status, 1);
  assert.match(terminalWithoutLease.stderr, /require --lease plus --run-id/);
  const terminalResume = spawnSync(process.execPath, [
    plannerPath, runDir,
    '--repository-head', 'non-git:another-head-after-completion',
    '--model-id', 'another-model',
    '--events-dir', eventsDir,
    '--artifact-root', artifactRoot,
    '--lease', leasePath,
    '--run-id', 'feedback-cli-terminal-noop',
    '--started-head', 'non-git:another-head-after-completion',
  ], { encoding: 'utf8' });
  assert.equal(terminalResume.status, 0, terminalResume.stderr);
  const noOp = JSON.parse(terminalResume.stdout);
  assert.equal(noOp.schema_version, 'distillery.feedback-resume-result/v1');
  assert.equal(noOp.action, 'no_op');
  assert.equal(noOp.terminal_state, 'completed');
  assert.equal(noOp.lease_released, true);
  assert.equal(fs.existsSync(leasePath), false);

  const latestRequirementsPath = path.join(artifactRoot, 'usdm', 'latest', 'requirements.yaml');
  const latestRequirementsBytes = fs.readFileSync(latestRequirementsPath);
  fs.writeFileSync(latestRequirementsPath, latestRequirementsBytes.toString('utf8').replace(
    'system_name: "Test system"',
    'system_name: "Tampered test system"',
  ));
  const sameSetLatestDrift = spawnSync(process.execPath, [
    plannerPath, runDir,
    '--repository-head', 'non-git:head-after-latest-drift',
    '--events-dir', eventsDir,
    '--artifact-root', artifactRoot,
    '--lease', leasePath,
    '--run-id', 'feedback-cli-terminal-latest-drift',
  ], { encoding: 'utf8' });
  assert.equal(sameSetLatestDrift.status, 1);
  assert.match(sameSetLatestDrift.stderr, /observed domain root changed without an appended event directory: usdm\/events/);
  assert.equal(fs.existsSync(leasePath), false);
  fs.writeFileSync(latestRequirementsPath, latestRequirementsBytes);

  fs.appendFileSync(domainPaths[0], 'tampered\n');
  const tamperedTerminal = spawnSync(process.execPath, [
    plannerPath, runDir,
    '--repository-head', 'non-git:head-after-terminal-tamper',
    '--model-id', 'another-model',
    '--events-dir', eventsDir,
    '--artifact-root', artifactRoot,
    '--lease', leasePath,
    '--run-id', 'feedback-cli-terminal-tampered',
  ], { encoding: 'utf8' });
  assert.equal(tamperedTerminal.status, 1);
  assert.match(tamperedTerminal.stderr, /domain_event_ref sha256 mismatch|domain checkpoint contains current feedback identity but has an invalid envelope/);
  assert.equal(fs.existsSync(leasePath), false);

  const badProposalPath = path.join(root, 'bad-proposal.json');
  fs.writeFileSync(badProposalPath, `${JSON.stringify({ ...resolvedProposal(input), input_sha256: '0'.repeat(64) }, null, 2)}\n`);
  const badArtifactRoot = path.join(root, 'bad-artifacts');
  fs.mkdirSync(badArtifactRoot);
  const badLeasePath = path.join(badArtifactRoot, 'pipeline', 'run-lease.json');
  const badRunDir = path.join(badArtifactRoot, 'pipeline', 'feedback-runs', input.metadata.feedback_id);
  const rejected = spawnSync(process.execPath, [
    plannerPath, fixturePath,
    '--routing', badProposalPath,
    '--policy', 'interactive',
    '--write', badRunDir,
    '--lease', badLeasePath,
    '--run-id', 'feedback-cli-rejected',
  ], { encoding: 'utf8' });
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /authoritative input Buffer/);
  assert.equal(fs.existsSync(badLeasePath), false);
  assert.equal(fs.existsSync(path.join(badArtifactRoot, 'pipeline')), false);

  const missingWriteLease = path.join(artifactRoot, 'pipeline', 'missing-write-lease.json');
  const missingWrite = spawnSync(process.execPath, [
    plannerPath, fixturePath,
    '--routing', proposalPath,
    '--policy', 'interactive',
    '--lease', missingWriteLease,
    '--run-id', 'feedback-cli-missing-write',
  ], { encoding: 'utf8' });
  assert.equal(missingWrite.status, 1);
  assert.match(missingWrite.stderr, /--lease requires --write or a run-directory input/);
  assert.equal(fs.existsSync(missingWriteLease), false);
});

test('planner CLI validates and no-ops a frozen no-plan blocked run without weakening its full basis', () => {
  const input = document();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-cli-blocked-no-plan-'));
  const artifactRoot = path.join(root, 'artifacts');
  fs.mkdirSync(artifactRoot);
  const runDir = path.join(artifactRoot, 'pipeline', 'feedback-runs', input.metadata.feedback_id);
  const leasePath = path.join(artifactRoot, 'pipeline', 'run-lease.json');
  const proposalPath = path.join(root, 'blocked-proposal.json');
  const plannerPath = path.join(__dirname, '..', 'scripts', 'planFeedbackRequest.js');
  fs.writeFileSync(proposalPath, `${JSON.stringify(blockedProposal(input), null, 2)}\n`);

  const initial = spawnSync(process.execPath, [
    plannerPath, fixturePath,
    '--routing', proposalPath,
    '--policy', 'interactive',
    '--repository-head', 'non-git:blocked-head',
    '--write', runDir,
    '--init-status',
    '--lease', leasePath,
    '--run-id', 'blocked-initial',
  ], { encoding: 'utf8' });
  assert.equal(initial.status, 0, initial.stderr);
  assert.equal(JSON.parse(initial.stdout).state, 'blocked');
  assert.equal(fs.existsSync(path.join(runDir, 'plan.json')), false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(runDir, 'status.json'), 'utf8')).state, 'blocked');
  assert.equal(fs.existsSync(leasePath), false);

  const changedBasis = spawnSync(process.execPath, [
    plannerPath, runDir,
    '--repository-head', 'non-git:changed-blocked-head',
    '--lease', leasePath,
    '--run-id', 'blocked-stale-resume',
  ], { encoding: 'utf8' });
  assert.equal(changedBasis.status, 1);
  assert.match(changedBasis.stderr, /routing basis changed/);
  assert.equal(fs.existsSync(leasePath), false);

  const noOpResume = spawnSync(process.execPath, [
    plannerPath, runDir,
    '--repository-head', 'non-git:blocked-head',
    '--lease', leasePath,
    '--run-id', 'blocked-noop-resume',
  ], { encoding: 'utf8' });
  assert.equal(noOpResume.status, 0, noOpResume.stderr);
  const noOp = JSON.parse(noOpResume.stdout);
  assert.equal(noOp.action, 'no_op');
  assert.equal(noOp.terminal_state, 'blocked');
  assert.equal(noOp.lease_released, true);
  assert.equal(fs.existsSync(leasePath), false);

  const runPath = path.join(runDir, 'run.json');
  const validRun = JSON.parse(fs.readFileSync(runPath, 'utf8'));
  const tamperedRun = structuredClone(validRun);
  tamperedRun.routing_basis.repository_head = 'tampered-run-head';
  fs.writeFileSync(runPath, `${JSON.stringify(tamperedRun, null, 2)}\n`);
  const runTamper = spawnSync(process.execPath, [
    plannerPath, runDir,
    '--repository-head', 'non-git:blocked-head',
    '--lease', leasePath,
    '--run-id', 'blocked-run-tamper',
  ], { encoding: 'utf8' });
  assert.equal(runTamper.status, 1);
  assert.match(runTamper.stderr, /run.json identity\/policy\/routing basis mismatch/);
  assert.equal(fs.existsSync(leasePath), false);
  fs.writeFileSync(runPath, `${JSON.stringify(validRun, null, 2)}\n`);

  const statusPath = path.join(runDir, 'status.json');
  const tamperedStatus = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  tamperedStatus.input_sha256 = '0'.repeat(64);
  fs.writeFileSync(statusPath, `${JSON.stringify(tamperedStatus, null, 2)}\n`);
  const tampered = spawnSync(process.execPath, [
    plannerPath, runDir,
    '--repository-head', 'non-git:blocked-head',
    '--lease', leasePath,
    '--run-id', 'blocked-tampered-resume',
  ], { encoding: 'utf8' });
  assert.equal(tampered.status, 1);
  assert.match(tampered.stderr, /no-plan status.json identity mismatch/);
  assert.equal(fs.existsSync(leasePath), false);
});

test('outside-only terminal blocked run no-ops after full result validation despite zero stage checkpoints', () => {
  const input = document();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-cli-outside-terminal-'));
  const artifactRoot = path.join(root, 'artifacts');
  fs.mkdirSync(artifactRoot);
  const runDir = path.join(artifactRoot, 'pipeline', 'feedback-runs', input.metadata.feedback_id);
  const leasePath = path.join(artifactRoot, 'pipeline', 'run-lease.json');
  const proposalPath = path.join(root, 'outside-proposal.json');
  const eventsDir = path.join(artifactRoot, 'pipeline', 'events');
  const plannerPath = path.join(__dirname, '..', 'scripts', 'planFeedbackRequest.js');
  fs.writeFileSync(proposalPath, `${JSON.stringify(outsideOnlyProposal(input), null, 2)}\n`);

  const initial = spawnSync(process.execPath, [
    plannerPath, fixturePath,
    '--routing', proposalPath,
    '--policy', 'interactive',
    '--repository-head', 'non-git:outside-initial-head',
    '--write', runDir,
    '--init-status',
    '--lease', leasePath,
    '--run-id', 'outside-initial',
  ], { encoding: 'utf8' });
  assert.equal(initial.status, 0, initial.stderr);
  const plan = JSON.parse(fs.readFileSync(path.join(runDir, 'plan.json'), 'utf8'));
  assert.deepEqual(plan.execution_stages, []);
  releaseLease(leasePath, 'outside-initial', input.input_sha256);

  const statusPath = path.join(runDir, 'status.json');
  const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  status.state = 'blocked';
  status.run_id = 'feedback-execution-1';
  status.attempt = 1;
  fs.writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`);
  writeTerminalResultEvidence(plan, runDir, eventsDir, artifactRoot);

  const resumed = spawnSync(process.execPath, [
    plannerPath, runDir,
    '--repository-head', 'non-git:outside-changed-after-terminal',
    '--model-id', 'outside-changed-model',
    '--events-dir', eventsDir,
    '--artifact-root', artifactRoot,
    '--lease', leasePath,
    '--run-id', 'outside-terminal-noop',
  ], { encoding: 'utf8' });
  assert.equal(resumed.status, 0, resumed.stderr);
  const noOp = JSON.parse(resumed.stdout);
  assert.equal(noOp.action, 'no_op');
  assert.equal(noOp.terminal_state, 'blocked');
  assert.equal(noOp.lease_released, true);
  assert.equal(fs.existsSync(leasePath), false);
});

function resultFor(plan, stageStates = {}) {
  const catalog = loadCatalog().value;
  const stages = plan.execution_stages.map(stage => ({
    stage_id: stage.id,
    state: stageStates[stage.id] || 'succeeded',
    event_ids: (stageStates[stage.id] || 'succeeded') === 'not_attempted' ? [] : [`evt-${stage.id}`],
    direct_work_unit_ids: stage.direct_work_unit_ids,
    causal_work_unit_ids: stage.causal_work_unit_ids,
  }));
  const workUnits = plan.work_units.map(unitValue => {
    if (unitValue.required_closure_stages.length === 0) {
      return {
        work_unit_id: unitValue.id,
        disposition: 'routed_outside',
        reason: 'Routed outside dist-pipeline by the frozen ownership decision.',
        artifact_refs: [`route:${unitValue.direct_stage}`],
      };
    }
    const artifactRefs = unitValue.required_closure_stages.map(stageId => {
      const closureStage = catalog.stages.find(stage => stage.id === stageId);
      const primaryRoot = closureStage.domain_event_roots.find(root => root !== 'rdra/events') || closureStage.domain_event_roots[0];
      const eventId = closureStage.id === 'requirements'
        ? `20260730_03${String(closureStage.order).padStart(2, '0')}00_requirements`
        : `evt-${closureStage.id}`;
      return primaryRoot === 'rdra/events'
        ? path.posix.join(primaryRoot, eventId, 'requirements.tsv')
        : path.posix.join(
          primaryRoot,
          eventId,
          closureStage.id === 'requirements' ? 'requirements.yaml' : `${closureStage.id}.json`,
        );
    });
    return {
      work_unit_id: unitValue.id,
      disposition: 'applied',
      reason: 'At least one required closure stage changed its domain artifacts.',
      artifact_refs: [...new Set(artifactRefs)],
    };
  });
  return {
    schema_version: 'distillery.feedback-result/v1',
    run_id: 'feedback-execution-1',
    attempt: 1,
    feedback_request_id: plan.feedback_request_id,
    input_sha256: plan.input_sha256,
    status: workUnits.every(item => ['applied', 'merged'].includes(item.disposition)) ? 'completed' : 'blocked',
    stages,
    work_units: workUnits,
    requests: plan.request_ids.map(requestId => {
      const children = workUnits.filter(item => plan.work_units.find(unitValue => unitValue.id === item.work_unit_id).request_id === requestId);
      const disposition = deriveRequestDisposition(children);
      return {
        request_id: requestId,
        work_unit_ids: children.map(item => item.work_unit_id),
        disposition,
        reason: requestReasonForDisposition(disposition),
      };
    }),
    terminal_event_id: 'terminal-event',
  };
}

test('result coverage distinguishes closure failure from deferred/rejected and attributes causality', () => {
  const input = document();
  const options = routingOptions();
  const plan = buildPlan(input, buildRouting(input, resolvedProposal(input), 'interactive', options), options);
  const valid = resultFor(plan);
  assert.deepEqual(validateResult(plan, valid), []);
  valid.work_units.pop();
  assert.ok(validateResult(plan, valid).some(error => error.includes('cover every planned work unit')));

  const failed = resultFor(plan, {
    architecture: 'failed', infrastructure: 'not_attempted', design_system: 'not_attempted', spec: 'not_attempted', spec_stories: 'not_attempted',
  });
  for (const unitResult of failed.work_units) {
    const planned = plan.work_units.find(item => item.id === unitResult.work_unit_id);
    Object.assign(unitResult, { disposition: 'execution_failed', artifact_refs: [], failure_stage: 'architecture', caused_by_event_id: 'evt-architecture' });
  }
  failed.status = 'blocked';
  failed.requests = plan.request_ids.map(requestId => {
    const children = failed.work_units.filter(item => plan.work_units.find(unitValue => unitValue.id === item.work_unit_id).request_id === requestId);
    const disposition = deriveRequestDisposition(children);
    return {
      request_id: requestId,
      work_unit_ids: children.map(item => item.work_unit_id),
      disposition,
      reason: requestReasonForDisposition(disposition),
    };
  });
  assert.deepEqual(validateResult(plan, failed), []);
  failed.work_units[0].disposition = 'applied';
  assert.ok(validateResult(plan, failed).some(error => error.includes('execution_failed')));
});

test('run verifier rebuilds plan and packets from input plus frozen routing and checks event/result lineage', () => {
  const buffer = fixtureBuffer();
  const input = parseFeedbackRequest(buffer);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-run-verify-'));
  const historicalPolicyPath = path.join(root, 'historical-routing-policy.json');
  const historicalPolicy = JSON.parse(fs.readFileSync(path.join(
    __dirname, '..', 'references', 'feedback-routing-policy.json',
  ), 'utf8'));
  historicalPolicy.policy_version = 'historical-1.1.0';
  fs.writeFileSync(historicalPolicyPath, `${JSON.stringify(historicalPolicy, null, 2)}\n`);
  const options = routingOptions({ policyBundle: loadPolicy(historicalPolicyPath) });
  const routing = buildRouting(input, resolvedProposal(input), 'interactive', options);
  const plan = buildPlan(input, routing, options);
  const artifactRoot = path.join(root, 'artifacts');
  fs.mkdirSync(artifactRoot);
  const runDir = path.join(artifactRoot, 'pipeline', 'feedback-runs', input.metadata.feedback_id);
  const eventsDir = path.join(artifactRoot, 'pipeline', 'events');
  fs.mkdirSync(path.join(artifactRoot, 'pipeline', 'feedback-runs'), { recursive: true });
  initializeRun(buffer, input, routing, plan, runDir, {
    initStatus: true,
    effectiveRouting: routing,
    catalogBundle: options.catalogBundle,
    policyBundle: options.policyBundle,
  });
  fs.mkdirSync(path.join(artifactRoot, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(artifactRoot, 'docs', 'verified-artifact.md'), 'verified\n');
  const result = resultFor(plan);
  fs.writeFileSync(path.join(runDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  writeStartedEvent(plan, eventsDir, result.run_id, result.attempt);
  for (const stage of plan.execution_stages) {
    writeSuccessfulStageEvent(plan, stage, eventsDir, artifactRoot);
  }
  const terminalDir = path.join(eventsDir, result.terminal_event_id);
  fs.mkdirSync(terminalDir, { recursive: true });
  fs.writeFileSync(path.join(terminalDir, 'event.json'), `${JSON.stringify({
    event_id: result.terminal_event_id,
    type: 'feedback_run_completed',
    run_id: result.run_id,
    attempt: result.attempt,
    result_sha256: sha256Bytes(fs.readFileSync(path.join(runDir, 'result.json'))),
    feedback_request: {
      feedback_request_id: plan.feedback_request_id,
      input_sha256: plan.input_sha256,
      work_unit_ids: plan.work_units.map(item => item.id),
      request_ids: plan.request_ids,
    },
    work_unit_dispositions: result.work_units.map(item => ({ work_unit_id: item.work_unit_id, disposition: item.disposition })),
  }, null, 2)}\n`);
  const statusPath = path.join(runDir, 'status.json');
  const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  status.state = 'completed';
  status.run_id = result.run_id;
  status.attempt = result.attempt;
  status.stages.forEach(stage => { stage.state = 'completed'; stage.event_ids = [`evt-${stage.id}`]; });
  fs.writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`);
  assert.deepEqual(validateRunDirectory(runDir, eventsDir, { artifactRoot }), []);

  const latestRequirementsPath = path.join(artifactRoot, 'usdm', 'latest', 'requirements.yaml');
  const latestRequirementsBytes = fs.readFileSync(latestRequirementsPath);
  const catalog = options.catalogBundle.value;
  const controllerStagePaths = plan.execution_stages.map(stage =>
    path.join(eventsDir, `evt-${stage.id}`, 'event.json'));
  const controllerStageBytes = new Map(controllerStagePaths.map(target => [target, fs.readFileSync(target)]));
  const requirementsDomainPath = result.work_units
    .flatMap(item => item.artifact_refs)
    .find(reference => reference.startsWith('usdm/events/') && reference.endsWith('/requirements.yaml'));
  assert.ok(requirementsDomainPath);
  const requirementsDomainTarget = path.join(artifactRoot, requirementsDomainPath);
  const requirementsDomainBytes = fs.readFileSync(requirementsDomainTarget);
  const requirementsControllerPath = path.join(eventsDir, 'evt-requirements', 'event.json');
  const restoreRequirementsProjectionFixture = () => {
    fs.writeFileSync(latestRequirementsPath, latestRequirementsBytes);
    fs.writeFileSync(requirementsDomainTarget, requirementsDomainBytes);
    for (const [target, bytes] of controllerStageBytes) fs.writeFileSync(target, bytes);
  };
  const bindObservedUsdmSnapshot = () => {
    const snapshots = snapshotDomainEventRoots(artifactRoot, catalog);
    for (const target of controllerStagePaths) {
      const event = JSON.parse(fs.readFileSync(target, 'utf8'));
      event.post_execution_basis.domain_event_root_snapshots['usdm/events'] = snapshots['usdm/events'];
      event.post_execution_basis.latest_domain_event_ids = latestDomainEventIdsFromSnapshots(
        catalog,
        event.post_execution_basis.domain_event_root_snapshots,
      );
      fs.writeFileSync(target, `${JSON.stringify(event, null, 2)}\n`);
    }
  };

  fs.writeFileSync(latestRequirementsPath, latestRequirementsBytes.toString('utf8').replace(
    'system_name: "Test system"',
    'system_name: "Smuggled system name"',
  ));
  bindObservedUsdmSnapshot();
  assert.ok(validateRunDirectory(runDir, eventsDir, { artifactRoot })
    .some(error => error.includes('system_name must exactly match the event document')));
  restoreRequirementsProjectionFixture();

  fs.writeFileSync(latestRequirementsPath, latestRequirementsBytes.toString('utf8').replace(
    'requirement: "Apply the verified feedback"',
    'requirement: "Smuggled divergent business change"',
  ));
  bindObservedUsdmSnapshot();
  assert.ok(validateRunDirectory(runDir, eventsDir, { artifactRoot })
    .some(error => error.includes('exactly preserve every event REQ subtree')));
  restoreRequirementsProjectionFixture();

  const unmarkedSubtree = [
    '  - id: "REQ-999"',
    '    requirement: "Smuggled unowned requirement"',
    '    reason: "This subtree has no current feedback lineage"',
    '    priority: "could"',
    '    specifications:',
    '      - id: "SPEC-999-01"',
    '        specification: "Smuggled unowned detail"',
    '        acceptance_criteria:',
    '          - "The unowned detail is present"',
    '        affected_models:',
    '          - type: "business_policy"',
    '            action: "modify"',
    '            target: "Unowned policy"',
    '',
  ].join('\n');
  const scopedRequirements = `${requirementsDomainBytes.toString('utf8').trimEnd()}\n${unmarkedSubtree}`;
  fs.writeFileSync(requirementsDomainTarget, scopedRequirements);
  fs.writeFileSync(latestRequirementsPath, scopedRequirements);
  const scopedSha256 = sha256Bytes(fs.readFileSync(requirementsDomainTarget));
  const requirementsController = JSON.parse(fs.readFileSync(requirementsControllerPath, 'utf8'));
  for (const reference of requirementsController.domain_event_refs) {
    if (reference.path === requirementsDomainPath) reference.sha256 = scopedSha256;
  }
  for (const reference of requirementsController.work_unit_evidence_refs) {
    if (reference.path === requirementsDomainPath) reference.sha256 = scopedSha256;
  }
  fs.writeFileSync(requirementsControllerPath, `${JSON.stringify(requirementsController, null, 2)}\n`);
  bindObservedUsdmSnapshot();
  assert.ok(validateRunDirectory(runDir, eventsDir, { artifactRoot })
    .some(error => error.includes('REQ subtree without current feedback lineage: REQ-999')));
  restoreRequirementsProjectionFixture();

  const changedLatestRequirements = latestRequirementsBytes.toString('utf8').replace(
    'system_name: "Test system"',
    'system_name: "Later test system"',
  );
  fs.writeFileSync(latestRequirementsPath, changedLatestRequirements);
  assert.ok(validateRunDirectory(runDir, eventsDir, { artifactRoot })
    .some(error => error.includes('observed domain root changed without an appended event directory: usdm/events')));
  fs.writeFileSync(latestRequirementsPath, latestRequirementsBytes);

  const laterUsdmEventDir = path.join(artifactRoot, 'usdm', 'events', 'zzzz-later-requirements-event');
  fs.mkdirSync(laterUsdmEventDir);
  fs.writeFileSync(path.join(laterUsdmEventDir, 'event.json'), '{\n  "event_id": "zzzz-later-requirements-event"\n}\n');
  fs.writeFileSync(latestRequirementsPath, changedLatestRequirements);
  assert.deepEqual(validateRunDirectory(runDir, eventsDir, { artifactRoot }), []);
  fs.writeFileSync(latestRequirementsPath, latestRequirementsBytes);

  const runPath = path.join(runDir, 'run.json');
  const runBytes = fs.readFileSync(runPath);
  const invalidRun = JSON.parse(runBytes);
  invalidRun.schema_version = 'distillery.feedback-run/unknown';
  fs.writeFileSync(runPath, `${JSON.stringify(invalidRun, null, 2)}\n`);
  assert.ok(validateRunDirectory(runDir, eventsDir, { artifactRoot })
    .some(error => error.includes('run.json schema_version')));
  fs.writeFileSync(runPath, runBytes);

  const routingPath = path.join(runDir, 'routing.json');
  const routingBytes = fs.readFileSync(routingPath);
  const lowConfidenceRouting = JSON.parse(routingBytes);
  lowConfidenceRouting.requests[0].confidence = 'low';
  fs.writeFileSync(routingPath, `${JSON.stringify(lowConfidenceRouting, null, 2)}\n`);
  assert.ok(validateRunDirectory(runDir, eventsDir, { artifactRoot })
    .some(error => error.includes('resolved decisions require high or medium confidence')));
  fs.writeFileSync(routingPath, routingBytes);

  const unknownClosureRouting = JSON.parse(routingBytes);
  unknownClosureRouting.requests[0].work_units[0].required_closure_stages = ['unknown_stage'];
  fs.writeFileSync(routingPath, `${JSON.stringify(unknownClosureRouting, null, 2)}\n`);
  assert.ok(validateRunDirectory(runDir, eventsDir, { artifactRoot })
    .some(error => error.includes('not normalized or closure-bound')));
  fs.writeFileSync(routingPath, routingBytes);

  const catalogSnapshotPath = path.join(runDir, 'ownership-catalog.json');
  const catalogSnapshotBytes = fs.readFileSync(catalogSnapshotPath);
  const changedCatalogSnapshot = JSON.parse(catalogSnapshotBytes);
  changedCatalogSnapshot.catalog_version = 'tampered';
  fs.writeFileSync(catalogSnapshotPath, `${JSON.stringify(changedCatalogSnapshot, null, 2)}\n`);
  assert.ok(validateRunDirectory(runDir, eventsDir, { artifactRoot })
    .some(error => error.includes('ownership catalog snapshot does not match routing basis')));
  fs.writeFileSync(catalogSnapshotPath, catalogSnapshotBytes);

  const promptSnapshotPath = path.join(runDir, 'prompt-data-policy.txt');
  const promptSnapshotBytes = fs.readFileSync(promptSnapshotPath);
  fs.writeFileSync(promptSnapshotPath, Buffer.concat([promptSnapshotBytes, Buffer.from('\ntampered')]));
  assert.ok(validateRunDirectory(runDir, eventsDir, { artifactRoot })
    .some(error => error.includes('prompt data policy')));
  fs.writeFileSync(promptSnapshotPath, promptSnapshotBytes);

  const invalidSnapshotPathRun = JSON.parse(runBytes);
  invalidSnapshotPathRun.basis_snapshot.ownership_catalog = '../ownership-catalog.json';
  fs.writeFileSync(runPath, `${JSON.stringify(invalidSnapshotPathRun, null, 2)}\n`);
  assert.ok(validateRunDirectory(runDir, eventsDir, { artifactRoot })
    .some(error => error.includes('basis_snapshot paths are invalid')));
  fs.writeFileSync(runPath, runBytes);

  const invalidRendererRun = JSON.parse(runBytes);
  invalidRendererRun.stage_packet_renderer_version = 'unknown';
  fs.writeFileSync(runPath, `${JSON.stringify(invalidRendererRun, null, 2)}\n`);
  assert.ok(validateRunDirectory(runDir, eventsDir, { artifactRoot })
    .some(error => error.includes('unsupported stage packet renderer version')));
  fs.writeFileSync(runPath, runBytes);

  const resultPath = path.join(runDir, 'result.json');
  const resultBytes = fs.readFileSync(resultPath);
  fs.writeFileSync(resultPath, resultBytes.toString('utf8').replace(
    '  "schema_version": "distillery.feedback-result/v1",',
    '  "schema_version": "distillery.feedback-result/v1",\n  "schema_version": "distillery.feedback-result/v1",',
  ));
  assert.throws(() => validateRunDirectory(runDir, eventsDir, { artifactRoot }), /canonical two-space JSON/);
  fs.writeFileSync(resultPath, resultBytes);

  const outsideResult = path.join(root, 'outside-result.json');
  fs.writeFileSync(outsideResult, resultBytes);
  fs.unlinkSync(resultPath);
  fs.symlinkSync(outsideResult, resultPath);
  assert.throws(() => validateRunDirectory(runDir, eventsDir, { artifactRoot }), /regular file|symlink/);
  fs.unlinkSync(resultPath);
  fs.writeFileSync(resultPath, resultBytes);

  const packetDir = path.join(runDir, 'stage-packets');
  const outsidePackets = path.join(root, 'outside-verifier-packets');
  fs.renameSync(packetDir, outsidePackets);
  fs.symlinkSync(outsidePackets, packetDir);
  assert.throws(() => validateRunDirectory(runDir, eventsDir, { artifactRoot }), /stage-packets.*symlink/);
  fs.unlinkSync(packetDir);
  fs.renameSync(outsidePackets, packetDir);

  const stageEventPath = path.join(eventsDir, 'evt-requirements', 'event.json');
  const stageEventBytes = fs.readFileSync(stageEventPath);
  const outsideStageEvent = path.join(root, 'outside-stage-event.json');
  fs.writeFileSync(outsideStageEvent, stageEventBytes);
  fs.unlinkSync(stageEventPath);
  fs.symlinkSync(outsideStageEvent, stageEventPath);
  assert.ok(validateRunDirectory(runDir, eventsDir, { artifactRoot })
    .some(error => error.includes('stage event does not exist')));
  fs.unlinkSync(stageEventPath);
  fs.writeFileSync(stageEventPath, stageEventBytes);

  const outsideEvents = path.join(root, 'outside-events');
  fs.renameSync(eventsDir, outsideEvents);
  fs.symlinkSync(outsideEvents, eventsDir);
  assert.throws(() => validateRunDirectory(runDir, eventsDir, { artifactRoot }), /events directory ancestor.*symlink/);
  fs.unlinkSync(eventsDir);
  fs.renameSync(outsideEvents, eventsDir);

  const nonstandardParent = path.join(artifactRoot, 'nonstandard-runs');
  const nonstandardRun = path.join(nonstandardParent, input.metadata.feedback_id);
  fs.mkdirSync(nonstandardParent);
  fs.renameSync(runDir, nonstandardRun);
  assert.throws(() => validateRunDirectory(nonstandardRun, eventsDir, { artifactRoot }), /must use artifactRoot\/pipeline\/feedback-runs/);
  fs.renameSync(nonstandardRun, runDir);

  const historicalPlanner = path.join(__dirname, '..', 'scripts', 'planFeedbackRequest.js');
  const historicalLease = path.join(artifactRoot, 'pipeline', 'run-lease.json');
  const historicalTerminal = spawnSync(process.execPath, [
    historicalPlanner, runDir,
    '--events-dir', eventsDir,
    '--artifact-root', artifactRoot,
    '--lease', historicalLease,
    '--run-id', 'historical-terminal',
  ], { encoding: 'utf8' });
  assert.equal(historicalTerminal.status, 0, historicalTerminal.stderr);
  assert.equal(JSON.parse(historicalTerminal.stdout).action, 'no_op');
  assert.equal(fs.existsSync(historicalLease), false);

  fs.appendFileSync(path.join(runDir, 'stage-packets', 'spec.md'), 'tampered\n');
  assert.ok(validateRunDirectory(runDir, eventsDir, { artifactRoot }).some(error => error.includes('stage packet mismatch')));
});

test('skipped stages are frozen in the routing basis and removed from every closure', () => {
  const input = document();
  const options = routingOptions({ skippedStages: 'spec_stories,design_system' });
  const routing = buildRouting(input, resolvedProposal(input), 'interactive', options);
  assert.deepEqual(routing.routing_basis.skipped_stages, ['design_system', 'spec_stories']);
  const plan = buildPlan(input, routing, options);
  const stageIds = plan.execution_stages.map(stage => stage.id);
  assert.ok(!stageIds.includes('design_system'));
  assert.ok(!stageIds.includes('spec_stories'));
  assert.deepEqual(stageIds, ['requirements', 'quality_attributes', 'architecture', 'infrastructure', 'spec']);
  for (const unit of plan.work_units) {
    assert.ok(!unit.required_closure_stages.includes('design_system'));
    assert.ok(!unit.required_closure_stages.includes('spec_stories'));
  }
  assert.deepEqual(plan.work_units[1].required_closure_stages, ['spec']);

  const rebuilt = buildRouting(input, resolvedProposal(input), 'interactive', options);
  assert.equal(canonicalJsonText(buildPlan(input, rebuilt, options)), canonicalJsonText(plan));

  const noSkip = createRoutingBasis(routingOptions(), options.catalogBundle, options.policyBundle);
  assert.deepEqual(noSkip.skipped_stages, []);
  assert.throws(() => createRoutingBasis(routingOptions({ skippedStages: 'outside_pipeline' }), options.catalogBundle, options.policyBundle), /unknown skipped stage/);
});

test('a work unit whose direct owner is a skipped stage is rejected fail-closed', () => {
  const input = document();
  const options = routingOptions({ skippedStages: ['spec'] });
  assert.throws(() => buildRouting(input, resolvedProposal(input), 'interactive', options), /direct_stage spec is a skipped stage/);
});

test('frozen routing without skipped_stages (pre-1.5.0) still resumes as an empty skip set', () => {
  const input = document();
  const options = routingOptions();
  const routing = buildRouting(input, resolvedProposal(input), 'interactive', options);
  const legacy = JSON.parse(JSON.stringify(routing));
  delete legacy.routing_basis.skipped_stages;
  const resumed = buildRouting(input, legacy, 'interactive', { ...options, basisValidation: 'static' });
  assert.deepEqual(resumed.requests[1].work_units[0].required_closure_stages, ['spec', 'spec_stories']);
  // awaiting_resolution など plan の無い run は full 比較になる。旧 basis でも通ること
  const resumedFull = buildRouting(input, legacy, 'interactive', { ...options, basisValidation: 'full' });
  const legacyPlan = buildPlan(input, resumedFull, options);
  const currentPlan = buildPlan(input, routing, options);
  assert.deepEqual(legacyPlan.execution_stages, currentPlan.execution_stages);
  assert.deepEqual(legacyPlan.work_units, currentPlan.work_units);
  assert.throws(
    () => buildRouting(input, routing, 'interactive', routingOptions({ skippedStages: ['spec_stories'] })),
    /routing basis changed/,
  );
});
