#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  parseYaml: parseRequirementsYaml,
  validateFeedbackLineage: validateRequirementsFeedbackLineage,
  validateRequirementsDocument,
} = require('../../dist-requirements/scripts/validateRequirements');
const { parseCanonicalJsonBytes, readCanonicalJson } = require('./canonicalJson');
const { isPortableRelativePath, parseFeedbackRequest, sha256Bytes } = require('./feedbackRequest');
const {
  applyResolutions,
  buildPlan,
  buildRouting,
  canonicalize,
  deriveRepositoryHead,
  domainEventRoots,
  latestDomainEventIdsFromSnapshots,
  loadCatalog,
  loadRunBasisSnapshots,
  renderStagePacket,
  snapshotDomainEventDirectory,
  snapshotDomainEventRoots,
  validateDomainEventRootSnapshots,
  validateLatestDomainEventIds,
} = require('./planFeedbackRequest');

const WORK_UNIT_DISPOSITIONS = Object.freeze([
  'applied', 'merged', 'deferred', 'rejected', 'routed_outside', 'execution_failed',
]);
const REQUEST_DISPOSITIONS = Object.freeze([
  'applied', 'merged', 'deferred', 'rejected', 'routed_outside', 'execution_failed', 'partially_applied',
]);
const DIRECT_WORK_UNIT_DISPOSITIONS = Object.freeze(['applied', 'merged', 'deferred', 'rejected']);
const RECONCILIATION_STATUSES = Object.freeze([
  'changed', 'already_current', 'not_impacted', 'blocked_by_owner',
]);
const REQUEST_REASON_TEMPLATES = Object.freeze({
  applied: 'At least one work unit was applied and all work units completed successfully.',
  merged: 'Every work unit completed with all required closure stages already current or not impacted.',
  deferred: 'At least one work unit was deferred and none was applied, merged, rejected, or execution-failed.',
  rejected: 'At least one work unit was rejected and no work unit completed successfully.',
  routed_outside: 'All work units were routed outside dist-pipeline.',
  execution_failed: 'Execution failed before every work unit completed its required stage closure.',
  partially_applied: 'Some work units are satisfied (applied or merged), while others are not.',
});
const OUTSIDE_REASON = 'Routed outside dist-pipeline by the frozen ownership decision.';
const APPLIED_CLOSURE_REASON = 'At least one required closure stage changed its domain artifacts.';
const MERGED_CLOSURE_REASON = 'Every required closure stage was already current or not impacted.';
const NO_DOMAIN_CHANGE_SCHEMA = 'distillery.feedback-no-domain-change/v1';
const RDRA_MEMBER_MANIFEST_SCHEMA = 'distillery.rdra-feedback-event/v1';
const TERMINAL_STAGE_STATES = Object.freeze(['succeeded', 'failed', 'not_attempted']);
const SUCCESS_DISPOSITIONS = new Set(['applied', 'merged']);
const STATUS_STAGE_TO_RESULT_STATE = Object.freeze({
  completed: 'succeeded',
  failed: 'failed',
  not_attempted: 'not_attempted',
});
const SHA256_RE = /^[0-9a-f]{64}$/;
const CONTROLLER_EVENT_TYPES = new Set([
  'feedback_run_started',
  'feedback_stage_completed',
  'feedback_stage_failed',
  'feedback_run_completed',
  'feedback_run_aborted',
]);

function readJson(filePath) {
  return readCanonicalJson(filePath);
}

function assertSafeRunEvidenceTree(runDir, containmentRoot = runDir) {
  const root = path.resolve(runDir);
  const boundary = path.resolve(containmentRoot);
  if (root !== boundary && !root.startsWith(`${boundary}${path.sep}`)) throw new Error('run directory escapes artifact root');
  const expectedRunRoot = path.join(boundary, 'pipeline', 'feedback-runs');
  if (path.dirname(root) !== expectedRunRoot) {
    throw new Error('run directory must use artifactRoot/pipeline/feedback-runs/{feedback_id}');
  }
  const boundaryStat = fs.lstatSync(boundary);
  if (boundaryStat.isSymbolicLink() || !boundaryStat.isDirectory()) throw new Error('artifact root must be a real directory, not a symlink');
  let component = boundary;
  for (const segment of path.relative(boundary, root).split(path.sep).filter(Boolean)) {
    component = path.join(component, segment);
    const stat = fs.lstatSync(component);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`run directory ancestor must be a real directory, not a symlink: ${component}`);
  }
  const rootStat = fs.lstatSync(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error('run directory must be a real directory, not a symlink');
  const realRoot = fs.realpathSync(root);
  const assertFile = (filePath, required = true) => {
    if (!fs.existsSync(filePath)) {
      if (required) throw new Error(`required run evidence is missing: ${filePath}`);
      return;
    }
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`run evidence must be a regular file, not a symlink: ${filePath}`);
    const real = fs.realpathSync(filePath);
    if (!real.startsWith(`${realRoot}${path.sep}`)) throw new Error(`run evidence escapes run directory: ${filePath}`);
  };
  for (const name of ['input.md', 'run.json', 'routing.json', 'plan.json', 'status.json', 'result.json']) {
    assertFile(path.join(root, name));
  }
  for (const name of ['ownership-catalog.json', 'routing-policy.json', 'prompt-data-policy.txt']) {
    assertFile(path.join(root, name));
  }
  assertFile(path.join(root, 'resolutions.json'), false);
  if (fs.existsSync(path.join(root, 'initialization-in-progress.json'))) {
    throw new Error('run initialization is still in progress');
  }
  const packetDir = path.join(root, 'stage-packets');
  if (fs.existsSync(packetDir)) {
    const stat = fs.lstatSync(packetDir);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('stage-packets must be a real directory, not a symlink');
    if (!fs.realpathSync(packetDir).startsWith(`${realRoot}${path.sep}`)) throw new Error('stage-packets escapes run directory');
    for (const entry of fs.readdirSync(packetDir)) assertFile(path.join(packetDir, entry));
  }
}

function assertSafeEventsTree(eventsDir, artifactRoot) {
  const root = path.resolve(artifactRoot);
  const events = path.resolve(eventsDir);
  const expected = path.join(root, 'pipeline', 'events');
  if (events !== expected) throw new Error('events directory must use artifactRoot/pipeline/events');
  let component = root;
  for (const segment of ['pipeline', 'events']) {
    component = path.join(component, segment);
    const stat = fs.lstatSync(component);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`events directory ancestor must be a real directory, not a symlink: ${component}`);
    }
  }
  const realRoot = fs.realpathSync(root);
  const realEvents = fs.realpathSync(events);
  if (!realEvents.startsWith(`${realRoot}${path.sep}`)) throw new Error('events directory escapes artifact root');
}

function sameMembers(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  return canonicalize([...left].sort()) === canonicalize([...right].sort());
}

function validateRequiredExecutionIdentity(source, label) {
  const errors = [];
  if (typeof source?.run_id !== 'string' || source.run_id.trim() === '' || /[\0\r\n]/.test(source.run_id)) {
    errors.push(`${label} run_id must be a non-empty single-line string`);
  }
  if (!Number.isSafeInteger(source?.attempt) || source.attempt < 1) {
    errors.push(`${label} attempt must be a positive integer`);
  }
  return errors;
}

function sameExecutionIdentity(left, right) {
  return left?.run_id === right?.run_id && left?.attempt === right?.attempt;
}

function deriveRequestDisposition(workUnits) {
  const dispositions = workUnits.map(item => item.disposition);
  if (dispositions.length === 0) return 'execution_failed';
  if (dispositions.includes('execution_failed')) return 'execution_failed';
  if (dispositions.every(value => value === 'routed_outside')) return 'routed_outside';
  if (dispositions.every(value => value === 'merged')) return 'merged';
  if (dispositions.every(value => SUCCESS_DISPOSITIONS.has(value)) && dispositions.includes('applied')) return 'applied';
  if (dispositions.some(value => SUCCESS_DISPOSITIONS.has(value))) return 'partially_applied';
  if (dispositions.includes('rejected')) return 'rejected';
  if (dispositions.includes('deferred')) return 'deferred';
  return 'partially_applied';
}

function requestReasonForDisposition(disposition) {
  return REQUEST_REASON_TEMPLATES[disposition];
}

function validateStageResults(plan, result) {
  const errors = [];
  if (!Array.isArray(result.stages)) return ['result.stages must be an array'];
  const expectedIds = plan.execution_stages.map(stage => stage.id);
  if (result.stages.length !== expectedIds.length || result.stages.some((stage, index) => stage.stage_id !== expectedIds[index])) {
    errors.push('result.stages must cover planned execution stages exactly once and in order');
    return errors;
  }
  let failureSeen = false;
  const usedEventIds = new Set();
  for (let index = 0; index < result.stages.length; index++) {
    const actual = result.stages[index];
    const planned = plan.execution_stages[index];
    if (!TERMINAL_STAGE_STATES.includes(actual.state)) errors.push(`${actual.stage_id}: invalid terminal stage state`);
    if (!sameMembers(actual.causal_work_unit_ids, planned.causal_work_unit_ids)) errors.push(`${actual.stage_id}: causal_work_unit_ids mismatch`);
    if (!sameMembers(actual.direct_work_unit_ids, planned.direct_work_unit_ids)) errors.push(`${actual.stage_id}: direct_work_unit_ids mismatch`);
    if (!Array.isArray(actual.event_ids)) errors.push(`${actual.stage_id}: event_ids must be an array`);
    for (const eventId of actual.event_ids || []) {
      if (usedEventIds.has(eventId)) errors.push(`stage event_id must be globally unique: ${eventId}`);
      usedEventIds.add(eventId);
    }
    if (failureSeen && actual.state !== 'not_attempted') errors.push(`${actual.stage_id}: stages after a failure must be not_attempted`);
    if (!failureSeen && actual.state === 'not_attempted') errors.push(`${actual.stage_id}: not_attempted requires an earlier failed stage`);
    if (actual.state === 'failed') {
      if (failureSeen) errors.push(`${actual.stage_id}: only the first failed stage may be executed`);
      failureSeen = true;
    }
    if ((actual.state === 'succeeded' || actual.state === 'failed') && (!Array.isArray(actual.event_ids) || actual.event_ids.length !== 1)) {
      errors.push(`${actual.stage_id}: an executed stage requires exactly one event_id`);
    }
    if (actual.state === 'not_attempted' && actual.event_ids?.length) errors.push(`${actual.stage_id}: not_attempted stage may not have event_ids`);
  }
  return errors;
}

function validateStatus(plan, status, result, options = {}) {
  const errors = [];
  if (!status || status.schema_version !== 'distillery.feedback-run-status/v1') {
    errors.push('status schema_version must be distillery.feedback-run-status/v1');
    return errors;
  }
  if (status.feedback_request_id !== plan.feedback_request_id || status.input_sha256 !== plan.input_sha256 ||
      status.ambiguity_policy !== plan.ambiguity_policy) {
    errors.push('status identity mismatch');
  }
  if (['running', 'aborted', 'completed', 'blocked'].includes(status.state)) {
    errors.push(...validateRequiredExecutionIdentity(status, 'started status'));
  }

  if (!Array.isArray(status.stages)) return [...errors, 'status.stages must be an array'];
  if (!Array.isArray(result?.stages)) return [...errors, 'result.stages must be an array for status comparison'];
  if (status.stages.length !== plan.execution_stages.length || result.stages.length !== plan.execution_stages.length) {
    return [...errors, 'status and result stages must cover planned execution stages exactly once and in order'];
  }

  for (let index = 0; index < plan.execution_stages.length; index++) {
    const planned = plan.execution_stages[index];
    const snapshot = status.stages[index];
    const terminal = result.stages[index];
    if (snapshot.id !== planned.id || terminal.stage_id !== planned.id) {
      errors.push('status and result stages must cover planned execution stages exactly once and in order');
      continue;
    }
    if (!sameMembers(snapshot.direct_work_unit_ids, planned.direct_work_unit_ids) ||
        !sameMembers(snapshot.direct_work_unit_ids, terminal.direct_work_unit_ids)) {
      errors.push(`${planned.id}: status direct_work_unit_ids mismatch`);
    }
    if (!sameMembers(snapshot.causal_work_unit_ids, planned.causal_work_unit_ids) ||
        !sameMembers(snapshot.causal_work_unit_ids, terminal.causal_work_unit_ids)) {
      errors.push(`${planned.id}: status causal_work_unit_ids mismatch`);
    }
    const expectedResultState = STATUS_STAGE_TO_RESULT_STATE[snapshot.state];
    if (!expectedResultState) {
      errors.push(`${planned.id}: status stage state must be completed, failed, or not_attempted`);
    } else if (expectedResultState !== terminal.state) {
      errors.push(`${planned.id}: status stage state ${snapshot.state} does not match result state ${terminal.state}`);
    }
    if (!Array.isArray(snapshot.event_ids) || canonicalize(snapshot.event_ids) !== canonicalize(terminal.event_ids)) {
      errors.push(`${planned.id}: status event_ids must exactly match result event_ids`);
    }
  }

  const allowedOverallStates = options.preCompletion ? new Set(['running', result.status]) : new Set([result.status]);
  if (!allowedOverallStates.has(status.state)) {
    const expected = options.preCompletion ? `running or ${result.status}` : result.status;
    errors.push(`status state must be ${expected}`);
  }
  return errors;
}

