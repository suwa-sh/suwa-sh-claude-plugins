'use strict';

/**
 * contractGraph.js — OpenAPI 3.1 / AsyncAPI 3.0 の bundle を歩いて slice を切る中核。
 *
 * v1 (distillery:dist-spec/compileContracts.js) の JSON Pointer 解決・参照追跡・slice を移植した。
 * v2 の違い:
 *  - 契約の正本は分割 YAML。bundle は redocly / ref-parser が作る (このモジュールは bundle を受け取る)。
 *  - UC ごとの slice は uc-index.yaml (operations / messages / tables) から作る。
 *    v1 の use_cases[].provides/consumes と _api-summary は持ち込まない。
 *  - asyncapi の slice は「message 名 → その message を扱う operation 群」に解決してから operation slice する。
 *
 * 他プラグインを require しない。examples 列挙のヘルパも持つ (examples 必須ルールの土台)。
 */

const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const requireThat = (ok, message) => { if (!ok) throw new Error(message); };
const clone = x => JSON.parse(JSON.stringify(x));
const esc = key => String(key).replace(/~/g, '~0').replace(/\//g, '~1');

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
    if (!own(node, key)) node[key] = {};
    node = node[key];
  }
  node[parts.at(-1)] = clone(value);
}
function walk(value, visit) {
  if (value === null || typeof value !== 'object') return;
  visit(value);
  for (const child of Object.values(value)) walk(child, visit);
}

/** operationId / operation id を索引化する。openapi は path item を、asyncapi は operations を歩く。 */
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
        result.set(op.operationId, { operation: op, method: method.toUpperCase(), path: url, ref: `#/paths/${esc(url)}/${method}` });
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
  for (const key of ['$id', '$dynamicRef', '$recursiveRef']) requireThat(!own(node, key), `${key} requires bundling before slicing`);
  if (object(node.discriminator) && object(node.discriminator.mapping)) {
    for (const value of Object.values(node.discriminator.mapping)) refs.push(value.startsWith('#') ? value : `#/components/schemas/${esc(value)}`);
  }
  if (doc.openapi && Array.isArray(node.security)) for (const requirement of node.security) {
    requireThat(object(requirement), 'security requirement must be an object');
    for (const name of Object.keys(requirement)) refs.push(`#/components/securitySchemes/${esc(name)}`);
  }
  if (doc.openapi && node.operationId && !node.responses) {
    requireThat(index.has(node.operationId), `Unknown linked operation: ${node.operationId}`);
    refs.push(index.get(node.operationId).ref);
  }
  return refs;
}

/** operation id 群を含む最小の doc を切り出す ($ref を閉包する)。v1 slice() 移植。 */
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
    resolve(doc, requested);
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

/** asyncapi の message 名 (components.messages のキー) を、その message を扱う operation id 群へ写像する。 */
function operationsForMessages(doc, index, messageNames) {
  const wanted = new Set(messageNames);
  const found = new Set();
  const ids = new Set();
  for (const [id, entry] of index) {
    for (const m of entry.operation.messages || []) {
      let target;
      try { target = resolveMessageName(doc, m.$ref); } catch { continue; }
      if (target && wanted.has(target)) { ids.add(id); found.add(target); }
    }
  }
  return { ids: [...ids], found };
}

/** message 参照 ($ref) を components.messages のキー名へ解決する。channel 経由の多段 $ref も辿る。 */
function resolveMessageName(doc, ref) {
  const parts = pointer(ref);
  if (parts[0] === 'components' && parts[1] === 'messages') return parts[2];
  const terminal = deref(doc, resolve(doc, ref));
  for (const [name, candidate] of Object.entries(doc.components?.messages || {})) {
    if (deref(doc, candidate) === terminal) return name;
  }
  return null;
}
/** $ref の連鎖を終端オブジェクトまで辿る。 */
function deref(doc, node, seen = new Set()) {
  while (object(node) && typeof node.$ref === 'string') {
    if (seen.has(node.$ref)) break;
    seen.add(node.$ref);
    node = resolve(doc, node.$ref);
  }
  return node;
}

