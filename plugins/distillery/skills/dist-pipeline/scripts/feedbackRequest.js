#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { TextDecoder } = require('node:util');

const SCHEMA_VERSION = 'distillery.feedback-request/v1';
const SOURCE = 'distillery-impl';
const FRONT_MATTER_KEYS = Object.freeze([
  'schema_version',
  'feedback_id',
  'created_at',
  'source',
  'uc_id',
  'supersedes',
]);
const REQUIRED_FRONT_MATTER_KEYS = Object.freeze(FRONT_MATTER_KEYS.slice(0, 5));
const REQUIRED_SECTIONS = Object.freeze([
  '観測した事実',
  '現在の仕様と問題',
  '変更してほしいこと',
  '完了条件',
]);
const SEVERITIES = Object.freeze(['blocker', 'spec-gap', 'improvement']);
const SAFE_RUN_ID_RE = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const UC_ID_RE = /^[a-z0-9]{8}(?:[a-z0-9]{4})?$/;
const REQUEST_ID_RE = /^CR-[A-Za-z0-9._-]+$/;
const RELATED_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ISO_DATE_TIME_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})$/;

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function decodeUtf8(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError('feedback input must be a Buffer');
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    throw new Error('UTF-8 BOM is not allowed');
  }
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new Error('feedback input must be valid UTF-8');
  }
  if (text.includes('\r')) throw new Error('feedback input must use LF newlines; CR and CRLF are not allowed');
  if (text !== text.normalize('NFC')) throw new Error('feedback input must use Unicode NFC');
  return text;
}

function scanLines(text) {
  const lines = [];
  let start = 0;
  while (start < text.length) {
    const newline = text.indexOf('\n', start);
    const end = newline === -1 ? text.length : newline;
    lines.push({ text: text.slice(start, end), start, end, fullEnd: newline === -1 ? end : end + 1 });
    if (newline === -1) break;
    start = newline + 1;
  }
  if (text.length === 0 || text.endsWith('\n')) {
    lines.push({ text: '', start: text.length, end: text.length, fullEnd: text.length });
  }
  return lines;
}

function charToByteOffset(text, characterOffset) {
  return Buffer.byteLength(text.slice(0, characterOffset), 'utf8');
}

function parseFrontMatter(lines) {
  if (lines[0]?.text !== '---') throw new Error('front matter must start with --- at byte 0');
  const closingIndex = lines.findIndex((line, index) => index > 0 && line.text === '---');
  if (closingIndex < 0) throw new Error('front matter closing delimiter is missing');
  const metadata = {};
  for (let index = 1; index < closingIndex; index++) {
    const line = lines[index].text;
    const match = line.match(/^([a-z_]+): (\S(?:.*\S)?)$/);
    if (!match) throw new Error(`invalid front matter line ${index + 1}: use "key: value" with a plain non-empty value`);
    const [, key, value] = match;
    if (!FRONT_MATTER_KEYS.includes(key)) throw new Error(`unknown front matter key: ${key}`);
    if (Object.hasOwn(metadata, key)) throw new Error(`duplicate front matter key: ${key}`);
    metadata[key] = value;
  }
  for (const key of REQUIRED_FRONT_MATTER_KEYS) {
    if (!Object.hasOwn(metadata, key)) throw new Error(`missing front matter key: ${key}`);
  }
  if (metadata.schema_version !== SCHEMA_VERSION) throw new Error(`schema_version must be ${SCHEMA_VERSION}`);
  if (!SAFE_RUN_ID_RE.test(metadata.feedback_id)) throw new Error('feedback_id is not a safe run identifier');
  if (!ISO_DATE_TIME_RE.test(metadata.created_at) || !Number.isFinite(Date.parse(metadata.created_at))) {
    throw new Error('created_at must be an ISO 8601 date-time with an explicit timezone');
  }
  if (metadata.source !== SOURCE) throw new Error(`source must be ${SOURCE}`);
  if (!UC_ID_RE.test(metadata.uc_id)) {
    throw new Error('uc_id must be exactly 8 or collision-extended 12 lowercase alphanumeric characters');
  }
  if (metadata.supersedes !== undefined) {
    if (!SAFE_RUN_ID_RE.test(metadata.supersedes)) throw new Error('supersedes is not a safe run identifier');
    if (metadata.supersedes === metadata.feedback_id) throw new Error('supersedes must differ from feedback_id');
  }
  return { metadata, closingIndex };
}

function parseInlineList(raw, label, options = {}) {
  if (!raw.startsWith('[') || !raw.endsWith(']')) throw new Error(`${label} must be an inline list: [value, ...]`);
  const body = raw.slice(1, -1).trim();
  if (!body) {
    if (options.allowEmpty) return [];
    throw new Error(`${label} must not be empty`);
  }
  const values = body.split(',').map(value => value.trim());
  if (values.some(value => value === '')) throw new Error(`${label} contains an empty value`);
  if (new Set(values).size !== values.length) throw new Error(`${label} contains duplicate values`);
  return values;
}

