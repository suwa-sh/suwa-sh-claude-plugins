#!/usr/bin/env node
// Status file is written to the skill bundle directory (../.pipeline-status.json relative to this script).
// Usage:
//   node progress-update.js init
//   node progress-update.js resume <start_step_id>   # 途中再開（start_step_id 未満を completed に設定）
//   node progress-update.js step <step_id> <state> [--summary "..."] [--event-id "..."] [--subagent-task "..."]
//   node progress-update.js dialogue <step_id> <question> [--options "opt1,opt2"]
//   node progress-update.js dialogue-clear
//   node progress-update.js complete
//   node progress-update.js error <step_id> <message>

const fs = require('fs');
const path = require('path');

const STEPS = [
  { id: 1, name: 'requirements', label: 'USDM分解 + RDRA モデル構築' },
  { id: 2, name: 'quality-attributes', label: '非機能要求グレード' },
  { id: 3, name: 'architecture', label: 'アーキテクチャ設計' },
  { id: '4a', name: 'infrastructure-mcl', label: 'インフラ設計（MCL実行）' },
  { id: '4b', name: 'infrastructure-record', label: 'インフラ設計（記録・FB）' },
  { id: 5, name: 'design-system', label: 'デザインシステム' },
  { id: 6, name: 'spec', label: 'UC仕様生成' },
  { id: '6a', name: 'spec-story-check', label: 'Storybook Story 補完' },
  { id: '6b', name: 'rdra-feedback-loop', label: '網羅率チェック' },
];

function getStatusPath() {
  // スキルのバンドルディレクトリに、作業ディレクトリ名を含めたファイル名で出力する。
  // これによりグローバルインストール時に複数プロジェクトで同時実行しても競合しない。
  const cwd = process.cwd();
  const dirName = path.basename(cwd).replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(__dirname, '..', `.pipeline-status-${dirName}.json`);
}

// progress-server.js が書き込んだ実行中ポートを取得する。
// サーバー未起動なら null。オーケストレータはこの値からダッシュボードURLを組み立てる。
function getServerPort() {
  const portFile = path.join(__dirname, '..', '.progress-server.port');
  try {
    if (fs.existsSync(portFile)) {
      const v = parseInt(fs.readFileSync(portFile, 'utf-8').trim(), 10);
      if (!Number.isNaN(v)) return v;
    }
  } catch {}
  return null;
}

function getDashboardUrl() {
  const port = getServerPort();
  return port ? `http://localhost:${port}` : null;
}

// CLI: `node progress-update.js port` → 現行ポート or 空行
// CLI: `node progress-update.js url`  → http://localhost:<port> or 空行
if (process.argv[2] === 'port') {
  const p = getServerPort();
  if (p) console.log(p);
  process.exit(0);
}
if (process.argv[2] === 'url') {
  const u = getDashboardUrl();
  if (u) console.log(u);
  process.exit(0);
}

function readStatus(statusPath) {
  if (fs.existsSync(statusPath)) {
    return JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
  }
  return null;
}

function writeStatus(statusPath, status) {
  status.updated_at = new Date().toISOString();
  fs.writeFileSync(statusPath, JSON.stringify(status, null, 2), 'utf-8');
}

function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      result[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return result;
}

function now() {
  return new Date().toISOString();
}

// --- Commands ---

function cmdInit() {
  const statusPath = getStatusPath();
  const status = {
    pipeline: {
      state: 'running',
      started_at: now(),
      current_step: null,
      total_steps: 6,
    },
    steps: STEPS.map(s => ({
      id: s.id,
      name: s.name,
      label: s.label,
      state: 'pending',
      started_at: null,
      completed_at: null,
      event_id: null,
      summary: null,
      subagent_task: null,
    })),
    dialogue: null,
    updated_at: now(),
  };
  writeStatus(statusPath, status);
  console.log(`Pipeline status initialized: ${statusPath}`);
}

