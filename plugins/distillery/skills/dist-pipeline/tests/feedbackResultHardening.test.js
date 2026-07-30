'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { sha256Bytes } = require('../scripts/feedbackRequest');
const { latestDomainEventIdsFromSnapshots, loadCatalog, snapshotDomainEventRoots } = require('../scripts/planFeedbackRequest');
const {
  deriveRequestDisposition,
  resolveArtifactRef,
  validateDeterministicResult,
  validateExecutionLifecycle,
  validateResult,
  validateStageEvents,
  validateStatus,
  validateTerminalEvent,
} = require('../scripts/verifyFeedbackResult');

const INPUT_SHA = 'a'.repeat(64);
const REQUIREMENTS_DOMAIN_EVENT_ID = '20260730_120000_requirements';

function planFixture() {
  const catalog = loadCatalog().value;
  return {
    feedback_request_id: 'feedback-request-1',
    input_sha256: INPUT_SHA,
    ambiguity_policy: 'interactive',
    routing_basis: {
      repository_head: 'head-1',
      latest_domain_event_ids: Object.fromEntries(catalog.stages.map(stage => [
        stage.id,
        Object.fromEntries(stage.domain_event_roots.map(root => [root, null])),
      ])),
    },
    request_ids: ['CR-1'],
    work_units: [
      { id: 'CR-1#1', request_id: 'CR-1', direct_stage: 'requirements', required_closure_stages: ['requirements', 'spec'] },
      { id: 'CR-1#2', request_id: 'CR-1', direct_stage: 'spec', required_closure_stages: ['spec'] },
    ],
    execution_stages: [
      {
        id: 'requirements',
        direct_work_unit_ids: ['CR-1#1'],
        causal_work_unit_ids: ['CR-1#1'],
      },
      {
        id: 'spec',
        direct_work_unit_ids: ['CR-1#2'],
        causal_work_unit_ids: ['CR-1#1', 'CR-1#2'],
      },
    ],
  };
}

function resultFixture(plan = planFixture()) {
  return {
    schema_version: 'distillery.feedback-result/v1',
    run_id: 'run-1',
    attempt: 1,
    feedback_request_id: plan.feedback_request_id,
    input_sha256: plan.input_sha256,
    status: 'completed',
    stages: plan.execution_stages.map(stage => ({
      stage_id: stage.id,
      state: 'succeeded',
      event_ids: [`event-${stage.id}`],
      direct_work_unit_ids: stage.direct_work_unit_ids,
      causal_work_unit_ids: stage.causal_work_unit_ids,
    })),
    work_units: plan.work_units.map(unit => ({
      work_unit_id: unit.id,
      disposition: 'applied',
      reason: 'At least one required closure stage changed its domain artifacts.',
      artifact_refs: unit.id === 'CR-1#1'
        ? [
          `usdm/events/${REQUIREMENTS_DOMAIN_EVENT_ID}/requirements.yaml`,
          'specs/events/domain-spec/spec.yaml',
        ]
        : ['specs/events/domain-spec/spec.yaml'],
    })),
    requests: [{
      request_id: 'CR-1',
      work_unit_ids: ['CR-1#1', 'CR-1#2'],
      disposition: 'applied',
      reason: 'At least one work unit was applied and all work units completed successfully.',
    }],
    terminal_event_id: 'event-terminal',
  };
}

function oneUnitClosurePlan() {
  const plan = planFixture();
  plan.work_units = [plan.work_units[0]];
  plan.execution_stages[1].direct_work_unit_ids = [];
  plan.execution_stages[1].causal_work_unit_ids = ['CR-1#1'];
  return plan;
}

function oneUnitResult(plan, workUnitResult, status = 'completed') {
  const result = resultFixture(plan);
  result.status = status;
  result.work_units = [workUnitResult];
  const disposition = workUnitResult.disposition;
  const requestDisposition = disposition;
  const reasons = {
    applied: 'At least one work unit was applied and all work units completed successfully.',
    merged: 'Every work unit completed with all required closure stages already current or not impacted.',
    deferred: 'At least one work unit was deferred and none was applied, merged, rejected, or execution-failed.',
    rejected: 'At least one work unit was rejected and no work unit completed successfully.',
  };
  result.requests = [{
    request_id: 'CR-1',
    work_unit_ids: ['CR-1#1'],
    disposition: requestDisposition,
    reason: reasons[requestDisposition],
  }];
  return result;
}

function seedPriorNormalEvents({ artifactRoot, catalog }, stageIds, eventId = '000-prior') {
  const refsByStage = {};
  for (const stageId of stageIds) {
    const catalogStage = catalog.stages.find(stage => stage.id === stageId);
    refsByStage[stageId] = [];
    for (const domainRoot of catalogStage.domain_event_roots) {
      const directory = path.join(artifactRoot, domainRoot, eventId);
      fs.mkdirSync(directory, { recursive: true });
      const filename = domainRoot === 'rdra/events' ? 'requirements.tsv' : `${stageId}.yaml`;
      const relative = `${domainRoot}/${eventId}/${filename}`;
      fs.writeFileSync(path.join(artifactRoot, relative), domainRoot === 'rdra/events'
        ? 'id\tname\nREQ-PRIOR\tPrior\n'
        : 'event_id: "000-prior"\n');
      refsByStage[stageId].push(relative);
      const latestDirectory = path.join(artifactRoot, path.dirname(domainRoot), 'latest');
      fs.mkdirSync(latestDirectory, { recursive: true });
      fs.writeFileSync(path.join(latestDirectory, 'feedback-state.json'), `${JSON.stringify({
        event_id: eventId,
        stage: stageId,
      }, null, 2)}\n`);
    }
  }
  return refsByStage;
}

function statusFixture(plan = planFixture(), result = resultFixture(plan), state = result.status) {
  return {
    schema_version: 'distillery.feedback-run-status/v1',
    run_id: result.run_id,
    attempt: result.attempt,
    feedback_request_id: plan.feedback_request_id,
    input_sha256: plan.input_sha256,
    ambiguity_policy: plan.ambiguity_policy,
    state,
    stages: plan.execution_stages.map((stage, index) => ({
      id: stage.id,
      state: result.stages[index].state === 'succeeded' ? 'completed' : result.stages[index].state,
      event_ids: result.stages[index].event_ids,
      direct_work_unit_ids: stage.direct_work_unit_ids,
      causal_work_unit_ids: stage.causal_work_unit_ids,
    })),
  };
}

