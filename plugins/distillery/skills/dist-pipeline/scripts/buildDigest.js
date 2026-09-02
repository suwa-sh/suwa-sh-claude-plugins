#!/usr/bin/env node
'use strict';
// 各ドメインの latest/ 正本 YAML から、下流 Step が「索引 → 必要セクションだけ」読める `_digest/` を生成する。
// 正本は変更しない。`_digest/` は派生物（再生成可能）で、index.md に正本と各派生ファイルの sha256 を記録する。
//
// Usage:
//   node buildDigest.js <docs-root> [--domain arch,nfr,design] [--force]
//
// 生成物:
//   docs/arch/latest/_digest/{technology_context,domain_architecture,system_architecture,app_architecture,data_architecture}.yaml + index.md
//   docs/nfr/latest/_digest/{model_system,category-A,...}.yaml + index.md   （category は categories[].id ごと。index に name も載る）
//   docs/design/latest/_digest/{brand,portals,tokens,components,screens,states,nfr_decisions,storybook}.yaml + index.md
//
// 冪等: index.md の source_sha256 が正本と一致し、かつ index に記録された全派生ファイルが存在して sha256 が一致するときだけ
//       `up_to_date`（1 つでも欠落・改変があれば再生成）。--force で強制再生成。
// 正本が無いドメイン: 既存の `_digest/` を削除して `source_missing` を返す（stale な派生物を残さない）。
//       --domain で明示指定されたドメインの正本が無い場合は終了コード 2。
// 消費側ルール: `_digest/index.md` を読み、sha256 が正本と一致していれば必要なセクションファイルだけ読む。
//               不一致 / 未生成なら本スクリプトを実行し、成功（終了コード 0）を確認してから読む。

const fs = require('node:fs');
const path = require('node:path');
const { sliceSection, listItemValues, sha256 } = require('./extractSections');

const DOMAINS = {
  arch: {
    source: 'arch/latest/arch-design.yaml',
    sections: () => ['technology_context', 'domain_architecture', 'system_architecture', 'app_architecture', 'data_architecture'].map(k => ({ path: k, file: `${k}.yaml`, name: '' })),
  },
  nfr: {
    source: 'nfr/latest/nfr-grade.yaml',
    sections: (text) => {
      const list = [{ path: 'model_system', file: 'model_system.yaml', name: '' }];
      for (const c of listItemValues(text, 'categories', 'id', ['name'])) {
        if (!/^[A-Za-z0-9_.-]+$/.test(c.id)) continue;
        list.push({ path: `categories[id=${c.id}]`, file: `category-${c.id}.yaml`, name: c.name || '' });
      }
      return list;
    },
  },
  design: {
    source: 'design/latest/design-event.yaml',
    sections: () => ['brand', 'portals', 'tokens', 'components', 'screens', 'states', 'nfr_decisions', 'storybook'].map(k => ({ path: k, file: `${k}.yaml`, name: '' })),
  },
};

// index.md の全データ行を構造化して読む: { path, file|null, name, status, sha256|null }
function readIndex(indexPath) {
  try {
    const text = fs.readFileSync(indexPath, 'utf-8');
    const m = /source_sha256:\s*`?([0-9a-f]{64})`?/.exec(text);
    const rows = [];
    for (const line of text.split('\n')) {
      const mm = /^\|\s*`([^`]+)`\s*\|\s*(?:`_digest\/([^`]+)`|-)\s*\|\s*([^|]*?)\s*\|\s*[^|]*\|\s*[^|]*\|\s*(ok|not_applicable)\s*\|\s*(?:`([0-9a-f]{64})`|-)\s*\|/.exec(line);
      if (mm) rows.push({ path: mm[1], file: mm[2] || null, name: mm[3] === '-' ? '' : mm[3], status: mm[4], sha256: mm[5] || null });
    }
    return { sourceSha: m ? m[1] : null, rows, files: rows.filter(r => r.status === 'ok' && r.file && r.sha256).map(r => ({ file: r.file, sha256: r.sha256 })) };
  } catch { return null; }
}

function readIndexSha(indexPath) {
  const idx = readIndex(indexPath);
  return idx ? idx.sourceSha : null;
}

// 正本から再計算した行（path / file / name / status）と index の行が順序込みで完全一致し、
// 全 ok ファイルが存在して sha256 が一致するとき true
function digestIsCurrent(digestDir, sourceSha, expectedRows) {
  const idx = readIndex(path.join(digestDir, 'index.md'));
  if (!idx || idx.sourceSha !== sourceSha) return false;
  if (expectedRows) {
    if (idx.rows.length !== expectedRows.length) return false;
    for (let i = 0; i < expectedRows.length; i++) {
      const a = idx.rows[i]; const e = expectedRows[i];
      if (a.path !== e.path || a.file !== e.file || a.name !== e.name || a.status !== e.status) return false;
    }
  }
  if (idx.files.length === 0) return false;
  for (const f of idx.files) {
    const p = path.join(digestDir, f.file);
    if (!fs.existsSync(p)) return false;
    if (sha256(fs.readFileSync(p, 'utf-8')) !== f.sha256) return false;
  }
  return true;
}

