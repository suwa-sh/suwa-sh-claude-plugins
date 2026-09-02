#!/usr/bin/env node
'use strict';
// 各ドメインの latest/ 正本 YAML から、下流 Step が「索引 → 必要セクションだけ」読める `_digest/` を生成する。
// 正本は変更しない。`_digest/` は派生物（再生成可能）で、index.md に正本の sha256 を記録する。
//
// Usage:
//   node buildDigest.js <docs-root> [--domain arch,nfr,design] [--force]
//
// 生成物:
//   docs/arch/latest/_digest/{technology_context,domain_architecture,system_architecture,app_architecture,data_architecture}.yaml + index.md
//   docs/nfr/latest/_digest/{model_system,category-A,...}.yaml + index.md   （category は categories[].id ごと）
//   docs/design/latest/_digest/{brand,portals,tokens,components,screens,states,nfr_decisions,storybook}.yaml + index.md
//
// 冪等: index.md の source_sha256 が正本と一致すれば再生成しない（--force で強制）。
// 消費側ルール: `_digest/index.md` を読み、sha256 が正本と一致していれば必要なセクションファイルだけ読む。
//               不一致 / 未生成なら本スクリプトを実行してから読む。

const fs = require('node:fs');
const path = require('node:path');
const { sliceSection, sha256 } = require('./extractSections');

const DOMAINS = {
  arch: {
    source: 'arch/latest/arch-design.yaml',
    sections: () => ['technology_context', 'domain_architecture', 'system_architecture', 'app_architecture', 'data_architecture'].map(k => ({ path: k, file: `${k}.yaml` })),
  },
  nfr: {
    source: 'nfr/latest/nfr-grade.yaml',
    sections: (text) => {
      const list = [{ path: 'model_system', file: 'model_system.yaml' }];
      // categories[].id を原文から列挙（トップレベル categories: の直下の `  - id: "X"`）
      const m = sliceSection(text, 'categories');
      if (m.found) {
        for (const line of m.text.split('\n')) {
          const mm = /^  - id:\s*["']?([A-Za-z0-9_.-]+)["']?\s*$/.exec(line);
          if (mm) list.push({ path: `categories[id=${mm[1]}]`, file: `category-${mm[1]}.yaml` });
        }
      }
      return list;
    },
  },
  design: {
    source: 'design/latest/design-event.yaml',
    sections: () => ['brand', 'portals', 'tokens', 'components', 'screens', 'states', 'nfr_decisions', 'storybook'].map(k => ({ path: k, file: `${k}.yaml` })),
  },
};

function readIndexSha(indexPath) {
  try {
    const m = /source_sha256:\s*`?([0-9a-f]{64})`?/.exec(fs.readFileSync(indexPath, 'utf-8'));
    return m ? m[1] : null;
  } catch { return null; }
}

function buildDomain(docsRoot, name, opts = {}) {
  const def = DOMAINS[name];
  const sourcePath = path.join(docsRoot, def.source);
  if (!fs.existsSync(sourcePath)) return { domain: name, status: 'source_missing', source: sourcePath };
  const text = fs.readFileSync(sourcePath, 'utf-8');
  const sha = sha256(text);
  const digestDir = path.join(path.dirname(sourcePath), '_digest');
  const indexPath = path.join(digestDir, 'index.md');
  if (!opts.force && readIndexSha(indexPath) === sha) return { domain: name, status: 'up_to_date', digest_dir: digestDir, sha256: sha };

  fs.rmSync(digestDir, { recursive: true, force: true });
  fs.mkdirSync(digestDir, { recursive: true });
  const rows = [];
  for (const sec of def.sections(text)) {
    const r = sliceSection(text, sec.path);
    if (!r.found) { rows.push({ ...sec, status: 'not_applicable', lines: 0, bytes: 0 }); continue; }
    const body = `# digest of ${def.source} section ${sec.path} (L${r.startLine}-${r.endLine}); source_sha256: ${sha}\n# 派生物。正本は ${path.basename(sourcePath)}。編集しない\n${r.text}\n`;
    fs.writeFileSync(path.join(digestDir, sec.file), body, 'utf-8');
    rows.push({ ...sec, status: 'ok', lines: r.text.split('\n').length, bytes: Buffer.byteLength(r.text, 'utf-8') });
  }
  const index = [
    `# ${name} digest index`,
    '',
    `- source: \`${def.source}\``,
    `- source_sha256: \`${sha}\``,
    `- generated_by: \`buildDigest.js\`（派生物。正本の sha256 が一致するときだけ有効。不一致なら再生成する）`,
    '',
    '| section | file | lines | bytes | status |',
    '|---|---|---:|---:|---|',
    ...rows.map(r => `| \`${r.path}\` | ${r.status === 'ok' ? `\`_digest/${r.file}\`` : '-'} | ${r.lines} | ${r.bytes} | ${r.status} |`),
    '',
    '読み方: 必要な section の file だけを読む。`not_applicable` は正本にセクションが無い（元ファイルを読みに行かない）。',
    '',
  ].join('\n');
  fs.writeFileSync(indexPath, index, 'utf-8');
  return { domain: name, status: 'generated', digest_dir: digestDir, sha256: sha, sections: rows };
}

function buildAll(docsRoot, domains, opts = {}) {
  return domains.map(d => buildDomain(docsRoot, d, opts));
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length < 1 || args[0].startsWith('--')) {
    console.error('Usage: node buildDigest.js <docs-root> [--domain arch,nfr,design] [--force]');
    process.exit(1);
  }
  const docsRoot = args[0];
  let domains = Object.keys(DOMAINS); let force = false;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--domain') domains = args[++i].split(',').map(s => s.trim()).filter(s => DOMAINS[s]);
    else if (args[i] === '--force') force = true;
  }
  const results = buildAll(docsRoot, domains, { force });
  for (const r of results) {
    const extra = r.sections ? ` (${r.sections.filter(s => s.status === 'ok').length} sections, not_applicable: ${r.sections.filter(s => s.status !== 'ok').map(s => s.path).join(', ') || 'none'})` : '';
    console.log(`${r.domain}: ${r.status}${r.digest_dir ? ` ${r.digest_dir}` : ''}${extra}`);
  }
}

module.exports = { DOMAINS, buildDomain, buildAll, readIndexSha };

if (require.main === module) main(process.argv);