function validateResult(plan, result) {
  const errors = [];
  if (!result || result.schema_version !== 'distillery.feedback-result/v1') errors.push('result schema_version must be distillery.feedback-result/v1');
  if (result?.feedback_request_id !== plan.feedback_request_id) errors.push('result feedback_request_id mismatch');
  if (result?.input_sha256 !== plan.input_sha256) errors.push('result input_sha256 mismatch');
  if (!['completed', 'blocked'].includes(result?.status)) errors.push('result status must be completed or blocked');
  errors.push(...validateRequiredExecutionIdentity(result, 'result'));
  errors.push(...validateStageResults(plan, result || {}));
  if (!Array.isArray(result?.work_units)) return [...errors, 'result.work_units must be an array'];
  const plannedById = new Map(plan.work_units.map(unit => [unit.id, unit]));
  const actualById = new Map(result.work_units.map(unit => [unit.work_unit_id, unit]));
  if (actualById.size !== result.work_units.length || actualById.size !== plannedById.size ||
      [...plannedById.keys()].some(id => !actualById.has(id)) ||
      canonicalize(result.work_units.map(unit => unit.work_unit_id)) !== canonicalize(plan.work_units.map(unit => unit.id))) {
    errors.push('result.work_units must cover every planned work unit exactly once and in plan order');
  }
  const stageById = new Map((result.stages || []).map(stage => [stage.stage_id, stage]));
  const globalFailure = (result.stages || []).find(stage => stage.state === 'failed');
  for (const [id, planned] of plannedById) {
    const actual = actualById.get(id);
    if (!actual) continue;
    if (!WORK_UNIT_DISPOSITIONS.includes(actual.disposition)) errors.push(`${id}: invalid disposition`);
    if (typeof actual.reason !== 'string' || actual.reason.trim() === '' || /[\0\r\n\u2028\u2029]/.test(actual.reason)) {
      errors.push(`${id}: reason must be a non-empty single-line string`);
    }
    if (!Array.isArray(actual.artifact_refs)) errors.push(`${id}: artifact_refs must be an array`);
    if (planned.required_closure_stages.length === 0) {
      if (actual.disposition !== 'routed_outside') errors.push(`${id}: outside work unit must be routed_outside`);
      if (!actual.artifact_refs?.some(ref => typeof ref === 'string' && ref.startsWith('route:'))) errors.push(`${id}: routed_outside requires a route: reference`);
      continue;
    }
    const closure = planned.required_closure_stages.map(stage => stageById.get(stage));
    const incomplete = closure.find(stage => !stage || stage.state !== 'succeeded');
    if (incomplete) {
      if (!['execution_failed', 'deferred', 'rejected'].includes(actual.disposition)) {
        errors.push(`${id}: incomplete closure must use execution_failed unless its direct owner already deferred or rejected it`);
      }
      if (actual.disposition === 'execution_failed') {
        if (!globalFailure) errors.push(`${id}: incomplete closure must identify an executed failed stage`);
        if (globalFailure && (actual.failure_stage !== globalFailure.stage_id || !globalFailure.event_ids.includes(actual.caused_by_event_id))) {
          errors.push(`${id}: execution_failed must name the causal failed stage and event`);
        }
      }
    } else {
      if (actual.disposition === 'execution_failed' || actual.disposition === 'routed_outside') errors.push(`${id}: successful closure has an invalid disposition`);
      if (SUCCESS_DISPOSITIONS.has(actual.disposition) && actual.artifact_refs?.length === 0) errors.push(`${id}: successful application requires artifact_refs`);
    }
  }
  if (!Array.isArray(result?.requests)) return [...errors, 'result.requests must be an array'];
  const requestById = new Map(result.requests.map(request => [request.request_id, request]));
  if (requestById.size !== result.requests.length || requestById.size !== plan.request_ids.length ||
      plan.request_ids.some(id => !requestById.has(id)) ||
      canonicalize(result.requests.map(request => request.request_id)) !== canonicalize(plan.request_ids)) {
    errors.push('result.requests must cover every source request exactly once and in source order');
  }
  for (const requestId of plan.request_ids) {
    const request = requestById.get(requestId);
    if (!request) continue;
    if (!REQUEST_DISPOSITIONS.includes(request.disposition)) errors.push(`${requestId}: invalid request disposition`);
    const children = result.work_units.filter(unit => plannedById.get(unit.work_unit_id)?.request_id === requestId);
    if (!sameMembers(request.work_unit_ids, children.map(unit => unit.work_unit_id))) errors.push(`${requestId}: work_unit_ids mismatch`);
    const derived = deriveRequestDisposition(children);
    if (request.disposition !== derived) errors.push(`${requestId}: request disposition must be derived from all work units (${derived})`);
    const expectedReason = requestReasonForDisposition(derived);
    if (request.reason !== expectedReason) errors.push(`${requestId}: request reason must equal the deterministic ${derived} template`);
  }
  const allApplied = result.work_units.length > 0 && result.work_units.every(unit => SUCCESS_DISPOSITIONS.has(unit.disposition));
  if ((result.status === 'completed') !== allApplied) errors.push('result status is completed only when every work unit is successfully applied or merged');
  return errors;
}

function resolveArtifactRef(reference, artifactRoot) {
  if (!isPortableRelativePath(reference) || reference.startsWith('route:')) return null;
  const root = path.resolve(artifactRoot);
  const candidate = path.resolve(root, reference);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return null;
  if (!fs.existsSync(candidate)) return null;
  try {
    const candidateStat = fs.lstatSync(candidate);
    if (candidateStat.isSymbolicLink() || !candidateStat.isFile()) return null;
    const realRoot = fs.realpathSync(root);
    const realCandidate = fs.realpathSync(candidate);
    if (!realCandidate.startsWith(`${realRoot}${path.sep}`) || !fs.statSync(realCandidate).isFile()) return null;
    return realCandidate;
  } catch {
    return null;
  }
}

function eventPath(eventsDir, eventId) {
  if (!SAFE_EVENT_ID_RE.test(eventId || '')) return null;
  const root = path.resolve(eventsDir);
  const eventDir = path.join(root, eventId);
  const candidate = path.resolve(root, eventId, 'event.json');
  if (!fs.existsSync(candidate)) return null;
  try {
    const rootStat = fs.lstatSync(root);
    const eventDirStat = fs.lstatSync(eventDir);
    const candidateStat = fs.lstatSync(candidate);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory() ||
        eventDirStat.isSymbolicLink() || !eventDirStat.isDirectory() ||
        candidateStat.isSymbolicLink() || !candidateStat.isFile()) return null;
    const realRoot = fs.realpathSync(root);
    const realCandidate = fs.realpathSync(candidate);
    if (!realCandidate.startsWith(`${realRoot}${path.sep}`) ||
        path.basename(path.dirname(realCandidate)) !== eventId ||
        !fs.statSync(realCandidate).isFile()) return null;
    return realCandidate;
  } catch {
    return null;
  }
}

const SAFE_EVENT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,191}$/;

function resolveDomainEventRef(reference, artifactRoot) {
  if (!reference || typeof reference !== 'object' || Array.isArray(reference) ||
      !isPortableRelativePath(reference.path) || !SHA256_RE.test(reference.sha256 || '')) return null;
  const root = path.resolve(artifactRoot);
  const candidate = path.resolve(root, reference.path);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return null;
  if (!fs.existsSync(candidate)) return null;
  try {
    const candidateStat = fs.lstatSync(candidate);
    if (candidateStat.isSymbolicLink() || !candidateStat.isFile()) return null;
    const realRoot = fs.realpathSync(root);
    const realCandidate = fs.realpathSync(candidate);
    if (!realCandidate.startsWith(`${realRoot}${path.sep}`) || !fs.statSync(realCandidate).isFile()) return null;
    return realCandidate;
  } catch {
    return null;
  }
}

function parseDomainFeedbackEnvelope(filePath) {
  const bytes = fs.readFileSync(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const expectedKeys = ['feedback_request_id', 'input_sha256', 'request_ids', 'work_unit_ids'];
  if (extension === '.json') {
    const document = parseCanonicalJsonBytes(bytes, 'JSON domain event');
    const envelope = document?.feedback_request;
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) throw new Error('missing nested feedback_request object');
    if (canonicalize(Object.keys(envelope)) !== canonicalize(expectedKeys)) {
      throw new Error('feedback_request object must contain exactly the canonical lineage fields in canonical order');
    }
    return envelope;
  }
  if (!['.yaml', '.yml'].includes(extension)) throw new Error('domain event must use a .json, .yaml, or .yml extension');

  const text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes)) throw new Error('YAML domain event must be valid UTF-8');
  if (text.includes('\r')) throw new Error('YAML domain event must use LF newlines');
  const lines = text.split('\n');
  const topLevel = [];
  const topLevelKeys = new Set();
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line === '' || line.startsWith('#') || /^\s/.test(line)) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):(.*)$/);
    if (!match) throw new Error(`YAML top-level keys must use plain safe mapping syntax at line ${index + 1}`);
    const [, key, remainder] = match;
    if (topLevelKeys.has(key)) throw new Error(`YAML contains a duplicate top-level key: ${key}`);
    topLevelKeys.add(key);
    topLevel.push({ key, index, remainder });
  }
  const envelopeEntry = topLevel.find(entry => entry.key === 'feedback_request');
  if (!envelopeEntry) throw new Error('YAML must contain exactly one top-level feedback_request envelope');
  if (envelopeEntry.remainder !== '') throw new Error('YAML feedback_request must use exactly "feedback_request:" with an empty value');
  const start = envelopeEntry.index;
  const nextTopLevel = topLevel.find(entry => entry.index > start)?.index ?? lines.length;
  const fields = {};
  for (let offset = 0; offset < expectedKeys.length; offset++) {
    const key = expectedKeys[offset];
    const line = lines[start + 1 + offset];
    if (typeof line !== 'string' || line.includes('\t')) {
      throw new Error('YAML feedback_request envelope contains forbidden syntax');
    }
    const match = line.match(new RegExp(`^  ${key}: (.+)$`));
    if (!match) throw new Error(`YAML feedback_request field is missing or out of canonical order: ${key}`);
    let value;
    try {
      value = JSON.parse(match[1]);
    } catch {
      throw new Error(`YAML feedback_request field must use JSON-compatible quoted syntax: ${key}`);
    }
    if (match[1] !== JSON.stringify(value)) {
      throw new Error(`YAML feedback_request field must use canonical JSON-compatible syntax: ${key}`);
    }
    fields[key] = value;
  }
  for (let index = start + 1 + expectedKeys.length; index < nextTopLevel; index++) {
    if (lines[index] === '') continue;
    throw new Error('YAML feedback_request envelope contains a comment, unknown, duplicate, or multiline field');
  }
  return fields;
}

function classifyFeedbackIdentity(lineage, plan) {
  const feedbackIdMatches = lineage?.feedback_request_id === plan.feedback_request_id;
  const inputShaMatches = lineage?.input_sha256 === plan.input_sha256;
  if (feedbackIdMatches && inputShaMatches) return 'exact';
  if (feedbackIdMatches || inputShaMatches) return 'partial';
  return 'unrelated';
}

function scanControllerEvents(plan, eventsDir, artifactRoot) {
  if (!fs.existsSync(eventsDir)) return { events: [], errors: [] };
  assertSafeEventsTree(eventsDir, artifactRoot);
  const events = [];
  const errors = [];
  for (const entry of fs.readdirSync(eventsDir)) {
    if (!SAFE_EVENT_ID_RE.test(entry)) throw new Error(`events directory contains an unsafe event ID: ${entry}`);
    const target = eventPath(eventsDir, entry);
    if (!target) {
      errors.push(`stage event does not exist or is not a safe regular event file: ${entry}`);
      continue;
    }
    let event;
    try {
      event = readJson(target);
    } catch (error) {
      errors.push(`controller event is not canonical JSON: ${entry} (${error.message})`);
      continue;
    }
    if (!CONTROLLER_EVENT_TYPES.has(event.type)) continue;
    const match = classifyFeedbackIdentity(event.feedback_request, plan);
    if (match === 'unrelated') continue;
    if (match === 'partial') {
      errors.push(`controller event ${entry} has a partial feedback lineage match; reconciliation required`);
      continue;
    }
    if (event.event_id !== entry) errors.push(`controller event_id does not match its directory: ${entry}`);
    errors.push(...validateRequiredExecutionIdentity(event, `controller event ${entry}`));
    events.push({ eventId: entry, event, target });
  }
  return { events, errors };
}

