#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readCanonicalJson, writeCanonicalJson } = require('./canonicalJson');
const { parseFeedbackRequest, readFeedbackInput, sha256Bytes } = require('./feedbackRequest');

const DEFAULT_STALE_HOURS = 24;

function assertSafeLeasePath(leasePath, options = {}) {
  const target = path.resolve(leasePath);
  if (path.basename(target) !== 'run-lease.json') {
    throw new Error('lease path must be the canonical artifactRoot/pipeline/run-lease.json path');
  }
  const pipelineDir = path.dirname(target);
  if (path.basename(pipelineDir) !== 'pipeline') throw new Error('lease path must be an immediate child of artifactRoot/pipeline');
  const artifactRoot = path.dirname(pipelineDir);
  if (!fs.existsSync(artifactRoot)) throw new Error(`lease artifact root must already exist: ${artifactRoot}`);
  const rootStat = fs.lstatSync(artifactRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error('lease artifact root must be a real directory, not a symlink');
  const realRoot = fs.realpathSync(artifactRoot);
  if (!fs.existsSync(pipelineDir)) {
    if (!options.createParent) throw new Error(`lease pipeline directory is missing: ${pipelineDir}`);
    fs.mkdirSync(pipelineDir);
  }
  const parentStat = fs.lstatSync(pipelineDir);
  if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) throw new Error('lease pipeline directory must be a real directory, not a symlink');
  const realParent = fs.realpathSync(pipelineDir);
  if (realParent !== realRoot && !realParent.startsWith(`${realRoot}${path.sep}`)) throw new Error('lease pipeline directory escapes artifact root');
  if (fs.existsSync(target)) {
    const leaseStat = fs.lstatSync(target);
    if (leaseStat.isSymbolicLink() || !leaseStat.isFile()) throw new Error('lease must be a regular file, not a symlink');
    const realLease = fs.realpathSync(target);
    if (!realLease.startsWith(`${realRoot}${path.sep}`)) throw new Error('lease escapes artifact root');
  }
  return target;
}

