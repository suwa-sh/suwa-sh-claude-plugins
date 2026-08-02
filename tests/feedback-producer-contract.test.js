'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const sampleRoot = path.join(root, 'samples/distillery-impl');
const feedbackDir = path.join(sampleRoot, 'docs/impl/latest/19ec0182/feedback-requests');
const { parseFeedbackRequest } = require('../plugins/distillery/skills/dist-pipeline/scripts/feedbackRequest');

function publishedFiles() {
  return fs.readdirSync(feedbackDir).filter(name => name.endsWith('.md')).sort();
}

function scalarMapping(text, key) {
  const lines = text.split(/\r?\n/);
  const matches = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(new RegExp(`^(\\s*)${key}:\\s*$`));
    if (match) matches.push({ index, indent: match[1].length });
  }
  assert.equal(matches.length, 1, `${key} must occur exactly once`);
  const { index, indent } = matches[0];
  const result = {};
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (line.trim() === '') continue;
    const leading = line.match(/^\s*/)[0].length;
    if (leading <= indent) break;
    assert.equal(leading, indent + 2, `${key} must contain only scalar members`);
    const member = line.trim().match(/^([a-z0-9_]+):\s*(.+)$/);
    assert.ok(member, `${key} contains an invalid scalar member`);
    assert.equal(Object.hasOwn(result, member[1]), false, `${key}.${member[1]} must be unique`);
    result[member[1]] = member[2].replace(/^['"]|['"]$/g, '');
  }
  return result;
}