function validateExecutionLifecycle(plan, status, result, eventsDir, artifactRoot, options = {}) {
  const scanned = scanControllerEvents(plan, eventsDir, artifactRoot);
  const errors = [...scanned.errors];
  const started = scanned.events.filter(item => item.event.type === 'feedback_run_started');
  const startedByAttempt = new Map();
  const startedByExecution = new Map();
  const runIds = new Set();
  for (const item of started) {
    const { event, eventId } = item;
    if (!sameMembers(event.feedback_request?.request_ids, plan.request_ids) ||
        !sameMembers(event.feedback_request?.work_unit_ids, plan.work_units.map(unit => unit.id))) {
      errors.push(`feedback_run_started lineage mismatch: ${eventId}`);
    }
    if (startedByAttempt.has(event.attempt)) errors.push(`feedback_run_started attempt must be unique: ${event.attempt}`);
    else startedByAttempt.set(event.attempt, item);
    const executionKey = `${event.run_id}\0${event.attempt}`;
    if (startedByExecution.has(executionKey)) errors.push(`feedback_run_started execution identity must be unique: ${eventId}`);
    else startedByExecution.set(executionKey, item);
    if (runIds.has(event.run_id)) errors.push(`feedback_run_started run_id must identify only one attempt: ${event.run_id}`);
    runIds.add(event.run_id);
  }
  const attempts = [...startedByAttempt.keys()].filter(Number.isSafeInteger).sort((left, right) => left - right);
  for (let index = 0; index < attempts.length; index++) {
    if (attempts[index] !== index + 1) {
      errors.push('feedback_run_started attempts must be contiguous and monotonically increase from 1');
      break;
    }
  }
  const latestStarted = attempts.length ? startedByAttempt.get(attempts.at(-1)) : null;
  const preResultAbortsByExecution = new Map();
  for (const item of scanned.events) {
    if (item.event.type === 'feedback_run_started') continue;
    const key = `${item.event.run_id}\0${item.event.attempt}`;
    if (!startedByExecution.has(key)) {
      errors.push(`controller event ${item.eventId} is not bound to a feedback_run_started execution identity`);
    }
    if (item.event.type === 'feedback_run_aborted' && !Object.hasOwn(item.event, 'result_sha256')) {
      const abortKey = `${item.event.run_id}\0${item.event.attempt}`;
      const aborts = preResultAbortsByExecution.get(abortKey) || [];
      aborts.push(item);
      preResultAbortsByExecution.set(abortKey, aborts);
      for (const field of ['phase', 'reason']) {
        if (typeof item.event[field] !== 'string' || item.event[field].trim() === '' || /[\0\r\n\u2028\u2029]/.test(item.event[field])) {
          errors.push(`pre-result feedback_run_aborted ${field} must be a non-empty single-line string: ${item.eventId}`);
        }
      }
    }
  }
  for (let index = 0; index < attempts.length; index++) {
    const startedItem = startedByAttempt.get(attempts[index]);
    const key = `${startedItem.event.run_id}\0${startedItem.event.attempt}`;
    const abortCount = (preResultAbortsByExecution.get(key) || []).length;
    const hasLaterAttempt = index < attempts.length - 1;
    const latestIsAwaitingRetry = !hasLaterAttempt && status?.state === 'aborted';
    const expectedAbortCount = hasLaterAttempt || latestIsAwaitingRetry ? 1 : 0;
    if (abortCount !== expectedAbortCount) {
      errors.push(`execution attempt ${startedItem.event.attempt} requires exactly ${expectedAbortCount} pre-result feedback_run_aborted event(s)`);
    }
  }

  if (status?.state === 'planned') {
    if (Object.hasOwn(status, 'run_id') || Object.hasOwn(status, 'attempt')) {
      errors.push('planned status must not claim an execution identity before feedback_run_started');
    }
    if (started.length > 0) errors.push('feedback_run_started is not reflected by planned status; start/status reconciliation required');
  } else if (['running', 'aborted', 'completed', 'blocked'].includes(status?.state)) {
    errors.push(...validateRequiredExecutionIdentity(status, 'started status'));
    if (!latestStarted || !sameExecutionIdentity(status, latestStarted.event)) {
      errors.push('status execution identity must match the latest feedback_run_started attempt');
    }
  }

  if (result) {
    errors.push(...validateRequiredExecutionIdentity(result, 'result'));
    if (!sameExecutionIdentity(status, result)) errors.push('result execution identity must match status');
    if (!latestStarted || !sameExecutionIdentity(result, latestStarted.event)) {
      errors.push('result execution identity must match the latest feedback_run_started attempt');
    }
    const referencedStageEventIds = new Set((result.stages || []).flatMap(stage => stage.event_ids || []));
    const controllerStageEvents = scanned.events.filter(item =>
      ['feedback_stage_completed', 'feedback_stage_failed'].includes(item.event.type));
    const plannedStageIds = new Set(plan.execution_stages.map(stage => stage.id));
    if (controllerStageEvents.some(item => !plannedStageIds.has(item.event.stage))) {
      errors.push('controller stage event targets a stage outside the frozen plan');
    }
    const actualStageEventIds = new Set(controllerStageEvents.map(item => item.eventId));
    if (actualStageEventIds.size !== referencedStageEventIds.size ||
        [...actualStageEventIds].some(eventId => !referencedStageEventIds.has(eventId))) {
      errors.push('controller stage event set must exactly match status/result event_ids');
    }
  }

  const terminalEvents = scanned.events.filter(item => item.event.type === 'feedback_run_completed' ||
    (item.event.type === 'feedback_run_aborted' && Object.hasOwn(item.event, 'result_sha256')));
  if (options.nonterminal && terminalEvents.length > 0) {
    errors.push('terminal controller event is not reflected by nonterminal status; terminal reconciliation required');
  }
  if (options.preCompletion && terminalEvents.length > 0) {
    errors.push('pre-completion verification found an existing terminal controller event; terminal reconciliation required');
  }
  if (result && !options.preCompletion) {
    if (terminalEvents.length !== 1) errors.push('terminal execution must have exactly one result-bound terminal controller event');
    const terminal = terminalEvents.find(item => item.eventId === result.terminal_event_id);
    if (!terminal) errors.push('result terminal_event_id must identify a terminal controller event');
    else if (!latestStarted || !sameExecutionIdentity(terminal.event, latestStarted.event)) {
      errors.push('terminal event execution identity must match the latest feedback_run_started attempt');
    }
  }
  return { events: scanned.events, errors, latestStarted };
}

function isContainedPath(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function resolveSafeDomainRoot(artifactRoot, relativeRoot) {
  let component = path.resolve(artifactRoot);
  const realArtifactRoot = fs.realpathSync(component);
  for (const segment of relativeRoot.split('/')) {
    component = path.join(component, segment);
    if (!fs.existsSync(component)) return null;
    const stat = fs.lstatSync(component);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`domain event root component must be a real directory: ${relativeRoot}`);
    }
  }
  if (!isContainedPath(realArtifactRoot, fs.realpathSync(component))) {
    throw new Error(`domain event root escapes artifact root: ${relativeRoot}`);
  }
  return component;
}

function walkDomainEventFiles(rootPath, artifactRoot, output, seenDirectories = new Set()) {
  const stat = fs.lstatSync(rootPath);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`domain event root must be a real directory: ${rootPath}`);
  const realArtifactRoot = fs.realpathSync(artifactRoot);
  const realRoot = fs.realpathSync(rootPath);
  if (!isContainedPath(realArtifactRoot, realRoot)) throw new Error(`domain event root escapes artifact root: ${rootPath}`);
  if (seenDirectories.has(realRoot)) return;
  seenDirectories.add(realRoot);
  for (const entry of fs.readdirSync(rootPath)) {
    const candidate = path.join(rootPath, entry);
    const candidateStat = fs.lstatSync(candidate);
    if (candidateStat.isSymbolicLink()) throw new Error(`domain event tree must not contain symlinks: ${candidate}`);
    if (candidateStat.isDirectory()) walkDomainEventFiles(candidate, artifactRoot, output, seenDirectories);
    else if (candidateStat.isFile() && /\.(?:json|ya?ml)$/.test(entry)) output.push(candidate);
  }
}

function validateDomainCheckpointCoverage(plan, controllerEvents, artifactRoot, catalog) {
  const errors = [];
  const plannedStages = new Map(plan.execution_stages.map(stage => [stage.id, stage]));
  const catalogStages = new Map(catalog.stages.map(stage => [stage.id, stage]));
  const referencedPaths = new Map();
  for (const { event, eventId } of controllerEvents) {
    if (!['feedback_stage_completed', 'feedback_stage_failed'].includes(event.type)) continue;
    const catalogStage = catalogStages.get(event.stage);
    if (!plannedStages.has(event.stage) || !catalogStage) continue;
    const allowedRoots = catalogStage.domain_event_roots.map(root => resolveSafeDomainRoot(artifactRoot, root)).filter(Boolean);
    for (const reference of event.domain_event_refs || []) {
      const target = resolveDomainEventRef(reference, artifactRoot);
      if (!target) continue;
      const inAllowedRoot = allowedRoots.some(root => {
        if (!fs.existsSync(root)) return false;
        return isContainedPath(fs.realpathSync(root), target);
      });
      if (!inAllowedRoot) errors.push(`domain_event_ref is outside the catalog roots for ${event.stage}: ${reference.path}`);
      if (referencedPaths.has(target)) errors.push(`domain event is referenced by multiple controller events: ${reference.path}`);
      else referencedPaths.set(target, eventId);
    }
  }

  const files = [];
  const roots = new Set(catalog.stages.flatMap(stage => stage.domain_event_roots || []));
  for (const root of roots) {
    const absoluteRoot = resolveSafeDomainRoot(artifactRoot, root);
    if (!absoluteRoot) continue;
    walkDomainEventFiles(absoluteRoot, artifactRoot, files);
  }
  const seenFiles = new Set();
  for (const filePath of files) {
    const realPath = fs.realpathSync(filePath);
    if (seenFiles.has(realPath)) continue;
    seenFiles.add(realPath);
    const bytes = fs.readFileSync(filePath);
    const containsFeedbackId = bytes.includes(Buffer.from(plan.feedback_request_id, 'utf8'));
    const containsInputSha = bytes.includes(Buffer.from(plan.input_sha256, 'utf8'));
    if (!containsFeedbackId && !containsInputSha) continue;
    let lineage;
    try {
      lineage = parseDomainFeedbackEnvelope(filePath);
    } catch (error) {
      errors.push(`domain checkpoint contains current feedback identity but has an invalid envelope: ${filePath} (${error.message})`);
      continue;
    }
    const match = classifyFeedbackIdentity(lineage, plan);
    if (match === 'unrelated') continue;
    if (match === 'partial') {
      errors.push(`domain checkpoint has a partial feedback lineage match: ${filePath}; domain reconciliation required`);
    } else if (!referencedPaths.has(realPath)) {
      errors.push(`domain checkpoint is not referenced by a controller stage event: ${filePath}; domain reconciliation required`);
    }
  }
  return errors;
}

function validateDomainFeedbackEnvelope(filePath, expected) {
  let envelope;
  try {
    envelope = parseDomainFeedbackEnvelope(filePath);
  } catch (error) {
    return [`domain event feedback lineage cannot be parsed: ${filePath} (${error.message})`];
  }
  const errors = [];
  if (envelope.feedback_request_id !== expected.feedback_request_id || envelope.input_sha256 !== expected.input_sha256) {
    errors.push(`domain event feedback identity mismatch: ${filePath}`);
  }
  for (const [field, values] of [['request_ids', expected.request_ids], ['work_unit_ids', expected.work_unit_ids]]) {
    if (!Array.isArray(envelope[field]) || envelope[field].some(value => typeof value !== 'string') ||
        new Set(envelope[field]).size !== envelope[field].length || canonicalize(envelope[field]) !== canonicalize(values)) {
      errors.push(`domain event ${field} lineage mismatch: ${filePath}`);
    }
  }
  return errors;
}

function validateOptionalRunIdentity(event, context, label) {
  const errors = [];
  const sources = [context?.run, context?.status, context?.result, event].filter(Boolean);
  const runIds = sources.filter(source => Object.hasOwn(source, 'run_id')).map(source => source.run_id);
  if (runIds.some(value => typeof value !== 'string' || value.trim() === '' || /[\0\r\n]/.test(value))) {
    errors.push(`${label} run_id must be a non-empty single-line string when present`);
  } else if (new Set(runIds).size > 1) {
    errors.push(`${label} run_id mismatch`);
  }
  const attempts = sources.filter(source => Object.hasOwn(source, 'attempt')).map(source => source.attempt);
  if (attempts.some(value => !Number.isSafeInteger(value) || value < 1)) {
    errors.push(`${label} attempt must be a positive integer when present`);
  } else if (new Set(attempts).size > 1) {
    errors.push(`${label} attempt mismatch`);
  }
  return errors;
}

function hasExactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) &&
    canonicalize(Object.keys(value)) === canonicalize(keys);
}

