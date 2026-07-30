'use strict';

const fs = require('node:fs');

function canonicalJsonText(value) {
  const serialized = JSON.stringify(value, null, 2);
  if (serialized === undefined) throw new TypeError('value cannot be represented as canonical JSON');
  return `${serialized}\n`;
}

function parseCanonicalJsonBytes(bytes, label = 'JSON') {
  if (!Buffer.isBuffer(bytes)) throw new TypeError('canonical JSON input must be a Buffer');
  const text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes)) throw new Error(`${label} must be valid UTF-8`);
  const value = JSON.parse(text);
  if (text !== canonicalJsonText(value)) {
    throw new Error(`${label} must use canonical two-space JSON formatting with one trailing newline`);
  }
  return value;
}

function readCanonicalJson(filePath, label = filePath) {
  return parseCanonicalJsonBytes(fs.readFileSync(filePath), label);
}

function writeCanonicalJson(filePathOrHandle, value, options = {}) {
  fs.writeFileSync(filePathOrHandle, canonicalJsonText(value), { encoding: 'utf8', ...options });
}

module.exports = { canonicalJsonText, parseCanonicalJsonBytes, readCanonicalJson, writeCanonicalJson };