function normalizedVisibleText(html) {
  return html
    .replace(/<code>/g, '')
    .replace(/<\/code>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

test('dist-impl publishes one self-contained Markdown that the consumer contract accepts', () => {
  assert.deepEqual(publishedFiles(), ['20260729_121600_impl_feedback_19ec0182.md']);
  const inputPath = path.join(feedbackDir, publishedFiles()[0]);
  const buffer = fs.readFileSync(inputPath);
  const parsed = parseFeedbackRequest(buffer);

  assert.equal(parsed.metadata.schema_version, 'distillery.feedback-request/v1');
  assert.equal(parsed.metadata.source, 'distillery-impl');
  assert.equal(parsed.metadata.uc_id, '19ec0182');
  assert.equal(parsed.requests.length, 11);
  assert.equal(new Set(parsed.requests.map(request => request.request_id)).size, 11);

  const text = buffer.toString('utf8');
  for (const forbidden of ['target_stage', 'target_stages', 'directive', 'approved_by', 'routes_sha256']) {
    assert.equal(text.includes(forbidden), false, `published input must not contain ${forbidden}`);
  }
  const legacyDirectory = path.join(sampleRoot, 'docs/impl/latest/19ec0182/change-requests');
  const legacyFiles = fs.existsSync(legacyDirectory) ? fs.readdirSync(legacyDirectory) : [];
  assert.deepEqual(legacyFiles, []);
});

test('producer does not carry a second schema/parser or feedback-routing contract', () => {
  const producerRoot = path.join(root, 'plugins/distillery-impl/skills/dist-impl-feedback');
  for (const relative of [
    'references/feedback-batch.schema.json',
    'references/feedback-batch-format.md',
    'scripts/feedbackBatchHash.js',
    'scripts/verifyFeedbackReview.js',
  ]) {
    assert.equal(fs.existsSync(path.join(producerRoot, relative)), false, `${relative} must not survive the migration`);
  }

  const producerFormat = fs.readFileSync(path.join(producerRoot, 'references/feedback-request-format.md'), 'utf8');
  assert.match(producerFormat, /dist-pipeline\/scripts\/feedbackRequest\.js/);
  assert.match(producerFormat, /Markdown \*\*1ファイルのパスだけ\*\*/);
});

test('implementation review presents every request without becoming a routing gate', () => {
  const input = parseFeedbackRequest(fs.readFileSync(path.join(feedbackDir, publishedFiles()[0])));
  const html = fs.readFileSync(path.join(sampleRoot, 'docs/impl/latest/19ec0182/review/index.html'), 'utf8');
  const visible = normalizedVisibleText(html);
  for (const request of input.requests) {
    assert.equal(html.split(request.request_id).length - 1, 1, `${request.request_id} must appear once in visible review content`);
    for (const sectionName of ['観測した事実', '現在の仕様と問題', '変更してほしいこと', '完了条件']) {
      const expected = request.sections[sectionName].body.replaceAll('`', '').replace(/\s+/g, ' ').trim();
      assert.ok(visible.includes(expected), `${request.request_id} must show the complete ${sectionName} body`);
    }
  }
  assert.match(html, new RegExp(`feedback ID:</strong>\\s*<code>${input.metadata.feedback_id}</code>`));
  assert.match(html, new RegExp(`<strong>変更要求:</strong>\\s*${input.requests.length}件`));
  assert.match(html, /<code>\.\.\/feedback\/draft\.md<\/code>/);
  assert.doesNotMatch(html, /href="\.\.\/feedback\/draft\.md"/);
  assert.match(html, new RegExp(`href="\\.\\.\\/feedback-requests\\/${input.metadata.feedback_id}\\.md"`));
  assert.doesNotMatch(html, /target_stage|feedback-routes|routes_sha256|directive-id/);
});

test('publish state points at the exact canonical Markdown identity', () => {
  const inputPath = path.join(feedbackDir, publishedFiles()[0]);
  const parsed = parseFeedbackRequest(fs.readFileSync(inputPath));
  // 2026-08-02: UI 規範導入で stage done は invalidated/ へ退避済み(event 20260802_103500)。
  // 完了証跡は immutable な退避先から読む(events が正、退避 done はその記録)。
  const done = fs.readFileSync(path.join(sampleRoot, 'docs/impl/latest/19ec0182/invalidated/20260802_103500_ui_norms_stages_archived/stages/S8_feedback.done.yaml'), 'utf8');
  const event = fs.readFileSync(path.join(sampleRoot, 'docs/impl/events/20260729_123002_feedback_request_published/event.yaml'), 'utf8');

  for (const text of [done, event]) {
    assert.match(text, new RegExp(`feedback_id: ["']?${parsed.metadata.feedback_id}`));
    assert.match(text, new RegExp(`input_sha256: ["']?${parsed.input_sha256}`));
  }
});

test('implementation approval is bound to the exact draft that publish exposes', () => {
  const inputPath = path.join(feedbackDir, publishedFiles()[0]);
  const parsed = parseFeedbackRequest(fs.readFileSync(inputPath));
  const evidenceEventId = '20260729_122500_s9_review_generated';
  const approvalEventId = '20260729_123000_review_approved';
  const publishStartedEventId = '20260729_123001_feedback_request_publish_started';
  const publishedEventId = '20260729_123002_feedback_request_published';
  assert.ok(evidenceEventId < approvalEventId);
  assert.ok(approvalEventId < publishStartedEventId);
  assert.ok(publishStartedEventId < publishedEventId);
  const stateFiles = [
    // done は invalidated/ へ退避済み(event 20260802_103500)。退避先から読む
    'docs/impl/latest/19ec0182/invalidated/20260802_103500_ui_norms_stages_archived/stages/S9_review_generated.done.yaml',
    `docs/impl/events/${evidenceEventId}/event.yaml`,
    `docs/impl/events/${approvalEventId}/event.yaml`,
  ].map(relative => fs.readFileSync(path.join(sampleRoot, relative), 'utf8'));

  for (const text of stateFiles) {
    assert.match(text, new RegExp(`feedback_id: ["']?${parsed.metadata.feedback_id}`));
    assert.match(text, new RegExp(`draft_sha256: ["']?${parsed.input_sha256}`));
    assert.match(text, new RegExp(`request_count: ${parsed.requests.length}`));
  }

  assert.match(stateFiles[2], new RegExp(`review_evidence_event_id: ["']?${evidenceEventId}`));
  for (const eventId of [publishStartedEventId, publishedEventId]) {
    const text = fs.readFileSync(path.join(sampleRoot, `docs/impl/events/${eventId}/event.yaml`), 'utf8');
    assert.match(text, new RegExp(`input_sha256: ["']?${parsed.input_sha256}`));
    assert.match(text, new RegExp(`review_approved_event_id: ["']?${approvalEventId}`));
    assert.match(text, new RegExp(`review_evidence_event_id: ["']?${evidenceEventId}`));
  }
});

test('implementation approval is also bound to the exact zero-knowledge review evidence', () => {
  const htmlPath = path.join(sampleRoot, 'docs/impl/latest/19ec0182/review/index.html');
  const html = fs.readFileSync(htmlPath);
  const htmlSha256 = crypto.createHash('sha256').update(html).digest('hex');
  const expected = {
    review_html_sha256: htmlSha256,
    gate_result: '6/6 pass',
    open_blocker_count: '0',
    open_major_count: '2',
  };
  const visible = normalizedVisibleText(html.toString('utf8'));
  assert.ok(visible.includes('6/6 pass'), 'review HTML must display the bound gate result');
  assert.ok(visible.includes('最終結果: blocker 0、major 2'), 'review HTML must display the bound open finding counts');
  // status.yaml は state: invalidated のスナップショットになったため evidence を持たない
  // (完了時 evidence の正は events と退避済み done — event 20260802_103500 参照)
  for (const relative of [
    'docs/impl/latest/19ec0182/invalidated/20260802_103500_ui_norms_stages_archived/stages/S9_review_generated.done.yaml',
    'docs/impl/events/20260729_122500_s9_review_generated/event.yaml',
    'docs/impl/events/20260729_123000_review_approved/event.yaml',
  ]) {
    const text = fs.readFileSync(path.join(sampleRoot, relative), 'utf8');
    assert.deepEqual(scalarMapping(text, 'implementation_review_evidence'), expected, relative);
  }
});

test('publish contract rejects symlink and path-containment substitutions', () => {
  const contract = fs.readFileSync(path.join(root, 'plugins/distillery-impl/skills/dist-impl-feedback/SKILL.md'), 'utf8');
  for (const required of ['lstat', 'realpath', 'regular file', 'non-symlink', 'same-filesystem', 'device/inode/size', 'no-follow']) {
    assert.match(contract, new RegExp(required), `publish contract must require ${required}`);
  }
  assert.match(contract, /canonical UC root/);
  assert.match(contract, /implementation_review_evidence/);
});