function cmdStep(stepId, state, opts) {
  const statusPath = getStatusPath();
  const status = readStatus(statusPath);
  if (!status) { console.error('Status not initialized. Run init first.'); process.exit(1); }

  const step = status.steps.find(s => String(s.id) === String(stepId));
  if (!step) { console.error(`Step ${stepId} not found.`); process.exit(1); }

  step.state = state;
  if (state === 'running') {
    step.started_at = step.started_at || now();
    status.pipeline.current_step = stepId;
    status.pipeline.state = 'running';
  }
  if (state === 'completed') {
    step.completed_at = now();
  }
  if (opts.summary) step.summary = opts.summary;
  if (opts['event-id']) step.event_id = opts['event-id'];
  if (opts['subagent-task']) step.subagent_task = opts['subagent-task'];

  writeStatus(statusPath, status);
  console.log(`Step ${stepId}: ${state}`);
}

function cmdDialogue(stepId, question, opts) {
  const statusPath = getStatusPath();
  const status = readStatus(statusPath);
  if (!status) { console.error('Status not initialized.'); process.exit(1); }

  status.dialogue = {
    active: true,
    step: stepId,
    question: question,
    options: opts.options ? opts.options.split(',') : null,
    since: now(),
  };
  status.pipeline.state = 'waiting_for_user';
  writeStatus(statusPath, status);
  console.log(`Dialogue set for step ${stepId}`);
}

function cmdDialogueClear() {
  const statusPath = getStatusPath();
  const status = readStatus(statusPath);
  if (!status) { console.error('Status not initialized.'); process.exit(1); }

  status.dialogue = null;
  status.pipeline.state = 'running';
  writeStatus(statusPath, status);
  console.log('Dialogue cleared');
}

function cmdComplete() {
  const statusPath = getStatusPath();
  const status = readStatus(statusPath);
  if (!status) { console.error('Status not initialized.'); process.exit(1); }

  status.pipeline.state = 'completed';
  status.pipeline.completed_at = now();
  writeStatus(statusPath, status);
  console.log('Pipeline completed');
}

function cmdResume(startStepId) {
  const statusPath = getStatusPath();
  cmdInit();
  const status = readStatus(statusPath);
  if (!status) { console.error('Status not initialized.'); process.exit(1); }

  // Find the index of the start step in STEPS array, then mark all preceding steps as completed
  const startIndex = STEPS.findIndex(s => String(s.id) === String(startStepId));
  if (startIndex === -1) { console.error(`Step ${startStepId} not found.`); process.exit(1); }

  for (let i = 0; i < startIndex; i++) {
    status.steps[i].state = 'completed';
    status.steps[i].completed_at = now();
    status.steps[i].summary = '(前回完了済み)';
  }
  status.pipeline.state = 'running';
  writeStatus(statusPath, status);
  console.log(`Pipeline resumed from step ${startStepId} (${startIndex} steps marked completed)`);
}

function cmdError(stepId, message) {
  const statusPath = getStatusPath();
  const status = readStatus(statusPath);
  if (!status) { console.error('Status not initialized.'); process.exit(1); }

  const step = status.steps.find(s => String(s.id) === String(stepId));
  if (step) {
    step.state = 'error';
    step.summary = message;
  }
  status.pipeline.state = 'error';
  writeStatus(statusPath, status);
  console.log(`Error at step ${stepId}: ${message}`);
}

// --- Main ---
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node progress-update.js <command> [args...]');
  process.exit(1);
}

const command = args[0];

switch (command) {
  case 'init':
    cmdInit();
    break;
  case 'resume':
    cmdResume(args[1]);
    break;
  case 'step':
    cmdStep(args[1], args[2], parseArgs(args.slice(3)));
    break;
  case 'dialogue':
    cmdDialogue(args[1], args[2], parseArgs(args.slice(3)));
    break;
  case 'dialogue-clear':
    cmdDialogueClear();
    break;
  case 'complete':
    cmdComplete();
    break;
  case 'error':
    cmdError(args[1], args.slice(2).join(' '));
    break;
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