// 正本から期待される index 行（ok / not_applicable）を再計算する。flow style 等の非対応 YAML は UNSUPPORTED_YAML を投げる
function expectedRowsOf(def, text) {
  return def.sections(text).map(sec => {
    const r = sliceSection(text, sec.path);
    if (r.unsupported) { const err = new Error(`${sec.path}: ${r.reason}`); err.code = 'UNSUPPORTED_YAML'; throw err; }
    return { path: sec.path, file: r.found ? sec.file : null, name: sec.name || '', status: r.found ? 'ok' : 'not_applicable' };
  });
}

function expectedFilesOf(def, text) {
  return expectedRowsOf(def, text).filter(r => r.status === 'ok').map(r => r.file);
}

function buildDomain(docsRoot, name, opts = {}) {
  const def = DOMAINS[name];
  const sourcePath = path.join(docsRoot, def.source);
  const digestDir = path.join(path.dirname(sourcePath), '_digest');
  if (!fs.existsSync(sourcePath)) {
    const removed = fs.existsSync(digestDir);
    fs.rmSync(digestDir, { recursive: true, force: true });
    return { domain: name, status: 'source_missing', source: sourcePath, removed_stale_digest: removed };
  }
  const text = fs.readFileSync(sourcePath, 'utf-8');
  const sha = sha256(text);
  const indexPath = path.join(digestDir, 'index.md');
  let expected;
  try {
    expected = expectedRowsOf(def, text);
  } catch (e) {
    if (e.code === 'UNSUPPORTED_YAML') return { domain: name, status: 'unsupported', source: sourcePath, reason: e.message };
    throw e;
  }
  if (!opts.force && digestIsCurrent(digestDir, sha, expected)) return { domain: name, status: 'up_to_date', digest_dir: digestDir, sha256: sha };

  fs.rmSync(digestDir, { recursive: true, force: true });
  fs.mkdirSync(digestDir, { recursive: true });
  const rows = [];
  for (const sec of def.sections(text)) {
    const r = sliceSection(text, sec.path);
    if (!r.found) { rows.push({ ...sec, status: 'not_applicable', lines: 0, bytes: 0, sha256: '' }); continue; }
    const body = `# digest of ${def.source} section ${sec.path} (L${r.startLine}-${r.endLine}); source_sha256: ${sha}\n# 派生物。正本は ${path.basename(sourcePath)}。編集しない\n${r.text}\n`;
    fs.writeFileSync(path.join(digestDir, sec.file), body, 'utf-8');
    rows.push({ ...sec, status: 'ok', lines: r.text.split('\n').length, bytes: Buffer.byteLength(r.text, 'utf-8'), sha256: sha256(body) });
  }
  const index = [
    `# ${name} digest index`,
    '',
    `- source: \`${def.source}\``,
    `- source_sha256: \`${sha}\``,
    `- generated_by: \`buildDigest.js\`（派生物。正本の sha256 と各 file の sha256 が一致するときだけ有効。不一致なら再生成する）`,
    '',
    '| section | file | name | lines | bytes | status | file_sha256 |',
    '|---|---|---|---:|---:|---|---|',
    ...rows.map(r => `| \`${r.path}\` | ${r.status === 'ok' ? `\`_digest/${r.file}\`` : '-'} | ${r.name || '-'} | ${r.lines} | ${r.bytes} | ${r.status} | ${r.sha256 ? `\`${r.sha256}\`` : '-'} |`),
    '',
    '読み方: 必要な section の file だけを読む。`not_applicable` は正本にセクションが無い（元ファイルを読みに行かない）。',
    'nfr の `name` 列はカテゴリ名（id ↔ 名前の対応はここで確認する）。',
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
  let domains = Object.keys(DOMAINS); let force = false; let explicit = false;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--domain') {
      explicit = true;
      const raw = args[++i];
      const list = (raw || '').split(',').map(s => s.trim()).filter(Boolean);
      const unknown = list.filter(s => !DOMAINS[s]);
      if (!raw || list.length === 0 || unknown.length) {
        console.error(`error: --domain must be a comma-separated list of ${Object.keys(DOMAINS).join(' | ')}${unknown.length ? ` (unknown: ${unknown.join(', ')})` : ''}`);
        process.exit(1);
      }
      domains = list;
    } else if (args[i] === '--force') force = true;
    else {
      console.error(`error: unknown option ${args[i]}`);
      process.exit(1);
    }
  }
  const results = buildAll(docsRoot, domains, { force });
  let exitCode = 0;
  for (const r of results) {
    const extra = r.sections ? ` (${r.sections.filter(s => s.status === 'ok').length} sections, not_applicable: ${r.sections.filter(s => s.status !== 'ok').map(s => s.path).join(', ') || 'none'})` : '';
    const stale = r.removed_stale_digest ? ' (stale _digest removed)' : '';
    console.log(`${r.domain}: ${r.status}${r.digest_dir ? ` ${r.digest_dir}` : ''}${extra}${stale}${r.reason ? ` (${r.reason})` : ''}`);
    if (r.status === 'source_missing' && explicit) exitCode = 2;
    if (r.status === 'unsupported') exitCode = 3;
  }
  process.exit(exitCode);
}

module.exports = { DOMAINS, buildDomain, buildAll, readIndexSha, readIndex, digestIsCurrent, expectedFilesOf, expectedRowsOf };

if (require.main === module) main(process.argv);