function isNonEmptySingleLine(value) {
  return typeof value === 'string' && value.trim() !== '' && !/[\0\r\n\u2028\u2029]/.test(value);
}

function validatePostExecutionBasis(value, catalog, label = 'post_execution_basis') {
  const errors = [];
  if (!hasExactKeys(value, ['repository_head', 'latest_domain_event_ids', 'domain_event_root_snapshots'])) {
    return [`${label} must contain exactly repository_head, latest_domain_event_ids, and domain_event_root_snapshots`];
  }
  if (!isNonEmptySingleLine(value.repository_head)) {
    errors.push(`${label}.repository_head must be an explicit non-empty single-line value`);
  }
  try {
    validateLatestDomainEventIds(value.latest_domain_event_ids, catalog);
  } catch (error) {
    errors.push(`${label}: ${error.message}`);
  }
  try {
    validateDomainEventRootSnapshots(value.domain_event_root_snapshots, catalog);
  } catch (error) {
    errors.push(`${label}: ${error.message}`);
  }
  return errors;
}

function validateStageWorkUnitResults(event, plannedStage, artifactRoot, eventId, catalog, initialRoutingBasis = {}) {
  const errors = [];
  if (!Array.isArray(event.work_unit_results)) {
    return [`stage event work_unit_results must be an array: ${eventId}`];
  }
  if (event.type === 'feedback_stage_failed') {
    if (event.work_unit_results.length !== 0) errors.push(`failed stage event work_unit_results must be empty: ${eventId}`);
    return errors;
  }
  const expectedIds = plannedStage.direct_work_unit_ids;
  const ownerRoots = catalog.stages.find(stage => stage.id === plannedStage.id)?.domain_event_roots || [];
  const currentDomainDirectories = new Set((event.domain_event_refs || []).map(reference => {
    const root = domainEventRoots(catalog).find(candidate => reference.path?.startsWith(`${candidate}/`));
    if (!root) return null;
    return `${root}/${reference.path.slice(root.length + 1).split('/')[0]}`;
  }).filter(Boolean));
  const currentNormalDomainDirectories = new Set((event.domain_event_refs || [])
    .filter(reference => path.basename(reference.path || '') !== 'feedback-disposition.json')
    .map(reference => {
      const root = domainEventRoots(catalog).find(candidate => reference.path?.startsWith(`${candidate}/`));
      if (!root) return null;
      return `${root}/${reference.path.slice(root.length + 1).split('/')[0]}`;
    }).filter(Boolean));
  if (canonicalize(event.work_unit_results.map(item => item?.work_unit_id)) !== canonicalize(expectedIds)) {
    errors.push(`stage event work_unit_results must cover direct work units exactly once and in plan order: ${eventId}`);
  }
  for (const item of event.work_unit_results) {
    const label = `${eventId}/${item?.work_unit_id || '<missing>'}`;
    if (!hasExactKeys(item, ['work_unit_id', 'disposition', 'reason', 'artifact_refs'])) {
      errors.push(`work_unit_result must contain exactly work_unit_id, disposition, reason, and artifact_refs: ${label}`);
      continue;
    }
    if (!DIRECT_WORK_UNIT_DISPOSITIONS.includes(item.disposition)) errors.push(`invalid direct work unit disposition: ${label}`);
    if (!isNonEmptySingleLine(item.reason)) errors.push(`work_unit_result reason must be a non-empty single-line string: ${label}`);
    if (!Array.isArray(item.artifact_refs) || item.artifact_refs.some(ref => typeof ref !== 'string') ||
        new Set(item.artifact_refs).size !== item.artifact_refs.length) {
      errors.push(`work_unit_result artifact_refs must be a unique string array: ${label}`);
      continue;
    }
    if (SUCCESS_DISPOSITIONS.has(item.disposition)) {
      if (item.artifact_refs.length === 0) errors.push(`applied or merged work_unit_result requires artifact_refs: ${label}`);
      let hasOwnerPriorEvidence = false;
      for (const reference of item.artifact_refs) {
        if (!resolveArtifactRef(reference, artifactRoot)) {
          errors.push(`work_unit_result artifact_ref does not exist, is a symlink, or escapes artifact root: ${reference}`);
        }
        if (item.disposition === 'merged') {
          const root = domainEventRoots(catalog).find(candidate => reference.startsWith(`${candidate}/`));
          const relative = root ? reference.slice(root.length + 1) : '';
          const domainEventId = relative.split('/')[0];
          const dispositionSibling = root && domainEventId
            ? path.join(artifactRoot, root, domainEventId, 'feedback-disposition.json')
            : null;
          if (!root || !SAFE_EVENT_ID_RE.test(domainEventId || '') || !relative.includes('/') ||
              path.basename(reference) === 'feedback-disposition.json' ||
              (dispositionSibling && fs.existsSync(dispositionSibling)) ||
              currentDomainDirectories.has(`${root}/${domainEventId}`)) {
            errors.push(`merged artifact_ref must identify an immutable prior catalog domain event member: ${reference}`);
          }
          const initialEventIds = initialRoutingBasis.domain_event_root_snapshots?.[root]?.event_ids || [];
          if (!initialEventIds.includes(domainEventId)) {
            errors.push(`merged artifact_ref must belong to a domain event present in the frozen pre-run root set: ${reference}`);
          }
          if (ownerRoots.includes(root) && initialEventIds.includes(domainEventId)) hasOwnerPriorEvidence = true;
        }
      }
      if (item.disposition === 'applied' && !item.artifact_refs.some(reference =>
        [...currentNormalDomainDirectories].some(directory => reference.startsWith(`${directory}/`)))) {
        errors.push(`applied work_unit_result must reference at least one member of this stage current normal domain event: ${label}`);
      }
      if (item.disposition === 'merged' && !hasOwnerPriorEvidence) {
        errors.push(`merged work_unit_result must reference the frozen pre-run event set of a direct-owner domain root: ${label}`);
      }
    } else if (item.artifact_refs.length !== 0) {
      errors.push(`deferred or rejected work_unit_result artifact_refs must be empty: ${label}`);
    }
  }
  return errors;
}

function currentRequirementsWorkUnitIds(plan) {
  return new Set((plan.work_units || [])
    .filter(unit => unit.direct_stage === 'requirements')
    .map(unit => unit.id));
}

function touchesCurrentRequirementsFeedback(node, plan, currentWorkUnitIds) {
  const source = node?.feedback_source;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return false;
  return source.feedback_request_id === plan.feedback_request_id ||
    (Array.isArray(source.work_unit_ids) && source.work_unit_ids.some(id => currentWorkUnitIds.has(id)));
}

function validateRequirementsEventScope(data, plan) {
  const errors = [];
  const currentWorkUnitIds = currentRequirementsWorkUnitIds(plan);
  for (const requirement of data.requirements || []) {
    const hasCurrentMarker = touchesCurrentRequirementsFeedback(requirement, plan, currentWorkUnitIds) ||
      (requirement.specifications || []).some(specification =>
        touchesCurrentRequirementsFeedback(specification, plan, currentWorkUnitIds));
    if (!hasCurrentMarker) {
      errors.push(`requirements owner ledger contains a REQ subtree without current feedback lineage: ${requirement.id}`);
    }
  }
  return errors;
}

function sameDomainEventSet(left, right) {
  return Array.isArray(left?.event_ids) && Array.isArray(right?.event_ids) &&
    canonicalize(left.event_ids) === canonicalize(right.event_ids);
}

function validateObservedRootProgress(recordedBasis, observedBasis, catalog, artifactRoot) {
  const errors = [];
  const recordedSnapshots = recordedBasis?.domain_event_root_snapshots;
  const observedSnapshots = observedBasis?.domain_event_root_snapshots;
  if (!recordedSnapshots || !observedSnapshots) return errors;
  for (const root of domainEventRoots(catalog)) {
    const recorded = recordedSnapshots[root];
    const observed = observedSnapshots[root];
    if (!recorded || !observed) {
      errors.push(`observed domain root snapshot is missing: ${root}`);
      continue;
    }
    const observedIds = new Set(observed.event_ids || []);
    const missingRecordedIds = (recorded.event_ids || []).filter(id => !observedIds.has(id));
    if (missingRecordedIds.length > 0) {
      errors.push(`observed domain root lost recorded event directories: ${root}/${missingRecordedIds.join(',')}`);
      continue;
    }
    if (sameDomainEventSet(recorded, observed)) {
      if (canonicalize(recorded) !== canonicalize(observed)) {
        errors.push(`observed domain root changed without an appended event directory: ${root}`);
      }
      continue;
    }
    if (recorded.head_event_id !== null &&
        (observed.head_event_id === null || observed.head_event_id <= recorded.head_event_id)) {
      errors.push(`observed domain root did not advance beyond its recorded head: ${root}`);
      continue;
    }
    if (recorded.head_event_id !== null) {
      try {
        const observedRecordedHeadSha = snapshotDomainEventDirectory(
          artifactRoot,
          root,
          recorded.head_event_id,
        );
        if (observedRecordedHeadSha !== recorded.head_event_sha256) {
          errors.push(`observed domain root mutated its recorded head event: ${root}/${recorded.head_event_id}`);
        }
      } catch (error) {
        errors.push(`observed domain root recorded head cannot be verified: ${root}/${recorded.head_event_id} (${error.message})`);
      }
    }
  }
  return errors;
}

function validateRequirementsLatestProjection(eventData, plan, appliedWorkUnitIds, artifactRoot, eventId, options = {}) {
  const errors = [];
  const latestPath = 'usdm/latest/requirements.yaml';
  const latestTarget = resolveArtifactRef(latestPath, artifactRoot);
  if (!latestTarget) return options.allowMissing
    ? []
    : [`requirements current projection is missing, unsafe, or not a regular file: ${eventId}/${latestPath}`];
  let latestData;
  try {
    latestData = parseRequirementsYaml(fs.readFileSync(latestTarget, 'utf8'));
  } catch (error) {
    return [`requirements current projection cannot be parsed: ${eventId}/${latestPath} (${error.message})`];
  }
  for (const finding of validateRequirementsDocument(latestData)) {
    errors.push(`requirements current projection schema mismatch: ${latestPath} ${finding.path}: ${finding.message}`);
  }
  for (const finding of validateRequirementsFeedbackLineage(latestData, plan, { appliedWorkUnitIds })) {
    errors.push(`requirements current projection lineage mismatch: ${latestPath} ${finding.path}: ${finding.message}`);
  }
  if (eventData.system_name !== undefined && latestData.system_name !== eventData.system_name) {
    errors.push(`requirements current projection system_name must exactly match the event document: ${latestPath}`);
  }
  const eventRequirements = eventData.requirements || [];
  const latestById = new Map((latestData.requirements || []).map(requirement => [requirement.id, requirement]));
  const divergentIds = eventRequirements
    .filter(requirement => canonicalize(latestById.get(requirement.id)) !== canonicalize(requirement))
    .map(requirement => requirement.id);
  const eventIds = new Set(eventRequirements.map(requirement => requirement.id));
  const currentWorkUnitIds = currentRequirementsWorkUnitIds(plan);
  const unexpectedCurrentIds = (latestData.requirements || [])
    .filter(requirement => !eventIds.has(requirement.id) && (
      touchesCurrentRequirementsFeedback(requirement, plan, currentWorkUnitIds) ||
      (requirement.specifications || []).some(specification =>
        touchesCurrentRequirementsFeedback(specification, plan, currentWorkUnitIds))
    ))
    .map(requirement => requirement.id);
  if (divergentIds.length > 0 || unexpectedCurrentIds.length > 0) {
    errors.push(`requirements current projection must exactly preserve every event REQ subtree and current-run scope: ${latestPath}`);
  }
  return errors;
}

