#!/usr/bin/env node
// Status file is written to the skill bundle directory (../.pipeline-status.json relative to this script).
// Usage:
//   node progress-update.js init
//   node progress-update.js resume <start_step_id>   # 途中再開（start_step_id 未満を completed に設定）
//   node progress-update.js step <step_id> <state> [--summary "..."] [--event-id "..."] [--subagent-task "..."] [--tokens N]
//   node progress-update.js dialogue <step_id> <question> [--options "opt1,opt2"]
//   node progress-update.js dialogue-clear
//   node progress-update.js complete
//   node progress-update.js error <step_id> <message>
//   node progress-update.js summary                  # Step 別の状態・tokens・event_id を markdown 表で出力
//
// --tokens N は加算する(1 Step で subagent を複数回起動する 4a/4b や再実行を吸収)。
// 値は Agent 完了通知の <usage><subagent_tokens>N</subagent_tokens> を転記する(空なら省略)。
// 環境変数 DIST_PIPELINE_STATUS_PATH で status ファイルの出力先を上書きできる(テスト用)。

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
  if (process.env.DIST_PIPELINE_STATUS_PATH) return process.env.DIST_PIPELINE_STATUS_PATH;
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
      tokens: null,
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
  if (opts.tokens !== undefined) {
    // 非負整数のみ受理(3 桁区切りのカンマは許可)。前方一致の parseInt は "12abc" や "1e3" を通すので使わない
    const raw = String(opts.tokens).trim();
    const valid = /^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)$/.test(raw);
    const n = valid ? Number(raw.replace(/,/g, '')) : NaN;
    if (valid && Number.isSafeInteger(n)) {
      step.tokens = (step.tokens || 0) + n;
    } else {
      console.warn(`warning: --tokens "${opts.tokens}" is not a non-negative integer; ignored`);
    }
  }

  writeStatus(statusPath, status);
  console.log(`Step ${stepId}: ${state}`);
}

function cmdSummary() {
  const statusPath = getStatusPath();
  const status = readStatus(statusPath);
  if (!status) { console.error('Status not initialized.'); process.exit(1); }

  const lines = ['| Step | 状態 | tokens | event_id |', '|---|---|---:|---|'];
  let total = 0;
  for (const s of status.steps) {
    if (typeof s.tokens === 'number') total += s.tokens;
    const tokens = typeof s.tokens === 'number' ? s.tokens.toLocaleString('en-US') : '-';
    lines.push(`| ${s.id} | ${s.state} | ${tokens} | ${s.event_id || '-'} |`);
  }
  lines.push(`| **合計** | | ${total.toLocaleString('en-US')} | |`);
  console.log(lines.join('\n'));
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
  // 前回の status があれば tokens を全 Step から引き継ぐ(中断した Step の計上済み分も総量に含める)。
  // 先行 Step は event_id も引き継ぐ。init で消えるため先に読む
  const previous = readStatus(statusPath);
  cmdInit();
  const status = readStatus(statusPath);
  if (!status) { console.error('Status not initialized.'); process.exit(1); }

  // Find the index of the start step in STEPS array, then mark all preceding steps as completed
  const startIndex = STEPS.findIndex(s => String(s.id) === String(startStepId));
  if (startIndex === -1) { console.error(`Step ${startStepId} not found.`); process.exit(1); }

  const prevSteps = previous && Array.isArray(previous.steps) ? previous.steps : [];
  for (let i = 0; i < status.steps.length; i++) {
    const prev = prevSteps.find(s => String(s.id) === String(status.steps[i].id));
    if (prev && typeof prev.tokens === 'number') status.steps[i].tokens = prev.tokens;
    if (i < startIndex) {
      status.steps[i].state = 'completed';
      status.steps[i].completed_at = now();
      status.steps[i].summary = '(前回完了済み)';
      if (prev && prev.event_id) status.steps[i].event_id = prev.event_id;
    }
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
  case 'summary':
    cmdSummary();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