function readLease(leasePath) {
  const safePath = assertSafeLeasePath(leasePath);
  return readCanonicalJson(safePath, 'pipeline run lease');
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function normalInputSha256(inputPath) {
  const stat = fs.statSync(inputPath);
  if (stat.isFile()) return sha256File(inputPath);
  if (stat.isDirectory()) {
    return crypto.createHash('sha256').update(`directory:${path.resolve(inputPath)}`, 'utf8').digest('hex');
  }
  throw new Error('normal input must be a file or directory');
}

function assertOwner(lease, runId, inputSha256) {
  if (lease.run_id !== runId || (inputSha256 && lease.input_sha256 !== inputSha256)) {
    throw new Error(`lease owner mismatch: active=${lease.run_id}@${lease.input_sha256}`);
  }
}

function writeNewLease(lease, leasePath) {
  leasePath = assertSafeLeasePath(leasePath, { createParent: true });
  let handle;
  try {
    handle = fs.openSync(leasePath, 'wx');
    writeCanonicalJson(handle, lease);
  } catch (error) {
    if (error.code === 'EEXIST') {
      const active = readLease(leasePath);
      throw new Error(`workspace pipeline is already leased by ${active.mode}:${active.run_id}`);
    }
    if (handle !== undefined) {
      fs.closeSync(handle);
      handle = undefined;
      fs.unlinkSync(leasePath);
    }
    throw error;
  } finally {
    if (handle !== undefined) fs.closeSync(handle);
  }
  return lease;
}

function leasePayload(mode, inputSha256, leasePath, options = {}) {
  const now = options.now || new Date().toISOString();
  return writeNewLease({
    schema_version: 'distillery.pipeline-run-lease/v1',
    mode,
    run_id: options.runId || `${mode}-${Date.now()}-${process.pid}`,
    feedback_request_id: options.feedbackRequestId || null,
    input_sha256: inputSha256,
    pid: options.pid || process.pid,
    hostname: options.hostname || os.hostname(),
    started_head: options.startedHead || null,
    acquired_at: now,
    last_activity_at: now,
  }, leasePath);
}

function acquireLease(input, leasePath, options = {}) {
  const buffer = Buffer.isBuffer(input) ? input : input?.buffer;
  if (!Buffer.isBuffer(buffer)) throw new TypeError('feedback lease input must be a Buffer or one-buffer input object');
  const document = input?.document || parseFeedbackRequest(buffer);
  if (document.input_sha256 !== sha256Bytes(buffer)) throw new Error('feedback input document does not match its Buffer');
  return leasePayload('feedback', document.input_sha256, leasePath, {
    ...options,
    feedbackRequestId: document.metadata.feedback_id,
  });
}

function acquireNormalLease(inputPath, leasePath, options = {}) {
  return leasePayload('normal', normalInputSha256(inputPath), leasePath, options);
}

function replaceLease(leasePath, lease) {
  leasePath = assertSafeLeasePath(leasePath);
  const temporary = `${leasePath}.tmp-${process.pid}`;
  try {
    writeCanonicalJson(temporary, lease, { flag: 'wx' });
    fs.renameSync(temporary, leasePath);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function touchLease(leasePath, runId, inputSha256, now = new Date().toISOString()) {
  const lease = readLease(leasePath);
  assertOwner(lease, runId, inputSha256);
  lease.last_activity_at = now;
  replaceLease(leasePath, lease);
  return lease;
}

function releaseLease(leasePath, runId, inputSha256) {
  leasePath = assertSafeLeasePath(leasePath);
  const lease = readLease(leasePath);
  assertOwner(lease, runId, inputSha256);
  fs.unlinkSync(leasePath);
  return lease;
}

function leaseStatus(leasePath, options = {}) {
  const lease = readLease(leasePath);
  const nowMs = options.now ? Date.parse(options.now) : Date.now();
  const lastMs = Date.parse(lease.last_activity_at);
  if (!Number.isFinite(lastMs)) throw new Error('lease last_activity_at is invalid');
  const ageHours = Math.max(0, (nowMs - lastMs) / 3_600_000);
  const staleHours = options.staleHours ?? DEFAULT_STALE_HOURS;
  const sameHost = lease.hostname === os.hostname();
  let processAlive = null;
  if (sameHost && Number.isInteger(lease.pid)) {
    try {
      process.kill(lease.pid, 0);
      processAlive = true;
    } catch (error) {
      processAlive = error.code === 'EPERM';
    }
  }
  return {
    ...lease,
    age_hours: ageHours,
    same_host: sameHost,
    process_alive: processAlive,
    stale_candidate: ageHours >= staleHours && processAlive !== true,
  };
}

function clearStaleLease(leasePath, expectedRunId, options = {}) {
  leasePath = assertSafeLeasePath(leasePath);
  const status = leaseStatus(leasePath, options);
  assertOwner(status, expectedRunId);
  if (!status.stale_candidate) {
    throw new Error(`lease is not stale: age=${status.age_hours.toFixed(2)}h`);
  }
  fs.unlinkSync(leasePath);
  return status;
}

function option(argv, name) {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

function requiredOption(argv, name) {
  const value = option(argv, name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function numericOption(argv, name, fallback) {
  const raw = option(argv, name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
  return value;
}

function runCli() {
  const argv = process.argv.slice(2);
  const [command, first, second] = argv;
  try {
    if (command === 'acquire') {
      if (!first || !second) throw new Error('Usage: feedbackLease.js acquire <feedback.md> <lease.json> --run-id <id> [--started-head <sha>]');
      const input = readFeedbackInput(first, { explicitFeedback: true });
      console.log(JSON.stringify(acquireLease(input, second, {
        runId: requiredOption(argv, '--run-id'),
        startedHead: option(argv, '--started-head'),
      })));
      return;
    }
    if (command === 'acquire-normal') {
      if (!first || !second) throw new Error('Usage: feedbackLease.js acquire-normal <input> <lease.json> --run-id <id> [--started-head <sha>]');
      console.log(JSON.stringify(acquireNormalLease(first, second, {
        runId: requiredOption(argv, '--run-id'),
        startedHead: option(argv, '--started-head'),
      })));
      return;
    }
    if (command === 'touch') {
      if (!first) throw new Error('Usage: feedbackLease.js touch <lease.json> --run-id <id> [--input-sha256 <sha>]');
      console.log(JSON.stringify(touchLease(first, requiredOption(argv, '--run-id'), option(argv, '--input-sha256'))));
      return;
    }
    if (command === 'release') {
      if (!first) throw new Error('Usage: feedbackLease.js release <lease.json> --run-id <id> [--input-sha256 <sha>]');
      console.log(JSON.stringify(releaseLease(first, requiredOption(argv, '--run-id'), option(argv, '--input-sha256'))));
      return;
    }
    if (command === 'status') {
      if (!first) throw new Error('Usage: feedbackLease.js status <lease.json> [--stale-hours <hours>]');
      console.log(JSON.stringify(leaseStatus(first, {
        staleHours: numericOption(argv, '--stale-hours', DEFAULT_STALE_HOURS),
      })));
      return;
    }
    if (command === 'clear-stale') {
      if (!first) throw new Error('Usage: feedbackLease.js clear-stale <lease.json> --run-id <id> [--min-age-hours <hours>]');
      console.log(JSON.stringify(clearStaleLease(first, requiredOption(argv, '--run-id'), {
        staleHours: numericOption(argv, '--min-age-hours', DEFAULT_STALE_HOURS),
      })));
      return;
    }
    throw new Error('Usage: feedbackLease.js <acquire|acquire-normal|touch|release|status|clear-stale> ...');
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  acquireLease,
  acquireNormalLease,
  assertSafeLeasePath,
  assertOwner,
  clearStaleLease,
  leaseStatus,
  normalInputSha256,
  readLease,
  releaseLease,
  sha256File,
  touchLease,
};

if (require.main === module) runCli();