function validateRequirementsOwnerLedgerBinding(
  event,
  plannedStage,
  plan,
  artifactRoot,
  eventId,
  currentExecutionBasis,
) {
  if (event.type !== 'feedback_stage_completed' || plannedStage.id !== 'requirements') return [];
  const errors = [];
  const appliedWorkUnitIds = (event.work_unit_results || [])
    .filter(item => item?.disposition === 'applied')
    .map(item => item.work_unit_id);
  const requirementsRefs = (event.domain_event_refs || []).filter(reference =>
    reference?.path?.startsWith('usdm/events/') &&
    path.basename(reference.path) === 'requirements.yaml');
  if (appliedWorkUnitIds.length > 0 && requirementsRefs.length !== 1) {
    errors.push(`requirements stage with applied owner work must reference exactly one current normal USDM requirements document: ${eventId}`);
    return errors;
  }
  if (requirementsRefs.length > 1) {
    errors.push(`requirements stage may reference at most one current normal USDM requirements document: ${eventId}`);
    return errors;
  }
  const eventUsdmSnapshot = event.post_execution_basis?.domain_event_root_snapshots?.['usdm/events'];
  const currentUsdmSnapshot = currentExecutionBasis?.domain_event_root_snapshots?.['usdm/events'];
  const validatesCurrentProjection = Boolean(currentExecutionBasis && eventUsdmSnapshot && currentUsdmSnapshot &&
    sameDomainEventSet(eventUsdmSnapshot, currentUsdmSnapshot));
  if (requirementsRefs.length === 0) {
    if (validatesCurrentProjection) {
      errors.push(...validateRequirementsLatestProjection(
        { requirements: [] },
        plan,
        appliedWorkUnitIds,
        artifactRoot,
        eventId,
        { allowMissing: true },
      ));
    }
    return errors;
  }
  const reference = requirementsRefs[0];
  const target = resolveArtifactRef(reference.path, artifactRoot);
  if (!target) {
    errors.push(`requirements owner ledger document does not exist, is a symlink, or escapes artifact root: ${reference.path}`);
    return errors;
  }
  let data;
  try {
    data = parseRequirementsYaml(fs.readFileSync(target, 'utf8'));
  } catch (error) {
    errors.push(`requirements owner ledger document cannot be parsed: ${reference.path} (${error.message})`);
    return errors;
  }
  const domainEventId = path.basename(path.dirname(target));
  if (data.event_id !== domainEventId) {
    errors.push(`requirements owner ledger event_id must match its domain event directory: ${reference.path}`);
  }
  for (const finding of validateRequirementsDocument(data)) {
    errors.push(`requirements owner ledger schema mismatch: ${reference.path} ${finding.path}: ${finding.message}`);
  }
  for (const finding of validateRequirementsFeedbackLineage(data, plan, { appliedWorkUnitIds })) {
    errors.push(`requirements owner ledger binding mismatch: ${reference.path} ${finding.path}: ${finding.message}`);
  }
  errors.push(...validateRequirementsEventScope(data, plan));
  if (validatesCurrentProjection) {
    errors.push(...validateRequirementsLatestProjection(
      data,
      plan,
      appliedWorkUnitIds,
      artifactRoot,
      eventId,
    ));
  }
  return errors;
}

function blockedByOwnerReason(plannedUnit, ownerResult) {
  return `Blocked by direct owner ${plannedUnit.direct_stage}: ${ownerResult.reason}`;
}

function validateReconciliationResults(
  event,
  plannedStage,
  artifactRoot,
  eventId,
  catalog,
  priorRootSnapshots,
  ownerResultsByWorkUnit,
  unitById,
) {
  const errors = [];
  if (!Array.isArray(event.reconciliation_results)) {
    return [`stage event reconciliation_results must be an array: ${eventId}`];
  }
  if (event.type === 'feedback_stage_failed') {
    if (event.reconciliation_results.length !== 0) {
      errors.push(`failed stage event reconciliation_results must be empty: ${eventId}`);
    }
    return errors;
  }
  if (canonicalize(event.reconciliation_results.map(item => item?.work_unit_id)) !==
      canonicalize(plannedStage.causal_work_unit_ids)) {
    errors.push(`stage event reconciliation_results must cover causal work units exactly once and in plan order: ${eventId}`);
  }
  const stageRoots = catalog.stages.find(stage => stage.id === plannedStage.id)?.domain_event_roots || [];
  const allRoots = domainEventRoots(catalog);
  const currentNormalDirectories = new Set((event.domain_event_refs || [])
    .filter(reference => path.basename(reference.path || '') !== 'feedback-disposition.json')
    .map(reference => {
      const root = allRoots.find(candidate => reference.path?.startsWith(`${candidate}/`));
      if (!root) return null;
      return `${root}/${reference.path.slice(root.length + 1).split('/')[0]}`;
    }).filter(Boolean));
  for (const item of event.reconciliation_results) {
    const label = `${eventId}/${item?.work_unit_id || '<missing>'}`;
    if (!hasExactKeys(item, ['work_unit_id', 'status', 'reason', 'artifact_refs'])) {
      errors.push(`reconciliation_result must contain exactly work_unit_id, status, reason, and artifact_refs: ${label}`);
      continue;
    }
    if (!RECONCILIATION_STATUSES.includes(item.status)) {
      errors.push(`invalid reconciliation_result status: ${label}`);
    }
    if (!isNonEmptySingleLine(item.reason)) {
      errors.push(`reconciliation_result reason must be a non-empty single-line string: ${label}`);
    }
    if (!Array.isArray(item.artifact_refs) || item.artifact_refs.some(ref => typeof ref !== 'string') ||
        new Set(item.artifact_refs).size !== item.artifact_refs.length) {
      errors.push(`reconciliation_result artifact_refs must be a unique string array: ${label}`);
      continue;
    }
    const plannedUnit = unitById.get(item.work_unit_id);
    const ownerResult = ownerResultsByWorkUnit.get(item.work_unit_id);
    if (!plannedUnit || !ownerResult) {
      errors.push(`reconciliation_result cannot be bound to its direct owner result: ${label}`);
      continue;
    }
    const isDirectOwnerStage = plannedStage.direct_work_unit_ids.includes(item.work_unit_id);
    if (isDirectOwnerStage) {
      const expectedStatus = {
        applied: 'changed',
        merged: 'already_current',
        deferred: 'blocked_by_owner',
        rejected: 'blocked_by_owner',
      }[ownerResult.disposition];
      if (item.status !== expectedStatus) {
        errors.push(`direct-owner reconciliation status must be mechanically derived from work_unit_results: ${label}`);
      }
      if (['applied', 'merged'].includes(ownerResult.disposition) &&
          (canonicalize(item.artifact_refs) !== canonicalize(ownerResult.artifact_refs) || item.reason !== ownerResult.reason)) {
        errors.push(`accepted direct-owner reconciliation must exactly bind its work_unit_result: ${label}`);
      }
    }
    if (['deferred', 'rejected'].includes(ownerResult.disposition)) {
      if (item.status !== 'blocked_by_owner' || item.reason !== blockedByOwnerReason(plannedUnit, ownerResult)) {
        errors.push(`owner-deferred/rejected reconciliation must be blocked_by_owner with the canonical owner reason: ${label}`);
      }
    } else if (item.status === 'blocked_by_owner') {
      errors.push(`accepted owner reconciliation may not be blocked_by_owner: ${label}`);
    }
    if (item.status === 'changed') {
      if (item.artifact_refs.length === 0) {
        errors.push(`changed reconciliation_result requires artifact_refs: ${label}`);
      }
      let hasCurrentStageEvidence = false;
      for (const reference of item.artifact_refs) {
        if (!resolveArtifactRef(reference, artifactRoot)) {
          errors.push(`changed reconciliation artifact_ref does not exist, is a symlink, or escapes artifact root: ${reference}`);
        }
        const belongsToCurrentStageEvent = [...currentNormalDirectories]
          .some(directory => reference.startsWith(`${directory}/`));
        if (belongsToCurrentStageEvent) {
          hasCurrentStageEvidence = true;
        } else {
          errors.push(`changed reconciliation artifact_ref must be stage-local current normal evidence: ${reference}`);
        }
      }
      if (!hasCurrentStageEvidence) {
        errors.push(`changed reconciliation_result must reference this stage current normal domain event: ${label}`);
      }
    } else if (item.status === 'already_current') {
      if (item.artifact_refs.length === 0) {
        errors.push(`already_current reconciliation_result requires artifact_refs: ${label}`);
      }
      const evidencedRoots = new Set();
      for (const reference of item.artifact_refs) {
        const root = allRoots.find(candidate => reference.startsWith(`${candidate}/`));
        const relative = root ? reference.slice(root.length + 1) : '';
        const domainEventId = relative.split('/')[0];
        const dispositionSibling = root && domainEventId
          ? path.join(artifactRoot, root, domainEventId, 'feedback-disposition.json')
          : null;
        const priorEventIds = priorRootSnapshots?.[root]?.event_ids || [];
        if (!root || !SAFE_EVENT_ID_RE.test(domainEventId || '') || !relative.includes('/') ||
            path.basename(reference) === 'feedback-disposition.json' ||
            (dispositionSibling && fs.existsSync(dispositionSibling)) ||
            currentNormalDirectories.has(`${root}/${domainEventId}`) || !priorEventIds.includes(domainEventId) ||
            !resolveArtifactRef(reference, artifactRoot)) {
          errors.push(`already_current reconciliation artifact_ref must identify a normal event member present immediately before this stage: ${reference}`);
        } else {
          if (stageRoots.includes(root)) evidencedRoots.add(root);
        }
      }
      if (!sameMembers([...evidencedRoots], stageRoots)) {
        errors.push(`already_current reconciliation_result must provide prior normal evidence for every stage domain root: ${label}`);
      }
    } else if (item.artifact_refs.length !== 0) {
      errors.push(`not_impacted or blocked_by_owner reconciliation_result artifact_refs must be empty: ${label}`);
    }
  }
  return errors;
}

function validateWorkUnitEvidenceRefs(event, artifactRoot, eventId) {
  const errors = [];
  if (!Array.isArray(event.work_unit_evidence_refs)) {
    return [`stage event work_unit_evidence_refs must be an array: ${eventId}`];
  }
  const expectedPairs = (event.reconciliation_results || [])
    .filter(item => ['changed', 'already_current'].includes(item.status))
    .flatMap(item => (item.artifact_refs || []).map(reference => `${item.work_unit_id}\0${reference}`));
  const actualPairs = [];
  const identities = new Set();
  for (const evidence of event.work_unit_evidence_refs) {
    if (!hasExactKeys(evidence, ['work_unit_id', 'path', 'sha256']) || !isPortableRelativePath(evidence.path) ||
        !SHA256_RE.test(evidence.sha256 || '')) {
      errors.push(`invalid stage work_unit_evidence_ref: ${eventId}`);
      continue;
    }
    const identity = `${evidence.work_unit_id}\0${evidence.path}`;
    if (identities.has(identity)) errors.push(`duplicate stage work_unit_evidence_ref: ${eventId}/${evidence.path}`);
    identities.add(identity);
    actualPairs.push(identity);
    const target = resolveArtifactRef(evidence.path, artifactRoot);
    if (!target || sha256Bytes(fs.readFileSync(target)) !== evidence.sha256) {
      errors.push(`stage work_unit_evidence_ref path/hash mismatch: ${eventId}/${evidence.path}`);
    }
  }
  if (canonicalize(actualPairs) !== canonicalize(expectedPairs)) {
    errors.push(`stage work_unit_evidence_refs must exactly cover every applied/merged work-unit artifact pair in order: ${eventId}`);
  }
  return errors;
}

function validateEnvelopeObject(envelope, expected, label) {
  const errors = [];
  if (!hasExactKeys(envelope, ['feedback_request_id', 'input_sha256', 'request_ids', 'work_unit_ids'])) {
    return [`${label} must contain exactly the canonical feedback lineage fields`];
  }
  if (envelope.feedback_request_id !== expected.feedback_request_id || envelope.input_sha256 !== expected.input_sha256 ||
      canonicalize(envelope.request_ids) !== canonicalize(expected.request_ids) ||
      canonicalize(envelope.work_unit_ids) !== canonicalize(expected.work_unit_ids)) {
    errors.push(`${label} lineage mismatch`);
  }
  return errors;
}

function relativePortablePath(artifactRoot, target) {
  const root = fs.existsSync(artifactRoot) ? fs.realpathSync(artifactRoot) : path.resolve(artifactRoot);
  const candidate = fs.existsSync(target) ? fs.realpathSync(target) : path.resolve(target);
  return path.relative(root, candidate).split(path.sep).join('/');
}