function makeEventWorkspace(plan = planFixture(), result = resultFixture(plan), options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-result-hardening-'));
  const artifactRoot = path.join(root, 'artifacts');
  const eventsDir = path.join(artifactRoot, 'pipeline', 'events');
  fs.mkdirSync(eventsDir, { recursive: true });
  fs.mkdirSync(artifactRoot, { recursive: true });
  const unitById = new Map(plan.work_units.map(unit => [unit.id, unit]));
  const catalog = loadCatalog().value;
  if (options.seedDomainEvents) options.seedDomainEvents({ artifactRoot, catalog, plan });
  const initialSnapshots = snapshotDomainEventRoots(artifactRoot, catalog);
  if (options.seedDomainEvents || !plan.routing_basis.domain_event_root_snapshots) {
    plan.routing_basis.domain_event_root_snapshots = initialSnapshots;
    plan.routing_basis.latest_domain_event_ids = latestDomainEventIdsFromSnapshots(catalog, initialSnapshots);
  }
  let latestDomainEventIds = structuredClone(plan.routing_basis.latest_domain_event_ids);
  for (const stage of result.stages) {
    if (stage.state === 'not_attempted') continue;
    const catalogStage = catalog.stages.find(item => item.id === stage.stage_id);
    const domainEventId = stage.stage_id === 'requirements'
      ? REQUIREMENTS_DOMAIN_EVENT_ID
      : `domain-${stage.stage_id}`;
    const createdAt = `2026-07-30T12:0${plan.execution_stages.findIndex(item => item.id === stage.stage_id)}:00+09:00`;
    const requestIds = [...new Set(stage.causal_work_unit_ids.map(id => unitById.get(id).request_id))];
    const domainEventRefs = [];
    const normalMemberPaths = [];
    const configuredOutcome = options.stageOutcomes?.[stage.stage_id];
    const appliedOwnerIds = configuredOutcome?.workUnitResults
      ? configuredOutcome.workUnitResults.filter(item => item.disposition === 'applied').map(item => item.work_unit_id)
      : stage.direct_work_unit_ids;
    if (stage.state === 'succeeded' && !configuredOutcome?.manifest) {
      for (const domainRoot of catalogStage.domain_event_roots) {
        const domainEventDirectory = path.join(artifactRoot, domainRoot, domainEventId);
        fs.mkdirSync(domainEventDirectory, { recursive: true });
        if (domainRoot === 'rdra/events') {
          const memberPath = `${domainRoot}/${domainEventId}/requirements.tsv`;
          const memberTarget = path.join(artifactRoot, memberPath);
          fs.writeFileSync(memberTarget, 'id\tname\nREQ-1\tExample\n');
          const domainPath = `${domainRoot}/${domainEventId}/event.json`;
          const domainTarget = path.join(artifactRoot, domainPath);
          fs.writeFileSync(domainTarget, `${JSON.stringify({
            schema_version: 'distillery.rdra-feedback-event/v1',
            event_id: domainEventId,
            created_at: createdAt,
            stage: 'requirements',
            feedback_request: {
              feedback_request_id: plan.feedback_request_id,
              input_sha256: plan.input_sha256,
              request_ids: requestIds,
              work_unit_ids: stage.causal_work_unit_ids,
            },
            members: [{ path: memberPath, sha256: sha256Bytes(fs.readFileSync(memberTarget)) }],
          }, null, 2)}\n`);
          domainEventRefs.push({ path: domainPath, sha256: sha256Bytes(fs.readFileSync(domainTarget)) });
          normalMemberPaths.push(memberPath);
        } else {
          const domainPath = `${domainRoot}/${domainEventId}/${stage.stage_id}.yaml`;
          const domainTarget = path.join(artifactRoot, domainPath);
          fs.writeFileSync(domainTarget, [
            ...(domainRoot === 'usdm/events' && stage.stage_id === 'requirements' ? [
              'version: "1.0"',
            ] : []),
            `event_id: "${domainEventId}"`,
            ...(domainRoot === 'usdm/events' && stage.stage_id === 'requirements' ? [
              'created_at: "2026-07-30T12:00:00"',
              'source: "feedback request"',
              'system_name: "Test system"',
            ] : []),
            'feedback_request:',
            `  feedback_request_id: ${JSON.stringify(plan.feedback_request_id)}`,
            `  input_sha256: ${JSON.stringify(plan.input_sha256)}`,
            `  request_ids: ${JSON.stringify(requestIds)}`,
            `  work_unit_ids: ${JSON.stringify(stage.causal_work_unit_ids)}`,
            ...(domainRoot === 'usdm/events' && stage.stage_id === 'requirements' ? [
              'requirements:',
              '  - id: "REQ-001"',
              '    requirement: "Apply the verified feedback"',
              '    reason: "The accepted owner work requires this change"',
              '    priority: "must"',
              '    feedback_source:',
              `      feedback_request_id: ${JSON.stringify(plan.feedback_request_id)}`,
              '      work_unit_ids:',
              ...appliedOwnerIds.map(id => `        - ${JSON.stringify(id)}`),
              '    specifications:',
              '      - id: "SPEC-001-01"',
              '        specification: "Persist the verified feedback lineage"',
              '        acceptance_criteria:',
              '          - "The owner ledger and output lineage agree"',
              '        affected_models:',
              '          - type: "business_policy"',
              '            action: "modify"',
              '            target: "Feedback policy"',
            ] : []),
            '',
          ].join('\n'));
          domainEventRefs.push({ path: domainPath, sha256: sha256Bytes(fs.readFileSync(domainTarget)) });
          normalMemberPaths.push(domainPath);
        }
        const latestDirectory = path.join(artifactRoot, path.dirname(domainRoot), 'latest');
        fs.mkdirSync(latestDirectory, { recursive: true });
        if (domainRoot === 'usdm/events' && stage.stage_id === 'requirements') {
          fs.copyFileSync(
            path.join(artifactRoot, domainEventRefs.at(-1).path),
            path.join(latestDirectory, 'requirements.yaml'),
          );
        }
        fs.writeFileSync(path.join(latestDirectory, 'feedback-state.json'), `${JSON.stringify({
          event_id: domainEventId,
          stage: stage.stage_id,
        }, null, 2)}\n`);
      }
    }
    const primaryArtifactRef = normalMemberPaths.find(reference => !reference.startsWith('rdra/events/')) || normalMemberPaths[0];
    const workUnitResults = configuredOutcome?.workUnitResults || (stage.state === 'succeeded'
      ? stage.direct_work_unit_ids.map(id => ({
        work_unit_id: id,
        disposition: 'applied',
        reason: 'applied by the owning stage',
        artifact_refs: [primaryArtifactRef],
      }))
      : []);
    const directResultById = new Map(workUnitResults.map(item => [item.work_unit_id, item]));
    const reconciliationResults = configuredOutcome?.reconciliationResults || (stage.state === 'succeeded'
      ? stage.causal_work_unit_ids.map(id => ({
        work_unit_id: id,
        status: 'changed',
        reason: directResultById.get(id)?.reason || 'changed by the closure-stage reconciliation',
        artifact_refs: directResultById.get(id)?.artifact_refs || [primaryArtifactRef],
      }))
      : []);
    const workUnitEvidenceRefs = reconciliationResults
      .filter(item => ['changed', 'already_current'].includes(item.status))
      .flatMap(item => item.artifact_refs.map(reference => ({
        work_unit_id: item.work_unit_id,
        path: reference,
        sha256: sha256Bytes(fs.readFileSync(path.join(artifactRoot, reference))),
      })));
    if (stage.state === 'succeeded' && configuredOutcome?.manifest) {
      for (const domainRoot of catalogStage.domain_event_roots) {
        const domainEventDirectory = path.join(artifactRoot, domainRoot, domainEventId);
        fs.mkdirSync(domainEventDirectory, { recursive: true });
        const domainPath = `${domainRoot}/${domainEventId}/feedback-disposition.json`;
        const domainTarget = path.join(artifactRoot, domainPath);
        fs.writeFileSync(domainTarget, `${JSON.stringify({
          schema_version: 'distillery.feedback-no-domain-change/v1',
          type: 'feedback_no_domain_change',
          event_id: domainEventId,
          created_at: createdAt,
          stage: stage.stage_id,
          domain_event_root: domainRoot,
          reason: 'No domain change was required by this stage reconciliation.',
          feedback_request: {
            feedback_request_id: plan.feedback_request_id,
            input_sha256: plan.input_sha256,
            request_ids: requestIds,
            work_unit_ids: stage.causal_work_unit_ids,
          },
          work_unit_results: workUnitResults,
          reconciliation_results: reconciliationResults,
          evidence_refs: workUnitEvidenceRefs.filter(evidence =>
            reconciliationResults.find(item => item.work_unit_id === evidence.work_unit_id)?.status === 'already_current'),
        }, null, 2)}\n`);
        domainEventRefs.push({ path: domainPath, sha256: sha256Bytes(fs.readFileSync(domainTarget)) });
      }
    }
    if (stage.state === 'succeeded') {
      const snapshots = snapshotDomainEventRoots(artifactRoot, catalog);
      latestDomainEventIds = latestDomainEventIdsFromSnapshots(catalog, snapshots);
    }
    for (const eventId of stage.event_ids) {
      const eventDir = path.join(eventsDir, eventId);
      fs.mkdirSync(eventDir, { recursive: true });
      fs.writeFileSync(path.join(eventDir, 'event.json'), `${JSON.stringify({
        event_id: eventId,
        type: stage.state === 'succeeded' ? 'feedback_stage_completed' : 'feedback_stage_failed',
        run_id: result.run_id,
        attempt: result.attempt,
        created_at: createdAt,
        ...(stage.state === 'failed' ? { phase: 'stage_execution', reason: 'the stage command failed' } : {}),
        stage: stage.stage_id,
        direct_work_unit_ids: stage.direct_work_unit_ids,
        causal_work_unit_ids: stage.causal_work_unit_ids,
        work_unit_results: workUnitResults,
        reconciliation_results: reconciliationResults,
        work_unit_evidence_refs: workUnitEvidenceRefs,
        domain_event_refs: domainEventRefs,
        post_execution_basis: {
          repository_head: plan.routing_basis.repository_head,
          latest_domain_event_ids: structuredClone(latestDomainEventIds),
          domain_event_root_snapshots: snapshotDomainEventRoots(artifactRoot, catalog),
        },
        feedback_request: {
          feedback_request_id: plan.feedback_request_id,
          input_sha256: plan.input_sha256,
          request_ids: requestIds,
          work_unit_ids: stage.causal_work_unit_ids,
        },
      }, null, 2)}\n`);
    }
  }
  return { root, eventsDir, artifactRoot };
}

