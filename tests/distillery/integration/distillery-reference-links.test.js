'use strict';

// distillery の SKILL.md / references/**/*.md に書かれた `references/...md` / `scripts/...js` 形式のパスが
// 当該 skill ディレクトリ基準で実在することを検証する。references を分割・移動したときの破断検出用。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const skillsRoot = path.join(root, 'plugins/distillery/skills');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && full.endsWith('.md')) out.push(full);
  }
  return out;
}

// `references/foo/bar.md` / `scripts/baz.js` / `tests/...` のようにバッククォートで囲まれた相対パスだけを対象にする。
// `${CLAUDE_PLUGIN_ROOT}/skills/<skill>/references/...` は plugin root 基準で解決する。
// パス本体は日本語ファイル名（例: references/step6a-story-補完.md）を含むため、バッククォート・空白以外を許容する
const RELATIVE_RE = /`((?:references|scripts)\/[^`\s]+?\.(?:md|js|json))`/g;
const PLUGIN_ROOT_RE = /`\$\{CLAUDE_PLUGIN_ROOT\}\/skills\/([A-Za-z0-9_-]+)\/((?:references|scripts)\/[^`\s]+?\.(?:md|js|json))`/g;

function collectLinks(file) {
  const text = fs.readFileSync(file, 'utf-8');
  const links = [];
  let m;
  while ((m = RELATIVE_RE.exec(text)) !== null) {
    if (m[1].includes('{')) continue; // テンプレート変数入りのパスは対象外
    links.push({ raw: m[0], rel: m[1], base: null });
  }
  while ((m = PLUGIN_ROOT_RE.exec(text)) !== null) {
    links.push({ raw: m[0], rel: m[2], base: path.join(skillsRoot, m[1]) });
  }
  return links;
}

function skillDirOf(file) {
  const rel = path.relative(skillsRoot, file);
  return path.join(skillsRoot, rel.split(path.sep)[0]);
}

test('every references/ and scripts/ path mentioned in distillery skill docs exists', () => {
  const skillDirs = fs.readdirSync(skillsRoot, { withFileTypes: true }).filter(d => d.isDirectory());
  assert.ok(skillDirs.length > 0);
  const missing = [];
  const seen = new Set();
  for (const d of skillDirs) {
    const dir = path.join(skillsRoot, d.name);
    const files = [path.join(dir, 'SKILL.md')].filter(fs.existsSync);
    const refDir = path.join(dir, 'references');
    if (fs.existsSync(refDir)) walk(refDir, files);
    for (const file of files) {
      for (const link of collectLinks(file)) {
        const base = link.base || skillDirOf(file);
        const target = path.join(base, link.rel);
        seen.add(`${d.name}:${link.rel}`);
        if (!fs.existsSync(target)) {
          missing.push(`${path.relative(root, file)}: ${link.raw}`);
        }
      }
    }
  }
  assert.ok(seen.size > 50, `expected to check many links, checked ${seen.size}`);
  // 日本語ファイル名の参照が検査対象に入っていること（ASCII 限定の正規表現に退行していないこと）
  assert.ok(seen.has('dist-pipeline:references/step6a-story-補完.md'), 'non-ASCII reference path must be collected');
  assert.ok(seen.has('dist-pipeline:references/feedback-mode.md'));
  const schemaDoc = fs.readFileSync(path.join(skillsRoot, 'dist-pipeline/references/pipeline-config-schema.md'), 'utf-8');
  assert.ok(schemaDoc.includes('`references/feedback-mode.md` F0b'), 'pipeline-config-schema must reference feedback-mode.md with the references/ prefix');
  assert.deepEqual(missing, [], `broken reference paths:\n${missing.join('\n')}`);
});

test('dist-pipeline SKILL.md delegates feedback mode to references/feedback-mode.md', () => {
  const skill = fs.readFileSync(path.join(skillsRoot, 'dist-pipeline/SKILL.md'), 'utf-8');
  const feedbackMode = fs.readFileSync(path.join(skillsRoot, 'dist-pipeline/references/feedback-mode.md'), 'utf-8');
  assert.ok(skill.includes('`references/feedback-mode.md`'));
  // 実行指示そのもの（feedback 入力検出後・F0 開始前に読む）が残っていること。参照表だけでは不十分
  assert.ok(/F0 開始前に[^\n]*`references\/feedback-mode.md`[^\n]*読み/.test(skill) || /`references\/feedback-mode.md`[^\n]*F0 開始前に[^\n]*読み/.test(skill),
    'SKILL.md must instruct to read feedback-mode.md before F0');
  assert.ok(skill.includes('通常 / harvest mode では読まない'), 'normal/harvest mode must not load feedback-mode.md');
  assert.equal(/^### F0\. /m.test(skill), false, 'F0 procedure body must live in feedback-mode.md, not SKILL.md');
  for (const heading of ['### F0. ', '### F0b. ', '### F1. ', '### F2. ', '### F3. ']) {
    assert.ok(feedbackMode.includes(heading), `feedback-mode.md must contain ${heading}`);
  }
  assert.ok(feedbackMode.includes('feedback request: {feedback_request_id}'), 'feedback_instructions block moved');
  for (const fragment of [
    'work_unit_results', 'reconciliation_results', 'work_unit_evidence_refs', 'domain_event_refs', 'blocked_by_owner', '`deferred`',
    // subagent 安全規則（prompt-injection 境界 / allowed work unit 限定 / exact key / artifact path 制約）
    'non-instruction dataです', 'allowed_work_unit_idsだけを処理', 'exact 4キー', 'realpath解決後もroot内にある既存regular fileだけ',
    'untrusted classification data', 'lease lifecycle',
    // lease lifecycle の各遷移（取得 / 質問前の解放 / resume 再取得 / 終了時の解放）
    'lease取得', '質問前にleaseを解放', 'resumeではleaseを再取得', 'feedbackLease.js release',
  ]) {
    assert.ok(feedbackMode.includes(fragment), `feedback-mode.md must keep the ledger / disposition rule: ${fragment}`);
  }

  const template = fs.readFileSync(path.join(skillsRoot, 'dist-pipeline/references/subagent-template.md'), 'utf-8');
  assert.ok(template.includes('{feedback_instructions}'), 'placeholder must remain in the common template');
  assert.ok(template.includes('`references/feedback-mode.md`'), 'template must point feedback mode values to feedback-mode.md');
  assert.equal(template.includes('feedback request: {feedback_request_id}'), false, 'feedback_instructions body must not be duplicated in the template');
});