function validateNoChangeManifest(target, event, plannedStage, artifactRoot, expectedLineage, root) {
  const errors = [];
  let manifest;
  try {
    manifest = readJson(target);
  } catch (error) {
    return [`feedback disposition manifest is not canonical JSON: ${relativePortablePath(artifactRoot, target)} (${error.message})`];
  }
  const label = relativePortablePath(artifactRoot, target);
  if (!hasExactKeys(manifest, [
    'schema_version', 'type', 'event_id', 'created_at', 'stage', 'domain_event_root', 'reason',
    'feedback_request', 'work_unit_results', 'reconciliation_results', 'evidence_refs',
  ])) errors.push(`feedback disposition manifest has an invalid exact schema: ${label}`);
  if (manifest.schema_version !== NO_DOMAIN_CHANGE_SCHEMA || manifest.type !== 'feedback_no_domain_change') {
    errors.push(`feedback disposition manifest schema/type mismatch: ${label}`);
  }
  const rootPath = fs.realpathSync(path.resolve(artifactRoot, root));
  const relativeToRoot = path.relative(rootPath, target).split(path.sep).join('/');
  const parts = relativeToRoot.split('/');
  if (parts.length !== 2 || parts[1] !== 'feedback-disposition.json' || manifest.event_id !== parts[0] ||
      !SAFE_EVENT_ID_RE.test(parts[0] || '')) {
    errors.push(`feedback disposition manifest event_id/path mismatch: ${label}`);
  }
  const manifestDirectory = path.dirname(target);
  const siblings = fs.readdirSync(manifestDirectory);
  if (siblings.length !== 1 || siblings[0] !== 'feedback-disposition.json') {
    errors.push(`feedback disposition event directory must contain only feedback-disposition.json: ${label}`);
  }
  if (manifest.created_at !== event.created_at) errors.push(`feedback disposition manifest created_at must match its controller event: ${label}`);
  if (manifest.stage !== plannedStage.id) errors.push(`feedback disposition manifest stage mismatch: ${label}`);
  if (manifest.domain_event_root !== root) errors.push(`feedback disposition manifest domain_event_root/path mismatch: ${label}`);
  if (!isNonEmptySingleLine(manifest.reason)) errors.push(`feedback disposition manifest reason must be a non-empty single-line string: ${label}`);
  errors.push(...validateEnvelopeObject(manifest.feedback_request, expectedLineage, `feedback disposition manifest ${label}`));
  if (canonicalize(manifest.work_unit_results) !== canonicalize(event.work_unit_results)) {
    errors.push(`feedback disposition manifest work_unit_results must exactly match the controller stage event: ${label}`);
  }
  if (canonicalize(manifest.reconciliation_results) !== canonicalize(event.reconciliation_results)) {
    errors.push(`feedback disposition manifest reconciliation_results must exactly match the controller stage event: ${label}`);
  }
  if (!Array.isArray(manifest.evidence_refs)) {
    errors.push(`feedback disposition manifest evidence_refs must be an array: ${label}`);
    return errors;
  }
  const currentIdsForManifest = new Set((event.reconciliation_results || [])
    .filter(item => item.status === 'already_current').map(item => item.work_unit_id));
  const expectedManifestEvidence = (event.work_unit_evidence_refs || [])
    .filter(evidence => currentIdsForManifest.has(evidence.work_unit_id));
  if (canonicalize(manifest.evidence_refs) !== canonicalize(expectedManifestEvidence)) {
    errors.push(`feedback disposition manifest evidence_refs must exactly match the already_current subset of controller work_unit_evidence_refs: ${label}`);
  }
  const reconciliationById = new Map((event.reconciliation_results || []).map(item => [item.work_unit_id, item]));
  const expectedEvidencePairs = (event.reconciliation_results || [])
    .filter(item => item.status === 'already_current')
    .flatMap(item => item.artifact_refs.map(reference => `${item.work_unit_id}\0${reference}`));
  const actualEvidencePairs = [];
  const evidenceIdentities = new Set();
  for (const evidence of manifest.evidence_refs) {
    if (!hasExactKeys(evidence, ['work_unit_id', 'path', 'sha256']) ||
        !isPortableRelativePath(evidence.path) || !SHA256_RE.test(evidence.sha256 || '')) {
      errors.push(`invalid feedback disposition evidence_ref: ${label}`);
      continue;
    }
    const identity = `${evidence.work_unit_id}\0${evidence.path}`;
    if (evidenceIdentities.has(identity)) errors.push(`duplicate feedback disposition evidence_ref: ${label}/${evidence.path}`);
    evidenceIdentities.add(identity);
    actualEvidencePairs.push(identity);
    const reconciliation = reconciliationById.get(evidence.work_unit_id);
    if (!reconciliation || reconciliation.status !== 'already_current' || !reconciliation.artifact_refs.includes(evidence.path)) {
      errors.push(`feedback disposition evidence_ref must bind an already_current reconciliation artifact_ref: ${label}/${evidence.path}`);
      continue;
    }
    const evidenceTarget = resolveArtifactRef(evidence.path, artifactRoot);
    if (!evidenceTarget || sha256Bytes(fs.readFileSync(evidenceTarget)) !== evidence.sha256) {
      errors.push(`feedback disposition evidence_ref path/hash mismatch: ${label}/${evidence.path}`);
    }
  }
  if (canonicalize(actualEvidencePairs) !== canonicalize(expectedEvidencePairs)) {
    errors.push(`feedback disposition evidence_refs must exactly cover every merged work-unit artifact pair in order: ${label}`);
  }
  return errors;
}

function validateRdraMemberManifest(target, event, artifactRoot, expectedLineage) {
  const errors = [];
  const label = relativePortablePath(artifactRoot, target);
  let manifest;
  try {
    manifest = readJson(target);
  } catch (error) {
    return [`RDRA member manifest is not canonical JSON: ${label} (${error.message})`];
  }
  if (!hasExactKeys(manifest, ['schema_version', 'event_id', 'created_at', 'stage', 'feedback_request', 'members'])) {
    errors.push(`RDRA member manifest has an invalid exact schema: ${label}`);
  }
  if (manifest.schema_version !== RDRA_MEMBER_MANIFEST_SCHEMA || manifest.stage !== 'requirements') {
    errors.push(`RDRA member manifest schema/stage mismatch: ${label}`);
  }
  const eventDir = path.dirname(target);
  if (path.basename(target) !== 'event.json' || manifest.event_id !== path.basename(eventDir) ||
      !SAFE_EVENT_ID_RE.test(manifest.event_id || '')) errors.push(`RDRA member manifest event_id/path mismatch: ${label}`);
  if (manifest.created_at !== event.created_at) errors.push(`RDRA member manifest created_at must match its controller event: ${label}`);
  errors.push(...validateEnvelopeObject(manifest.feedback_request, expectedLineage, `RDRA member manifest ${label}`));
  if (!Array.isArray(manifest.members)) {
    errors.push(`RDRA member manifest members must be an array: ${label}`);
    return errors;
  }
  if (manifest.members.length === 0) errors.push(`RDRA member manifest must declare at least one changed member: ${label}`);
  const actualMembers = [];
  for (const entry of fs.readdirSync(eventDir)) {
    if (entry === 'event.json') continue;
    const memberTarget = path.join(eventDir, entry);
    const stat = fs.lstatSync(memberTarget);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      errors.push(`RDRA event members must be direct regular files without symlinks: ${label}/${entry}`);
      continue;
    }
    actualMembers.push(relativePortablePath(artifactRoot, memberTarget));
  }
  actualMembers.sort();
  const declaredPaths = manifest.members.map(member => member?.path);
  if (new Set(declaredPaths).size !== declaredPaths.length || canonicalize(declaredPaths) !== canonicalize(actualMembers)) {
    errors.push(`RDRA member manifest must cover every sibling member exactly once in sorted order: ${label}`);
  }
  for (const member of manifest.members) {
    if (!hasExactKeys(member, ['path', 'sha256']) || !isPortableRelativePath(member.path) || !SHA256_RE.test(member.sha256 || '')) {
      errors.push(`invalid RDRA member manifest entry: ${label}`);
      continue;
    }
    const memberTarget = resolveArtifactRef(member.path, artifactRoot);
    if (!memberTarget || path.dirname(memberTarget) !== fs.realpathSync(eventDir) ||
        sha256Bytes(fs.readFileSync(memberTarget)) !== member.sha256) {
      errors.push(`RDRA member path/hash mismatch: ${label}/${member.path}`);
    }
  }
  return errors;
}

function validateDomainEventRefs(event, eventId, artifactRoot, seenDomainEventPaths, options = {}) {
  const errors = [];
  if (!Array.isArray(event.domain_event_refs)) {
    return [`stage event domain_event_refs must be an array: ${eventId}`];
  }
  if (event.type === 'feedback_stage_failed') {
    return event.domain_event_refs.length === 0
      ? []
      : [`failed stage event domain_event_refs must be empty: ${eventId}`];
  }
  if (event.domain_event_refs.length === 0) {
    return [`successful stage event domain_event_refs must be a non-empty array: ${eventId}`];
  }
  const localPaths = new Set();
  const dispositionRoots = new Set();
  const normalRoots = new Set();
  const referenceKindsByRoot = new Map();
  let normalReferenceCount = 0;
  const allowedRoots = (options.catalogStage?.domain_event_roots || []).map(root => ({
    relative: root,
    absolute: resolveSafeDomainRoot(artifactRoot, root),
  })).filter(root => root.absolute);
  for (const reference of event.domain_event_refs) {
    if (!reference || typeof reference !== 'object' || Array.isArray(reference) ||
        !isPortableRelativePath(reference.path) || !/\.(?:json|ya?ml)$/.test(reference.path) || !SHA256_RE.test(reference.sha256 || '')) {
      errors.push(`invalid domain_event_ref in stage event ${eventId}`);
      continue;
    }
    if (localPaths.has(reference.path)) {
      errors.push(`duplicate domain_event_ref in stage event ${eventId}: ${reference.path}`);
      continue;
    }
    localPaths.add(reference.path);
    const target = resolveDomainEventRef(reference, artifactRoot);
    if (!target) {
      errors.push(`domain_event_ref does not exist or escapes artifact root: ${reference.path}`);
      continue;
    }
    const matchedRoot = allowedRoots.find(root => {
      if (!fs.existsSync(root.absolute)) return false;
      return isContainedPath(fs.realpathSync(root.absolute), target);
    });
    if (!matchedRoot) {
      errors.push(`domain_event_ref is outside the catalog roots for ${options.catalogStage?.id || event.stage}: ${reference.path}`);
      continue;
    }
    let identity;
    try {
      identity = fs.realpathSync(target);
    } catch {
      errors.push(`domain_event_ref cannot be resolved: ${reference.path}`);
      continue;
    }
    if (seenDomainEventPaths.has(identity)) {
      errors.push(`domain_event_ref must be unique across stage events: ${reference.path}`);
      continue;
    }
    seenDomainEventPaths.add(identity);
    if (sha256Bytes(fs.readFileSync(target)) !== reference.sha256) {
      errors.push(`domain_event_ref sha256 mismatch: ${reference.path}`);
    }
    const isDispositionManifest = path.basename(target) === 'feedback-disposition.json';
    if (isDispositionManifest) {
      dispositionRoots.add(matchedRoot.relative);
      const kinds = referenceKindsByRoot.get(matchedRoot.relative) || new Set();
      kinds.add('manifest');
      referenceKindsByRoot.set(matchedRoot.relative, kinds);
      errors.push(...validateNoChangeManifest(
        target,
        event,
        options.plannedStage,
        artifactRoot,
        options.expectedLineage,
        matchedRoot.relative,
      ));
    } else {
      normalReferenceCount += 1;
      normalRoots.add(matchedRoot.relative);
      const kinds = referenceKindsByRoot.get(matchedRoot.relative) || new Set();
      kinds.add('normal');
      referenceKindsByRoot.set(matchedRoot.relative, kinds);
      if (options.expectedLineage) errors.push(...validateDomainFeedbackEnvelope(target, options.expectedLineage));
      if (matchedRoot.relative === 'rdra/events') {
        errors.push(...validateRdraMemberManifest(target, event, artifactRoot, options.expectedLineage));
      }
    }
  }
  const reconciliationResults = options.reconciliationResults || [];
  const noDomainChange = event.type === 'feedback_stage_completed' &&
    reconciliationResults.length === options.plannedStage.causal_work_unit_ids.length &&
    reconciliationResults.every(item => item.status !== 'changed');
  if (event.type === 'feedback_stage_completed' &&
      reconciliationResults.length !== options.plannedStage.causal_work_unit_ids.length) {
    errors.push(`cannot reconstruct every causal reconciliation result for stage event: ${eventId}`);
  }
  if (event.type === 'feedback_stage_completed' && noDomainChange) {
    const expectedRoots = options.catalogStage?.domain_event_roots || [];
    if (normalReferenceCount !== 0 || canonicalize([...dispositionRoots]) !== canonicalize(expectedRoots) ||
        event.domain_event_refs.length !== expectedRoots.length) {
      errors.push(`stage event without changed reconciliation must reference exactly one feedback disposition manifest in every catalog domain root: ${eventId}`);
    }
  } else if (event.type === 'feedback_stage_completed') {
    const expectedRoots = options.catalogStage?.domain_event_roots || [];
    const coveredRoots = expectedRoots.filter(root => referenceKindsByRoot.has(root));
    if (canonicalize(coveredRoots) !== canonicalize(expectedRoots) || normalRoots.size === 0) {
      errors.push(`stage event with changed reconciliation must cover every catalog domain root and include at least one normal domain event: ${eventId}`);
    }
  }
  for (const [root, kinds] of referenceKindsByRoot) {
    if (kinds.size !== 1) errors.push(`a stage event may not mix normal and disposition evidence within one domain root: ${eventId}/${root}`);
    if (kinds.has('manifest') && event.domain_event_refs.filter(reference => reference.path.startsWith(`${root}/`)).length !== 1) {
      errors.push(`a disposition domain root must have exactly one manifest reference: ${eventId}/${root}`);
    }
  }
  return errors;
}

