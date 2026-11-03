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
        // x-headers: この example を送るときの要求ヘッダ (値 null はそのヘッダを送らない)。401 / 403 のように認証で決まる応答の入力に使う
        if (object(ex) && own(ex, 'value')) out.push({ mediaType, name, value: ex.value, ...(object(ex['x-headers']) ? { headers: ex['x-headers'] } : {}) });
      }
    }
  }
  return out;
}

const is2xx = s => /^2\d\d$/.test(s);
const is4xx = s => /^4\d\d$/.test(s);
const is5xx = s => /^5\d\d$/.test(s);

/**
 * status に対応する request example を名前で引く。
 *  - 同名の request example があればそれ (409 の response example `conflict` ↔ request example `conflict`)。
 *  - request が単数形 `example` のみのときは 2xx にだけ対応づける。
 *  - どちらも無ければ null (呼び出し側で it.todo にする)。
 */
function requestExampleFor(reqExamples, responseName, status) {
  const named = reqExamples.find(r => r.name === responseName);
  if (named) return named;
  const singular = reqExamples.find(r => r.name === 'example');
  if (singular && is2xx(status)) return singular;
  return null;
}

/**
 * operation の `x-test-requests` (response example 名 → { path, headers, fixture })。
 * ボディ無しの応答は example 名が無いので status の文字列 ('204' 等) をキーにする。
 */
function testRequestFor(operation, key) {
  const all = object(operation['x-test-requests']) ? operation['x-test-requests'] : {};
  return object(all[key]) ? all[key] : null;
}

const fixtureOf = testReq => (testReq && typeof testReq.fixture === 'string' && testReq.fixture ? testReq.fixture : null);

/** テスト用データ (fixture) の宣言。文書直下の `x-test-fixtures` に operation の `x-test-fixtures` を重ねる (名前 → 説明)。 */
function testFixtures(doc, operation) {
  const out = {};
  for (const src of [doc && doc['x-test-fixtures'], operation && operation['x-test-fixtures']]) {
    if (object(src)) for (const [k, v] of Object.entries(src)) out[k] = v;
  }
  return out;
}

/**
 * 要求ヘッダ。文書直下 → operation の `x-test-headers` → request example の `x-headers` → `x-test-requests[名前].headers` の順に重ねる
 * (値 null はそのヘッダを送らない)。値 "{uuid}" はここでは文字列のまま返す (毎回新しい UUID にするのは生成側)。
 * HTTP ヘッダ名は大文字小文字を区別しないので、小文字化したキーで重ね、最後に指定された表記と値を使う。
 */
function testHeaders(doc, operation, reqExample, testReq) {
  const merged = new Map();
  for (const src of [doc && doc['x-test-headers'], operation['x-test-headers'], reqExample && reqExample.headers, testReq && testReq.headers]) {
    if (!object(src)) continue;
    for (const [k, v] of Object.entries(src)) merged.set(k.toLowerCase(), [k, v]);
  }
  return [...merged.values()].filter(([, v]) => v !== null && v !== undefined);
}

/** 経路の `{param}` を埋める。`x-test-requests[名前].path` の値は URL エンコードし、指定の無い引数は `test-<param>` のまま。 */
function testUrl(pathTemplate, testReq) {
  const values = testReq && object(testReq.path) ? testReq.path : {};
  return pathTemplate.replace(/\{([^}]+)\}/g, (_, p) => (own(values, p) && values[p] !== null && values[p] !== undefined
    ? encodeURIComponent(String(values[p])) : `test-${p}`));
}

/**
 * 契約テストの 1 件ごとの計画。生成 (genContractTests) と検査 (validateUcIndex の区別できない例) が同じ結果を使う。
 * 返す要素は { todo } か { status, name, hasContent, reqExample, request: { url, headers, fixture, body? } }。
 *  - 2xx / 4xx は従来どおり。5xx は `x-test-requests[名前].fixture` があるときだけテストにし、無ければ todo。
 *  - それ以外の status (1xx / 3xx) は扱わない。
 */
