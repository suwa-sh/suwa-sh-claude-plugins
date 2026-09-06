#!/usr/bin/env node
'use strict';

// Native contracts are authored once; summaries and slices are projections.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const VERSION = 'distillery.contracts/v1';
const SUMMARY_VERSION = 'distillery.api-summary/v2';
const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const requireThat = (ok, message) => { if (!ok) throw new Error(message); };
const clone = x => JSON.parse(JSON.stringify(x));
const sorted = x => Array.isArray(x) ? x.map(sorted) : object(x)
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, sorted(x[k])])) : x;
const encode = x => JSON.stringify(sorted(x), null, 2) + '\n';
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const esc = key => key.replace(/~/g, '~0').replace(/\//g, '~1');

function pointer(ref) {
  requireThat(typeof ref === 'string' && ref.startsWith('#/'), `Only local JSON Pointer references are supported: ${ref}`);
  return ref.slice(2).split('/').map(s => {
    s = decodeURIComponent(s);
    requireThat(!/~(?![01])/u.test(s), `Invalid JSON Pointer: ${ref}`);
    return s.replace(/~1/g, '/').replace(/~0/g, '~');
  });
}
function resolve(doc, ref) {
  let node = doc;
  for (const key of pointer(ref)) {
    requireThat(node !== null && typeof node === 'object' && own(node, key), `Unresolved reference: ${ref}`);
    node = node[key];
  }
  return node;
}
function put(doc, ref, value) {
  const parts = pointer(ref); let node = doc;
  for (const key of parts.slice(0, -1)) {
    if (!own(node, key)) Object.defineProperty(node, key, { value: {}, enumerable: true, writable: true, configurable: true });
    node = node[key];
  }
  Object.defineProperty(node, parts.at(-1), { value: clone(value), enumerable: true, writable: true, configurable: true });
}
function walk(value, visit) {
  if (value === null || typeof value !== 'object') return;
  visit(value);
  for (const child of Object.values(value)) walk(child, visit);
}
function operations(doc, kind) {
  const result = new Map();
  if (!doc) return result;
  if (kind === 'openapi') {
    requireThat(/^3\.1\./.test(doc.openapi || ''), 'OpenAPI 3.1.x is required');
    requireThat(object(doc.paths), 'OpenAPI paths must be an object');
    for (const [url, item] of Object.entries(doc.paths)) {
      requireThat(url.startsWith('/') && object(item) && !own(item, '$ref'), `Inline path item required: ${url}`);
      for (const method of METHODS) if (own(item, method)) {
        const op = item[method];
        requireThat(object(op) && typeof op.operationId === 'string' && op.operationId, `operationId required: ${method} ${url}`);
        requireThat(!result.has(op.operationId), `Duplicate operationId: ${op.operationId}`);
        requireThat(object(op.responses) && Object.keys(op.responses).length, `responses required: ${op.operationId}`);
        result.set(op.operationId, { operation: op, method: method.toUpperCase(), path: url,
          ref: `#/paths/${esc(url)}/${method}` });
      }
    }
  } else {
    requireThat(/^3\.0\./.test(doc.asyncapi || ''), 'AsyncAPI 3.0.x is required');
    requireThat(object(doc.channels) && object(doc.operations), 'AsyncAPI channels and operations required');
    for (const [id, op] of Object.entries(doc.operations)) {
      requireThat(object(op) && ['send', 'receive'].includes(op.action), `AsyncAPI action required: ${id}`);
      requireThat(object(op.channel) && typeof op.channel.$ref === 'string', `AsyncAPI channel reference required: ${id}`);
      requireThat(pointer(op.channel.$ref)[0] === 'channels', `AsyncAPI channel must point to channels: ${id}`);
      resolve(doc, op.channel.$ref);
      result.set(id, { operation: op, ref: `#/operations/${esc(id)}`, channel: op.channel.$ref });
    }
  }
  requireThat(object(doc.info) && doc.info.title && doc.info.version, `${kind} info.title/version required`);
  return result;
}
function references(node, doc, index) {
  const refs = [];
  if (own(node, '$ref')) refs.push(node.$ref);
  if (own(node, 'operationRef')) refs.push(node.operationRef);
  for (const key of ['$id', '$dynamicRef', '$recursiveRef']) {
    requireThat(!own(node, key), `${key} requires bundling before catalog import`);
  }
  // Discriminator mappings and security requirements do not use $ref.
  if (object(node.discriminator) && object(node.discriminator.mapping)) {
    for (const value of Object.values(node.discriminator.mapping)) {
      refs.push(value.startsWith('#') ? value : `#/components/schemas/${esc(value)}`);
    }
  }
  if (doc.openapi && Array.isArray(node.security)) for (const requirement of node.security) {
    requireThat(object(requirement), 'security requirement must be an object');
    for (const name of Object.keys(requirement)) refs.push(`#/components/securitySchemes/${esc(name)}`);
  }
  // OpenAPI Link Objects can refer to an operation by ID instead of URI.
  if (doc.openapi && node.operationId && !node.responses) {
    requireThat(index.has(node.operationId), `Unknown linked operation: ${node.operationId}`);
    refs.push(index.get(node.operationId).ref);
  }
  return refs;
}
function slice(doc, index, ids, kind) {
  if (!doc || ids.length === 0) return null;
  const out = clone(Object.fromEntries(Object.entries(doc).filter(([k]) => !['paths', 'components', 'channels', 'operations'].includes(k))));
  const pending = [];
  for (const id of ids) {
    const entry = index.get(id);
    requireThat(entry, `Unknown ${kind} operation: ${id}`);
    if (kind === 'openapi') {
      const item = doc.paths[entry.path];
      const base = Object.fromEntries(Object.entries(item).filter(([k]) => !METHODS.includes(k)));
      const ref = `#/paths/${esc(entry.path)}`;
      if (!out.paths || !own(out.paths, entry.path)) put(out, ref, base);
    }
    pending.push(entry.ref);
  }
  const seen = new Set();
  const collect = tree => walk(tree, node => pending.push(...references(node, doc, index)));
  collect(out);
  while (pending.length) {
    const requested = pending.shift();
    resolve(doc, requested); // Validate the exact reference before expanding its containing declaration.
    const parts = pointer(requested);
    const length = parts[0] === 'components' && parts.length >= 3 ? 3
      : ['channels', 'servers', 'operations'].includes(parts[0]) && parts.length >= 2 ? 2 : parts.length;
    const ref = '#/' + parts.slice(0, length).map(esc).join('/');
    if (seen.has(ref)) continue;
    seen.add(ref);
    if (parts[0] === 'paths' && parts.length >= 3) {
      const item = doc.paths[parts[1]];
      const base = Object.fromEntries(Object.entries(item).filter(([k]) => !METHODS.includes(k)));
      for (const [key, value] of Object.entries(base)) put(out, `#/paths/${esc(parts[1])}/${esc(key)}`, value);
      collect(base);
    }
    const value = resolve(doc, ref);
    put(out, ref, value);
    collect(value);
  }
  return out;
}
function ucPath(uc) {
  for (const key of ['business', 'buc', 'uc']) {
    requireThat(typeof uc[key] === 'string' && uc[key].trim() && !/[\\/\x00-\x1f]/.test(uc[key]) &&
      !['.', '..'].includes(uc[key]) && !uc[key].startsWith('_'), `Invalid UC ${key}: ${uc[key]}`);
  }
  return `${uc.business}/${uc.buc}/${uc.uc}`;
}
function compile(catalog) {
  requireThat(object(catalog) && catalog.schema_version === VERSION, `schema_version must be ${VERSION}`);
  requireThat(Array.isArray(catalog.use_cases) && catalog.use_cases.length, 'use_cases required');
  requireThat(catalog.openapi === null || object(catalog.openapi), 'openapi must be a document or null');
  requireThat(catalog.asyncapi === null || object(catalog.asyncapi), 'asyncapi must be a document or null');
  const indexes = { openapi: operations(catalog.openapi, 'openapi'), asyncapi: operations(catalog.asyncapi, 'asyncapi') };
  for (const kind of ['openapi', 'asyncapi']) if (catalog[kind]) {
    walk(catalog[kind], node => { for (const ref of references(node, catalog[kind], indexes[kind])) resolve(catalog[kind], ref); });
  }
  const owners = new Map(), paths = new Set();
  for (const uc of catalog.use_cases) {
    const at = ucPath(uc); requireThat(!paths.has(at), `Duplicate UC: ${at}`); paths.add(at);
    for (const role of ['provides', 'consumes']) {
      requireThat(Array.isArray(uc[role]), `${at}: ${role} must be an array`);
      const seen = new Set();
      for (const entry of uc[role]) {
        requireThat(object(entry) && own(indexes, entry.kind) && indexes[entry.kind].has(entry.operation_id), `${at}: undeclared operation ${entry?.operation_id}`);
        requireThat(typeof entry.tier === 'string' && /^tier-[a-zA-Z0-9_-]+$/.test(entry.tier), `${at}: tier required`);
        const key = `${entry.kind}:${entry.operation_id}`;
        requireThat(!seen.has(`${key}:${entry.tier}`), `${at}: duplicate ${role}: ${key}`); seen.add(`${key}:${entry.tier}`);
        if (role === 'provides') {
          requireThat(!owners.has(key), `Multiple owners: ${key}`);
          owners.set(key, { uc, entry });
        }
      }
    }
  }
  for (const kind of Object.keys(indexes)) for (const id of indexes[kind].keys()) {
    requireThat(owners.has(`${kind}:${id}`), `Missing owner: ${kind}:${id}`);
  }
  const files = new Map();
  for (const kind of ['openapi', 'asyncapi']) if (catalog[kind]) files.set(`_cross-cutting/api/${kind}.yaml`, encode(catalog[kind]));
  for (const uc of catalog.use_cases) {
    const at = ucPath(uc), all = [...uc.provides, ...uc.consumes];
    const selected = kind => [...new Set(all.filter(e => e.kind === kind).map(e => e.operation_id))].sort();
    const projection = { schema_version: 'distillery.contract-slice/v1',
      openapi: slice(catalog.openapi, indexes.openapi, selected('openapi'), 'openapi'),
      asyncapi: slice(catalog.asyncapi, indexes.asyncapi, selected('asyncapi'), 'asyncapi') };
    const sliceText = encode(projection);
    const endpoint = e => {
      const op = indexes[e.kind].get(e.operation_id);
      const base = { ...e, contract_ref: `${e.kind}${op.ref}`, summary: op.operation.summary || e.operation_id };
      if (e.kind === 'openapi') Object.assign(base, { method: op.method, path: op.path });
      else Object.assign(base, { name: e.operation_id, channel: op.channel, direction: op.operation.action === 'send' ? 'publish' : 'subscribe' });
      return base;
    };
    const summary = { schema_version: SUMMARY_VERSION, uc: uc.uc, business: uc.business, buc: uc.buc,
      contract_slice: '_contract-slice.json', contract_sha256: sha(sliceText),
      endpoints: uc.provides.filter(e => e.kind === 'openapi').map(endpoint),
      async_events: uc.provides.filter(e => e.kind === 'asyncapi').map(endpoint),
      consumes: uc.consumes.map(e => ({ ...endpoint(e), owner_uc: ucPath(owners.get(`${e.kind}:${e.operation_id}`).uc) })) };
    files.set(`${at}/_contract-slice.json`, sliceText);
    files.set(`${at}/_api-summary.yaml`, encode(summary));
  }
  return files;
}
function safeTarget(root, rel) {
  const full = path.resolve(root, rel);
  requireThat(full.startsWith(root + path.sep), `Output outside event: ${rel}`);
  let current = root;
  for (const part of path.relative(root, full).split(path.sep)) {
    current = path.join(current, part);
    try { requireThat(!fs.lstatSync(current).isSymbolicLink(), `Symlink output denied: ${current}`); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return full;
}
// A standard bundler owns YAML parsing and external-reference resolution.
// An explicit empty config avoids ambient preprocessors/decorators changing contracts.
function loadCatalog(eventDir) {
  const root = fs.realpathSync(eventDir);
  const source = path.join(root, '_cross-cutting/api/contracts.json');
  const catalog = JSON.parse(fs.readFileSync(source, 'utf8'));
  for (const kind of ['openapi', 'asyncapi']) {
    if (typeof catalog[kind] !== 'string') continue;
    const label = kind === 'openapi' ? 'OpenAPI' : 'AsyncAPI';
    requireThat([`${kind}/${kind}.yaml`, `${kind}.yaml`].includes(catalog[kind]), `Split ${label} entry must be ${kind}/${kind}.yaml`);
    const entry = safeTarget(root, `_cross-cutting/api/${catalog[kind]}`);
    requireThat(fs.existsSync(entry), `Missing split ${label} entry: ${catalog[kind]}`);
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-spec-bundle-'));
    try {
      const output = path.join(temp, `${kind}.json`);
      const config = path.join(temp, 'redocly.yaml');
      fs.writeFileSync(config, '{}');
      let cli = process.env.REDOCLY_CLI;
      if (!cli) {
        try { cli = require.resolve('@redocly/cli/bin/cli.js', { paths: [root, process.cwd(), __dirname] }); }
        catch { /* Globally installed redocly is the last explicit runtime option. */ }
      }
      const args = ['bundle', entry, '--config', config, '--output', output, '--ext', 'json',
        '--component-renaming-conflicts-severity', 'error'];
      try {
        const command = kind === 'asyncapi' ? process.execPath : cli ? process.execPath : 'redocly';
        const commandArgs = kind === 'asyncapi'
          ? [path.join(__dirname, 'bundleAsyncapi.js'), entry, output]
          : cli ? [cli, ...args] : args;
        execFileSync(command, commandArgs,
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000, maxBuffer: 8 * 1024 * 1024,
            env: { ...process.env, REDOCLY_TELEMETRY: 'off', CI: 'true' } });
      } catch (e) {
        throw new Error(`${label} bundle failed. ${kind === 'asyncapi' ? 'Install @apidevtools/json-schema-ref-parser@14.2.1 or set ASYNCAPI_REF_PARSER to its module entry.' : 'Install @redocly/cli@2.51.1 or set REDOCLY_CLI to its bin/cli.js.'} ${e.stderr || e.message}`);
      }
      catalog[kind] = JSON.parse(fs.readFileSync(output, 'utf8'));
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  }
  return catalog;
}
function run(eventDir, check = false) {
  const root = fs.realpathSync(eventDir);
  const source = path.join(root, '_cross-cutting/api/contracts.json');
  const input = JSON.parse(fs.readFileSync(source, 'utf8'));
  const split = new Set(['openapi', 'asyncapi'].filter(kind => typeof input[kind] === 'string'));
  const files = compile(loadCatalog(root));
  for (const kind of split) {
    files.set(`_cross-cutting/api/generated/${kind}.bundle.yaml`, files.get(`_cross-cutting/api/${kind}.yaml`));
    files.delete(`_cross-cutting/api/${kind}.yaml`);
  }
  // Preflight every path and compute all outputs before writing any file.
  for (const rel of files.keys()) safeTarget(root, rel);
  const manifestPath = path.join(root, '_cross-cutting/api/.contracts-build.json');
  safeTarget(root, '_cross-cutting/api/.contracts-build.json');
  const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { files: {} };
  requireThat(object(previous.files), 'Invalid contracts build manifest');
  for (const [rel, hash] of Object.entries(previous.files)) {
    requireThat(/^(?:_cross-cutting\/api\/(?:(?:openapi|asyncapi)\.yaml|generated\/(?:openapi|asyncapi)\.bundle\.yaml)|[^/]+\/[^/]+\/[^/]+\/(?:_api-summary\.yaml|_contract-slice\.json))$/.test(rel) && /^[a-f0-9]{64}$/.test(hash),
      `Invalid generated-file manifest entry: ${rel}`);
  }
  for (const kind of split) requireThat(!own(previous.files, `_cross-cutting/api/${kind}.yaml`),
    `Before migrating, remove the old generated ${kind}.yaml entry from .contracts-build.json after converting it to source`);
  const obsolete = Object.keys(previous.files).filter(rel => !files.has(rel));
  for (const rel of obsolete) {
    const target = safeTarget(root, rel);
    requireThat(!fs.existsSync(target) || sha(fs.readFileSync(target, 'utf8')) === previous.files[rel],
      `Refusing to delete edited generated file: ${rel}`);
  }
  for (const kind of ['openapi', 'asyncapi']) {
    if (split.has(kind)) continue;
    const rel = `_cross-cutting/api/${kind}.yaml`;
    requireThat(files.has(rel) || !fs.existsSync(path.join(root, rel)) || own(previous.files, rel),
      `Unmanaged obsolete contract must be reconciled explicitly: ${rel}`);
  }
  const manifest = encode({ schema_version: 'distillery.contract-build/v1', source_sha256: sha(fs.readFileSync(source, 'utf8')),
    files: Object.fromEntries([...files].map(([rel, text]) => [rel, sha(text)])) });
  files.set('_cross-cutting/api/.contracts-build.json', manifest);
  const stale = [];
  for (const [rel, text] of files) {
    const target = safeTarget(root, rel);
    if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') === text) continue;
    if (check) { stale.push(rel); continue; }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temp = `${target}.tmp-${process.pid}`;
    fs.writeFileSync(temp, text, { flag: 'wx' });
    fs.renameSync(temp, target);
  }
  for (const rel of obsolete) {
    const target = safeTarget(root, rel);
    if (!fs.existsSync(target)) continue;
    if (check) stale.push(rel);
    else fs.unlinkSync(target);
  }
  requireThat(stale.length === 0, `Stale generated contracts: ${stale.join(', ')}`);
  return { status: check ? 'current' : 'generated', files: files.size };
}
if (require.main === module) {
  try {
    requireThat(process.argv[2], 'Usage: node compileContracts.js <event-dir> [--check]');
    console.log(JSON.stringify(run(process.argv[2], process.argv.includes('--check'))));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
function validateSummary(data, ucDir) {
  requireThat(object(data) && data.schema_version === SUMMARY_VERSION, 'API summary v2 required');
  ucPath(data);
  requireThat(data.contract_slice === '_contract-slice.json', 'Fixed local contract_slice required');
  const filename = path.join(ucDir, data.contract_slice);
  requireThat(fs.existsSync(filename) && !fs.lstatSync(filename).isSymbolicLink(), 'Missing regular contract slice');
  const text = fs.readFileSync(filename, 'utf8');
  requireThat(sha(text) === data.contract_sha256, 'Contract slice hash mismatch');
  const projection = JSON.parse(text);
  requireThat(projection.schema_version === 'distillery.contract-slice/v1', 'Contract slice version mismatch');
  const indexes = { openapi: operations(projection.openapi, 'openapi'), asyncapi: operations(projection.asyncapi, 'asyncapi') };
  for (const kind of Object.keys(indexes)) if (projection[kind]) {
    walk(projection[kind], node => { for (const ref of references(node, projection[kind], indexes[kind])) resolve(projection[kind], ref); });
  }
  for (const field of ['endpoints', 'async_events', 'consumes']) {
    requireThat(Array.isArray(data[field]), `Missing ${field}`);
    for (const entry of data[field]) {
      requireThat(object(entry) && own(indexes, entry.kind), `Invalid ${field} kind`);
      const op = indexes[entry.kind].get(entry.operation_id);
      requireThat(op && entry.contract_ref === `${entry.kind}${op.ref}`, `Summary reference mismatch: ${entry.operation_id}`);
      if (entry.kind === 'openapi') requireThat(op.path === entry.path && op.method === entry.method, 'Summary method/path mismatch');
    }
  }
  return true;
}
module.exports = { compile, run, loadCatalog, slice, resolve, encode, sha, ucPath, SUMMARY_VERSION, validateSummary };