/** node が $ref を持つなら doc で解決する ($ref 連鎖も辿る)。doc 未指定なら素通し。 */
function derefMaybe(doc, node) {
  return doc && object(node) && typeof node.$ref === 'string' ? deref(doc, node) : node;
}

/**
 * operation の全 media-type examples を列挙する。request と status 別 response を返す。
 * bundle では requestBody / response / example が components への $ref のことがあるため doc で解決する。
 */
function operationExamples(entry, doc) {
  const op = entry.operation;
  const requestBody = derefMaybe(doc, op.requestBody);
  const requestBodies = mediaExamples(requestBody, doc);
  const hasRequestBody = object(requestBody) && object(requestBody.content);
  const responses = {};
  for (const [status, respRaw] of Object.entries(op.responses || {})) {
    const resp = derefMaybe(doc, respRaw);
    responses[status] = { examples: mediaExamples(resp, doc), hasContent: object(resp) && object(resp.content) };
  }
  return { requestExamples: requestBodies, hasRequestBody, responses };
}

/**
 * requestBody / response オブジェクトの content[*].example|examples を [{mediaType, name, value}] に平坦化。
 * holder・media・個々の example が $ref のときは doc で解決する (components/requestBodies・responses・examples)。
 */
function mediaExamples(holder, doc) {
  const out = [];
  holder = derefMaybe(doc, holder);
  if (!object(holder) || !object(holder.content)) return out;
  for (const [mediaType, mediaRaw] of Object.entries(holder.content)) {
    const media = derefMaybe(doc, mediaRaw);
    if (!object(media)) continue;
    if (own(media, 'example')) out.push({ mediaType, name: 'example', value: media.example });
    if (object(media.examples)) {
      for (const [name, exRaw] of Object.entries(media.examples)) {
        const ex = derefMaybe(doc, exRaw);
        if (object(ex) && own(ex, 'value')) out.push({ mediaType, name, value: ex.value });
      }
    }
  }
  return out;
}

const is2xx = s => /^2\d\d$/.test(s);
const is4xx = s => /^4\d\d$/.test(s);

/**
 * examples 必須ルール (名前対応):
 *  - ドキュメント化された各 2xx/4xx status (content あり) に response example が 1 つ以上。
 *  - requestBody があるなら、その各 response example と同名の request example があること
 *    (単数形 `example` は 2xx にだけ対応づく)。requestBody が無ければ request 対応は不要。
 */
function exampleGaps(entry, doc) {
  const ex = operationExamples(entry, doc);
  const gaps = [];
  const reqNames = new Set(ex.requestExamples.map(r => r.name));
  for (const [status, r] of Object.entries(ex.responses)) {
    if (!(is2xx(status) || is4xx(status)) || !r.hasContent) continue;
    if (r.examples.length === 0) { gaps.push(`response ${status}`); continue; }
    if (!ex.hasRequestBody) continue;
    for (const example of r.examples) {
      const paired = reqNames.has(example.name) || (is2xx(status) && reqNames.has('example'));
      if (!paired) gaps.push(`request example "${example.name}" for ${status}`);
    }
  }
  return gaps;
}

/** message (components.messages の 1 件) の examples を [{name, payload, headers}] に平坦化。 */
function messageExamples(message) {
  const out = [];
  if (!object(message) || !Array.isArray(message.examples)) return out;
  message.examples.forEach((ex, i) => {
    if (object(ex) && own(ex, 'payload')) out.push({ name: ex.name || `example-${i}`, payload: ex.payload, headers: ex.headers });
  });
  return out;
}

/** slice / bundle の全 $ref がローカルに解決できることを検査する。 */
function assertResolvable(doc, kind) {
  if (!doc) return;
  const index = operations(doc, kind);
  walk(doc, node => { for (const ref of references(node, doc, index)) resolve(doc, ref); });
}

module.exports = {
  METHODS, own, object, requireThat, clone, esc,
  pointer, resolve, put, walk, operations, references, slice,
  operationsForMessages, resolveMessageName,
  operationExamples, mediaExamples, exampleGaps, messageExamples, assertResolvable,
  is2xx, is4xx,
};