function isPortableRelativePath(value) {
  if (typeof value !== 'string' || value === '' || value.includes('\\') || value.includes('\0')) return false;
  if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) return false;
  const segments = value.split('/');
  return segments.every(segment => segment !== '' && segment !== '.' && segment !== '..');
}

function fenceTransition(line, active) {
  if (active) {
    const closing = line.match(/^ {0,3}(`+|~+)\s*$/);
    if (closing && closing[1][0] === active.character && closing[1].length >= active.length) return null;
    return active;
  }
  const opening = line.match(/^ {0,3}(`{3,}|~{3,})(?:[^`~].*)?$/);
  return opening ? { character: opening[1][0], length: opening[1].length } : null;
}

function parseRequestMetadata(request, lines, firstSectionLine) {
  const metadata = {};
  const allowed = ['severity', 'related_ids', 'related_files'];
  for (let index = request.headingLine + 1; index < firstSectionLine; index++) {
    const line = lines[index].text;
    if (line === '') continue;
    const match = line.match(/^- ([a-z_]+): (\S(?:.*\S)?)$/);
    if (!match) {
      throw new Error(`${request.id}: invalid request metadata line ${index + 1}; only blank lines and allowed metadata bullets may precede the first H3`);
    }
    const [, key, value] = match;
    if (!allowed.includes(key)) throw new Error(`${request.id}: unknown request metadata key: ${key}`);
    if (Object.hasOwn(metadata, key)) throw new Error(`${request.id}: duplicate request metadata key: ${key}`);
    metadata[key] = value;
  }
  if (!Object.hasOwn(metadata, 'severity')) throw new Error(`${request.id}: missing severity metadata`);
  if (!Object.hasOwn(metadata, 'related_ids')) throw new Error(`${request.id}: missing related_ids metadata`);
  if (!SEVERITIES.includes(metadata.severity)) {
    throw new Error(`${request.id}: severity must be ${SEVERITIES.join(' | ')}`);
  }
  const relatedIds = parseInlineList(metadata.related_ids, `${request.id}: related_ids`);
  for (const value of relatedIds) {
    if (!RELATED_ID_RE.test(value)) throw new Error(`${request.id}: invalid related_ids value: ${value}`);
  }
  const relatedFiles = metadata.related_files === undefined
    ? []
    : parseInlineList(metadata.related_files, `${request.id}: related_files`, { allowEmpty: true });
  for (const value of relatedFiles) {
    if (!isPortableRelativePath(value)) throw new Error(`${request.id}: related_files must contain portable workspace-relative paths: ${value}`);
  }
  return { severity: metadata.severity, related_ids: relatedIds, related_files: relatedFiles };
}

function parseFeedbackRequest(buffer) {
  const text = decodeUtf8(buffer);
  const lines = scanLines(text);
  const { metadata, closingIndex } = parseFrontMatter(lines);
  const requests = [];
  let current = null;
  let fence = null;

  for (let index = closingIndex + 1; index < lines.length; index++) {
    const line = lines[index].text;
    const before = fence;
    fence = fenceTransition(line, fence);
    if (before || fence) continue;

    if (line.startsWith('## ')) {
      const match = line.match(/^## (CR-[A-Za-z0-9._-]+): (\S.*)$/);
      if (!match) throw new Error(`unknown or malformed H2 at line ${index + 1}: ${line}`);
      if (current) current.endLine = index;
      current = {
        id: match[1],
        title: match[2],
        headingLine: index,
        endLine: lines.length - 1,
        sectionHeadings: [],
      };
      requests.push(current);
      continue;
    }

    if (line.startsWith('### ')) {
      if (!current) throw new Error(`H3 before the first request at line ${index + 1}`);
      const heading = line.slice(4);
      if (!REQUIRED_SECTIONS.includes(heading)) throw new Error(`${current.id}: unknown H3 heading: ${heading}`);
      current.sectionHeadings.push({ name: heading, line: index });
    }
  }
  if (fence) throw new Error('feedback request contains an unclosed fenced code block at EOF');
  if (current) current.endLine = lines.length - 1;
  if (requests.length === 0) throw new Error('feedback request must contain at least one change request');

  const seen = new Set();
  const parsedRequests = requests.map((request, requestIndex) => {
    if (!REQUEST_ID_RE.test(request.id)) throw new Error(`invalid request ID: ${request.id}`);
    if (seen.has(request.id)) throw new Error(`duplicate request ID: ${request.id}`);
    seen.add(request.id);
    const names = request.sectionHeadings.map(section => section.name);
    if (names.length !== REQUIRED_SECTIONS.length || names.some((name, index) => name !== REQUIRED_SECTIONS[index])) {
      throw new Error(`${request.id}: required H3 headings must occur exactly once and in order: ${REQUIRED_SECTIONS.join(', ')}`);
    }
    const requestEndCharacter = requestIndex + 1 < requests.length
      ? lines[requests[requestIndex + 1].headingLine].start
      : text.length;
    const metadataResult = parseRequestMetadata(request, lines, request.sectionHeadings[0].line);
    const sections = {};
    for (let index = 0; index < request.sectionHeadings.length; index++) {
      const section = request.sectionHeadings[index];
      const contentStart = lines[section.line].fullEnd;
      const contentEnd = index + 1 < request.sectionHeadings.length
        ? lines[request.sectionHeadings[index + 1].line].start
        : requestEndCharacter;
      const content = text.slice(contentStart, contentEnd).trim();
      if (!content) throw new Error(`${request.id}: section ${section.name} must have a non-empty body`);
      const startByte = charToByteOffset(text, contentStart);
      const endByte = charToByteOffset(text, contentEnd);
      sections[section.name] = {
        body: content,
        byte_span: [startByte, endByte],
        slice_sha256: sha256Bytes(buffer.subarray(startByte, endByte)),
      };
    }
    const startByte = charToByteOffset(text, lines[request.headingLine].start);
    const endByte = charToByteOffset(text, requestEndCharacter);
    return {
      request_id: request.id,
      title: request.title,
      ...metadataResult,
      byte_span: [startByte, endByte],
      slice_sha256: sha256Bytes(buffer.subarray(startByte, endByte)),
      sections,
    };
  });

  return {
    schema_version: SCHEMA_VERSION,
    metadata,
    input_sha256: sha256Bytes(buffer),
    byte_length: buffer.length,
    requests: parsedRequests,
  };
}

function detectFeedbackCandidate(buffer, inputPath = '', options = {}) {
  if (options.explicitFeedback || options.recommendedAuto) return true;
  if (/(^|[\\/])feedback-requests([\\/]|$)/.test(String(inputPath))) return true;
  const leading = buffer.subarray(0, Math.min(buffer.length, 16 * 1024)).toString('utf8');
  if (!leading.startsWith('---\n') && !leading.startsWith('\ufeff---')) return false;
  const closing = leading.indexOf('\n---\n', 4);
  const frontMatter = closing < 0 ? leading : leading.slice(0, closing + 5);
  return /^schema_version:\s*distillery\.feedback-request\//m.test(frontMatter) || /^feedback_id\s*:/m.test(frontMatter);
}

function readFeedbackInput(inputPath, options = {}) {
  const buffer = fs.readFileSync(inputPath);
  const candidate = detectFeedbackCandidate(buffer, inputPath, options);
  if (!candidate) {
    if (options.recommendedAuto) throw new Error('--recommended-auto requires a feedback-request input');
    return { candidate: false, buffer };
  }
  return { candidate: true, buffer, document: parseFeedbackRequest(buffer) };
}

function parseCli(argv) {
  const [command, inputPath, ...rest] = argv;
  const options = { explicitFeedback: false, recommendedAuto: false };
  for (const argument of rest) {
    if (argument === '--feedback') options.explicitFeedback = true;
    else if (argument === '--recommended-auto') options.recommendedAuto = true;
    else throw new Error(`unknown option: ${argument}`);
  }
  return { command, inputPath, options };
}

function runCli() {
  try {
    const { command, inputPath, options } = parseCli(process.argv.slice(2));
    if (!command || !inputPath || !['detect', 'verify', 'parse', 'hash'].includes(command)) {
      throw new Error('Usage: feedbackRequest.js <detect|verify|parse|hash> <input.md> [--feedback] [--recommended-auto]');
    }
    const loaded = readFeedbackInput(path.resolve(inputPath), {
      ...options,
      explicitFeedback: command === 'verify' || command === 'parse' || command === 'hash' || options.explicitFeedback,
    });
    if (command === 'detect') {
      process.stdout.write(`${JSON.stringify({ candidate: loaded.candidate })}\n`);
      return;
    }
    if (command === 'hash') {
      process.stdout.write(`${loaded.document.input_sha256}\n`);
      return;
    }
    if (command === 'parse') {
      process.stdout.write(`${JSON.stringify(loaded.document, null, 2)}\n`);
      return;
    }
    process.stdout.write(`PASS: ${loaded.document.metadata.feedback_id} (${loaded.document.requests.length} requests, sha256=${loaded.document.input_sha256})\n`);
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  FRONT_MATTER_KEYS,
  RELATED_ID_RE,
  REQUEST_ID_RE,
  REQUIRED_SECTIONS,
  SAFE_RUN_ID_RE,
  SCHEMA_VERSION,
  SEVERITIES,
  SOURCE,
  UC_ID_RE,
  charToByteOffset,
  decodeUtf8,
  detectFeedbackCandidate,
  isPortableRelativePath,
  parseFeedbackRequest,
  parseInlineList,
  readFeedbackInput,
  sha256Bytes,
};

if (require.main === module) runCli();
