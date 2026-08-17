#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
}

function validateReviewHtml(html) {
  const errors = [];
  for (const heading of ['ユーザーにお願いしたいこと', '決めてほしいことの詳細', '実装の構成', '処理フロー', 'データフロー', '動かし方', 'テストと確認方法', '判断後に起きること']) {
    if (!html.includes(heading)) errors.push(`missing heading: ${heading}`);
  }
  if (!/機能=A[\s\S]*相互運用=A[\s\S]*監査=A/.test(html)) errors.push('missing copyable decision response template');
  if (!/推奨/.test(html)) errors.push('missing recommended choice');

  const figures = [...html.matchAll(/<figure\b[\s\S]*?<\/figure>/g)].map(match => match[0]);
  if (figures.length < 3) errors.push(`expected at least 3 figures, got ${figures.length}`);
  for (const [index, figure] of figures.entries()) {
    const svg = figure.match(/<svg\b[\s\S]*?<\/svg>/)?.[0];
    if (!svg) {
      errors.push(`figure ${index + 1}: missing inline SVG`);
      continue;
    }
    if (!/<svg\b[^>]*role="img"/.test(svg) || !/<title\b/.test(svg) || !/<desc\b/.test(svg)) {
      errors.push(`figure ${index + 1}: missing role=img, title, or desc`);
    }
    if (!/<figcaption\b/.test(figure)) errors.push(`figure ${index + 1}: missing figcaption`);
    if (!/class="legend"/.test(figure)) errors.push(`figure ${index + 1}: missing legend`);

    const connectorStart = svg.indexOf('<g data-layer="connectors"');
    const nodeStart = svg.indexOf('<g data-layer="nodes"');
    if (connectorStart < 0 || nodeStart < 0 || connectorStart >= nodeStart) {
      errors.push(`figure ${index + 1}: connectors layer must exist before nodes layer`);
      continue;
    }
    const connectorEnd = svg.indexOf('</g>', connectorStart);
    const connectorLayer = svg.slice(connectorStart, connectorEnd);
    const connectors = [...connectorLayer.matchAll(/<(?:path|line)\b[^>]*marker-end="[^"]+"[^>]*>/g)].map(match => match[0]);
    if (connectors.length === 0) errors.push(`figure ${index + 1}: no directed connector`);
    for (const connector of connectors) {
      const attrs = attributes(connector);
      if (connector.startsWith('<line')) {
        if (attrs.x1 !== attrs.x2 && attrs.y1 !== attrs.y2) errors.push(`figure ${index + 1}: diagonal line connector`);
        continue;
      }
      const d = attrs.d || '';
      if (/[Ll]/.test(d)) errors.push(`figure ${index + 1}: diagonal-capable L command in connector`);
      if (/H[^QHV]*V|V[^QHV]*H/.test(d)) {
        errors.push(`figure ${index + 1}: unrounded orthogonal bend`);
      }
      if (/[^0-9.,+\-\sMHVQ]/.test(d)) errors.push(`figure ${index + 1}: unsupported connector path command`);
    }
    const type = attributes(svg.match(/<svg\b[^>]*>/)[0])['data-diagram-type'];
    if (!['architecture', 'flowchart', 'data-flow'].includes(type)) errors.push(`figure ${index + 1}: missing supported diagram type`);
    if (type === 'flowchart' && !/data-node-shape="decision"/.test(svg.slice(nodeStart))) {
      errors.push(`figure ${index + 1}: flowchart has no decision node`);
    }
  }
  const textAlternatives = (html.match(/class="text-alt"/g) || []).length;
  if (textAlternatives < figures.length) errors.push('each figure needs a text alternative');
  return errors;
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    process.stderr.write('usage: validateReviewHtml.js <review.html>\n');
    process.exit(2);
  }
  const errors = validateReviewHtml(fs.readFileSync(file, 'utf8'));
  if (errors.length > 0) {
    process.stderr.write(`${errors.join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write('review HTML contract: pass\n');
}

module.exports = { validateReviewHtml };