function contractTestCases(entry, doc) {
  const operation = entry.operation;
  const ex = operationExamples(entry, doc);
  const cases = [];
  if (ex.hasRequestBody && ex.requestExamples.length === 0) {
    cases.push({ todo: `${operation.operationId} — requestBody に example を追加する` });
    return cases;
  }
  for (const [status, r] of Object.entries(ex.responses)) {
    const server = is5xx(status);
    if (!(is2xx(status) || is4xx(status) || server)) continue;
    if (r.hasContent && r.examples.length === 0) {
      // 5xx の example は必須ではないので todo にしない
      if (!server) cases.push({ todo: `responds ${status} — response example を追加する` });
      continue;
    }
    // ボディ無しの 5xx は x-test-requests['<status>'].fixture があるときだけテストにする (無ければ従来どおり扱わない)
    if (server && !r.hasContent && !fixtureOf(testRequestFor(operation, status))) continue;
    const names = r.hasContent ? r.examples.map(e => e.name) : [null];
    for (const name of names) {
      const reqExample = ex.hasRequestBody ? requestExampleFor(ex.requestExamples, name, status) : null;
      if (ex.hasRequestBody && !reqExample) {
        cases.push({ todo: name === null
          ? `${status}: request example missing — 同名の request example を追加する`
          : `${status}: request example "${name}" missing — 同名の request example を追加する` });
        continue;
      }
      const testReq = testRequestFor(operation, name === null ? status : name);
      const fixture = fixtureOf(testReq);
      if (server && !fixture) {
        cases.push({ todo: `${status}${name === null ? '' : ` (example: ${name})`}: fixture missing — 失敗を起こすテスト用データを x-test-requests に指定する` });
        continue;
      }
      const request = { url: testUrl(entry.path, testReq), headers: testHeaders(doc, operation, reqExample, testReq), fixture };
      if (reqExample) request.body = reqExample.value;
      const resEx = name === null ? null : r.examples.find(e => e.name === name);
      cases.push({ status, name, hasContent: r.hasContent, reqExample, request, response: resEx ? resEx.value : undefined });
    }
  }
  return cases;
}

/** 要求の比較用の正規形 (ヘッダ名は小文字・並び替え、本文はキーを並べた JSON)。"{uuid}" は同じ値として扱う。 */
function requestKey(request) {
  const sorted = v => Array.isArray(v) ? v.map(sorted)
    : object(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted(v[k])])) : v;
  const headers = request.headers.map(([k, v]) => [k.toLowerCase(), String(v)]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return JSON.stringify([request.url, headers, request.fixture, own(request, 'body') ? ['body', sorted(request.body)] : ['none']]);
}

/**
 * 同じ要求を送るのに、期待する結果が違う 2 つの例の組 (区別できない例) を返す: [{ a: {status, name}, b: {status, name} }]。
 * 結果が違う = status が違うか、status が同じで応答の例の中身が違う (経費精算の 409 の「状態が違う」と「版が違う」)。中身まで同じ例の重なりは区別の要らない重複なので返さない
 */
function indistinguishableExamples(entry, doc) {
  const seen = new Map();
  const pairs = [];
  for (const c of contractTestCases(entry, doc)) {
    if (!c.request) continue;
    const key = requestKey(c.request);
    const prev = seen.get(key) || [];
    const sameResult = (x, y) => x.status === y.status && JSON.stringify(x.response) === JSON.stringify(y.response);
    for (const p of prev) if (!sameResult(p, c)) pairs.push({ a: { status: p.status, name: p.name }, b: { status: c.status, name: c.name } });
    prev.push(c);
    seen.set(key, prev);
  }
  return pairs;
}

/**
 * `x-test-requests` のキーのうち、どの応答の例にも当たらないもの (書き間違い。指定した URL の値・ヘッダ・fixture が黙って使われなくなる)。
 * キーは応答の例の名前か、ボディ無しの応答の status ('204' など)
 */
function unknownTestRequestKeys(entry, doc) {
  const all = object(entry.operation['x-test-requests']) ? entry.operation['x-test-requests'] : {};
  const known = new Set();
  for (const [status, r] of Object.entries(operationExamples(entry, doc).responses)) {
    if (!r.hasContent) known.add(String(status));
    for (const e of r.examples) known.add(e.name);
  }
  return Object.keys(all).filter(k => !known.has(k)).sort();
}

/** operation の `x-test-requests` が参照する fixture のうち、`x-test-fixtures` (文書 / operation) に無いものの名前。 */
function undeclaredFixtures(entry, doc) {
  const declared = testFixtures(doc, entry.operation);
  const all = object(entry.operation['x-test-requests']) ? entry.operation['x-test-requests'] : {};
  const out = new Set();
  for (const v of Object.values(all)) if (object(v) && typeof v.fixture === 'string' && !own(declared, v.fixture)) out.add(v.fixture);
  return [...out].sort();
}

/** operation の `x-test-requests` が参照し、宣言されている fixture (名前 → 説明)。 */
function usedFixtures(entry, doc) {
  const declared = testFixtures(doc, entry.operation);
  const all = object(entry.operation['x-test-requests']) ? entry.operation['x-test-requests'] : {};
  const out = {};
  for (const v of Object.values(all)) if (object(v) && typeof v.fixture === 'string' && own(declared, v.fixture)) out[v.fixture] = declared[v.fixture];
  return out;
}

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
  is2xx, is4xx, is5xx,
  requestExampleFor, testRequestFor, testFixtures, testHeaders, testUrl, unknownTestRequestKeys,
  contractTestCases, requestKey, indistinguishableExamples, undeclaredFixtures, usedFixtures,
};
