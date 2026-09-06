#!/usr/bin/env node
'use strict';
// Keep Reference Objects intact: dereferencing AsyncAPI operation.channel is invalid.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
async function main() {
  const [entry, output] = process.argv.slice(2);
  if (!entry || !output) throw new Error('Usage: bundleAsyncapi.js <entry> <output>');
  const modulePath = process.env.ASYNCAPI_REF_PARSER || require.resolve('@apidevtools/json-schema-ref-parser',
    { paths: [path.dirname(entry), process.cwd(), __dirname] });
  const { default: Parser } = await import(pathToFileURL(modulePath).href);
  const bundled = await Parser.bundle(entry, { resolve: { http: false } });
  normalizeNativeReferences(bundled);
  fs.writeFileSync(output, JSON.stringify(bundled, null, 2) + '\n');
}

// Generic bundling can shorten a message pointer to components/messages. AsyncAPI
// requires operation message pointers to pass through their channel's message map.
// Re-anchor only by resolved object identity, never by guessed names or payload shape.
function normalizeNativeReferences(doc) {
  const esc = s => s.replace(/~/g, '~0').replace(/\//g, '~1');
  function target(node, seen = new Set()) {
    if (!node || typeof node !== 'object' || !node.$ref) return node;
    if (!node.$ref.startsWith('#/')) throw new Error(`Unbundled reference: ${node.$ref}`);
    if (seen.has(node.$ref)) throw new Error(`Circular reference alias: ${node.$ref}`);
    seen.add(node.$ref);
    let value = doc;
    for (const key of node.$ref.slice(2).split('/').map(s => decodeURIComponent(s).replace(/~1/g, '/').replace(/~0/g, '~'))) {
      if (!value || !Object.hasOwn(value, key)) throw new Error(`Unresolved reference: ${node.$ref}`);
      value = value[key];
    }
    return target(value, seen);
  }
  function reference(node, entries, base, label) {
    if (!node || typeof node.$ref !== 'string') throw new Error(`${label} requires a Reference Object`);
    const value = target(node);
    const matches = Object.entries(entries || {}).filter(([, candidate]) => target(candidate) === value);
    const current = matches.find(([key]) => node.$ref === `${base}/${esc(key)}`);
    if (!current && matches.length !== 1) throw new Error(`${label}: reference must resolve uniquely in ${base}`);
    node.$ref = `${base}/${esc((current || matches[0])[0])}`;
    return value;
  }
  for (const channelNode of Object.values(doc.channels || {})) {
    const channel = target(channelNode);
    for (const server of channel.servers || []) reference(server, doc.servers, '#/servers', 'Channel server');
  }
  function operation(op, isReply = false) {
    if (isReply && !op.channel && !op.messages?.length) return;
    const channel = reference(op.channel, doc.channels, '#/channels', 'Operation channel');
    for (const message of op.messages || []) reference(message, channel.messages, `${op.channel.$ref}/messages`, 'Operation message');
    if (op.reply) operation(target(op.reply), true);
  }
  for (const op of Object.values(doc.operations || {})) operation(target(op));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