function validateStageEvents(plan, result, eventsDir, artifactRoot = path.resolve(eventsDir, '..', '..'), context = {}) {
  assertSafeEventsTree(eventsDir, artifactRoot);
  const errors = [];
  const catalog = context.catalog || context.catalogBundle?.value || loadCatalog().value;
  const catalogById = new Map(catalog.stages.map(stage => [stage.id, stage]));
  const unitById = new Map(plan.work_units.map(unit => [unit.id, unit]));
  const ownerResultsByWorkUnit = new Map();
  const usedEventIds = new Set();
  const seenDomainEventPaths = new Set();
  let lastVerifiedEvent = null;
  let lastVerifiedAttempt = 0;
  let priorRootSnapshots;
  try {
    priorRootSnapshots = structuredClone(validateDomainEventRootSnapshots(
      plan.routing_basis?.domain_event_root_snapshots,
      catalog,
      { allowMissing: true },
    ));
  } catch (error) {
    errors.push(`plan routing basis domain_event_root_snapshots is invalid: ${error.message}`);
  }
  for (const stage of result.stages || []) {
    if (stage.state === 'not_attempted') continue;
    const plannedStage = plan.execution_stages.find(candidate => candidate.id === stage.stage_id);
    const catalogStage = catalogById.get(stage.stage_id);
    if (!plannedStage || !catalogStage) {
      errors.push(`stage event targets a stage outside the frozen plan/catalog: ${stage.stage_id}`);
      continue;
    }
    if (!Array.isArray(stage.event_ids) || stage.event_ids.length !== 1) {
      errors.push(`${stage.stage_id}: an executed stage requires exactly one event_id`);
    }
    for (const eventId of stage.event_ids || []) {
      if (usedEventIds.has(eventId)) {
        errors.push(`stage event_id must be globally unique: ${eventId}`);
        continue;
      }
      usedEventIds.add(eventId);
      const target = eventPath(eventsDir, eventId);
      if (!target) {
        errors.push(`stage event does not exist: ${eventId}`);
        continue;
      }
      let event;
      try {
        event = readJson(target);
      } catch (error) {
        errors.push(`stage event is not valid JSON: ${eventId} (${error.message})`);
        continue;
      }
      if (event.event_id !== eventId) errors.push(`stage event_id does not match its directory: ${eventId}`);
      if (!isNonEmptySingleLine(event.created_at) || !Number.isFinite(Date.parse(event.created_at))) {
        errors.push(`stage event created_at must be a valid non-empty single-line timestamp: ${eventId}`);
      }
      const expectedType = stage.state === 'succeeded' ? 'feedback_stage_completed' : 'feedback_stage_failed';
      if (event.type !== expectedType) errors.push(`stage event type must be ${expectedType}: ${eventId}`);
      if (stage.state === 'failed') {
        for (const field of ['phase', 'reason']) {
          if (typeof event[field] !== 'string' || event[field].trim() === '' || /[\0\r\n\u2028\u2029]/.test(event[field])) {
            errors.push(`failed stage event ${field} must be a non-empty single-line string: ${eventId}`);
          }
        }
      }
      if (event.stage !== stage.stage_id) errors.push(`stage event stage mismatch: ${eventId}`);
      if (canonicalize(event.direct_work_unit_ids) !== canonicalize(plannedStage.direct_work_unit_ids) ||
          canonicalize(stage.direct_work_unit_ids) !== canonicalize(plannedStage.direct_work_unit_ids)) {
        errors.push(`stage event direct_work_unit_ids mismatch or order violation: ${eventId}`);
      }
      if (canonicalize(event.causal_work_unit_ids) !== canonicalize(plannedStage.causal_work_unit_ids) ||
          canonicalize(stage.causal_work_unit_ids) !== canonicalize(plannedStage.causal_work_unit_ids)) {
        errors.push(`stage event causal_work_unit_ids mismatch or order violation: ${eventId}`);
      }
      const lineage = event.feedback_request || {};
      const causalWorkUnitIds = Array.isArray(stage.causal_work_unit_ids) ? stage.causal_work_unit_ids : [];
      const requestIds = [...new Set(causalWorkUnitIds.map(id => unitById.get(id)?.request_id))];
      if (lineage.feedback_request_id !== plan.feedback_request_id || lineage.input_sha256 !== plan.input_sha256 ||
          !sameMembers(lineage.work_unit_ids, causalWorkUnitIds) || !sameMembers(lineage.request_ids, requestIds)) {
        errors.push(`stage event lineage mismatch: ${eventId}`);
      }
      errors.push(...validateStageWorkUnitResults(event, plannedStage, artifactRoot, eventId, catalog, plan.routing_basis));
      for (const item of event.work_unit_results || []) {
        if (plannedStage.direct_work_unit_ids.includes(item?.work_unit_id) && !ownerResultsByWorkUnit.has(item.work_unit_id)) {
          ownerResultsByWorkUnit.set(item.work_unit_id, item);
        }
      }
      errors.push(...validateReconciliationResults(
        event,
        plannedStage,
        artifactRoot,
        eventId,
        catalog,
        priorRootSnapshots,
        ownerResultsByWorkUnit,
        unitById,
      ));
      errors.push(...validateWorkUnitEvidenceRefs(event, artifactRoot, eventId));
      errors.push(...validatePostExecutionBasis(event.post_execution_basis, catalog, `stage event ${eventId} post_execution_basis`));
      if (event.post_execution_basis?.repository_head !== plan.routing_basis?.repository_head) {
        errors.push(`stage event post_execution_basis.repository_head must remain equal to the frozen routing basis: ${eventId}`);
      }
      const eventIdsByRoot = new Map();
      for (const reference of event.domain_event_refs || []) {
        for (const root of catalogStage.domain_event_roots) {
          if (!reference.path.startsWith(`${root}/`)) continue;
          const relative = reference.path.slice(root.length + 1);
          const domainEventId = relative.split('/')[0];
          if (!SAFE_EVENT_ID_RE.test(domainEventId || '')) continue;
          if (eventIdsByRoot.has(root) && eventIdsByRoot.get(root) !== domainEventId) {
            errors.push(`stage event may reference only one domain event directory per root: ${eventId}/${root}`);
          }
          eventIdsByRoot.set(root, domainEventId);
        }
      }
      try {
        const actualLatestFromPostSnapshot = latestDomainEventIdsFromSnapshots(
          catalog,
          event.post_execution_basis?.domain_event_root_snapshots,
        );
        if (canonicalize(event.post_execution_basis?.latest_domain_event_ids) !== canonicalize(actualLatestFromPostSnapshot)) {
          errors.push(`stage event post_execution_basis latest IDs must be derived from its root snapshots: ${eventId}`);
        }
      } catch {
        // validatePostExecutionBasis already reports the precise malformed snapshot.
      }
      if (priorRootSnapshots && event.post_execution_basis?.domain_event_root_snapshots) {
        const postSnapshots = event.post_execution_basis.domain_event_root_snapshots;
        const manifestRoots = new Set((event.domain_event_refs || [])
          .filter(reference => path.basename(reference.path || '') === 'feedback-disposition.json')
          .map(reference => domainEventRoots(catalog).find(root => reference.path.startsWith(`${root}/`)))
          .filter(Boolean));
        for (const root of domainEventRoots(catalog)) {
          const prior = priorRootSnapshots[root];
          const post = postSnapshots[root];
          if (!prior || !post) continue;
          const expectedIds = [...prior.event_ids];
          const newEventId = eventIdsByRoot.get(root);
          if (event.type === 'feedback_stage_completed' && catalogStage.domain_event_roots.includes(root)) {
            if (!newEventId) {
              errors.push(`successful stage event must identify one domain event directory for root: ${eventId}/${root}`);
            } else if (expectedIds.includes(newEventId)) {
              errors.push(`successful stage event must append a previously absent domain event directory: ${eventId}/${root}/${newEventId}`);
            } else if (prior.head_event_id !== null && newEventId <= prior.head_event_id) {
              errors.push(`successful stage event ID must sort after the prior root head: ${eventId}/${root}/${newEventId}`);
            } else {
              expectedIds.push(newEventId);
              expectedIds.sort();
            }
          } else if (newEventId) {
            errors.push(`stage event may not append a domain event outside its catalog roots: ${eventId}/${root}`);
          }
          if (canonicalize(post.event_ids) !== canonicalize(expectedIds)) {
            errors.push(`stage event root snapshot must equal the prior set plus its one new event directory: ${eventId}/${root}`);
          }
          const expectedHead = expectedIds.at(-1) || null;
          if (post.head_event_id !== expectedHead) {
            errors.push(`stage event root snapshot head_event_id mismatch: ${eventId}/${root}`);
          }
          if (expectedHead === prior.head_event_id && post.head_event_sha256 !== prior.head_event_sha256) {
            errors.push(`stage event may not mutate the prior head domain event: ${eventId}/${root}`);
          }
          const normalRootChanged = event.type === 'feedback_stage_completed' &&
            catalogStage.domain_event_roots.includes(root) && !manifestRoots.has(root);
          if (normalRootChanged &&
              (post.latest_tree_sha256 === null || post.latest_tree_sha256 === prior.latest_tree_sha256)) {
            errors.push(`normal domain event must update its domain latest tree: ${eventId}/${root}`);
          }
          if (!normalRootChanged && post.latest_tree_sha256 !== prior.latest_tree_sha256) {
            errors.push(`stage event may not mutate an unrelated or no-change domain latest tree: ${eventId}/${root}`);
          }
        }
        priorRootSnapshots = structuredClone(postSnapshots);
      }
      errors.push(...validateDomainEventRefs(event, eventId, artifactRoot, seenDomainEventPaths, {
        allowEmpty: stage.state === 'failed',
        catalogStage,
        plannedStage,
        reconciliationResults: event.reconciliation_results || [],
        expectedLineage: {
          feedback_request_id: plan.feedback_request_id,
          input_sha256: plan.input_sha256,
          request_ids: requestIds,
          work_unit_ids: causalWorkUnitIds,
        },
      }));
      errors.push(...validateRequirementsOwnerLedgerBinding(
        event,
        plannedStage,
        plan,
        artifactRoot,
        eventId,
        context.observedExecutionBasis || context.currentExecutionBasis,
      ));
      errors.push(...validateRequiredExecutionIdentity(event, `stage event ${eventId}`));
      if (Number.isSafeInteger(event.attempt) && event.attempt < lastVerifiedAttempt) {
        errors.push(`stage event attempts must be nondecreasing in plan order: ${eventId}`);
      }
      if (Number.isSafeInteger(event.attempt)) lastVerifiedAttempt = event.attempt;
      lastVerifiedEvent = event;
    }
  }
  if (lastVerifiedEvent && context.currentExecutionBasis &&
      canonicalize(lastVerifiedEvent.post_execution_basis) !== canonicalize(context.currentExecutionBasis)) {
    errors.push('current execution basis must exactly match the last verified stage post_execution_basis');
  }
  if (lastVerifiedEvent && context.observedExecutionBasis) {
    errors.push(...validateObservedRootProgress(
      lastVerifiedEvent.post_execution_basis,
      context.observedExecutionBasis,
      catalog,
      artifactRoot,
    ));
  }
  return errors;
}

function validateArtifacts(plan, result, artifactRoot) {
  const errors = [];
  for (const unit of result.work_units || []) {
    if (!SUCCESS_DISPOSITIONS.has(unit.disposition)) continue;
    for (const reference of unit.artifact_refs || []) {
      if (!resolveArtifactRef(reference, artifactRoot)) errors.push(`artifact_ref does not exist or escapes artifact root: ${reference}`);
    }
  }
  return errors;
}

function executionFailureWorkUnitResult(workUnitId, failureStage, failedEvent) {
  return {
    work_unit_id: workUnitId,
    disposition: 'execution_failed',
    reason: `Execution failed in ${failureStage.stage_id} during ${failedEvent.phase}: ${failedEvent.reason}`,
    artifact_refs: [],
    failure_stage: failureStage.stage_id,
    caused_by_event_id: failureStage.event_ids[0],
  };
}

function outsideWorkUnitResult(unit) {
  return {
    work_unit_id: unit.id,
    disposition: 'routed_outside',
    reason: OUTSIDE_REASON,
    artifact_refs: [`route:${unit.direct_stage}`],
  };
}