function eventFile(workspace, eventId) {
  return path.join(workspace.eventsDir, eventId, 'event.json');
}

function mutateEvent(workspace, eventId, mutate) {
  const target = eventFile(workspace, eventId);
  const event = JSON.parse(fs.readFileSync(target, 'utf8'));
  mutate(event);
  fs.writeFileSync(target, `${JSON.stringify(event, null, 2)}\n`);
}

function rewriteDomainEvent(workspace, eventId, rewrite, replacementPath) {
  const wrapperPath = eventFile(workspace, eventId);
  const wrapper = JSON.parse(fs.readFileSync(wrapperPath, 'utf8'));
  const reference = wrapper.domain_event_refs.find(item => /\.ya?ml$/.test(item.path)) || wrapper.domain_event_refs[0];
  const originalTarget = path.join(workspace.artifactRoot, reference.path);
  const targetPath = replacementPath || reference.path;
  const target = path.join(workspace.artifactRoot, targetPath);
  const content = rewrite(fs.readFileSync(originalTarget, 'utf8'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  reference.path = targetPath;
  reference.sha256 = sha256Bytes(fs.readFileSync(target));
  fs.writeFileSync(wrapperPath, `${JSON.stringify(wrapper, null, 2)}\n`);
}

function rewriteRequirementsArtifactAndRebind(workspace, rewrite) {
  const wrapperPath = eventFile(workspace, 'event-requirements');
  const wrapper = JSON.parse(fs.readFileSync(wrapperPath, 'utf8'));
  const reference = wrapper.domain_event_refs.find(item =>
    item.path.startsWith('usdm/events/') && path.basename(item.path) === 'requirements.yaml');
  assert.ok(reference, 'requirements stage fixture must reference its current USDM requirements.yaml');
  const target = path.join(workspace.artifactRoot, reference.path);
  fs.writeFileSync(target, rewrite(fs.readFileSync(target, 'utf8')));
  const sha256 = sha256Bytes(fs.readFileSync(target));
  reference.sha256 = sha256;
  for (const evidence of wrapper.work_unit_evidence_refs) {
    if (evidence.path === reference.path) evidence.sha256 = sha256;
  }
  fs.writeFileSync(wrapperPath, `${JSON.stringify(wrapper, null, 2)}\n`);
}

function bindCurrentUsdmProjection(workspace, plan) {
  const catalog = loadCatalog().value;
  const currentSnapshots = snapshotDomainEventRoots(workspace.artifactRoot, catalog);
  mutateEvent(workspace, 'event-requirements', event => {
    event.post_execution_basis.domain_event_root_snapshots['usdm/events'] = currentSnapshots['usdm/events'];
    event.post_execution_basis.latest_domain_event_ids = latestDomainEventIdsFromSnapshots(
      catalog,
      event.post_execution_basis.domain_event_root_snapshots,
    );
  });
  mutateEvent(workspace, 'event-spec', event => {
    event.post_execution_basis = {
      repository_head: plan.routing_basis.repository_head,
      latest_domain_event_ids: latestDomainEventIdsFromSnapshots(catalog, currentSnapshots),
      domain_event_root_snapshots: currentSnapshots,
    };
  });
  return {
    repository_head: plan.routing_basis.repository_head,
    latest_domain_event_ids: latestDomainEventIdsFromSnapshots(catalog, currentSnapshots),
    domain_event_root_snapshots: currentSnapshots,
  };
}

test('stage events bind directory ID, terminal state type, stage, causality, and feedback lineage', () => {
  const plan = planFixture();
  const result = resultFixture(plan);
  const workspace = makeEventWorkspace(plan, result);
  assert.deepEqual(validateStageEvents(plan, result, workspace.eventsDir, workspace.artifactRoot), []);

  const cases = [
    ['event_id', event => { event.event_id = 'different-id'; }, 'does not match its directory'],
    ['type', event => { event.type = 'feedback_stage_failed'; }, 'type must be feedback_stage_completed'],
    ['stage', event => { event.stage = 'spec'; }, 'stage mismatch'],
    ['direct', event => { event.direct_work_unit_ids = []; }, 'direct_work_unit_ids mismatch'],
    ['causal', event => { event.causal_work_unit_ids = []; }, 'causal_work_unit_ids mismatch'],
    ['lineage', event => { event.feedback_request.input_sha256 = 'b'.repeat(64); }, 'lineage mismatch'],
  ];
  for (const [name, mutate, message] of cases) {
    const isolated = makeEventWorkspace(plan, result);
    mutateEvent(isolated, 'event-requirements', mutate);
    assert.ok(
      validateStageEvents(plan, result, isolated.eventsDir, isolated.artifactRoot).some(error => error.includes(message)),
      `${name} mutation must be rejected`,
    );
  }

  const duplicateKey = makeEventWorkspace(plan, result);
  const duplicatePath = eventFile(duplicateKey, 'event-requirements');
  fs.writeFileSync(duplicatePath, fs.readFileSync(duplicatePath, 'utf8').replace(
    '  "type": "feedback_stage_completed",',
    '  "type": "feedback_stage_failed",\n  "type": "feedback_stage_completed",',
  ));
  assert.ok(validateStageEvents(plan, result, duplicateKey.eventsDir, duplicateKey.artifactRoot)
    .some(error => error.includes('canonical two-space JSON')));

  const failed = resultFixture(plan);
  failed.stages[0].state = 'failed';
  failed.stages[1].state = 'not_attempted';
  failed.stages[1].event_ids = [];
  const failedWorkspace = makeEventWorkspace(plan, failed);
  assert.deepEqual(validateStageEvents(plan, failed, failedWorkspace.eventsDir, failedWorkspace.artifactRoot), []);
  mutateEvent(failedWorkspace, 'event-requirements', event => { event.type = 'feedback_stage_completed'; });
  assert.ok(validateStageEvents(plan, failed, failedWorkspace.eventsDir, failedWorkspace.artifactRoot)
    .some(error => error.includes('type must be feedback_stage_failed')));

  const linkedEvents = makeEventWorkspace(plan, result);
  const outsideEvents = path.join(linkedEvents.root, 'outside-events');
  fs.renameSync(linkedEvents.eventsDir, outsideEvents);
  fs.symlinkSync(outsideEvents, linkedEvents.eventsDir);
  assert.throws(
    () => validateStageEvents(plan, result, linkedEvents.eventsDir, linkedEvents.artifactRoot),
    /events directory ancestor.*symlink/,
  );

  const linkedEventDir = makeEventWorkspace(plan, result);
  const eventDirectory = path.dirname(eventFile(linkedEventDir, 'event-requirements'));
  const outsideEventDirectory = path.join(linkedEventDir.root, 'outside-event-requirements');
  fs.renameSync(eventDirectory, outsideEventDirectory);
  fs.symlinkSync(outsideEventDirectory, eventDirectory);
  assert.ok(validateStageEvents(plan, result, linkedEventDir.eventsDir, linkedEventDir.artifactRoot)
    .some(error => error.includes('stage event does not exist')));
});

test('a stage event ID cannot be reused by another stage', () => {
  const plan = planFixture();
  const result = resultFixture(plan);
  const workspace = makeEventWorkspace(plan, result);
  result.stages[1].event_ids = ['event-requirements'];
  assert.ok(validateResult(plan, result).some(error => error.includes('globally unique')));
  assert.ok(validateStageEvents(plan, result, workspace.eventsDir, workspace.artifactRoot)
    .some(error => error.includes('globally unique')));
});

test('full stage verification binds requirements feedback_source to the verified applied owner ledger', () => {
  const plan = planFixture();
  const result = resultFixture(plan);

  const historical = makeEventWorkspace(plan, result);
  rewriteRequirementsArtifactAndRebind(historical, text => `${text.trimEnd()}\n${[
    '  - id: "REQ-999"',
    '    requirement: "Retain historic lineage"',
    '    reason: "Historic entries may coexist in a full snapshot"',
    '    priority: "could"',
    '    feedback_source:',
    '      feedback_request_id: "historic-feedback"',
    '      work_unit_ids:',
    '        - "CR-HISTORIC#1"',
    '    specifications:',
    '      - id: "SPEC-999-01"',
    '        specification: "Keep historic lineage unchanged"',
    '        acceptance_criteria:',
    '          - "Historic lineage remains valid"',
    '        affected_models:',
    '          - type: "business_policy"',
    '            action: "modify"',
    '            target: "Historic policy"',
    '',
  ].join('\n')}`);
  fs.copyFileSync(
    path.join(historical.artifactRoot, 'usdm', 'events', REQUIREMENTS_DOMAIN_EVENT_ID, 'requirements.yaml'),
    path.join(historical.artifactRoot, 'usdm', 'latest', 'requirements.yaml'),
  );
  const historicalScopeBasis = bindCurrentUsdmProjection(historical, plan);
  assert.ok(validateStageEvents(
    plan,
    result,
    historical.eventsDir,
    historical.artifactRoot,
    { currentExecutionBasis: historicalScopeBasis },
  )
    .some(error => error.includes('REQ subtree without current feedback lineage: REQ-999')));

  const missing = makeEventWorkspace(planFixture(), resultFixture(planFixture()));
  rewriteRequirementsArtifactAndRebind(missing, text => text.replace(
    /    feedback_source:\n      feedback_request_id: "feedback-request-1"\n      work_unit_ids:\n        - "CR-1#1"\n/,
    '',
  ));
  assert.ok(validateStageEvents(planFixture(), resultFixture(planFixture()), missing.eventsDir, missing.artifactRoot)
    .some(error => error.includes('Requirements work unit CR-1#1 is not referenced')));

  const mergedOrForeign = makeEventWorkspace(planFixture(), resultFixture(planFixture()));
  rewriteRequirementsArtifactAndRebind(mergedOrForeign, text => text.replace('        - "CR-1#1"', '        - "CR-1#2"'));
  assert.ok(validateStageEvents(planFixture(), resultFixture(planFixture()), mergedOrForeign.eventsDir, mergedOrForeign.artifactRoot)
    .some(error => error.includes('requirements owner ledger binding mismatch')));

  const schemaMissing = makeEventWorkspace(planFixture(), resultFixture(planFixture()));
  rewriteRequirementsArtifactAndRebind(schemaMissing, text => text.replace('version: "1.0"\n', ''));
  assert.ok(validateStageEvents(planFixture(), resultFixture(planFixture()), schemaMissing.eventsDir, schemaMissing.artifactRoot)
    .some(error => error.includes('requirements owner ledger schema mismatch') && error.includes('version')));

  const wrongDomainEventId = makeEventWorkspace(planFixture(), resultFixture(planFixture()));
  rewriteRequirementsArtifactAndRebind(wrongDomainEventId, text => text.replace(
    `event_id: "${REQUIREMENTS_DOMAIN_EVENT_ID}"`,
    'event_id: "20260730_120001_other"',
  ));
  assert.ok(validateStageEvents(planFixture(), resultFixture(planFixture()), wrongDomainEventId.eventsDir, wrongDomainEventId.artifactRoot)
    .some(error => error.includes('event_id must match its domain event directory')));

  const missingNormalUsdm = makeEventWorkspace(planFixture(), resultFixture(planFixture()));
  mutateEvent(missingNormalUsdm, 'event-requirements', event => {
    event.domain_event_refs = event.domain_event_refs.filter(reference => !reference.path.startsWith('usdm/events/'));
  });
  assert.ok(validateStageEvents(planFixture(), resultFixture(planFixture()), missingNormalUsdm.eventsDir, missingNormalUsdm.artifactRoot)
    .some(error => error.includes('must reference exactly one current normal USDM requirements document')));

  const projectionPlan = planFixture();
  const projectionResult = resultFixture(projectionPlan);
  const brokenProjection = makeEventWorkspace(projectionPlan, projectionResult);
  const latestRequirementsPath = path.join(brokenProjection.artifactRoot, 'usdm', 'latest', 'requirements.yaml');
  fs.writeFileSync(latestRequirementsPath, fs.readFileSync(latestRequirementsPath, 'utf8').replace(
    /    feedback_source:\n      feedback_request_id: "feedback-request-1"\n      work_unit_ids:\n        - "CR-1#1"\n/,
    '',
  ));
  const currentExecutionBasis = bindCurrentUsdmProjection(brokenProjection, projectionPlan);
  assert.ok(validateStageEvents(
    projectionPlan,
    projectionResult,
    brokenProjection.eventsDir,
    brokenProjection.artifactRoot,
    { currentExecutionBasis },
  ).some(error => error.includes('requirements current projection')));

  const divergentProjection = makeEventWorkspace(projectionPlan, projectionResult);
  const divergentLatestPath = path.join(divergentProjection.artifactRoot, 'usdm', 'latest', 'requirements.yaml');
  fs.writeFileSync(divergentLatestPath, fs.readFileSync(divergentLatestPath, 'utf8').replace(
    'requirement: "Apply the verified feedback"',
    'requirement: "Smuggled divergent business change"',
  ));
  const divergentBasis = bindCurrentUsdmProjection(divergentProjection, projectionPlan);
  assert.ok(validateStageEvents(
    projectionPlan,
    projectionResult,
    divergentProjection.eventsDir,
    divergentProjection.artifactRoot,
    { currentExecutionBasis: divergentBasis },
  ).some(error => error.includes('exactly preserve every event REQ subtree')));

  const childMarkerProjection = makeEventWorkspace(projectionPlan, projectionResult);
  rewriteRequirementsArtifactAndRebind(childMarkerProjection, text => text.replace(
    [
      '    feedback_source:',
      '      feedback_request_id: "feedback-request-1"',
      '      work_unit_ids:',
      '        - "CR-1#1"',
      '    specifications:',
      '      - id: "SPEC-001-01"',
      '        specification: "Persist the verified feedback lineage"',
    ].join('\n'),
    [
      '    specifications:',
      '      - id: "SPEC-001-01"',
      '        specification: "Persist the verified feedback lineage"',
      '        feedback_source:',
      '          feedback_request_id: "feedback-request-1"',
      '          work_unit_ids:',
      '            - "CR-1#1"',
    ].join('\n'),
  ));
  const childMarkerEventPath = path.join(
    childMarkerProjection.artifactRoot,
    'usdm',
    'events',
    REQUIREMENTS_DOMAIN_EVENT_ID,
    'requirements.yaml',
  );
  const childMarkerLatestPath = path.join(childMarkerProjection.artifactRoot, 'usdm', 'latest', 'requirements.yaml');
  fs.copyFileSync(childMarkerEventPath, childMarkerLatestPath);
  const childMarkerBasis = bindCurrentUsdmProjection(childMarkerProjection, projectionPlan);
  assert.deepEqual(validateStageEvents(
    projectionPlan,
    projectionResult,
    childMarkerProjection.eventsDir,
    childMarkerProjection.artifactRoot,
    { currentExecutionBasis: childMarkerBasis },
  ), []);
  fs.writeFileSync(childMarkerLatestPath, fs.readFileSync(childMarkerLatestPath, 'utf8').replace(
    'requirement: "Apply the verified feedback"',
    'requirement: "Smuggled parent requirement text"',
  ));
  const childMarkerDivergentBasis = bindCurrentUsdmProjection(childMarkerProjection, projectionPlan);
  assert.ok(validateStageEvents(
    projectionPlan,
    projectionResult,
    childMarkerProjection.eventsDir,
    childMarkerProjection.artifactRoot,
    { currentExecutionBasis: childMarkerDivergentBasis },
  ).some(error => error.includes('exactly preserve every event REQ subtree')));

  const historicalLatest = makeEventWorkspace(projectionPlan, projectionResult);
  const historicalLatestPath = path.join(historicalLatest.artifactRoot, 'usdm', 'latest', 'requirements.yaml');
  fs.writeFileSync(historicalLatestPath, `${fs.readFileSync(historicalLatestPath, 'utf8').trimEnd()}\n${[
    '  - id: "REQ-999"',
    '    requirement: "Retain unrelated historic content"',
    '    reason: "Latest is a full projection"',
    '    priority: "could"',
    '    specifications:',
    '      - id: "SPEC-999-01"',
    '        specification: "Retain unrelated historic detail"',
    '        acceptance_criteria:',
    '          - "Historic content remains available"',
    '        affected_models:',
    '          - type: "business_policy"',
    '            action: "modify"',
    '            target: "Historic policy"',
    '',
  ].join('\n')}`);
  const historicalLatestBasis = bindCurrentUsdmProjection(historicalLatest, projectionPlan);
  assert.deepEqual(validateStageEvents(
    projectionPlan,
    projectionResult,
    historicalLatest.eventsDir,
    historicalLatest.artifactRoot,
    { currentExecutionBasis: historicalLatestBasis },
  ), []);
});

test('causal reconciliation is exact, owner-bound, stage-local, and hash-bound', () => {
  const plan = planFixture();
  const result = resultFixture(plan);
  const cases = [
    [
      'missing array',
      event => { delete event.reconciliation_results; },
      'reconciliation_results must be an array',
    ],
    [
      'wrong causal order',
      event => { event.reconciliation_results.reverse(); },
      'cover causal work units exactly once and in plan order',
    ],
    [
      'wrong direct mapping',
      event => { event.reconciliation_results[1].status = 'not_impacted'; event.reconciliation_results[1].artifact_refs = []; },
      'direct-owner reconciliation status must be mechanically derived',
    ],
    [
      'blocked accepted owner',
      event => { event.reconciliation_results[0] = {
        work_unit_id: 'CR-1#1', status: 'blocked_by_owner', reason: 'blocked', artifact_refs: [],
      }; },
      'accepted owner reconciliation may not be blocked_by_owner',
    ],
    [
      'cross-stage changed evidence',
      event => { event.reconciliation_results[0].artifact_refs = [`usdm/events/${REQUIREMENTS_DOMAIN_EVENT_ID}/requirements.yaml`]; },
      'stage-local current normal evidence',
    ],
    [
      'evidence hash mismatch',
      event => { event.work_unit_evidence_refs[0].sha256 = '0'.repeat(64); },
      'path/hash mismatch',
    ],
  ];
  for (const [name, mutate, message] of cases) {
    const workspace = makeEventWorkspace(planFixture(), resultFixture(planFixture()));
    mutateEvent(workspace, name === 'missing array' ? 'event-requirements' : 'event-spec', mutate);
    assert.ok(validateStageEvents(plan, result, workspace.eventsDir, workspace.artifactRoot)
      .some(error => error.includes(message)), `${name} must be rejected`);
  }
});

test('normal domain events advance both the event head and a non-null latest tree', () => {
  const plan = oneUnitClosurePlan();
  const result = resultFixture(plan);
  const workspace = makeEventWorkspace(plan, result, {
    seedDomainEvents: context => seedPriorNormalEvents(context, ['requirements']),
  });
  assert.deepEqual(validateStageEvents(plan, result, workspace.eventsDir, workspace.artifactRoot), []);

  mutateEvent(workspace, 'event-requirements', event => {
    event.post_execution_basis.domain_event_root_snapshots['rdra/events'].latest_tree_sha256 = null;
  });
  assert.ok(validateStageEvents(plan, result, workspace.eventsDir, workspace.artifactRoot)
    .some(error => error.includes('normal domain event must update its domain latest tree')));

  const descendingPlan = oneUnitClosurePlan();
  const descendingResult = resultFixture(descendingPlan);
  const descending = makeEventWorkspace(descendingPlan, descendingResult, {
    seedDomainEvents: context => seedPriorNormalEvents(context, ['requirements'], 'zzz-prior'),
  });
  assert.ok(validateStageEvents(descendingPlan, descendingResult, descending.eventsDir, descending.artifactRoot)
    .some(error => error.includes('event ID must sort after the prior root head')));
});

test('owner merged is stage-local and downstream change deterministically promotes the final result to applied', () => {
  const plan = oneUnitClosurePlan();
  const priorRefs = [
    'rdra/events/000-prior/requirements.tsv',
    'usdm/events/000-prior/requirements.yaml',
  ];
  const finalRefs = [...priorRefs, 'specs/events/domain-spec/spec.yaml'];
  const result = oneUnitResult(plan, {
    work_unit_id: 'CR-1#1',
    disposition: 'applied',
    reason: 'At least one required closure stage changed its domain artifacts.',
    artifact_refs: finalRefs,
  });
  const ownerMerged = {
    work_unit_id: 'CR-1#1',
    disposition: 'merged',
    reason: 'requirements already satisfy the requested change',
    artifact_refs: priorRefs,
  };
  const workspace = makeEventWorkspace(plan, result, {
    seedDomainEvents: context => seedPriorNormalEvents(context, ['requirements']),
    stageOutcomes: {
      requirements: {
        manifest: true,
        workUnitResults: [ownerMerged],
        reconciliationResults: [{
          work_unit_id: 'CR-1#1',
          status: 'already_current',
          reason: ownerMerged.reason,
          artifact_refs: priorRefs,
        }],
      },
    },
  });
  assert.deepEqual(validateStageEvents(plan, result, workspace.eventsDir, workspace.artifactRoot), []);
  assert.deepEqual(validateDeterministicResult(plan, result, workspace.eventsDir), []);

  const falselyMerged = structuredClone(result);
  falselyMerged.work_units[0].disposition = 'merged';
  falselyMerged.work_units[0].reason = 'Every required closure stage was already current or not impacted.';
  assert.ok(validateDeterministicResult(plan, falselyMerged, workspace.eventsDir)
    .some(error => error.includes('deterministic stage-ledger projection')));

  const oneRootOnly = makeEventWorkspace(oneUnitClosurePlan(), structuredClone(result), {
    seedDomainEvents: context => seedPriorNormalEvents(context, ['requirements']),
    stageOutcomes: {
      requirements: {
        manifest: true,
        workUnitResults: [{ ...ownerMerged, artifact_refs: [priorRefs[1]] }],
        reconciliationResults: [{
          work_unit_id: 'CR-1#1', status: 'already_current', reason: ownerMerged.reason,
          artifact_refs: [priorRefs[1]],
        }],
      },
    },
  });
  assert.ok(validateStageEvents(oneUnitClosurePlan(), result, oneRootOnly.eventsDir, oneRootOnly.artifactRoot)
    .some(error => error.includes('every stage domain root')));
});

test('not_impacted and blocked_by_owner produce complete no-change manifests without hiding owner outcomes', () => {
  const notImpactedPlan = oneUnitClosurePlan();
  const notImpactedResult = oneUnitResult(notImpactedPlan, {
    work_unit_id: 'CR-1#1',
    disposition: 'applied',
    reason: 'At least one required closure stage changed its domain artifacts.',
    artifact_refs: [`usdm/events/${REQUIREMENTS_DOMAIN_EVENT_ID}/requirements.yaml`],
  });
  const notImpactedWorkspace = makeEventWorkspace(notImpactedPlan, notImpactedResult, {
    stageOutcomes: {
      spec: {
        manifest: true,
        workUnitResults: [],
        reconciliationResults: [{
          work_unit_id: 'CR-1#1',
          status: 'not_impacted',
          reason: 'the requirements change does not affect the specification domain',
          artifact_refs: [],
        }],
      },
    },
  });
  assert.deepEqual(validateStageEvents(
    notImpactedPlan, notImpactedResult, notImpactedWorkspace.eventsDir, notImpactedWorkspace.artifactRoot,
  ), []);
  assert.deepEqual(validateDeterministicResult(
    notImpactedPlan, notImpactedResult, notImpactedWorkspace.eventsDir,
  ), []);

  const blockedPlan = oneUnitClosurePlan();
  const ownerDeferred = {
    work_unit_id: 'CR-1#1',
    disposition: 'deferred',
    reason: 'deferred by the direct owner',
    artifact_refs: [],
  };
  const blockedReason = 'Blocked by direct owner requirements: deferred by the direct owner';
  const blockedResult = oneUnitResult(blockedPlan, ownerDeferred, 'blocked');
  const blockedOutcome = {
    manifest: true,
    reconciliationResults: [{
      work_unit_id: 'CR-1#1', status: 'blocked_by_owner', reason: blockedReason, artifact_refs: [],
    }],
  };
  const blockedWorkspace = makeEventWorkspace(blockedPlan, blockedResult, {
    seedDomainEvents: context => {
      seedPriorNormalEvents(context, ['requirements']);
      fs.writeFileSync(path.join(context.artifactRoot, 'usdm', 'latest', 'requirements.yaml'), [
        'version: "1.0"',
        'event_id: "20260729_010000_prior"',
        'created_at: "2026-07-29T01:00:00"',
        'source: "prior requirements"',
        'system_name: "Existing test system"',
        'requirements:',
        '  - id: "REQ-900"',
        '    requirement: "Retain the existing requirement"',
        '    reason: "No feedback change is required"',
        '    priority: "must"',
        '    specifications:',
        '      - id: "SPEC-900-01"',
        '        specification: "Retain the existing specification"',
        '        acceptance_criteria:',
        '          - "The existing behavior remains unchanged"',
        '        affected_models:',
        '          - type: "business_policy"',
        '            action: "modify"',
        '            target: "Existing policy"',
        '',
      ].join('\n'));
    },
    stageOutcomes: {
      requirements: { ...blockedOutcome, workUnitResults: [ownerDeferred] },
      spec: { ...blockedOutcome, workUnitResults: [] },
    },
  });
  const blockedSnapshots = snapshotDomainEventRoots(blockedWorkspace.artifactRoot, loadCatalog().value);
  const blockedCurrentBasis = {
    repository_head: blockedPlan.routing_basis.repository_head,
    latest_domain_event_ids: latestDomainEventIdsFromSnapshots(loadCatalog().value, blockedSnapshots),
    domain_event_root_snapshots: blockedSnapshots,
  };
  assert.deepEqual(validateStageEvents(
    blockedPlan,
    blockedResult,
    blockedWorkspace.eventsDir,
    blockedWorkspace.artifactRoot,
    { currentExecutionBasis: blockedCurrentBasis },
  ), []);
  assert.deepEqual(validateDeterministicResult(blockedPlan, blockedResult, blockedWorkspace.eventsDir), []);

  mutateEvent(blockedWorkspace, 'event-spec', event => {
    event.reconciliation_results[0].status = 'not_impacted';
  });
  assert.ok(validateStageEvents(blockedPlan, blockedResult, blockedWorkspace.eventsDir, blockedWorkspace.artifactRoot)
    .some(error => error.includes('owner-deferred/rejected reconciliation must be blocked_by_owner')));
});

test('domain event refs are required, unique, root-contained, existent, and exact-hash bound', () => {
  const plan = planFixture();
  const result = resultFixture(plan);
  const cases = [
    ['missing', event => { delete event.domain_event_refs; }, 'must be an array'],
    ['duplicate', event => { event.domain_event_refs.push(structuredClone(event.domain_event_refs[0])); }, 'duplicate domain_event_ref'],
    ['escape', event => { event.domain_event_refs = [{ path: '../outside.yaml', sha256: '0'.repeat(64) }]; }, 'invalid domain_event_ref'],
    ['missing file', event => { event.domain_event_refs[0].path = 'domain-events/missing.yaml'; }, 'does not exist or escapes'],
    ['hash mismatch', event => { event.domain_event_refs[0].sha256 = '0'.repeat(64); }, 'sha256 mismatch'],
  ];
  for (const [name, mutate, message] of cases) {
    const workspace = makeEventWorkspace(plan, result);
    mutateEvent(workspace, 'event-requirements', mutate);
    assert.ok(
      validateStageEvents(plan, result, workspace.eventsDir, workspace.artifactRoot).some(error => error.includes(message)),
      `${name} domain ref must be rejected`,
    );
  }

  const crossStageDuplicate = makeEventWorkspace(plan, result);
  const first = JSON.parse(fs.readFileSync(eventFile(crossStageDuplicate, 'event-requirements'), 'utf8'));
  mutateEvent(crossStageDuplicate, 'event-spec', event => { event.domain_event_refs = first.domain_event_refs; });
  assert.ok(validateStageEvents(plan, result, crossStageDuplicate.eventsDir, crossStageDuplicate.artifactRoot)
    .some(error => error.includes('outside the catalog roots')));
});

test('domain artifacts carry one canonical nested envelope with exact stage lineage', () => {
  const plan = planFixture();
  const result = resultFixture(plan);
  const jsonDomain = (stage, feedbackRequest) => `${JSON.stringify({
    event_id: `domain-${stage}`,
    feedback_request: feedbackRequest,
  }, null, 2)}\n`;
  const cases = [
    [
      'wrong identity',
      'event-requirements',
      text => text.replace('feedback-request-1', 'feedback-request-other'),
      undefined,
      'feedback identity mismatch',
    ],
    [
      'duplicate work unit',
      'event-requirements',
      text => text.replace('["CR-1#1"]', '["CR-1#1","CR-1#1"]'),
      undefined,
      'work_unit_ids lineage mismatch',
    ],
    [
      'wrong causal order',
      'event-spec',
      text => text.replace('["CR-1#1","CR-1#2"]', '["CR-1#2","CR-1#1"]'),
      undefined,
      'work_unit_ids lineage mismatch',
    ],
    [
      'missing envelope',
      'event-requirements',
      () => `event_id: "${REQUIREMENTS_DOMAIN_EVENT_ID}"\n`,
      undefined,
      'exactly one top-level feedback_request',
    ],
    [
      'duplicate envelope key',
      'event-requirements',
      text => `${text}feedback_request:\n  feedback_request_id: "other"\n`,
      undefined,
      'duplicate top-level key',
    ],
    [
      'quoted key ambiguity',
      'event-requirements',
      text => `${text}"feedback_request": {}\n`,
      undefined,
      'plain safe mapping syntax',
    ],
    [
      'unknown YAML envelope field',
      'event-requirements',
      text => text.replace('  work_unit_ids: ["CR-1#1"]\n', '  work_unit_ids: ["CR-1#1"]\n  unknown: "x"\n'),
      undefined,
      'comment, unknown, duplicate, or multiline field',
    ],
    [
      'multiline YAML envelope field',
      'event-requirements',
      text => text.replace('  request_ids: ["CR-1"]', '  request_ids:\n    - "CR-1"'),
      undefined,
      'missing or out of canonical order',
    ],
    [
      'invalid YAML UTF-8',
      'event-requirements',
      () => Buffer.from([0xff, 0x0a]),
      undefined,
      'must be valid UTF-8',
    ],
    [
      'JSON wrong identity',
      'event-requirements',
      () => jsonDomain('requirements', {
        feedback_request_id: 'feedback-request-other',
        input_sha256: plan.input_sha256,
        request_ids: ['CR-1'],
        work_unit_ids: ['CR-1#1'],
      }),
      'usdm/events/domain-requirements/requirements.json',
      'feedback identity mismatch',
    ],
    [
      'JSON wrong causal order',
      'event-spec',
      () => jsonDomain('spec', {
        feedback_request_id: plan.feedback_request_id,
        input_sha256: plan.input_sha256,
        request_ids: ['CR-1'],
        work_unit_ids: ['CR-1#2', 'CR-1#1'],
      }),
      'specs/events/domain-spec/spec.json',
      'work_unit_ids lineage mismatch',
    ],
    [
      'JSON unknown envelope field',
      'event-requirements',
      () => jsonDomain('requirements', {
        feedback_request_id: plan.feedback_request_id,
        input_sha256: plan.input_sha256,
        request_ids: ['CR-1'],
        work_unit_ids: ['CR-1#1'],
        unknown: 'x',
      }),
      'usdm/events/domain-requirements/requirements.json',
      'exactly the canonical lineage fields',
    ],
    [
      'extension and syntax mismatch',
      'event-requirements',
      () => jsonDomain('requirements', {
        feedback_request_id: plan.feedback_request_id,
        input_sha256: plan.input_sha256,
        request_ids: ['CR-1'],
        work_unit_ids: ['CR-1#1'],
      }),
      undefined,
      'plain safe mapping syntax',
    ],
    [
      'unsupported extension',
      'event-requirements',
      text => text,
      'usdm/events/domain-requirements/requirements.txt',
      'invalid domain_event_ref',
    ],
  ];
  for (const [name, eventId, rewrite, replacementPath, message] of cases) {
    const workspace = makeEventWorkspace(plan, result);
    rewriteDomainEvent(workspace, eventId, rewrite, replacementPath);
    assert.ok(
      validateStageEvents(plan, result, workspace.eventsDir, workspace.artifactRoot)
        .some(error => error.includes(message)),
      `${name} domain lineage must be rejected`,
    );
  }

  const duplicateJson = makeEventWorkspace(plan, result);
  const canonical = `${JSON.stringify({
    event_id: REQUIREMENTS_DOMAIN_EVENT_ID,
    feedback_request: {
      feedback_request_id: plan.feedback_request_id,
      input_sha256: plan.input_sha256,
      request_ids: ['CR-1'],
      work_unit_ids: ['CR-1#1'],
    },
  }, null, 2)}\n`;
  rewriteDomainEvent(duplicateJson, 'event-requirements', () => canonical.replace(
    '  "feedback_request": {',
    '  "feedback_request": {},\n  "feedback_request": {',
  ), 'usdm/events/domain-requirements/requirements.json');
  assert.ok(validateStageEvents(plan, result, duplicateJson.eventsDir, duplicateJson.artifactRoot)
    .some(error => error.includes('canonical two-space JSON formatting')));
});

test('artifact refs resolve only to regular files whose real path stays inside artifact root', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-artifact-ref-'));
  const artifactRoot = path.join(root, 'artifacts');
  const validTarget = path.join(artifactRoot, 'docs', 'valid.md');
  const directoryTarget = path.join(artifactRoot, 'docs', 'directory');
  const outsideTarget = path.join(root, 'outside.md');
  fs.mkdirSync(path.dirname(validTarget), { recursive: true });
  fs.mkdirSync(directoryTarget);
  fs.writeFileSync(validTarget, 'valid\n');
  fs.writeFileSync(outsideTarget, 'outside\n');

  assert.equal(resolveArtifactRef('docs/valid.md', artifactRoot), fs.realpathSync(validTarget));
  assert.equal(resolveArtifactRef('docs/directory', artifactRoot), null);
  assert.equal(resolveArtifactRef('../outside.md', artifactRoot), null);

  const escapingLink = path.join(artifactRoot, 'docs', 'escaping-link.md');
  fs.symlinkSync(outsideTarget, escapingLink);
  assert.equal(resolveArtifactRef('docs/escaping-link.md', artifactRoot), null);

  const containedLink = path.join(artifactRoot, 'docs', 'contained-link.md');
  fs.symlinkSync(validTarget, containedLink);
  assert.equal(resolveArtifactRef('docs/contained-link.md', artifactRoot), null);
});

test('failed stage events may have no domain refs but must explain phase and reason', () => {
  const plan = planFixture();
  const failed = resultFixture(plan);
  failed.stages[0].state = 'failed';
  failed.stages[1].state = 'not_attempted';
  failed.stages[1].event_ids = [];

  const noArtifacts = makeEventWorkspace(plan, failed);
  mutateEvent(noArtifacts, 'event-requirements', event => { event.domain_event_refs = []; });
  assert.deepEqual(validateStageEvents(plan, failed, noArtifacts.eventsDir, noArtifacts.artifactRoot), []);

  const missingArray = makeEventWorkspace(plan, failed);
  mutateEvent(missingArray, 'event-requirements', event => { delete event.domain_event_refs; });
  assert.ok(validateStageEvents(plan, failed, missingArray.eventsDir, missingArray.artifactRoot)
    .some(error => error.includes('domain_event_refs must be an array')));

  for (const [field, value] of [['phase', ''], ['reason', 'line one\nline two'], ['reason', 'line one\u2028line two']]) {
    const invalidExplanation = makeEventWorkspace(plan, failed);
    mutateEvent(invalidExplanation, 'event-requirements', event => { event[field] = value; });
    assert.ok(validateStageEvents(plan, failed, invalidExplanation.eventsDir, invalidExplanation.artifactRoot)
      .some(error => error.includes(`failed stage event ${field}`)));
  }

  const invalidOptionalRef = makeEventWorkspace(plan, failed);
  mutateEvent(invalidOptionalRef, 'event-requirements', event => {
    event.domain_event_refs = [{ path: 'usdm/events/partial/requirements.yaml', sha256: '0'.repeat(64) }];
  });
  assert.ok(validateStageEvents(plan, failed, invalidOptionalRef.eventsDir, invalidOptionalRef.artifactRoot)
    .some(error => error.includes('failed stage event domain_event_refs must be empty')));
});

test('status snapshot is exactly reconciled with result terminal stage states and event IDs', () => {
  const plan = planFixture();
  const result = resultFixture(plan);
  const status = statusFixture(plan, result);
  assert.deepEqual(validateStatus(plan, status, result), []);

  const wrongState = structuredClone(status);
  wrongState.stages[0].state = 'failed';
  assert.ok(validateStatus(plan, wrongState, result).some(error => error.includes('does not match result state')));
  const wrongEvent = structuredClone(status);
  wrongEvent.stages[0].event_ids = ['other-event'];
  assert.ok(validateStatus(plan, wrongEvent, result).some(error => error.includes('exactly match')));
  const transientStage = structuredClone(status);
  transientStage.stages[0].state = 'running';
  assert.ok(validateStatus(plan, transientStage, result, { preCompletion: true })
    .some(error => error.includes('completed, failed, or not_attempted')));

  const preCompletion = statusFixture(plan, result, 'running');
  assert.deepEqual(validateStatus(plan, preCompletion, result, { preCompletion: true }), []);
  assert.ok(validateStatus(plan, preCompletion, result).some(error => error.includes('status state must be completed')));
  const stalePlanned = statusFixture(plan, result, 'planned');
  assert.ok(validateStatus(plan, stalePlanned, result, { preCompletion: true })
    .some(error => error.includes('running or completed')));

  const failedResult = resultFixture(plan);
  failedResult.status = 'blocked';
  failedResult.stages[0].state = 'failed';
  failedResult.stages[1].state = 'not_attempted';
  failedResult.stages[1].event_ids = [];
  const failedStatus = statusFixture(plan, failedResult, 'blocked');
  assert.equal(failedStatus.stages[0].state, 'failed');
  assert.equal(failedStatus.stages[1].state, 'not_attempted');
  assert.deepEqual(validateStatus(plan, failedStatus, failedResult), []);
});

test('mixed success and request rejection/deferment is partial, while execution failure remains explicit', () => {
  assert.equal(deriveRequestDisposition([{ disposition: 'applied' }, { disposition: 'rejected' }]), 'partially_applied');
  assert.equal(deriveRequestDisposition([{ disposition: 'merged' }, { disposition: 'deferred' }]), 'partially_applied');
  assert.equal(deriveRequestDisposition([{ disposition: 'applied' }, { disposition: 'execution_failed' }]), 'execution_failed');

  const plan = planFixture();
  const result = resultFixture(plan);
  result.status = 'blocked';
  result.work_units[1].disposition = 'rejected';
  result.work_units[1].artifact_refs = [];
  result.requests[0].disposition = 'partially_applied';
  result.requests[0].reason = 'Some work units are satisfied (applied or merged), while others are not.';
  assert.deepEqual(validateResult(plan, result), []);
  result.requests[0].disposition = 'rejected';
  assert.ok(validateResult(plan, result).some(error => error.includes('(partially_applied)')));
});

test('terminal event binds its directory ID, result hash, lineage, and required execution identity', () => {
  const plan = planFixture();
  const result = resultFixture(plan);
  result.run_id = 'run-1';
  result.attempt = 2;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-terminal-hardening-'));
  const eventsDir = path.join(root, 'events');
  const resultPath = path.join(root, 'result.json');
  fs.mkdirSync(path.join(eventsDir, result.terminal_event_id), { recursive: true });
  fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  const terminalPath = path.join(eventsDir, result.terminal_event_id, 'event.json');
  const terminal = {
    event_id: result.terminal_event_id,
    type: 'feedback_run_completed',
    run_id: result.run_id,
    attempt: result.attempt,
    result_sha256: sha256Bytes(fs.readFileSync(resultPath)),
    feedback_request: {
      feedback_request_id: plan.feedback_request_id,
      input_sha256: plan.input_sha256,
      request_ids: plan.request_ids,
      work_unit_ids: plan.work_units.map(unit => unit.id),
    },
    work_unit_dispositions: result.work_units.map(unit => ({
      work_unit_id: unit.work_unit_id,
      disposition: unit.disposition,
    })),
  };
  fs.writeFileSync(terminalPath, `${JSON.stringify(terminal, null, 2)}\n`);
  assert.deepEqual(validateTerminalEvent(plan, result, resultPath, eventsDir, {
    run: { run_id: 'run-1', attempt: 2 },
    status: { run_id: 'run-1', attempt: 2 },
  }), []);

  fs.writeFileSync(terminalPath, fs.readFileSync(terminalPath, 'utf8').replace(
    '  "type": "feedback_run_completed",',
    '  "type": "feedback_run_aborted",\n  "type": "feedback_run_completed",',
  ));
  assert.ok(validateTerminalEvent(plan, result, resultPath, eventsDir)
    .some(error => error.includes('canonical two-space JSON')));

  terminal.event_id = 'different-terminal';
  terminal.attempt = 3;
  fs.writeFileSync(terminalPath, `${JSON.stringify(terminal, null, 2)}\n`);
  const errors = validateTerminalEvent(plan, result, resultPath, eventsDir, {
    run: { run_id: 'run-1', attempt: 2 },
  });
  assert.ok(errors.some(error => error.includes('does not match its directory')));
  assert.ok(errors.some(error => error.includes('execution identity must match exactly')));
});

test('execution lifecycle binds controller events to unique monotonic started attempts', () => {
  const setup = () => {
    const plan = planFixture();
    const result = resultFixture(plan);
    const status = statusFixture(plan, result, 'running');
    const workspace = makeEventWorkspace(plan, result);
    const writeEvent = (eventId, event) => {
      const eventDir = path.join(workspace.eventsDir, eventId);
      fs.mkdirSync(eventDir, { recursive: true });
      fs.writeFileSync(path.join(eventDir, 'event.json'), `${JSON.stringify({ event_id: eventId, ...event }, null, 2)}\n`);
    };
    const lineage = {
      feedback_request_id: plan.feedback_request_id,
      input_sha256: plan.input_sha256,
      request_ids: plan.request_ids,
      work_unit_ids: plan.work_units.map(unit => unit.id),
    };
    writeEvent('event-started-1', {
      type: 'feedback_run_started', run_id: result.run_id, attempt: result.attempt, feedback_request: lineage,
    });
    return { plan, result, status, workspace, writeEvent, lineage };
  };

  const valid = setup();
  assert.deepEqual(validateExecutionLifecycle(
    valid.plan, valid.status, valid.result, valid.workspace.eventsDir, valid.workspace.artifactRoot, { preCompletion: true },
  ).errors, []);

  const retry = setup();
  retry.writeEvent('event-aborted-1', {
    type: 'feedback_run_aborted', run_id: 'run-1', attempt: 1,
    phase: 'stage_execution', reason: 'controller interrupted after a durable checkpoint',
    feedback_request: retry.lineage,
  });
  retry.writeEvent('event-started-2', {
    type: 'feedback_run_started', run_id: 'run-2', attempt: 2, feedback_request: retry.lineage,
  });
  Object.assign(retry.status, { run_id: 'run-2', attempt: 2 });
  Object.assign(retry.result, { run_id: 'run-2', attempt: 2 });
  assert.deepEqual(validateExecutionLifecycle(
    retry.plan, retry.status, retry.result, retry.workspace.eventsDir, retry.workspace.artifactRoot, { preCompletion: true },
  ).errors, []);

  const missingAbort = setup();
  missingAbort.writeEvent('event-started-2', {
    type: 'feedback_run_started', run_id: 'run-2', attempt: 2, feedback_request: missingAbort.lineage,
  });
  Object.assign(missingAbort.status, { run_id: 'run-2', attempt: 2 });
  Object.assign(missingAbort.result, { run_id: 'run-2', attempt: 2 });
  assert.ok(validateExecutionLifecycle(
    missingAbort.plan, missingAbort.status, missingAbort.result,
    missingAbort.workspace.eventsDir, missingAbort.workspace.artifactRoot, { preCompletion: true },
  ).errors.some(error => error.includes('attempt 1 requires exactly 1')));

  const abortedAwaitingRetry = setup();
  abortedAwaitingRetry.status.state = 'aborted';
  abortedAwaitingRetry.writeEvent('event-aborted-1', {
    type: 'feedback_run_aborted', run_id: 'run-1', attempt: 1,
    phase: 'stage_execution', reason: 'hard failure was reconciled before retry',
    feedback_request: abortedAwaitingRetry.lineage,
  });
  assert.deepEqual(validateExecutionLifecycle(
    abortedAwaitingRetry.plan, abortedAwaitingRetry.status, null,
    abortedAwaitingRetry.workspace.eventsDir, abortedAwaitingRetry.workspace.artifactRoot,
  ).errors, []);

  const duplicate = setup();
  duplicate.writeEvent('event-started-duplicate', {
    type: 'feedback_run_started', run_id: 'run-duplicate', attempt: 1, feedback_request: duplicate.lineage,
  });
  assert.ok(validateExecutionLifecycle(
    duplicate.plan, duplicate.status, duplicate.result, duplicate.workspace.eventsDir, duplicate.workspace.artifactRoot, { preCompletion: true },
  ).errors.some(error => error.includes('attempt must be unique')));

  const nonMonotonic = setup();
  nonMonotonic.writeEvent('event-started-3', {
    type: 'feedback_run_started', run_id: 'run-3', attempt: 3, feedback_request: nonMonotonic.lineage,
  });
  Object.assign(nonMonotonic.status, { run_id: 'run-3', attempt: 3 });
  Object.assign(nonMonotonic.result, { run_id: 'run-3', attempt: 3 });
  assert.ok(validateExecutionLifecycle(
    nonMonotonic.plan, nonMonotonic.status, nonMonotonic.result,
    nonMonotonic.workspace.eventsDir, nonMonotonic.workspace.artifactRoot, { preCompletion: true },
  ).errors.some(error => error.includes('contiguous and monotonically')));

  const extraStage = setup();
  const extra = JSON.parse(fs.readFileSync(eventFile(extraStage.workspace, 'event-requirements'), 'utf8'));
  extra.event_id = 'event-extra-stage';
  extraStage.writeEvent('event-extra-stage', extra);
  assert.ok(validateExecutionLifecycle(
    extraStage.plan, extraStage.status, extraStage.result,
    extraStage.workspace.eventsDir, extraStage.workspace.artifactRoot, { preCompletion: true },
  ).errors.some(error => error.includes('stage event set must exactly match')));

  const malformedAbort = setup();
  malformedAbort.writeEvent('event-aborted', {
    type: 'feedback_run_aborted', run_id: 'run-1', attempt: 1, feedback_request: malformedAbort.lineage,
  });
  assert.ok(validateExecutionLifecycle(
    malformedAbort.plan, malformedAbort.status, malformedAbort.result,
    malformedAbort.workspace.eventsDir, malformedAbort.workspace.artifactRoot, { preCompletion: true },
  ).errors.some(error => error.includes('pre-result feedback_run_aborted phase')));

  const duplicateTerminal = setup();
  duplicateTerminal.status.state = 'completed';
  for (const eventId of ['event-terminal', 'event-terminal-extra']) {
    duplicateTerminal.writeEvent(eventId, {
      type: 'feedback_run_completed', run_id: 'run-1', attempt: 1, result_sha256: 'b'.repeat(64),
      feedback_request: duplicateTerminal.lineage,
    });
  }
  assert.ok(validateExecutionLifecycle(
    duplicateTerminal.plan, duplicateTerminal.status, duplicateTerminal.result,
    duplicateTerminal.workspace.eventsDir, duplicateTerminal.workspace.artifactRoot,
  ).errors.some(error => error.includes('exactly one result-bound terminal')));
});