function validateDeterministicResult(plan, result, eventsDir) {
  const errors = [];
  const stageResultById = new Map((result.stages || []).map(stage => [stage.stage_id, stage]));
  const directResults = new Map();
  const reconciliationByStage = new Map();
  const eventByStage = new Map();
  for (const stage of result.stages || []) {
    if (stage.state === 'not_attempted' || !Array.isArray(stage.event_ids) || stage.event_ids.length !== 1) continue;
    const target = eventPath(eventsDir, stage.event_ids[0]);
    if (!target) continue;
    try {
      const event = readJson(target);
      eventByStage.set(stage.stage_id, event);
      if (event.type === 'feedback_stage_completed') {
        reconciliationByStage.set(stage.stage_id, new Map((event.reconciliation_results || [])
          .map(item => [item.work_unit_id, item])));
        for (const item of event.work_unit_results || []) {
          if (directResults.has(item.work_unit_id)) errors.push(`work unit has more than one direct owner result: ${item.work_unit_id}`);
          else directResults.set(item.work_unit_id, item);
        }
      }
    } catch (error) {
      errors.push(`cannot reconstruct result from stage event ${stage.event_ids[0]}: ${error.message}`);
    }
  }
  const firstFailure = (result.stages || []).find(stage => stage.state === 'failed');
  const failedEvent = firstFailure ? eventByStage.get(firstFailure.stage_id) : null;
  const actualById = new Map((result.work_units || []).map(item => [item.work_unit_id, item]));
  for (const unit of plan.work_units) {
    const actual = actualById.get(unit.id);
    if (!actual) continue;
    let expected;
    if (unit.required_closure_stages.length === 0) {
      expected = outsideWorkUnitResult(unit);
    } else {
      const ownerResult = directResults.get(unit.id);
      if (ownerResult && ['deferred', 'rejected'].includes(ownerResult.disposition)) {
        expected = ownerResult;
        if (canonicalize(actual) !== canonicalize(expected)) {
          errors.push(`${unit.id}: result work unit must exactly equal its deterministic stage-ledger projection`);
        }
        continue;
      }
      const closureSucceeded = unit.required_closure_stages.every(stageId => stageResultById.get(stageId)?.state === 'succeeded');
      if (closureSucceeded) {
        if (!ownerResult) {
          errors.push(`${unit.id}: successful closure is missing its direct owner stage ledger result`);
          continue;
        }
        const closureReconciliations = [];
        let missingReconciliation = false;
        for (const stageId of unit.required_closure_stages) {
          const reconciliation = reconciliationByStage.get(stageId)?.get(unit.id);
          if (!reconciliation) {
            errors.push(`${unit.id}: successful closure is missing reconciliation for stage ${stageId}`);
            missingReconciliation = true;
          } else {
            closureReconciliations.push(reconciliation);
          }
        }
        if (missingReconciliation) continue;
        const changed = closureReconciliations.some(item => item.status === 'changed');
        const artifactRefs = [];
        for (const reconciliation of closureReconciliations) {
          if (!['changed', 'already_current'].includes(reconciliation.status)) continue;
          for (const reference of reconciliation.artifact_refs) {
            if (!artifactRefs.includes(reference)) artifactRefs.push(reference);
          }
        }
        expected = {
          work_unit_id: unit.id,
          disposition: changed ? 'applied' : 'merged',
          reason: changed ? APPLIED_CLOSURE_REASON : MERGED_CLOSURE_REASON,
          artifact_refs: artifactRefs,
        };
      } else {
        if (!firstFailure || !failedEvent) {
          errors.push(`${unit.id}: incomplete closure cannot be reconstructed without the first failed stage event`);
          continue;
        }
        expected = executionFailureWorkUnitResult(unit.id, firstFailure, failedEvent);
      }
    }
    if (canonicalize(actual) !== canonicalize(expected)) {
      errors.push(`${unit.id}: result work unit must exactly equal its deterministic stage-ledger projection`);
    }
  }
  return errors;
}

function validateTerminalEvent(plan, result, resultPath, eventsDir, options = {}) {
  if (options.preCompletion) return [];
  const errors = [];
  const target = eventPath(eventsDir, result.terminal_event_id);
  if (!target) return ['terminal event does not exist'];
  let event;
  try {
    event = readJson(target);
  } catch (error) {
    return [`terminal event is not valid JSON: ${error.message}`];
  }
  if (event.event_id !== result.terminal_event_id) errors.push('terminal event_id does not match its directory');
  const expectedType = result.status === 'completed' ? 'feedback_run_completed' : 'feedback_run_aborted';
  if (event.type !== expectedType) errors.push(`terminal event type must be ${expectedType}`);
  if (event.result_sha256 !== sha256Bytes(fs.readFileSync(resultPath))) errors.push('terminal event result_sha256 mismatch');
  const lineage = event.feedback_request || {};
  if (lineage.feedback_request_id !== plan.feedback_request_id || lineage.input_sha256 !== plan.input_sha256 ||
      !sameMembers(lineage.work_unit_ids, plan.work_units.map(unit => unit.id)) || !sameMembers(lineage.request_ids, plan.request_ids)) {
    errors.push('terminal event feedback_request lineage mismatch');
  }
  const expectedDispositions = result.work_units.map(unit => ({ work_unit_id: unit.work_unit_id, disposition: unit.disposition }));
  if (canonicalize(event.work_unit_dispositions) !== canonicalize(expectedDispositions)) errors.push('terminal event work_unit_dispositions mismatch');
  errors.push(...validateRequiredExecutionIdentity(event, 'terminal event'));
  if (!sameExecutionIdentity(event, result) || !sameExecutionIdentity(options.status, result)) {
    errors.push('terminal event, result, and status execution identity must match exactly');
  }
  return errors;
}

function validateRunDirectory(runDir, eventsDir = path.resolve(runDir, '..', '..', 'events'), options = {}) {
  const errors = [];
  const artifactRoot = options.artifactRoot || path.resolve(eventsDir, '..', '..');
  assertSafeRunEvidenceTree(runDir, artifactRoot);
  assertSafeEventsTree(eventsDir, artifactRoot);
  const inputPath = path.join(runDir, 'input.md');
  const buffer = fs.readFileSync(inputPath);
  const document = parseFeedbackRequest(buffer);
  const run = readJson(path.join(runDir, 'run.json'));
  const routing = readJson(path.join(runDir, 'routing.json'));
  const plan = readJson(path.join(runDir, 'plan.json'));
  const status = readJson(path.join(runDir, 'status.json'));
  const resultPath = path.join(runDir, 'result.json');
  const result = readJson(resultPath);
  if (path.basename(path.resolve(runDir)) !== document.metadata.feedback_id) errors.push('run directory basename must match feedback_id');
  if (run.schema_version !== 'distillery.feedback-run/v1') errors.push('run.json schema_version must be distillery.feedback-run/v1');
  if (run.feedback_request_id !== document.metadata.feedback_id || run.input_sha256 !== document.input_sha256 ||
      run.ambiguity_policy !== routing.policy || canonicalize(run.routing_basis) !== canonicalize(routing.routing_basis)) {
    errors.push('run.json identity/policy/routing basis mismatch');
  }
  let basisSnapshot;
  try {
    basisSnapshot = loadRunBasisSnapshots(runDir, routing, run);
  } catch (error) {
    errors.push(`run basis snapshot is invalid: ${error.message}`);
    return errors;
  }
  const { catalogBundle, policyBundle } = basisSnapshot;
  let observedExecutionBasis;
  try {
    const observedRootSnapshots = snapshotDomainEventRoots(artifactRoot, catalogBundle.value);
    observedExecutionBasis = {
      repository_head: plan.routing_basis.repository_head,
      latest_domain_event_ids: latestDomainEventIdsFromSnapshots(catalogBundle.value, observedRootSnapshots),
      domain_event_root_snapshots: observedRootSnapshots,
    };
  } catch (error) {
    errors.push(`observed domain execution basis cannot be derived: ${error.message}`);
  }
  let currentExecutionBasis = options.currentExecutionBasis;
  if (options.preCompletion && !currentExecutionBasis) {
    try {
      const rootSnapshots = observedExecutionBasis?.domain_event_root_snapshots ||
        snapshotDomainEventRoots(artifactRoot, catalogBundle.value);
      const actualLatest = observedExecutionBasis?.latest_domain_event_ids ||
        latestDomainEventIdsFromSnapshots(catalogBundle.value, rootSnapshots);
      if (options.latestDomainEventIds) {
        validateLatestDomainEventIds(options.latestDomainEventIds, catalogBundle.value);
        if (canonicalize(options.latestDomainEventIds) !== canonicalize(actualLatest)) {
          errors.push('supplied latest_domain_event_ids do not match the actual domain event roots');
        }
      }
      currentExecutionBasis = {
        repository_head: deriveRepositoryHead(artifactRoot, options.repositoryHead),
        latest_domain_event_ids: actualLatest,
        domain_event_root_snapshots: rootSnapshots,
      };
      errors.push(...validatePostExecutionBasis(currentExecutionBasis, catalogBundle.value, 'current execution basis'));
    } catch (error) {
      errors.push(`current execution basis cannot be derived: ${error.message}`);
    }
  }
  let frozenRouting = null;
  try {
    frozenRouting = buildRouting(document, routing, routing.policy, {
      catalogBundle,
      policyBundle,
      promptSchemaSha256: basisSnapshot.promptSchemaSha256,
      stagePacketRendererVersion: basisSnapshot.rendererVersion,
      basisValidation: 'static',
    });
  } catch (error) {
    errors.push(`frozen routing is invalid: ${error.message}`);
  }
  if (!frozenRouting) return errors;
  let effective = frozenRouting;
  const resolutionPath = path.join(runDir, 'resolutions.json');
  if (fs.existsSync(resolutionPath)) {
    try {
      effective = applyResolutions(frozenRouting, readJson(resolutionPath), frozenRouting.routing_basis, { catalogBundle });
    } catch (error) {
      errors.push(error.message);
    }
  }
  if (effective.state !== 'resolved') errors.push(`routing is not executable: ${effective.state}`);
  let rebuilt = null;
  if (effective.state === 'resolved') {
    rebuilt = buildPlan(document, effective, { catalogBundle });
    if (canonicalize(rebuilt) !== canonicalize(plan)) errors.push('plan.json does not match input.md + frozen routing/resolution');
    for (const stage of rebuilt.execution_stages) {
      const packetPath = path.join(runDir, stage.stage_packet);
      if (!fs.existsSync(packetPath) || fs.readFileSync(packetPath, 'utf8') !== renderStagePacket(buffer, document, rebuilt, stage.id, {
        promptDataPolicy: basisSnapshot.promptDataPolicy,
        rendererVersion: basisSnapshot.rendererVersion,
      })) {
        errors.push(`stage packet mismatch: ${stage.id}`);
      }
    }
  }
  const lifecycle = validateExecutionLifecycle(plan, status, result, eventsDir, artifactRoot, {
    preCompletion: options.preCompletion,
    nonterminal: false,
  });
  errors.push(...lifecycle.errors);
  errors.push(...validateDomainCheckpointCoverage(plan, lifecycle.events, artifactRoot, catalogBundle.value));
  errors.push(...validateResult(plan, result));
  errors.push(...validateStatus(plan, status, result, options));
  errors.push(...validateArtifacts(plan, result, artifactRoot));
  errors.push(...validateStageEvents(plan, result, eventsDir, artifactRoot, {
    run,
    status,
    catalog: catalogBundle.value,
    currentExecutionBasis,
    observedExecutionBasis,
  }));
  errors.push(...validateDeterministicResult(plan, result, eventsDir));
  errors.push(...validateTerminalEvent(plan, result, resultPath, eventsDir, { ...options, run, status }));
  return errors;
}

function parseCli(argv) {
  const options = { runDir: argv[0], preCompletion: false };
  for (let index = 1; index < argv.length; index++) {
    const name = argv[index];
    if (name === '--pre-completion') { options.preCompletion = true; continue; }
    if (!['--events-dir', '--artifact-root', '--repository-head', '--latest-domain-events'].includes(name)) {
      throw new Error(`unknown option: ${name}`);
    }
    const value = argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
    const keys = {
      '--events-dir': 'eventsDir',
      '--artifact-root': 'artifactRoot',
      '--repository-head': 'repositoryHead',
      '--latest-domain-events': 'latestEventsPath',
    };
    options[keys[name]] = value;
  }
  return options;
}

function runCli() {
  try {
    const options = parseCli(process.argv.slice(2));
    if (!options.runDir) throw new Error('Usage: verifyFeedbackResult.js <run-dir> [--events-dir <dir>] [--artifact-root <dir>] [--pre-completion --repository-head <value> --latest-domain-events <json>]');
    const latestDomainEventIds = options.latestEventsPath ? readJson(path.resolve(options.latestEventsPath)) : undefined;
    const errors = validateRunDirectory(path.resolve(options.runDir), options.eventsDir ? path.resolve(options.eventsDir) : undefined, {
      artifactRoot: options.artifactRoot ? path.resolve(options.artifactRoot) : undefined,
      preCompletion: options.preCompletion,
      repositoryHead: options.repositoryHead,
      latestDomainEventIds,
    });
    if (errors.length) {
      errors.forEach(error => console.error(`ERROR: ${error}`));
      process.exit(1);
    }
    process.stdout.write('PASS: feedback result coverage and lineage are valid\n');
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  REQUEST_DISPOSITIONS,
  WORK_UNIT_DISPOSITIONS,
  deriveRequestDisposition,
  requestReasonForDisposition,
  scanControllerEvents,
  resolveDomainEventRef,
  resolveArtifactRef,
  validateDomainCheckpointCoverage,
  validateExecutionLifecycle,
  validateArtifacts,
  validateDeterministicResult,
  validateResult,
  validateRunDirectory,
  validateStageEvents,
  validateStageResults,
  validatePostExecutionBasis,
  validateStatus,
  validateTerminalEvent,
};

if (require.main === module) runCli();
